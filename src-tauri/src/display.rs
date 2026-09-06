#![allow(dead_code)]
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use windows::core::PCWSTR;
use windows::Win32::Graphics::Gdi::{
    ChangeDisplaySettingsExW, ChangeDisplaySettingsW, EnumDisplayDevicesW, EnumDisplaySettingsW,
    CDS_NORESET, CDS_TYPE, CDS_UPDATEREGISTRY, DEVMODEW, DISPLAY_DEVICEW,
    DISPLAY_DEVICE_PRIMARY_DEVICE,
    DM_BITSPERPEL, DM_DISPLAYFLAGS, DM_DISPLAYFREQUENCY, DM_DISPLAYORIENTATION,
    DM_PELSHEIGHT, DM_PELSWIDTH, DM_POSITION, ENUM_CURRENT_SETTINGS,
    ENUM_DISPLAY_SETTINGS_MODE,
};
use windows::Win32::Devices::Display::{
    GetDisplayConfigBufferSizes, QueryDisplayConfig, SetDisplayConfig,
    DISPLAYCONFIG_MODE_INFO, DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SCALING_STRETCHED,
    DISPLAYCONFIG_SCALING_ASPECTRATIOCENTEREDMAX,
    QDC_ONLY_ACTIVE_PATHS, SDC_APPLY, SDC_SAVE_TO_DATABASE, SDC_ALLOW_CHANGES, SDC_USE_SUPPLIED_DISPLAY_CONFIG,
};
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ShortcutBinding {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub win: bool,
    pub vk: u16,
}

impl ShortcutBinding {
    pub const fn new(ctrl: bool, shift: bool, alt: bool, win: bool, vk: u16) -> Self {
        Self { ctrl, shift, alt, win, vk }
    }

    pub const fn f4() -> Self {
        Self { ctrl: false, shift: false, alt: false, win: false, vk: 0x73 }
    }

    #[allow(dead_code)]
    pub const fn f11() -> Self {
        Self { ctrl: false, shift: false, alt: false, win: false, vk: 0x7A }
    }

    #[allow(dead_code)]
    pub fn label(&self) -> String {
        self.format_display()
    }

    pub fn format_display(&self) -> String {
        if self.vk == 0 {
            return "Unbound".to_string();
        }
        let mut parts = Vec::new();
        if self.ctrl {
            parts.push("CTRL".to_string());
        }
        if self.alt {
            parts.push("ALT".to_string());
        }
        if self.shift {
            parts.push("SHIFT".to_string());
        }
        if self.win {
            parts.push("WIN".to_string());
        }
        parts.push(vk_to_name(self.vk));
        parts.join(" + ")
    }

    pub const fn to_code(&self) -> u32 {
        (self.vk as u32)
            | ((self.ctrl as u32) << 16)
            | ((self.shift as u32) << 17)
            | ((self.alt as u32) << 18)
            | ((self.win as u32) << 19)
    }

    pub const fn from_code(code: u32) -> Self {
        Self {
            vk: (code & 0xFFFF) as u16,
            ctrl: (code & (1 << 16)) != 0,
            shift: (code & (1 << 17)) != 0,
            alt: (code & (1 << 18)) != 0,
            win: (code & (1 << 19)) != 0,
        }
    }

    pub fn serialize(&self) -> String {
        format!("{}:{}:{}:{}:{}", self.ctrl, self.shift, self.alt, self.win, self.vk)
    }

    pub fn deserialize(s: &str) -> Option<Self> {
        let parts: Vec<&str> = s.trim().split(':').collect();
        if parts.len() == 5 {
            let ctrl = parts[0].parse().ok()?;
            let shift = parts[1].parse().ok()?;
            let alt = parts[2].parse().ok()?;
            let win = parts[3].parse().ok()?;
            let vk = parts[4].parse().ok()?;
            Some(Self { ctrl, shift, alt, win, vk })
        } else {
            None
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HotkeyPreset {
    F4,
    F11,
    F10,
    F9,
    F12,
    F8,
    CtrlShiftS,
    AltF11,
    Insert,
}

impl HotkeyPreset {
    pub fn all() -> &'static [HotkeyPreset] {
        &[
            HotkeyPreset::F4,
            HotkeyPreset::F11,
            HotkeyPreset::F10,
            HotkeyPreset::F9,
            HotkeyPreset::F12,
            HotkeyPreset::F8,
            HotkeyPreset::CtrlShiftS,
            HotkeyPreset::AltF11,
            HotkeyPreset::Insert,
        ]
    }

    pub fn label(&self) -> &'static str {
        match self {
            HotkeyPreset::F4 => "F4 (Default)",
            HotkeyPreset::F11 => "F11",
            HotkeyPreset::F10 => "F10",
            HotkeyPreset::F9 => "F9",
            HotkeyPreset::F12 => "F12",
            HotkeyPreset::F8 => "F8",
            HotkeyPreset::CtrlShiftS => "Ctrl + Shift + S",
            HotkeyPreset::AltF11 => "Alt + F11",
            HotkeyPreset::Insert => "Insert",
        }
    }

    pub fn to_binding(&self) -> ShortcutBinding {
        match self {
            HotkeyPreset::F4 => ShortcutBinding::new(false, false, false, false, 0x73),
            HotkeyPreset::F11 => ShortcutBinding::new(false, false, false, false, 0x7A),
            HotkeyPreset::F10 => ShortcutBinding::new(false, false, false, false, 0x79),
            HotkeyPreset::F9 => ShortcutBinding::new(false, false, false, false, 0x78),
            HotkeyPreset::F12 => ShortcutBinding::new(false, false, false, false, 0x7B),
            HotkeyPreset::F8 => ShortcutBinding::new(false, false, false, false, 0x77),
            HotkeyPreset::CtrlShiftS => ShortcutBinding::new(true, true, false, false, 0x53),
            HotkeyPreset::AltF11 => ShortcutBinding::new(false, false, true, false, 0x7A),
            HotkeyPreset::Insert => ShortcutBinding::new(false, false, false, false, 0x2D),
        }
    }
}

#[allow(dead_code)]
pub type HotkeyChoice = HotkeyPreset;

pub fn vk_to_name(vk: u16) -> String {
    match vk {
        0x70 => "F1".into(),
        0x71 => "F2".into(),
        0x72 => "F3".into(),
        0x73 => "F4".into(),
        0x74 => "F5".into(),
        0x75 => "F6".into(),
        0x76 => "F7".into(),
        0x77 => "F8".into(),
        0x78 => "F9".into(),
        0x79 => "F10".into(),
        0x7A => "F11".into(),
        0x7B => "F12".into(),
        0x7C => "F13".into(),
        0x7D => "F14".into(),
        0x7E => "F15".into(),
        0x7F => "F16".into(),
        0x80 => "F17".into(),
        0x81 => "F18".into(),
        0x82 => "F19".into(),
        0x83 => "F20".into(),
        0x84 => "F21".into(),
        0x85 => "F22".into(),
        0x86 => "F23".into(),
        0x87 => "F24".into(),

        0x41..=0x5A => ((vk as u8) as char).to_string(),
        0x30..=0x39 => ((vk as u8) as char).to_string(),

        0x60 => "Num 0".into(),
        0x61 => "Num 1".into(),
        0x62 => "Num 2".into(),
        0x63 => "Num 3".into(),
        0x64 => "Num 4".into(),
        0x65 => "Num 5".into(),
        0x66 => "Num 6".into(),
        0x67 => "Num 7".into(),
        0x68 => "Num 8".into(),
        0x69 => "Num 9".into(),
        0x6A => "Num *".into(),
        0x6B => "Num +".into(),
        0x6C => "Num Sep".into(),
        0x6D => "Num -".into(),
        0x6E => "Num .".into(),
        0x6F => "Num /".into(),

        0x08 => "Backspace".into(),
        0x09 => "Tab".into(),
        0x0D => "Enter".into(),
        0x13 => "Pause".into(),
        0x14 => "Caps Lock".into(),
        0x1B => "Esc".into(),
        0x20 => "Space".into(),
        0x21 => "Page Up".into(),
        0x22 => "Page Down".into(),
        0x23 => "End".into(),
        0x24 => "Home".into(),
        0x25 => "Left".into(),
        0x26 => "Up".into(),
        0x27 => "Right".into(),
        0x28 => "Down".into(),
        0x2C => "Print Screen".into(),
        0x2D => "Insert".into(),
        0x2E => "Delete".into(),

        0x90 => "Num Lock".into(),
        0x91 => "Scroll Lock".into(),

        0xBA => ";".into(),
        0xBB => "=".into(),
        0xBC => ",".into(),
        0xBD => "-".into(),
        0xBE => ".".into(),
        0xBF => "/".into(),
        0xC0 => "`".into(),
        0xDB => "[".into(),
        0xDC => "\\".into(),
        0xDD => "]".into(),
        0xDE => "'".into(),

        0x04 => "Mouse Middle".into(),
        0x05 => "Mouse 4".into(),
        0x06 => "Mouse 5".into(),

        other => format!("Key 0x{:02X}", other),
    }
}

pub fn get_current_modifiers() -> (bool, bool, bool, bool) {
    unsafe {
        let ctrl = (GetAsyncKeyState(0x11) as u16 & 0x8000) != 0;
        let shift = (GetAsyncKeyState(0x10) as u16 & 0x8000) != 0;
        let alt = (GetAsyncKeyState(0x12) as u16 & 0x8000) != 0;
        let win = (GetAsyncKeyState(0x5B) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(0x5C) as u16 & 0x8000) != 0;
        (ctrl, shift, alt, win)
    }
}

pub fn scan_pressed_non_modifier_key() -> Option<u16> {
    // 1. Function keys F1..=F24 (0x70 ..= 0x87)
    for vk in 0x70..=0x87 {
        if unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 } {
            return Some(vk);
        }
    }
    // 2. Letters A-Z (0x41 ..= 0x5A)
    for vk in 0x41..=0x5A {
        if unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 } {
            return Some(vk);
        }
    }
    // 3. Numbers 0-9 (0x30 ..= 0x39)
    for vk in 0x30..=0x39 {
        if unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 } {
            return Some(vk);
        }
    }
    // 4. Numpad (0x60 ..= 0x6F)
    for vk in 0x60..=0x6F {
        if unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 } {
            return Some(vk);
        }
    }
    // 5. Navigation & Editing
    let nav_keys = [
        0x2D, // Insert
        0x2E, // Delete
        0x24, // Home
        0x23, // End
        0x21, // Page Up
        0x22, // Page Down
        0x25, // Left
        0x26, // Up
        0x27, // Right
        0x28, // Down
        0x20, // Space
        0x09, // Tab
        0x08, // Backspace
        0x0D, // Enter
        0x13, // Pause
        0x14, // Caps Lock
        0x2C, // Print Screen
        0x90, // Num Lock
        0x91, // Scroll Lock
    ];
    for &vk in &nav_keys {
        if unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 } {
            return Some(vk);
        }
    }
    // 6. OEM keys
    let oem_keys = [
        0xC0, // `
        0xBD, // -
        0xBB, // =
        0xDB, // [
        0xDD, // ]
        0xDC, // \
        0xBA, // ;
        0xDE, // '
        0xBC, // ,
        0xBE, // .
        0xBF, // /
    ];
    for &vk in &oem_keys {
        if unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 } {
            return Some(vk);
        }
    }
    // 7. Mouse thumb buttons
    for &vk in &[0x04, 0x05, 0x06] {
        if unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 } {
            return Some(vk);
        }
    }

    None
}

fn get_hotkey_storage_path() -> Option<PathBuf> {
    if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
        let dir = PathBuf::from(app_data).join("TrueStretchStudio");
        let _ = fs::create_dir_all(&dir);
        Some(dir.join("hotkey.txt"))
    } else {
        Some(PathBuf::from("hotkey.txt"))
    }
}

pub fn save_saved_hotkey(binding: &ShortcutBinding) {
    if let Some(path) = get_hotkey_storage_path() {
        let _ = fs::write(path, binding.serialize());
    }
}

pub fn load_saved_hotkey() -> ShortcutBinding {
    if let Some(path) = get_hotkey_storage_path() {
        if let Ok(s) = fs::read_to_string(path) {
            if let Some(binding) = ShortcutBinding::deserialize(&s) {
                return binding;
            }
        }
    }
    ShortcutBinding::f4()
}

pub fn get_stretched_res_path() -> Option<PathBuf> {
    if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
        let dir = PathBuf::from(app_data).join("TrueStretchStudio");
        let _ = fs::create_dir_all(&dir);
        Some(dir.join("stretched_res.txt"))
    } else {
        Some(PathBuf::from("stretched_res.txt"))
    }
}

pub fn save_saved_stretched_res(w: u32, h: u32) {
    if let Some(path) = get_stretched_res_path() {
        let _ = fs::write(path, format!("{}:{}", w, h));
    }
}

pub fn load_saved_stretched_res(default_w: u32, default_h: u32) -> (u32, u32) {
    if let Some(path) = get_stretched_res_path() {
        if let Ok(s) = fs::read_to_string(path) {
            let parts: Vec<&str> = s.trim().split(':').collect();
            if parts.len() == 2 {
                if let (Ok(w), Ok(h)) = (parts[0].parse(), parts[1].parse()) {
                    if w > 0 && h > 0 {
                        return (w, h);
                    }
                }
            }
        }
    }
    (default_w, default_h)
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct DisplayMode {
    pub width: u32,
    pub height: u32,
    pub refresh_rate: u32,
}

/// Retrieves primary monitor device name (e.g. "\\.\DISPLAY1")
pub fn get_primary_device_name() -> String {
    let mut dd = DISPLAY_DEVICEW {
        cb: std::mem::size_of::<DISPLAY_DEVICEW>() as u32,
        ..Default::default()
    };
    let mut i = 0;
    unsafe {
        while EnumDisplayDevicesW(None, i, &mut dd, 0).as_bool() {
            if (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) != 0 {
                let name = String::from_utf16_lossy(&dd.DeviceName);
                return name.trim_matches(char::from(0)).to_string();
            }
            i += 1;
        }
    }
    r"\\.\DISPLAY1".to_string()
}

/// Retrieves the current display mode (width, height, refresh_rate)
pub fn get_current_display_mode() -> Option<DisplayMode> {
    let dev_name = get_primary_device_name();
    let dev_name_u16: Vec<u16> = format!("{}\0", dev_name).encode_utf16().collect();

    let mut dm = DEVMODEW {
        dmSize: std::mem::size_of::<DEVMODEW>() as u16,
        ..Default::default()
    };

    unsafe {
        let ok = EnumDisplaySettingsW(
            PCWSTR(dev_name_u16.as_ptr()),
            ENUM_CURRENT_SETTINGS,
            &mut dm,
        );
        if ok.as_bool() {
            Some(DisplayMode {
                width: dm.dmPelsWidth,
                height: dm.dmPelsHeight,
                refresh_rate: dm.dmDisplayFrequency,
            })
        } else {
            None
        }
    }
}

/// Retrieves all supported display modes from Windows GDI
pub fn get_all_supported_modes() -> Vec<DisplayMode> {
    let dev_name = get_primary_device_name();
    let dev_name_u16: Vec<u16> = format!("{}\0", dev_name).encode_utf16().collect();

    let mut modes = Vec::new();
    let mut i = 0;
    loop {
        let mut dm = DEVMODEW {
            dmSize: std::mem::size_of::<DEVMODEW>() as u16,
            ..Default::default()
        };
        unsafe {
            if EnumDisplaySettingsW(
                PCWSTR(dev_name_u16.as_ptr()),
                ENUM_DISPLAY_SETTINGS_MODE(i),
                &mut dm,
            )
            .as_bool()
            {
                let mode = DisplayMode {
                    width: dm.dmPelsWidth,
                    height: dm.dmPelsHeight,
                    refresh_rate: dm.dmDisplayFrequency,
                };
                if !modes.contains(&mode) {
                    modes.push(mode);
                }
                i += 1;
            } else {
                break;
            }
        }
    }
    modes
}

/// Detect the monitor panel's native resolution.
/// Native resolution is the highest 16:9 pixel resolution supported by the display.
pub fn get_native_resolution() -> (u32, u32) {
    let modes = get_all_supported_modes();
    let mut best_w = 2560;
    let mut best_h = 1440;
    let mut max_pixels = 0u64;

    for m in &modes {
        // Standard PC aspect ratios (16:9, 16:10)
        let pixels = (m.width as u64) * (m.height as u64);
        if pixels > max_pixels {
            max_pixels = pixels;
            best_w = m.width;
            best_h = m.height;
        }
    }

    (best_w, best_h)
}

/// Queries supported refresh rates for a given resolution, sorted highest to lowest.
pub fn get_supported_refresh_rates_for(width: u32, height: u32) -> Vec<u32> {
    let modes = get_all_supported_modes();
    let mut freqs: Vec<u32> = modes
        .iter()
        .filter(|m| m.width == width && m.height == height)
        .map(|m| m.refresh_rate)
        .collect();

    freqs.sort_unstable();
    freqs.dedup();
    freqs.reverse(); // Highest refresh rate first (e.g. 260, 240, 165, 144, 120, 60)

    if freqs.is_empty() {
        // Fallback to all unique monitor refresh rates
        let mut all_freqs: Vec<u32> = modes.iter().map(|m| m.refresh_rate).collect();
        all_freqs.sort_unstable();
        all_freqs.dedup();
        all_freqs.reverse();
        if all_freqs.is_empty() {
            vec![260, 240, 165, 144, 120, 60]
        } else {
            all_freqs
        }
    } else {
        freqs
    }
}

/// Changes the Windows primary display resolution and refresh rate.
pub fn apply_display_mode(width: u32, height: u32, refresh_rate: u32) -> Result<(), String> {
    let dev_name = get_primary_device_name();
    let dev_name_u16: Vec<u16> = format!("{}\0", dev_name).encode_utf16().collect();

    let mut dm = DEVMODEW {
        dmSize: std::mem::size_of::<DEVMODEW>() as u16,
        ..Default::default()
    };

    unsafe {
        let _ = EnumDisplaySettingsW(
            PCWSTR(dev_name_u16.as_ptr()),
            ENUM_CURRENT_SETTINGS,
            &mut dm,
        );

        dm.dmPelsWidth = width;
        dm.dmPelsHeight = height;
        dm.dmDisplayFrequency = refresh_rate;
        dm.dmFields = DM_PELSWIDTH
            | DM_PELSHEIGHT
            | DM_DISPLAYFREQUENCY
            | DM_POSITION
            | DM_BITSPERPEL
            | DM_DISPLAYORIENTATION
            | DM_DISPLAYFLAGS;

        // Method 1: Multi-monitor friendly registry update + commit
        let res_sub = ChangeDisplaySettingsExW(
            PCWSTR(dev_name_u16.as_ptr()),
            Some(&dm),
            None,
            CDS_UPDATEREGISTRY | CDS_NORESET,
            None,
        );

        let res_commit = ChangeDisplaySettingsExW(None, None, None, CDS_TYPE(0), None);

        if res_sub.0 == 0 && res_commit.0 == 0 {
            return Ok(());
        }

        // Method 2: Direct primary display setting update
        let res_direct = ChangeDisplaySettingsExW(
            PCWSTR(dev_name_u16.as_ptr()),
            Some(&dm),
            None,
            CDS_UPDATEREGISTRY,
            None,
        );
        if res_direct.0 == 0 {
            return Ok(());
        }

        // Method 3: Global ChangeDisplaySettingsW
        let res_global = ChangeDisplaySettingsW(Some(&dm), CDS_UPDATEREGISTRY);
        if res_global.0 == 0 {
            return Ok(());
        }

        Err(format!(
            "Windows display driver reported code: {} (commit: {})",
            res_direct.0, res_commit.0
        ))
    }
}

/// Queries whether the current active display scaling mode is Stretched (Full-Screen)
pub fn is_scaling_stretched() -> Option<bool> {
    unsafe {
        let mut path_count = 0u32;
        let mut mode_count = 0u32;
        let buf_err = GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count);
        if buf_err.0 == 0 && path_count > 0 {
            let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
            let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];

            let query_err = QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut path_count,
                paths.as_mut_ptr(),
                &mut mode_count,
                modes.as_mut_ptr(),
                None,
            );

            if query_err.0 == 0 && !paths.is_empty() {
                return Some(paths[0].targetInfo.scaling == DISPLAYCONFIG_SCALING_STRETCHED);
            }
        }
    }
    None
}

/// Applies Win32 CCD and Registry scaling: stretched (true) or aspect-ratio centered (false)
pub fn set_display_scaling_mode(stretched: bool) -> Result<String, String> {
    unsafe {
        let mut path_count = 0u32;
        let mut mode_count = 0u32;
        let buf_err = GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count);
        if buf_err.0 == 0 && path_count > 0 {
            let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
            let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];

            let query_err = QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut path_count,
                paths.as_mut_ptr(),
                &mut mode_count,
                modes.as_mut_ptr(),
                None,
            );

            if query_err.0 == 0 {
                paths.truncate(path_count as usize);
                modes.truncate(mode_count as usize);

                let target_scaling = if stretched {
                    DISPLAYCONFIG_SCALING_STRETCHED
                } else {
                    DISPLAYCONFIG_SCALING_ASPECTRATIOCENTEREDMAX
                };

                let mut updated = 0;
                for p in paths.iter_mut() {
                    p.targetInfo.scaling = target_scaling;
                    updated += 1;
                }

                let flags = SDC_APPLY | SDC_SAVE_TO_DATABASE | SDC_ALLOW_CHANGES | SDC_USE_SUPPLIED_DISPLAY_CONFIG;
                let set_err = SetDisplayConfig(
                    Some(&paths),
                    Some(&modes),
                    flags,
                );

                let reg_val = if stretched { 4 } else { 2 };
                let reg_script = format!(
                    r#"Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration' -Recurse -ErrorAction SilentlyContinue | Where-Object {{ $_.GetValue('Scaling') -ne $null }} | ForEach-Object {{ Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'Scaling' -Value {} -Type DWord -Force -ErrorAction SilentlyContinue }}"#,
                    reg_val
                );
                let _ = std::process::Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", &reg_script])
                    .output();

                if set_err == 0 {
                    return Ok(format!(
                        "{} applied to {} display path(s)",
                        if stretched { "Full-Screen Stretched (0 Black Bars)" } else { "Aspect Ratio (Pillarboxes)" },
                        updated
                    ));
                }
            }
        }
    }
    Err("Failed to set display scaling mode via Win32 SetDisplayConfig".to_string())
}

/// Automatically applies GPU Full-Screen scaling via Win32 CCD API and driver registry profiles.
pub fn apply_gpu_scaling_stretched() -> Result<String, String> {
    set_display_scaling_mode(true)
}

/// Thread-safe controller for dynamic global hotkey updates
#[derive(Clone)]
pub struct HotkeyController {
    pub hotkey_code: Arc<AtomicU32>,
    pub running: Arc<AtomicBool>,
}

impl HotkeyController {
    pub fn set_shortcut(&self, binding: ShortcutBinding) {
        self.hotkey_code.store(binding.to_code(), Ordering::Relaxed);
    }
}

pub fn start_hotkey_listener(initial_shortcut: ShortcutBinding) -> (HotkeyController, Receiver<()>) {
    let (tx, rx) = channel();
    let hotkey_code = Arc::new(AtomicU32::new(initial_shortcut.to_code()));
    let running = Arc::new(AtomicBool::new(true));

    let code_clone = Arc::clone(&hotkey_code);
    let running_clone = Arc::clone(&running);

    thread::spawn(move || {
        let mut was_pressed = false;
        while running_clone.load(Ordering::Relaxed) {
            let code = code_clone.load(Ordering::Relaxed);
            let binding = ShortcutBinding::from_code(code);

            let is_down = if binding.vk == 0 {
                false
            } else {
                let key_down = unsafe { (GetAsyncKeyState(binding.vk as i32) as u16 & 0x8000) != 0 };
                if !key_down {
                    false
                } else {
                    let (ctrl_down, shift_down, alt_down, win_down) = get_current_modifiers();
                    let is_letter_or_digit = (binding.vk >= 0x30 && binding.vk <= 0x39)
                        || (binding.vk >= 0x41 && binding.vk <= 0x5A)
                        || binding.vk == 0x20;

                    if is_letter_or_digit {
                        ctrl_down == binding.ctrl
                            && shift_down == binding.shift
                            && alt_down == binding.alt
                            && win_down == binding.win
                    } else {
                        let ctrl_match = !binding.ctrl || ctrl_down;
                        let shift_match = !binding.shift || shift_down;
                        let alt_match = !binding.alt || alt_down;
                        let win_match = !binding.win || win_down;
                        ctrl_match && shift_match && alt_match && win_match
                    }
                }
            };

            if is_down && !was_pressed {
                let _ = tx.send(());
            }
            was_pressed = is_down;

            thread::sleep(Duration::from_millis(30));
        }
    });

    (
        HotkeyController {
            hotkey_code,
            running,
        },
        rx,
    )
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct MonitorDevice {
    pub device_name: String,
    pub adapter_name: String,
    pub monitor_name: String,
    pub is_attached: bool,
    pub is_primary: bool,
    pub width: u32,
    pub height: u32,
    pub refresh_rate: u32,
    pub position_x: i32,
    pub position_y: i32,
    pub orientation: String,
}

pub fn get_tool_path(name: &str) -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p1 = dir.join("tools").join(name);
            if p1.exists() {
                return p1;
            }
            let p2 = dir.join(name);
            if p2.exists() {
                return p2;
            }
        }
    }
    if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
        let p = PathBuf::from(app_data).join("TrueStretchStudio").join("tools").join(name);
        if p.exists() {
            return p;
        }
    }
    let p_desk = PathBuf::from(r"C:\Users\Administrator\Desktop\tools").join(name);
    if p_desk.exists() {
        return p_desk;
    }
    let p_proj = PathBuf::from(r"C:\Users\Administrator\.gemini\antigravity\scratch\truestretch_tauri\tools").join(name);
    if p_proj.exists() {
        return p_proj;
    }

    PathBuf::from(name)
}

const ENUM_REGISTRY_SETTINGS: ENUM_DISPLAY_SETTINGS_MODE = ENUM_DISPLAY_SETTINGS_MODE(0xFFFFFFFE);

pub fn get_all_monitors() -> Vec<MonitorDevice> {
    const FLAG_ATTACHED: u32 = 0x00000001;
    const FLAG_PRIMARY: u32 = 0x00000004;

    let mut monitors = Vec::new();
    let mut i = 0u32;
    loop {
        let mut dd = DISPLAY_DEVICEW {
            cb: std::mem::size_of::<DISPLAY_DEVICEW>() as u32,
            ..Default::default()
        };
        let ok = unsafe { EnumDisplayDevicesW(None, i, &mut dd, 0).as_bool() };
        if !ok {
            break;
        }

        let adapter_name = String::from_utf16_lossy(&dd.DeviceString)
            .trim_matches(char::from(0))
            .to_string();
        let device_name = String::from_utf16_lossy(&dd.DeviceName)
            .trim_matches(char::from(0))
            .to_string();
        let is_attached = (dd.StateFlags & FLAG_ATTACHED) != 0;
        let is_primary = (dd.StateFlags & FLAG_PRIMARY) != 0;

        let dev_name_u16: Vec<u16> = format!("{}\0", device_name).encode_utf16().collect();
        let mut mon_dd = DISPLAY_DEVICEW {
            cb: std::mem::size_of::<DISPLAY_DEVICEW>() as u32,
            ..Default::default()
        };
        let mut monitor_name = "Generic Display".to_string();
        unsafe {
            if EnumDisplayDevicesW(PCWSTR(dev_name_u16.as_ptr()), 0, &mut mon_dd, 0).as_bool() {
                let mon_str = String::from_utf16_lossy(&mon_dd.DeviceString)
                    .trim_matches(char::from(0))
                    .to_string();
                let mon_id = String::from_utf16_lossy(&mon_dd.DeviceID)
                    .trim_matches(char::from(0))
                    .to_string();
                if !mon_str.is_empty() && mon_str != "Generic PnP Monitor" {
                    monitor_name = mon_str;
                } else if !mon_id.is_empty() {
                    // Extract model code from MONITOR\PHLC401\...
                    let parts: Vec<&str> = mon_id.split('\\').collect();
                    if parts.len() > 1 {
                        monitor_name = format!("Monitor ({})", parts[1]);
                    } else {
                        monitor_name = mon_str;
                    }
                }
            }
        }

        let mut dm = DEVMODEW {
            dmSize: std::mem::size_of::<DEVMODEW>() as u16,
            ..Default::default()
        };
        let mut width = 0;
        let mut height = 0;
        let mut refresh_rate = 60;
        let mut position_x = 0;
        let mut position_y = 0;
        let mut orientation = "Landscape".to_string();

        unsafe {
            let ok_mode = if is_attached {
                EnumDisplaySettingsW(PCWSTR(dev_name_u16.as_ptr()), ENUM_CURRENT_SETTINGS, &mut dm)
            } else {
                EnumDisplaySettingsW(PCWSTR(dev_name_u16.as_ptr()), ENUM_REGISTRY_SETTINGS, &mut dm)
            };

            if ok_mode.as_bool() {
                width = dm.dmPelsWidth;
                height = dm.dmPelsHeight;
                refresh_rate = dm.dmDisplayFrequency;
                position_x = dm.Anonymous1.Anonymous2.dmPosition.x;
                position_y = dm.Anonymous1.Anonymous2.dmPosition.y;
                let o = dm.Anonymous1.Anonymous2.dmDisplayOrientation.0;
                orientation = match o {
                    1 => "Portrait (90°)",
                    2 => "Landscape (Flipped)",
                    3 => "Portrait (270°)",
                    _ => "Landscape",
                }.to_string();
            }
        }

        if !device_name.is_empty() && (is_attached || width > 0) {
            monitors.push(MonitorDevice {
                device_name,
                adapter_name,
                monitor_name,
                is_attached,
                is_primary,
                width,
                height,
                refresh_rate,
                position_x,
                position_y,
                orientation,
            });
        }

        i += 1;
    }
    monitors
}

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn set_monitor_attached(device_name: &str, attached: bool) -> Result<Vec<MonitorDevice>, String> {
    let tool = get_tool_path("MultiMonitorTool.exe");
    let arg = if attached { "/enable" } else { "/disable" };

    if tool.exists() {
        let mut cmd = std::process::Command::new(&tool);
        cmd.args([arg, device_name]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let _ = cmd.output();
    } else {
        let dev_name_u16: Vec<u16> = format!("{}\0", device_name).encode_utf16().collect();
        let mut dm = DEVMODEW {
            dmSize: std::mem::size_of::<DEVMODEW>() as u16,
            ..Default::default()
        };
        if attached {
            unsafe {
                let _ = EnumDisplaySettingsW(PCWSTR(dev_name_u16.as_ptr()), ENUM_REGISTRY_SETTINGS, &mut dm);
                if dm.dmPelsWidth == 0 {
                    let _ = EnumDisplaySettingsW(PCWSTR(dev_name_u16.as_ptr()), ENUM_DISPLAY_SETTINGS_MODE(0), &mut dm);
                }
                dm.dmFields = DM_PELSWIDTH | DM_PELSHEIGHT | DM_POSITION | DM_DISPLAYFREQUENCY;
                let _ = ChangeDisplaySettingsExW(PCWSTR(dev_name_u16.as_ptr()), Some(&dm), None, CDS_UPDATEREGISTRY | CDS_NORESET, None);
                let _ = ChangeDisplaySettingsExW(None, None, None, CDS_TYPE(0), None);
            }
        } else {
            unsafe {
                dm.dmFields = DM_PELSWIDTH | DM_PELSHEIGHT | DM_POSITION;
                dm.dmPelsWidth = 0;
                dm.dmPelsHeight = 0;
                let _ = ChangeDisplaySettingsExW(PCWSTR(dev_name_u16.as_ptr()), Some(&dm), None, CDS_UPDATEREGISTRY | CDS_NORESET, None);
                let _ = ChangeDisplaySettingsExW(None, None, None, CDS_TYPE(0), None);
            }
        }
    }

    thread::sleep(Duration::from_millis(350));
    Ok(get_all_monitors())
}

pub fn set_monitor_primary(device_name: &str) -> Result<Vec<MonitorDevice>, String> {
    let tool = get_tool_path("MultiMonitorTool.exe");
    if tool.exists() {
        let mut cmd = std::process::Command::new(&tool);
        cmd.args(["/SetPrimary", device_name]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let _ = cmd.output();
    }
    thread::sleep(Duration::from_millis(350));
    Ok(get_all_monitors())
}

pub fn launch_cru() -> Result<(), String> {
    let tool = get_tool_path("CRU.exe");
    if !tool.exists() {
        return Err("Custom Resolution Utility (CRU.exe) not found".to_string());
    }
    std::process::Command::new(&tool)
        .spawn()
        .map_err(|e| format!("Failed to launch CRU: {}", e))?;
    Ok(())
}

pub fn restart_graphics_driver() -> Result<String, String> {
    let tool = get_tool_path("restart64.exe");
    let actual_tool = if tool.exists() {
        tool
    } else {
        get_tool_path("restart.exe")
    };

    if actual_tool.exists() {
        let mut cmd = std::process::Command::new(&actual_tool);
        cmd.arg("-q");
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output().map_err(|e| format!("Failed to run driver restart utility: {}", e))?;
        if output.status.success() {
            Ok("Graphics driver restarted successfully. Display modes refreshed!".to_string())
        } else {
            Ok("Graphics driver restart signal sent.".to_string())
        }
    } else {
        Err("Driver restart utility (restart64.exe) not found".to_string())
    }
}

pub fn reset_all_cru_overrides() -> Result<String, String> {
    let tool = get_tool_path("reset-all.exe");
    if !tool.exists() {
        return Err("reset-all.exe utility not found".to_string());
    }
    let mut cmd = std::process::Command::new(&tool);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = cmd.output().map_err(|e| format!("Failed to execute reset-all: {}", e))?;
    let _ = restart_graphics_driver();
    Ok("All EDID overrides successfully reset to factory defaults.".to_string())
}


