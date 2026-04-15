---
phase: 01-shell
plan: 02
subsystem: shell
tags: [rust, tauri-command, std-process, windows-terminal, cmd-exe, ipc]

# Dependency graph
requires:
  - phase: 01-shell (Plan 01)
    provides: Tauri 项目骨架、commands 模块结构、Cargo.toml 依赖、capabilities 配置
provides:
  - execute_command Tauri 命令（前端可通过 invoke 调用）
  - build_full_command 辅助函数（可测试的命令构建逻辑）
  - Windows Terminal (wt.exe) 优先 + cmd.exe 回退机制
  - 路径双引号包裹（处理空格和中文）
  - /K 参数保持终端打开
affects: [01-shell Plan 03, 前端命令执行 UI]

# Tech tracking
tech-stack:
  added: [std::process::Command (Rust stdlib)]
  patterns: [tauri-command, async-string-params, terminal-fallback, path-quoting]

key-files:
  created:
    - src-tauri/src/commands/shell.rs
  modified:
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "generate_handler! 使用 commands::shell::execute_command 完整路径（pub use 重导出导致 __cmd__ 符号找不到）"
  - "命令构建逻辑提取为独立 build_full_command 函数，便于单元测试"
  - "使用 std::process::Command 而非 tauri-plugin-shell（避免 CVE-2025-31477）"

patterns-established:
  - "Tauri 命令模式: async fn + String 参数 + Result<(), String> 返回"
  - "终端检测模式: spawn() 成功即使用 wt.exe，失败回退 cmd.exe"
  - "路径安全: format!(\"cd /d \\\"{}\\\" && {}\", path, cmd) 双引号包裹"

requirements-completed: [CMD-04]

# Metrics
duration: 6min
completed: 2026-04-12
---

# Phase 1 Plan 2: Shell 命令执行核心 Summary

**Rust execute_command 命令实现，使用 std::process::Command 优先启动 Windows Terminal (wt.exe)，回退 cmd.exe，路径双引号包裹处理空格和中文**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-12T08:39:01Z
- **Completed:** 2026-04-12T08:45:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- 实现了 execute_command Tauri 异步命令，前端可通过 invoke('execute_command', {...}) 调用
- 提取了 build_full_command 可测试辅助函数，路径始终用双引号包裹
- 实现了 wt.exe 优先 + cmd.exe 回退机制
- 编写了 4 个单元测试全部通过（基础路径、空格路径、中文路径、预设命令）

## Task Commits

Each task was committed atomically:

1. **Task 1: 实现 execute_command Rust 命令并编写单元测试** - `f3d9dea` (feat)
2. **Task 2: 验证 Tauri IPC 调用端到端工作** - 无新提交（验证性任务，所有检查通过）

## Files Created/Modified
- `src-tauri/src/commands/shell.rs` - Shell 命令执行核心逻辑（build_full_command + execute_command + 4 个单元测试）
- `src-tauri/src/commands/mod.rs` - 命令模块入口（pub mod shell）
- `src-tauri/src/lib.rs` - Tauri Builder 注册 invoke_handler

## Decisions Made
- **generate_handler! 使用完整路径**: 尝试通过 `pub use` 重导出 `execute_command` 到 `commands` 模块根级，但 Tauri 的 `generate_handler!` 宏生成 `__cmd__execute_command` 符号时无法通过重导出找到。改用 `commands::shell::execute_command` 完整路径。
- **命令构建逻辑提取为独立函数**: 将 `format!("cd /d \"{}\" && {}", ...)` 逻辑提取为 `build_full_command`，使单元测试可以直接验证命令字符串构建而不触发实际终端窗口打开。
- **保持 mod.rs 简洁**: 移除了未使用的 `pub use shell::execute_command`，避免编译警告。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `generate_handler![commands::execute_command]` 编译失败（`__cmd__execute_command` 找不到）。原因是 `pub use` 重导出与 Tauri 宏的符号生成机制不兼容。改用 `commands::shell::execute_command` 完整路径解决。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Shell 命令执行核心已完成，前端可通过 `invoke('execute_command', { projectPath, shellCommand })` 调用
- Plan 03（前端 UI）可直接集成 execute_command
- capabilities/default.json 中 core:default 权限足够，无需额外配置 shell 权限

## Self-Check: PASSED

- [x] src-tauri/src/commands/shell.rs exists
- [x] src-tauri/src/commands/mod.rs exists
- [x] src-tauri/src/lib.rs exists
- [x] 01-02-SUMMARY.md exists
- [x] Commit f3d9dea exists in git log

---
*Phase: 01-shell*
*Completed: 2026-04-12*
