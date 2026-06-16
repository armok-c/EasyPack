---
phase: "09"
plan: "01"
subsystem: "frontend-ui"
tags: ["toggle-group", "open-folder", "ui-integration"]
dependency_graph:
  requires: []
  provides: ["open_folder Tauri command", "Toggle Group button row", "openFolder hook"]
  affects: ["MainArea.tsx", "App.tsx", "useProject.ts", "shell.rs", "lib.rs"]
tech_stack:
  added: []
  patterns: ["shadcn Button variants for toggle group", "explorer.exe raw_arg pattern"]
key_files:
  created: []
  modified:
    - src-tauri/src/commands/shell.rs
    - src-tauri/src/lib.rs
    - src/hooks/useProject.ts
    - src/components/MainArea.tsx
    - src/App.tsx
    - src/components/__tests__/MainArea.test.tsx
decisions:
  - "使用手写 Button pair 而非 shadcn ToggleGroup 组件（仅 2 按钮互斥切换，不需要 Radix 抽象）"
  - "open_folder 命令使用 explorer.exe + raw_arg() + 双引号包裹路径，零新依赖"
  - "在 App.tsx 中计算 isProjectToggleDisabled 并作为 prop 传递，而非在 MainArea 中推断"
  - "导出 projectCommandsMap 供 App.tsx 计算 disabled 状态"
metrics:
  duration: "7m30s"
  completed: "2026-04-25"
  tasks: 2
  files: 6
---

# Phase 9 Plan 1: Toggle Group + 打开文件夹按钮 Summary

将 MainArea 中文本链接切换器替换为 Toggle Group 按钮行（全局指令/项目指令拼合按钮 + 打开文件夹 outline 按钮），并在 Rust 后端新增 open_folder 命令，完成需求 PROJ-11 和 UI-10。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rust 后端 open_folder 命令 + 前端 openFolder hook 函数 | bfd47c0 | shell.rs, lib.rs, useProject.ts |
| 2 | MainArea Toggle Group 按钮行 + App.tsx props 传递 | 79fd953 | MainArea.tsx, App.tsx, MainArea.test.tsx |

## What Was Done

### Task 1: open_folder 命令 + openFolder hook

- 在 `shell.rs` 中添加 `open_folder` Tauri 命令，使用 `explorer.exe` + `raw_arg(format!("\"{}\"", path))` 打开文件夹
- 导入 `std::os::windows::process::CommandExt` trait 以启用 `raw_arg` 方法（Windows 特有）
- 在 `lib.rs` 的 `invoke_handler` 中注册 `commands::shell::open_folder`
- 在 `useProject.ts` 中添加 `openFolder` 函数（useCallback），调用 `invoke("open_folder", { path })`
- 错误时显示 toast "无法打开文件夹" + "路径无效或文件夹不存在"
- 从 useProject return 对象导出 `projectCommandsMap` 和 `openFolder`

### Task 2: Toggle Group + 打开文件夹按钮行

- MainArea.tsx: 替换文本链接切换器为 Toggle Group 按钮行
  - 左侧: 两个紧邻拼合 Button（secondary/ghost variant），带 radiogroup 无障碍属性
  - 右侧: outline variant "打开文件夹" 按钮 + FolderOpen 图标
  - 布局: `flex items-center justify-between mt-2`
- MainAreaProps 新增: `onOpenFolder: () => void`, `isProjectToggleDisabled: boolean`
- App.tsx: 计算 `isProjectToggleDisabled`（currentProject 为空或无项目指令集时为 true）
- App.tsx: 添加 `handleOpenFolder` 回调绑定 `currentProject.path`
- 更新测试: 将 4 个旧文本链接测试改为 Toggle Group 按钮测试

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 添加 CommandExt trait 导入**
- **Found during:** Task 1 cargo check
- **Issue:** `raw_arg` 方法需要 `std::os::windows::process::CommandExt` trait 在作用域内，计划中未提及此导入
- **Fix:** 在 shell.rs 顶部添加 `use std::os::windows::process::CommandExt;`
- **Files modified:** src-tauri/src/commands/shell.rs
- **Commit:** bfd47c0

**2. [Rule 3 - Blocking] 更新旧文本链接的测试用例**
- **Found during:** Task 2 test run
- **Issue:** 4 个现有测试期望旧的文本链接 UI（"项目自定义指令", "使用全局指令" 等），与新 Toggle Group UI 不匹配
- **Fix:** 更新测试断言以匹配新 Toggle Group 按钮 UI，使用 `getByRole("radio")` 查询，同时在 getDefaultProps 中补充缺失的 props
- **Files modified:** src/components/__tests__/MainArea.test.tsx
- **Commit:** 79fd953

## Verification Results

| Check | Result |
|-------|--------|
| cargo check | PASSED (1 pre-existing warning: dead_code build_full_command) |
| TypeScript type check (tsc --noEmit) | PASSED |
| Vitest (95 tests) | PASSED |
| grep: open_folder in shell.rs | 1 match |
| grep: commands::shell::open_folder in lib.rs | 1 match |
| grep: invoke("open_folder") in useProject.ts | 1 match |
| grep: role="radiogroup" in MainArea.tsx | 1 match |
| grep: justify-between in MainArea.tsx | 2 matches |
| grep: old text link code in MainArea.tsx | 0 matches (removed) |

## Known Stubs

无。

## Threat Flags

无新威胁面。open_folder 命令路径来自内部存储的 project.path（通过文件夹选择器添加），非用户自由输入，与计划 threat_model 评估一致。

## Self-Check: PASSED

All 7 modified/created files exist on disk. Both commit hashes (bfd47c0, 79fd953) found in git log.
