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
  - 窗口操作权限声明（minimize, toggle-maximize, close）
  - 根布局 flex-col 结构（TitleBar 在顶部）
  - 窗口控制按钮 CSS 样式
affects: [08-rust-backend, 09-frontend-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "data-tauri-drag-region 属性实现窗口拖拽（per D-05）"
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
  - "使用 vi.hoisted() 替代顶层变量解决 Vitest mock 提升时序问题"
  - "按钮样式使用自定义 CSS class 而非 Tailwind，确保精确控制 hover 状态"

patterns-established:
  - "Tauri Window API 调用模式: 模块顶层 getCurrentWindow() + async 函数包装"
  - "窗口控制按钮 CSS 模式: titlebar-button 基类 + close-button 修饰符"

requirements-completed: [WIN-01, WIN-02, WIN-03]

# Metrics
duration: 6min
completed: 2026-04-16
---

# Phase 7 Plan 1: 无边框窗口与自定义标题栏 Summary

**自定义 TitleBar 组件替代系统原生标题栏，通过 Tauri Window API 实现最小化/最大化/关闭，data-tauri-drag-region 实现窗口拖拽**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-16T04:42:49Z
- **Completed:** 2026-04-16T04:48:35Z
- **Tasks:** 2 of 3 (Task 3 为 human-verify checkpoint，需人工启动应用验证)
- **Files modified:** 6

## Accomplishments
- TitleBar React 组件实现，包含 EasyPack 图标、名称、拖拽区域和三个窗口控制按钮
- TDD 完成（6 个测试全部通过），包括拖拽区域属性验证、按钮 API 调用验证、双击最大化验证
- 无边框窗口配置（decorations: false, shadow: true）和最小权限 capabilities 声明
- 根布局从 flex 改为 flex-col，TitleBar 置于顶部，Sidebar + MainArea 包裹在 flex-1 容器中
- 全部 75 个测试通过，无回归

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): 创建 TitleBar 测试** - `a9a2fa6` (test)
2. **Task 1 (GREEN): 实现 TitleBar 组件** - `56c3b5b` (feat)
3. **Task 2: 配置无边框窗口并集成 TitleBar** - `e5ae215` (feat)

_Note: Task 3 是 human-verify checkpoint，无代码提交_

## Files Created/Modified
- `src/components/TitleBar.tsx` - 自定义标题栏组件（图标 + 名称 + 拖拽区域 + 三个窗口控制按钮）
- `src/components/__tests__/TitleBar.test.tsx` - TitleBar 6 个单元测试
- `src-tauri/tauri.conf.json` - 添加 decorations: false, shadow: true
- `src-tauri/capabilities/default.json` - 添加 3 个窗口操作权限
- `src/App.tsx` - 导入 TitleBar，改为 flex-col 布局
- `src/index.css` - 添加 titlebar-button 和 close-button hover 样式

## Decisions Made
- 使用 `vi.hoisted()` 替代顶层 `const` 声明解决 Vitest mock 提升时序问题（`vi.mock` 在 import 之前执行，导致引用未初始化的变量）
- 按钮样式使用自定义 CSS class（`.titlebar-button`）而非 Tailwind utility classes，确保 hover 状态精确控制（per RESEARCH anti-pattern 建议）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修复 Vitest mock 提升时序导致的 ReferenceError**
- **Found during:** Task 1 (GREEN 阶段)
- **Issue:** `vi.mock` 工厂函数中引用顶层 `const mockMinimize`，但 Vitest 提升 `vi.mock` 到 import 之前执行，导致 "Cannot access 'mockMinimize' before initialization"
- **Fix:** 将 mock 函数声明移入 `vi.hoisted()` 块，确保在 mock 工厂函数执行时已初始化
- **Files modified:** src/components/__tests__/TitleBar.test.tsx
- **Verification:** 6 个测试全部通过
- **Committed in:** 56c3b5b (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 测试文件 mock 模式调整，不影响组件实现或计划范围。

## Issues Encountered
- 无

## Task 3: Human-Verify Checkpoint

Task 3 为人工验证 checkpoint。需要用户启动应用 `npm run tauri dev` 后验证：

**检查项 1 - 标题栏外观:**
- 窗口顶部 28px 高度自定义标题栏
- 左侧 Package 图标 + "EasyPack" 文字
- 标题栏与内容区域背景色融合，无分割线
- 右侧三个窗口控制按钮（默认半透明，hover 高亮，关闭按钮红色 hover）

**检查项 2 - 拖拽和窗口控制:**
- 拖拽标题栏移动窗口
- 最小化/最大化/关闭按钮功能正常
- 双击标题栏切换最大化/还原

**检查项 3 - Resize 和阴影:**
- 窗口边缘可拖拽调整大小
- Windows 11 下圆角阴影效果
- 最小窗口尺寸 600x400 限制仍生效

**检查项 4 - 内容区域正常:**
- 侧边栏和指令卡片正常交互
- 无布局错乱或内容溢出

## User Setup Required
None - 无外部服务配置需求。

## Next Phase Readiness
- TitleBar 组件和无边框窗口配置已完成，等待人工视觉验证
- 验证通过后 Phase 07 Plan 01 即完成
- 后续 Phase 08/09 可基于此标题栏继续开发

## Self-Check: PASSED

- [x] src/components/TitleBar.tsx EXISTS
- [x] src/components/__tests__/TitleBar.test.tsx EXISTS
- [x] src-tauri/tauri.conf.json EXISTS
- [x] src-tauri/capabilities/default.json EXISTS
- [x] src/App.tsx EXISTS
- [x] src/index.css EXISTS
- [x] .planning/phases/07-无边框窗口与自定义标题栏/07-01-SUMMARY.md EXISTS
- [x] Commit a9a2fa6 (test RED) FOUND
- [x] Commit 56c3b5b (feat GREEN) FOUND
- [x] Commit e5ae215 (feat config) FOUND

---
*Phase: 07-无边框窗口与自定义标题栏*
*Completed: 2026-04-16*
