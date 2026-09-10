use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_title: String,
    pub release_notes: String,
    pub published_at: String,
    pub html_url: String,
    pub download_url: Option<String>,
}

pub const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const DEFAULT_REPO: &str = "youssefvdel/Recon";

/// Compares two semver strings (e.g. "2.0.0" vs "v2.0.1").
/// Returns true if remote is strictly greater than current.
pub fn is_newer_version(current: &str, remote: &str) -> bool {
    let clean = |s: &str| -> Vec<u32> {
        s.trim_start_matches(|c: char| c == 'v' || c == 'V')
            .split('.')
            .filter_map(|part| {
                part.chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse::<u32>()
                    .ok()
            })
            .collect()
    };

    let c = clean(current);
    let r = clean(remote);

    for i in 0..c.len().max(r.len()) {
        let cv = c.get(i).copied().unwrap_or(0);
        let rv = r.get(i).copied().unwrap_or(0);
        if rv > cv {
            return true;
        } else if rv < cv {
            return false;
        }
    }
    false
}

/// Queries GitHub releases API using native Windows curl with CREATE_NO_WINDOW flag.
pub fn check_for_updates() -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", DEFAULT_REPO);

    let user_agent = format!("User-Agent: Recon/{}", CURRENT_VERSION);
    let mut cmd = Command::new("curl");
    cmd.args([
        "-s",
        "--max-time", "5",
        "-H", &user_agent,
        "-H", "Accept: application/vnd.github.v3+json",
        &url,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW (0 console flash)
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute update check: {}", e))?;

    if !output.status.success() {
        return Err("Update check failed: network timeout or server unreachable".to_string());
    }

    let json_text = String::from_utf8_lossy(&output.stdout);
    let v: serde_json::Value = serde_json::from_str(&json_text)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // If GitHub returned {"message": "Not Found"} (e.g. repo is private or no releases published yet)
    if let Some(msg) = v.get("message").and_then(|m| m.as_str()) {
        if msg.eq_ignore_ascii_case("Not Found") {
            return Ok(UpdateInfo {
                has_update: false,
                current_version: CURRENT_VERSION.to_string(),
                latest_version: CURRENT_VERSION.to_string(),
                release_title: format!("Recon v{}", CURRENT_VERSION),
                release_notes: "You are currently running the latest version of Recon.".to_string(),
                published_at: String::new(),
                html_url: format!("https://github.com/{}", DEFAULT_REPO),
                download_url: None,
            });
        }
    }

    let tag_name = v.get("tag_name").and_then(|t| t.as_str()).unwrap_or(CURRENT_VERSION);
    let name = v.get("name").and_then(|n| n.as_str()).unwrap_or(tag_name);
    let body = v.get("body").and_then(|b| b.as_str()).unwrap_or("No release notes provided.");
    let published_at = v.get("published_at").and_then(|p| p.as_str()).unwrap_or("");
    let default_html_url = format!("https://github.com/{}", DEFAULT_REPO);
    let html_url = v
        .get("html_url")
        .and_then(|u| u.as_str())
        .unwrap_or(&default_html_url);

    // Find any binary/installer asset
    let mut download_url = None;
    if let Some(assets) = v.get("assets").and_then(|a| a.as_array()) {
        for asset in assets {
            if let Some(asset_name) = asset.get("name").and_then(|n| n.as_str()) {
                if asset_name.ends_with(".exe") || asset_name.ends_with(".zip") || asset_name.ends_with(".msi") {
                    download_url = asset
                        .get("browser_download_url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string());
                    break;
                }
            }
        }
    }

    let has_update = is_newer_version(CURRENT_VERSION, tag_name);

    Ok(UpdateInfo {
        has_update,
        current_version: CURRENT_VERSION.to_string(),
        latest_version: tag_name.to_string(),
        release_title: name.to_string(),
        release_notes: body.to_string(),
        published_at: published_at.to_string(),
        html_url: html_url.to_string(),
        download_url,
    })
}

/// Opens an external URL in the user's default browser.
pub fn open_url(url: &str) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let url_h = HSTRING::from(url);
    let open_h = HSTRING::from("open");
    unsafe {
        ShellExecuteW(None, windows::core::PCWSTR(open_h.as_ptr()), windows::core::PCWSTR(url_h.as_ptr()), None, None, SW_SHOWNORMAL);
    }
    Ok(())
}

/// Downloads the updated binary/installer and triggers execution
pub fn download_and_install_update(download_url: &str) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let target_file = temp_dir.join("Recon_Update.exe");

    let mut cmd = Command::new("curl");
    cmd.args([
        "-sL",
        "--max-time", "180",
        "-o", &target_file.to_string_lossy(),
        download_url,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Download failed: {}", e))?;
    if !output.status.success() {
        return Err("Update download failed or timed out".to_string());
    }

    if !target_file.exists() {
        return Err("Downloaded update file not found".to_string());
    }

    let mut spawn_cmd = Command::new(&target_file);
    spawn_cmd.args(["/SILENT", "/VERYSILENT", "--updated"]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        spawn_cmd.creation_flags(0x00000008); // DETACHED_PROCESS
    }

    spawn_cmd.spawn().map_err(|e| format!("Failed to launch installer: {}", e))?;

    Ok("Update downloaded and started".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_compare() {
        assert!(is_newer_version("2.0.0", "v2.0.1"));
        assert!(is_newer_version("2.0.0", "2.1.0"));
        assert!(is_newer_version("2.0.0", "3.0.0"));
        assert!(!is_newer_version("2.0.0", "2.0.0"));
        assert!(!is_newer_version("2.0.0", "v2.0.0"));
        assert!(!is_newer_version("2.0.0", "1.9.9"));
        assert!(is_newer_version("0.1.0", "0.2.0"));
    }
}
