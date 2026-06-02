---
phase: 07-无边框窗口与自定义标题栏
plan: 01
subsystem: ui
tags: [tauri, react, titlebar, frameless-window, window-controls, drag-region]

# Dependency graph
requires:
  - phase: 06-命令执行修复
    provides: 稳定的命令执行基础
provides:
  - TitleBar React 组件（图标 + 名称 + 拖拽区域 + 窗口控制按钮）
  - 无边框窗口 Tauri 配置（decorations: false, shadow: true）
  - 窗口操作权限声明（minimize, toggle-maximize, close, start-dragging）
  - 根布局 flex-col 结构（TitleBar 在顶部）
  - 窗口控制按钮 CSS 样式
affects: [08-rust-backend, 09-frontend-ui]

# Tech tracking
tech-stack:
  added: []
patterns:
  - "appWindow.startDragging() 实现可靠的窗口拖拽（Windows 兼容）"
  - "data-tauri-drag-region 属性作为辅助拖拽机制"
  - "Tauri Window API (getCurrentWindow) 实现窗口控制"
  - "vi.hoisted() 解决 Vitest mock 提升时序问题"

key-files:
  created:
    - src/components/TitleBar.tsx
    - src/components/__tests__/TitleBar.test.tsx
  modified:
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src/App.tsx
    - src/index.css

key-decisions:
  - "使用 appWindow.startDragging() + onMouseDown 作为主要拖拽机制（data-tauri-drag-region 在 Windows 上不可靠）"
  - "使用 vi.hoisted() 替代顶层变量解决 Vitest mock 提升时序问题"
  - "按钮样式使用自定义 CSS class 而非 Tailwind，确保精确控制 hover 状态"

patterns-established:
  - "Tauri Window API 调用模式: 模块顶层 getCurrentWindow() + async 函数包装"
  - "窗口拖拽模式: onMouseDown + startDragging() + target.closest('button') 守卫"
  - "窗口控制按钮 CSS 模式: titlebar-button 基类 + close-button 修饰符"

requirements-completed: [WIN-01, WIN-02, WIN-03]

# Metrics
duration: 15min
completed: 2026-04-16
---

# Phase 7 Plan 1: 无边框窗口与自定义标题栏 Summary

**自定义 TitleBar 组件替代系统原生标题栏，通过 Tauri Window API 实现最小化/最大化/关闭，startDragging() + data-tauri-drag-region 实现窗口拖拽**

## Performance

- **Duration:** 15 min
- **Tasks:** 3 of 3 complete (Task 3 human-verify checkpoint PASSED)
- **Files modified:** 6

## Accomplishments
- TitleBar React 组件实现，包含 EasyPack 图标、名称、拖拽区域和三个窗口控制按钮
- TDD 完成（8 个测试全部通过），包括拖拽区域属性验证、按钮 API 调用验证、双击最大化验证、startDragging 调用验证
- 无边框窗口配置（decorations: false, shadow: true）和最小权限 capabilities 声明
- 根布局从 flex 改为 flex-col，TitleBar 置于顶部，Sidebar + MainArea 包裹在 flex-1 容器中
- 修复了 Windows 上窗口拖拽不工作的问题（使用 startDragging() 替代纯 data-tauri-drag-region）
- 全部 77 个测试通过，无回归
- 人工验证通过：标题栏外观、拖拽移动、窗口控制按钮、resize、阴影、内容区域正常

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): 创建 TitleBar 测试** - `a9a2fa6` (test)
2. **Task 1 (GREEN): 实现 TitleBar 组件** - `56c3b5b` (feat)
3. **Task 2: 配置无边框窗口并集成 TitleBar** - `e5ae215` (feat)
4. **Fix: 修复 Windows 拖拽问题** - `ecf9a5d` (fix)

## Files Created/Modified
- `src/components/TitleBar.tsx` - 自定义标题栏组件（图标 + 名称 + 拖拽区域 + 三个窗口控制按钮 + startDragging）
- `src/components/__tests__/TitleBar.test.tsx` - TitleBar 8 个单元测试
- `src-tauri/tauri.conf.json` - 添加 decorations: false, shadow: true
- `src-tauri/capabilities/default.json` - 添加 4 个窗口操作权限（含 start-dragging）
- `src/App.tsx` - 导入 TitleBar，改为 flex-col 布局
- `src/index.css` - 添加 titlebar-button 和 close-button hover 样式

## Decisions Made
- 使用 `appWindow.startDragging()` + `onMouseDown` 作为主要拖拽机制，因为 `data-tauri-drag-region` 在 Windows 上不可靠
- 使用 `target.closest("button")` 守卫防止点击按钮时触发拖拽
- 使用 `vi.hoisted()` 替代顶层 `const` 声明解决 Vitest mock 提升时序问题
- 按钮样式使用自定义 CSS class（`.titlebar-button`）而非 Tailwind utility classes，确保 hover 状态精确控制

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修复 Vitest mock 提升时序导致的 ReferenceError**
- **Found during:** Task 1 (GREEN 阶段)
- **Fix:** 将 mock 函数声明移入 `vi.hoisted()` 块
- **Committed in:** 56c3b5b

**2. [Checkpoint Fix] Windows 窗口拖拽不工作**
- **Found during:** Task 3 human-verify checkpoint
- **Issue:** `data-tauri-drag-region` 属性在 Windows 上不触发窗口拖拽
- **Fix:** 添加 `appWindow.startDragging()` 在 `onMouseDown` 中调用，配合 `target.closest("button")` 守卫
- **Committed in:** ecf9a5d

---

**Total deviations:** 2 auto-fixed (1 bug, 1 platform compatibility)
**Impact on plan:** 增强了拖拽可靠性，增加了 start-dragging 权限和 2 个测试。

## Self-Check: PASSED

- [x] src/components/TitleBar.tsx EXISTS
- [x] src/components/__tests__/TitleBar.test.tsx EXISTS
- [x] src-tauri/tauri.conf.json EXISTS
- [x] src-tauri/capabilities/default.json EXISTS
- [x] src/App.tsx EXISTS
- [x] src/index.css EXISTS
- [x] 77 tests PASS (no regression)
- [x] Human-verify checkpoint PASSED

---
*Phase: 07-无边框窗口与自定义标题栏*
*Completed: 2026-04-16*
