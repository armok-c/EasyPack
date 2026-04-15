use std::os::windows::process::CommandExt;
use std::process::Command as StdCommand;

/// 构建完整的 Shell 命令字符串
/// 先 cd 到项目目录，再执行目标命令
/// 路径始终用双引号包裹以处理空格和中文 (per D-11, D-13)
pub fn build_full_command(project_path: &str, shell_command: &str) -> String {
    format!("cd /d \"{}\" && {}", project_path, shell_command)
}

/// 构建 Windows Terminal 启动参数
/// 使用 -d 指定工作目录，避免 cd /d + && 引号嵌套问题
fn build_wt_args(project_path: &str, shell_command: &str) -> String {
    format!("new-tab -d \"{}\" cmd /K \"{}\"", project_path, shell_command)
}

/// 构建 cmd.exe 回退启动参数
/// 使用 start /d 指定工作目录，start 的第一个 "" 作为空标题
fn build_cmd_args(project_path: &str, shell_command: &str) -> String {
    format!("/C start \"\" /d \"{}\" cmd /K \"{}\"", project_path, shell_command)
}

/// 在系统终端中执行命令 (per D-07, D-08, D-09)
/// 优先使用 Windows Terminal (wt.exe)，未安装时回退到 cmd.exe
/// 终端窗口保持打开（/K 参数）
#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String> {
    // 优先尝试 Windows Terminal (per D-07, D-01: raw_arg 绕过 MSVC 转义)
    // 使用 -d 设置工作目录，避免引号嵌套问题
    let wt_result = StdCommand::new("wt")
        .raw_arg(build_wt_args(&project_path, &shell_command))
        .spawn();

    if wt_result.is_ok() {
        return Ok(());
    }

    // 回退到 cmd.exe: 使用 start /d 指定工作目录 (per D-07 回退, D-08 独立窗口, D-01: raw_arg)
    StdCommand::new("cmd")
        .raw_arg(build_cmd_args(&project_path, &shell_command))
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

    #[test]
    fn test_wt_args_basic() {
        let args = build_wt_args("E:\\git\\MultiHub", "claude");
        assert_eq!(args, "new-tab -d \"E:\\git\\MultiHub\" cmd /K \"claude\"");
    }

    #[test]
    fn test_wt_args_path_with_spaces() {
        let args = build_wt_args("D:\\My Projects\\app", "npm run build");
        assert!(args.contains("-d \"D:\\My Projects\\app\""));
        assert!(args.contains("cmd /K \"npm run build\""));
    }

    #[test]
    fn test_wt_args_path_with_cjk() {
        let args = build_wt_args("D:\\用户\\项目\\EasyPack", "git pull");
        assert!(args.contains("-d \"D:\\用户\\项目\\EasyPack\""));
        assert!(args.contains("cmd /K \"git pull\""));
    }

    #[test]
    fn test_cmd_args_basic() {
        let args = build_cmd_args("E:\\git\\MultiHub", "claude");
        assert_eq!(args, "/C start \"\" /d \"E:\\git\\MultiHub\" cmd /K \"claude\"");
    }

    #[test]
    fn test_cmd_args_path_with_spaces() {
        let args = build_cmd_args("D:\\My Projects\\app", "npm run dev");
        assert!(args.contains("start \"\""));
        assert!(args.contains("/d \"D:\\My Projects\\app\""));
        assert!(args.contains("cmd /K \"npm run dev\""));
    }
}
