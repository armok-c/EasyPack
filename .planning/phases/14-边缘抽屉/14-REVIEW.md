---
phase: 14-边缘抽屉
reviewed: 2026-05-11T16:00:00Z
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
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 14: Code Review Report (Iteration 5)

**Reviewed:** 2026-05-11T16:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Iteration 5 review of all 15 Phase 14 source files. All 4 CR/WR fixes from iteration 4 have been verified as correctly applied. One new critical issue found (`handleMouseLeave` state transitions outside the operationLock), plus 3 warnings and 3 info items (all pre-existing).

## Verification of Iteration 4 Fixes

| Fix | Status | Evidence |
|-----|--------|----------|
| CR-01: handleDragEnd snap state inside lock | VERIFIED | Lines 149-165: `snapEdgeRef.current`, `setCurrentSnapEdge`, and `hideToDrawerRef.current()` all inside `operationLock.current.then(...)` callback |
| WR-01: handleDragWhileSnapped else-branch default size | VERIFIED | Lines 324-332: else branch sets `setMinSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT)`, `setSize(...)`, `center()`, clears all refs |
| WR-02: drawer:stop-polling inside lock | VERIFIED | Line 190: `emit("drawer:stop-polling")` inside the operationLock callback for the mouse-near-edge handler |
| WR-03: restoreFromDrawer null orig guard | VERIFIED | Lines 358-364: early return with `setMinSize` + ref cleanup when `orig` is null |

## Critical Issues

### CR-01: handleMouseLeave transitions visibility state and emits start-polling outside operationLock

**File:** `src/hooks/useEdgeDrawer.ts:282-283`
**Issue:** In `handleMouseLeave`, after queuing the shrink animation inside `operationLock` (line 264-280), the function calls `hideToDrawerRef.current()` at line 282 and `emit("drawer:start-polling")` at line 283 **outside** the lock chain. These two side effects execute synchronously before the animation begins.

This creates a concrete inconsistency:

1. `visibility` state switches to `"DRAWER_HIDDEN"` immediately (line 282), before the 200ms shrink animation completes.
2. Rust polling thread starts immediately (line 283), checking cursor against the sliver rect while the window is still at expanded size.
3. If `restoreFromDrawer` or `handleDragWhileSnapped` is invoked during the animation window, the system sees `visibility === "DRAWER_HIDDEN"` but the window is not yet collapsed -- violating the state machine invariant.

Compare with `handleDragEnd` (lines 149-165, fixed in iteration 4) where `hideToDrawerRef.current()` is correctly inside the lock after animation. The `handleMouseLeave` path has the exact same pattern that was fixed in `handleDragEnd`, but was missed.

**Fix:**
```typescript
// Move hideToDrawer and emit inside the lock callback:
operationLock.current = operationLock.current.then(async () => {
  if (snapEdgeRef.current === null) return;
  if (visibilityRef.current !== "VISIBLE") return;

  const from = await getCurrentWindowState();
  if (!from) return;

  setIsAnimating(true);
  try {
    await animateWindow(from, to, ANIMATION_DURATION_MS, (state) => {
      applyAnimState(state);
    });
  } finally {
    setIsAnimating(false);
  }

  // State transition AFTER animation completes (inside lock)
  hideToDrawerRef.current();
  emit("drawer:start-polling", { sliverRect: actualSliverRect });
});

// Remove these two lines from outside the lock:
// hideToDrawerRef.current();
// emit("drawer:start-polling", { sliverRect: actualSliverRect });
```

## Warnings

### WR-01: handleDragWhileSnapped else-branch mutates refs outside operationLock

**File:** `src/hooks/useEdgeDrawer.ts:324-332`
**Issue:** The else-branch (when `originalRectRef.current` is null) performs `setMinSize`, `setSize`, `center()`, and clears `snapEdgeRef`/`currentSnapEdge`/`originalRectRef` entirely outside the operationLock. If a concurrent operation is pending in the lock chain (e.g., a prior `handleDragEnd` animation or `handleMouseLeave` shrink), the ref mutations here can race with the lock-protected mutations in the if-branch at lines 313-323. Both branches of `handleDragWhileSnapped` should serialize through the lock for consistency.

**Fix:** Wrap the else-branch body in `operationLock.current = operationLock.current.then(async () => { ... })`.

### WR-02: Rust polling thread can emit mouse-near-edge after stop-polling is received

**File:** `src-tauri/src/lib.rs:150-199`
**Issue:** The polling thread sleeps for 100ms between iterations (line 151). When `drawer:stop-polling` fires (line 205), it sets `running = false` and `rect = None`. However, the thread may be in the middle of its sleep cycle, wake up, check the sliver rect (which was just cleared to None), and break. But if the thread already read `rect_opt` as `Some(...)` at line 162-165 just before the stop-polling handler cleared it, the thread can still emit `drawer:mouse-near-edge` at line 185 before checking `running` again. This race allows a stale `mouse-near-edge` event to arrive after the frontend has already called `stop-polling`.

Mitigation: The frontend `drawer:mouse-near-edge` handler checks `visibilityRef.current !== "DRAWER_HIDDEN"` and `originalRectRef.current` before proceeding, which provides partial protection. However, if `restoreFromDrawer` clears `originalRectRef` but has not yet cleared `snapEdgeRef`, the handler could still proceed with stale data.

**Fix:** In the frontend `drawer:mouse-near-edge` handler (line 183-209), add `if (snapEdgeRef.current === null) return;` before the existing checks for defense-in-depth.

### WR-03: handleDragEnd emits start-polling before animation starts

**File:** `src/hooks/useEdgeDrawer.ts:168`
**Issue:** `emit("drawer:start-polling", { sliverRect })` at line 168 fires synchronously before the operationLock chain executes the shrink animation. The Rust polling thread will begin checking cursor position against the sliver area immediately, but the window is still at its original expanded position. If the cursor is near where the sliver will be (but the window is still large), the polling thread could emit `drawer:mouse-near-edge` and trigger a premature slide-out before the drawer is fully hidden.

This is a lower-severity variant of CR-01 because the `drawer:mouse-near-edge` handler checks `visibilityRef.current !== "DRAWER_HIDDEN"` which guards against the most dangerous case (the handler returns early since visibility is still VISIBLE at that point). However, there is a narrow window after `hideToDrawerRef.current()` runs inside the lock (setting visibility to DRAWER_HIDDEN) but before the animation fully completes, where the polling thread could fire.

**Fix:** Move `emit("drawer:start-polling", { sliverRect })` inside the operationLock chain, after `hideToDrawerRef.current()`.

## Info

### IN-01: Stale primaryMonitor property on mockWindow in tests

**File:** `src/hooks/__tests__/useEdgeDrawer.test.ts:19`
**Issue:** `mockWindow` includes `primaryMonitor: mockPrimaryMonitor` as a property, but the production code uses `primaryMonitor` as a standalone function from `@tauri-apps/api/window` (mocked at line 27), not as a Window method. The property on `mockWindow` is dead code. Pre-existing since iteration 4.

**Fix:** Remove `primaryMonitor: mockPrimaryMonitor` from the `mockWindow` object.

### IN-02: onRestoreFromDrawer accepted by useTray but never used

**File:** `src/hooks/useTray.ts:26,44,67-68`
**Issue:** `useTray` accepts `onRestoreFromDrawer` as a prop and stores it in a ref, but the ref is never read. This is dead code from the iteration 3 fix (WR-04: duplicate restoreFromDrawer call removed from useTray). App.tsx line 173 still passes the prop. Pre-existing since iteration 4.

**Fix:** Remove `onRestoreFromDrawer` from `UseTrayOptions`, the destructuring, the ref, and the App.tsx prop.

### IN-03: console.error in production code (pre-existing)

**File:** `src/hooks/useEdgeDrawer.ts:170,285` (also `src/App.tsx:212`, `src/hooks/useTray.ts:203,242`, `src/hooks/useFloatWindow.ts:39,240`)
**Issue:** Multiple `console.error` calls in production code. Pre-existing across codebase, not specific to Phase 14.

**Fix:** Replace with dev-only checks or a logging utility.

---

_Reviewed: 2026-05-11T16:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
