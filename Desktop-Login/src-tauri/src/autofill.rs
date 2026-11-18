use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryStatusEvent {
    pub stage: String,
    pub detail: String,
}

#[cfg(windows)]
mod win_impl {
    use super::DeliveryStatusEvent;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::thread;
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, Emitter};
    use windows_sys::Win32::Foundation::{GlobalFree, HWND};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardSequenceNumber, OpenClipboard,
        RegisterClipboardFormatW, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
    };
    use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        KEYEVENTF_UNICODE, VK_CONTROL, VK_RETURN, VK_TAB, VK_V,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, IsIconic, SetForegroundWindow, ShowWindow,
        SW_RESTORE,
    };

    const CF_UNICODETEXT: u32 = 13;

    fn to_wide_null(s: &str) -> Vec<u16> {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn set_clipboard_dword_flag(format_name: &str, value: u32) {
        let wide_name = to_wide_null(format_name);
        let fmt = unsafe { RegisterClipboardFormatW(wide_name.as_ptr()) };
        if fmt == 0 {
            return;
        }
        let hmem = unsafe { GlobalAlloc(GMEM_MOVEABLE, std::mem::size_of::<u32>()) };
        if hmem.is_null() {
            return;
        }
        let ptr = unsafe { GlobalLock(hmem) } as *mut u32;
        if !ptr.is_null() {
            unsafe {
                *ptr = value;
                GlobalUnlock(hmem);
            }
            let res = unsafe { SetClipboardData(fmt, hmem) };
            if res.is_null() {
                unsafe { GlobalFree(hmem) };
            }
        } else {
            unsafe { GlobalFree(hmem) };
        }
    }

    fn open_clipboard_retry() -> Result<(), String> {
        for _ in 0..6 {
            if unsafe { OpenClipboard(std::ptr::null_mut()) } != 0 {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(20));
        }
        Err("Unable to open Windows clipboard".to_string())
    }

    /// Writes sensitive text to the clipboard while flagging Windows 10/11 to exclude it
    /// from Clipboard History (Win+V), Cloud Sync, and clipboard monitor processing.
    pub fn set_protected_clipboard(text: &str) -> Result<u32, String> {
        open_clipboard_retry()?;
        unsafe { EmptyClipboard() };

        let wide = to_wide_null(text);
        let bytes_len = wide.len() * std::mem::size_of::<u16>();
        let hmem = unsafe { GlobalAlloc(GMEM_MOVEABLE, bytes_len) };
        if hmem.is_null() {
            unsafe { CloseClipboard() };
            return Err("GlobalAlloc failed for clipboard".to_string());
        }

        let ptr = unsafe { GlobalLock(hmem) } as *mut u16;
        if ptr.is_null() {
            unsafe {
                GlobalFree(hmem);
                CloseClipboard();
            }
            return Err("GlobalLock failed for clipboard".to_string());
        }

        unsafe {
            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
            GlobalUnlock(hmem);
        }

        let set_res = unsafe { SetClipboardData(CF_UNICODETEXT, hmem) };
        if set_res.is_null() {
            unsafe {
                GlobalFree(hmem);
                CloseClipboard();
            }
            return Err("SetClipboardData failed".to_string());
        }

        set_clipboard_dword_flag("ExcludeClipboardContentFromMonitorProcessing", 1);
        set_clipboard_dword_flag("CanIncludeInClipboardHistory", 0);
        set_clipboard_dword_flag("CanUploadToCloudClipboard", 0);

        unsafe { CloseClipboard() };
        Ok(unsafe { GetClipboardSequenceNumber() })
    }

    pub fn clear_clipboard_if_sequence(expected_seq: Option<u32>) {
        if let Some(seq) = expected_seq {
            if unsafe { GetClipboardSequenceNumber() } != seq {
                return;
            }
        }
        if open_clipboard_retry().is_ok() {
            unsafe {
                EmptyClipboard();
                CloseClipboard();
            }
        }
    }

    fn make_vk_input(vk: u16, key_up: bool) -> INPUT {
        let mut inp: INPUT = unsafe { std::mem::zeroed() };
        inp.r#type = INPUT_KEYBOARD;
        inp.Anonymous.ki = KEYBDINPUT {
            wVk: vk,
            wScan: 0,
            dwFlags: if key_up { KEYEVENTF_KEYUP } else { 0 },
            time: 0,
            dwExtraInfo: 0,
        };
        inp
    }

    fn make_unicode_input(code_unit: u16, key_up: bool) -> INPUT {
        let mut inp: INPUT = unsafe { std::mem::zeroed() };
        inp.r#type = INPUT_KEYBOARD;
        inp.Anonymous.ki = KEYBDINPUT {
            wVk: 0,
            wScan: code_unit,
            dwFlags: KEYEVENTF_UNICODE | if key_up { KEYEVENTF_KEYUP } else { 0 },
            time: 0,
            dwExtraInfo: 0,
        };
        inp
    }

    fn send_key(vk: u16) {
        let inputs = [make_vk_input(vk, false), make_vk_input(vk, true)];
        unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_ptr(),
                std::mem::size_of::<INPUT>() as i32,
            );
        }
    }

    fn send_unicode_string(text: &str) {
        for code_unit in text.encode_utf16() {
            let pair = [
                make_unicode_input(code_unit, false),
                make_unicode_input(code_unit, true),
            ];
            unsafe {
                SendInput(
                    pair.len() as u32,
                    pair.as_ptr(),
                    std::mem::size_of::<INPUT>() as i32,
                );
            }
            thread::sleep(Duration::from_millis(4));
        }
    }

    pub fn focus_window(hwnd_val: isize) {
        if hwnd_val == 0 {
            return;
        }
        let hwnd = hwnd_val as HWND;
        unsafe {
            if IsIconic(hwnd) != 0 {
                ShowWindow(hwnd, SW_RESTORE);
            }
            let fg = GetForegroundWindow();
            if fg != hwnd {
                let target_thread = GetWindowThreadProcessId(hwnd, std::ptr::null_mut());
                let cur_thread = GetCurrentThreadId();
                if target_thread != 0 && target_thread != cur_thread {
                    AttachThreadInput(cur_thread, target_thread, 1);
                    SetForegroundWindow(hwnd);
                    AttachThreadInput(cur_thread, target_thread, 0);
                } else {
                    SetForegroundWindow(hwnd);
                }
            }
        }
        thread::sleep(Duration::from_millis(110));
    }

    pub fn perform_hybrid_autofill(
        target_hwnd: isize,
        username: &str,
        password: &str,
        totp: Option<&str>,
        auto_submit: bool,
        two_step: bool,
    ) -> Result<(), String> {
        focus_window(target_hwnd);

        if !username.is_empty() {
            send_unicode_string(username);
            thread::sleep(Duration::from_millis(45));
            if two_step {
                send_key(VK_RETURN);
                thread::sleep(Duration::from_millis(650));
            } else {
                send_key(VK_TAB);
                thread::sleep(Duration::from_millis(60));
            }
        }

        if !password.is_empty() {
            send_unicode_string(password);
            thread::sleep(Duration::from_millis(45));
            if auto_submit {
                send_key(VK_RETURN);
            }
        }

        if let Some(code) = totp {
            if !code.is_empty() {
                thread::sleep(Duration::from_millis(400));
                send_unicode_string(code);
                if auto_submit {
                    thread::sleep(Duration::from_millis(45));
                    send_key(VK_RETURN);
                }
            }
        }

        Ok(())
    }

    pub fn perform_totp_autofill(target_hwnd: isize, code: &str, auto_submit: bool) {
        focus_window(target_hwnd);
        send_unicode_string(code);
        if auto_submit {
            thread::sleep(Duration::from_millis(40));
            send_key(VK_RETURN);
        }
    }

    fn is_ctrl_v_down() -> bool {
        unsafe {
            let ctrl = (GetAsyncKeyState(VK_CONTROL as i32) as u16 & 0x8000) != 0;
            let v_key = (GetAsyncKeyState(VK_V as i32) as u16 & 0x8000) != 0;
            ctrl && v_key
        }
    }

    pub fn run_smart_sequential_clipboard(
        app: AppHandle,
        username: String,
        password: String,
        cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) {
        use std::sync::atomic::Ordering;
        use zeroize::Zeroize;

        let mut user = username;
        let mut pass = password;

        if !user.is_empty() {
            if let Ok(seq1) = set_protected_clipboard(&user) {
                let _ = app.emit(
                    "delivery-status",
                    DeliveryStatusEvent {
                        stage: "clipboard_username".into(),
                        detail: "Username copied — press Ctrl+V to auto-switch to password".into(),
                    },
                );

                // Wait until Ctrl+V is pressed or 25s elapses or cancelled
                let deadline = Instant::now() + Duration::from_secs(25);
                let mut pasted_user = false;
                while Instant::now() < deadline && !cancel_flag.load(Ordering::SeqCst) {
                    if is_ctrl_v_down() {
                        pasted_user = true;
                        break;
                    }
                    thread::sleep(Duration::from_millis(45));
                }

                if cancel_flag.load(Ordering::SeqCst) {
                    clear_clipboard_if_sequence(Some(seq1));
                    user.zeroize();
                    pass.zeroize();
                    return;
                }

                if pasted_user {
                    // Let target app finish reading username from clipboard
                    thread::sleep(Duration::from_millis(320));
                }
            }
        }

        if !pass.is_empty() && !cancel_flag.load(Ordering::SeqCst) {
            if let Ok(seq2) = set_protected_clipboard(&pass) {
                let _ = app.emit(
                    "delivery-status",
                    DeliveryStatusEvent {
                        stage: "clipboard_password".into(),
                        detail: "Password ready in protected clipboard (auto-clears after paste)".into(),
                    },
                );

                // Wait for Ctrl+V release first if still held
                let release_deadline = Instant::now() + Duration::from_secs(2);
                while is_ctrl_v_down() && Instant::now() < release_deadline {
                    thread::sleep(Duration::from_millis(30));
                }

                let deadline = Instant::now() + Duration::from_secs(30);
                while Instant::now() < deadline && !cancel_flag.load(Ordering::SeqCst) {
                    if is_ctrl_v_down() {
                        thread::sleep(Duration::from_millis(350));
                        break;
                    }
                    thread::sleep(Duration::from_millis(50));
                }

                clear_clipboard_if_sequence(Some(seq2));
            }
        }

        user.zeroize();
        pass.zeroize();
        let _ = app.emit(
            "delivery-status",
            DeliveryStatusEvent {
                stage: "clipboard_cleared".into(),
                detail: "Protected clipboard cleared".into(),
            },
        );
    }

    pub fn copy_single_with_auto_clear(
        app: AppHandle,
        value: String,
        field_name: &'static str,
        ttl_secs: u64,
    ) {
        use zeroize::Zeroize;
        let mut secret = value;
        if let Ok(seq) = set_protected_clipboard(&secret) {
            secret.zeroize();
            let _ = app.emit(
                "delivery-status",
                DeliveryStatusEvent {
                    stage: format!("copied_{field_name}"),
                    detail: format!("{field_name} copied ({ttl_secs}s auto-clear)"),
                },
            );
            thread::spawn(move || {
                thread::sleep(Duration::from_secs(ttl_secs));
                clear_clipboard_if_sequence(Some(seq));
                let _ = app.emit(
                    "delivery-status",
                    DeliveryStatusEvent {
                        stage: "clipboard_cleared".into(),
                        detail: "Protected clipboard cleared".into(),
                    },
                );
            });
        } else {
            secret.zeroize();
        }
    }
}

#[cfg(not(windows))]
mod win_impl {
    use super::DeliveryStatusEvent;
    use tauri::{AppHandle, Emitter};

    pub fn perform_hybrid_autofill(
        _target_hwnd: isize,
        _username: &str,
        _password: &str,
        _totp: Option<&str>,
        _auto_submit: bool,
        _two_step: bool,
    ) -> Result<(), String> {
        Err("Auto-Type is currently implemented for Windows; use clipboard copy on this OS".into())
    }

    pub fn perform_totp_autofill(_target_hwnd: isize, _code: &str, _auto_submit: bool) {}

    pub fn run_smart_sequential_clipboard(
        app: AppHandle,
        _username: String,
        _password: String,
        _cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) {
        let _ = app.emit(
            "delivery-status",
            DeliveryStatusEvent {
                stage: "unsupported".into(),
                detail: "Smart clipboard requires Windows".into(),
            },
        );
    }

    pub fn copy_single_with_auto_clear(
        _app: AppHandle,
        _value: String,
        _field_name: &'static str,
        _ttl_secs: u64,
    ) {
    }

    pub fn clear_clipboard_if_sequence(_expected_seq: Option<u32>) {}
}

pub use win_impl::{
    clear_clipboard_if_sequence, copy_single_with_auto_clear, perform_hybrid_autofill,
    perform_totp_autofill, run_smart_sequential_clipboard,
};
