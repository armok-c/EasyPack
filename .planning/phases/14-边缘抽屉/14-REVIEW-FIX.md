---
phase: 14-边缘抽屉
fixed_at: 2026-05-11T21:00:00Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-05-11T21:00:00Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 5 (2 Critical + 3 Warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: ABBA Deadlock Between `drawer:start-polling` Handler and Polling Thread

**Files modified:** `src-tauri/src/lib.rs`
**Commit:** 1fb40a9
**Applied fix:** Added explicit lock-ordering comments to the polling thread's separate-scope pattern (`pr` released before `sr` acquired). Code already used separate scopes (the ABBA pattern was not actually present), but comments now document the intentional ordering to prevent future regressions.

### CR-02: Rust Tray/Menu Handlers Do Not Restore Drawer Position, Window Stuck at Sliver

**Files modified:** `src/App.tsx`
**Commit:** bc91692
**Applied fix:** Changed `main:shown-from-rust` listener to check for `DRAWER_HIDDEN` state. When the window is drawer-hidden, it now calls `await restoreFromDrawer()` followed by `showFromDrawer()` to properly restore the window position before showing. Added `showFromDrawer`, `restoreFromDrawer`, and `isDrawerHidden` to the effect's dependency array.

### WR-01: `handleMouseLeave` Captures State Outside `operationLock`

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** aa6164e
**Applied fix:** Moved `getCurrentWindowState()` call inside the `operationLock` callback so that the `from` state is captured at animation-execution time, not at timeout-fire time. Added inner state guards (`snapEdgeRef`, `visibilityRef`) inside the lock to re-validate before animating.

### WR-02: `restoreFromDrawer` Sets `isAnimating` Outside Lock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** 5ddd7d8
**Applied fix:** Moved `setIsAnimating(true)` inside the `operationLock` callback, consistent with the pattern already applied to `handleDragEnd`. This prevents a previous animation's `finally` block from resetting `isAnimating` to `false` before the queued restore animation starts.

### WR-03: `useTray` Menu Action Callback Does Not Await `restoreFromDrawer`

**Files modified:** `src/hooks/useTray.ts`
**Commit:** c052602
**Applied fix:** Made both the menu "toggle-window" action callback and the tray icon left-click action callback `async`. Added `await` to `onRestoreFromDrawerRef.current()` calls so that `appWindow.show()` only executes after the drawer position restoration completes, eliminating visual flicker.

---

_Fixed: 2026-05-11T21:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
