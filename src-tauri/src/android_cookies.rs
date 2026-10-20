//! Reads the Android WebView's cookie jar for the sign-in poller.
//!
//! Why this exists instead of `WebviewWindow::cookies` / `cookies_for_url`:
//!
//! * `cookies()` is a stub on Android: wry returns an empty list unconditionally. The poller
//!   therefore never saw the Google session, never finished, and left the user stranded on a
//!   full YouTube Music page inside the app until the five-minute timeout.
//! * `cookies_for_url()` does ask Android's `CookieManager`, but through a Kotlin helper that is
//!   declared to return a non-null `String`. `CookieManager.getCookie` returns `null` whenever
//!   the URL has no cookies yet — which is exactly the state at the start of every sign-in — so
//!   the helper throws, the Java exception is left pending on the main thread, and the app dies
//!   ("crashes during navigation").
//!
//! This talks to `CookieManager` directly, treats `null` as "no cookies", and always clears any
//! pending Java exception before returning control to the main thread.

use std::sync::mpsc;
use std::time::Duration;

use jni::objects::{JString, JValue};
use jni::JNIEnv;

/// Generous: the request is served by the Android main thread, which is also busy rendering
/// the page it is being asked about.
const COOKIE_READ_TIMEOUT: Duration = Duration::from_secs(10);

/// The `Cookie:` header value Android would send to `url` — every cookie for that address,
/// HttpOnly ones included — or `None` when the WebView holds no cookies for it.
pub fn cookie_header_for_url(
    window: &tauri::WebviewWindow,
    url: &str,
) -> Result<Option<String>, String> {
    let (tx, rx) = mpsc::channel();
    let url = url.to_string();

    window
        .with_webview(move |webview| {
            webview.jni_handle().exec(move |env, _activity, _webview| {
                // A closed receiver just means the caller gave up waiting.
                let _ = tx.send(read_cookie_header(env, &url));
            });
        })
        .map_err(|error| format!("unable to reach the Android webview: {error}"))?;

    // If the webview is gone the closure is dropped unrun, which disconnects the channel and
    // surfaces here immediately rather than after the timeout.
    rx.recv_timeout(COOKIE_READ_TIMEOUT)
        .map_err(|error| format!("Android cookie read did not complete: {error}"))?
}

fn read_cookie_header(env: &mut JNIEnv, url: &str) -> Result<Option<String>, String> {
    let result = (|| -> jni::errors::Result<Option<String>> {
        let manager = env
            .call_static_method(
                "android/webkit/CookieManager",
                "getInstance",
                "()Landroid/webkit/CookieManager;",
                &[],
            )?
            .l()?;
        let url = env.new_string(url)?;
        let cookie = env
            .call_method(
                &manager,
                "getCookie",
                "(Ljava/lang/String;)Ljava/lang/String;",
                &[JValue::Object(&url)],
            )?
            .l()?;

        // `null` is the ordinary "nothing stored for this URL yet" answer, not an error.
        if cookie.is_null() {
            return Ok(None);
        }
        let cookie = JString::from(cookie);
        let text = env.get_string(&cookie)?;
        Ok(Some(text.to_string_lossy().to_string()))
    })();

    // A pending Java exception surfaces as an uncaught crash the moment this native frame
    // returns to the main thread, whatever Rust did with the `Err`.
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_clear();
    }

    result.map_err(|error| error.to_string())
}
