---
status: resolved
trigger: "文件夹大小计算不对"
created: "2026-05-12"
updated: "2026-05-12"
---

# Debug Session: folder-size-mismatch

## Symptoms

- **Expected:** 文件夹大小显示应与 Windows 资源管理器一致
- **Actual:** 计算结果与资源管理器显示的数值不一致
- **Errors:** 无报错
- **Timeline:** 一直存在，从未准确过
- **Reproduction:** 添加项目后查看文件夹大小

## Current Focus

**hypothesis:** RESOLVED
**test:** RESOLVED
**expecting:** RESOLVED
**next_action:** present root cause and fix
**reasoning_checkpoint:**
**tdd_checkpoint:**

## Evidence

- 2026-05-12: `src-tauri/src/commands/project_info.rs` 第 21-36 行定义了 `EXCLUDED_DIRS` 常量，排除 node_modules、.git、target、dist、build、vendor 等目录
- 2026-05-12: `calculate_dir_size()` 函数在第 89 行检查 `EXCLUDED_DIRS.contains(&name.as_ref())`，跳过这些目录的大小
- 2026-05-12: 第 96 行注释 "Skip symlinks and other special file types" — 符号链接被跳过
- 2026-05-12: `format_size()` 使用二进制单位（1024 倍数）标注为 KB/MB/GB，技术上应为 KiB/MiB/GiB，但 Windows 资源管理器也用二进制单位标 KB/MB/GB，所以单位标签不是主要差异
- 2026-05-12: Windows 资源管理器计算所有文件和目录（包括 node_modules、.git 等），不排除任何目录
- 2026-05-12: 根本原因是 EXCLUDED_DIRS 导致计算结果远小于实际大小

## Eliminated

- 单位换算差异：排除，Windows 资源管理器也使用二进制单位
- 前端显示逻辑问题：排除，前端直接展示 Rust 返回的字符串

## Resolution

**root_cause:** `calculate_dir_size()` 排除了 `EXCLUDED_DIRS`（node_modules、.git、target、dist、build、vendor 等 15 个目录），导致计算出的文件夹大小远小于 Windows 资源管理器显示的实际大小。
**fix:** 移除 EXCLUDED_DIRS 排除逻辑，让 `calculate_dir_size()` 递归计算所有文件和子目录的大小，与 Windows 资源管理器行为一致。
**verification:** 对比修改前后计算结果与 Windows 资源管理器显示值
**files_changed:** `src-tauri/src/commands/project_info.rs`
