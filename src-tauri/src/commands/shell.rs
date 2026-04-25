use std::process::Command as StdCommand;
use std::os::windows::process::CommandExt;

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
    // 优先尝试 Windows Terminal
    // 使用 .args() 将每个参数作为独立 token 传递，WT 才能正确解析
    // -d 指定工作目录，避免 cd /d + && 引号嵌套问题
    let wt_result = StdCommand::new("wt")
        .args(["new-tab", "-d", &project_path, "cmd", "/K", &shell_command])
        .spawn();

    if wt_result.is_ok() {
        return Ok(());
    }

    // 回退到 cmd.exe: 使用 start /d 指定工作目录，独立窗口
    StdCommand::new("cmd")
        .args(["/C", "start", "", "/d", &project_path, "cmd", "/K", &shell_command])
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(())
}

/// 在 Windows 文件资源管理器中打开项目文件夹 (per D-04)
/// 使用 explorer.exe + raw_arg() 模式，路径用双引号包裹处理空格
#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    StdCommand::new("explorer.exe")
        .raw_arg(format!("\"{}\"", path))
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
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
