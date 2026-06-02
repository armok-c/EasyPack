---
phase: 12-系统托盘
plan: 01
subsystem: infra
tags: [tauri-tray-icon, system-tray, visibility-state, react-hooks, vitest]

# Dependency graph
requires: []
provides:
  - tauri tray-icon feature 启用 (Cargo.toml)
  - trayIcon 配置块 (tauri.conf.json)
  - 窗口 show/hide/focus/onCloseRequested 权限 (capabilities)
  - useVisibilityState hook (VISIBLE/TRAY_HIDDEN 状态机)
  - useRecentCommands hook (追加/去重/截断8条/store持久化)
  - useTray hook (托盘图标创建、菜单构建、事件处理)
affects: [12-02-ui-integration, 14-边缘抽屉]

# Tech tracking
tech-stack:
  added: [tauri tray-icon feature]
  patterns: [functional setState for stale closure prevention, TrayIcon action callback for unified event handling]

key-files:
  created:
    - src/hooks/useVisibilityState.ts
    - src/hooks/useRecentCommands.ts
    - src/hooks/useTray.ts
    - src/hooks/__tests__/useVisibilityState.test.ts
    - src/hooks/__tests__/useRecentCommands.test.ts
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json

key-decisions:
  - "useRecentCommands 使用 functional setState 避免 stale closure 导致快速连续调用丢失数据"
  - "useTray 使用 TrayIcon action 回调统一处理单击事件，Tauri v2 无 setOnClick/setOnDoubleClick 方法"
  - "退出使用 getCurrentWindow().destroy() 而非 exit()，因为 @tauri-apps/api/app 不导出 exit 函数"

patterns-established:
  - "useRecentCommands: functional setState (setRecentCommands(prev => ...)) 避免连续异步调用的 stale closure"
  - "useTray: useRef 保存回调引用 + action 回调模式处理托盘事件"

requirements-completed: [TRAY-01, TRAY-02, TRAY-03, TRAY-04, TRAY-05, TRAY-06, TRAY-07]

# Metrics
duration: 6min
completed: 2026-04-27
---

# Phase 12 Plan 01: 系统托盘基础设施 Summary

**Tauri tray-icon 配置 + useVisibilityState 状态机 + useRecentCommands 持久化列表 + useTray 托盘 Hook，10 个新增测试全部通过**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-27T06:11:46Z
- **Completed:** 2026-04-27T06:18:13Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 启用 Tauri tray-icon feature，配置 trayIcon 块，添加窗口可见性控制权限
- 创建 useVisibilityState hook：VISIBLE/TRAY_HIDDEN 状态机，为 Phase 14 留扩展接口
- 创建 useRecentCommands hook：追加指令到头部、相同 command 去重、最多 8 条、store 持久化
- 创建 useTray hook：托盘图标创建/移除、动态菜单构建、单击显示窗口、右键上下文菜单

## Task Commits

Each task was committed atomically:

1. **Task 1: Tauri tray-icon 配置 + useVisibilityState + useRecentCommands + tests** - `6013059` (feat)
2. **Task 2: useTray hook — 托盘图标创建、菜单构建、事件处理** - `cc3fb1c` (feat)

_Note: Task 1 followed TDD RED (tests fail) -> GREEN (tests pass) cycle within a single commit._

## Files Created/Modified
- `src-tauri/Cargo.toml` - 添加 "tray-icon" feature
- `src-tauri/tauri.conf.json` - 添加 trayIcon 配置块 (id: main-tray)
- `src-tauri/capabilities/default.json` - 追加 show/hide/set-focus/on-close-requested 权限
- `src/hooks/useVisibilityState.ts` - 窗口可见性状态机 (VISIBLE/TRAY_HIDDEN)
- `src/hooks/useRecentCommands.ts` - 最近执行指令列表管理 (去重/截断/持久化)
- `src/hooks/useTray.ts` - 托盘图标创建、菜单构建、事件处理
- `src/hooks/__tests__/useVisibilityState.test.ts` - 5 个测试
- `src/hooks/__tests__/useRecentCommands.test.ts` - 5 个测试

## Decisions Made
- useRecentCommands 使用 functional setState (`setRecentCommands(prev => ...)`) 替代直接引用 state 变量，避免连续 `addRecentCommand` 调用的 stale closure 问题
- useTray 使用 `TrayIcon.new({ action })` 回调模式统一处理托盘事件，Tauri v2 JS API 不提供 setOnClick/setOnDoubleClick 方法
- 退出应用使用 `getCurrentWindow().destroy()` 替代不存在的 `exit()`，destroy 绕过 closeRequested 拦截直接关闭

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useRecentCommands stale closure 导致连续调用丢失数据**
- **Found during:** Task 1 (GREEN 阶段，测试失败)
- **Issue:** `addRecentCommand` 使用 `useCallback` 依赖 `recentCommands`，连续调用时每次从旧状态计算，导致去重测试和截断测试失败
- **Fix:** 改用 functional setState (`setRecentCommands(prev => ...)`) 确保每次操作基于最新状态；store 引用通过 `useRef` 保持最新
- **Files modified:** src/hooks/useRecentCommands.ts
- **Verification:** npx vitest run useRecentCommands.test.ts 5/5 通过
- **Committed in:** 6013059 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 修复实现逻辑的 stale closure bug，无范围蔓延。

## Issues Encountered
- useRecentCommands 连续调用测试失败：3 次 addRecentCommand 只得到 1 条记录。通过 functional setState 模式解决。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 托盘基础设施完全就绪，Plan 02 可直接在 UI 中集成 useTray + useVisibilityState + useRecentCommands
- 全量测试 128 个全部通过，无回归
- useTray 需要在 App.tsx 中初始化并传入 executeCommand 回调（Plan 02 范围）
- 需注意：useTray 中的 console.error 用于托盘操作失败日志，后续可接入统一日志系统

## Self-Check: PASSED

- All 5 created files verified on disk
- Both task commits (6013059, cc3fb1c) verified in git log

---
*Phase: 12-系统托盘*
*Completed: 2026-04-27*
