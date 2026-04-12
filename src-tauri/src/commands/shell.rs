use std::process::Command as StdCommand;

/// 构建完整的 Shell 命令字符串
/// 先 cd 到项目目录，再执行目标命令
/// 路径始终用双引号包裹以处理空格和中文 (per D-11, D-13)
pub fn build_full_command(project_path: &str, shell_command: &str) -> String {
    format!("cd /d \"{}\" && {}", project_path, shell_command)
}

/// 在系统终端中执行命令 (per D-07, D-08, D-09)
/// 优先使用 Windows Terminal (wt.exe)，未安装时回退到 cmd.exe
/// 终端窗口保持打开（/K 参数）
#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String> {
    let full_command = build_full_command(&project_path, &shell_command);

    // 优先尝试 Windows Terminal (per D-07)
    let wt_result = StdCommand::new("wt")
        .args(["new-tab", "cmd", "/K", &full_command])
        .spawn();

    if wt_result.is_ok() {
        return Ok(());
    }

    // 回退到 cmd.exe: /C 执行 start 命令打开新窗口 (per D-07 回退, D-08 独立窗口)
    StdCommand::new("cmd")
        .args(["/C", "start", "cmd", "/K", &full_command])
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_full_command_basic() {
        let result = build_full_command("D:\\Projects\\EasyPack", "npm run build");
        assert_eq!(result, "cd /d \"D:\\Projects\\EasyPack\" && npm run build");
    }

    #[test]
    fn test_build_full_command_path_with_spaces() {
        let result = build_full_command("D:\\My Projects\\app", "npm run dev");
        assert!(result.contains("cd /d \"D:\\My Projects\\app\""));
        assert!(result.contains("npm run dev"));
    }

    #[test]
    fn test_build_full_command_path_with_cjk() {
        let result = build_full_command("D:\\用户\\项目\\EasyPack", "git pull");
        assert!(result.contains("cd /d \"D:\\用户\\项目\\EasyPack\""));
        assert!(result.contains("git pull"));
    }

    #[test]
    fn test_build_full_command_all_preset_commands() {
        let path = "D:\\Projects\\EasyPack";
        let commands = ["npm run build", "npm run dev", "git pull", "claude"];
        for cmd in commands {
            let result = build_full_command(path, cmd);
            assert!(result.starts_with("cd /d \""));
            assert!(result.contains(cmd));
        }
    }
}
