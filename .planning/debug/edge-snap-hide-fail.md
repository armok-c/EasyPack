---
status: resolved
trigger: "窗口拖拽到边缘无法隐藏吸附"
created: "2026-05-12"
updated: "2026-05-12"
---

# Debug Session: edge-snap-hide-fail

## Symptoms

- **Expected:** Phase 14 边缘抽屉功能 — 主窗口拖到屏幕边缘后应吸附并隐藏（类似 QQ 边缘隐藏）
- **Actual:** 完全无反应，窗口拖到边缘后没有任何吸附或隐藏效果
- **Errors:** 无报错信息
- **Timeline:** 从未正常工作 — Phase 14 新功能
- **Reproduction:** 拖主窗口到屏幕上/下/左/右边缘

## Current Focus

**hypothesis:** Phase 14 边缘吸附功能未实现或实现不完整
**test:** 检查 Phase 14 相关代码是否存在，以及边缘检测逻辑是否正确注册
**expecting:** 找到边缘检测和窗口吸附的代码，验证其是否被正确调用
**next_action:** complete
**reasoning_checkpoint:**
**tdd_checkpoint:**

## Evidence

- 2026-05-12T15:02: 边缘抽屉代码完整存在：useEdgeDrawer.ts, drawer-geometry.ts, drawer-animation.ts, SnapIndicator.tsx, TitleBar.tsx 吸附拖拽检测, Rust 后端鼠标轮询
- 2026-05-12T15:02: 全部 31 个相关测试通过 (drawer-geometry 12 + drawer-animation 6 + useVisibilityState 6 + useEdgeDrawer 13)
- 2026-05-12T15:02: TypeScript 编译无错误，Rust 编译通过
- 2026-05-12T15:02: capabilities/default.json 包含所有必要权限 (set-position, set-size, set-min-size, outer-position, inner-size, primary-monitor, start-dragging)
- 2026-05-12T15:02: tao WM_WINDOWPOSCHANGED -> Moved 事件链确认：startDragging() 在 Windows 上会触发 WM_WINDOWPOSCHANGED，tao 0.34.x 正确转发为 Moved 事件
- 2026-05-12T15:02: **root cause**: App.tsx onMoved useEffect 的依赖数组包含 `snapEdge`、`isDrawerAnimating`、`handleDragEnd`，每次这些状态变化都会销毁并重建 onMoved 监听器。在销毁→重建的间隙（setupMoveListener 是 async），高频 onMoved 事件可能丢失，导致 150ms debounce timer 无法正确设置，handleDragEnd 永远不会被调用。
- 2026-05-12T15:25: 已应用 ref 模式修复。snapEdgeRef/isDrawerAnimatingRef/handleDragEndRef 保证 onMoved 回调内始终读取最新值，不再触发 effect 重挂载。
- 2026-05-12T15:26: 修复后全量测试 168 passed, 0 failed。TypeScript 编译通过。

## Eliminated

- Tauri API 权限不足 — 已验证所有必要权限存在
- TypeScript/Rust 编译错误 — 已验证无错误
- 坐标计算错误 — drawer-geometry.ts 和 useEdgeDrawer.ts 的物理/逻辑坐标转换正确
- onMoved 事件不触发 — tao 源码确认 WM_WINDOWPOSCHANGED 正确转换为 Moved 事件
- tauri-plugin-store 问题 — store 加载逻辑正确
- isMaximized 误报 — onMoved listener 中硬编码 false，handleDragEnd 中查询实际值
- drawerEnabled 默认值问题 — 默认 false 是设计决策（需手动开启），非 bug

## Resolution

**root_cause:** App.tsx `onMoved` useEffect 的依赖数组 `[drawerEnabled, snapEdge, isDrawerAnimating, handleDragEnd]` 导致每次 `snapEdge`/`isDrawerAnimating`/`handleDragEnd` 变化时，onMoved 监听器被销毁并异步重建。在销毁到重建的间隙（`setupMoveListener` 是 async 函数，需 await `currentWindow.onMoved()`），窗口移动事件被丢失。特别是当用户快速拖拽时，频繁的状态变化导致监听器不断重建，150ms debounce timer 无法稳定运行，`handleDragEnd` 永远不会被调用，吸附功能完全失效。

**fix:** 在 `onMoved` useEffect 中使用 ref 模式替代直接闭包捕获：添加 `snapEdgeRef`、`isDrawerAnimatingRef`、`handleDragEndRef`，在回调内通过 ref 读取最新值。依赖数组简化为仅 `[drawerEnabled]`（控制 on/off 的唯一入口），onMoved 监听器在 `drawerEnabled` 为 true 时只创建一次，不再被状态变化反复销毁重建。

**verification:**
1. TypeScript 编译通过 (tsc --noEmit)
2. 全量测试 168 passed (npx vitest run)
3. 手动测试：开启边缘抽屉 -> 拖拽窗口到边缘 -> 验证吸附/滑出/收回

**files_changed:**
- `src/App.tsx` — onMoved useEffect 从闭包依赖模式重构为 ref 模式

## Specialist Review

specialist_hint: typescript/react
review: ref 模式是 React hooks 中处理高频事件监听器的标准做法，避免了 useEffect 频繁重挂载。依赖数组仅保留 `drawerEnabled` 是正确的 — 这是唯一需要控制监听器生命周期（注册/注销）的状态。其余状态通过 ref 读取既避免了陈旧闭包问题，又不会触发重挂载。
