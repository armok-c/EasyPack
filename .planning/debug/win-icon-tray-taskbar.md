---
status: resolved
trigger: "Windows 图标显示有问题，托盘和任务栏都没显示"
created: "2026-05-12"
updated: "2026-05-12"
---

# Debug: Windows 图标 - 托盘和任务栏都不显示

## Symptoms
- 系统托盘（System Tray）没有显示应用图标
- 任务栏（Taskbar）图标不正确或缺失

## Initial Findings

### 1. icon.ico 只有 16x16 单一尺寸
- 文件大小仅 913 字节
- `file` 命令确认：`MS Windows icon resource - 1 icon, 16x16`
- Windows 需要多种尺寸（16, 32, 48, 256）才能正确显示任务栏和托盘图标

### 2. 没有托盘图标创建代码
- `lib.rs` 有 `on_tray_icon_event` 事件处理器（第 51 行）
- 但没有 `TrayIconBuilder::new(app).build()` 创建实际的托盘图标
- Cargo.toml 已启用 `tray-icon` feature

### 3. tauri.conf.json 缺少 trayIcon 配置
- 没有托盘图标的菜单或 tooltip 配置

## Root Cause Hypothesis
1. **任务栏图标**: icon.ico 尺寸不足（仅16x16），Windows 无法获取正确的任务栏图标
2. **托盘图标**: 缺少 TrayIconBuilder 创建代码和 tauri.conf.json 中的 trayIcon 配置
