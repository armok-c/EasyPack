---
phase: 14-边缘抽屉
reviewed: 2026-05-11T14:22:00Z
depth: standard
files_reviewed: 16
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

# Phase 14: Code Review Report (Iteration 4)

**Reviewed:** 2026-05-11T14:22:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Iteration 4 review of Phase 14 edge drawer. All 6 findings from iteration 3 have been verified and correctly fixed:

- CR-01 (primaryMonitor as Window method) -- FIXED: now imported as standalone function
- CR-02 (visibility used before declaration) -- FIXED: useVisibilityState() moved before visibilityRef
- WR-01/02 (ref mutations outside operationLock in restoreFromDrawer/handleDragWhileSnapped) -- FIXED: all mutations moved inside lock
- WR-03 (no-op animation in restoreFromDrawer) -- FIXED: replaced with direct applyAnimState
- WR-04 (duplicate restoreFromDrawer call from tray) -- FIXED: useTray no longer calls onRestoreFromDrawer
- IN-01 (unused workArea prop on SnapIndicator) -- FIXED: prop removed
- IN-02 (console.error in production code) -- remains (pre-existing across codebase, not specific to Phase 14)

One new BLOCKER was discovered: `handleDragEnd` sets `snapEdgeRef`, `currentSnapEdge`, and calls `hideToDrawer()` **outside** the operationLock while the sliver-shrink animation is still queued. This creates a race where the window appears as "snapped" in state but is not yet physically collapsed, breaking `handleMouseLeave` and the polling thread contract.

Additionally, the `handleDragWhileSnapped` else-branch and the `handleDragEnd` state mutation ordering present correctness risks.

## Verification of Iteration 3 Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| CR-01: primaryMonitor standalone function | VERIFIED | `import { primaryMonitor } from "@tauri-apps/api/window"` at line 12, called correctly at lines 101, 246, 408 |
| CR-02: visibility before declaration | VERIFIED | `useVisibilityState()` at line 104, `visibilityRef` at lines 107-108 |
| WR-01: restoreFromDrawer mutations inside lock | VERIFIED | Lines 359-374: setMinSize + ref clears inside lock callback |
| WR-02: handleDragWhileSnapped mutations inside lock | VERIFIED | Lines 313-323: all mutations inside lock; else branch (no orig) at lines 326-329 is correct for the no-animation path |
| WR-03: no-op animation removed | VERIFIED | Line 362: direct `await applyAnimState(to)` |
| WR-04: duplicate restoreFromDrawer call | VERIFIED | useTray.ts stores onRestoreFromDrawer in ref but never calls it; onShow callback in App.tsx handles drawer restore |
| IN-01: unused workArea prop | VERIFIED | Line 385: `<SnapIndicator edge={snapPreviewEdge} />` -- no workArea prop |

## Critical Issues

### CR-01: `handleDragEnd` mutates snap state outside operationLock -- race condition with shrink animation

**File:** `src/hooks/useEdgeDrawer.ts:160-165`
**Issue:** After queuing the shrink-to-sliver animation inside `operationLock` (line 149), the function immediately sets `snapEdgeRef`, `currentSnapEdge`, and calls `hideToDrawer()` on lines 160-165 **outside** the lock. Since `operationLock.current = operationLock.current.then(...)` does not await the inner callback, these state changes take effect while the window is still at its original size (animation has not started yet).

This creates two concrete race conditions:

1. **Mouse-leave during shrink animation**: If the user's mouse leaves the window during the 200ms shrink animation, `handleMouseLeave` fires, sees `snapEdgeRef.current !== null` (already set on line 161), and starts a 400ms delayed retraction timer. When the timer fires, `visibilityRef.current` is `"DRAWER_HIDDEN"` (set on line 165), so the retraction skips (line 267). But the polling thread was never started because `emit("drawer:start-polling")` fires on line 168 -- this actually works, but the window ends up in a liminal state where `snapEdge` is set but no polling is active.

2. **Concurrent handleDragEnd calls**: Two rapid drag-end events could both pass the `visibilityRef.current !== "VISIBLE"` guard (line 95) before either animation completes, resulting in two animations queued but only one `snapEdge` state.

The core issue is the same pattern that iteration 3 fixed in `restoreFromDrawer` and `handleDragWhileSnapped` -- state mutations must happen inside the lock to maintain consistency with the window's physical state.

**Fix:** Move the state mutations inside the lock callback:
```typescript
operationLock.current = operationLock.current.then(async () => {
  setIsAnimating(true);
  try {
    await animateWindow(from, to, ANIMATION_DURATION_MS, (state) => {
      applyAnimState(state);
    });
  } finally {
    setIsAnimating(false);
  }

  // 设置吸附边 AFTER animation completes
  snapEdgeRef.current = edge;
  setCurrentSnapEdge(edge);

  // 触发 DRAWER_HIDDEN 状态 AFTER animation completes
  hideToDrawerRef.current();
});

// 通知 Rust 启动鼠标轮询 (can remain outside -- event-driven, not state-dependent)
emit("drawer:start-polling", { sliverRect });
```

## Warnings

### WR-01: `handleDragWhileSnapped` else-branch does not restore window position

**File:** `src/hooks/useEdgeDrawer.ts:324-330`
**Issue:** When `originalRectRef.current` is null (no original position saved), the else branch restores `minSize` and clears refs but does **not** move the window back to a usable position. The window remains at its sliver size (2px wide/tall) with no way to restore it. While `originalRectRef` should normally always be set when `snapEdgeRef` is set, this is a defensive gap -- if the ref is somehow cleared (e.g., by a concurrent `restoreFromDrawer`), the user is stuck with an invisible window.

**Fix:** In the else branch, either fall back to a default size or call `appWindow.center()`:
```typescript
} else {
  // 没有原始位置，使用默认尺寸并居中
  await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
  await appWindow.setSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
  await appWindow.center();
  snapEdgeRef.current = null;
  setCurrentSnapEdge(null);
  originalRectRef.current = null;
}
```

### WR-02: `drawer:mouse-near-edge` listener callback calls `showFromDrawer` inside operationLock but emits `drawer:stop-polling` outside

**File:** `src/hooks/useEdgeDrawer.ts:183-209`
**Issue:** When the mouse-near-edge event fires:
1. Line 184: `emit("drawer:stop-polling")` -- runs immediately, outside the lock
2. Lines 186-209: animation + `showFromDrawer()` -- queued in the lock

If another `drawer:start-polling` event arrives between step 1 and step 2 (e.g., `handleMouseLeave` fires and re-starts polling), the polling thread will be re-started even though a slide-out animation is queued but not yet running. The polling thread could then detect the mouse is near the (now outdated) sliver rect and emit another `drawer:mouse-near-edge` event, creating a duplicate slide-out attempt.

The `visibilityRef.current !== "DRAWER_HIDDEN"` guard (line 188) partially mitigates this, but there is a window between `hideToDrawer()` (in handleMouseLeave) and the state update propagating where the guard could pass.

**Fix:** Move `emit("drawer:stop-polling")` inside the lock callback, before the animation:
```typescript
operationLock.current = operationLock.current.then(async () => {
  if (visibilityRef.current !== "DRAWER_HIDDEN") return;
  if (!originalRectRef.current) return;
  if (cancelled) return;

  // Stop polling inside lock to prevent re-entry
  emit("drawer:stop-polling");
  // ... rest of animation
});
```

### WR-03: `restoreFromDrawer` does not handle case when `orig` is null

**File:** `src/hooks/useEdgeDrawer.ts:355-375`
**Issue:** If `originalRectRef.current` is null (edge case: the ref was cleared by a concurrent operation), `restoreFromDrawer` silently does nothing besides emitting `drawer:stop-polling` and clearing the timeout. It does NOT clear `snapEdgeRef` or `currentSnapEdge`, so the UI remains in a "snapped" state with no way to recover. The early return on line 343 (`if (snapEdgeRef.current === null) return`) means this won't happen if `snapEdgeRef` is also cleared, but if only `originalRectRef` is null while `snapEdgeRef` is still set, the function exits without cleaning up.

**Fix:** Add cleanup for the case when orig is null:
```typescript
const orig = originalRectRef.current;
if (!orig) {
  // No original position -- restore defaults and clear state
  await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
  snapEdgeRef.current = null;
  setCurrentSnapEdge(null);
  return;
}
```

## Info

### IN-01: Test mock still has stale `primaryMonitor` property on mockWindow

**File:** `src/hooks/__tests__/useEdgeDrawer.test.ts:19`
**Issue:** Line 19 adds `primaryMonitor: mockPrimaryMonitor` to the `mockWindow` object. This was needed in the old code when `primaryMonitor` was called as `window.primaryMonitor()`. The production code now correctly uses the standalone `primaryMonitor()` import (mocked at line 27), so line 19 is dead code in the mock. It does not affect test correctness but could mislead future developers into thinking `primaryMonitor` is a Window method.

**Fix:** Remove `primaryMonitor: mockPrimaryMonitor` from the `mockWindow` object on line 19.

### IN-02: `onRestoreFromDrawer` prop accepted by useTray but never used

**File:** `src/hooks/useTray.ts:26,44,67-68`
**Issue:** The `UseTrayOptions` interface declares `onRestoreFromDrawer?: () => void` (line 26), it is destructured (line 44), and stored in a ref (lines 67-68), but the ref is never read or called anywhere in `useTray`. This is dead code left over from the iteration 3 fix for WR-04 (duplicate restoreFromDrawer call). The App.tsx still passes it (line 173), but useTray ignores it entirely.

**Fix:** Remove `onRestoreFromDrawer` from `UseTrayOptions`, the destructuring, and the ref setup. Also remove the prop from the `useTray` call in App.tsx line 173.

### IN-03: `console.error` statements in production code (pre-existing)

**File:** `src/hooks/useEdgeDrawer.ts:170,285`, `src/App.tsx:212`, `src/hooks/useTray.ts:203,242`, `src/hooks/useFloatWindow.ts:39,240`
**Issue:** Multiple `console.error` calls exist across the codebase. Per project TypeScript coding style rules, console statements should not be in production code. This was flagged as IN-02 in iteration 3 and is pre-existing across all phases. Not specific to Phase 14 changes but worth noting for consistency.

**Fix:** Wrap in dev-only checks or replace with a logging utility.

---

_Reviewed: 2026-05-11T14:22:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
