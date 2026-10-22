// Native bridge for calling Android native components from Tauri
// This module provides IPC commands that delegate to native Android services via JNI

#[cfg(target_os = "android")]
use jni::{objects::{JString, JValue}, sys::{jlong, jfloat}};
#[cfg(target_os = "android")]
use ndk_context::android_context;
#[cfg(target_os = "android")]
use crate::APP_HANDLE;
#[cfg(target_os = "android")]
use std::sync::Mutex;

use tauri::{command, Emitter};

// Event names for Android callbacks
pub const EVENT_PLAYBACK_STATE_CHANGED: &str = "native-playback-state-changed";
pub const EVENT_POSITION_CHANGED: &str = "native-position-changed";
pub const EVENT_TRACK_ENDED: &str = "native-track-ended";
pub const EVENT_DOWNLOAD_PROGRESS: &str = "native-download-progress";

/// Play a track using the native Android ExoPlayer
#[cfg(target_os = "android")]
#[command]
pub async fn native_play_track(url: String, position_ms: u64) -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_url = env.new_string(url.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;
    let j_position = position_ms as jlong;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(
        class,
        "playTrack",
        "(Ljava/lang/String;J)V"
    ).map_err(|e| format!("Failed to find playTrack method: {}", e))?;

    env.call_static_void_method(
        class,
        method,
        &[JValue::Object(&j_url), JValue::Long(j_position)]
    ).map_err(|e| format!("Failed to call playTrack: {}", e))?;

    log::info!("native_play_track called: {} at {}ms", url, position_ms);
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_play_track(url: String, position_ms: u64) -> Result<(), String> {
    log::info!("native_play_track called (desktop stub): {} at {}ms", url, position_ms);
    Ok(())
}

/// Resume playback
#[cfg(target_os = "android")]
#[command]
pub async fn native_play() -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "play", "()V")
        .map_err(|e| format!("Failed to find play method: {}", e))?;

    env.call_static_void_method(class, method, &[])
        .map_err(|e| format!("Failed to call play: {}", e))?;

    log::info!("native_play called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_play() -> Result<(), String> {
    log::info!("native_play called (desktop stub)");
    Ok(())
}

/// Pause playback
#[cfg(target_os = "android")]
#[command]
pub async fn native_pause() -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "pause", "()V")
        .map_err(|e| format!("Failed to find pause method: {}", e))?;

    env.call_static_void_method(class, method, &[])
        .map_err(|e| format!("Failed to call pause: {}", e))?;

    log::info!("native_pause called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_pause() -> Result<(), String> {
    log::info!("native_pause called (desktop stub)");
    Ok(())
}

/// Seek to a specific position
#[cfg(target_os = "android")]
#[command]
pub async fn native_seek_to(position_ms: u64) -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_position = position_ms as jlong;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "seekTo", "(J)V")
        .map_err(|e| format!("Failed to find seekTo method: {}", e))?;

    env.call_static_void_method(class, method, &[JValue::Long(j_position)])
        .map_err(|e| format!("Failed to call seekTo: {}", e))?;

    log::info!("native_seek_to called: {}ms", position_ms);
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_seek_to(position_ms: u64) -> Result<(), String> {
    log::info!("native_seek_to called (desktop stub): {}ms", position_ms);
    Ok(())
}

/// Set volume
#[cfg(target_os = "android")]
#[command]
pub async fn native_set_volume(volume: f64) -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_volume = volume as jfloat;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "setVolume", "(F)V")
        .map_err(|e| format!("Failed to find setVolume method: {}", e))?;

    env.call_static_void_method(class, method, &[JValue::Float(j_volume)])
        .map_err(|e| format!("Failed to call setVolume: {}", e))?;

    log::info!("native_set_volume called: {}", volume);
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_set_volume(volume: f64) -> Result<(), String> {
    log::info!("native_set_volume called (desktop stub): {}", volume);
    Ok(())
}

/// Set playback rate
#[cfg(target_os = "android")]
#[command]
pub async fn native_set_playback_rate(rate: f64) -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_rate = rate as jfloat;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "setPlaybackRate", "(F)V")
        .map_err(|e| format!("Failed to find setPlaybackRate method: {}", e))?;

    env.call_static_void_method(class, method, &[JValue::Float(j_rate)])
        .map_err(|e| format!("Failed to call setPlaybackRate: {}", e))?;

    log::info!("native_set_playback_rate called: {}", rate);
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_set_playback_rate(rate: f64) -> Result<(), String> {
    log::info!("native_set_playback_rate called (desktop stub): {}", rate);
    Ok(())
}

/// Get current playback position
#[cfg(target_os = "android")]
#[command]
pub async fn native_get_current_position() -> Result<u64, String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "getCurrentPosition", "()J")
        .map_err(|e| format!("Failed to find getCurrentPosition method: {}", e))?;

    let result = env.call_static_long_method(class, method, &[])
        .map_err(|e| format!("Failed to call getCurrentPosition: {}", e))?;

    Ok(result as u64)
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_get_current_position() -> Result<u64, String> {
    Ok(0)
}

/// Get total duration
#[cfg(target_os = "android")]
#[command]
pub async fn native_get_duration() -> Result<u64, String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "getDuration", "()J")
        .map_err(|e| format!("Failed to find getDuration method: {}", e))?;

    let result = env.call_static_long_method(class, method, &[])
        .map_err(|e| format!("Failed to call getDuration: {}", e))?;

    Ok(result as u64)
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_get_duration() -> Result<u64, String> {
    Ok(0)
}

/// Check if currently playing
#[cfg(target_os = "android")]
#[command]
pub async fn native_is_playing() -> Result<bool, String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "isPlaying", "()Z")
        .map_err(|e| format!("Failed to find isPlaying method: {}", e))?;

    let result = env.call_static_boolean_method(class, method, &[])
        .map_err(|e| format!("Failed to call isPlaying: {}", e))?;

    Ok(result)
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_is_playing() -> Result<bool, String> {
    Ok(false)
}

/// Skip to next track
#[cfg(target_os = "android")]
#[command]
pub async fn native_skip_to_next() -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "skipToNext", "()V")
        .map_err(|e| format!("Failed to find skipToNext method: {}", e))?;

    env.call_static_void_method(class, method, &[])
        .map_err(|e| format!("Failed to call skipToNext: {}", e))?;

    log::info!("native_skip_to_next called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_skip_to_next() -> Result<(), String> {
    log::info!("native_skip_to_next called (desktop stub)");
    Ok(())
}

/// Skip to previous track
#[cfg(target_os = "android")]
#[command]
pub async fn native_skip_to_previous() -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "skipToPrevious", "()V")
        .map_err(|e| format!("Failed to find skipToPrevious method: {}", e))?;

    env.call_static_void_method(class, method, &[])
        .map_err(|e| format!("Failed to call skipToPrevious: {}", e))?;

    log::info!("native_skip_to_previous called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_skip_to_previous() -> Result<(), String> {
    log::info!("native_skip_to_previous called (desktop stub)");
    Ok(())
}

/// Stop playback
#[cfg(target_os = "android")]
#[command]
pub async fn native_stop() -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "stop", "()V")
        .map_err(|e| format!("Failed to find stop method: {}", e))?;

    env.call_static_void_method(class, method, &[])
        .map_err(|e| format!("Failed to call stop: {}", e))?;

    log::info!("native_stop called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_stop() -> Result<(), String> {
    log::info!("native_stop called (desktop stub)");
    Ok(())
}

/// Enqueue a track for download
#[cfg(target_os = "android")]
#[command]
pub async fn native_enqueue_download(
    track_id: String,
    url: String,
    quality: String,
) -> Result<String, String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_track_id = env.new_string(track_id.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;
    let j_url = env.new_string(url.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;
    let j_quality = env.new_string(quality.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(
        class,
        "enqueueDownload",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;"
    ).map_err(|e| format!("Failed to find enqueueDownload method: {}", e))?;

    let result = env.call_static_object_method(
        class,
        method,
        &[
            JValue::Object(&j_track_id),
            JValue::Object(&j_url),
            JValue::Object(&j_quality)
        ]
    ).map_err(|e| format!("Failed to call enqueueDownload: {}", e))?;

    let j_result: JString = unsafe { JString::from_raw(result.cast()) };
    let work_id = env.get_string(&j_result)
        .map_err(|e| format!("Failed to get string result: {}", e))?
        .into();

    log::info!(
        "native_enqueue_download called: {} from {} (quality: {})",
        track_id,
        url,
        quality
    );
    Ok(work_id)
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_enqueue_download(
    track_id: String,
    url: String,
    quality: String,
) -> Result<String, String> {
    log::info!(
        "native_enqueue_download called (desktop stub): {} from {} (quality: {})",
        track_id,
        url,
        quality
    );
    Ok("work_id_placeholder".to_string())
}

/// Cancel a download
#[cfg(target_os = "android")]
#[command]
pub async fn native_cancel_download(work_id: String) -> Result<(), String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_work_id = env.new_string(work_id.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "cancelDownload", "(Ljava/lang/String;)V")
        .map_err(|e| format!("Failed to find cancelDownload method: {}", e))?;

    env.call_static_void_method(class, method, &[JValue::Object(&j_work_id)])
        .map_err(|e| format!("Failed to call cancelDownload: {}", e))?;

    log::info!("native_cancel_download called: {}", work_id);
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_cancel_download(work_id: String) -> Result<(), String> {
    log::info!("native_cancel_download called (desktop stub): {}", work_id);
    Ok(())
}

/// Get download progress
#[cfg(target_os = "android")]
#[command]
pub async fn native_get_download_progress(work_id: String) -> Result<u32, String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_work_id = env.new_string(work_id.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "getDownloadProgress", "(Ljava/lang/String;)I")
        .map_err(|e| format!("Failed to find getDownloadProgress method: {}", e))?;

    let result = env.call_static_int_method(class, method, &[JValue::Object(&j_work_id)])
        .map_err(|e| format!("Failed to call getDownloadProgress: {}", e))?;

    log::info!("native_get_download_progress called: {}", work_id);
    Ok(result as u32)
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_get_download_progress(work_id: String) -> Result<u32, String> {
    log::info!("native_get_download_progress called (desktop stub): {}", work_id);
    Ok(0)
}

/// Save a track to MediaStore
#[cfg(target_os = "android")]
#[command]
pub async fn native_save_track_to_media_store(
    title: String,
    artist: String,
    album: String,
    duration_ms: u64,
    file_path: String,
) -> Result<String, String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_title = env.new_string(title.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;
    let j_artist = env.new_string(artist.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;
    let j_album = env.new_string(album.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;
    let j_duration = duration_ms as jlong;
    let j_file_path = env.new_string(file_path.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(
        class,
        "saveTrackToMediaStore",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;JLjava/lang/String;)Ljava/lang/String;"
    ).map_err(|e| format!("Failed to find saveTrackToMediaStore method: {}", e))?;

    let result = env.call_static_object_method(
        class,
        method,
        &[
            JValue::Object(&j_title),
            JValue::Object(&j_artist),
            JValue::Object(&j_album),
            JValue::Long(j_duration),
            JValue::Object(&j_file_path)
        ]
    ).map_err(|e| format!("Failed to call saveTrackToMediaStore: {}", e))?;

    let j_result: JString = unsafe { JString::from_raw(result.cast()) };
    let uri = env.get_string(&j_result)
        .map_err(|e| format!("Failed to get string result: {}", e))?
        .into();

    log::info!(
        "native_save_track_to_media_store called: {} by {} (album: {}, duration: {}ms, path: {})",
        title,
        artist,
        album,
        duration_ms,
        file_path
    );
    Ok(uri)
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_save_track_to_media_store(
    title: String,
    artist: String,
    album: String,
    duration_ms: u64,
    file_path: String,
) -> Result<String, String> {
    log::info!(
        "native_save_track_to_media_store called (desktop stub): {} by {} (album: {}, duration: {}ms, path: {})",
        title,
        artist,
        album,
        duration_ms,
        file_path
    );
    Ok("content_uri_placeholder".to_string())
}

/// Scan a local file
#[cfg(target_os = "android")]
#[command]
pub async fn native_scan_file(file_path: String) -> Result<String, String> {
    let ctx = android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) };
    let mut env = vm.attach_current_thread()
        .map_err(|e| format!("Failed to attach JNI thread: {}", e))?;

    let j_file_path = env.new_string(file_path.clone())
        .map_err(|e| format!("Failed to create Java string: {}", e))?;

    let class = env.find_class("com/weav/NativeBridge")
        .map_err(|e| format!("Failed to find NativeBridge class: {}", e))?;

    let method = env.get_static_method_id(class, "scanFile", "(Ljava/lang/String;)Ljava/lang/String;")
        .map_err(|e| format!("Failed to find scanFile method: {}", e))?;

    let result = env.call_static_object_method(class, method, &[JValue::Object(&j_file_path)])
        .map_err(|e| format!("Failed to call scanFile: {}", e))?;

    let j_result: JString = unsafe { JString::from_raw(result.cast()) };
    let uri = env.get_string(&j_result)
        .map_err(|e| format!("Failed to get string result: {}", e))?
        .into();

    log::info!("native_scan_file called: {}", file_path);
    Ok(uri)
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn native_scan_file(file_path: String) -> Result<String, String> {
    log::info!("native_scan_file called (desktop stub): {}", file_path);
    Ok("content_uri_placeholder".to_string())
}

/// Register callback for playback state changes
/// This will be called from Android when the playback state changes
#[cfg(target_os = "android")]
#[command]
pub async fn register_playback_state_callback(app: tauri::AppHandle) -> Result<(), String> {
    // Store the app handle for JNI callbacks
    let app_handle = app.handle().clone();
    APP_HANDLE.set(Mutex::new(Some(app_handle))).expect("Failed to set app handle");
    log::info!("register_playback_state_callback called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn register_playback_state_callback(_app: tauri::AppHandle) -> Result<(), String> {
    log::info!("register_playback_state_callback called (desktop stub)");
    Ok(())
}

/// Register callback for position updates
#[cfg(target_os = "android")]
#[command]
pub async fn register_position_callback(app: tauri::AppHandle) -> Result<(), String> {
    let app_handle = app.handle().clone();
    APP_HANDLE.set(Mutex::new(Some(app_handle))).expect("Failed to set app handle");
    log::info!("register_position_callback called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn register_position_callback(_app: tauri::AppHandle) -> Result<(), String> {
    log::info!("register_position_callback called (desktop stub)");
    Ok(())
}

/// Register callback for track end
#[cfg(target_os = "android")]
#[command]
pub async fn register_track_ended_callback(app: tauri::AppHandle) -> Result<(), String> {
    let app_handle = app.handle().clone();
    APP_HANDLE.set(Mutex::new(Some(app_handle))).expect("Failed to set app handle");
    log::info!("register_track_ended_callback called");
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[command]
pub async fn register_track_ended_callback(_app: tauri::AppHandle) -> Result<(), String> {
    log::info!("register_track_ended_callback called (desktop stub)");
    Ok(())
}

/// Called from Android via JNI to emit playback state change event
#[cfg(target_os = "android")]
#[no_mangle]
pub extern "C" fn emit_playback_state_changed(is_playing: bool) {
    log::info!("emit_playback_state_changed: {}", is_playing);

    if let Some(handle_mutex) = APP_HANDLE.get() {
        if let Ok(handle_guard) = handle_mutex.lock() {
            if let Some(app) = handle_guard.as_ref() {
                let _ = app.emit(EVENT_PLAYBACK_STATE_CHANGED, is_playing);
            }
        }
    }
}

/// Called from Android via JNI to emit position change event
#[cfg(target_os = "android")]
#[no_mangle]
pub extern "C" fn emit_position_changed(position_ms: u64) {
    log::info!("emit_position_changed: {}ms", position_ms);

    if let Some(handle_mutex) = APP_HANDLE.get() {
        if let Ok(handle_guard) = handle_mutex.lock() {
            if let Some(app) = handle_guard.as_ref() {
                let _ = app.emit(EVENT_POSITION_CHANGED, position_ms);
            }
        }
    }
}

/// Called from Android via JNI to emit track ended event
#[cfg(target_os = "android")]
#[no_mangle]
pub extern "C" fn emit_track_ended() {
    log::info!("emit_track_ended");

    if let Some(handle_mutex) = APP_HANDLE.get() {
        if let Ok(handle_guard) = handle_mutex.lock() {
            if let Some(app) = handle_guard.as_ref() {
                let _ = app.emit(EVENT_TRACK_ENDED, ());
            }
        }
    }
}

/// Called from Android via JNI to emit download progress event
#[cfg(target_os = "android")]
#[no_mangle]
pub extern "C" fn emit_download_progress(progress: u32) {
    log::info!("emit_download_progress: {}%", progress);

    if let Some(handle_mutex) = APP_HANDLE.get() {
        if let Ok(handle_guard) = handle_mutex.lock() {
            if let Some(app) = handle_guard.as_ref() {
                let _ = app.emit(EVENT_DOWNLOAD_PROGRESS, progress);
            }
        }
    }
}
