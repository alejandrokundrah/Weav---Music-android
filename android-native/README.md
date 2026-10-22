# WEAV Native Android Components

This directory contains the native Android components that integrate with the Tauri-based WEAV application.

## Project Structure

```
android-native/
├── app/
│   ├── src/main/
│   │   ├── java/com/weav/
│   │   │   ├── MainActivity.kt              # Main activity (Tauri WebView wrapper)
│   │   │   ├── NativeAudioService.kt      # ExoPlayer-based audio service
│   │   │   ├── NativeBridge.kt             # JNI bridge for Tauri IPC
│   │   │   ├── DownloadWorker.kt          # WorkManager download worker
│   │   │   └── MediaStoreManager.kt        # MediaStore integration
│   │   ├── res/
│   │   │   ├── values/
│   │   │   │   ├── strings.xml             # String resources
│   │   │   │   └── themes.xml              # App theme
│   │   │   └── drawable/                   # Drawables (to be added)
│   │   └── AndroidManifest.xml             # Android manifest
│   ├── build.gradle.kts                    # App-level Gradle config
│   └── proguard-rules.pro                  # ProGuard rules
├── build.gradle.kts                        # Project-level Gradle config
└── settings.gradle.kts                     # Gradle settings
```

## Components

### 1. NativeAudioService
A foreground service that uses ExoPlayer for audio playback. It provides:
- Native audio decoding and playback
- Media session integration (lock screen controls, Bluetooth, Android Auto)
- Background playback with notification
- Gapless playback and crossfade support
- Hardware-accelerated decoding

**Key Methods:**
- `playTrack(url, positionMs)` - Play a track from a URL
- `play()` / `pause()` - Playback control
- `seekTo(positionMs)` - Seek to position
- `setVolume(volume)` - Set volume (0.0-1.0)
- `setPlaybackRate(rate)` - Set playback speed (0.5-2.0)
- `getCurrentPosition()` - Get current position
- `getDuration()` - Get total duration

### 2. NativeBridge
Static methods that can be called from Tauri via JNI to interact with native components.

**Audio Methods:**
- `playTrack(url, positionMs)` - Play a track
- `play()` / `pause()` - Playback control
- `seekTo(positionMs)` - Seek
- `setVolume(volume)` - Set volume
- `setPlaybackRate(rate)` - Set speed
- `getCurrentPosition()` - Get position
- `getDuration()` - Get duration
- `isPlaying()` - Check if playing
- `skipToNext()` / `skipToPrevious()` - Skip tracks
- `stop()` - Stop playback

**Download Methods:**
- `enqueueDownload(trackId, url, quality)` - Start a download
- `cancelDownload(workId)` - Cancel a download
- `getDownloadProgress(workId)` - Get download progress

**File Storage Methods:**
- `saveTrackToMediaStore(title, artist, album, durationMs, filePath)` - Save to MediaStore
- `scanFile(filePath)` - Scan a local file

**Callback Registration:**
- `setPlaybackStateChangedListener(callback)` - Listen for play/pause changes
- `setPositionChangedListener(callback)` - Listen for position updates
- `setTrackEndedListener(callback)` - Listen for track end

### 3. DownloadWorker
A WorkManager worker that handles downloads in the background. Features:
- Background execution even when app is killed
- Network-aware (waits for connectivity)
- Progress reporting
- Automatic retry on failure
- MediaStore integration after download

### 4. MediaStoreManager
Handles integration with Android's MediaStore API. Features:
- Save tracks to system media database
- Scan local files
- Delete tracks from MediaStore
- Query tracks from MediaStore

## Building

### Prerequisites
- Android Studio or Android SDK
- JDK 17
- Android SDK API 35

### Build from command line
```bash
cd android-native
./gradlew assembleDebug    # Debug build
./gradlew assembleRelease  # Release build
```

### Build from Android Studio
1. Open the `android-native` directory in Android Studio
2. Wait for Gradle sync to complete
3. Click Build > Build Bundle(s) / APK(s) > Build APK(s)

## Integration with Tauri

### Tauri Configuration
Update `src-tauri/tauri.conf.json` to include the native Android project:

```json
{
  "bundle": {
    "android": {
      "minSdkVersion": 26,
      "project": "../android-native"
    }
  }
}
```

### Rust IPC Bridge
Add commands in `src-tauri/src/native_bridge.rs`:

```rust
#[tauri::command]
async fn native_play_track(url: String, position_ms: u64) -> Result<(), String> {
    // Call JNI bridge
    invoke_android_method("playTrack", url, position_ms)
}
```

### React Integration
Call the native bridge from React:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Play a track
await invoke('native_play_track', {
  url: 'https://...',
  positionMs: 0
});

// Get current position
const position = await invoke('native_get_current_position');
```

## Next Steps

1. **Tauri Integration**: Add Tauri plugin for JNI bridge
2. **Service Binding**: Implement proper ServiceConnection for audio service
3. **Icons**: Add app icons to mipmap directories
4. **Permissions**: Handle runtime permissions (storage, notifications)
5. **Testing**: Add unit and integration tests
6. **Crossfade**: Implement ExoPlayer crossfade
7. **Queue Integration**: Connect native player to React queue state

## Dependencies

- androidx.media3:media3-exoplayer:1.2.0
- androidx.media3:media3-ui:1.2.0
- androidx.media3:media3-session:1.2.0
- androidx.work:work-runtime-ktx:2.9.0
- androidx.core:core-ktx:1.12.0
- androidx.lifecycle:lifecycle-runtime-ktx:2.7.0
- androidx.lifecycle:lifecycle-service:2.7.0
- kotlinx-coroutines-android:1.7.3

## License

Same as the main WEAV project (Apache License 2.0)
