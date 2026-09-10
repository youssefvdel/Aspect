use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetForegroundWindow, GetSystemMetrics, GetWindowLongPtrW,
    GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsWindow, IsWindowVisible,
    SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, HWND_TOP, HWND_TOPMOST, SM_CXSCREEN,
    SM_CYSCREEN, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOZORDER, SWP_SHOWWINDOW,
    WINDOW_STYLE, WS_BORDER, WS_CAPTION, WS_EX_TOOLWINDOW, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
    WS_OVERLAPPEDWINDOW, WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
    #[serde(default)]
    pub class_name: String,
    #[serde(default)]
    pub is_game: bool,
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
                && trimmed != "Aspect"
            {
                let mut class_buf = [0u16; 128];
                let class_len = GetClassNameW(hwnd, &mut class_buf);
                let class_name = if class_len > 0 {
                    String::from_utf16_lossy(&class_buf[..class_len as usize])
                } else {
                    String::new()
                };

                let is_game = is_game_window(hwnd, trimmed, &class_name);

                let windows = &mut *(lparam.0 as *mut Vec<WindowInfo>);
                windows.push(WindowInfo {
                    hwnd: hwnd.0 as isize,
                    title: trimmed.to_string(),
                    class_name,
                    is_game,
                });
            }
        }

        BOOL(1)
    }
}

pub fn is_valorant_game_window(_hwnd: HWND, title: &str, class_name: &str) -> bool {
    let trimmed = title.trim();
    let lower = trimmed.to_lowercase();

    // 1. Filter out companion apps, trackers, overlays, and launchers.
    // "Valorant Tracker", "Overwolf", "Blitz", "Riot Client", etc.
    if lower.contains("tracker")
        || lower.contains("overwolf")
        || lower.contains("blitz")
        || lower.contains("riot client")
        || lower.contains("aspect")
        || lower.contains("discord")
        || lower.contains("obs")
        || lower.contains("chrome")
        || lower.contains("edge")
    {
        return false;
    }

    // 2. Valorant's real game client is an Unreal Engine 4 window ("UnrealWindow" or "VALORANTUnrealWindow").
    // Third-party trackers and Electron wrappers are NEVER "UnrealWindow".
    if class_name == "UnrealWindow" || class_name == "VALORANTUnrealWindow" || class_name.contains("UnrealWindow") {
        return lower == "valorant" || lower.starts_with("valorant");
    }

    // 3. Fallback: exact match on title "VALORANT" if class_name is unavailable
    lower == "valorant" || lower.starts_with("valorant")
}

#[allow(dead_code)]
pub fn is_valorant_foreground() -> bool {
    unsafe {
        let fg = GetForegroundWindow();
        if !IsWindow(fg).as_bool() {
            return false;
        }
        let length = GetWindowTextLengthW(fg);
        if length == 0 {
            return false;
        }
        let mut buffer: Vec<u16> = vec![0; (length + 1) as usize];
        let copied = GetWindowTextW(fg, &mut buffer);
        if copied > 0 {
            let title = String::from_utf16_lossy(&buffer[..copied as usize]);
            let mut class_buf = [0u16; 128];
            let class_len = GetClassNameW(fg, &mut class_buf);
            let class_name = if class_len > 0 {
                String::from_utf16_lossy(&class_buf[..class_len as usize])
            } else {
                String::new()
            };
            return is_valorant_game_window(fg, title.trim(), &class_name);
        }
        false
    }
}

pub fn is_game_window(hwnd: HWND, title: &str, class_name: &str) -> bool {
    if is_valorant_game_window(hwnd, title, class_name) {
        return true;
    }
    let lower = title.trim().to_lowercase();
    if lower.contains("tracker")
        || lower.contains("overwolf")
        || lower.contains("blitz")
        || lower.contains("riot client")
        || lower.contains("aspect")
    {
        return false;
    }
    lower.contains("counter-strike") || lower.contains("cs2") || lower.contains("aimlabs")
}

pub fn find_valorant_game_window() -> Option<WindowInfo> {
    let windows = list_visible_windows();
    for w in windows {
        let hwnd = HWND(w.hwnd as *mut std::ffi::c_void);
        if is_valorant_game_window(hwnd, &w.title, &w.class_name) {
            return Some(w);
        }
    }
    None
}

pub fn is_window_borderless_fullscreen(hwnd: HWND) -> bool {
    unsafe {
        if !IsWindow(hwnd).as_bool() {
            return false;
        }

        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let is_popup = (style & WS_POPUP.0) != 0;
        let has_caption = (style & (WS_CAPTION.0 | WS_THICKFRAME.0)) != 0;

        if !is_popup || has_caption {
            return false;
        }

        let h_mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if GetMonitorInfoW(h_mon, &mut mi).as_bool() {
            let mut wr = RECT::default();
            if GetWindowRect(hwnd, &mut wr).is_ok() {
                let mon_w = mi.rcMonitor.right - mi.rcMonitor.left;
                let mon_h = mi.rcMonitor.bottom - mi.rcMonitor.top;
                let win_w = wr.right - wr.left;
                let win_h = wr.bottom - wr.top;
                return win_w == mon_w && win_h == mon_h;
            }
        }
        false
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

#[link(name = "dwmapi")]
extern "system" {
    fn DwmSetWindowAttribute(
        hwnd: HWND,
        dw_attribute: u32,
        pv_attribute: *const std::ffi::c_void,
        cb_attribute: u32,
    ) -> windows::core::HRESULT;
}

pub fn strip_all_dwm_borders(hwnd: HWND) {
    unsafe {
        // 1. Prevent Windows 11 rounded corners from drawing white pixels in corners
        let do_not_round: u32 = 1; // DWMWCP_DONOTROUND
        let _ = DwmSetWindowAttribute(
            hwnd,
            33, // DWMWA_WINDOW_CORNER_PREFERENCE
            &do_not_round as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
        );

        // 2. Strictly prohibit DWM from drawing any window border or frame
        let color_none: u32 = 0xFFFFFFFE; // DWMWA_COLOR_NONE
        let _ = DwmSetWindowAttribute(
            hwnd,
            34, // DWMWA_BORDER_COLOR
            &color_none as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
        );
    }
}

pub fn get_valorant_or_screen_rect(hwnd: HWND) -> (i32, i32, i32, i32) {
    unsafe {
        if let Some(val) = find_valorant_game_window() {
            let val_hwnd = HWND(val.hwnd as *mut std::ffi::c_void);
            let mut rect = RECT::default();
            if GetWindowRect(val_hwnd, &mut rect).is_ok() {
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                if w > 100 && h > 100 {
                    return (rect.left, rect.top, w, h);
                }
            }
        }

        let h_mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if GetMonitorInfoW(h_mon, &mut mi).as_bool() {
            let rc = mi.rcMonitor;
            (rc.left, rc.top, rc.right - rc.left, rc.bottom - rc.top)
        } else {
            let cx = GetSystemMetrics(SM_CXSCREEN);
            let cy = GetSystemMetrics(SM_CYSCREEN);
            (0, 0, cx, cy)
        }
    }
}

pub fn align_overlay_to_valorant(hwnd_val: isize) -> Result<(), String> {
    unsafe {
        let hwnd = HWND(hwnd_val as *mut std::ffi::c_void);
        if !IsWindow(hwnd).as_bool() {
            return Err("Overlay window handle is invalid.".to_string());
        }

        if let Some(val) = find_valorant_game_window() {
            let val_hwnd = HWND(val.hwnd as *mut std::ffi::c_void);
            let mut val_rect = RECT::default();
            if GetWindowRect(val_hwnd, &mut val_rect).is_ok() {
                let w = val_rect.right - val_rect.left;
                let h = val_rect.bottom - val_rect.top;
                if w > 100 && h > 100 {
                    let mut cur_rect = RECT::default();
                    if GetWindowRect(hwnd, &mut cur_rect).is_ok() {
                        if cur_rect.left != val_rect.left
                            || cur_rect.top != val_rect.top
                            || (cur_rect.right - cur_rect.left) != w
                            || (cur_rect.bottom - cur_rect.top) != h
                        {
                            let _ = SetWindowPos(
                                hwnd,
                                HWND_TOPMOST,
                                val_rect.left,
                                val_rect.top,
                                w,
                                h,
                                SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW,
                            );
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

pub fn setup_overlay_window(hwnd_val: isize, clickthrough: bool) -> Result<(), String> {
    unsafe {
        let hwnd = HWND(hwnd_val as *mut std::ffi::c_void);
        if !IsWindow(hwnd).as_bool() {
            return Err("Overlay window handle is invalid.".to_string());
        }

        // 1. Strip ALL standard window decorations, frames, and captions so zero title bar renders
        let current_style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let new_style = ((current_style
            & !(0x00C00000 | 0x00040000 | 0x00010000 | 0x00020000 | 0x00080000 | 0x00800000))
            | 0x80000000  // WS_POPUP
            | 0x10000000  // WS_VISIBLE
            | 0x04000000) // WS_CLIPSIBLINGS
            as i32 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);

        // 2. Configure extended styles
        let mut ex_style = (GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32)
            | 0x00080000  // WS_EX_LAYERED
            | 0x00000008  // WS_EX_TOPMOST
            | 0x00000080; // WS_EX_TOOLWINDOW
        if clickthrough {
            ex_style |= 0x00000020 | 0x08000000; // WS_EX_TRANSPARENT | WS_EX_NOACTIVATE
        } else {
            ex_style &= !(0x00000020 | 0x08000000);
        }
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style as i32 as isize);

        // 3. Strip all DWM borders & shadows
        strip_all_dwm_borders(hwnd);

        // 4. Align strictly to Valorant window rect
        let (x, y, width, height) = get_valorant_or_screen_rect(hwnd);

        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            x,
            y,
            width,
            height,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );

        Ok(())
    }
}

pub fn toggle_overlay_clickthrough(hwnd_val: isize, clickthrough: bool) -> Result<(), String> {
    unsafe {
        let hwnd = HWND(hwnd_val as *mut std::ffi::c_void);
        if !IsWindow(hwnd).as_bool() {
            return Err("Overlay window handle is invalid.".to_string());
        }

        // Always strip caption and force WS_POPUP with 64-bit sign extension
        let current_style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let new_style = ((current_style
            & !(0x00C00000 | 0x00040000 | 0x00010000 | 0x00020000 | 0x00080000 | 0x00800000))
            | 0x80000000  // WS_POPUP
            | 0x10000000  // WS_VISIBLE
            | 0x04000000) // WS_CLIPSIBLINGS
            as i32 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);

        let mut ex_style = (GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32)
            | 0x00080000  // WS_EX_LAYERED
            | 0x00000008  // WS_EX_TOPMOST
            | 0x00000080; // WS_EX_TOOLWINDOW
        if clickthrough {
            ex_style |= 0x00000020 | 0x08000000; // WS_EX_TRANSPARENT | WS_EX_NOACTIVATE
        } else {
            ex_style &= !(0x00000020 | 0x08000000); // Allow mouse clicks & dragging
        }
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style as i32 as isize);

        // Strip DWM borders
        strip_all_dwm_borders(hwnd);

        // Synchronize position to Valorant if running
        let (x, y, width, height) = get_valorant_or_screen_rect(hwnd);

        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            x,
            y,
            width,
            height,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
        Ok(())
    }
}
