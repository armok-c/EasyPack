---
phase: 14-边缘抽屉
reviewed: 2026-05-12T01:52:02Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/App.tsx
  - src/components/SettingsDialog.tsx
  - src/components/SnapIndicator.tsx
  - src/components/TitleBar.tsx
  - src/hooks/__tests__/useEdgeDrawer.test.ts
  - src/hooks/__tests__/useVisibilityState.test.ts
  - src/hooks/useEdgeDrawer.ts
  - src/hooks/useTray.ts
  - src/hooks/useVisibilityState.ts
  - src/lib/__tests__/drawer-animation.test.ts
  - src/lib/__tests__/drawer-geometry.test.ts
  - src/lib/drawer-animation.ts
  - src/lib/drawer-geometry.ts
  - src-tauri/capabilities/default.json
  - src-tauri/src/lib.rs
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 14: Code Review Report (Iteration 6)

**Reviewed:** 2026-05-12T01:52:02Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Iteration 6 review of all 15 Phase 14 source files. All 4 fixes from iteration 5 (CR-01, WR-01, WR-02, WR-03) have been verified as correctly applied. Two new warnings found this iteration:

1. `restoreFromDrawer` no-orig branch mutates refs outside `operationLock` -- a latent race condition in a defensive code path.
2. `handleDragWhileSnapped` calls `showFromDrawerRef.current()` outside `operationLock`, breaking the lock encapsulation.

Three pre-existing info items carried forward (stale test mock property, dead code in useTray, console.error in production).

No critical issues found. The core `operationLock` serialization pattern is now solid for the primary code paths. The two new warnings are in secondary/defensive paths with narrow race windows.

## Verification of Iteration 5 Fixes

| Fix | Status | Evidence |
|-----|--------|----------|
| CR-01: handleMouseLeave state transitions inside lock | VERIFIED | Lines 265-284: `hideToDrawerRef.current()` (line 283) and `emit("drawer:start-polling", ...)` (line 284) are inside the `operationLock.current.then(...)` callback, after `setIsAnimating(false)` |
| WR-01: handleDragWhileSnapped else-branch inside lock | VERIFIED | Lines 327-335: else-branch body wrapped in `operationLock.current = operationLock.current.then(async () => { ... })` |
| WR-02: snapEdge null guard in mouse-near-edge handler | VERIFIED | Line 185: `if (snapEdgeRef.current === null) return;` is the first check inside the lock callback |
| WR-03: start-polling emit inside lock in handleDragEnd | VERIFIED | Line 167: `emit("drawer:start-polling", { sliverRect })` is inside the lock callback, after `hideToDrawerRef.current()` |

## Warnings

### WR-01: restoreFromDrawer no-orig branch mutates refs outside operationLock

**File:** `src/hooks/useEdgeDrawer.ts:362-367`
**Issue:** In `restoreFromDrawer`, when `originalRectRef.current` is null (the defensive fallback path), the code calls `setMinSize`, clears `snapEdgeRef`, and calls `setCurrentSnapEdge(null)` entirely outside the `operationLock`. If a concurrent operation is running inside the lock (e.g., a prior `handleDragEnd` shrink animation or `handleMouseLeave` slide-back), the `setMinSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT)` call at line 364 can conflict with the animation that is actively resizing the window to a sliver. Specifically, setting `minWidth = 600` while the animation is shrinking the window to a 2px sliver would cause the animation to fail or produce a 600px-wide "sliver" instead of the intended 2px.

While the no-orig branch is currently unreachable in normal operation (because `originalRectRef.current` is always set in `handleDragEnd` line 137 before `snapEdgeRef` is set inside the lock), this defensive branch exists for a reason. If future code changes create a scenario where `originalRectRef` can be null while `snapEdgeRef` is non-null, this race would manifest as a visual bug.

**Fix:**
```typescript
if (!orig) {
  operationLock.current = operationLock.current.then(async () => {
    await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
    snapEdgeRef.current = null;
    setCurrentSnapEdge(null);
  });
  return;
}
```

### WR-02: handleDragWhileSnapped calls showFromDrawerRef outside operationLock

**File:** `src/hooks/useEdgeDrawer.ts:338-341`
**Issue:** After queuing the restore animation inside `operationLock`, `handleDragWhileSnapped` reads `visibilityRef.current` and calls `showFromDrawerRef.current()` (which sets `visibility` to `"VISIBLE"`) outside the lock. This breaks the lock encapsulation pattern: the visibility state transition happens immediately rather than after the lock-queued animation completes.

In practice, the impact is limited because:
- If `visibilityRef.current` is already `"VISIBLE"` (the common case when the window is slid out), the call is skipped.
- If `visibilityRef.current` is `"DRAWER_HIDDEN"` (the case when the window is in sliver mode and the user drags), setting it to `"VISIBLE"` before the restore animation completes means `handleMouseLeave` could observe `"VISIBLE"` and start a hide timer during the restore animation, causing a visual flicker (restore-then-shrink).

While the lock-queued restore animation will eventually clear `snapEdgeRef.current = null` (line 322), which prevents the `handleMouseLeave` timer callback from proceeding (line 267 guard), there is a 400ms window (the hide delay) where `snapEdgeRef` is still non-null and `visibility` is `"VISIBLE"`, allowing the timer to fire and queue a shrink animation that races with the restore.

**Fix:**
```typescript
// Inside handleDragWhileSnapped, move showFromDrawer into the lock callback:
if (orig) {
  const to: AnimState = { x: orig.x, y: orig.y, w: orig.w, h: orig.h };
  operationLock.current = operationLock.current.then(async () => {
    await applyAnimState(to);
    await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
    snapEdgeRef.current = null;
    setCurrentSnapEdge(null);
    originalRectRef.current = null;
    // Restore visibility AFTER animation completes (inside lock)
    if (visibilityRef.current !== "VISIBLE") {
      showFromDrawerRef.current();
    }
  });
} else {
  operationLock.current = operationLock.current.then(async () => {
    await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
    await appWindow.setSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
    await appWindow.center();
    snapEdgeRef.current = null;
    setCurrentSnapEdge(null);
    originalRectRef.current = null;
    // Restore visibility AFTER animation completes (inside lock)
    if (visibilityRef.current !== "VISIBLE") {
      showFromDrawerRef.current();
    }
  });
}
// Remove the outside-lock showFromDrawer call:
// if (visibilityRef.current !== "VISIBLE") {
//   showFromDrawerRef.current();
// }
```

## Info

### IN-01: Stale primaryMonitor property on mockWindow in tests

**File:** `src/hooks/__tests__/useEdgeDrawer.test.ts:19`
**Issue:** `mockWindow` includes `primaryMonitor: mockPrimaryMonitor` as a property, but the production code uses `primaryMonitor` as a standalone function from `@tauri-apps/api/window` (mocked at line 27), not as a Window method. The property on `mockWindow` is dead code. Pre-existing since iteration 4.

**Fix:** Remove `primaryMonitor: mockPrimaryMonitor` from the `mockWindow` object (line 19).

### IN-02: onRestoreFromDrawer accepted by useTray but never used

**File:** `src/hooks/useTray.ts:26,44,67-68`
**Issue:** `useTray` accepts `onRestoreFromDrawer` as a prop and stores it in a ref (`onRestoreFromDrawerRef`, lines 67-68), but the ref is never read anywhere in the hook body. This is dead code from the iteration 3 fix (WR-04: duplicate restoreFromDrawer call removed from useTray). `App.tsx` line 173 still passes the prop. Pre-existing since iteration 4.

**Fix:** Remove `onRestoreFromDrawer` from `UseTrayOptions` interface, the destructuring, the ref declaration and assignment, and the `App.tsx` prop.

### IN-03: console.error in production code (pre-existing)

**File:** `src/hooks/useEdgeDrawer.ts:170,287` (also `src/App.tsx:212`, `src/hooks/useTray.ts:203,242`, `src/hooks/useFloatWindow.ts:39,240`)
**Issue:** Multiple `console.error` calls in production code. Pre-existing across codebase, not specific to Phase 14.

**Fix:** Replace with dev-only checks or a logging utility.

---

_Reviewed: 2026-05-12T01:52:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
