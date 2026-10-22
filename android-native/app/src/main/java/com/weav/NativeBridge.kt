package com.weav

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf

/**
 * Bridge between Tauri/React and native Android components.
 *
 * This class provides static methods that can be called from Tauri via JNI
 * to interact with native Android services like audio playback and downloads.
 */
object NativeBridge {

    private var context: Context? = null
    private var audioService: NativeAudioService? = null
    private var isBound = false

    // Callbacks for state updates back to Tauri
    private var onPlaybackStateChanged: ((Boolean) -> Unit)? = null
    private var onPositionChanged: ((Long) -> Unit)? = null
    private var onTrackEnded: (() -> Unit)? = null

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as NativeAudioService.LocalBinder
            audioService = binder.getService()
            isBound = true

            // Re-register callbacks after service is connected
            onPlaybackStateChanged?.let { audioService?.setPlaybackStateChangedListener(it) }
            onPositionChanged?.let { audioService?.setPositionChangedListener(it) }
            onTrackEnded?.let { audioService?.setTrackEndedListener(it) }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            audioService = null
            isBound = false
        }
    }

    /**
     * Initialize the native bridge with application context
     */
    @JvmStatic
    fun initialize(context: Context) {
        this.context = context.applicationContext

        // Start the audio service
        val intent = Intent(context, NativeAudioService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }

        // Bind to the service
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    /**
     * Cleanup resources
     */
    @JvmStatic
    fun cleanup() {
        if (isBound && context != null) {
            context?.unbindService(serviceConnection)
            isBound = false
        }
        audioService?.stop()
        audioService = null
        context = null
    }

    // Audio playback methods

    /**
     * Play a track from a URL
     * @param url The streaming URL of the track
     * @param positionMs Starting position in milliseconds (default: 0)
     */
    @JvmStatic
    fun playTrack(url: String, positionMs: Long = 0L) {
        audioService?.playTrack(url, positionMs)
    }

    /**
     * Resume playback
     */
    @JvmStatic
    fun play() {
        audioService?.play()
    }

    /**
     * Pause playback
     */
    @JvmStatic
    fun pause() {
        audioService?.pause()
    }

    /**
     * Seek to a specific position
     * @param positionMs Position in milliseconds
     */
    @JvmStatic
    fun seekTo(positionMs: Long) {
        audioService?.seekTo(positionMs)
    }

    /**
     * Set volume
     * @param volume Volume level (0.0 to 1.0)
     */
    @JvmStatic
    fun setVolume(volume: Float) {
        audioService?.setVolume(volume)
    }

    /**
     * Set playback rate
     * @param rate Playback speed (0.5 to 2.0)
     */
    @JvmStatic
    fun setPlaybackRate(rate: Float) {
        audioService?.setPlaybackRate(rate)
    }

    /**
     * Get current playback position
     * @return Position in milliseconds
     */
    @JvmStatic
    fun getCurrentPosition(): Long {
        return audioService?.getCurrentPosition() ?: 0L
    }

    /**
     * Get total duration
     * @return Duration in milliseconds
     */
    @JvmStatic
    fun getDuration(): Long {
        return audioService?.getDuration() ?: 0L
    }

    /**
     * Check if currently playing
     * @return true if playing, false otherwise
     */
    @JvmStatic
    fun isPlaying(): Boolean {
        return audioService?.isPlaying() ?: false
    }

    /**
     * Skip to next track
     */
    @JvmStatic
    fun skipToNext() {
        audioService?.skipToNext()
    }

    /**
     * Skip to previous track
     */
    @JvmStatic
    fun skipToPrevious() {
        audioService?.skipToPrevious()
    }

    /**
     * Stop playback
     */
    @JvmStatic
    fun stop() {
        audioService?.stop()
    }

    // Download methods (WorkManager integration)

    /**
     * Enqueue a track for download
     * @param trackId Unique identifier for the track
     * @param url Streaming URL of the track
     * @param quality Audio quality (e.g., "high", "medium", "low")
     * @return Work ID for tracking the download
     */
    @JvmStatic
    fun enqueueDownload(trackId: String, url: String, quality: String): String {
        val workRequest = OneTimeWorkRequestBuilder<DownloadWorker>()
            .setInputData(
                workDataOf(
                    DownloadWorker.KEY_TRACK_ID to trackId,
                    DownloadWorker.KEY_TRACK_URL to url,
                    DownloadWorker.KEY_QUALITY to quality
                )
            )
            .build()

        WorkManager.getInstance(context!!).enqueue(workRequest)
        return workRequest.id.toString()
    }

    /**
     * Cancel a download
     * @param workId The work ID returned by enqueueDownload
     */
    @JvmStatic
    fun cancelDownload(workId: String) {
        val workIdUuid = java.util.UUID.fromString(workId)
        WorkManager.getInstance(context!!).cancelWorkById(workIdUuid)
    }

    /**
     * Get download progress
     * @param workId The work ID returned by enqueueDownload
     * @return Progress percentage (0-100)
     */
    @JvmStatic
    fun getDownloadProgress(workId: String): Int {
        val workIdUuid = java.util.UUID.fromString(workId)
        val workInfo = WorkManager.getInstance(context!!).getWorkInfoById(workIdUuid).get()
        return workInfo.progress.getInt(DownloadWorker.KEY_PROGRESS, 0)
    }

    // File storage methods (MediaStore integration)

    private var mediaStoreManager: MediaStoreManager? = null

    /**
     * Save a downloaded track to MediaStore
     * @param title Track title
     * @param artist Artist name
     * @param album Album name
     * @param durationMs Duration in milliseconds
     * @param filePath Path to the downloaded file
     * @return URI of the saved track as string
     */
    @JvmStatic
    fun saveTrackToMediaStore(
        title: String,
        artist: String,
        album: String,
        durationMs: Long,
        filePath: String
    ): String {
        val manager = mediaStoreManager ?: run {
            mediaStoreManager = MediaStoreManager(context!!)
            mediaStoreManager!!
        }

        val fileUri = android.net.Uri.fromFile(java.io.File(filePath))
        val mediaUri = manager.saveTrack(title, artist, album, durationMs, fileUri)
        return mediaUri.toString()
    }

    /**
     * Scan a local file and add it to MediaStore
     * @param filePath Path to the audio file
     * @return URI of the scanned file as string
     */
    @JvmStatic
    fun scanFile(filePath: String): String {
        val manager = mediaStoreManager ?: run {
            mediaStoreManager = MediaStoreManager(context!!)
            mediaStoreManager!!
        }

        val uri = manager.scanFile(filePath)
        return uri.toString()
    }

    // Callback registration (called from Tauri)

    /**
     * Register callback for playback state changes
     * @param callback Function called with true when playing, false when paused
     */
    @JvmStatic
    fun setPlaybackStateChangedListener(callback: (Boolean) -> Unit) {
        onPlaybackStateChanged = callback
        audioService?.setPlaybackStateChangedListener(callback)
    }

    /**
     * Register callback for position updates
     * @param callback Function called with current position in milliseconds
     */
    @JvmStatic
    fun setPositionChangedListener(callback: (Long) -> Unit) {
        onPositionChanged = callback
        audioService?.setPositionChangedListener(callback)
    }

    /**
     * Register callback for track end
     * @param callback Function called when the current track ends
     */
    @JvmStatic
    fun setTrackEndedListener(callback: () -> Unit) {
        onTrackEnded = callback
        audioService?.setTrackEndedListener(callback)
    }
}
