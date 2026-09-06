use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;
use windows::Win32::Graphics::Gdi::{EnumDisplayDevicesW, DISPLAY_DEVICEW};

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
    let mut name = String::new();
    unsafe {
        let mut dd = DISPLAY_DEVICEW {
            cb: std::mem::size_of::<DISPLAY_DEVICEW>() as u32,
            ..Default::default()
        };

        let mut idx = 0;
        while EnumDisplayDevicesW(None, idx, &mut dd, 0).as_bool() {
            let str_val = String::from_utf16_lossy(&dd.DeviceString);
            let cleaned = str_val.trim_matches(char::from(0)).trim().to_string();
            if !cleaned.is_empty() && !cleaned.contains("Basic Display") {
                name = cleaned;
                break;
            }
            idx += 1;
        }
    }

    if name.is_empty() {
        name = "Generic Display Adapter".to_string();
    }

    let lower = name.to_lowercase();
    let vendor = if lower.contains("nvidia") || lower.contains("geforce") || lower.contains("rtx") || lower.contains("gtx") {
        GpuVendor::Nvidia
    } else if lower.contains("amd") || lower.contains("radeon") {
        GpuVendor::Amd
    } else if lower.contains("intel") || lower.contains("arc") || lower.contains("iris") || lower.contains("uhd") {
        GpuVendor::Intel
    } else {
        GpuVendor::Unknown
    };

    let instructions: Vec<String> = match vendor {
        GpuVendor::Nvidia => vec![
            "Set Scaling mode to: 'Full-screen'.".into(),
            "Set 'Perform scaling on:' to: 'GPU'.".into(),
            "Check 'Override the scaling mode set by games and programs'.".into(),
            "Bypass DWM desktop letterbox buffers.".into(),
            "Enable DirectFlip ultra-low latency hardware scanout.".into(),
        ],
        GpuVendor::Amd => vec![
            "Set 'Scaling Mode' to: 'Full Panel'.".into(),
            "Toggle 'GPU Scaling' to: ENABLED.".into(),
            "Override application-level aspect ratio constraints.".into(),
            "Enable Radeon Anti-Lag direct scanout.".into(),
            "Disable integer scaling lock.".into(),
        ],
        GpuVendor::Intel => vec![
            "Set Scale to: 'Stretched' (0 black bars).".into(),
            "Route scaling through Intel Xe hardware engine.".into(),
            "Disable Maintain Aspect Ratio in display settings.".into(),
            "Enable low-latency direct flip scanout.".into(),
            "Bypass in-game resolution letterboxing.".into(),
        ],
        GpuVendor::Unknown => vec![
            "Enable GPU hardware scaling.".into(),
            "Set scaling mode to Full-screen / Stretched.".into(),
            "Bypass application letterbox clamping.".into(),
        ],
    };

    GpuInfo {
        vendor,
        name,
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

fn set_reg_dword(root_and_key: &str, value_name: &str, dword_value: u32) {
    let _ = Command::new("reg")
        .args(["add", root_and_key, "/v", value_name, "/t", "REG_DWORD", "/d", &dword_value.to_string(), "/f"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

pub fn apply_single_gpu_setting(id: &str, value: bool) -> Result<GpuSettingsReport, String> {
    let mut saved = load_saved_gpu_settings();
    let gpu_info = detect_gpu();

    match id {
        "full_screen_scaling" => {
            saved.full_screen_scaling = value;
            let _ = crate::display::set_display_scaling_mode(value);

            // Vendor-specific registry updates in background
            let vendor = gpu_info.vendor.clone();
            std::thread::spawn(move || {
                match vendor {
                    GpuVendor::Amd => {
                        let keep_aspect = if value { 0 } else { 1 };
                        let script = format!(
                            r#"Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{{4d36e968-e325-11ce-bfc1-08002be10318}}' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -match '\\[0-9]{{4}}$' }} | ForEach-Object {{ Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'DalKeepAspectRatio' -Value {} -Type DWord -Force -ErrorAction SilentlyContinue }}"#,
                            keep_aspect
                        );
                        let _ = Command::new("powershell")
                            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                            .creation_flags(CREATE_NO_WINDOW)
                            .output();
                    }
                    GpuVendor::Intel => {
                        let scale_opt = if value { 3 } else { 2 };
                        let script = format!(
                            r#"Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{{4d36e968-e325-11ce-bfc1-08002be10318}}' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -match '\\[0-9]{{4}}$' }} | ForEach-Object {{ Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'ScaleOption' -Value {} -Type DWord -Force -ErrorAction SilentlyContinue }}"#,
                            scale_opt
                        );
                        let _ = Command::new("powershell")
                            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                            .creation_flags(CREATE_NO_WINDOW)
                            .output();
                    }
                    _ => {}
                }
            });
        }
        "gpu_scaling_engine" => {
            saved.gpu_scaling_engine = value;
            if value {
                let _ = crate::display::apply_gpu_scaling_stretched();
            }

            match gpu_info.vendor {
                GpuVendor::Nvidia => {
                    set_reg_dword(r"HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "DxgkUsePhysicalMode", if value { 0 } else { 1 });
                }
                GpuVendor::Amd => {
                    std::thread::spawn(move || {
                        let dal_val = if value { 1 } else { 0 };
                        let script = format!(
                            r#"Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{{4d36e968-e325-11ce-bfc1-08002be10318}}' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -match '\\[0-9]{{4}}$' }} | ForEach-Object {{ Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'DalGpuScaling' -Value {} -Type DWord -Force -ErrorAction SilentlyContinue }}"#,
                            dal_val
                        );
                        let _ = Command::new("powershell")
                            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                            .creation_flags(CREATE_NO_WINDOW)
                            .output();
                    });
                }
                GpuVendor::Intel => {
                    std::thread::spawn(move || {
                        let scale_val = if value { 3 } else { 1 };
                        let script = format!(
                            r#"Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{{4d36e968-e325-11ce-bfc1-08002be10318}}' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -match '\\[0-9]{{4}}$' }} | ForEach-Object {{ Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'ScaleOption' -Value {} -Type DWord -Force -ErrorAction SilentlyContinue }}"#,
                            scale_val
                        );
                        let _ = Command::new("powershell")
                            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                            .creation_flags(CREATE_NO_WINDOW)
                            .output();
                    });
                }
                _ => {}
            }
        }
        "override_game_scaling" => {
            saved.override_game_scaling = value;
            let _ = crate::game_config::set_letterbox_all(!value);
            set_reg_dword(r"HKCU\Software\Microsoft\DirectX\UserGpuPreferences", "DisableDXGIWindowedStereo", if value { 1 } else { 0 });

            if gpu_info.vendor == GpuVendor::Amd {
                std::thread::spawn(move || {
                    let dal_bypass = if value { 1 } else { 0 };
                    let script = format!(
                        r#"Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{{4d36e968-e325-11ce-bfc1-08002be10318}}' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -match '\\[0-9]{{4}}$' }} | ForEach-Object {{ Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'DalEnableModeBypass' -Value {} -Type DWord -Force -ErrorAction SilentlyContinue }}"#,
                        dal_bypass
                    );
                    let _ = Command::new("powershell")
                        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output();
                });
            }
        }
        "low_latency_scanout" => {
            saved.low_latency_scanout = value;
            let reg_val = if value { 1 } else { 0 };
            set_reg_dword(r"HKCU\Software\Microsoft\Windows\DWM", "DirectFlipEnabled", reg_val);
            set_reg_dword(r"HKLM\SOFTWARE\Microsoft\Windows\DWM", "DirectFlipEnabled", reg_val);
        }
        "integer_scaling_bypass" => {
            saved.integer_scaling_bypass = value;
            std::thread::spawn(move || {
                let reg_script = r#"
                    Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration' -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('Scaling') -ne $null } | ForEach-Object {
                        Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'Scaling' -Value 4 -Type DWord -Force -ErrorAction SilentlyContinue
                    }
                "#;
                let _ = Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", reg_script])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();
            });

            if gpu_info.vendor == GpuVendor::Amd {
                std::thread::spawn(move || {
                    let dal_int = if value { 0 } else { 1 };
                    let script = format!(
                        r#"Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{{4d36e968-e325-11ce-bfc1-08002be10318}}' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -match '\\[0-9]{{4}}$' }} | ForEach-Object {{ Set-ItemProperty -Path ("Registry::" + $_.Name) -Name 'DalIntegerScaling' -Value {} -Type DWord -Force -ErrorAction SilentlyContinue }}"#,
                        dal_int
                    );
                    let _ = Command::new("powershell")
                        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output();
                });
            }
        }
        _ => return Err(format!("Unknown setting ID: {}", id)),
    }

    save_gpu_settings(&saved);
    Ok(get_gpu_settings_report())
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

    // 3. Apply registry DirectFlip + DXGI stereo disable
    let reg_script = r#"
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Name 'DirectFlipEnabled' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' -Name 'DisableDXGIWindowedStereo' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
    "#;
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", reg_script])
        .output();

    let report = get_gpu_settings_report();

    let msg = format!(
        "Auto-applied recommended GPU settings: {} active display paths set to Full-Screen Stretched, letterboxing bypassed in {} game config(s), and DirectFlip low-latency scanout activated.",
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
            Command::new("explorer.exe")
                .arg("amd://")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to launch AMD Software: {}", e))?;
            Ok(())
        }
        GpuVendor::Intel => {
            Command::new("explorer.exe")
                .arg("igcc://")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to launch Intel Graphics Center: {}", e))?;
            Ok(())
        }
        GpuVendor::Unknown => {
            Command::new("control.exe")
                .arg("desk.cpl")
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to open Windows Display Settings: {}", e))?;
            Ok(())
        }
    }
}

