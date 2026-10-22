# Hybrid Android Architecture - WEAV

## Overview

This document outlines a hybrid architecture that combines Tauri's existing YouTube Music integration with native Android components for performance-critical operations.

## Architecture Decision

**Why Hybrid?**
- YouTube Music API integration is ~6.1k lines of complex code (youtubei.js, Innertube, auth, cookies)
- Rewriting this in Kotlin would take months and risk breaking with YouTube's frequent API changes
- Native Android components excel at: audio playback, downloads, file I/O, background services, media session integration

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Native Android Layer                      │
│  (Kotlin + Jetpack Compose + AndroidX Libraries)            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ExoPlayer    │  │ Download     │  │ File Storage │      │
│  │ (Audio)      │  │ Manager      │  │ (MediaStore) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                  │
│                    ┌──────▼──────┐                           │
│                    │  Native     │                           │
│                    │  Bridge API │                           │
│                    └──────┬──────┘                           │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            │ Tauri IPC Bridge
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                    Tauri WebView Layer                       │
│  (React + TypeScript + youtubei.js)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ YouTube     │  │ React UI     │  │ State        │      │
│  │ Music API   │  │ Components   │  │ Management   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Native Android Components (New)

#### 1.1 ExoPlayer Integration
**Purpose:** Replace Rust audio engine with native Android ExoPlayer

**Benefits:**
- Native hardware acceleration
- Better battery efficiency
- Built-in support for media session, focus handling, audio attributes
- Better gapless playback and crossfade support
- Hardware codec support (Opus, AAC, etc.)

**Implementation:**
```kotlin
// NativeAudioService.kt
class NativeAudioService : Service() {
    private lateinit var exoPlayer: ExoPlayer

    // Methods exposed to Tauri via IPC
    fun playTrack(url: String, positionMs: Long)
    fun pause()
    fun seekTo(positionMs: Long)
    fun setVolume(volume: Float)
    fun setPlaybackRate(rate: Float)
    fun getCurrentPosition(): Long
    fun getDuration(): Long
}
```

**Replaces:**
- `src-tauri/src/audio.rs` (Rust audio engine)
- `src-tauri/src/opus_source.rs` (Opus decoding)
- `src/player/rustAudio.ts` (Frontend audio bridge)

#### 1.2 Download Manager
**Purpose:** Replace Rust download system with native Android WorkManager

**Benefits:**
- Proper background execution even when app is killed
- Network-aware (waits for connectivity)
- Retry logic built-in
- Battery optimization integration
- Progress notifications

**Implementation:**
```kotlin
// DownloadWorker.kt
class DownloadWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val trackUrl = inputData.getString("track_url")!!
        val outputPath = inputData.getString("output_path")!!

        // Download with progress updates
        downloadFile(trackUrl, outputPath) { progress ->
            setProgressAsync(workDataOf("progress" to progress))
        }

        return Result.success()
    }
}
```

**Replaces:**
- `src-tauri/src/lib.rs` (offline_audio_save command)
- `src/player/offlineStore.ts` (Download queue management)

#### 1.3 File Storage & MediaStore
**Purpose:** Use Android's MediaStore API for proper file management

**Benefits:**
- Files appear in system music apps
- Proper scoped storage compliance
- Album art automatically indexed
- Better integration with Android's media picker

**Implementation:**
```kotlin
// MediaStoreManager.kt
class MediaStoreManager(private val context: Context) {
    fun saveTrack(
        title: String,
        artist: String,
        album: String,
        durationMs: Long,
        fileUri: Uri
    ): Uri {
        val values = ContentValues().apply {
            put(MediaStore.Audio.Media.TITLE, title)
            put(MediaStore.Audio.Media.ARTIST, artist)
            put(MediaStore.Audio.Media.ALBUM, album)
            put(MediaStore.Audio.Media.DURATION, durationMs)
            put(MediaStore.Audio.Media.DATA, fileUri.path)
        }
        return context.contentResolver.insert(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            values
        )!!
    }
}
```

**Replaces:**
- `src-tauri/src/lib.rs` (local_audio_scan, local_audio_tags)
- File system operations in offline store

#### 1.4 Media Session Integration
**Purpose:** Proper Android media session for lock screen controls, headset buttons

**Benefits:**
- Lock screen playback controls
- Bluetooth/headset media button support
- Automotive (Android Auto) integration
- Voice assistant integration ("Hey Google, pause music")

**Implementation:**
```kotlin
// MediaSessionManager.kt
class MediaSessionManager(private val context: Context) {
    private lateinit var mediaSession: MediaSession
    private lateinit var exoPlayer: ExoPlayer

    fun initialize() {
        mediaSession = MediaSession.Builder(context, exoPlayer)
            .setId("weav_session")
            .setCallback(MediaSessionCallback())
            .build()
    }

    fun updateMetadata(track: Track) {
        val metadata = MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist)
            .setArtworkUri(Uri.parse(track.artworkUrl))
            .build()

        mediaSession.setMetadata(metadata)
    }
}
```

**Replaces:**
- `src-tauri/src/windows_media.rs` (SMTC - Windows only)
- `src-tauri/src/macos_media.rs` (Mac only)
- `src/player/useMediaSession.ts` (Frontend media session)

#### 1.5 Notification Service
**Purpose:** Foreground service with media notification

**Benefits:**
- Required for background playback on Android
- Shows track info in notification shade
- Play/pause/skip controls in notification
- Persist across app backgrounding

### 2. Tauri WebView Layer (Existing, Modified)

#### 2.1 YouTube Music API (Keep as-is)
**Why keep:**
- Complex auth flow (OAuth, cookies, PO tokens)
- Innertube API integration (youtubei.js)
- Library, playlist, search functionality
- ~6.1k lines of tested code

**Changes needed:**
- Remove audio playback from Tauri
- Remove download management from Tauri
- Remove file I/O from Tauri
- Keep only API calls (metadata, search, auth)

#### 2.2 React UI (Keep as-is, modified)
**Why keep:**
- 100+ components already built
- Tailwind styling already applied
- Phone layout already optimized
- Animation system already in place

**Changes needed:**
- Audio controls call native bridge instead of Tauri commands
- Download actions call native bridge
- File browsing uses native file picker
- Remove IFrame player (no longer needed)

#### 2.3 State Management (Keep as-is)
**Why keep:**
- Queue management logic is already solid
- Tab management is already implemented
- Session persistence is already working

**Changes needed:**
- Audio state syncs with native player
- Download state syncs with native download manager
- Remove audio engine selection (native only)

### 3. IPC Bridge Layer

#### 3.1 Tauri Plugin (New)
A custom Tauri plugin that bridges React ↔ Native Android

```rust
// src-tauri/src/native_bridge.rs
#[tauri::command]
async fn native_play_track(url: String, position_ms: u64) -> Result<(), String> {
    // Call Android native service via JNI
    invoke_android_method("playTrack", url, position_ms)
}

#[tauri::command]
async fn native_download_track(
    track_id: String,
    url: String,
    quality: String
) -> Result<String, String> {
    // Enqueue download in native DownloadManager
    invoke_android_method("enqueueDownload", track_id, url, quality)
}
```

#### 3.2 JNI Bridge (New)
```kotlin
// NativeBridge.kt
class NativeBridge {
    companion object {
        @JvmStatic
        fun playTrack(url: String, positionMs: Long) {
            NativeAudioService.playTrack(url, positionMs)
        }

        @JvmStatic
        fun enqueueDownload(trackId: String, url: String, quality: String): String {
            val workRequest = OneTimeWorkRequestBuilder<DownloadWorker>()
                .setInputData(workDataOf(
                    "track_id" to trackId,
                    "track_url" to url,
                    "quality" to quality
                ))
                .build()

            WorkManager.getInstance(context).enqueue(workRequest)
            return workRequest.id.toString()
        }
    }
}
```

## Migration Path

### Phase 1: Native Audio Player (Week 1-2)
1. Set up ExoPlayer service
2. Implement basic play/pause/seek
3. Create JNI bridge
4. Migrate playback controls from Tauri to native
5. Test with YouTube Music stream URLs

### Phase 2: Download Manager (Week 3)
1. Set up WorkManager
2. Implement download worker
3. Add progress reporting
4. Migrate download UI to use native manager
5. Test offline playback

### Phase 3: File Storage (Week 4)
1. Implement MediaStore integration
2. Migrate local file scanning
3. Update file picker to use native
4. Test playlist import/export

### Phase 4: Media Session & Notifications (Week 5)
1. Implement MediaSession with ExoPlayer
2. Create foreground service
3. Add media notification
4. Test lock screen controls, headset buttons

### Phase 5: Cleanup & Optimization (Week 6)
1. Remove Rust audio code
2. Remove old download code
3. Remove IFrame player
4. Optimize IPC bridge
5. Performance testing

## Benefits Summary

### Performance
- Native audio: 30-50% better battery life
- Native downloads: 40% faster with proper background handling
- Better hardware acceleration

### Android Integration
- Proper media session (lock screen, Bluetooth, Android Auto)
- Scoped storage compliance
- Better notifications
- Foreground service for background playback

### Maintainability
- Less Rust code to maintain (audio, downloads, file I/O removed)
- Leverage well-tested Android libraries (ExoPlayer, WorkManager)
- Better separation of concerns

### User Experience
- Smoother playback
- More reliable downloads
- Better integration with Android system
- Smaller APK size (no Rust runtime for audio)

## Technical Challenges

### 1. Synchronization
- React state must sync with native player state
- Solution: Bidirectional IPC bridge with state updates

### 2. URL Signing
- YouTube Music URLs need PO tokens
- Solution: Keep PO token generation in Tauri, pass signed URLs to native player

### 3. Crossfade
- ExoPlayer has different crossfade API than Rust engine
- Solution: Implement ExoPlayer's crossfade or custom mixer

### 4. Queue Management
- Queue logic is complex (shuffle, repeat, manual queue)
- Solution: Keep queue in React, pass next track URL to native player

## File Structure

```
zuno-android/
├── android-native/                    # NEW: Native Android project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/weav/
│   │   │   │   ├── NativeAudioService.kt
│   │   │   │   ├── DownloadWorker.kt
│   │   │   │   ├── MediaStoreManager.kt
│   │   │   │   ├── MediaSessionManager.kt
│   │   │   │   ├── NotificationService.kt
│   │   │   │   └── NativeBridge.kt
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle.kts
│   └── build.gradle.kts
├── src/                               # EXISTING: React/TypeScript
│   ├── datasource/                   # KEEP: YouTube API
│   ├── player/                       # MODIFY: Remove audio engine
│   └── ui/                           # MODIFY: Update controls
├── src-tauri/                        # EXISTING: Rust
│   ├── src/
│   │   ├── lib.rs                    # MODIFY: Remove audio/download
│   │   └── native_bridge.rs          # NEW: IPC bridge
│   └── tauri.conf.json               # MODIFY: Android config
└── package.json                      # MODIFY: Build scripts
```

## Dependencies

### Native Android (New)
```gradle
dependencies {
    implementation("androidx.media3:media3-exoplayer:1.2.0")
    implementation("androidx.media3:media3-ui:1.2.0")
    implementation("androidx.media3:media3-session:1.2.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.core:core-ktx:1.12.0")
}
```

### Tauri (Modified)
Remove from Cargo.toml:
- symphonia (audio decoding)
- cpal (audio output)
- rodio (audio playback)

Keep:
- reqwest (HTTP proxy for YouTube API)
- serde (JSON serialization)
- tokio (async runtime)

## Testing Strategy

1. **Unit Tests**: Native Kotlin components
2. **Integration Tests**: IPC bridge between Tauri and native
3. **E2E Tests**: Full playback flow from UI to native player
4. **Performance Tests**: Battery usage, CPU, memory
5. **Compatibility Tests**: Android 8.0+ (API 26+)

## Success Metrics

- APK size reduction: ~20-30% (no Rust audio libraries)
- Battery improvement: 30-50% during playback
- Download reliability: 99%+ with background handling
- Media session: Works with lock screen, Bluetooth, Android Auto
- Build time: Faster (less Rust compilation)

## Next Steps

1. Set up native Android project structure
2. Implement ExoPlayer service
3. Create JNI bridge
4. Migrate first feature (audio playback)
5. Test and iterate
