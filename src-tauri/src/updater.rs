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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    pub rid: u32,
    pub current_version: String,
    pub version: String,
    pub date: Option<String>,
    pub body: Option<String>,
    pub raw_json: serde_json::Value,
}

/// Resolves the signed `latest.json` manifest endpoint for a given channel.
/// - "stable": Official release endpoint from GitHub releases/latest
/// - "early-access" / "alpha": Queries GitHub releases API to target the newest
///   release (including alpha / pre-releases).
pub fn resolve_channel_endpoint(channel: &str) -> String {
    let ch = channel.to_lowercase();
    let is_early_access = ch == "early-access" || ch == "early_access" || ch == "alpha" || ch == "beta";

    if is_early_access {
        // Probe GitHub releases for the newest release (pre-release or alpha)
        let releases_api = format!("https://api.github.com/repos/{}/releases?per_page=5", DEFAULT_REPO);
        let user_agent = format!("User-Agent: Recon/{}", CURRENT_VERSION);
        let mut cmd = Command::new("curl");
        cmd.args([
            "-s",
            "--max-time", "4",
            "-H", &user_agent,
            "-H", "Accept: application/vnd.github.v3+json",
            &releases_api,
        ]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                if let Ok(releases) = serde_json::from_slice::<Vec<serde_json::Value>>(&output.stdout) {
                    // Check releases in order: find the newest release that has latest.json
                    for rel in &releases {
                        if let Some(tag) = rel.get("tag_name").and_then(|t| t.as_str()) {
                            let has_manifest = rel
                                .get("assets")
                                .and_then(|a| a.as_array())
                                .map(|assets| {
                                    assets.iter().any(|asset| {
                                        asset
                                            .get("name")
                                            .and_then(|n| n.as_str())
                                            .map(|n| n == "latest.json")
                                            .unwrap_or(false)
                                    })
                                })
                                .unwrap_or(false);

                            if has_manifest {
                                return format!(
                                    "https://github.com/{}/releases/download/{}/latest.json",
                                    DEFAULT_REPO, tag
                                );
                            }
                        }
                    }
                }
            }
        }
        // Fallback for early access channel if specific tag wasn't found
        format!("https://github.com/{}/releases/download/alpha/latest.json", DEFAULT_REPO)
    } else {
        // Stable channel: GitHub's /releases/latest endpoint
        format!(
            "https://github.com/{}/releases/latest/download/latest.json",
            DEFAULT_REPO
        )
    }
}

/// Checks for updates on a specific channel ("stable" or "early-access")
/// using Tauri's official updater plugin with cryptographic signature verification.
pub async fn check_channel_update_internal(
    webview: tauri::Webview,
    channel: String,
) -> Result<Option<UpdateMetadata>, String> {
    use tauri_plugin_updater::UpdaterExt;
    use tauri::Url;

    let endpoint_str = resolve_channel_endpoint(&channel);
    let endpoint_url = Url::parse(&endpoint_str)
        .map_err(|e| format!("Invalid update URL {}: {}", endpoint_str, e))?;

    let mut builder = webview.updater_builder();
    builder = builder
        .endpoints(vec![endpoint_url])
        .map_err(|e| format!("Failed to configure updater endpoints: {}", e))?;

    let is_early_access = channel.eq_ignore_ascii_case("early-access")
        || channel.eq_ignore_ascii_case("early_access")
        || channel.eq_ignore_ascii_case("alpha");

    if is_early_access {
        // Allow alpha/prerelease version transitions
        builder = builder.version_comparator(|current, update| update.version != current);
    }

    let updater = builder
        .build()
        .map_err(|e| format!("Failed to build updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Update check failed: {}", e))?;

    if let Some(update) = update {
        use tauri::Manager;
        let rid = webview.resources_table().add(update.clone());
        Ok(Some(UpdateMetadata {
            rid,
            current_version: update.current_version.clone(),
            version: update.version.clone(),
            date: update.date.map(|d| d.to_string()),
            body: update.body.clone(),
            raw_json: update.raw_json.clone(),
        }))
    } else {
        Ok(None)
    }
}

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
