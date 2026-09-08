use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetSystemMetrics, GetWindowLongPtrW, GetWindowRect, GetWindowTextLengthW,
    GetWindowTextW, IsWindow, IsWindowVisible, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE,
    GWL_STYLE, HWND_TOP, SM_CXSCREEN, SM_CYSCREEN, SWP_FRAMECHANGED, SWP_SHOWWINDOW,
    WINDOW_STYLE, WS_BORDER, WS_CAPTION, WS_EX_TOOLWINDOW, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
    WS_OVERLAPPEDWINDOW, WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
}

pub fn list_visible_windows() -> Vec<WindowInfo> {
    let mut windows: Vec<WindowInfo> = Vec::new();
    let lparam = &mut windows as *mut Vec<WindowInfo> as isize;

    unsafe {
        let _ = EnumWindows(Some(enum_windows_proc), LPARAM(lparam));
    }

    windows
}

unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }

        let length = GetWindowTextLengthW(hwnd);
        if length == 0 {
            return BOOL(1);
        }

        // Filter out zero-size and tool windows
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return BOOL(1);
        }
        if (rect.right - rect.left) < 120 || (rect.bottom - rect.top) < 80 {
            return BOOL(1);
        }

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        if ex_style & WS_EX_TOOLWINDOW.0 != 0 {
            return BOOL(1);
        }

        let mut buffer: Vec<u16> = vec![0; (length + 1) as usize];
        let copied = GetWindowTextW(hwnd, &mut buffer);
        if copied > 0 {
            let title = String::from_utf16_lossy(&buffer[..copied as usize]);
            let trimmed = title.trim();
            if !trimmed.is_empty()
                && trimmed != "Program Manager"
                && trimmed != "Windows Input Experience"
                && !trimmed.starts_with("Settings")
                && trimmed != "True Stretch Toolkit"
            {
                let windows = &mut *(lparam.0 as *mut Vec<WindowInfo>);
                windows.push(WindowInfo {
                    hwnd: hwnd.0 as isize,
                    title: trimmed.to_string(),
                });
            }
        }

        BOOL(1)
    }
}

pub fn make_borderless(hwnd_val: isize) -> Result<String, String> {
    unsafe {
        let hwnd = HWND(hwnd_val as *mut std::ffi::c_void);
        if !IsWindow(hwnd).as_bool() {
            return Err("Target window is no longer valid.".to_string());
        }

        let current_style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let mut style = WINDOW_STYLE(current_style);

        // Strip decorations
        style &= !(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_BORDER);
        style |= WS_POPUP;

        SetWindowLongPtrW(hwnd, GWL_STYLE, style.0 as isize);

        // Query monitor bounds
        let h_mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        let (x, y, width, height) = if GetMonitorInfoW(h_mon, &mut mi).as_bool() {
            let rc: RECT = mi.rcMonitor;
            (rc.left, rc.top, rc.right - rc.left, rc.bottom - rc.top)
        } else {
            let cx = GetSystemMetrics(SM_CXSCREEN);
            let cy = GetSystemMetrics(SM_CYSCREEN);
            (0, 0, cx, cy)
        };

        // Borderless FULLSCREEN = strip the frame AND cover the whole monitor.
        // Applied twice: games often re-assert their own size on the first
        // style change — the second pass wins.
        for _ in 0..2 {
            SetWindowPos(
                hwnd,
                HWND_TOP,
                x,
                y,
                width,
                height,
                SWP_FRAMECHANGED | SWP_SHOWWINDOW,
            )
            .map_err(|e| format!("SetWindowPos failed: {}", e))?;
        }

        // Re-assert shortly after: Valorant reverts external resizes on some
        // frames. A background nudge wins without blocking the UI.
        // (HWND is a raw pointer, so the plain integer crosses threads.)
        let hwnd_val = hwnd_val;
        std::thread::spawn(move || {
            let hwnd = HWND(hwnd_val as *mut std::ffi::c_void);
            for ms in [400u64, 1000] {
                std::thread::sleep(std::time::Duration::from_millis(ms));
                if !IsWindow(hwnd).as_bool() {
                    break;
                }
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOP,
                    x,
                    y,
                    width,
                    height,
                    SWP_FRAMECHANGED | SWP_SHOWWINDOW,
                );
            }
        });

        // Read back what actually stuck, so the UI reports truth, not hope.
        let mut final_rect = RECT::default();
        let (fw, fh) = if GetWindowRect(hwnd, &mut final_rect).is_ok() {
            (
                final_rect.right - final_rect.left,
                final_rect.bottom - final_rect.top,
            )
        } else {
            (width, height)
        };

        Ok(format!(
            "Borderless fullscreen: window now {}x{} on a {}x{} screen",
            fw, fh, width, height
        ))
    }
}

pub fn restore_window(hwnd_val: isize) -> Result<String, String> {
    unsafe {
        let hwnd = HWND(hwnd_val as *mut std::ffi::c_void);
        if !IsWindow(hwnd).as_bool() {
            return Err("Target window is no longer valid.".to_string());
        }

        let current_style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let mut style = WINDOW_STYLE(current_style);

        style &= !WS_POPUP;
        style |= WS_OVERLAPPEDWINDOW;

        SetWindowLongPtrW(hwnd, GWL_STYLE, style.0 as isize);

        SetWindowPos(
            hwnd,
            HWND_TOP,
            100,
            100,
            1280,
            720,
            SWP_FRAMECHANGED | SWP_SHOWWINDOW,
        ).map_err(|e| format!("SetWindowPos failed: {}", e))?;

        Ok("Window restored to standard framed mode.".to_string())
    }
}
