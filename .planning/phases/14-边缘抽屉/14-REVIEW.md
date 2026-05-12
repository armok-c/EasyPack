---
phase: 14-边缘抽屉
reviewed: 2026-05-12T11:30:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/App.tsx
  - src/components/FloatApp.tsx
  - src/components/SettingsDialog.tsx
  - src/components/SnapIndicator.tsx
  - src/components/TitleBar.tsx
  - src/hooks/__tests__/useEdgeDrawer.test.ts
  - src/hooks/__tests__/useVisibilityState.test.ts
  - src/hooks/useEdgeDrawer.ts
  - src/hooks/useFloatWindow.ts
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

# Phase 14: Code Review Report (Iteration 8)

**Reviewed:** 2026-05-12T11:30:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed all 18 source files for Phase 14 (Edge Drawer). This iteration focuses on verifying iteration 7 fixes and reviewing new uncommitted changes to FloatApp.tsx, useFloatWindow.ts, SnapIndicator.tsx, and tauri.conf.json.

**Iteration 7 verification:** All three iteration-7 fixes are confirmed in place:
- CR-01: `core:window:allow-center` permission present in default.json (line 37).
- WR-02: `originalRectRef` and `setMinSize` state mutations moved inside operationLock (useEdgeDrawer.ts lines 147-148).
- WR-03: `console.error` gated behind `import.meta.env.DEV` in useEdgeDrawer.ts (lines 170, 289).

**tauri.conf.json trayIcon removal:** Verified safe. The `tray-icon` feature flag remains enabled in `Cargo.toml` (line 16), and the tray icon is created programmatically in `useTray.ts` via `TrayIcon.new()`. The `tauri.conf.json` `trayIcon` section was only used for static tray creation at startup; since the app creates the tray dynamically based on settings, removing it is correct.

**New findings in uncommitted changes:**

## Verification of Prior Iteration Fixes

| Fix (Iteration) | Status | Evidence |
|-----|--------|----------|
| CR-01 (iter 7): allow-center permission | VERIFIED | `src-tauri/capabilities/default.json:36` |
| WR-02 (iter 7): state mutations inside lock | VERIFIED | `src/hooks/useEdgeDrawer.ts:147-148` |
| WR-03 (iter 7): console.error DEV-gated | VERIFIED | `src/hooks/useEdgeDrawer.ts:170,289` |

## Critical Issues

### CR-01: FloatApp.tsx emit+destroy race -- main window may never receive close event

**File:** `src/components/FloatApp.tsx:57-60`
**Issue:** `emit("float:close-requested")` is fire-and-forget (not awaited). `floatWindow.destroy()` executes on the next line. Tauri cross-window event delivery is asynchronous -- the float window may be destroyed before the main window's listener processes the event.

When the event is lost, the main window's `useFloatWindow` never calls `cleanupFloatState()`, leaving React state inconsistent:
- `floatVisible` stays `true` -- TitleBar shows wrong toggle state
- `floatWindowRef` holds a dead `WebviewWindow` reference
- The `float:close-requested` listener remains registered (leaked)

The next `toggleFloat` call hits Branch A (existing window + valid ref), then `existing.isVisible()` may throw or return stale data for the destroyed window. Branch B recovery depends on `existing.isVisible()` succeeding, which is fragile.

This is a correctness bug because the user closes the float window, but the main window believes it is still open. The TitleBar button stays in "float is visible" state and the next click attempts to hide a non-existent window.

**Fix:**
```typescript
// FloatApp.tsx -- await emit to maximize delivery chance:
async function handleClose() {
  await emit("float:close-requested");
  await floatWindow.destroy();
}

// More robust option: let the main window own destruction entirely.
// In useFloatWindow.ts registerFloatListeners:
const unlistenClose = await listen("float:close-requested", async () => {
  const win = floatWindowRef.current;
  cleanupFloatState();
  if (win) {
    try { await win.destroy(); } catch { /* already destroyed */ }
  }
});

// Then FloatApp.tsx only emits, does NOT destroy:
async function handleClose() {
  emit("float:close-requested");
  // Float window stays alive briefly; main window destroys it after cleanup.
}
```

## Warnings

### WR-01: `destroyFloat` return type is `void` but caller uses `await`, causing race on quit

**File:** `src/hooks/useFloatWindow.ts:20,255-264` and `src/App.tsx:166-167`
**Issue:** `destroyFloat` was refactored from `async () => Promise<void>` to a synchronous function that enqueues async work onto the operationLock. The return type in `UseFloatWindowReturn` is now `() => void` (line 20). However, `App.tsx` lines 166-167 still call:
```typescript
await destroyFloat();  // awaits undefined, resolves immediately
await appWindow.destroy();  // runs concurrently with destroyFloat's lock work
```
Since `destroyFloat()` returns `undefined`, `await undefined` resolves on the next microtick, and `appWindow.destroy()` races with the float window destruction inside the operationLock. On app quit, the main window can be destroyed before the float window is cleaned up, leaving an orphaned float window process.

**Fix:**
```typescript
// Return the lock promise so callers can await completion:
const destroyFloat = useCallback((): Promise<void> => {
  return operationLock.current = operationLock.current.then(async () => {
    const existing = await WebviewWindow.getByLabel("float");
    if (existing) {
      try { await existing.destroy(); } catch { /* already destroyed */ }
    }
    floatWindowRef.current = null;
    setFloatVisible(false);
    cleanupListeners();
  });
}, [cleanupListeners]);

// Update interface:
interface UseFloatWindowReturn {
  floatVisible: boolean;
  toggleFloat: () => void;
  destroyFloat: () => Promise<void>;
}
```

### WR-02: `.catch(() => {})` on toggleFloat/destroyFloat silently swallows all errors

**File:** `src/hooks/useFloatWindow.ts:245,264`
**Issue:** Both `toggleFloat` (line 245) and `destroyFloat` (line 264) chain `.catch(() => {})` on the operationLock promise. This silently discards errors from:
- `adoptFloatWindow` failures (Branch B)
- `WebviewWindow.getByLabel` failures
- `existing.destroy()` failures in destroyFloat
- Any unexpected errors indicating real bugs

The Branch C `createFloat` failure already has a try/catch with `toast.error`, so the `.catch(() => {})` does not help the user -- it only hides bugs from the developer.

**Fix:**
```typescript
// Replace with DEV-gated logging:
}).catch((err) => {
  if (import.meta.env.DEV) {
    console.error("useFloatWindow operation failed:", err);
  }
});
```

### WR-03: `positionFloatTopRight` console.error not gated behind DEV

**File:** `src/hooks/useFloatWindow.ts:39`
**Issue:** `console.error("Failed to set float window position:", err)` is not gated behind `import.meta.env.DEV`, inconsistent with the iteration 7 WR-03 fix applied to `useEdgeDrawer.ts` (lines 170, 289). This file is actively modified in the current changeset and should follow the established pattern.

**Fix:**
```typescript
} catch (err) {
  if (import.meta.env.DEV) {
    console.error("Failed to set float window position:", err);
  }
}
```

## Info

### IN-01: onMoved listener re-registers on every snapEdge/isDrawerAnimating change

**File:** `src/App.tsx:317`
**Issue:** The `onMoved` effect depends on `[drawerEnabled, snapEdge, isDrawerAnimating]`. Since `snapEdge` changes when snapping/unsnapping and `isDrawerAnimating` toggles during animations, this effect tears down and recreates the `onMoved` listener on every state transition. Not a correctness issue but adds unnecessary overhead during drawer operations.

**Fix:** Use refs for `snapEdge` and `isDrawerAnimating` to stabilize the effect, or accept the overhead as minor.

### IN-02: SnapIndicator viewport-relative CSS change is correct

**File:** `src/components/SnapIndicator.tsx`
**Issue:** The uncommitted change replacing `workArea` prop with viewport-relative CSS (`0`, `100vh`, `100vw`) is correct. The previous implementation passed screen-absolute `workArea` coordinates to `position: fixed` (which is viewport-relative) -- a mismatch that would cause incorrect positioning on systems with taskbar offsets. The new implementation correctly uses viewport-relative values. No issue found.

---

_Reviewed: 2026-05-12T11:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
