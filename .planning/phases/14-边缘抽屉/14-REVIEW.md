---
phase: 14-边缘抽屉
reviewed: 2026-05-12T12:00:00Z
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
  - src-tauri/tauri.conf.json
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 14: Code Review Report (Iteration 7)

**Reviewed:** 2026-05-12T12:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed 16 source files for Phase 14 (Edge Drawer) at standard depth. This is iteration 7 of the review cycle. Previous iterations (1-6) addressed operationLock coverage, null guards, state ordering, duplicate function calls, and race conditions in cursor polling.

Key areas of focus for this iteration:
1. **SnapIndicator.tsx** uncommitted change removing `workArea` prop -- verified correct
2. Previous iteration fixes remain in place (operationLock serialization, null guards)
3. Cross-file prop consistency verified (App.tsx -> SnapIndicator, TitleBar, SettingsDialog all match)

One new BLOCKER found: `appWindow.center()` is called in `useEdgeDrawer.ts` but the `core:window:allow-center` capability is missing from `default.json`, which will cause a runtime permission error. Three warnings: missing `onMoved` permission risk, state mutations outside operationLock in `handleDragEnd` setup phase, and unguarded `console.error` statements.

## Verification of Iteration 6 Fixes

| Fix | Status | Evidence |
|-----|--------|----------|
| WR-01: restoreFromDrawer no-orig branch inside lock | VERIFIED | Lines 359-363: the no-orig branch is now wrapped in `operationLock.current = operationLock.current.then(async () => { ... })` |
| WR-02: handleDragWhileSnapped showFromDrawer inside lock | VERIFIED | Lines 321-323 and 333-335: `showFromDrawerRef.current()` calls are inside the `operationLock` callback in both orig and no-orig branches |

All prior iteration fixes (1-6) remain in place and intact.

## Critical Issues

### CR-01: Missing `core:window:allow-center` permission causes runtime error

**File:** `src/hooks/useEdgeDrawer.ts:329` (calls `appWindow.center()`)
**Issue:** `handleDragWhileSnapped` calls `appWindow.center()` in the fallback branch (when `originalRectRef.current` is null, i.e., no saved position to restore to). However, the Tauri capability `core:window:allow-center` is not listed in `src-tauri/capabilities/default.json`. When this code path executes, Tauri will reject the IPC call with a permission error, and the window will remain stuck in a tiny sliver state with no original position to restore to. The user would have no way to recover except restarting the app.

This branch executes when: (1) window is in snapped/drawer state, (2) user drags >20px to unsnap, (3) `originalRectRef.current` is null (e.g., due to a prior race condition or HMR reset during development).

**Fix:**
Add `core:window:allow-center` to the permissions list in `src-tauri/capabilities/default.json`:
```json
{
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-destroy",
    "core:window:allow-start-dragging",
    "dialog:default",
    "store:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "global-shortcut:allow-unregister-all",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:app:allow-default-window-icon",
    "core:webview:allow-create-webview-window",
    "core:webview:allow-set-webview-size",
    "core:window:allow-set-position",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-skip-taskbar",
    "core:window:allow-is-maximized",
    "core:event:default",
    "core:window:allow-set-size",
    "core:window:allow-outer-position",
    "core:window:allow-inner-size",
    "core:window:allow-set-min-size",
    "core:window:allow-primary-monitor",
    "core:window:allow-current-monitor",
    "core:window:allow-center"
  ]
}
```

## Warnings

### WR-01: Potential missing `core:window:allow-on-moved` for `onMoved` listener

**File:** `src/App.tsx:270`
**Issue:** The `onMoved` effect (line 263-317) registers a window move listener via `currentWindow.onMoved(...)`. In Tauri 2.x, window event listeners like `onMoved` are internally implemented as IPC commands that go through the window plugin. While `core:event:default` is present (which covers `allow-listen` for generic events), and `core:app:default` includes `allow-register-listener`, the `onMoved` API is a window-level event registration that may require its own permission. If this ever fails silently (the callback simply never fires), the SnapIndicator would never appear during drag.

Verified by checking the ACL manifest: `core:window` has no `allow-on-moved` permission, meaning window event listeners are handled through the generic event system. The `core:event:default` permission covers this. Risk is low but worth monitoring.

**Fix:** Verify at runtime that `onMoved` callbacks fire during dragging. If they do not, investigate adding explicit event permissions. No immediate code change required.

### WR-02: `handleDragEnd` sets state outside operationLock, creating a race window

**File:** `src/hooks/useEdgeDrawer.ts:137-140`
**Issue:** In `handleDragEnd`, `originalRectRef.current` is set at line 137 and `appWindow.setMinSize(new LogicalSize(0, 0))` is called at line 140 -- both outside the `operationLock`. If two rapid `handleDragEnd` calls occur (e.g., rapid drag-end on title bar), both pass the initial guard (`snapEdgeRef.current === null`), both set `originalRectRef.current` to their respective positions, both call `setMinSize(0,0)`, and both enqueue work into `operationLock`. The second call's `originalRectRef` overwrites the first's. In practice, this is unlikely because `handleDragEnd` is triggered on `mouseup` which is a single event, but the pattern violates the invariant that all drawer state mutations should happen inside `operationLock`.

**Fix:** Move `originalRectRef.current` assignment and `setMinSize` call inside the `operationLock` callback, capturing the values in the closure before enqueuing:
```typescript
// Before operationLock -- capture values only:
const origRect = { x: winX, y: winY, w: winW, h: winH };
const sliverRect = calculateSliverRect(edge, workArea, scale);
const from: AnimState = { x: winX, y: winY, w: winW, h: winH };
const to: AnimState = { x: sliverRect.x, y: sliverRect.y, w: sliverRect.w, h: sliverRect.h };

operationLock.current = operationLock.current.then(async () => {
  // Re-check: if another operation already set snapEdge, bail
  if (snapEdgeRef.current !== null) return;

  originalRectRef.current = origRect;
  await appWindow.setMinSize(new LogicalSize(0, 0));
  // ... rest of animation
});
```

### WR-03: `console.error` statements in production code

**File:** `src/hooks/useEdgeDrawer.ts:170,287`
**Issue:** Two `console.error` calls remain in production code (handleDragEnd error handler at line 170, handleMouseLeave error handler at line 287). Per project coding rules, `console.log`/`console.error` should not be in production code. While these are error handlers that provide useful debugging info, they should use a proper logging mechanism or be gated behind dev mode.

**Fix:** Gate behind `import.meta.env.DEV`:
```typescript
if (import.meta.env.DEV) {
  console.error("handleDragEnd failed:", err);
}
```

## Info

### IN-01: SnapIndicator viewport-relative change is correct

**File:** `src/components/SnapIndicator.tsx:17-53`
**Issue:** The uncommitted change replacing `workArea` prop with viewport-relative CSS (`0`, `100vh`, `100vw`) is correct. The previous implementation passed screen-absolute `workArea` coordinates to `position: fixed`, which is viewport-relative -- a mismatch that would cause incorrect positioning on systems with a taskbar offset (e.g., `workArea.y = 40` would shift the indicator 40px down from the window top). The new implementation correctly uses `0`/`100vh`/`100vw` which always align with the window viewport edges. Since the SnapIndicator only appears during drag (when the window edge is near the screen edge), the viewport edges visually coincide with the screen edges. No issue found -- this is a correct fix.

### IN-02: `handleDragWhileSnapped` declared `async` but body does not `await`

**File:** `src/hooks/useEdgeDrawer.ts:302`
**Issue:** The function is declared `async (deltaX: number, deltaY: number) => { ... }` but its return type in `UseEdgeDrawerReturn` is `(deltaX: number, deltaY: number) => void`. TypeScript allows this (async functions return `Promise<void>` which is assignable to `void` in callback position), and the callers in TitleBar do not await the result. The `async` keyword is misleading since the function body does not use `await` -- all async work is deferred to `operationLock`. Not a bug.

**Fix:** Remove `async` from `handleDragWhileSnapped` for clarity.

---

_Reviewed: 2026-05-12T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
