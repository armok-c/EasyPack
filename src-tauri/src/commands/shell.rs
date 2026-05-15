use std::os::windows::process::CommandExt;
use std::process::Command as StdCommand;

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
    let args = build_cmd_start_args(&project_path, &shell_command);
    StdCommand::new("cmd")
        .raw_arg(&args)
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(())
}

/// 在 Windows 文件资源管理器中打开项目文件夹 (per D-04)
/// 使用 explorer.exe + raw_arg() 模式，路径用双引号包裹处理空格
#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    if path.contains('"') {
        return Err("Invalid path: contains double quote".to_string());
    }
    StdCommand::new("explorer.exe")
        .raw_arg(format!("\"{}\"", path))
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(())
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
    let header = format!(
        "@echo off\nchcp 65001 >nul\ncd /d \"{}\"",
        project_path
    );

    if is_batch_script {
        // Batch script: write content verbatim (per D-05)
        format!("{}\n{}", header, script_lines)
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
            format!("{}\n{}", header, joined)
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

    StdCommand::new("cmd")
        .raw_arg(&args)
        .spawn()
        .map_err(|e| format!("Failed to execute script: {}", e))?;

    Ok(bat_path_str)
}

#[cfg(test)]
mod tests {
    use super::*;

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
        // 验证空标题参数 "" 存在（防止路径被 start 当作标题）
        assert!(result.contains("start \"\""));
        // 验证 /d 目录参数被引号包裹
        assert!(result.contains(r#"/d "E:\git\EasyPack""#));
        // 验证命令被引号包裹
        assert!(result.contains(r#"cmd /K "claude""#));
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

        assert!(result.is_ok(), "execute_script should succeed: {:?}", result.err());
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
}
