---
phase: 14-边缘抽屉
fixed_at: 2026-05-12T01:17:19Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 5
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 5)

**Fixed at:** 2026-05-12T01:17:19Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 5

**Summary:**
- Findings in scope: 4 (1 Critical + 3 Warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: handleMouseLeave transitions visibility state and emits start-polling outside operationLock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** `c44f7ee`
**Applied fix:** Moved `hideToDrawerRef.current()` and `emit("drawer:start-polling", { sliverRect: actualSliverRect })` from outside the operationLock callback (lines 282-283) to inside the lock, after `setIsAnimating(false)`. This ensures the visibility state transition and Rust polling thread start only occur after the shrink animation completes, matching the pattern used in handleDragEnd.

### WR-01: handleDragWhileSnapped else-branch mutates refs outside operationLock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** `ccdf3d3`
**Applied fix:** Wrapped the else-branch body (setMinSize, setSize, center, ref clears) in `operationLock.current = operationLock.current.then(async () => { ... })` so these mutations serialize through the lock alongside the if-branch mutations.

### WR-02: Rust polling thread can emit mouse-near-edge after stop-polling is received

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** `b5cda63`
**Applied fix:** Added `if (snapEdgeRef.current === null) return;` as the first check inside the operationLock callback in the `drawer:mouse-near-edge` listener, before the existing visibility check. This provides defense-in-depth against stale events arriving after stop-polling.

### WR-03: handleDragEnd emits start-polling before animation

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** `8aefcbf`
**Applied fix:** Moved `emit("drawer:start-polling", { sliverRect })` inside the operationLock callback, after `hideToDrawerRef.current()`. Removed the standalone emit at the original line 168. This ensures Rust polling only starts after the drawer animation completes and visibility transitions to DRAWER_HIDDEN.

## Verification

- **TypeScript compilation** (`tsc --noEmit -p tsconfig.app.json`): No errors in `useEdgeDrawer.ts` after all 4 fixes. All reported errors are in other files (test mocks, other components) and are pre-existing.

---

_Fixed: 2026-05-12T01:17:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 5_
