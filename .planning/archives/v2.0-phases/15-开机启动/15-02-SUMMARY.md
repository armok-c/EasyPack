---
phase: 15-开机启动
plan: 02
status: completed
wave: 2
depends_on: ["15-01"]
---

# Plan 15-02 Summary: 前端 UI 集成 autostart 开关

## Completed Tasks

### Task 1: App.tsx 添加 autostart 状态管理 + SettingsDialog 添加 Switch

**Changes:**
- `src/App.tsx`:
  - 导入 `enable/disable` from `@tauri-apps/plugin-autostart`
  - 添加 `autostartEnabled` state
  - loadTraySettings 中加载 `autostartEnabled` (自愈由 Rust 端处理 per D-08)
  - `handleAutostartEnabledChange` 回调: 更新 state + 持久化 store + 调用 enable()/disable()
  - `handleTrayEnabledChange` 中级联关闭 autostartEnabled (per D-10)
  - 监听 `app:autostart-hidden` 事件调用 `hideToTray()` (per D-04)
  - 传递 props 给 SettingsDialog
- `src/components/SettingsDialog.tsx`:
  - 扩展 props 接口: `autostartEnabled`, `onAutostartEnabledChange`
  - 托盘设置分区内添加第三个 Switch: 开机启动
  - 依赖 closeToTray (disabled + opacity-50 when !closeToTray) (per D-11)

**Verification:**
- `npx tsc --noEmit` 编译通过
- `autostartEnabled` 出现在 App.tsx 6 次, SettingsDialog.tsx 3 次
- `app:autostart-hidden` 出现在 App.tsx 1 次 (事件监听)
- `autostartDisable` 出现在 App.tsx 3 次 (handleTrayEnabledChange 级联 + handleAutostartEnabledChange)

## Decisions Implemented
- D-09: 开机启动 Switch 在托盘设置分区内
- D-10: 关闭 trayEnabled 时级联关闭 autostartEnabled
- D-11: autostart 启用前提条件为 closeToTray=true
