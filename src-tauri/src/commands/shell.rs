use std::collections::HashMap;
use std::ffi::OsString;
use std::os::windows::process::CommandExt;
use std::path::{Component, Path, PathBuf};
use std::process::Command as StdCommand;
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, REG_EXPAND_SZ, REG_SZ};
use winreg::types::FromRegValue;
use winreg::{RegKey, HKEY};

// 子进程脱离父进程的 Job Object，避免 tauri dev 重启时终端被一并杀死
const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x01000000;
const DETACHED_PROCESS: u32 = 0x00000008;
const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
const MISSING_PROJECT_DIRECTORY_ERROR: &str = "项目目录不存在";
const EMPTY_PROJECT_RELATIVE_DIRECTORY_ERROR: &str = "项目相对目录不能为空";
const INVALID_PROJECT_RELATIVE_DIRECTORY_ERROR: &str = "项目相对目录无效";
const MISSING_TARGET_DIRECTORY_ERROR: &str = "目标目录不存在";
const TARGET_NOT_DIRECTORY_ERROR: &str = "目标路径不是目录";
const TARGET_OUTSIDE_PROJECT_ERROR: &str = "目标目录不能位于项目目录外";

const PATH_SEPARATOR: char = ';';
const MACHINE_ENVIRONMENT_KEY: &str =
    r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment";
const USER_ENVIRONMENT_KEY: &str = "Environment";

fn validate_project_directory(project_path: &str) -> Result<(), String> {
    if !Path::new(project_path).is_dir() {
        return Err(MISSING_PROJECT_DIRECTORY_ERROR.to_string());
    }
    Ok(())
}

fn expand_percent_variables_with<F>(value: &str, mut get_variable: F) -> String
where
    F: FnMut(&str) -> Option<String>,
{
    let mut expanded = String::with_capacity(value.len());
    let mut remaining = value;

    while let Some(start) = remaining.find('%') {
        expanded.push_str(&remaining[..start]);
        let after_start = &remaining[start + 1..];
        let Some(end_offset) = after_start.find('%') else {
            expanded.push('%');
            expanded.push_str(after_start);
            return expanded;
        };

        let end = start + 1 + end_offset;
        let variable_name = &remaining[start + 1..end];
        let token = &remaining[start..=end];
        if variable_name.is_empty() {
            expanded.push_str(token);
        } else if let Some(replacement) = get_variable(variable_name) {
            expanded.push_str(&replacement);
        } else {
            expanded.push_str(token);
        }
        remaining = &remaining[end + 1..];
    }

    expanded.push_str(remaining);
    expanded
}

/// Read string environment values from a current Windows registry environment
/// key. Registry environment names are case-insensitive, so normalize them
/// before they are merged.
fn read_registry_environment(
    root: HKEY,
    sub_key: &str,
) -> std::io::Result<HashMap<String, String>> {
    let key = RegKey::predef(root).open_subkey(sub_key)?;
    let mut environment = HashMap::new();

    for value_result in key.enum_values() {
        let (name, value) = value_result?;
        if value.vtype != REG_SZ && value.vtype != REG_EXPAND_SZ {
            continue;
        }

        let value = <String as FromRegValue>::from_reg_value(&value)?;
        environment.insert(name.to_ascii_lowercase(), value);
    }

    Ok(environment)
}

fn registry_environment_value<'a>(
    environment: Option<&'a HashMap<String, String>>,
    name: &str,
) -> Option<&'a str> {
    environment?
        .iter()
        .find_map(|(key, value)| key.eq_ignore_ascii_case(name).then_some(value.as_str()))
}

fn path_entry_key(entry: &str) -> String {
    let entry = entry.trim();
    let mut key = entry.to_ascii_lowercase();
    while key.len() > 3 && (key.ends_with('\\') || key.ends_with('/')) {
        key.pop();
    }
    key
}

/// Combine registry PATH entries with the process PATH while preserving
/// process-only entries used by tools launched through EasyPack.
fn merge_path_values(
    process_path: &str,
    machine_path: Option<&str>,
    user_path: Option<&str>,
) -> String {
    let mut entries = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for path in [machine_path, user_path, Some(process_path)] {
        let Some(path) = path else {
            continue;
        };
        for raw_entry in path.split(PATH_SEPARATOR) {
            let entry = raw_entry.trim();
            if entry.is_empty() {
                continue;
            }
            let key = path_entry_key(entry);
            if seen.insert(key) {
                entries.push(entry.to_string());
            }
        }
    }

    entries.join(";")
}

fn refreshed_command_path_with_sources<F>(
    process_path: Option<&std::ffi::OsStr>,
    machine_environment: Option<&HashMap<String, String>>,
    user_environment: Option<&HashMap<String, String>>,
    mut process_variable: F,
) -> Option<OsString>
where
    F: FnMut(&str) -> Option<String>,
{
    let machine_path = registry_environment_value(machine_environment, "Path");
    let user_path = registry_environment_value(user_environment, "Path");

    // If registry PATH is unavailable, let Command inherit the exact
    // original value rather than replacing it with a lossy conversion.
    if machine_path.is_none() && user_path.is_none() {
        return process_path.map(OsString::from);
    }

    let mut registry_environment = HashMap::new();
    for environment in [machine_environment, user_environment]
        .into_iter()
        .flatten()
    {
        for (name, value) in environment {
            registry_environment.insert(name.to_ascii_lowercase(), value.clone());
        }
    }

    let mut resolve_variable = |name: &str| {
        registry_environment
            .get(&name.to_ascii_lowercase())
            .cloned()
            .or_else(|| process_variable(name))
    };
    let machine_path =
        machine_path.map(|path| expand_percent_variables_with(path, &mut resolve_variable));
    let user_path =
        user_path.map(|path| expand_percent_variables_with(path, &mut resolve_variable));
    let process_path_text = process_path.and_then(|path| path.to_str()).unwrap_or("");
    let merged = merge_path_values(
        process_path_text,
        machine_path.as_deref(),
        user_path.as_deref(),
    );

    if merged.is_empty() {
        process_path.map(OsString::from)
    } else {
        Some(OsString::from(merged))
    }
}

/// Build a command PATH from the current registry values instead of relying
/// on the environment captured when EasyPack itself was started.
fn refreshed_command_path() -> Option<OsString> {
    let process_path = std::env::var_os("PATH");
    let machine_environment =
        read_registry_environment(HKEY_LOCAL_MACHINE, MACHINE_ENVIRONMENT_KEY).ok();
    let user_environment = read_registry_environment(HKEY_CURRENT_USER, USER_ENVIRONMENT_KEY).ok();

    refreshed_command_path_with_sources(
        process_path.as_deref(),
        machine_environment.as_ref(),
        user_environment.as_ref(),
        |name| std::env::var(name).ok(),
    )
}

fn new_shell_command(args: &str, creation_flags: u32) -> StdCommand {
    let mut command = StdCommand::new("cmd");
    if let Some(path) = refreshed_command_path() {
        command.env("PATH", path);
    }
    command.creation_flags(creation_flags).raw_arg(args);
    command
}

/// spawn cmd.exe 并尝试脱离 Job Object。
/// 若父进程的 Job Object 不允许 breakaway (ERROR_ACCESS_DENIED)，回退到普通 spawn。
fn spawn_detached(args: &str) -> Result<std::process::Child, std::io::Error> {
    // 优先尝试 BREAKAWAY_FROM_JOB + DETACHED_PROCESS 脱离 Job Object
    match new_shell_command(args, CREATE_BREAKAWAY_FROM_JOB | DETACHED_PROCESS).spawn() {
        Ok(child) => Ok(child),
        Err(e) if e.raw_os_error() == Some(5) => {
            // os error 5 = ACCESS_DENIED: Job Object 不允许 breakaway
            // 仍然使用 DETACHED_PROCESS 避免继承父进程控制台，
            // CREATE_NEW_PROCESS_GROUP 使进程组独立，降低被级联终止的风险。
            new_shell_command(args, DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP).spawn()
        }
        Err(e) => Err(e),
    }
}

/// 构建 cmd.exe 启动参数字符串
/// 使用 start 命令在新窗口中运行 cmd /K，/d 指定工作目录
/// start 的第一个 "" 作为空标题（避免路径被误解析为标题）
/// shell_command 用引号包裹以正确处理含空格的命令（如 "npm run build"）
fn build_cmd_start_args(project_path: &str, shell_command: &str) -> String {
    format!(
        r#"/C start "" /d "{}" cmd /K "{}""#,
        project_path, shell_command
    )
}

/// 在系统终端中执行命令
/// 使用 cmd.exe 的 start 命令在新窗口中启动 cmd /K
/// /d 指定工作目录，/K 保持终端窗口打开
///
/// 注意：不使用 wt.exe (Windows Terminal)，因为 wt.exe 的 UWP App Execution Alias
/// 从 Tauri GUI 进程 spawn 时，spawn() 会成功但 WT 内部报错 ERROR_FILE_NOT_FOUND
/// (0x80070002)。is_ok() 检查阻止了回退到 cmd.exe，导致所有命令都无法执行。
#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String> {
    if project_path.contains('"') {
        return Err("Invalid project path: contains double quote".to_string());
    }
    if shell_command.contains('"') {
        return Err("Invalid shell command: contains double quote".to_string());
    }
    validate_project_directory(&project_path)?;
    let args = build_cmd_start_args(&project_path, &shell_command);
    spawn_detached(&args).map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(())
}

/// 在 Windows 文件资源管理器中打开项目文件夹 (per D-04)
/// 使用 explorer.exe + raw_arg() 模式，路径用双引号包裹处理空格
#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    if path.contains('"') {
        return Err("Invalid path: contains double quote".to_string());
    }
    validate_project_directory(&path)?;
    StdCommand::new("explorer.exe")
        .raw_arg(format!("\"{}\"", path))
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(())
}

/// Resolve an existing project-relative directory without allowing path
/// traversal, absolute paths, or symlink/junction escapes.
fn resolve_project_subfolder(project_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    if project_path.contains('"') {
        return Err("Invalid project path: contains double quote".to_string());
    }

    let relative_path = relative_path.trim();
    if relative_path.is_empty() {
        return Err(EMPTY_PROJECT_RELATIVE_DIRECTORY_ERROR.to_string());
    }
    if relative_path.contains('"') {
        return Err(INVALID_PROJECT_RELATIVE_DIRECTORY_ERROR.to_string());
    }

    let relative = Path::new(relative_path);
    if relative.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(INVALID_PROJECT_RELATIVE_DIRECTORY_ERROR.to_string());
    }

    let root = std::fs::canonicalize(project_path)
        .map_err(|_| MISSING_PROJECT_DIRECTORY_ERROR.to_string())?;
    if !root.is_dir() {
        return Err(MISSING_PROJECT_DIRECTORY_ERROR.to_string());
    }

    let target = std::fs::canonicalize(root.join(relative)).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            MISSING_TARGET_DIRECTORY_ERROR.to_string()
        } else {
            format!("无法访问目标目录：{}", error)
        }
    })?;

    if !target.starts_with(&root) {
        return Err(TARGET_OUTSIDE_PROJECT_ERROR.to_string());
    }
    if !target.is_dir() {
        return Err(TARGET_NOT_DIRECTORY_ERROR.to_string());
    }

    Ok(target)
}

/// Open an existing directory below the current project directly in Explorer.
/// This intentionally bypasses cmd.exe so no terminal window is shown.
#[tauri::command]
pub async fn open_project_subfolder(
    project_path: String,
    relative_path: String,
) -> Result<(), String> {
    let target = resolve_project_subfolder(&project_path, &relative_path)?;
    StdCommand::new("explorer.exe")
        .arg(&target)
        .spawn()
        .map_err(|error| format!("打开目录失败：{}", error))?;
    Ok(())
}

const SHELL_EXECUTE_SUCCESS_THRESHOLD: isize = 32;
const SE_ERR_NOASSOC: isize = 31;

/// 根据 ShellExecuteW 的返回值决定是否需要打开“选择应用”窗口。
///
/// 通过注入调用函数测试判断逻辑，避免单元测试真的启动系统窗口。
fn execute_file_open_with_fallback<F>(mut shell_execute: F) -> Result<(), String>
where
    F: FnMut(&str) -> isize,
{
    let default_result = shell_execute("open");
    if default_result > SHELL_EXECUTE_SUCCESS_THRESHOLD {
        return Ok(());
    }
    if default_result != SE_ERR_NOASSOC {
        return Err(format!(
            "Windows Shell 打开文件失败（返回码 {}）",
            default_result
        ));
    }

    let openas_result = shell_execute("openas");
    if openas_result > SHELL_EXECUTE_SUCCESS_THRESHOLD {
        return Ok(());
    }

    Err(format!(
        "Windows Shell 打开文件失败：默认程序打开失败（返回码 {}）；选择应用窗口启动失败（返回码 {}）",
        default_result, openas_result
    ))
}

/// 使用 Windows 文件关联打开文件，不经过 cmd.exe 或 start 命令。
pub fn open_file_with_default_program(path: &Path) -> Result<(), String> {
    let path = path
        .to_str()
        .ok_or_else(|| "文件路径不是有效的 Windows 路径".to_string())?;
    if path.contains('"') {
        return Err("Invalid file path: contains double quote".to_string());
    }
    let path = strip_extended_path_prefix(path);
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *mut std::ffi::c_void,
            operation: *const u16,
            file: *const u16,
            parameters: *const u16,
            directory: *const u16,
            show_command: i32,
        ) -> isize;
    }

    let file: Vec<u16> = std::ffi::OsStr::new(&path)
        .encode_wide()
        .chain(Some(0))
        .collect();

    execute_file_open_with_fallback(|operation_name| {
        let operation: Vec<u16> = operation_name.encode_utf16().chain(Some(0)).collect();
        unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1,
            )
        }
    })
}

fn strip_extended_path_prefix(path: &str) -> String {
    if let Some(path) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{}", path);
    }
    path.strip_prefix(r"\\?\").unwrap_or(path).to_string()
}

// --- Phase 17: Multi-line script support ---

/// Build .bat file content for multi-line script execution.
///
/// - Header always includes: @echo off, chcp 65001 >nul, cd /d "{project_path}" (per D-10, D-11)
/// - When `is_batch_script=true`: script_content is appended verbatim
/// - When `is_batch_script=false`: non-empty lines are joined with separator
///   (strict: "&&", lenient: "&") and appended (per D-05, D-08)
/// - Empty/whitespace-only lines are always filtered
fn build_bat_content(
    project_path: &str,
    script_lines: &str,
    is_batch_script: bool,
    strict: bool,
) -> String {
    let header = format!("@echo off\r\nchcp 65001 >nul\r\ncd /d \"{}\"", project_path);

    if is_batch_script {
        // Batch script: write content verbatim (per D-05)
        // Normalize line endings to CRLF for cmd.exe compatibility
        let normalized = script_lines.replace("\r\n", "\n").replace('\n', "\r\n");
        format!("{}\r\n{}", header, normalized)
    } else {
        // Simple multi-line: filter empty lines, join with && or & (per D-05, D-08)
        let separator = if strict { " && " } else { " & " };
        let joined = script_lines
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join(separator);

        if joined.is_empty() {
            header
        } else {
            format!("{}\r\n{}", header, joined)
        }
    }
}

/// Execute a multi-line script by creating a temporary .bat file and running it
/// in a new terminal window.
///
/// The .bat file is kept (not deleted) in the system temp directory (per D-09).
/// Returns the path to the created .bat file.
#[tauri::command]
pub async fn execute_script(
    project_path: String,
    script_content: String,
    is_batch_script: bool,
    strict: bool,
) -> Result<String, String> {
    if project_path.contains('"') {
        return Err("Invalid project path: contains double quote".to_string());
    }
    if script_content.len() > 1_048_576 {
        return Err("Script content exceeds 1MB limit".to_string());
    }
    validate_project_directory(&project_path)?;
    let content = build_bat_content(&project_path, &script_content, is_batch_script, strict);

    // Create temp .bat file with "easypack-" prefix (per D-09)
    let temp_dir = std::env::temp_dir();
    let named_file = tempfile::Builder::new()
        .prefix("easypack-")
        .suffix(".bat")
        .rand_bytes(8)
        .tempfile_in(&temp_dir)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    // Keep the file (don't auto-delete on drop) per D-09
    let temp_path = named_file
        .into_temp_path()
        .keep()
        .map_err(|e| format!("Failed to persist temp file: {}", e))?;

    // Write .bat content with UTF-8 BOM so cmd.exe reads it as UTF-8
    let content_with_bom = format!("\u{FEFF}{}", content);
    std::fs::write(&temp_path, content_with_bom.as_bytes())
        .map_err(|e| format!("Failed to write script file: {}", e))?;

    let bat_path_str = temp_path.to_string_lossy().to_string();

    // Execute: cmd /C start "" /d "{project_path}" cmd /K "{bat_path}"
    let args = format!(
        r#"/C start "" /d "{}" cmd /K "{}""#,
        project_path, bat_path_str
    );

    spawn_detached(&args).map_err(|e| format!("Failed to execute script: {}", e))?;

    Ok(bat_path_str)
}

// --- Phase 23: Environment file read/write ---

/// Resolve and validate a relative file path inside a project directory.
///
/// Phase 23 review CR-01: `PathBuf::join` is absolute-path-aware — if
/// `file_name` is absolute (e.g. `C:\Windows\system32\config\SAM`), `join`
/// discards `project_path` entirely, allowing arbitrary reads/writes outside
/// the project. Even relative `..\..\` traverses out. This helper rejects:
///   - empty names
///   - any double quote (cmd.exe quoting hazard)
///   - absolute paths
///   - any `..` (ParentDir) component
/// and canonicalizes the project root, confirming the resolved target stays
/// within it. Only `Normal` components are permitted.
fn resolve_safe_path(project_path: &str, file_name: &str) -> Result<std::path::PathBuf, String> {
    if file_name.is_empty() {
        return Err("File name cannot be empty".to_string());
    }
    if file_name.contains('"') {
        return Err("Invalid file name: contains double quote".to_string());
    }
    if project_path.contains('"') {
        return Err("Invalid project path: contains double quote".to_string());
    }
    let rel = std::path::Path::new(file_name);
    if rel.is_absolute() {
        return Err("File name must be a relative path".to_string());
    }
    // Reject any ParentDir component; only Normal (and CurDir, which is a no-op)
    // components are allowed. Prefix/RootDir are already excluded by is_absolute.
    if rel
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("File name must not contain '..'".to_string());
    }

    // Canonicalize the project root so that symlink/junction traversal cannot
    // escape the project either. The project dir must already exist.
    let root =
        std::fs::canonicalize(project_path).map_err(|_| "Invalid project path".to_string())?;
    let full = root.join(rel);

    // Defense-in-depth: walk the relative components and ensure the resolved
    // path remains inside the canonical root. Because we already rejected
    // ParentDir/absolute components, `full` is guaranteed to be a descendant,
    // but this assert is cheap and documents the invariant.
    if !full.starts_with(&root) {
        return Err("Resolved path escapes project directory".to_string());
    }
    Ok(full)
}

/// Read a text file from a project directory (per D-09, D-12).
///
/// Returns:
///   - `Ok(Some(content))` when the file exists and is readable.
///   - `Ok(None)` when the file does not exist (NotFound).
///   - `Err(..)` for any other read failure (permission denied, sharing
///     violation, I/O error). This distinct signaling is load-bearing for
///     `applyEnv`'s rollback: a non-NotFound error must NOT be masked as
///     "absent", or rollback would delete a user file the app could not
///     read but could delete (Phase 23 iteration-2 WR-01).
///
/// WR-02: this is a *synchronous* Tauri command. Tauri runs sync commands on
/// its blocking thread pool, so the `std::fs` call below does not stall the
/// async executor (which was the WR-02 concern with the previous `async fn`
/// variant that did blocking I/O inline).
#[tauri::command]
pub fn read_file_content(
    project_path: String,
    file_name: String,
) -> Result<Option<String>, String> {
    let full_path = resolve_safe_path(&project_path, &file_name)?;
    match std::fs::read_to_string(&full_path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("Failed to read file".to_string()),
    }
}

/// Write content to a text file in a project directory (per D-12, D-28).
/// Automatically creates parent directories if they don't exist.
/// Individual writes are atomic: write to a sibling temp file then rename
/// over the target (WR-01 / D-28 atomic-write guarantee). Returns Ok(()) on
/// success.
///
/// WR-02: synchronous Tauri command (runs on the blocking pool).
#[tauri::command]
pub fn write_file_content(
    project_path: String,
    file_name: String,
    content: String,
) -> Result<(), String> {
    let full_path = resolve_safe_path(&project_path, &file_name)?;

    // Create parent directories (per D-12: auto create_dir_all)
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|_| "Failed to create directories")?;
    }

    // WR-01: atomic write — write to sibling temp then rename.
    // The temp file lives in the same directory so the rename is atomic on the
    // same filesystem (NTFS rename is atomic for same-volume moves).
    let mut tmp_name = full_path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    tmp_name.push(".easypack-tmp");
    let tmp_path = full_path.with_file_name(tmp_name);

    if std::fs::write(&tmp_path, content.as_bytes()).is_err() {
        let _ = std::fs::remove_file(&tmp_path);
        return Err("Failed to write file".to_string());
    }
    if std::fs::rename(&tmp_path, &full_path).is_err() {
        let _ = std::fs::remove_file(&tmp_path);
        return Err("Failed to write file".to_string());
    }
    Ok(())
}

/// Delete a file inside a project directory.
///
/// Phase 23 review CR-03: `applyEnv` rollback must be able to remove a managed
/// file that did not exist before the apply, rather than leaving an empty file
/// behind. This command mirrors `write_file_content`'s path-safety validation
/// (rejects absolute / `..` / quote paths, confirms the resolved path stays
/// inside the canonical project root). Deleting a non-existent file is a
/// no-op success (rollback may target a file that was never written).
///
/// WR-02: synchronous Tauri command (runs on the blocking pool).
#[tauri::command]
pub fn delete_file_content(project_path: String, file_name: String) -> Result<(), String> {
    let full_path = resolve_safe_path(&project_path, &file_name)?;
    match std::fs::remove_file(&full_path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Failed to delete file".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_percent_variables_replaces_known_and_keeps_unknown() {
        let expanded = expand_percent_variables_with(
            r#"%SystemRoot%\System32;%NVM_HOME%;%UNKNOWN_VAR%"#,
            |name| match name {
                "SystemRoot" => Some(r#"C:\Windows"#.to_string()),
                "NVM_HOME" => Some(r#"D:\environment\nvm"#.to_string()),
                _ => None,
            },
        );

        assert_eq!(
            expanded,
            r#"C:\Windows\System32;D:\environment\nvm;%UNKNOWN_VAR%"#
        );
    }

    #[test]
    fn test_merge_path_values_prefers_current_registry_paths_and_keeps_process_extras() {
        let merged = merge_path_values(
            r#"C:\Codex\bin;C:\Windows\System32;D:\old-node"#,
            Some(r#"C:\Windows\System32;D:\environment\nodejs"#),
            Some(r#"C:\Users\PC\AppData\Roaming\npm;D:\environment\nodejs"#),
        );

        assert_eq!(
            merged,
            r#"C:\Windows\System32;D:\environment\nodejs;C:\Users\PC\AppData\Roaming\npm;C:\Codex\bin;D:\old-node"#
        );
    }

    #[test]
    fn test_merge_path_values_deduplicates_case_insensitively() {
        let merged = merge_path_values(
            r#"C:\Tools;D:\Tools\;C:\Users\PC\Temp"#,
            Some(r#"c:\tools;D:\Tools"#),
            Some(r#"C:\USERS\PC\TEMP"#),
        );

        assert_eq!(merged, r#"c:\tools;D:\Tools;C:\USERS\PC\TEMP"#);
    }

    #[test]
    fn test_merge_path_values_falls_back_to_process_path_when_registry_unavailable() {
        let process_path = r#"C:\Codex\bin;C:\Windows\System32"#;

        assert_eq!(merge_path_values(process_path, None, None), process_path);
    }

    #[test]
    fn test_refreshed_command_path_prefers_current_registry_variables_over_stale_process_values() {
        let process_path = OsString::from(r#"C:\old-nvm\nodejs;C:\process-only"#);
        let machine_environment = std::collections::HashMap::from([
            (
                "path".to_string(),
                r#"%Nvm_Home%\nodejs;C:\Windows\System32"#.to_string(),
            ),
            ("nvm_home".to_string(), r#"D:\old-nvm"#.to_string()),
        ]);
        let user_environment = std::collections::HashMap::from([
            ("PATH".to_string(), r#"%NVM_HOME%\npm"#.to_string()),
            ("NVM_HOME".to_string(), r#"E:\new-nvm"#.to_string()),
        ]);

        let refreshed = refreshed_command_path_with_sources(
            Some(process_path.as_os_str()),
            Some(&machine_environment),
            Some(&user_environment),
            |name| {
                name.eq_ignore_ascii_case("NVM_HOME")
                    .then(|| r#"C:\old-nvm"#.to_string())
            },
        )
        .unwrap();

        assert_eq!(
            refreshed,
            OsString::from(
                r#"E:\new-nvm\nodejs;C:\Windows\System32;E:\new-nvm\npm;C:\old-nvm\nodejs;C:\process-only"#,
            )
        );
    }

    #[test]
    fn test_strip_extended_path_prefix_drive_path() {
        assert_eq!(
            strip_extended_path_prefix(r"\\?\C:\Projects\EasyPack\config.env"),
            r"C:\Projects\EasyPack\config.env"
        );
    }

    #[test]
    fn test_strip_extended_path_prefix_unc_path() {
        assert_eq!(
            strip_extended_path_prefix(r"\\?\UNC\server\share\config.env"),
            r"\\server\share\config.env"
        );
    }

    #[test]
    fn test_strip_extended_path_prefix_keeps_normal_path() {
        assert_eq!(
            strip_extended_path_prefix(r"D:\Projects\EasyPack\config.env"),
            r"D:\Projects\EasyPack\config.env"
        );
    }

    #[test]
    fn test_execute_file_open_success_does_not_fallback_to_openas() {
        let mut operations = Vec::new();

        let result = execute_file_open_with_fallback(|operation| {
            operations.push(operation.to_string());
            33
        });

        assert!(result.is_ok());
        assert_eq!(operations, vec!["open"]);
    }

    #[test]
    fn test_execute_file_open_no_association_falls_back_to_openas() {
        let mut operations = Vec::new();
        let mut results = [SE_ERR_NOASSOC, 33].into_iter();

        let result = execute_file_open_with_fallback(|operation| {
            operations.push(operation.to_string());
            results.next().expect("expected one result per operation")
        });

        assert!(result.is_ok());
        assert_eq!(operations, vec!["open", "openas"]);
    }

    #[test]
    fn test_execute_file_open_other_errors_do_not_fallback() {
        for error_code in [0, 1, 30, 32] {
            let mut operations = Vec::new();

            let result = execute_file_open_with_fallback(|operation| {
                operations.push(operation.to_string());
                error_code
            });

            let error = result.expect_err("non-NOASSOC errors should fail directly");
            assert!(error.contains(&format!("返回码 {}", error_code)));
            assert_eq!(operations, vec!["open"]);
        }
    }

    #[test]
    fn test_execute_file_open_openas_failure_identifies_both_stages() {
        let mut results = [SE_ERR_NOASSOC, 5].into_iter();

        let error = execute_file_open_with_fallback(|_| {
            results.next().expect("expected one result per operation")
        })
        .expect_err("failed openas should return an error");

        assert!(error.contains("默认程序打开失败（返回码 31）"));
        assert!(error.contains("选择应用窗口启动失败（返回码 5）"));
    }

    #[test]
    fn test_build_cmd_start_args_basic() {
        let result = build_cmd_start_args("E:\\git\\EasyPack", "claude");
        assert_eq!(
            result,
            r##"/C start "" /d "E:\git\EasyPack" cmd /K "claude""##
        );
    }

    #[test]
    fn test_build_cmd_start_args_path_with_spaces() {
        let result = build_cmd_start_args("D:\\My Projects\\app", "npm run build");
        assert!(result.contains(r#"start "" /d "D:\My Projects\app""#));
        assert!(result.contains(r#"cmd /K "npm run build""#));
    }

    #[test]
    fn test_build_cmd_start_args_path_with_cjk() {
        let result = build_cmd_start_args("D:\\用户\\项目\\EasyPack", "git pull");
        assert!(result.contains(r#"start "" /d "D:\用户\项目\EasyPack""#));
        assert!(result.contains(r#"cmd /K "git pull""#));
    }

    #[test]
    fn test_build_cmd_start_args_all_preset_commands() {
        let path = "D:\\Projects\\EasyPack";
        let commands = ["npm run build", "npm run dev", "git pull", "claude"];
        for cmd in &commands {
            let result = build_cmd_start_args(path, cmd);
            assert!(
                result.starts_with(r#"/C start "" /d"#),
                "Should start with /C start, got: {}",
                result
            );
            assert!(
                result.contains(&format!("cmd /K \"{}\"", cmd)),
                "Should contain cmd /K \"{}\", got: {}",
                cmd,
                result
            );
        }
    }

    #[test]
    fn test_build_cmd_start_args_simple_command() {
        let result = build_cmd_start_args("E:\\git\\EasyPack", "claude");
        assert!(result.contains("start \"\""));
        assert!(result.contains(r#"/d "E:\git\EasyPack""#));
        assert!(result.contains(r#"cmd /K "claude""#));
    }

    #[test]
    fn test_execute_command_rejects_quoted_command() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(execute_command(
            "E:\\git\\EasyPack".to_string(),
            "echo \"hello\"".to_string(),
        ));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("double quote"));
    }

    #[test]
    fn test_execute_command_rejects_missing_project_directory() {
        let temp_dir = tempfile::tempdir().unwrap();
        let missing_path = temp_dir.path().join("missing-project");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(execute_command(
            missing_path.to_string_lossy().into_owned(),
            "echo hello".to_string(),
        ));

        assert_eq!(result.unwrap_err(), MISSING_PROJECT_DIRECTORY_ERROR);
    }

    #[test]
    fn test_open_folder_rejects_missing_project_directory() {
        let temp_dir = tempfile::tempdir().unwrap();
        let missing_path = temp_dir.path().join("missing-project");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(open_folder(missing_path.to_string_lossy().into_owned()));

        assert_eq!(result.unwrap_err(), MISSING_PROJECT_DIRECTORY_ERROR);
    }

    #[test]
    fn test_resolve_project_subfolder_rejects_empty_and_non_relative_paths() {
        let project = tempfile::tempdir().unwrap();

        let empty = resolve_project_subfolder(&project.path().to_string_lossy(), "");
        assert_eq!(empty.unwrap_err(), EMPTY_PROJECT_RELATIVE_DIRECTORY_ERROR);

        for relative_path in [
            "..\\outside",
            "\\absolute",
            "C:\\absolute",
            "C:relative",
            "\\\\server\\share",
        ] {
            let result =
                resolve_project_subfolder(&project.path().to_string_lossy(), relative_path);
            assert_eq!(
                result.unwrap_err(),
                INVALID_PROJECT_RELATIVE_DIRECTORY_ERROR,
                "path should be rejected: {}",
                relative_path
            );
        }
    }

    #[test]
    fn test_resolve_project_subfolder_distinguishes_missing_and_non_directory_targets() {
        let project = tempfile::tempdir().unwrap();

        let missing = resolve_project_subfolder(&project.path().to_string_lossy(), "bundle");
        assert_eq!(missing.unwrap_err(), MISSING_TARGET_DIRECTORY_ERROR);

        std::fs::write(project.path().join("artifact.txt"), "artifact").unwrap();
        let file = resolve_project_subfolder(&project.path().to_string_lossy(), "artifact.txt");
        assert_eq!(file.unwrap_err(), TARGET_NOT_DIRECTORY_ERROR);
    }

    #[test]
    fn test_resolve_project_subfolder_returns_canonical_directory_inside_project() {
        let project = tempfile::tempdir().unwrap();
        let target = project
            .path()
            .join("src-tauri")
            .join("target")
            .join("release")
            .join("bundle");
        std::fs::create_dir_all(&target).unwrap();

        let resolved = resolve_project_subfolder(
            &project.path().to_string_lossy(),
            "src-tauri\\target\\release\\bundle",
        )
        .unwrap();
        assert_eq!(resolved, std::fs::canonicalize(target).unwrap());
    }

    #[test]
    fn test_open_project_subfolder_rejects_invalid_input_before_spawning_explorer() {
        let temp_dir = tempfile::tempdir().unwrap();
        let missing_path = temp_dir.path().join("missing-project");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(open_project_subfolder(
            missing_path.to_string_lossy().into_owned(),
            "bundle".to_string(),
        ));

        assert_eq!(result.unwrap_err(), MISSING_PROJECT_DIRECTORY_ERROR);
    }

    #[test]
    fn test_execute_script_rejects_missing_project_directory_before_temp_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let missing_path = temp_dir.path().join("missing-project");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(execute_script(
            missing_path.to_string_lossy().into_owned(),
            "echo hello".to_string(),
            false,
            true,
        ));

        assert_eq!(result.unwrap_err(), MISSING_PROJECT_DIRECTORY_ERROR);
    }

    // --- Phase 17: build_bat_content tests ---

    #[test]
    fn test_build_bat_content_strict() {
        let result = build_bat_content(
            "E:\\git\\EasyPack",
            "npm install\nnpm run build",
            false,
            true,
        );
        // Header always present
        assert!(result.contains("@echo off"));
        assert!(result.contains("chcp 65001 >nul"));
        assert!(result.contains(r#"cd /d "E:\git\EasyPack""#));
        // Strict mode: lines joined with " && "
        assert!(result.contains("npm install && npm run build"));
    }

    #[test]
    fn test_build_bat_content_lenient() {
        let result = build_bat_content(
            "E:\\git\\EasyPack",
            "npm install\nnpm run build",
            false,
            false,
        );
        // Header present
        assert!(result.contains("@echo off"));
        assert!(result.contains("chcp 65001 >nul"));
        // Lenient mode: lines joined with " & "
        assert!(result.contains("npm install & npm run build"));
    }

    #[test]
    fn test_build_bat_content_batch_script() {
        let script = "if %ERRORLEVEL% EQU 0 (\n  echo Success\n) else (\n  echo Failed\n)";
        let result = build_bat_content("E:\\git\\EasyPack", script, true, false);
        // Header present
        assert!(result.contains("@echo off"));
        assert!(result.contains("chcp 65001 >nul"));
        // Batch script: content written verbatim (not joined with && or &)
        assert!(result.contains("if %ERRORLEVEL% EQU 0 ("));
        assert!(result.contains("  echo Success"));
        assert!(!result.contains(" && "));
        assert!(!result.contains(" & "));
    }

    #[test]
    fn test_build_bat_content_empty_lines() {
        let result = build_bat_content(
            "E:\\git\\EasyPack",
            "npm install\n\n   \nnpm run build\n  \n  git status",
            false,
            true,
        );
        // Empty and whitespace-only lines should be filtered
        assert!(result.contains("npm install && npm run build && git status"));
        // No double separators from empty lines
        assert!(!result.contains("&& &&"));
    }

    #[test]
    fn test_execute_script_creates_bat_file() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(execute_script(
            "E:\\git\\EasyPack".to_string(),
            "echo hello".to_string(),
            false,
            true,
        ));

        assert!(
            result.is_ok(),
            "execute_script should succeed: {:?}",
            result.err()
        );
        let bat_path = result.unwrap();
        assert!(
            bat_path.contains("easypack-"),
            "Bat file path should contain 'easypack-', got: {}",
            bat_path
        );
        assert!(
            bat_path.ends_with(".bat"),
            "Bat file path should end with '.bat', got: {}",
            bat_path
        );

        // Verify the file exists and has correct content
        let content = std::fs::read_to_string(&bat_path).expect("Should be able to read bat file");
        assert!(content.contains("@echo off"));
        assert!(content.contains("chcp 65001 >nul"));
        assert!(content.contains(r#"cd /d "E:\git\EasyPack""#));
        assert!(content.contains("echo hello"));

        // Clean up
        let _ = std::fs::remove_file(&bat_path);
    }

    // --- Phase 23: read_file_content tests ---

    #[test]
    fn test_read_file_content_ok() {
        let dir = std::env::temp_dir().join(format!("easypack-test-read-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let file_path = dir.join("test.txt");
        std::fs::write(&file_path, "hello world").expect("Should write test file");

        let result = read_file_content(dir.to_string_lossy().to_string(), "test.txt".to_string());
        assert!(
            result.is_ok(),
            "read_file_content should succeed: {:?}",
            result.err()
        );
        // Phase 23 iter-2 WR-01: existing file returns Some(content).
        assert_eq!(result.unwrap(), Some("hello world".to_string()));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_read_file_content_not_found_returns_none() {
        let dir =
            std::env::temp_dir().join(format!("easypack-test-read-missing-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);

        let result = read_file_content(
            dir.to_string_lossy().to_string(),
            "nonexistent.txt".to_string(),
        );
        // Phase 23 iter-2 WR-01: NotFound must surface as Ok(None), NOT Err,
        // so the frontend snapshot loop can safely treat it as "absent" while
        // other read errors hard-abort.
        assert!(
            result.is_ok(),
            "NotFound should be Ok(None), got: {:?}",
            result.err()
        );
        assert_eq!(result.unwrap(), None);

        let _ = std::fs::remove_dir_all(&dir);
    }

    // --- Phase 23: write_file_content tests ---

    #[test]
    fn test_write_file_content_creates_file() {
        let dir = std::env::temp_dir().join(format!("easypack-test-write-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);

        let result = write_file_content(
            dir.to_string_lossy().to_string(),
            "output.txt".to_string(),
            "test content".to_string(),
        );
        assert!(
            result.is_ok(),
            "write_file_content should succeed: {:?}",
            result.err()
        );

        let written =
            std::fs::read_to_string(dir.join("output.txt")).expect("Should read written file");
        assert_eq!(written, "test content");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_write_file_content_nested_path() {
        let dir =
            std::env::temp_dir().join(format!("easypack-test-write-nested-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);

        let result = write_file_content(
            dir.to_string_lossy().to_string(),
            "config/settings.json".to_string(),
            r#"{"key": "value"}"#.to_string(),
        );
        assert!(
            result.is_ok(),
            "write_file_content nested should succeed: {:?}",
            result.err()
        );

        let written = std::fs::read_to_string(dir.join("config").join("settings.json"))
            .expect("Should read nested file");
        assert_eq!(written, r#"{"key": "value"}"#);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_write_file_content_rejects_quoted_path() {
        let result = write_file_content(
            "E:\\git\\EasyPack".to_string(),
            "\"badname.txt".to_string(),
            "content".to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("double quote"));
    }

    // --- Phase 23 review CR-01: resolve_safe_path tests ---

    #[test]
    fn test_resolve_safe_path_rejects_empty() {
        let dir = std::env::temp_dir();
        let result = resolve_safe_path(&dir.to_string_lossy(), "");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_resolve_safe_path_rejects_double_quote() {
        let dir = std::env::temp_dir();
        let result = resolve_safe_path(&dir.to_string_lossy(), "bad\"name.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("double quote"));
    }

    #[test]
    fn test_resolve_safe_path_rejects_absolute() {
        let dir = std::env::temp_dir();
        let abs = if cfg!(windows) {
            "C:\\Windows\\system32\\drivers\\etc\\hosts"
        } else {
            "/etc/hosts"
        };
        let result = resolve_safe_path(&dir.to_string_lossy(), abs);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("relative") || msg.contains("escapes"),
            "should reject absolute, got: {}",
            msg
        );
    }

    #[test]
    fn test_resolve_safe_path_rejects_parent_dir() {
        let dir = std::env::temp_dir();
        let traversal = if cfg!(windows) {
            "..\\..\\..\\Windows\\Start Menu\\Programs\\Startup\\updater.bat"
        } else {
            "../../../etc/passwd"
        };
        let result = resolve_safe_path(&dir.to_string_lossy(), traversal);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("..") || msg.contains("escapes"),
            "should reject parent-dir traversal, got: {}",
            msg
        );
    }

    #[test]
    fn test_resolve_safe_path_accepts_normal_relative() {
        let dir_raw = std::env::temp_dir();
        let _ = std::fs::create_dir_all(&dir_raw);
        // resolve_safe_path canonicalizes the root, so compare against the
        // canonical form (temp_dir() may return a short-name path on Windows).
        let dir_canon = std::fs::canonicalize(&dir_raw).expect("canonicalize temp_dir");
        let result = resolve_safe_path(&dir_raw.to_string_lossy(), "config/settings.json");
        // Sanity: accepted and resolves inside the temp dir.
        assert!(
            result.is_ok(),
            "should accept nested relative, got: {:?}",
            result.err()
        );
        let resolved = result.unwrap();
        assert!(
            resolved.starts_with(&dir_canon),
            "resolved {:?} must stay inside canonical root {:?}",
            resolved,
            dir_canon
        );
        assert!(resolved.ends_with("settings.json"));
    }

    // --- Phase 23 review CR-01: write_file_content rejects traversal ---

    #[test]
    fn test_write_file_content_rejects_absolute_path() {
        let result = write_file_content(
            std::env::temp_dir().to_string_lossy().to_string(),
            "C:\\Windows\\evil.txt".to_string(),
            "content".to_string(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_write_file_content_rejects_traversal() {
        let result = write_file_content(
            std::env::temp_dir().to_string_lossy().to_string(),
            "../../../evil.txt".to_string(),
            "content".to_string(),
        );
        assert!(result.is_err());
    }

    // --- Phase 23 review CR-01/CR-03: read_file_content / delete_file_content ---

    #[test]
    fn test_read_file_content_rejects_absolute() {
        let result = read_file_content(
            std::env::temp_dir().to_string_lossy().to_string(),
            "C:\\Windows\\system32\\drivers\\etc\\hosts".to_string(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_file_content_ok() {
        let dir = std::env::temp_dir().join(format!("easypack-test-delete-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(dir.join("goner.txt"), "bye").expect("Should write test file");

        let result =
            delete_file_content(dir.to_string_lossy().to_string(), "goner.txt".to_string());
        assert!(
            result.is_ok(),
            "delete_file_content should succeed: {:?}",
            result.err()
        );
        assert!(!dir.join("goner.txt").exists(), "file should be gone");

        // Deleting again (idempotent) should still be Ok.
        let result2 =
            delete_file_content(dir.to_string_lossy().to_string(), "goner.txt".to_string());
        assert!(result2.is_ok(), "delete of missing file should be Ok");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_delete_file_content_rejects_traversal() {
        let result = delete_file_content(
            std::env::temp_dir().to_string_lossy().to_string(),
            "../../../evil.txt".to_string(),
        );
        assert!(result.is_err());
    }
}
