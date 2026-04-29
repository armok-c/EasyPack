---
phase: 13-迷你悬浮窗
reviewed: 2026-04-29T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - vite.config.ts
  - float.html
  - src/float-main.tsx
  - src/components/FloatApp.tsx
  - src/hooks/useFloatWindow.ts
  - src-tauri/capabilities/default.json
  - src/components/TitleBar.tsx
  - src/hooks/useTray.ts
  - src/App.tsx
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-29T12:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the 9 source files implementing the "mini float window" feature for EasyPack. The implementation is generally well-structured with correct event listener cleanup, proper ref patterns to avoid stale closures, and a clean Vite multi-page build setup. The Tauri capabilities configuration correctly includes both `main` and `float` windows.

Key concerns identified:
1. **Wrong monitor selection** for initial float window positioning -- uses `monitors[0]` from `availableMonitors()` instead of `primaryMonitor()`, which may place the window on the wrong display in multi-monitor setups.
2. **Race condition in toggleFloat** -- rapid double-invocation can attempt to create a duplicate `WebviewWindow` with the same label, resulting in a misleading error toast.
3. **Unvalidated event payload** from the float window -- the `float:execute` event carries a `command` string that is passed directly to `onExecute` without any validation.

## Warnings

### WR-01: Wrong monitor used for float window initial position

**File:** `src/hooks/useFloatWindow.ts:99-100`
**Issue:** `availableMonitors()` returns all connected monitors with no guaranteed ordering. The code assumes `monitors[0]` is the primary monitor. On multi-monitor Windows setups, this frequently returns a non-primary monitor first, causing the float window to appear on the wrong screen. Tauri provides a dedicated `primaryMonitor()` function (importable from `@tauri-apps/api/window`) for exactly this purpose.
**Fix:**
```typescript
import { primaryMonitor } from "@tauri-apps/api/window";

// Replace lines 99-100:
const primary = await primaryMonitor();
if (primary) {
```

### WR-02: Race condition in toggleFloat -- duplicate window creation attempt

**File:** `src/hooks/useFloatWindow.ts:135-163`
**Issue:** When `toggleFloat` is called rapidly twice (e.g., double-click on the TitleBar button), both calls may enter the "window does not exist" branch (line 152) concurrently. The first call creates a `WebviewWindow("float", ...)` synchronously but has not yet set `floatWindowRef.current` or `floatVisible`. The second call finds `WebviewWindow.getByLabel("float")` returning the window created by the first call, but `floatWindowRef.current` is still `null`, so the condition at line 138 (`existing && floatWindowRef.current`) evaluates to `false`. The second call then attempts `new WebviewWindow("float", ...)` which throws because the label already exists. This results in a misleading "无法创建悬浮窗" error toast for the user.
**Fix:** Add an `isCreating` ref guard:
```typescript
const isCreatingRef = useRef(false);

// In toggleFloat, before the create branch:
if (isCreatingRef.current) return;
isCreatingRef.current = true;
try {
  const floatWin = await createFloat();
  floatWindowRef.current = floatWin;
  setFloatVisible(true);
  await syncState(floatWin);
} catch (err) {
  // ...
} finally {
  isCreatingRef.current = false;
}
```

### WR-03: No validation on float:execute event payload

**File:** `src/hooks/useFloatWindow.ts:115-120`
**Issue:** The `float:execute` event listener passes `event.payload.command` directly to `onExecuteRef.current()` without any validation. While the float window is the only emitter in normal operation, the `listen()` API is process-wide -- any webview in the application can emit this event. If the `command` field is missing or not a string (e.g., due to a malformed event), it will be passed to the execution pipeline unvalidated. This is especially relevant because the float window shares the same capabilities as the main window.
**Fix:**
```typescript
const unlistenExecute = await listen<{ command: string }>(
  "float:execute",
  (event) => {
    const { command } = event.payload;
    if (typeof command === "string" && command.length > 0) {
      onExecuteRef.current(command);
    }
  }
);
```

### WR-04: Float window position not recalculated on show

**File:** `src/hooks/useFloatWindow.ts:142-148`
**Issue:** When the float window is hidden and then shown again via `toggleFloat`, its position is not recalculated. If the user has disconnected/reconnected monitors or changed display scaling between the hide and show, the float window may reappear at an off-screen or incorrect position. The position is only set during initial window creation.
**Fix:** Call the position calculation logic when showing the window, not just when creating it. Extract the position logic into a shared helper function and invoke it in both `createFloat` and the show branch of `toggleFloat`.

### WR-05: `once("tauri://error")` listener not cleaned up on success

**File:** `src/hooks/useFloatWindow.ts:92-95`
**Issue:** The `once("tauri://error")` listener registered at line 94 is only cleaned up if the error event fires. If the window is created successfully (the `tauri://created` event fires and resolves the promise), the `once("tauri://error")` handler remains registered until garbage collection. While `once` handlers auto-remove after firing, this one never fires on the success path. In practice this is a minor leak per window creation, but it violates the principle of explicit cleanup and could cause unexpected behavior if a late error event arrives.
**Fix:** Clean up the error listener after successful creation:
```typescript
await new Promise<void>((resolve, reject) => {
  floatWin.once("tauri://created", () => resolve());
  floatWin.once("tauri://error", (e) => reject(e));
  // Consider adding a timeout for safety
});
// After resolution, the once handlers are consumed.
// Alternatively, use listen + manual cleanup:
```
Or simply document that `once` handlers are self-cleaning by design (either they fire and self-remove, or they remain until GC). This is a low-priority finding.

## Info

### IN-01: Redundant `floatVisible` in `toggleFloat` dependency array

**File:** `src/hooks/useFloatWindow.ts:163`
**Issue:** `toggleFloat` has `floatVisible` in its dependency array, which means the callback is recreated every time `floatVisible` changes. However, `floatVisible` is only used to decide whether to show or hide. Since the function already reads `existing` from `WebviewWindow.getByLabel()`, it could instead check the window's actual visibility state (e.g., `await existing.isVisible()`) and remove `floatVisible` from the dependency array entirely, making the callback more stable.
**Fix:** Replace `floatVisible` check with `await existing.isVisible()` and remove `floatVisible` from the dependency array.

### IN-02: Unused `availableMonitors` import after potential refactor

**File:** `src/hooks/useFloatWindow.ts:4`
**Issue:** If WR-01 is fixed by switching to `primaryMonitor()`, the `availableMonitors` import becomes unused and should be removed. Track this as a cleanup item.
**Fix:** Replace `import { availableMonitors } from "@tauri-apps/api/window"` with `import { primaryMonitor } from "@tauri-apps/api/window"` when fixing WR-01.

### IN-03: `createFloat` in `useCallback` dependency array of `toggleFloat`

**File:** `src/hooks/useFloatWindow.ts:163`
**Issue:** `createFloat` is in `toggleFloat`'s dependency array. Since `createFloat` itself depends on `cleanupListeners` (which is stable due to `useCallback([], [])`), `createFloat` is also stable. This is correct, but the chain of `useCallback` dependencies makes this harder to verify. A brief comment noting the stability guarantee would improve maintainability.
**Fix:** Add a comment: `// createFloat is stable: its only dep (cleanupListeners) has an empty dep array`.

---

_Reviewed: 2026-04-29T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
