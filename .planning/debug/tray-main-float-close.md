---
status: root_cause_found
trigger: "关闭主窗口后，系统托盘图标无法打开主窗口，无法关闭悬浮窗，悬浮窗点击右上角关闭不生效"
created: 2026-05-09
updated: 2026-05-09
---

## Symptoms

- **expected**: 关闭主窗口后，点击系统托盘菜单的"显示主窗口"选项应重新打开主窗口；悬浮窗右上角关闭按钮点击后应关闭悬浮窗
- **actual**:
  1. 系统托盘菜单有"显示主窗口"选项但点击不生效（主窗口不显示）
  2. 悬浮窗点击右上角关闭按钮完全无反应
  3. 无法关闭悬浮窗
- **errors**: 无特定错误消息或 toast
- **timeline**: 从 Phase 13 开始就存在
- **reproduction**:
  1. 关闭主窗口 → 点击托盘图标 → 右键菜单"显示主窗口" → 无反应
  2. 打开悬浮窗 → 点击右上角关闭按钮 → 无反应

## Related Session

- `.planning/debug/float-toggle-close-bugs.md` — 已找到根因（toggle 并发竞态），待修复。可能与此问题有重叠但用户要求独立调查。

## Evidence

- 2026-05-09: 分析 FloatApp.tsx handleClose — 使用 floatWindow.close()，触发 onCloseRequested 事件
- 2026-05-09: 分析 Tauri 2 onCloseRequested 实现 — JS handler 执行后若未 preventDefault 则调用 this.destroy()
- 2026-05-09: 分析 useFloatWindow.ts onCloseRequested handler — 不调用 preventDefault，理论上 destroy() 应被调用
- 2026-05-09: 分析 useTray.ts toggle-window action — 使用 visibilityRef + appWindow.show()/hide()
- 2026-05-09: 检查 capabilities — core:window:allow-show/hide/close/destroy 权限齐全
- 2026-05-09: 检查 Tauri 2 Channel 实现菜单项 action — 回调通过 WebView JS 运行时执行
- 2026-05-09: 检查 Tauri 2 backgroundThrottling — Windows 不支持配置（issue #5250），WebView 可能被节流
- 2026-05-09: 确认 Tauri 2 Rust 端支持 on_menu_event 和 on_tray_icon_event 全局事件监听

## Current Focus

hypothesis: "根因确认：两处问题共享同一根因——核心窗口操作依赖 WebView JS 运行时执行。当主窗口被 hide() 后，WebView2 可能被节流/暂停，导致：(1) 托盘菜单 action 回调不执行 → appWindow.show() 不调用 → 窗口无法恢复；(2) onCloseRequested handler 不执行 → destroy() 不调用 → 悬浮窗无法关闭。这是一个死锁：窗口需要 show() 恢复 WebView，但 show() 需要 WebView 执行。"
test: "代码分析和 Tauri 2 源码审查完成"
expecting: "修复方案：(1) Rust 端添加全局菜单和托盘事件处理器直接操作窗口；(2) 悬浮窗关闭按钮改用 destroy() + 事件通知"
next_action: "apply fix"

## Resolution

root_cause: |
  两个问题共享同一根因：核心窗口操作（show/hide/close）全部通过 WebView JS 运行时执行。
  当主窗口被 appWindow.hide() 隐藏后，Windows 上的 WebView2 可能被节流或暂停，导致：

  1. **托盘菜单"显示窗口"不生效**：菜单项的 action 回调通过 Tauri Channel 机制注册在
     主窗口的 WebView JS 运行时中。当 WebView 被暂停时，回调不执行，appWindow.show()
     不会被调用。形成死锁——窗口需要 show() 恢复 WebView，但 show() 需要 WebView 执行。

  2. **悬浮窗关闭按钮无反应**：close() 触发 CloseRequested 事件，但主窗口中注册的
     onCloseRequested handler 在主窗口的 WebView JS 中执行。当 WebView 被暂停时，
     handler 不执行，this.destroy() 不会被调用，悬浮窗无法关闭。

  Tauri 2 的 backgroundThrottling 配置在 Windows 上不支持（参考 GitHub issue #5250），
  无法通过配置解决 WebView 节流问题。

fix: |
  三处修复：

  1. **src-tauri/src/lib.rs** — 添加 Rust 端全局事件处理器：
     - on_menu_event：处理 "toggle-window"（直接调用 window.show/hide）和 "quit"（销毁悬浮窗+退出）
     - on_tray_icon_event：处理左键点击（直接显示主窗口）
     - Rust 端操作后通过 emit("main:shown-from-rust"/"main:hidden-from-rust") 通知前端同步状态

  2. **src/App.tsx** — 监听 Rust 端发出的状态同步事件，更新 visibility React 状态

  3. **src/components/FloatApp.tsx** — 关闭按钮改用 destroy() 代替 close()：
     - destroy() 直接销毁窗口，不依赖主窗口的 onCloseRequested handler
     - 关闭前 emit("float:close-requested") 通知主窗口清理状态

  4. **src/hooks/useFloatWindow.ts** — 监听 "float:close-requested" 事件清理状态，
     替代依赖 onCloseRequested 的方式。提取 registerFloatListeners 和 cleanupFloatState
     复用函数。

specialist_hint: typescript
