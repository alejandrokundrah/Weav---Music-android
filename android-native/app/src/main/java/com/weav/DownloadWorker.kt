package com.weav

import android.content.Context
import android.os.Environment
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL

/**
 * Worker for downloading tracks in the background.
 *
 * Uses WorkManager to handle downloads reliably even when the app is killed.
 * Supports progress reporting and automatic retry on failure.
 */
class DownloadWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val KEY_TRACK_ID = "track_id"
        const val KEY_TRACK_URL = "track_url"
        const val KEY_QUALITY = "quality"
        const val KEY_OUTPUT_PATH = "output_path"
        const val KEY_PROGRESS = "progress"
    }

    override suspend fun doWork(): Result {
        val trackId = inputData.getString(KEY_TRACK_ID) ?: return Result.failure()
        val trackUrl = inputData.getString(KEY_TRACK_URL) ?: return Result.failure()
        val quality = inputData.getString(KEY_QUALITY) ?: "high"

        return try {
            downloadTrack(trackId, trackUrl, quality)
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private suspend fun downloadTrack(
        trackId: String,
        trackUrl: String,
        quality: String
    ): String = withContext(Dispatchers.IO) {
        // Create output directory
        val musicDir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
            "WEAV"
        )
        if (!musicDir.exists()) {
            musicDir.mkdirs()
        }

        // Create output file
        val outputFile = File(musicDir, "$trackId.opus")
        val outputPath = outputFile.absolutePath

        // Download the file
        val url = URL(trackUrl)
        val connection = url.openConnection()
        val totalBytes = connection.contentLength
        val inputStream = url.openStream()
        val outputStream = FileOutputStream(outputFile)

        val buffer = ByteArray(4 * 1024) // 4KB buffer
        var bytesRead: Int
        var totalBytesRead = 0L

        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
            outputStream.write(buffer, 0, bytesRead)
            totalBytesRead += bytesRead

            // Report progress
            if (totalBytes > 0) {
                val progress = ((totalBytesRead * 100) / totalBytes).toInt()
                setProgressAsync(
                    workDataOf(
                        KEY_PROGRESS to progress,
                        KEY_TRACK_ID to trackId,
                        KEY_OUTPUT_PATH to outputPath
                    )
                )
            }
        }

        outputStream.close()
        inputStream.close()

        // Save to MediaStore
        NativeBridge.saveTrackToMediaStore(
            title = trackId, // In production, pass actual metadata
            artist = "Unknown",
            album = "Unknown",
            durationMs = 0,
            filePath = outputPath
        )

        outputPath
    }
}
