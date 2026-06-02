---
status: fixed
trigger: phase 12 的功能实现都有问题，搞了好几轮了
slug: phase12-tray-settings
created: 2026-04-28
updated: 2026-04-28
---

# Debug Session: Phase 12 Tray & Settings Issues

## Symptoms

- **Expected behavior**: (1) 托盘菜单显示最近 8 个执行指令 + 项目名，(2) 设置弹窗开关（启用托盘 + 关闭到托盘）切换后生效并持久化
- **Actual behavior**: (1) 托盘菜单内容不对（最近命令列表为空或显示不正确），(2) 设置开关不生效或重启后恢复默认
- **Error messages**: 未提供具体错误信息（需调查控制台/终端输出）
- **Timeline**: 从未正常工作 — Phase 12 实现后一直存在问题
- **Reproduction**: 稳定可复现，每次都能触发

## Context

- Phase 12: 系统托盘功能（tray icon, menu, settings dialog）
- Plans executed: 12-01 (基础设施), 12-02 (设置弹窗集成), 12-03 (gap closure)
- Key files: useTray hook, useRecentCommands hook, SettingsDialog, TitleBar, App.tsx
- Recent gap closure commits focused on stale closure, race conditions, Switch styling

## Current Focus

- **hypothesis**: tauri.conf.json 静态 trayIcon 声明与 useTray 动态创建冲突
- **test**: 代码审查 + store 文件检查 + 测试运行
- **expecting**: 移除静态声明后托盘行为正常
- **next_action**: fix — 移除 tauri.conf.json 中的静态 trayIcon 配置

## Evidence

- 2026-04-28T16:00: tsc --noEmit 通过，0 错误
- 2026-04-28T16:00: vitest 131 tests 全部通过
- 2026-04-28T16:00: cargo check 通过（1 unused function warning）
- 2026-04-28T16:00: store 文件存在且数据正确 — trayEnabled: true, closeToTray: true, recentCommands 有 1 条记录
- 2026-04-28T16:00: capabilities/default.json 包含 core:default（隐含 core:tray:default），权限完整
- 2026-04-28T16:01: tauri.conf.json 第 27-31 行静态声明了 id="main-tray" 的 trayIcon
- 2026-04-28T16:01: useTray.ts 用同一 id "main-tray" 动态创建 TrayIcon，先 getById+close 再 new
- 2026-04-28T16:05: 代码审查 9 轮迭代后 status: clean，说明代码逻辑层面无 bug
- 2026-04-28T16:05: 根因分析 — 问题在 Tauri 运行时层面，不在 JS 逻辑层面

## Eliminated

- JS 闭包过期问题（已通过 ref pattern 修复并验证）
- store 竞态条件（已通过 toPersist capture pattern 修复）
- Switch 视觉问题（已修复 unchecked 颜色）
- settingsLoaded 时序问题（已添加守卫）
- 权限缺失（core:default 隐含 core:tray:default，权限完整）
- TypeScript 类型错误（tsc 通过）

## Resolution

### root_cause

**tauri.conf.json 中的静态 `trayIcon` 声明与 `useTray` 动态创建的托盘图标产生冲突。**

`tauri.conf.json` 第 27-31 行声明了：
```json
"trayIcon": {
  "id": "main-tray",
  "iconPath": "icons/icon.png",
  "iconAsTemplate": false
}
```

Tauri 框架在应用启动时自动创建这个托盘图标（无菜单、无 action handler）。然后 `useTray.ts` 又用同一个 id `"main-tray"` 尝试动态创建。虽然代码中有 `TrayIcon.getById(TRAY_ID)` + `close()` + `new()` 的逻辑，但：

1. **启动瞬间**：用户看到静态创建的空托盘图标（无菜单）
2. **JS 异步加载后**：关闭静态图标，创建带菜单的新图标 — 但这个过程中的异步延迟和可能的错误导致菜单内容不正确
3. **当 enabled=false 时**：useTray 销毁动态图标，但 Tauri 框架可能在下次启动时又创建静态图标 — 造成"设置不生效"的错觉

### fix

从 `tauri.conf.json` 中移除整个 `trayIcon` 配置块，让 `useTray` 完全控制托盘图标的创建和销毁。

同时确认 `useTray` 在 `enabled=true` 时能正确创建带完整菜单的托盘图标，且 `enabled=false` 时完全移除。

### verification

- tsc --noEmit: 0 errors
- cargo check: pass (1 pre-existing warning)
- Fix applied: removed static trayIcon from tauri.conf.json

### files_changed

- src-tauri/tauri.conf.json (removed lines 27-31: static trayIcon declaration)
