use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedWindow {
    pub hwnd: isize,
    pub pid: u32,
    pub exe_name: String,
    pub exe_path: String,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_foreground: bool,
}

#[cfg(windows)]
mod win {
    use super::DetectedWindow;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::Path;
    use windows_sys::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetForegroundWindow, GetWindowLongW, GetWindowRect, GetWindowTextLengthW,
        GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, GWL_EXSTYLE,
        WS_EX_TOOLWINDOW,
    };

    fn read_window_title(hwnd: HWND) -> String {
        let len = unsafe { GetWindowTextLengthW(hwnd) };
        if len <= 0 {
            return String::new();
        }
        let mut buf = vec![0u16; (len + 1) as usize];
        let copied = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        if copied <= 0 {
            return String::new();
        }
        OsString::from_wide(&buf[..copied as usize])
            .to_string_lossy()
            .into_owned()
    }

    fn read_process_info(hwnd: HWND) -> (u32, String, String) {
        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        if pid == 0 {
            return (0, String::new(), String::new());
        }

        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if handle.is_null() {
            return (pid, String::new(), String::new());
        }

        let mut buf = vec![0u16; 1024];
        let mut size = buf.len() as u32;
        let ok = unsafe { QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size) };
        unsafe { CloseHandle(handle) };

        if ok == 0 || size == 0 {
            return (pid, String::new(), String::new());
        }

        let full_path = OsString::from_wide(&buf[..size as usize])
            .to_string_lossy()
            .into_owned();
        let exe_name = Path::new(&full_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        (pid, exe_name, full_path)
    }

    pub fn build_detected_window(hwnd: HWND, fg_hwnd: HWND) -> Option<DetectedWindow> {
        if hwnd.is_null() || unsafe { IsWindowVisible(hwnd) } == 0 || unsafe { IsIconic(hwnd) } != 0
        {
            return None;
        }
        let ex_style = unsafe { GetWindowLongW(hwnd, GWL_EXSTYLE) } as u32;
        if (ex_style & WS_EX_TOOLWINDOW) != 0 {
            return None;
        }

        let title = read_window_title(hwnd);
        if title.trim().is_empty() {
            return None;
        }

        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            return None;
        }
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width < 120 || height < 80 {
            return None;
        }

        let (pid, exe_name, exe_path) = read_process_info(hwnd);
        if pid == 0 || pid == std::process::id() || exe_name.is_empty() {
            return None;
        }

        // Filter out core Windows shell host surfaces
        let exe_lower = exe_name.to_ascii_lowercase();
        if exe_lower == "explorer.exe"
            || exe_lower == "shellexperiencehost.exe"
            || exe_lower == "searchhost.exe"
            || exe_lower == "startmenuexperiencehost.exe"
            || exe_lower == "applicationframehost.exe"
        {
            return None;
        }

        Some(DetectedWindow {
            hwnd: hwnd as isize,
            pid,
            exe_name,
            exe_path,
            title,
            x: rect.left,
            y: rect.top,
            width,
            height,
            is_foreground: hwnd == fg_hwnd,
        })
    }

    pub fn get_foreground_window() -> Option<DetectedWindow> {
        let fg = unsafe { GetForegroundWindow() };
        if fg.is_null() {
            return None;
        }
        build_detected_window(fg, fg)
    }

    pub fn get_window_by_hwnd(hwnd_val: isize) -> Option<DetectedWindow> {
        let hwnd = hwnd_val as HWND;
        let fg = unsafe { GetForegroundWindow() };
        build_detected_window(hwnd, fg)
    }

    pub fn is_window_valid(hwnd_val: isize) -> bool {
        if hwnd_val == 0 {
            return false;
        }
        let hwnd = hwnd_val as HWND;
        unsafe { IsWindow(hwnd) != 0 && IsWindowVisible(hwnd) != 0 && IsIconic(hwnd) == 0 }
    }

    struct EnumState {
        fg: HWND,
        results: Vec<DetectedWindow>,
    }

    unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam as *mut EnumState);
        if let Some(win) = build_detected_window(hwnd, state.fg) {
            state.results.push(win);
        }
        1
    }

    pub fn list_visible_windows() -> Vec<DetectedWindow> {
        let fg = unsafe { GetForegroundWindow() };
        let mut state = EnumState {
            fg,
            results: Vec::new(),
        };
        unsafe {
            EnumWindows(Some(enum_callback), (&mut state as *mut EnumState) as LPARAM);
        }
        state.results
    }

    pub fn get_window_rect(hwnd_val: isize) -> Option<(i32, i32, i32, i32)> {
        if hwnd_val == 0 {
            return None;
        }
        let hwnd = hwnd_val as HWND;
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            return None;
        }
        Some((
            rect.left,
            rect.top,
            rect.right - rect.left,
            rect.bottom - rect.top,
        ))
    }

    pub fn calculate_overlay_position(
        target_rect: (i32, i32, i32, i32),
        overlay_phys_w: i32,
        overlay_phys_h: i32,
        target_hwnd: isize,
    ) -> (i32, i32) {
        let (tx, ty, tw, _th) = target_rect;
        let hwnd = target_hwnd as HWND;
        let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            rcMonitor: RECT {
                left: 0,
                top: 0,
                right: 1920,
                bottom: 1080,
            },
            rcWork: RECT {
                left: 0,
                top: 0,
                right: 1920,
                bottom: 1040,
            },
            dwFlags: 0,
        };
        if !monitor.is_null() {
            unsafe { GetMonitorInfoW(monitor, &mut info) };
        }
        let work = info.rcWork;
        let gap = 14;

        // Prefer right side of the login window, then left side, then top-right inside maximized window.
        let mut x = tx + tw + gap;
        if x + overlay_phys_w > work.right - 8 {
            let left_candidate = tx - overlay_phys_w - gap;
            if left_candidate >= work.left + 8 {
                x = left_candidate;
            } else {
                x = (work.right - overlay_phys_w - 24).max(work.left + 12);
            }
        }

        let mut y = ty + 20;
        let max_y = (work.bottom - overlay_phys_h - 12).max(work.top + 12);
        if y > max_y {
            y = max_y;
        }
        if y < work.top + 12 {
            y = work.top + 12;
        }

        (x, y)
    }

    pub fn is_own_foreground() -> bool {
        let fg = unsafe { GetForegroundWindow() };
        if fg.is_null() {
            return false;
        }
        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(fg, &mut pid) };
        pid == std::process::id()
    }
}

#[cfg(not(windows))]
mod win {
    use super::DetectedWindow;

    pub fn get_foreground_window() -> Option<DetectedWindow> {
        None
    }

    pub fn get_window_by_hwnd(_hwnd_val: isize) -> Option<DetectedWindow> {
        None
    }

    pub fn is_window_valid(_hwnd_val: isize) -> bool {
        false
    }

    pub fn list_visible_windows() -> Vec<DetectedWindow> {
        Vec::new()
    }

    pub fn get_window_rect(_hwnd_val: isize) -> Option<(i32, i32, i32, i32)> {
        None
    }

    pub fn calculate_overlay_position(
        _target_rect: (i32, i32, i32, i32),
        _overlay_phys_w: i32,
        _overlay_phys_h: i32,
        _target_hwnd: isize,
    ) -> (i32, i32) {
        (80, 80)
    }

    pub fn is_own_foreground() -> bool {
        false
    }
}

pub use win::{
    calculate_overlay_position, get_foreground_window, get_window_by_hwnd, get_window_rect,
    is_own_foreground, is_window_valid, list_visible_windows,
};
