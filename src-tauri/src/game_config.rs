use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ConfigFileInfo {
    pub path: PathBuf,
    pub display_name: String,
    pub is_read_only: bool,
    pub fullscreen_mode: Option<u32>,
    pub should_letterbox: Option<bool>,
    pub res_x: Option<u32>,
    pub res_y: Option<u32>,
}

pub fn find_valorant_configs() -> Vec<ConfigFileInfo> {
    let mut configs = Vec::new();
    let local_app_data = match std::env::var("LOCALAPPDATA") {
        Ok(val) => PathBuf::from(val),
        Err(_) => return configs,
    };

    let base_config_dir = local_app_data.join("VALORANT").join("Saved").join("Config");
    if !base_config_dir.exists() {
        return configs;
    }

    // Search recursively for GameUserSettings.ini
    let mut dirs_to_visit = vec![base_config_dir];
    while let Some(current_dir) = dirs_to_visit.pop() {
        if let Ok(entries) = fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    dirs_to_visit.push(path);
                } else if path.file_name().and_then(|n| n.to_str()) == Some("GameUserSettings.ini") {
                    if let Some(info) = parse_config(&path) {
                        configs.push(info);
                    }
                }
            }
        }
    }

    configs
}

fn parse_config(path: &Path) -> Option<ConfigFileInfo> {
    let metadata = fs::metadata(path).ok()?;
    let is_read_only = metadata.permissions().readonly();

    let mut content = String::new();
    let mut file = File::open(path).ok()?;
    let _ = file.read_to_string(&mut content);

    let mut fullscreen_mode = None;
    let mut should_letterbox = None;
    let mut res_x = None;
    let mut res_y = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("FullscreenMode=") {
            fullscreen_mode = trimmed.trim_start_matches("FullscreenMode=").parse::<u32>().ok();
        } else if trimmed.starts_with("bShouldLetterbox=") {
            let val = trimmed.trim_start_matches("bShouldLetterbox=");
            should_letterbox = Some(val.eq_ignore_ascii_case("true"));
        } else if trimmed.starts_with("ResolutionSizeX=") {
            res_x = trimmed.trim_start_matches("ResolutionSizeX=").parse::<u32>().ok();
        } else if trimmed.starts_with("ResolutionSizeY=") {
            res_y = trimmed.trim_start_matches("ResolutionSizeY=").parse::<u32>().ok();
        }
    }

    let parent_folder = path
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let display_name = if parent_folder == "Config" {
        "Global Default Settings (WindowsClient)".to_string()
    } else if !parent_folder.is_empty() {
        format!("Player Account Profile ({})", &parent_folder[..parent_folder.len().min(8)])
    } else {
        "Valorant Client Settings".to_string()
    };

    Some(ConfigFileInfo {
        path: path.to_path_buf(),
        display_name,
        is_read_only,
        fullscreen_mode,
        should_letterbox,
        res_x,
        res_y,
    })
}

pub fn update_config(
    path: &Path,
    set_windowed_and_fill: bool,
    new_res: Option<(u32, u32)>,
    lock_read_only: bool,
) -> Result<(), String> {
    // 1. If read-only, temporarily unlock to edit
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let mut perms = meta.permissions();
    if perms.readonly() {
        perms.set_readonly(false);
        fs::set_permissions(path, perms.clone()).map_err(|e| e.to_string())?;
    }

    // 2. Read and modify lines
    let mut content = String::new();
    {
        let mut file = File::open(path).map_err(|e| e.to_string())?;
        file.read_to_string(&mut content).map_err(|e| e.to_string())?;
    }

    let mut new_lines = Vec::new();
    let mut found_fullscreen_mode = false;
    let mut found_last_confirmed_fullscreen = false;
    let mut found_preferred_fullscreen = false;
    let mut found_letterbox = false;
    let mut found_last_letterbox = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if set_windowed_and_fill && trimmed.starts_with("FullscreenMode=") {
            new_lines.push("FullscreenMode=2".to_string());
            found_fullscreen_mode = true;
        } else if set_windowed_and_fill && trimmed.starts_with("LastConfirmedFullscreenMode=") {
            new_lines.push("LastConfirmedFullscreenMode=2".to_string());
            found_last_confirmed_fullscreen = true;
        } else if set_windowed_and_fill && trimmed.starts_with("PreferredFullscreenMode=") {
            new_lines.push("PreferredFullscreenMode=2".to_string());
            found_preferred_fullscreen = true;
        } else if set_windowed_and_fill && trimmed.starts_with("bShouldLetterbox=") {
            new_lines.push("bShouldLetterbox=False".to_string());
            found_letterbox = true;
        } else if set_windowed_and_fill && trimmed.starts_with("bLastConfirmedShouldLetterbox=") {
            new_lines.push("bLastConfirmedShouldLetterbox=False".to_string());
            found_last_letterbox = true;
        } else if let Some((w, h)) = new_res {
            if trimmed.starts_with("ResolutionSizeX=") {
                new_lines.push(format!("ResolutionSizeX={}", w));
            } else if trimmed.starts_with("ResolutionSizeY=") {
                new_lines.push(format!("ResolutionSizeY={}", h));
            } else if trimmed.starts_with("LastUserConfirmedResolutionSizeX=") {
                new_lines.push(format!("LastUserConfirmedResolutionSizeX={}", w));
            } else if trimmed.starts_with("LastUserConfirmedResolutionSizeY=") {
                new_lines.push(format!("LastUserConfirmedResolutionSizeY={}", h));
            } else if trimmed.starts_with("DesiredScreenWidth=") {
                new_lines.push(format!("DesiredScreenWidth={}", w));
            } else if trimmed.starts_with("DesiredScreenHeight=") {
                new_lines.push(format!("DesiredScreenHeight={}", h));
            } else if trimmed.starts_with("LastUserConfirmedDesiredScreenWidth=") {
                new_lines.push(format!("LastUserConfirmedDesiredScreenWidth={}", w));
            } else if trimmed.starts_with("LastUserConfirmedDesiredScreenHeight=") {
                new_lines.push(format!("LastUserConfirmedDesiredScreenHeight={}", h));
            } else {
                new_lines.push(line.to_string());
            }
        } else {
            new_lines.push(line.to_string());
        }
    }

    // If keys were not found, ensure they are inserted under ShooterGameUserSettings
    if set_windowed_and_fill {
        let mut final_lines = Vec::new();
        let mut inserted = false;
        for line in new_lines {
            final_lines.push(line.clone());
            if !inserted && line.trim() == "[/Script/ShooterGame.ShooterGameUserSettings]" {
                if !found_fullscreen_mode {
                    final_lines.push("FullscreenMode=2".to_string());
                }
                if !found_last_confirmed_fullscreen {
                    final_lines.push("LastConfirmedFullscreenMode=2".to_string());
                }
                if !found_preferred_fullscreen {
                    final_lines.push("PreferredFullscreenMode=2".to_string());
                }
                if !found_letterbox {
                    final_lines.push("bShouldLetterbox=False".to_string());
                }
                if !found_last_letterbox {
                    final_lines.push("bLastConfirmedShouldLetterbox=False".to_string());
                }
                if let Some((w, h)) = new_res {
                    final_lines.push(format!("ResolutionSizeX={}", w));
                    final_lines.push(format!("ResolutionSizeY={}", h));
                    final_lines.push(format!("LastUserConfirmedResolutionSizeX={}", w));
                    final_lines.push(format!("LastUserConfirmedResolutionSizeY={}", h));
                }
                inserted = true;
            }
        }
        new_lines = final_lines;
    }

    // 3. Write back
    {
        let mut file = File::create(path).map_err(|e| e.to_string())?;
        file.write_all(new_lines.join("\r\n").as_bytes())
            .map_err(|e| e.to_string())?;
    }

    // 4. Apply read-only lock if requested
    perms.set_readonly(lock_read_only);
    fs::set_permissions(path, perms).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn apply_to_all_configs(w: u32, h: u32, lock_readonly: bool) -> Result<usize, String> {
    let configs = find_valorant_configs();
    if configs.is_empty() {
        return Err("No VALORANT GameUserSettings.ini files found. Please launch VALORANT once to generate configuration files.".to_string());
    }
    let mut updated_count = 0;
    for cfg in &configs {
        if update_config(&cfg.path, true, Some((w, h)), lock_readonly).is_ok() {
            updated_count += 1;
        }
    }
    if updated_count == 0 {
        Err("Failed to update game configuration files".to_string())
    } else {
        Ok(updated_count)
    }
}

pub fn set_letterbox_all(disable_letterbox: bool) -> Result<usize, String> {
    let configs = find_valorant_configs();
    let mut count = 0;
    for cfg in &configs {
        if disable_letterbox {
            if update_config(&cfg.path, true, None, false).is_ok() {
                count += 1;
            }
        } else if let Ok(content) = fs::read_to_string(&cfg.path) {
            let mut was_ro = false;
            if let Ok(meta) = fs::metadata(&cfg.path) {
                if meta.permissions().readonly() {
                    was_ro = true;
                    let mut p = meta.permissions();
                    p.set_readonly(false);
                    let _ = fs::set_permissions(&cfg.path, p);
                }
            }
            let mut new_lines = Vec::new();
            for line in content.lines() {
                if line.starts_with("bShouldLetterbox=") {
                    new_lines.push("bShouldLetterbox=True".to_string());
                } else if line.starts_with("bLastConfirmedShouldLetterbox=") {
                    new_lines.push("bLastConfirmedShouldLetterbox=True".to_string());
                } else {
                    new_lines.push(line.to_string());
                }
            }
            if fs::write(&cfg.path, new_lines.join("\r\n")).is_ok() {
                count += 1;
            }
            if was_ro {
                if let Ok(meta) = fs::metadata(&cfg.path) {
                    let mut p = meta.permissions();
                    p.set_readonly(true);
                    let _ = fs::set_permissions(&cfg.path, p);
                }
            }
        }
    }
    Ok(count)
}

pub fn is_letterbox_disabled_in_configs() -> bool {
    let configs = find_valorant_configs();
    if configs.is_empty() {
        return true;
    }
    for cfg in configs {
        if cfg.should_letterbox == Some(false) {
            return true;
        }
    }
    false
}

