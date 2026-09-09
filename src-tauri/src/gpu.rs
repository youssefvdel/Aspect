use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;
use windows::Win32::Graphics::Gdi::{EnumDisplayDevicesW, DISPLAY_DEVICEW};
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE};
use winreg::RegKey;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum GpuVendor {
    Nvidia,
    Amd,
    Intel,
    Unknown,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct GpuInfo {
    pub vendor: GpuVendor,
    pub name: String,
    pub instructions: Vec<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct GpuSettingItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub badge: String,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct GpuSettingsReport {
    pub vendor: GpuVendor,
    pub name: String,
    pub settings: Vec<GpuSettingItem>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SavedGpuSettings {
    pub full_screen_scaling: bool,
    pub gpu_scaling_engine: bool,
    pub override_game_scaling: bool,
    pub low_latency_scanout: bool,
    pub integer_scaling_bypass: bool,
}

impl Default for SavedGpuSettings {
    fn default() -> Self {
        Self {
            full_screen_scaling: true,
            gpu_scaling_engine: true,
            override_game_scaling: true,
            low_latency_scanout: true,
            integer_scaling_bypass: true,
        }
    }
}

fn get_gpu_settings_path() -> Option<PathBuf> {
    if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
        let dir = PathBuf::from(app_data).join("TrueStretchStudio");
        let _ = fs::create_dir_all(&dir);
        Some(dir.join("gpu_settings.json"))
    } else {
        Some(PathBuf::from("gpu_settings.json"))
    }
}

pub fn load_saved_gpu_settings() -> SavedGpuSettings {
    if let Some(path) = get_gpu_settings_path() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(settings) = serde_json::from_str::<SavedGpuSettings>(&content) {
                return settings;
            }
        }
    }
    SavedGpuSettings::default()
}

pub fn save_gpu_settings(settings: &SavedGpuSettings) {
    if let Some(path) = get_gpu_settings_path() {
        if let Ok(content) = serde_json::to_string_pretty(settings) {
            let _ = fs::write(path, content);
        }
    }
}

pub fn detect_gpu() -> GpuInfo {
    let mut names: Vec<String> = Vec::new();
    unsafe {
        let mut dd = DISPLAY_DEVICEW {
            cb: std::mem::size_of::<DISPLAY_DEVICEW>() as u32,
            ..Default::default()
        };

        let mut idx = 0;
        while EnumDisplayDevicesW(None, idx, &mut dd, 0).as_bool() {
            let str_val = String::from_utf16_lossy(&dd.DeviceString);
            let cleaned = str_val.trim_matches(char::from(0)).trim().to_string();
            if !cleaned.is_empty() && !cleaned.contains("Basic Display") && !cleaned.contains("Basic Render") && !names.contains(&cleaned) {
                names.push(cleaned);
            }
            idx += 1;
        }
    }

    // Also inspect registry Class\{4d36e968-e325-11ce-bfc1-08002be10318} to ensure hybrid/all GPUs are found
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let class_path = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
    if let Ok(class_key) = hklm.open_subkey_with_flags(class_path, KEY_READ) {
        for i in 0..16 {
            let sub_name = format!("{:04}", i);
            if let Ok(sub_key) = class_key.open_subkey_with_flags(&sub_name, KEY_READ) {
                if let Ok(desc) = sub_key.get_value::<String, _>("DriverDesc") {
                    let cleaned = desc.trim().to_string();
                    if !cleaned.is_empty() && !cleaned.contains("Basic Display") && !cleaned.contains("Basic Render") && !names.contains(&cleaned) {
                        names.push(cleaned);
                    }
                }
            }
        }
    }

    let classify = |s: &str| -> GpuVendor {
        let lower = s.to_lowercase();
        if lower.contains("nvidia") || lower.contains("geforce") || lower.contains("rtx") || lower.contains("gtx") || lower.contains("quadro") {
            GpuVendor::Nvidia
        } else if lower.contains("amd") || lower.contains("radeon") || lower.contains("advanced micro devices") || lower.contains("ati") {
            GpuVendor::Amd
        } else if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
            GpuVendor::Intel
        } else {
            GpuVendor::Unknown
        }
    };

    // Prioritize discrete GPUs (RTX/GTX/Radeon RX/Arc) over integrated GPUs for the main badge
    let primary_idx = names.iter().position(|n| {
        let l = n.to_lowercase();
        (l.contains("geforce") || l.contains("rtx") || l.contains("gtx") || (l.contains("radeon") && (l.contains("rx") || l.contains("xt") || l.contains("pro")))) && !l.contains("graphics")
    }).unwrap_or(0);

    let primary_name = if !names.is_empty() { names[primary_idx].clone() } else { "Generic Display Adapter".to_string() };
    let vendor = classify(&primary_name);

    let display_name = if names.len() > 1 {
        let others: Vec<_> = names.iter().enumerate().filter(|(i, _)| *i != primary_idx).map(|(_, n)| n.as_str()).collect();
        format!("{} (+ {})", primary_name, others.join(", "))
    } else {
        primary_name
    };

    let mut instructions: Vec<String> = match vendor {
        GpuVendor::Nvidia => vec![
            "Set Scaling mode to: 'Full-screen'.".into(),
            "Set 'Perform scaling on:' to: 'GPU'.".into(),
            "Check 'Override the scaling mode set by games and programs'.".into(),
            "Bypass DWM desktop letterbox buffers.".into(),
            "Enable DirectFlip ultra-low latency hardware scanout.".into(),
        ],
        GpuVendor::Amd => vec![
            "Set 'Scaling Mode' to: 'Full Panel'.".into(),
            "Toggle 'GPU Scaling' to: ENABLED (DalGpuScaling).".into(),
            "Override application-level aspect ratio constraints (DalEnableModeBypass).".into(),
            "DalKeepAspectRatio set to 0 (Full Panel stretched).".into(),
            "Automatic custom mode injection active via DalNonStandardModesBCD.".into(),
        ],
        GpuVendor::Intel => vec![
            "Set Scale to: 'Scale Full Screen / Stretched' (ScaleOption=3).".into(),
            "Route scaling through Intel Xe / Arc hardware engine.".into(),
            "ReadEDIDFromRegistry enabled for custom resolution recognition.".into(),
            "Bypass in-game resolution letterboxing (bShouldLetterbox=False).".into(),
            "MaintainAspectRatio set to 0 (0 black bars).".into(),
        ],
        GpuVendor::Unknown => vec![
            "Enable GPU hardware scaling.".into(),
            "Set scaling mode to Full-screen / Stretched.".into(),
            "Bypass application letterbox clamping.".into(),
        ],
    };

    if names.len() > 1 {
        instructions.push("Multi-GPU system detected: Scaling and custom modes configured across all adapters.".into());
    }

    GpuInfo {
        vendor,
        name: display_name,
        instructions,
    }
}

pub fn get_gpu_settings_report() -> GpuSettingsReport {
    let gpu_info = detect_gpu();
    let saved = load_saved_gpu_settings();

    let settings = match gpu_info.vendor {
        GpuVendor::Nvidia => vec![
            GpuSettingItem {
                id: "full_screen_scaling".into(),
                name: "Full-Screen Hardware Scaling (0 Black Bars)".into(),
                description: "Forces RTX hardware display pipe to stretch custom 1.45:1 resolutions to panel borders with zero black bars.".into(),
                enabled: saved.full_screen_scaling,
                badge: "Win32 CCD • Full-Screen".into(),
            },
            GpuSettingItem {
                id: "gpu_scaling_engine".into(),
                name: "Perform Scaling on: GPU".into(),
                description: "Offloads image expansion to RTX hardware scanout pipeline instead of monitor display scalar.".into(),
                enabled: saved.gpu_scaling_engine,
                badge: "NVIDIA Hardware Scaler".into(),
            },
            GpuSettingItem {
                id: "override_game_scaling".into(),
                name: "Override Scaling Mode Set by Games & Programs".into(),
                description: "Forces driver-level stretched scanout over in-game letterbox enforcement (sets bShouldLetterbox=False).".into(),
                enabled: saved.override_game_scaling,
                badge: "Driver Scanout Priority".into(),
            },
            GpuSettingItem {
                id: "low_latency_scanout".into(),
                name: "Ultra-Low Latency Direct Scanout Engine".into(),
                description: "Bypasses DWM windowed presentation buffer, enabling 0.0 ms DirectFlip scanout with zero delay.".into(),
                enabled: saved.low_latency_scanout,
                badge: "DirectFlip Scanout".into(),
            },
            GpuSettingItem {
                id: "integer_scaling_bypass".into(),
                name: "Bypass Integer Scaling Aspect Lock".into(),
                description: "Prevents fixed-pixel integer scaling clamps, allowing arbitrary golden-ratio custom resolutions.".into(),
                enabled: saved.integer_scaling_bypass,
                badge: "Uncapped Aspect Ratio".into(),
            },
        ],
        GpuVendor::Amd => vec![
            GpuSettingItem {
                id: "full_screen_scaling".into(),
                name: "AMD Full Panel Scaling (0 Black Bars)".into(),
                description: "Stretches custom resolutions to panel borders with zero black pillarbox bars.".into(),
                enabled: saved.full_screen_scaling,
                badge: "AMD Full Panel".into(),
            },
            GpuSettingItem {
                id: "gpu_scaling_engine".into(),
                name: "Radeon GPU Scaling Engine".into(),
                description: "Enforces Radeon GPU hardware scaling over monitor display timing.".into(),
                enabled: saved.gpu_scaling_engine,
                badge: "Adrenalin Hardware".into(),
            },
            GpuSettingItem {
                id: "override_game_scaling".into(),
                name: "Override In-Game Scaling & Letterboxing".into(),
                description: "Prevents game engines from enforcing black letterbox borders on stretched modes.".into(),
                enabled: saved.override_game_scaling,
                badge: "Driver Priority".into(),
            },
            GpuSettingItem {
                id: "low_latency_scanout".into(),
                name: "Radeon Anti-Lag Direct Scanout Engine".into(),
                description: "Bypasses desktop composition buffers for direct zero-latency frame scanout.".into(),
                enabled: saved.low_latency_scanout,
                badge: "Anti-Lag Scanout".into(),
            },
            GpuSettingItem {
                id: "integer_scaling_bypass".into(),
                name: "Integer Scaling Restriction Bypass".into(),
                description: "Disables integer scaling lock to permit smooth 1.45:1 golden ratio expansion.".into(),
                enabled: saved.integer_scaling_bypass,
                badge: "Smooth Stretch".into(),
            },
        ],
        GpuVendor::Intel => vec![
            GpuSettingItem {
                id: "full_screen_scaling".into(),
                name: "Intel Stretched Display Scaling (0 Black Bars)".into(),
                description: "Expands custom 1.45:1 stretched resolutions across 100% of panel area.".into(),
                enabled: saved.full_screen_scaling,
                badge: "Intel Stretched".into(),
            },
            GpuSettingItem {
                id: "gpu_scaling_engine".into(),
                name: "Intel Graphics Hardware Scaler".into(),
                description: "Routes display stretching through Intel Xe display engine circuitry.".into(),
                enabled: saved.gpu_scaling_engine,
                badge: "Xe Scaler".into(),
            },
            GpuSettingItem {
                id: "override_game_scaling".into(),
                name: "Override Application Scaling Restrictions".into(),
                description: "Bypasses in-game letterboxing enforcement and disables aspect ratio constraints.".into(),
                enabled: saved.override_game_scaling,
                badge: "Bypass Letterbox".into(),
            },
            GpuSettingItem {
                id: "low_latency_scanout".into(),
                name: "Intel Low-Latency Scanout Engine".into(),
                description: "Eliminates DWM letterbox buffer and forces hardware flip presentation.".into(),
                enabled: saved.low_latency_scanout,
                badge: "DirectFlip".into(),
            },
            GpuSettingItem {
                id: "integer_scaling_bypass".into(),
                name: "Maintain Aspect Ratio Override".into(),
                description: "Turns off aspect ratio lock to allow full horizontal stretched scanout.".into(),
                enabled: saved.integer_scaling_bypass,
                badge: "Fill Panel".into(),
            },
        ],
        GpuVendor::Unknown => vec![
            GpuSettingItem {
                id: "full_screen_scaling".into(),
                name: "Full-Screen Hardware Scaling (0 Black Bars)".into(),
                description: "Applies Win32 CCD stretched scaling and sets driver registry scaling to Full-Screen (4).".into(),
                enabled: saved.full_screen_scaling,
                badge: "Win32 CCD".into(),
            },
            GpuSettingItem {
                id: "gpu_scaling_engine".into(),
                name: "GPU Hardware Scaling Engine".into(),
                description: "Enforces GPU display pipe timing instead of display monitor scalar.".into(),
                enabled: saved.gpu_scaling_engine,
                badge: "GPU Scanout".into(),
            },
            GpuSettingItem {
                id: "override_game_scaling".into(),
                name: "Override Scaling Mode Set by Games & Programs".into(),
                description: "Sets bShouldLetterbox=False across all game config files and overrides DXGI scaling.".into(),
                enabled: saved.override_game_scaling,
                badge: "Game Bypass".into(),
            },
            GpuSettingItem {
                id: "low_latency_scanout".into(),
                name: "Ultra-Low Latency Direct Scanout Engine".into(),
                description: "Configures DWM direct flip queue for zero scanout latency.".into(),
                enabled: saved.low_latency_scanout,
                badge: "DirectFlip".into(),
            },
            GpuSettingItem {
                id: "integer_scaling_bypass".into(),
                name: "Bypass Fixed Aspect Ratio Restrictions".into(),
                description: "Disables aspect ratio locks to allow custom stretched resolutions to fill the panel.".into(),
                enabled: saved.integer_scaling_bypass,
                badge: "Fill Panel".into(),
            },
        ],
    };

    GpuSettingsReport {
        vendor: gpu_info.vendor,
        name: gpu_info.name,
        settings,
    }
}

fn set_hklm_dword(subkey_path: &str, value_name: &str, val: u32) {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok((key, _)) = hklm.create_subkey(subkey_path) {
        let _ = key.set_value(value_name, &val);
    }
}

fn set_hkcu_dword(subkey_path: &str, value_name: &str, val: u32) {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(subkey_path) {
        let _ = key.set_value(value_name, &val);
    }
}

fn apply_scaling_recursive(key: &RegKey, scaling_val: u32) {
    if let Ok(_) = key.get_value::<u32, _>("Scaling") {
        let _ = key.set_value("Scaling", &scaling_val);
    }
    for sub in key.enum_keys().filter_map(|k| k.ok()) {
        if let Ok(sub_key) = key.open_subkey_with_flags(&sub, KEY_READ | KEY_SET_VALUE) {
            apply_scaling_recursive(&sub_key, scaling_val);
        }
    }
}

pub fn apply_to_all_gpu_adapters<F>(mut f: F)
where
    F: FnMut(&str, &str, &RegKey),
{
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let class_path = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
    if let Ok(class_key) = hklm.open_subkey_with_flags(class_path, KEY_READ) {
        for i in 0..16 {
            let sub_name = format!("{:04}", i);
            if let Ok(sub_key) = class_key.open_subkey_with_flags(&sub_name, KEY_READ | KEY_SET_VALUE) {
                let desc: String = sub_key.get_value("DriverDesc").unwrap_or_default();
                let prov: String = sub_key.get_value("ProviderName").unwrap_or_default();
                f(&desc, &prov, &sub_key);
            }
        }
    }
}

pub fn apply_single_gpu_setting(id: &str, value: bool) -> Result<GpuSettingsReport, String> {
    let mut saved = load_saved_gpu_settings();

    match id {
        "full_screen_scaling" => {
            saved.full_screen_scaling = value;
            let _ = crate::display::set_display_scaling_mode(value);

            apply_to_all_gpu_adapters(|desc, prov, sub_key| {
                let lower = format!("{} {}", prov, desc).to_lowercase();
                if lower.contains("amd") || lower.contains("radeon") || lower.contains("advanced micro devices") || lower.contains("ati") {
                    let _ = sub_key.set_value("DalKeepAspectRatio", &if value { 0u32 } else { 1u32 });
                    let _ = sub_key.set_value("DalScaleRule", &0u32);
                } else if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
                    let _ = sub_key.set_value("ScaleOption", &if value { 3u32 } else { 2u32 });
                }
            });

            // Set global WDDM scaling in GraphicsDrivers\Configuration
            let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
            if let Ok(config_root) = hklm.open_subkey_with_flags(r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration", KEY_READ | KEY_SET_VALUE) {
                apply_scaling_recursive(&config_root, if value { 4 } else { 2 });
            }
        }
        "gpu_scaling_engine" => {
            saved.gpu_scaling_engine = value;
            if value {
                let _ = crate::display::apply_gpu_scaling_stretched();
            }

            set_hklm_dword(r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "DxgkUsePhysicalMode", if value { 0 } else { 1 });

            apply_to_all_gpu_adapters(|desc, prov, sub_key| {
                let lower = format!("{} {}", prov, desc).to_lowercase();
                if lower.contains("amd") || lower.contains("radeon") || lower.contains("advanced micro devices") || lower.contains("ati") {
                    let _ = sub_key.set_value("DalGpuScaling", &if value { 1u32 } else { 0u32 });
                    let _ = sub_key.set_value("DalScaleRule", &0u32);
                } else if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
                    let _ = sub_key.set_value("ScaleOption", &if value { 3u32 } else { 1u32 });
                    let _ = sub_key.set_value("ReadEDIDFromRegistry", &1u32);
                }
            });
        }
        "override_game_scaling" => {
            saved.override_game_scaling = value;
            let _ = crate::game_config::set_letterbox_all(!value);
            set_hkcu_dword(r"Software\Microsoft\DirectX\UserGpuPreferences", "DisableDXGIWindowedStereo", if value { 1 } else { 0 });

            apply_to_all_gpu_adapters(|desc, prov, sub_key| {
                let lower = format!("{} {}", prov, desc).to_lowercase();
                if lower.contains("amd") || lower.contains("radeon") || lower.contains("advanced micro devices") || lower.contains("ati") {
                    let _ = sub_key.set_value("DalEnableModeBypass", &if value { 1u32 } else { 0u32 });
                } else if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
                    let _ = sub_key.set_value("DisableLetterboxing", &if value { 1u32 } else { 0u32 });
                    let _ = sub_key.set_value("MaintainAspectRatio", &0u32);
                }
            });
        }
        "low_latency_scanout" => {
            saved.low_latency_scanout = value;
            let reg_val = if value { 1 } else { 0 };
            set_hkcu_dword(r"Software\Microsoft\Windows\DWM", "DirectFlipEnabled", reg_val);
            set_hklm_dword(r"SOFTWARE\Microsoft\Windows\DWM", "DirectFlipEnabled", reg_val);
        }
        "integer_scaling_bypass" => {
            saved.integer_scaling_bypass = value;
            let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
            if let Ok(config_root) = hklm.open_subkey_with_flags(r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration", KEY_READ | KEY_SET_VALUE) {
                apply_scaling_recursive(&config_root, 4);
            }

            apply_to_all_gpu_adapters(|desc, prov, sub_key| {
                let lower = format!("{} {}", prov, desc).to_lowercase();
                if lower.contains("amd") || lower.contains("radeon") || lower.contains("advanced micro devices") || lower.contains("ati") {
                    let _ = sub_key.set_value("DalIntegerScaling", &if value { 0u32 } else { 1u32 });
                } else if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
                    let _ = sub_key.set_value("MaintainAspectRatio", &if value { 0u32 } else { 1u32 });
                }
            });
        }
        _ => return Err(format!("Unknown setting ID: {}", id)),
    }

    save_gpu_settings(&saved);
    Ok(get_gpu_settings_report())
}

/// Applies vendor-tailored GPU scaling ONLY for the active GPU vendor:
/// - NVIDIA: nvlddmkm DisplayDatabase ScalingConfig (Full-screen + GPU scaling)
/// - AMD: DalKeepAspectRatio=0 (Full Panel), DalGpuScaling=1, DalScaleRule=0, DalIntegerScaling=0
/// - Intel: ScaleOption=3 (Scale Full Screen), MaintainAspectRatio=0
/// - Win32: SetDisplayConfig CCD stretched mode
pub fn apply_gpu_scaling_for_active_vendor(stretched: bool) {
    let gpu_info = detect_gpu();

    // 1. Win32 CCD (Universal OS display scaling)
    let _ = crate::display::set_display_scaling_mode(stretched);

    // 2. Vendor-specific driver adjustment ONLY for the detected active vendor
    match gpu_info.vendor {
        GpuVendor::Nvidia => {
            let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
            let nv_base = r"SYSTEM\CurrentControlSet\Services\nvlddmkm\State\DisplayDatabase";
            if let Ok(nv_key) = hklm.open_subkey_with_flags(nv_base, KEY_READ | KEY_SET_VALUE) {
                for sub in nv_key.enum_keys().filter_map(|k| k.ok()) {
                    if let Ok(sub_key) = nv_key.open_subkey_with_flags(&sub, KEY_READ | KEY_SET_VALUE) {
                        if let Ok(mut val) = sub_key.get_raw_value("ScalingConfig") {
                            if val.bytes.len() >= 16 {
                                val.bytes[8] = if stretched { 0x02 } else { 0x01 };
                                val.bytes[9] = 0x01;
                                val.bytes[10] = 0x01;
                                val.bytes[12] = 0xf1;
                                let _ = sub_key.set_raw_value("ScalingConfig", &val);
                            }
                        }
                    }
                }
            }
        }
        GpuVendor::Amd => {
            apply_to_all_gpu_adapters(|desc, prov, sub_key| {
                let lower = format!("{} {}", prov, desc).to_lowercase();
                if lower.contains("amd") || lower.contains("radeon") || lower.contains("advanced micro devices") || lower.contains("ati") {
                    let _ = sub_key.set_value("DalKeepAspectRatio", &if stretched { 0u32 } else { 1u32 });
                    let _ = sub_key.set_value("DalGpuScaling", &1u32);
                    let _ = sub_key.set_value("DalScaleRule", &0u32);
                    let _ = sub_key.set_value("DalIntegerScaling", &0u32);
                    let _ = sub_key.set_value("DalEnableModeBypass", &1u32);
                }
            });
        }
        GpuVendor::Intel => {
            apply_to_all_gpu_adapters(|desc, prov, sub_key| {
                let lower = format!("{} {}", prov, desc).to_lowercase();
                if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
                    let _ = sub_key.set_value("ScaleOption", &if stretched { 3u32 } else { 2u32 });
                    let _ = sub_key.set_value("MaintainAspectRatio", &if stretched { 0u32 } else { 1u32 });
                }
            });
        }
        GpuVendor::Unknown => {}
    }
}

/// Enforces Full-Screen Stretched scaling across Win32 CCD, WDDM, NVIDIA driver database, and AMD/Intel keys.
pub fn enforce_all_gpu_scaling() {
    apply_gpu_scaling_for_active_vendor(true);
}

pub fn auto_configure_all_gpu_settings() -> Result<(String, GpuSettingsReport), String> {
    let saved = SavedGpuSettings {
        full_screen_scaling: true,
        gpu_scaling_engine: true,
        override_game_scaling: true,
        low_latency_scanout: true,
        integer_scaling_bypass: true,
    };
    save_gpu_settings(&saved);

    // 1. Win32 CCD Stretched
    let ccd_res = crate::display::apply_gpu_scaling_stretched().unwrap_or_else(|_| "Full-Screen scaling applied".into());

    // 2. Disable letterboxing across all configs
    let config_count = crate::game_config::set_letterbox_all(false).unwrap_or(0);

    // 3. Set DirectFlip + DXGI stereo disable via pure native winreg
    set_hkcu_dword(r"Software\Microsoft\Windows\DWM", "DirectFlipEnabled", 1);
    set_hklm_dword(r"SOFTWARE\Microsoft\Windows\DWM", "DirectFlipEnabled", 1);
    set_hkcu_dword(r"Software\Microsoft\DirectX\UserGpuPreferences", "DisableDXGIWindowedStereo", 1);
    set_hklm_dword(r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "DxgkUsePhysicalMode", 0);

    // 4. Set global WDDM scaling in GraphicsDrivers\Configuration
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(config_root) = hklm.open_subkey_with_flags(r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration", KEY_READ | KEY_SET_VALUE) {
        apply_scaling_recursive(&config_root, 4);
    }

    // 5. Configure all GPU adapter keys (NVIDIA, AMD, Intel)
    apply_to_all_gpu_adapters(|desc, prov, sub_key| {
        let lower = format!("{} {}", prov, desc).to_lowercase();
        if lower.contains("amd") || lower.contains("radeon") || lower.contains("advanced micro devices") || lower.contains("ati") {
            let _ = sub_key.set_value("DalKeepAspectRatio", &0u32);
            let _ = sub_key.set_value("DalGpuScaling", &1u32);
            let _ = sub_key.set_value("DalEnableModeBypass", &1u32);
            let _ = sub_key.set_value("DalScaleRule", &0u32);
            let _ = sub_key.set_value("DalIntegerScaling", &0u32);
        } else if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
            let _ = sub_key.set_value("ScaleOption", &3u32);
            let _ = sub_key.set_value("ReadEDIDFromRegistry", &1u32);
            let _ = sub_key.set_value("CustomModeAllowed", &1u32);
            let _ = sub_key.set_value("EnableCustomResolutions", &1u32);
            let _ = sub_key.set_value("MaintainAspectRatio", &0u32);
            let _ = sub_key.set_value("DisableLetterboxing", &1u32);
        }
    });

    let report = get_gpu_settings_report();

    let msg = format!(
        "Auto-applied recommended GPU settings: {} active display paths set to Full-Screen Stretched across all GPU adapters (NVIDIA/AMD/Intel), letterboxing bypassed in {} game config(s), and DirectFlip low-latency scanout activated.",
        ccd_res, config_count
    );

    Ok((msg, report))
}

pub fn launch_control_panel(vendor: &GpuVendor) -> Result<(), String> {
    match vendor {
        GpuVendor::Nvidia => {
            let paths = [
                r"C:\Program Files\NVIDIA Corporation\Control Panel Client\nvcplui.exe",
                r"C:\Windows\System32\nvcplui.exe",
            ];
            for path in &paths {
                if std::path::Path::new(path).exists() {
                    let _ = Command::new(path)
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();
                    return Ok(());
                }
            }
            Command::new("control.exe")
                .arg("/name")
                .arg("Microsoft.NVIDIAControlPanel")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to launch NVIDIA Control Panel: {}", e))?;
            Ok(())
        }
        GpuVendor::Amd => {
            let paths = [
                r"C:\Program Files\AMD\CNext\CNext\RadeonSoftware.exe",
                r"C:\Program Files\AMD\CNext\CNext\cncmd.exe",
            ];
            for path in &paths {
                if std::path::Path::new(path).exists() {
                    let _ = Command::new(path)
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();
                    return Ok(());
                }
            }
            Command::new("explorer.exe")
                .arg("amd://")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to launch AMD Software: {}", e))?;
            Ok(())
        }
        GpuVendor::Intel => {
            let paths = [
                r"C:\Program Files\Intel\Intel Graphics Command Center\IGCC.exe",
            ];
            for path in &paths {
                if std::path::Path::new(path).exists() {
                    let _ = Command::new(path)
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();
                    return Ok(());
                }
            }
            Command::new("explorer.exe")
                .arg("igcc://")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to launch Intel Graphics Center: {}", e))?;
            Ok(())
        }
        GpuVendor::Unknown => {
            Command::new("explorer.exe")
                .arg("ms-settings:display")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to open Windows Display Settings: {}", e))?;
            Ok(())
        }
    }
}

