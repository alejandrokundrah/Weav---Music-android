package com.weav

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Native Android audio service using ExoPlayer.
 *
 * This service handles all audio playback natively, replacing the Rust audio engine.
 * It provides better battery efficiency, hardware acceleration, and proper Android integration.
 */
class NativeAudioService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "weav_playback"
        private const val ACTION_PLAY = "com.weav.ACTION_PLAY"
        private const val ACTION_PAUSE = "com.weav.ACTION_PAUSE"
        private const val ACTION_NEXT = "com.weav.ACTION_NEXT"
        private const val ACTION_PREVIOUS = "com.weav.ACTION_PREVIOUS"

        private var instance: NativeAudioService? = null

        fun getInstance(): NativeAudioService? = instance
    }

    private val binder = LocalBinder()
    private lateinit var exoPlayer: ExoPlayer
    private lateinit var mediaSession: MediaSession
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private var positionUpdateJob: Job? = null

    // Playback state callbacks
    private var onPlaybackStateChanged: ((Boolean) -> Unit)? = null
    private var onPositionChanged: ((Long) -> Unit)? = null
    private var onTrackEnded: (() -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun getService(): NativeAudioService = this@NativeAudioService
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize ExoPlayer
        exoPlayer = ExoPlayer.Builder(this).build().apply {
            setHandleAudioBecomingNoisy(true)
        }

        // Set up player listener
        exoPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                when (playbackState) {
                    Player.STATE_IDLE -> { /* Do nothing */ }
                    Player.STATE_BUFFERING -> { /* Buffering */ }
                    Player.STATE_READY -> {
                        onPlaybackStateChanged?.invoke(isPlaying)
                    }
                    Player.STATE_ENDED -> {
                        onTrackEnded?.invoke()
                    }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                onPlaybackStateChanged?.invoke(isPlaying)
                updateNotification()
            }
        })

        // Create media session
        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setId("weav_session")
            .build()

        createNotificationChannel()
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY -> play()
            ACTION_PAUSE -> pause()
            ACTION_NEXT -> skipToNext()
            ACTION_PREVIOUS -> skipToPrevious()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        positionUpdateJob?.cancel()
        mediaSession.release()
        exoPlayer.release()
        instance = null
        super.onDestroy()
    }

    // Public API for Tauri bridge

    /**
     * Play a track from a URL
     */
    fun playTrack(url: String, positionMs: Long = 0L) {
        val mediaItem = MediaItem.fromUri(url)
        exoPlayer.setMediaItem(mediaItem, positionMs)
        exoPlayer.prepare()
        exoPlayer.play()

        startPositionUpdates()
    }

    /**
     * Resume playback
     */
    fun play() {
        exoPlayer.play()
        startPositionUpdates()
    }

    /**
     * Pause playback
     */
    fun pause() {
        exoPlayer.pause()
        positionUpdateJob?.cancel()
    }

    /**
     * Seek to a specific position
     */
    fun seekTo(positionMs: Long) {
        exoPlayer.seekTo(positionMs)
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    fun setVolume(volume: Float) {
        exoPlayer.volume = volume.coerceIn(0f, 1f)
    }

    /**
     * Set playback rate (0.5 to 2.0)
     */
    fun setPlaybackRate(rate: Float) {
        val params = exoPlayer.playbackParameters
        exoPlayer.playbackParameters = params.withSpeed(rate.coerceIn(0.5f, 2.0f))
    }

    /**
     * Get current playback position in milliseconds
     */
    fun getCurrentPosition(): Long {
        return exoPlayer.currentPosition
    }

    /**
     * Get total duration in milliseconds
     */
    fun getDuration(): Long {
        return exoPlayer.duration
    }

    /**
     * Check if currently playing
     */
    fun isPlaying(): Boolean {
        return exoPlayer.isPlaying
    }

    /**
     * Skip to next track (placeholder - queue management is in React)
     */
    fun skipToNext() {
        // This will be called by the media session callback
        // The actual next track should be loaded by Tauri
        onTrackEnded?.invoke()
    }

    /**
     * Skip to previous track
     */
    fun skipToPrevious() {
        if (exoPlayer.currentPosition > 3000) {
            seekTo(0)
        } else {
            // Ask Tauri for previous track
            onTrackEnded?.invoke()
        }
    }

    /**
     * Stop playback
     */
    fun stop() {
        exoPlayer.stop()
        positionUpdateJob?.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    // Callback registration

    fun setPlaybackStateChangedListener(listener: (Boolean) -> Unit) {
        onPlaybackStateChanged = listener
    }

    fun setPositionChangedListener(listener: (Long) -> Unit) {
        onPositionChanged = listener
    }

    fun setTrackEndedListener(listener: () -> Unit) {
        onTrackEnded = listener
    }

    // Private helpers

    private fun startPositionUpdates() {
        positionUpdateJob?.cancel()
        positionUpdateJob = serviceScope.launch {
            while (exoPlayer.isPlaying) {
                onPositionChanged?.invoke(exoPlayer.currentPosition)
                delay(250) // Update every 250ms
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "WEAV Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows currently playing track"
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun updateNotification() {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createNotification(): Notification {
        val playPauseAction = if (exoPlayer.isPlaying) {
            NotificationCompat.Action(
                android.R.drawable.ic_media_pause,
                "Pause",
                createPendingIntent(ACTION_PAUSE)
            )
        } else {
            NotificationCompat.Action(
                android.R.drawable.ic_media_play,
                "Play",
                createPendingIntent(ACTION_PLAY)
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("WEAV")
            .setContentText(if (exoPlayer.isPlaying) "Playing" else "Paused")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .addAction(playPauseAction)
            .setOngoing(exoPlayer.isPlaying)
            .build()
    }

    private fun createPendingIntent(action: String): PendingIntent {
        val intent = Intent(this, NativeAudioService::class.java).apply {
            this.action = action
        }
        return PendingIntent.getService(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }
}
