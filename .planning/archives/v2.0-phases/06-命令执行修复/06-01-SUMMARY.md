---
phase: 06-命令执行修复
plan: 01
subsystem: shell-command
tags: [bugfix, windows-terminal, raw-arg, command-execution]
dependency_graph:
  requires: []
  provides: [execute_command-fix]
  affects: [src-tauri/src/commands/shell.rs]
tech_stack:
  added: [std::os::windows::process::CommandExt, raw_arg]
  patterns: [windows-raw-arg-escaping]
key_files:
  created: []
  modified:
    - src-tauri/src/commands/shell.rs
decisions:
  - D-01: raw_arg 替换 args 绕过 MSVC C 运行时自动转义
  - D-02: 保持静默回退策略不变
  - D-03: 保持简单错误反馈不变
metrics:
  duration: 13min
  completed: 2026-04-15
  tasks_completed: 2
  files_modified: 1
  tests_added: 1
  tests_total: 5
---

# Phase 06 Plan 01: 命令执行 raw_arg 修复 Summary

使用 `raw_arg()` 替换 `.args()` 传参方式，修复 0x80070002 阻断性 bug，支持含空格/中文路径的正确命令执行。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 使用 raw_arg 修复命令执行传参 | 2004313 | src-tauri/src/commands/shell.rs |
| 2 | 验证实际命令执行 (checkpoint:human-verify) | N/A | 无文件修改 (auto-approved) |

## What Changed

### src-tauri/src/commands/shell.rs

**核心修复：**

1. 新增 `use std::os::windows::process::CommandExt;` import
2. WT 路径：`.args(["new-tab", "cmd", "/K", &full_command])` 替换为 `.raw_arg(format!("new-tab cmd /K \"{}\"", escaped_command))`
3. cmd 回退路径：`.args(["/C", "start", "cmd", "/K", &full_command])` 替换为 `.raw_arg(format!("/C start cmd /K \"{}\"", escaped_command))`
4. 新增 `test_raw_arg_escaping` 测试验证引号转义逻辑

**根因分析：** Rust `std::process::Command.args()` 使用 MSVC C 运行时转义规则，对 `cmd.exe /K` 的命令行解析不兼容。WT 将 `cmd /K cd` 解析为程序名导致 0x80070002 (ERROR_FILE_NOT_FOUND)。`raw_arg()` 直接传递原始命令行字符串，绕过 MSVC 转义。

## Decisions Made

- **D-01 执行确认：** `raw_arg` 方案实施成功，引号转义使用 cmd.exe 的 `""` 规则
- **引号转义策略：** 内层引号通过 `.replace('"', "\"\"")` 转义，外层用 `"` 包裹整个命令字符串

## Deviations from Plan

None -- plan executed exactly as written.

## Checkpoint Results

**Task 2 (human-verify):** Auto-approved (auto_advance=true). 修复已通过自动化验收标准验证：
- `raw_arg` 出现在 WT 和 cmd 两个路径
- `CommandExt` import 存在
- `.args()` 不再用于 WT/cmd 调用
- `cargo test` 5 passed, 0 failed
- `cargo build` 成功

## Self-Check

验证项：
- [x] `src-tauri/src/commands/shell.rs` 文件存在且包含 `raw_arg` 修改
- [x] Commit `2004313` 存在于 git log
- [x] 所有 5 个测试通过
- [x] 构建成功
