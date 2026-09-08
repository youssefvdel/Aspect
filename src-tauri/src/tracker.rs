use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalRiotAccount {
    pub game_name: String,
    pub tagline: String,
    pub puuid: String,
}

/// Reads the logged-in Riot account from the local Riot Client lockfile —
/// the same technique desktop trackers use. No password is ever logged or
/// stored; it lives only in the curl argument for one local call.
#[tauri::command]
pub fn detect_local_account() -> Result<LocalRiotAccount, String> {
    let lockfile = std::env::var("LOCALAPPDATA")
        .map(|la| {
            std::path::PathBuf::from(la)
                .join("Riot Games")
                .join("Riot Client")
                .join("Config")
                .join("lockfile")
        })
        .map_err(|_| "Riot Client not found on this PC.".to_string())?;

    let content = std::fs::read_to_string(&lockfile)
        .map_err(|_| "Riot Client lockfile missing — launch Riot Client or Valorant first.".to_string())?;
    let parts: Vec<&str> = content.trim().split(':').collect();
    if parts.len() < 5 {
        return Err("Unreadable lockfile — relaunch the Riot Client and retry.".to_string());
    }
    // Format: name:pid:port:password:protocol. A stale lockfile (dead pid)
    // fails at connect below with a clear message.
    let (port, password) = (parts[2], parts[3]);
    let url = format!("https://127.0.0.1:{}/player-account/aliases/v1/active", port);

    let mut cmd = Command::new("curl");
    cmd.args([
        "-s",
        "-k",
        "--max-time",
        "5",
        "-u",
        &format!("riot:{}", password),
        &url,
    ]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Local query failed: {}", e))?;
    if !output.status.success() {
        return Err("Riot Client not responding — launch it and retry.".to_string());
    }
    let v: serde_json::Value =
        serde_json::from_str(&String::from_utf8_lossy(&output.stdout))
            .map_err(|_| "Unexpected local response.".to_string())?;
    let game_name = v
        .get("game_name")
        .and_then(|s| s.as_str())
        .ok_or("No active session — log into the Riot Client first.".to_string())?;
    Ok(LocalRiotAccount {
        game_name: game_name.to_string(),
        tagline: v
            .get("tagline")
            .and_then(|s| s.as_str())
            .unwrap_or("")
            .to_string(),
        puuid: v
            .get("puuid")
            .and_then(|s| s.as_str())
            .unwrap_or("")
            .to_string(),
    })
}
