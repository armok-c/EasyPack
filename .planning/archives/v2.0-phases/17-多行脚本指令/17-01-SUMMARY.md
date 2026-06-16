---
phase: 17-多行脚本指令
plan: 01
subsystem: rust-backend, typescript-types
tags: [execute_script, tempfile, bat-file, multi-line, backward-compat]
dependency_graph:
  requires: []
  provides: [execute_script command, build_bat_content helper, CommandItem scriptLines/executionMode]
  affects: [src-tauri/src/commands/shell.rs, src-tauri/src/lib.rs, src/lib/types.ts, src-tauri/Cargo.toml]
tech_stack:
  added:
    - tempfile 3.x (Rust crate)
    - tokio 1.x (Rust dev-dependency)
  patterns:
    - tempfile::Builder with prefix/suffix/rand_bytes for unique .bat files
    - into_temp_path().keep() to prevent auto-deletion
    - Optional TypeScript fields for backward-compatible interface extension
key_files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - src-tauri/src/commands/shell.rs
    - src-tauri/src/lib.rs
    - src/lib/types.ts
decisions:
  - Used tempfile::Builder with .keep() instead of uuid crate for .bat file naming (avoids extra dependency)
  - scriptLines as \n-separated string (not string[]) for simpler serialization and direct CM6 EditorState compat
  - Added tokio as dev-dependency only (not production) for async test support
metrics:
  duration: 10m
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 5
  tests_added: 5
  tests_passing: 23 (full Rust suite)
---

# Phase 17 Plan 01: Rust Backend Multi-line Script Execution + Type Extension Summary

Rust 后端多行脚本执行基础设施（execute_script command + build_bat_content helper）和前端 CommandItem 类型向后兼容扩展，为 Plan 02 的 UI 集成提供调用入口。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | tempfile 依赖 + execute_script command + build_bat_content helper | e28237b | src-tauri/Cargo.toml, src-tauri/Cargo.lock, src-tauri/src/commands/shell.rs |
| 2 | 注册 execute_script + 扩展 CommandItem 类型 | 0fec408 | src-tauri/src/lib.rs, src/lib/types.ts |

## Key Deliverables

### execute_script Tauri Command

前端可通过 `invoke("execute_script", { projectPath, scriptContent, isBatchScript, strict })` 调用。流程：
1. `build_bat_content()` 生成 .bat 内容（头部始终包含 @echo off + chcp 65001 + cd /d）
2. `tempfile::Builder` 在系统 temp 目录创建带 "easypack-" 前缀的 .bat 文件
3. `.into_temp_path().keep()` 保留文件不自动删除（per D-09）
4. `cmd /C start "" /d "path" cmd /K "bat_path"` 在新终端执行

### build_bat_content Helper

三种模式：
- **strict (&&)**: 非空行用 " && " 连接，前一条失败则后续不执行
- **lenient (&)**: 非空行用 " & " 连接，前一条失败仍继续
- **batch**: 脚本内容原样写入，不过滤不连接

### CommandItem Type Extension

新增两个可选字段（向后兼容）：
- `scriptLines?: string` -- 多行脚本内容，\n 分隔
- `executionMode?: "strict" | "lenient" | "batch"` -- 执行模式，默认 strict

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `cargo test` -- 23 tests passed (10 shell tests, including 5 new)
- `cargo check` -- zero errors
- `tsc --noEmit` -- zero errors
- `grep "execute_script" lib.rs` -- confirmed registered
- `grep "scriptLines" types.ts` -- confirmed type extension
- `grep "tempfile" Cargo.toml` -- confirmed dependency

## Self-Check: PASSED

All created/modified files verified present. All commits verified in git log.
