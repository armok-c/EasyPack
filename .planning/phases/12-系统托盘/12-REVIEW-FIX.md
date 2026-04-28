---
phase: 12-系统托盘
fixed_at: 2026-04-28T15:00:00Z
review_path: .planning/phases/12-系统托盘/12-REVIEW.md
iteration: 6
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-28T15:00:00Z
**Source review:** .planning/phases/12-系统托盘/12-REVIEW.md
**Iteration:** 6

**Summary:**
- Findings in scope: 6 (1 Critical, 5 Warning)
- Fixed: 5
- Skipped: 1

## Fixed Issues

### CR-01: onCloseRequested 与 TitleBar 关闭按钮存在双重隐藏逻辑冲突，visibility 状态与窗口实际可见性脱节

**Files modified:** `src/components/TitleBar.tsx`, `src/App.tsx`
**Commit:** 3193a37
**Applied fix:** Changed TitleBar's `handleClose()` to always call `appWindow.close()` instead of conditionally calling `appWindow.hide()`. This ensures the `onCloseRequested` interceptor in App.tsx is always triggered, which correctly calls `hideToTray()` to update visibility state to `TRAY_HIDDEN`. Removed the `onCloseBehavior` prop from TitleBar's interface since it is no longer needed. The App.tsx `<TitleBar>` usage was simplified accordingly.

### WR-01: useTray 中 buildMenu 使用 getCurrentWindow() 而非 appWindow 引用

**Files modified:** `src/hooks/useTray.ts`, `src/App.tsx`
**Commit:** ee90ce7
**Applied fix:** Added `appWindow: Window` to `UseTrayOptions` interface. Replaced all `getCurrentWindow()` calls inside `buildMenu()` and Effect 1's `action` callback with the passed `appWindow` parameter. Changed import from `getCurrentWindow` (function) to `type { Window }`. Updated App.tsx call site to pass `appWindow` in the options.

### WR-02: useTray Effect 1 的依赖数组被 eslint-disable 抑制，职责边界不够清晰

**Files modified:** `src/hooks/useTray.ts`
**Commit:** 2c729f9
**Applied fix:** Added a documentation comment block between Effect 1 and Effect 2 explaining the responsibility split: Effect 1 owns tray icon creation/destruction (triggered only by `enabled` changes), and Effect 2 owns menu content updates (triggered by project, commands, visibility changes).

### WR-03: useRecentCommands 在 setState 回调中执行 store 副作用

**Files modified:** `src/hooks/useRecentCommands.ts`
**Commit:** cefd43d
**Applied fix:** Separated the pure state computation from the store persistence side effect. `setRecentCommands` now contains only the pure filter+slice logic. Store write is done outside the updater using `storeRef.current` with proper try/catch error handling that logs via `console.error` instead of silently swallowing errors. Added `recentCommands` to the useCallback dependency array since the store write now reads it.

### WR-05: tauri.conf.json 中 assetProtocol scope 允许访问所有文件路径

**Files modified:** `src-tauri/tauri.conf.json`
**Commit:** d0b5c7b
**Applied fix:** Changed `assetProtocol.scope.allow` from `["**"]` (wildcard all paths) to `["$APPDATA/**", "$HOME/**"]`, restricting file access to application data and user home directories only.

## Skipped Issues

### WR-04: useTray 菜单中最近命令的 enabled 状态仅检查 currentProject 非空

**File:** `src/hooks/useTray.ts:97`
**Reason:** Requires additional design thought. Recent commands do not store which project they originated from, so filtering by project existence is not straightforward. The current `enabled` check on `currentProject !== null` already prevents command execution when no project is selected. For a personal developer tool, showing historical commands in the tray menu (disabled when no project is selected) is acceptable UX. A proper fix would require adding project association to recent command records, which is a feature-level change beyond a code review fix.
**Original issue:** 托盘菜单中最近命令的 `enabled` 属性仅检查 `currentProjectRef.current !== null`，没有考虑最近命令可能来自已被删除的项目的场景。

---

_Fixed: 2026-04-28T15:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 6_
