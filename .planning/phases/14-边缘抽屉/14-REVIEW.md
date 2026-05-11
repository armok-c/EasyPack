---
phase: 14-边缘抽屉
reviewed: 2026-05-11T11:49:49Z
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
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 14: Code Review Report (Iteration 3)

**Reviewed:** 2026-05-11T11:49:49Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Re-review (iteration 3) of Phase 14 edge drawer implementation after two rounds of fixes. Previous iteration fixes for ABBA deadlock, operationLock timing, and DRAWER_HIDDEN handling have been correctly applied. However, **two new critical runtime bugs** were discovered:

1. `primaryMonitor()` is a standalone function in `@tauri-apps/api/window`, not a method on the `Window` class. All 4 call sites (3 in `useEdgeDrawer.ts`, 1 in `App.tsx`) call it as `window.primaryMonitor()`, which will throw `TypeError` at runtime. The unit tests pass only because the mock adds this method to the mock window object.

2. `visibilityRef` is initialized from the `visibility` variable before its declaration (hoisting violation), causing a `ReferenceError` at runtime in `App.tsx`.

Additionally, several state mutation ordering issues remain in `restoreFromDrawer` and `handleDragWhileSnapped` where ref mutations occur outside the operationLock, creating potential race conditions.

TypeScript compilation confirms these errors: `tsc --noEmit -p tsconfig.app.json` reports `TS2448` (used before declaration), `TS2339` (Property does not exist), and `TS2322` (Type mismatch on SnapIndicator workArea prop).

## Verification of Previous Iteration Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| CR-01 (iter2): ABBA deadlock | VERIFIED | Lock ordering in Rust is now safe: `start-polling` holds sr+pr simultaneously but no other path reverses this order; polling thread and `stop-polling` never hold both locks at once |
| CR-02 (iter2): DRAWER_HIDDEN in shown-from-rust | VERIFIED | Lines 182-184 in App.tsx handle DRAWER_HIDDEN state correctly |
| WR-01 (iter2): handleMouseLeave captures state outside lock | VERIFIED | getCurrentWindowState now called inside operationLock (line 269) |
| WR-02 (iter2): setIsAnimating outside lock | VERIFIED | setIsAnimating moved inside lock callback (line 272) |
| WR-03 (iter2): useTray await restoreFromDrawer | VERIFIED | Line 82 awaits restoreFromDrawer |

## Critical Issues

### CR-01: `primaryMonitor()` called as Window method -- TypeError at runtime (4 call sites)

**File:** `src/hooks/useEdgeDrawer.ts:101,246,406` and `src/App.tsx:281`
**Issue:** `primaryMonitor()` is a standalone exported function from `@tauri-apps/api/window`, NOT a method on the `Window` class. All four call sites invoke it as `appWindow.primaryMonitor()` or `currentWindow.primaryMonitor()`, which will throw `TypeError: ... .primaryMonitor is not a function` at runtime. The unit tests pass because the mock object in `useEdgeDrawer.test.ts` (line 19) adds `primaryMonitor` as a property -- masking the real API mismatch.

Confirmed by `tsc --noEmit -p tsconfig.app.json`:
```
src/App.tsx(281,47): error TS2339: Property 'primaryMonitor' does not exist on type 'Window'.
```
(Only App.tsx reports because useEdgeDrawer.ts is not directly compiled in the app tsconfig due to test mocks, but the same error applies.)

**Fix:**
```typescript
// In useEdgeDrawer.ts -- add import at top:
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";

// Replace all appWindow.primaryMonitor() calls:
// Line 101:
const monitor = await primaryMonitor();
// Line 246:
const monitor = await primaryMonitor();
// Line 406:
const monitor = await primaryMonitor();

// In App.tsx line 281:
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
// Then:
const monitor = await primaryMonitor();
```

### CR-02: `visibility` used before declaration in App.tsx

**File:** `src/App.tsx:105-106`
**Issue:** `visibilityRef` is initialized from the `visibility` variable on line 105, but `visibility` is not declared until line 109 (via `useVisibilityState()` destructuring). `const` declarations are not hoisted, so this causes a `ReferenceError: Cannot access 'visibility' before initialization` at runtime.

Confirmed by `tsc`:
```
src/App.tsx(105,32): error TS2448: Block-scoped variable 'visibility' used before its declaration.
```

**Fix:** Move the `useVisibilityState()` call (line 109) to before the `visibilityRef` initialization (lines 105-106):
```typescript
// Phase 12: window visibility state machine (Phase 14: three-state)
const { visibility, hideToTray, showFromTray, hideToDrawer, showFromDrawer, isDrawerHidden } = useVisibilityState();

// Phase 14: visibility ref for stale-closure prevention
const visibilityRef = useRef(visibility);
visibilityRef.current = visibility;
```

## Warnings

### WR-01: `restoreFromDrawer` mutates refs outside operationLock

**File:** `src/hooks/useEdgeDrawer.ts:367-373`
**Issue:** After queuing the window position restore animation inside `operationLock` (line 353), the function immediately clears `snapEdgeRef`, `currentSnapEdge`, and `originalRectRef` on lines 371-373 **outside** the lock. Since `operationLock.current = operationLock.current.then(...)` does not await the inner async callback, these state mutations happen before the animation completes. If another operation (e.g., `handleMouseLeave` timer fires) checks these refs between the mutation and the animation completion, it will see inconsistent state (refs cleared but window still in sliver position).

Additionally, `setMinSize(600, 400)` on line 368 is `await`ed outside the lock, which could resize the window while the animation is still shrinking it.

**Fix:** Move all state mutations inside the lock callback, and either `await` the lock chain or restructure to avoid the race:
```typescript
operationLock.current = operationLock.current.then(async () => {
  setIsAnimating(true);
  try {
    const from = await getCurrentWindowState();
    if (from) {
      await animateWindow(from, to, ANIMATION_DURATION_MS, applyAnimState);
    }
  } finally {
    setIsAnimating(false);
  }
  // Restore minWidth AFTER animation
  await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
  // Clear state AFTER animation
  snapEdgeRef.current = null;
  setCurrentSnapEdge(null);
  originalRectRef.current = null;
});
```

### WR-02: `handleDragWhileSnapped` mutates refs outside operationLock

**File:** `src/hooks/useEdgeDrawer.ts:310,322-324`
**Issue:** Same pattern as WR-01. `setMinSize` on line 310 is fire-and-forget (not awaited), and refs are cleared on lines 322-324 outside the lock while the animation (line 316-318) runs asynchronously inside the lock. If the animation fails or is slow, the ref state is already cleared.

**Fix:** Move `setMinSize` call and ref clearing inside the lock callback.

### WR-03: `restoreFromDrawer` uses `animateWindow(to, to, 0, ...)` -- no-op animation

**File:** `src/hooks/useEdgeDrawer.ts:356-360`
**Issue:** The `animateWindow` call passes the same value for `from` and `to`, making it a complete no-op (interpolating from X to X yields X). The actual position restore then relies on the redundant `applyAnimState(to)` call on line 360. While this works, it's misleading -- the `animateWindow` call serves no purpose and should be replaced with just the direct `applyAnimState(to)`.

**Fix:**
```typescript
operationLock.current = operationLock.current.then(async () => {
  setIsAnimating(true);
  try {
    await applyAnimState(to);
  } finally {
    setIsAnimating(false);
  }
  // ... rest of cleanup
});
```

### WR-04: Duplicate `restoreFromDrawer` call from tray context menu

**File:** `src/hooks/useTray.ts:81-83` and `src/App.tsx:155-158`
**Issue:** When restoring from DRAWER_HIDDEN via the tray context menu:
1. `useTray.ts` line 82 calls `await onRestoreFromDrawerRef.current()` (which is `restoreFromDrawer`)
2. Then line 84 calls `onShowRef.current()` (which is the `onShow` callback from App.tsx)
3. App.tsx `onShow` callback (line 156) checks `isDrawerHidden` and calls `restoreFromDrawer()` again

The second call is a no-op because `snapEdgeRef` is already null, but this creates confusing control flow and wastes an async cycle. The responsibility for calling `restoreFromDrawer` should be in exactly one place.

**Fix:** Either:
- Remove the `restoreFromDrawer` call from `useTray.ts` line 82 and let `onShow` handle everything, or
- Remove the drawer check from `onShow` and let `useTray.ts` handle it before calling `onShow`

## Info

### IN-01: `SnapIndicator` receives unused `workArea` prop

**File:** `src/App.tsx:389` and `src/components/SnapIndicator.tsx:3`
**Issue:** `App.tsx` passes `workArea={snapPreviewWorkArea}` to `SnapIndicator`, but the `SnapIndicatorProps` interface only declares `edge: SnapEdge | null`. The `workArea` prop is not used. The `snapPreviewWorkArea` state variable and its setter are also unused.

Confirmed by `tsc`: `src/App.tsx(389,45): error TS2322: Property 'workArea' does not exist on type 'IntrinsicAttributes & SnapIndicatorProps'`

**Fix:** Remove `workArea={snapPreviewWorkArea}` from the JSX call. Optionally remove the `snapPreviewWorkArea` state and `setSnapPreviewWorkArea` setter if they are not used elsewhere.

### IN-02: `console.error` statements in production code

**File:** `src/hooks/useEdgeDrawer.ts:170,285`
**Issue:** Two `console.error` calls in `useEdgeDrawer.ts` (`handleDragEnd` and `handleMouseLeave` slide-in). Per project coding style rules, `console.log/error` should not be in production code.

**Fix:** Replace with a proper logging utility, or at minimum wrap in a development-only check:
```typescript
if (import.meta.env.DEV) {
  console.error("handleDragEnd failed:", err);
}
```

---

_Reviewed: 2026-05-11T11:49:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
