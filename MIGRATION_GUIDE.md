# Migration Guide: Integrating Native Android Components

This guide walks through the steps to integrate the native Android components with the existing Tauri-based WEAV application.

## Overview

The migration follows a phased approach:
1. Phase 1: Set up the native Android project (✅ Completed)
2. Phase 2: Implement JNI bridge between Tauri and Android (⚠️ In Progress)
3. Phase 3: Migrate audio playback to native
4. Phase 4: Migrate downloads to native
5. Phase 5: Migrate file storage to native
6. Phase 6: Cleanup and optimization

## Phase 1: Native Android Project Setup ✅

**Status:** Completed

The native Android project has been created in `android-native/` with:
- ExoPlayer-based audio service
- WorkManager download worker
- MediaStore file manager
- JNI bridge interface

## Phase 2: JNI Bridge Implementation ⚠️

**Status:** Partially complete

### What's Done:
- Rust IPC commands in `src-tauri/src/native_bridge.rs`
- Kotlin bridge methods in `android-native/app/src/main/java/com/weav/NativeBridge.kt`

### What's Needed:
- Implement actual JNI calls from Rust to Kotlin
- Set up Tauri event system for callbacks from Android

### Steps:

#### 2.1 Implement JNI Calls

Update `src-tauri/src/native_bridge.rs` to use JNI:

```rust
#[cfg(target_os = "android")]
use jni::{JNIEnv, objects::{JObject, JString, JValue}, sys::jlong};

#[cfg(target_os = "android")]
#[command]
pub async fn native_play_track(url: String, position_ms: u64) -> Result<(), String> {
    // Get JNI environment
    let jni_env = unsafe { get_jni_env() };

    // Convert Rust strings to Java strings
    let j_url = jni_env.new_string(url)?;
    let j_position = position_ms as jlong;

    // Call NativeBridge.playTrack
    let class = jni_env.find_class("com/weav/NativeBridge")?;
    let method = jni_env.get_static_method_id(
        class,
        "playTrack",
        "(Ljava/lang/String;J)V"
    )?;

    jni_env.call_static_void_method(
        class,
        method,
        &[JValue::Object(&j_url), JValue::Long(j_position)]
    )?;

    Ok(())
}
```

#### 2.2 Add JNI Dependency

Add to `src-tauri/Cargo.toml`:

```toml
[target.'cfg(target_os = "android")'.dependencies]
jni = "0.21"
ndk = "0.7"
ndk-context = "0.1"
```

#### 2.3 Set Up Tauri Events

Create event emitters in Rust to forward Android callbacks to React:

```rust
// In lib.rs, add event listeners
#[cfg(target_os = "android")]
fn setup_android_events(app: &tauri::AppHandle) {
    // These will be called from Android via JNI
    // and forwarded to the frontend via Tauri events
}
```

#### 2.4 Update Tauri Config

Update `src-tauri/tauri.conf.json` to reference the native Android project:

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

## Phase 3: Migrate Audio Playback

### 3.1 Update React Audio Engine

Modify `src/player/AudioEngine.ts` to use native commands:

```typescript
// Replace Rust audio calls with native bridge calls
async playTrack(url: string, positionMs: number = 0) {
  if (isAndroid()) {
    await invoke('native_play_track', { url, positionMs });
  } else {
    // Keep existing Rust implementation for desktop
    await invoke('native_audio_load', { url });
    await invoke('native_audio_play', { positionMs });
  }
}
```

### 3.2 Update Playback Controls

Modify `src/player/PlaybackControls.tsx`:

```typescript
const handlePlayPause = async () => {
  if (isAndroid()) {
    if (isPlaying) {
      await invoke('native_pause');
    } else {
      await invoke('native_play');
    }
  } else {
    // Keep existing implementation
  }
};
```

### 3.3 Remove IFrame Player

Remove or disable the IFrame player in `src/player/AudioEngine.ts` as it's no longer needed on Android.

### 3.4 Test Audio Playback

1. Build the app with native integration
2. Play a track
3. Verify:
   - Audio plays smoothly
   - Position updates correctly
   - Play/pause works
   - Seek works
   - Volume changes work

## Phase 4: Migrate Downloads

### 4.1 Update Download Queue

Modify `src/player/offlineStore.ts`:

```typescript
async downloadTrack(track: Track, quality: AudioQuality) {
  if (isAndroid()) {
    const workId = await invoke('native_enqueue_download', {
      trackId: track.id,
      url: await this.getStreamUrl(track),
      quality
    });

    // Monitor progress
    this.monitorDownloadProgress(workId, track);
  } else {
    // Keep existing Rust implementation
    await invoke('offline_audio_save', { ... });
  }
}
```

### 4.2 Implement Progress Monitoring

```typescript
private async monitorDownloadProgress(workId: string, track: Track) {
  const interval = setInterval(async () => {
    const progress = await invoke('native_get_download_progress', { workId });

    this.updateDownloadStatus(track.id, {
      status: 'downloading',
      progress
    });

    if (progress >= 100) {
      clearInterval(interval);
      this.updateDownloadStatus(track.id, {
        status: 'ready',
        progress: 100
      });
    }
  }, 1000);
}
```

### 4.3 Test Downloads

1. Download a track
2. Verify:
   - Download starts
   - Progress updates
   - File saves correctly
   - Appears in MediaStore
   - Can play offline

## Phase 5: Migrate File Storage

### 5.1 Update Local File Scanning

Modify the local audio scan commands in Rust to use MediaStore on Android:

```rust
#[cfg(target_os = "android")]
#[command]
pub async fn local_audio_scan(path: String) -> Result<Vec<LocalTrack>, String> {
    // Use MediaStore instead of manual file scanning
    let tracks = invoke_android_method("scanFiles", path)?;
    Ok(tracks)
}
```

### 5.2 Update File Picker

Use Android's native file picker:

```typescript
async selectLocalFolder() {
  if (isAndroid()) {
    // Use Android's native file picker
    const path = await invoke('android_select_folder');
    return path;
  } else {
    // Keep existing implementation
  }
}
```

### 5.3 Test File Storage

1. Add a local music folder
2. Verify:
   - Files are scanned
   - Tags are read correctly
   - Artwork loads
   - Can play local files

## Phase 6: Cleanup and Optimization

### 6.1 Remove Unused Rust Code

Remove from `src-tauri/src/lib.rs`:
- `native_audio_*` commands (replaced by native bridge)
- `offline_audio_*` commands (replaced by native downloads)
- Audio-related code that's now handled by ExoPlayer

Remove from `src-tauri/Cargo.toml`:
- symphonia dependencies
- cpal dependencies
- rodio dependencies

### 6.2 Optimize APK Size

1. Enable ProGuard/R8 (already configured)
2. Enable app bundles for distribution
3. Remove unused resources

### 6.3 Performance Testing

Measure and compare:
- APK size
- Memory usage
- Battery consumption during playback
- Download speed
- Startup time

### 6.4 Documentation

Update documentation:
- `README.md` - mention native Android components
- `docs/architecture.md` - update architecture diagram
- `docs/backend.md` - document new native bridge

## Testing Checklist

### Audio Playback
- [ ] Play track from start
- [ ] Pause and resume
- [ ] Seek to different positions
- [ ] Skip to next/previous
- [ ] Volume changes
- [ ] Playback rate changes
- [ ] Background playback
- [ ] Lock screen controls
- [ ] Bluetooth media buttons
- [ ] Crossfade (if implemented)

### Downloads
- [ ] Download single track
- [ ] Download entire album
- [ ] Cancel download
- [ ] Download with poor network
- [ ] Download on mobile data
- [ ] Progress updates
- [ ] Resume after app restart
- [ ] Play downloaded track offline

### File Storage
- [ ] Scan local folder
- [ ] Read tags
- [ ] Display artwork
- [ ] Play local file
- [ ] Add to playlist
- [ ] Delete local file

### Integration
- [ ] Tauri events fire correctly
- [ ] JNI calls work
- [ ] No memory leaks
- [ ] Clean shutdown
- [ ] Error handling

## Troubleshooting

### JNI Errors

**Problem:** JNI calls fail with "class not found"

**Solution:**
- Ensure the native Android project is built
- Check that the class path is correct (`com/weav/NativeBridge`)
- Verify the Gradle build succeeds

### Audio Not Playing

**Problem:** Audio doesn't play after calling native_play_track

**Solution:**
- Check that the audio service is running
- Verify the URL is accessible
- Check Android logcat for errors
- Ensure permissions are granted (INTERNET, WAKE_LOCK)

### Downloads Fail

**Problem:** Downloads don't start or fail

**Solution:**
- Check storage permissions
- Verify WorkManager is initialized
- Check network connectivity
- Review logcat for WorkManager errors

### App Crashes

**Problem:** App crashes when calling native methods

**Solution:**
- Check for null pointer exceptions in Kotlin
- Verify all JNI calls are on the correct thread
- Review crash logs in logcat
- Ensure proper error handling in both Rust and Kotlin

## Next Steps

1. Complete JNI implementation
2. Test audio playback end-to-end
3. Migrate downloads
4. Migrate file storage
5. Cleanup old code
6. Performance optimization
7. Release testing

## Resources

- [Tauri Android Documentation](https://tauri.app/v2/guides/building/android)
- [ExoPlayer Documentation](https://developer.android.com/guide/topics/media/exoplayer)
- [WorkManager Documentation](https://developer.android.com/topic/libraries/architecture/workmanager)
- [JNI Guide](https://developer.android.com/training/articles/perf-jni)
