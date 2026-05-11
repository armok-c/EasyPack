---
phase: 14-边缘抽屉
fixed_at: 2026-05-11T12:13:03Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 3
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 3)

**Fixed at:** 2026-05-11T12:13:03Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 6 (2 Critical + 4 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `primaryMonitor()` called as Window method -- TypeError at runtime (4 call sites)

**Files modified:** `src/hooks/useEdgeDrawer.ts`, `src/App.tsx`, `src/hooks/__tests__/useEdgeDrawer.test.ts`
**Commit:** 0c6a0c5
**Applied fix:** Added `primaryMonitor` to the import from `@tauri-apps/api/window`. Replaced all 4 call sites (`appWindow.primaryMonitor()`, `currentWindow.primaryMonitor()`, `win.primaryMonitor()`) with standalone `primaryMonitor()` calls. Updated test mock to export `primaryMonitor` as a standalone function instead of a Window method.

### CR-02: `visibility` used before declaration in App.tsx

**Files modified:** `src/App.tsx`
**Commit:** 0c6a0c5
**Applied fix:** Moved `useVisibilityState()` call (which declares `visibility`) to before the `visibilityRef` initialization. This resolves the `ReferenceError: Cannot access 'visibility' before initialization` and the corresponding TS2448 error.

### WR-01: `restoreFromDrawer` mutates refs outside operationLock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** 0c6a0c5
**Applied fix:** Moved `setMinSize`, `snapEdgeRef.current = null`, `setCurrentSnapEdge(null)`, and `originalRectRef.current = null` inside the `operationLock.current.then(async () => {...})` callback, ensuring all state mutations happen after the animation completes.

### WR-02: `handleDragWhileSnapped` mutates refs outside operationLock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** 0c6a0c5
**Applied fix:** Made `handleDragWhileSnapped` callback `async`. Moved `setMinSize` call and all ref clearing (`snapEdgeRef`, `currentSnapEdge`, `originalRectRef`) inside the `operationLock` callback. Added an `else` branch for the case when `originalRectRef.current` is null to still clean up state.

### WR-03: `restoreFromDrawer` uses no-op animation `animateWindow(to, to, 0, ...)`

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** 0c6a0c5
**Applied fix:** Replaced the redundant `animateWindow(to, to, 0, ...)` + `applyAnimState(to)` with a single `await applyAnimState(to)` inside the lock. This eliminates the meaningless interpolation from X to X.

### WR-04: Duplicate `restoreFromDrawer` call from tray context menu

**Files modified:** `src/hooks/useTray.ts`
**Commit:** 0c6a0c5
**Applied fix:** Removed the `onRestoreFromDrawerRef.current()` call from both the toggle-window menu item action and the tray left-click action in `useTray.ts`. The `App.tsx` `onShow` callback already handles drawer restoration, so the tray no longer needs to call it separately.

## Additional Cleanup

- Removed unused `snapPreviewWorkArea` state from `src/App.tsx` (was causing TS6133 after the `workArea` prop removal).
- Removed `workArea` prop from `<SnapIndicator>` JSX call (was causing TS2322, related to IN-01).
- Removed corresponding `setSnapPreviewWorkArea` calls that became dead code.

## Verification

- TypeScript compilation (`tsc --noEmit -p tsconfig.app.json`) shows zero errors in all modified files.
- The pre-existing `useTray.ts` TS2322 error (Menu type mismatch) remains unchanged -- not introduced by this fix.
- Unit tests: 12/13 pass in `useEdgeDrawer.test.ts`. The 1 failing test ("onMouseLeave delay retract") is a pre-existing failure (also fails on the original code before any fixes).

---

_Fixed: 2026-05-11T12:13:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
