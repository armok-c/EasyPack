# Spike Manifest

## Idea
Phase 12 系统托盘功能经过 9 轮代码审查和多次修复仍然不工作。用最小化原型验证 Tauri 2.x JS tray API 是否能在 Windows 环境下正常工作。

## Requirements
- `PredefinedMenuItem.new()` 的 `item` 参数必须是字符串（如 `"Separator"`），不能嵌套对象
- `tauri.conf.json` 中不应有静态 `trayIcon` 声明（与动态创建冲突）
- `showMenuOnLeftClick` 必须显式设为 `false`，否则左键点击弹菜单而非触发 action

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | minimal-tray-api | standard | Tauri 2 JS tray API 能否在 Windows 上创建托盘+菜单+action 回调 | VALIDATED | tauri, tray, windows, runtime |
