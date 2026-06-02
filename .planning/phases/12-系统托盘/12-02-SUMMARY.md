---
phase: 12-系统托盘
plan: 02
subsystem: ui
tags: [tauri, tray, dialog, settings, switch, titlebar, hooks, visibility]

# Dependency graph
requires:
  - phase: 12-01
    provides: useTray, useVisibilityState, useRecentCommands hooks and tray-icon config
provides:
  - "TitleBar gear button + close-to-tray behavior"
  - "SettingsDialog with tray toggle switches"
  - "App.tsx integration of all tray hooks + onCloseRequested interception"
  - "Tray settings persistence to tauri-plugin-store"
  - "Recent commands tracking on command execution"
affects: [13-悬浮窗, 14-边缘抽屉]

# Tech tracking
tech-stack:
  added: [shadcn Switch, lucide Settings icon]
  patterns: [onCloseRequested interception, store-based settings persistence, execute-with-recent wrapper]

key-files:
  created:
    - src/components/SettingsDialog.tsx
    - src/components/ui/switch.tsx
  modified:
    - src/components/TitleBar.tsx
    - src/App.tsx
    - src/hooks/useProject.ts

key-decisions:
  - "handleExecuteWithRecent wraps executeCommand + addRecentCommand, used by useGlobalShortcuts and useTray"
  - "onCloseRequested interception only active when closeToTray=true (per D-07)"
  - "handleTrayEnabledChange cascades setCloseToTray(false) when main switch disabled (per D-16)"
  - "Tray settings loaded from store on mount, persisted on change"

patterns-established:
  - "Settings persistence: useEffect load on store ready + useCallback save on change"
  - "Execute wrapper pattern: intercept command execution to add side effects (recent tracking)"

requirements-completed: [TRAY-02, TRAY-08]

# Metrics
duration: 3min
completed: 2026-04-27
---

# Phase 12 Plan 02: UI 集成 Summary

**TitleBar 关闭行为改造 + SettingsDialog 设置弹窗 + App.tsx 托盘 Hook 集成 + 指令执行记录**

## Performance

- **Duration:** 3 min (Task 2 execution; Task 1 completed in prior session)
- **Started:** 2026-04-27T07:00:45Z
- **Completed:** 2026-04-27T07:04:26Z
- **Tasks:** 2 (Task 1 in prior session, Task 2 in this session)
- **Files modified:** 5

## Accomplishments
- TitleBar 新增齿轮按钮打开设置弹窗，关闭按钮根据 closeToTray 设置切换 hide/close 行为
- SettingsDialog 包含"启用系统托盘"和"关闭时隐藏到托盘"两个开关，关闭总开关联动关闭子开关
- App.tsx 集成 useVisibilityState、useRecentCommands、useTray 全部 hooks
- onCloseRequested 拦截 Alt+F4（仅 closeToTray=true 时），实现隐藏到托盘而非退出
- 指令执行自动记录到最近列表，全局快捷键执行也记录
- 托盘设置持久化到 store，重启后恢复

## Task Commits

Task 1 (prior session):
1. **Task 1: Switch + SettingsDialog + TitleBar** - `90ff1a9` (feat)
2. **fix: maximize icon toggle** - `ceb1a70` (fix)
3. **fix: remove invalid permission** - `aff8ff9` (fix)

Task 2 (this session):
4. **Task 2: App.tsx integration + useProject store export** - `da89550` (feat)

## Files Created/Modified
- `src/components/ui/switch.tsx` - shadcn Switch 组件
- `src/components/SettingsDialog.tsx` - 设置弹窗，包含系统托盘开关
- `src/components/TitleBar.tsx` - 新增齿轮按钮 + onCloseBehavior prop + hide/close 行为切换
- `src/App.tsx` - 集成全部托盘 hooks + 设置持久化 + onCloseRequested 拦截
- `src/hooks/useProject.ts` - 导出 store 供 useRecentCommands 使用

## Decisions Made
- handleExecuteWithRecent 同时包裹 executeCommand 和 addRecentCommand，统一用于 useGlobalShortcuts 和 useTray，确保所有执行路径都记录最近指令
- onCloseRequested 仅在 closeToTray=true 时拦截，关闭总开关后 Alt+F4 恢复正常退出行为
- handleTrayEnabledChange 关闭总开关时级联关闭 closeToTray（D-16），确保一致性
- useKeyboard 的 onExecute 保持使用原始 executeCommand（数字键快捷键不记录到最近列表，因为是快速导航用）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reordered hooks to fix use-before-define**
- **Found during:** Task 2 (App.tsx integration)
- **Issue:** Plan placed useGlobalShortcuts before handleExecuteWithRecent definition, causing use-before-define reference error
- **Fix:** Moved tray state/hooks/useCallback definitions before useGlobalShortcuts call
- **Files modified:** src/App.tsx
- **Verification:** TypeScript compilation passed, 132 tests passed
- **Committed in:** da89550 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal - reordered code to fix JavaScript variable scoping. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- System tray UI fully integrated: close-to-tray, settings dialog, recent commands in tray menu
- Ready for Phase 13 (悬浮窗) which will build on useVisibilityState state machine
- Phase 14 (边缘抽屉) will also leverage visibility state patterns

---
*Phase: 12-系统托盘*
*Completed: 2026-04-27*
