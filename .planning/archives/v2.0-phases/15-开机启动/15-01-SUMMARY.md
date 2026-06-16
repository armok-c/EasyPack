---
phase: 15-开机启动
plan: 01
status: completed
wave: 1
---

# Plan 15-01 Summary: Rust 后端 autostart 插件集成

## Completed Tasks

### Task 1: 安装 autostart 插件 + 配置 Rust 后端

**Changes:**
- `src-tauri/Cargo.toml`: 添加 `tauri-plugin-autostart = "2"` 依赖 (v2.5.1)
- `src-tauri/capabilities/default.json`: 添加 `autostart:allow-enable`, `autostart:allow-disable`, `autostart:allow-is-enabled` 权限
- `src-tauri/src/lib.rs`:
  - 使用 Builder API 注册 autostart 插件: `tauri_plugin_autostart::Builder::new().arg("--autostart").build()`
  - setup 闭包中检测 `--autostart` 参数，检测到时: `window.hide()` + `set_skip_taskbar(true)` + emit `app:autostart-hidden`
  - D-02 自启防御: 读取 store 中 trayEnabled/closeToTray，如果为 false 则静默设为 true
  - 自愈逻辑: 读取 store 中 autostartEnabled，如果为 true 但注册表条目丢失则静默重新注册

**Verification:**
- `cargo check` 编译通过
- `tauri_plugin_autostart` 出现 2 次 (plugin registration + ManagerExt import)
- `app:autostart-hidden` 出现 1 次 (emit in setup)
- `autostart:allow-enable` 出现在 capabilities

## Decisions Implemented
- D-01: Builder API + --autostart 参数
- D-02: 自启时确保 trayEnabled/closeToTray 为 true
- D-03: setup 阶段隐藏窗口 (WebView 加载前)
- D-04: emit app:autostart-hidden 事件
- D-05/D-06/D-07/D-08: 自愈逻辑在 Rust 端 setup 中执行
