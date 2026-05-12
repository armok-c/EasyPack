---
phase: 14-边缘抽屉
fixed_at: 2026-05-11T20:41:00Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 4
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 4)

**Fixed at:** 2026-05-11T20:41:00Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 4

**Summary:**
- Findings in scope: 4 (1 Critical + 3 Warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: `handleDragEnd` mutates snap state outside operationLock -- race condition with shrink animation

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** b8098cb
**Applied fix:** Moved `snapEdgeRef.current = edge`, `setCurrentSnapEdge(edge)`, and `hideToDrawerRef.current()` inside the `operationLock.current.then(async () => { ... })` callback, after the animation completes (after `setIsAnimating(false)`). The `emit("drawer:start-polling", { sliverRect })` call remains outside the lock since it is event-driven, not state-dependent. This eliminates the race where the window appeared "snapped" in state while the shrink animation was still queued.

### WR-01: `handleDragWhileSnapped` else-branch does not restore window position

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** b8098cb
**Applied fix:** Added `await appWindow.setSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT))` and `await appWindow.center()` to the else branch (when `originalRectRef.current` is null), so the window doesn't remain stuck at sliver size.

### WR-02: `drawer:mouse-near-edge` listener emits `drawer:stop-polling` outside lock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** b8098cb
**Applied fix:** Moved `emit("drawer:stop-polling")` inside the lock callback, after the guard checks and before the animation. This prevents re-entry where a new polling cycle could start between the stop-polling emit and the queued animation.

### WR-03: `restoreFromDrawer` does not handle case when `orig` is null

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** b8098cb
**Applied fix:** Added early return for when `originalRectRef.current` is null: restores min size via `await appWindow.setMinSize(...)`, clears `snapEdgeRef.current` and `currentSnapEdge` state, then returns. The old `if (orig) { ... }` block was inverted to `if (!orig) { ... return; }` followed by the unindented operationLock animation code.

## Verification

- **TypeScript compilation** (`tsc --noEmit -p tsconfig.app.json`): No errors in `useEdgeDrawer.ts`. All reported errors are in other files (test mocks, useTray, etc.) and are pre-existing.
- **Unit tests**: 12/13 pass in `useEdgeDrawer.test.ts`. The 1 failing test ("onMouseLeave delay retract") is a pre-existing failure confirmed by running tests on the original code before any fixes were applied.

---

_Fixed: 2026-05-11T20:41:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 4_
