---
phase: 01-shell
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/shell.rs
  - src-tauri/src/lib.rs
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
autonomous: true
requirements:
  - CMD-04

must_haves:
  truths:
    - "Rust execute_command 函数接受 project_path 和 shell_command 参数，在系统终端中执行命令"
    - "优先使用 Windows Terminal (wt.exe)，未安装时回退到 cmd.exe"
    - "终端窗口保持打开（/K 参数），用户可查看输出"
    - "路径含空格或中文时命令正确执行（路径用双引号包裹）"
    - "execute_command 注册到 Tauri generate_handler!，前端可通过 invoke 调用"
  artifacts:
    - path: "src-tauri/src/commands/shell.rs"
      provides: "Shell 命令执行核心逻辑"
      contains: "execute_command"
    - path: "src-tauri/src/commands/mod.rs"
      provides: "命令模块入口"
      contains: "pub mod shell"
    - path: "src-tauri/src/lib.rs"
      provides: "Tauri Builder 命令注册"
      contains: "generate_handler"
  key_links:
    - from: "src-tauri/src/lib.rs"
      to: "src-tauri/src/commands/shell.rs"
      via: "mod commands + generate_handler![commands::execute_command]"
      pattern: "commands::execute_command"
    - from: "src-tauri/src/commands/shell.rs"
      to: "std::process::Command"
      via: "use std::process::Command"
      pattern: "std::process::Command"
---

<objective>
Tauri 权限配置与 Rust 命令执行核心实现

Purpose: 实现应用核心能力——在系统终端中执行 Shell 命令。这是 EasyPack 的核心价值所在：选中项目 -> 点击按钮 -> 终端执行。

Output: Rust 后端的 execute_command 命令，通过 Tauri IPC 注册，前端可通过 invoke('execute_command', {...}) 调用，在 Windows Terminal 或 cmd.exe 中打开新终端窗口执行命令。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-shell/01-CONTEXT.md
@.planning/phases/01-shell/01-RESEARCH.md
</context>

<interfaces>
<!-- Plan 01 创建的基础设施，本 Plan 依赖但不修改 -->

From src-tauri/src/lib.rs (Plan 01 创建的骨架):
```rust
mod commands;
// Plan 01 仅注册了 Dialog Plugin，未注册 invoke_handler
```

From src-tauri/Cargo.toml (Plan 01 添加的依赖):
```toml
tauri-plugin-dialog, serde (with derive), serde_json
```

From src-tauri/capabilities/default.json (Plan 01 创建):
```json
{
  "permissions": ["core:default", "dialog:default"]
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: 实现 execute_command Rust 命令并编写单元测试</name>
  <files>
    src-tauri/src/commands/shell.rs, src-tauri/src/commands/mod.rs, src-tauri/src/lib.rs
  </files>
  <read_first>
    @.planning/phases/01-shell/01-RESEARCH.md (Pattern 1: Tauri 自定义命令 + Code Examples: Windows Terminal 检测与回退 + Pitfall 3: Windows 路径空格和中文 + Pitfall 4: async 命令使用借用类型 + Pitfall 5: generate_handler 遗漏注册)
    @src-tauri/src/lib.rs (确认当前状态，Plan 01 可能已创建骨架)
    @src-tauri/src/commands/mod.rs (确认模块入口状态)
  </read_first>
  <behavior>
    Rust 单元测试用例（在 src-tauri/src/commands/shell.rs 的 #[cfg(test)] mod tests 中）：

    - test_execute_command_basic: 验证 execute_command 函数接受合法路径和命令参数，构建正确的完整命令字符串。使用 mock 或直接测试内部命令构建逻辑。
    - test_path_with_spaces: 验证路径 "D:\\My Projects\\app" 被正确用双引号包裹，生成的命令中包含 `cd /d "D:\My Projects\app"`。
    - test_path_with_cjk: 验证路径 "D:\\用户\\项目" 被正确处理，路径用双引号包裹。
    - test_terminal_fallback: 验证当 wt.exe 不可用时（spawn 返回 Err），回退到 cmd.exe 路径。

    注意：由于 execute_command 实际会打开终端窗口，单元测试应测试命令构建逻辑（将命令构建提取为独立可测试函数），而非直接调用 execute_command。
  </behavior>
  <action>
## 步骤 1: 创建命令构建辅助函数（可测试）

编辑 src-tauri/src/commands/shell.rs：

```rust
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
```

## 步骤 2: 更新命令模块入口

编辑 src-tauri/src/commands/mod.rs：

```rust
pub mod shell;

pub use shell::execute_command;
```

## 步骤 3: 更新 lib.rs 注册命令

编辑 src-tauri/src/lib.rs：

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::execute_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

注意：所有命令必须集中在一个 generate_handler![] 调用中注册（per RESEARCH.md Pitfall 5）。

## 步骤 4: 运行 Rust 单元测试

```bash
cd E:/GitLib/EasyPack/src-tauri && cargo test -- --nocapture
```

所有 4 个测试必须通过。

## 步骤 5: 验证 Rust 编译

```bash
cd E:/GitLib/EasyPack/src-tauri && cargo build
```

编译通过，无警告或错误。
  </action>
  <verify>
    <automated>cd E:/GitLib/EasyPack/src-tauri && cargo test -- --nocapture 2>&1 | tail -20</automated>
  </verify>
  <done>
    - src-tauri/src/commands/shell.rs 包含 build_full_command 辅助函数和 execute_command Tauri 命令
    - execute_command 使用 String 参数（非 &str），async 函数签名正确
    - 命令构建逻辑将路径用双引号包裹
    - 优先尝试 wt.exe，失败回退 cmd.exe
    - 使用 /K 参数保持终端打开
    - generate_handler! 中注册了 execute_command
    - cargo test 4 个测试全部通过
    - cargo build 编译成功
  </done>
</task>

<task type="auto">
  <name>Task 2: 验证 Tauri IPC 调用端到端工作</name>
  <files>
    src-tauri/src/commands/shell.rs (如需调整)
  </files>
  <read_first>
    @src-tauri/src/commands/shell.rs (确认 execute_command 实现)
    @src-tauri/src/lib.rs (确认 generate_handler 注册)
    @src-tauri/capabilities/default.json (确认权限配置)
  </read_first>
  <action>
通过 `npx tauri dev` 启动应用，验证 Rust 命令可通过 IPC 调用。

在浏览器 DevTools 控制台中测试：

```javascript
// 测试 execute_command 是否已注册
const { invoke } = window.__TAURI__.core;
// 使用一个安全的测试路径和命令
await invoke('execute_command', { projectPath: 'C:\\Windows', shellCommand: 'echo test' });
```

预期行为：
- 如果安装了 Windows Terminal：新 wt.exe 标签页打开，显示 "C:\Windows" 目录下执行 echo test
- 如果未安装 Windows Terminal：新 cmd.exe 窗口打开，显示同样内容
- 终端窗口保持打开（因为使用 /K 参数）

如果 invoke 抛出 "Command not found" 错误，检查 lib.rs 中 generate_handler! 是否正确注册。
如果抛出 "Not allowed" 错误，检查 capabilities/default.json 是否配置正确。
  </action>
  <verify>
    <automated>cd E:/GitLib/EasyPack/src-tauri && cargo test -- --nocapture 2>&1 | grep -E "test result|running" && cd .. && grep -c "generate_handler" src-tauri/src/lib.rs && grep -c "execute_command" src-tauri/src/lib.rs && grep -c "execute_command" src-tauri/src/commands/mod.rs</automated>
  </verify>
  <done>
    - cargo test 所有测试通过
    - lib.rs 包含 generate_handler![commands::execute_command]
    - capabilities/default.json 包含 core:default 权限
    - 通过 DevTools invoke 调用 execute_command 能成功打开终端窗口
    - 终端窗口保持打开状态
  </done>
</task>

</tasks>

<verification>
1. `cd src-tauri && cargo test` -- 所有单元测试通过
2. `cd src-tauri && cargo build` -- 编译成功无错误
3. src-tauri/src/lib.rs 包含 `generate_handler![commands::execute_command]`
4. src-tauri/src/commands/shell.rs 包含 `build_full_command` 辅助函数
5. 路径构建逻辑使用双引号包裹路径
6. wt.exe 优先 + cmd.exe 回退逻辑完整
</verification>

<success_criteria>
- Rust execute_command 命令实现完整并通过单元测试
- 命令通过 Tauri IPC 正确注册
- 前端可通过 invoke('execute_command', { projectPath, shellCommand }) 调用
- 命令在 Windows Terminal 或 cmd.exe 中执行
- 终端窗口保持打开（/K 参数）
- 路径空格和中文正确处理
</success_criteria>

<output>
After completion, create `.planning/phases/01-shell/01-02-SUMMARY.md`
</output>
