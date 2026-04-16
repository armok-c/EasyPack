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
#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String> {
    let args = build_cmd_start_args(&project_path, &shell_command);
    StdCommand::new("cmd")
        .raw_arg(&args)
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(())
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
}
