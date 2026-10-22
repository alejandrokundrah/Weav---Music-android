package com.weav

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.MediaStore.Audio
import androidx.annotation.RequiresApi

/**
 * Manager for interacting with Android's MediaStore.
 *
 * Handles saving tracks to the system's media database so they appear
 * in other music apps and the system file picker.
 */
class MediaStoreManager(private val context: Context) {

    /**
     * Save a track to MediaStore
     * @param title Track title
     * @param artist Artist name
     * @param album Album name
     * @param durationMs Duration in milliseconds
     * @param fileUri URI of the audio file
     * @return URI of the inserted MediaStore entry
     */
    fun saveTrack(
        title: String,
        artist: String,
        album: String,
        durationMs: Long,
        fileUri: Uri
    ): Uri {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveTrackModern(title, artist, album, durationMs, fileUri)
        } else {
            saveTrackLegacy(title, artist, album, durationMs, fileUri)
        }
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun saveTrackModern(
        title: String,
        artist: String,
        album: String,
        durationMs: Long,
        fileUri: Uri
    ): Uri {
        val values = ContentValues().apply {
            put(Audio.Media.TITLE, title)
            put(Audio.Media.ARTIST, artist)
            put(Audio.Media.ALBUM, album)
            put(Audio.Media.DURATION, durationMs)
            put(Audio.Media.IS_MUSIC, 1)
            put(Audio.Media.DISPLAY_NAME, "$title.opus")
            put(Audio.Media.MIME_TYPE, "audio/opus")
            put(Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/WEAV")
        }

        return context.contentResolver.insert(
            Audio.Media.EXTERNAL_CONTENT_URI,
            values
        ) ?: throw IllegalStateException("Failed to insert into MediaStore")
    }

    @Suppress("DEPRECATION")
    private fun saveTrackLegacy(
        title: String,
        artist: String,
        album: String,
        durationMs: Long,
        fileUri: Uri
    ): Uri {
        val values = ContentValues().apply {
            put(Audio.Media.TITLE, title)
            put(Audio.Media.ARTIST, artist)
            put(Audio.Media.ALBUM, album)
            put(Audio.Media.DURATION, durationMs)
            put(Audio.Media.IS_MUSIC, 1)
            put(Audio.Media.DATA, fileUri.path)
            put(Audio.Media.MIME_TYPE, "audio/opus")
        }

        return context.contentResolver.insert(
            Audio.Media.EXTERNAL_CONTENT_URI,
            values
        ) ?: throw IllegalStateException("Failed to insert into MediaStore")
    }

    /**
     * Scan a local file and add it to MediaStore
     * @param filePath Path to the audio file
     * @return URI of the scanned file
     */
    fun scanFile(filePath: String): Uri {
        val values = ContentValues().apply {
            put(Audio.Media.DATA, filePath)
            put(Audio.Media.MIME_TYPE, "audio/*")
        }

        return context.contentResolver.insert(
            Audio.Media.EXTERNAL_CONTENT_URI,
            values
        ) ?: throw IllegalStateException("Failed to scan file")
    }

    /**
     * Delete a track from MediaStore
     * @param uri URI of the track to delete
     * @return Number of rows deleted
     */
    fun deleteTrack(uri: Uri): Int {
        return context.contentResolver.delete(uri, null, null)
    }

    /**
     * Query tracks from MediaStore
     * @param selection Selection criteria (SQL WHERE clause)
     * @param selectionArgs Arguments for selection
     * @return List of track URIs
     */
    fun queryTracks(
        selection: String? = null,
        selectionArgs: Array<String>? = null
    ): List<Uri> {
        val projection = arrayOf(Audio.Media._ID)
        val cursor = context.contentResolver.query(
            Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            null
        )

        val uris = mutableListOf<Uri>()
        cursor?.use {
            while (it.moveToNext()) {
                val id = it.getLong(it.getColumnIndexOrThrow(Audio.Media._ID))
                uris.add(Uri.withAppendedPath(Audio.Media.EXTERNAL_CONTENT_URI, id.toString()))
            }
        }

        return uris
    }
}
