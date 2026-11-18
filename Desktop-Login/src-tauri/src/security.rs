use tauri::WebviewWindow;

/// Best-effort memory locking to prevent sensitive plaintext secrets from being paged to disk.
#[cfg(windows)]
pub fn lock_secret_slice(bytes: &[u8]) {
    if bytes.is_empty() {
        return;
    }
    unsafe {
        let _ = windows_sys::Win32::System::Memory::VirtualLock(
            bytes.as_ptr() as *const core::ffi::c_void,
            bytes.len(),
        );
    }
}

#[cfg(windows)]
pub fn unlock_secret_slice(bytes: &[u8]) {
    if bytes.is_empty() {
        return;
    }
    unsafe {
        let _ = windows_sys::Win32::System::Memory::VirtualUnlock(
            bytes.as_ptr() as *const core::ffi::c_void,
            bytes.len(),
        );
    }
}

#[cfg(not(windows))]
pub fn lock_secret_slice(_bytes: &[u8]) {}

#[cfg(not(windows))]
pub fn unlock_secret_slice(_bytes: &[u8]) {}

/// Enables or disables OS-level screen capture exclusion (WDA_EXCLUDEFROMCAPTURE) on Windows 10 2004+.
#[cfg(windows)]
pub fn apply_window_capture_protection(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
    };

    let hwnd_raw = window
        .hwnd()
        .map_err(|e| format!("Failed to read window HWND: {e}"))?;
    let hwnd = (hwnd_raw.0 as usize) as HWND;
    let affinity = if enabled {
        WDA_EXCLUDEFROMCAPTURE
    } else {
        WDA_NONE
    };
    let ok = unsafe { SetWindowDisplayAffinity(hwnd, affinity) };
    if ok == 0 {
        return Err("SetWindowDisplayAffinity returned 0".to_string());
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn apply_window_capture_protection(_window: &WebviewWindow, _enabled: bool) -> Result<(), String> {
    Ok(())
}
