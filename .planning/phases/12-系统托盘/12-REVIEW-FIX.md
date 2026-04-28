---
phase: 12-系统托盘
fixed_at: 2026-04-28T03:34:03Z
review_path: .planning/phases/12-系统托盘/12-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-28T03:34:03Z
**Source review:** .planning/phases/12-系统托盘/12-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 5 (2 Critical, 3 Warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Tray "Quit" action has race condition with onCloseRequested interceptor

**Files modified:** `src/App.tsx`, `src/hooks/useTray.ts`
**Commit:** 5b225ee
**Applied fix:** Changed `onQuit` in App.tsx from `appWindow.close()` to `appWindow.destroy()` to bypass the `onCloseRequested` interceptor entirely. Removed the redundant `getCurrentWindow().destroy().catch(console.error)` call from the quit menu item action in useTray.ts, since `onQuitRef.current()` now calls `destroy()` directly.

**Status:** fixed: requires human verification (logic bug -- quit behavior change from close to destroy needs manual testing).

### CR-02: MainArea UI commands bypass recent command tracking

**Files modified:** `src/App.tsx`
**Commit:** 35c3e60
**Applied fix:** Changed `MainArea`'s `onExecute` prop from `executeCommand` to `handleExecuteWithRecent`, so all command executions from the main UI are tracked in the recent commands list.

### WR-01: Failed commands are added to recent history

**Files modified:** `src/hooks/useProject.ts`, `src/App.tsx`
**Commit:** dc77000
**Applied fix:** Changed `executeCommand` return type from `Promise<void>` to `Promise<boolean>` -- returns `true` on success, `false` on failure or when no project is selected. Updated `handleExecuteWithRecent` to check the return value and skip recent command tracking when execution fails. Updated return type comment in the hook's return object.

**Status:** fixed: requires human verification (logic bug -- return value semantics need manual confirmation).

### WR-02: Unhandled promise rejections in tray onShow/onHide callbacks

**Files modified:** `src/App.tsx`
**Commit:** f075d07
**Applied fix:** Added `.catch(console.error)` to all window API calls in `onShow` (`appWindow.show()`, `appWindow.setFocus()`) and `onHide` (`appWindow.hide()`) callbacks passed to useTray.

### WR-03: Tray menu rebuilds on every render due to unmemoized currentProject reference

**Files modified:** `src/hooks/useProject.ts`
**Commit:** 9909258
**Applied fix:** Wrapped `currentProject` derivation in `useMemo` with `[selectedId, projects]` dependency array, preventing new object references on every render and eliminating unnecessary tray menu rebuilds.

---

_Fixed: 2026-04-28T03:34:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
