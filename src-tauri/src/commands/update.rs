use serde::Serialize;
use tauri_plugin_store::StoreExt;

#[derive(Serialize)]
pub struct UpdateCheckResult {
    has_update: bool,
    latest_version: Option<String>,
}

#[tauri::command]
pub fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    let store = app.store("easypack-store.json").map_err(|e| e.to_string())?;

    let config = app.config();
    let current_version_str = config.version.as_deref().unwrap_or("0.0.0");
    let current = semver::Version::parse(current_version_str)
        .map_err(|e| format!("Invalid current version: {}", e))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Check cache: if checked within 24h, return cached result
    let last_check: Option<u64> = store
        .get("updateCheck.lastCheckTime")
        .and_then(|v| v.as_u64());

    if let Some(last) = last_check {
        if now.saturating_sub(last) < 86400 {
            let cached_latest: Option<String> = store
                .get("updateCheck.latestVersion")
                .and_then(|v| v.as_str().map(String::from));
            if let Some(ref latest_str) = cached_latest {
                if let Ok(latest) = semver::Version::parse(latest_str) {
                    return Ok(UpdateCheckResult {
                        has_update: latest > current,
                        latest_version: cached_latest,
                    });
                }
            }
        }
    }

    // Cache miss or expired: fetch from GitHub Releases API
    let response = reqwest::blocking::Client::new()
        .get("https://api.github.com/repos/armok-c/EasyPack/releases/latest")
        .header("User-Agent", "EasyPack")
        .timeout(std::time::Duration::from_secs(10))
        .send();

    match response {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
            let tag_name = body["tag_name"].as_str().unwrap_or("");
            let version_str = tag_name.strip_prefix('v').unwrap_or(tag_name);

            match semver::Version::parse(version_str) {
                Ok(latest) => {
                    let has_update = latest > current;
                    let latest_str = version_str.to_string();

                    let _ = store.set(
                        "updateCheck.lastCheckTime",
                        serde_json::Value::from(now),
                    );
                    let _ = store.set(
                        "updateCheck.latestVersion",
                        serde_json::Value::String(latest_str.clone()),
                    );
                    let _ = store.save();

                    Ok(UpdateCheckResult {
                        has_update,
                        latest_version: Some(latest_str),
                    })
                }
                Err(e) => Err(format!("Invalid remote version: {}", e)),
            }
        }
        Ok(resp) if resp.status() == reqwest::StatusCode::NOT_FOUND => {
            // No releases yet
            Ok(UpdateCheckResult {
                has_update: false,
                latest_version: None,
            })
        }
        Ok(_) | Err(_) => {
            // Network error, rate limit, etc — silent fail
            Ok(UpdateCheckResult {
                has_update: false,
                latest_version: None,
            })
        }
    }
}

#[tauri::command]
pub fn open_release_page() -> Result<(), String> {
    open::that("https://github.com/armok-c/EasyPack/releases/latest")
        .map_err(|e| format!("Failed to open browser: {}", e))
}
