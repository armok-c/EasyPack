use serde::Serialize;
use std::fs;
use std::path::Path;

/// Icon candidate found by scanning a project directory
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct IconCandidate {
    pub path: String,
    pub name: String,
    pub source: String,
}

/// Project information (folder size and git branch)
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct ProjectInfo {
    pub size: String,
    pub branch: Option<String>,
}

/// Directories to exclude from folder size calculation (per D-05)
const EXCLUDED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    ".next",
    ".cache",
    "build",
    "__pycache__",
    ".venv",
    ".env",
    ".tox",
    "coverage",
    ".terraform",
    "vendor",
];

/// Icon filenames to look for in project root (non-recursive, per D-01)
const ICON_FILENAMES: &[&str] = &[
    "favicon.ico",
    "icon.ico",
    "app-icon.ico",
    "icon.png",
    "logo.png",
    "app-icon.png",
    "icon.svg",
    "logo.svg",
];

/// Format a byte count as a human-readable string
pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Recursively calculate directory size, skipping EXCLUDED_DIRS
pub fn calculate_dir_size(path: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };

            if file_type.is_dir() {
                let file_name = entry.file_name();
                let name = file_name.to_string_lossy();
                if EXCLUDED_DIRS.contains(&name.as_ref()) {
                    continue;
                }
                total += calculate_dir_size(&entry.path());
            } else if file_type.is_file() {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
            // Skip symlinks and other special file types
        }
    }
    total
}

/// Read the current git branch from .git/HEAD
/// Returns None for detached HEAD or non-git projects
pub fn read_git_branch(project_path: &Path) -> Option<String> {
    let head_path = project_path.join(".git").join("HEAD");
    let content = fs::read_to_string(&head_path).ok()?;

    let trimmed = content.trim();
    if let Some(branch) = trimmed.strip_prefix("ref: refs/heads/") {
        Some(branch.to_string())
    } else {
        // detached HEAD (commit hash) or unexpected format
        None
    }
}

/// Core logic: scan a project directory for icon candidates
pub fn scan_icons(project_path: &Path) -> Result<Vec<IconCandidate>, String> {
    if !project_path.exists() || !project_path.is_dir() {
        return Err("项目目录不存在".to_string());
    }

    let mut candidates = Vec::new();

    // 1. Check package.json icon fields
    if let Ok(content) = fs::read_to_string(project_path.join("package.json")) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // Check "icon" string field
            if let Some(icon_path) = json.get("icon").and_then(|v| v.as_str()) {
                let full_path = project_path.join(icon_path);
                if full_path.exists() && full_path.is_file() {
                    candidates.push(IconCandidate {
                        path: full_path.to_string_lossy().to_string(),
                        name: full_path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        source: "package.json".to_string(),
                    });
                }
            }
            // Check "icons" array (Electron/PWA style)
            if let Some(icons) = json.get("icons") {
                if let Some(icons_arr) = icons.as_array() {
                    for icon_entry in icons_arr {
                        if let Some(icon_path) = icon_entry.get("src").and_then(|v| v.as_str()) {
                            let full_path = project_path.join(icon_path);
                            if full_path.exists() && full_path.is_file() {
                                let path_str = full_path.to_string_lossy().to_string();
                                if !candidates.iter().any(|c| c.path == path_str) {
                                    candidates.push(IconCandidate {
                                        path: path_str,
                                        name: full_path
                                            .file_name()
                                            .and_then(|n| n.to_str())
                                            .unwrap_or("unknown")
                                            .to_string(),
                                        source: "package.json".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Check common icon filenames in project root (non-recursive)
    for filename in ICON_FILENAMES {
        let file_path = project_path.join(filename);
        if file_path.exists() && file_path.is_file() {
            let path_str = file_path.to_string_lossy().to_string();
            if !candidates.iter().any(|c| c.path == path_str) {
                candidates.push(IconCandidate {
                    path: path_str,
                    name: filename.to_string(),
                    source: "file".to_string(),
                });
            }
        }
    }

    Ok(candidates)
}

/// Core logic: get project info (folder size and git branch)
pub fn get_info(project_path: &Path) -> Result<ProjectInfo, String> {
    if !project_path.exists() || !project_path.is_dir() {
        return Err("项目目录不存在".to_string());
    }

    let total_bytes = calculate_dir_size(project_path);
    let branch = read_git_branch(project_path);

    Ok(ProjectInfo {
        size: format_size(total_bytes),
        branch,
    })
}

/// Tauri command: scan a project directory for icon candidates
#[tauri::command]
pub async fn scan_project_icons(project_path: String) -> Result<Vec<IconCandidate>, String> {
    let dir = Path::new(&project_path);
    scan_icons(dir)
}

/// Tauri command: get project information (folder size and git branch)
#[tauri::command]
pub async fn get_project_info(project_path: String) -> Result<ProjectInfo, String> {
    let path = Path::new(&project_path);
    get_info(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as test_fs;

    /// Helper to create a temp test directory under target/
    fn create_test_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::current_dir()
            .unwrap()
            .join("target")
            .join("test-temp")
            .join(name);
        let _ = test_fs::remove_dir_all(&dir);
        test_fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Helper to clean up test directory
    fn cleanup_test_dir(dir: &std::path::Path) {
        let _ = test_fs::remove_dir_all(dir);
    }

    // ---- Test 1: scan_icons returns candidates for a project directory ----
    #[test]
    fn test_scan_icons_returns_candidates() {
        let dir = create_test_dir("scan_basic");
        test_fs::write(dir.join("icon.png"), "fake png data").unwrap();
        test_fs::write(dir.join("logo.svg"), "<svg></svg>").unwrap();

        let candidates = scan_icons(&dir).expect("Should return Ok");
        assert!(!candidates.is_empty(), "Should find at least one icon candidate");
        assert!(candidates.iter().any(|c| c.name == "icon.png"));
        assert!(candidates.iter().any(|c| c.name == "logo.svg"));

        // Verify paths are absolute
        for c in &candidates {
            assert!(
                std::path::Path::new(&c.path).is_absolute(),
                "Path should be absolute: {}",
                c.path
            );
        }

        cleanup_test_dir(&dir);
    }

    // ---- Test 2: scan_icons returns Err for non-existent directory ----
    #[test]
    fn test_scan_icons_nonexistent_dir() {
        let result = scan_icons(Path::new("/nonexistent/path/that/does/not/exist"));
        assert!(result.is_err(), "Should return Err for non-existent directory");
        assert!(result.unwrap_err().contains("项目目录不存在"));
    }

    // ---- Test 3: get_info returns human-readable size ----
    #[test]
    fn test_get_info_returns_size() {
        let dir = create_test_dir("info_size");
        let data = vec![0u8; 1024 * 100]; // 100 KB
        test_fs::write(dir.join("testfile.bin"), &data).unwrap();

        let info = get_info(&dir).expect("Should return Ok");
        assert!(!info.size.is_empty(), "Size should not be empty");
        assert!(info.size.contains("KB"), "Size should contain KB: {}", info.size);

        cleanup_test_dir(&dir);
    }

    // ---- Test 4: get_info returns branch: None for non-Git project ----
    #[test]
    fn test_get_info_no_git() {
        let dir = create_test_dir("info_no_git");
        test_fs::write(dir.join("dummy.txt"), "hello").unwrap();

        let info = get_info(&dir).expect("Should return Ok");
        assert_eq!(info.branch, None, "Non-git project should have branch: None");

        cleanup_test_dir(&dir);
    }

    // ---- Test 5: get_info returns branch: None for detached HEAD ----
    #[test]
    fn test_get_info_detached_head() {
        let dir = create_test_dir("info_detached");
        test_fs::create_dir_all(dir.join(".git")).unwrap();
        test_fs::write(dir.join(".git").join("HEAD"), "abc123def456789012345678901234567890abcd\n").unwrap();

        let info = get_info(&dir).expect("Should return Ok");
        assert_eq!(info.branch, None, "Detached HEAD should return branch: None");

        cleanup_test_dir(&dir);
    }

    // ---- Test 6: calculate_dir_size excludes EXCLUDED_DIRS ----
    #[test]
    fn test_calculate_dir_size_excludes_dirs() {
        let dir = create_test_dir("size_exclude");
        test_fs::write(dir.join("root.txt"), "hello").unwrap();
        test_fs::create_dir_all(dir.join("node_modules")).unwrap();
        test_fs::write(dir.join("node_modules").join("big_dep.bin"), vec![0u8; 1024 * 1024]).unwrap();
        test_fs::create_dir_all(dir.join(".git")).unwrap();
        test_fs::write(dir.join(".git").join("objects"), vec![0u8; 512 * 1024]).unwrap();
        test_fs::create_dir_all(dir.join("src")).unwrap();
        test_fs::write(dir.join("src").join("main.rs"), "fn main() {}").unwrap();

        let total = calculate_dir_size(&dir);

        let root_size = test_fs::metadata(dir.join("root.txt")).unwrap().len();
        let src_size = test_fs::metadata(dir.join("src").join("main.rs")).unwrap().len();
        assert_eq!(total, root_size + src_size, "Should exclude node_modules and .git");

        cleanup_test_dir(&dir);
    }

    // ---- Test 7: format_size handles various byte counts ----
    #[test]
    fn test_format_size() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(512), "512 B");
        assert_eq!(format_size(1024), "1.0 KB");
        assert_eq!(format_size(1536), "1.5 KB");
        assert_eq!(format_size(1024 * 1024), "1.0 MB");
        assert_eq!(format_size(1024 * 1024 * 12 + 1024 * 300), "12.3 MB");
        assert_eq!(format_size(1024 * 1024 * 1024), "1.0 GB");
        assert_eq!(format_size(1024 * 1024 * 1024 * 2 + 1024 * 500), "2.0 GB");
    }

    // ---- Test 8: read_git_branch parses "ref: refs/heads/main\n" ----
    #[test]
    fn test_read_git_branch_normal() {
        let dir = create_test_dir("git_branch");
        test_fs::create_dir_all(dir.join(".git")).unwrap();
        test_fs::write(dir.join(".git").join("HEAD"), "ref: refs/heads/main\n").unwrap();

        let branch = read_git_branch(&dir);
        assert_eq!(branch, Some("main".to_string()));

        cleanup_test_dir(&dir);
    }

    #[test]
    fn test_read_git_branch_feature() {
        let dir = create_test_dir("git_branch_feature");
        test_fs::create_dir_all(dir.join(".git")).unwrap();
        test_fs::write(dir.join(".git").join("HEAD"), "ref: refs/heads/feature/my-branch\n").unwrap();

        let branch = read_git_branch(&dir);
        assert_eq!(branch, Some("feature/my-branch".to_string()));

        cleanup_test_dir(&dir);
    }

    #[test]
    fn test_read_git_branch_commit_hash() {
        let dir = create_test_dir("git_detached");
        test_fs::create_dir_all(dir.join(".git")).unwrap();
        test_fs::write(dir.join(".git").join("HEAD"), "abc123def456789012345678901234567890abcd\n").unwrap();

        let branch = read_git_branch(&dir);
        assert_eq!(branch, None);

        cleanup_test_dir(&dir);
    }

    #[test]
    fn test_read_git_branch_no_git() {
        let dir = create_test_dir("git_none");
        test_fs::write(dir.join("file.txt"), "not a git repo").unwrap();

        let branch = read_git_branch(&dir);
        assert_eq!(branch, None);

        cleanup_test_dir(&dir);
    }

    // ---- Additional: scan_icons deduplicates package.json entries ----
    #[test]
    fn test_scan_icons_deduplicates() {
        let dir = create_test_dir("scan_dedup");
        test_fs::write(dir.join("icon.png"), "fake png data").unwrap();
        test_fs::write(dir.join("package.json"), r#"{"icon": "icon.png"}"#).unwrap();

        let candidates = scan_icons(&dir).expect("Should return Ok");
        let icon_png_count = candidates.iter().filter(|c| c.name == "icon.png").count();
        assert_eq!(icon_png_count, 1, "icon.png should not be duplicated");

        let icon_candidate = candidates.iter().find(|c| c.name == "icon.png").unwrap();
        assert_eq!(icon_candidate.source, "package.json");

        cleanup_test_dir(&dir);
    }

    // ---- Additional: scan_icons handles package.json icons array ----
    #[test]
    fn test_scan_icons_handles_icons_array() {
        let dir = create_test_dir("scan_icons_array");
        test_fs::write(dir.join("icon-16.png"), "16px data").unwrap();
        test_fs::write(dir.join("icon-32.png"), "32px data").unwrap();
        test_fs::write(
            dir.join("package.json"),
            r#"{"icons": [{"src": "icon-16.png", "sizes": "16x16"}, {"src": "icon-32.png", "sizes": "32x32"}]}"#,
        ).unwrap();

        let candidates = scan_icons(&dir).expect("Should return Ok");
        assert!(candidates.iter().any(|c| c.name == "icon-16.png"), "Should find icon-16.png from icons array");
        assert!(candidates.iter().any(|c| c.name == "icon-32.png"), "Should find icon-32.png from icons array");

        cleanup_test_dir(&dir);
    }
}
