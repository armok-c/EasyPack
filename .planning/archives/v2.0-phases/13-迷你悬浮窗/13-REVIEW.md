---
phase: 13-迷你悬浮窗
reviewed: 2026-04-29T17:30:00Z
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
  critical: 1
  warning: 0
  info: 1
  total: 2
status: issues_found
---

# Phase 13: Code Review Report (Re-Review)

**Reviewed:** 2026-04-29T17:30:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This is a re-review after fixing 5 warnings from the initial review (WR-01 through WR-05). All 5 original fixes have been verified as correctly applied:

- **WR-01 (fixed):** `primaryMonitor()` replaces `availableMonitors()` -- correct API, correct null guard.
- **WR-02 (fixed):** `isCreatingRef` race guard added with proper `finally` reset.
- **WR-03 (fixed):** Event payload validation added for `float:execute` -- checks `typeof command === "string" && command.length > 0`.
- **WR-04 (fixed):** `positionFloatTopRight()` extracted as module-level function, called both on create and on show.
- **WR-05 (fixed):** `listen()` + manual `cleanup()` replaces `once()` -- both success and error paths clean up the other listener.

However, this re-review discovered **one new critical bug** that was present in the original code and was not caught by the initial review. `WebviewWindow.getByLabel()` is an `async` function returning `Promise<WebviewWindow | null>`, but it is called without `await` in two places. This means the toggle and destroy paths will fail at runtime with `TypeError: existing.hide is not a function`.

## Critical Issues

### CR-01: Missing `await` on `WebviewWindow.getByLabel()` -- runtime crash

**File:** `src/hooks/useFloatWindow.ts:162` and `src/hooks/useFloatWindow.ts:203`
**Issue:** `WebviewWindow.getByLabel()` is an async function that returns `Promise<WebviewWindow | null>` (confirmed in `@tauri-apps/api/webviewWindow.d.ts:55` and the implementation at `webviewWindow.js:82`). It is called without `await` in both `toggleFloat` (line 162) and `destroyFloat` (line 203). The result `existing` is a Promise object, not a `WebviewWindow`. Since a Promise is truthy, the condition `if (existing && floatWindowRef.current)` always passes when `floatWindowRef.current` is set. Then `await existing.hide()` (line 165) calls `.hide()` on the Promise object, which has no such method, causing `TypeError: existing.hide is not a function` at runtime.

This means:
1. **`toggleFloat`** always enters the "window exists" branch (because the Promise is truthy), then crashes when trying to call `.hide()` or `.show()` on the Promise. The error is caught by the `try` block and shows "无法创建悬浮窗", but the window is never actually shown or hidden.
2. **`destroyFloat`** always enters the destroy branch, then crashes when calling `.destroy()` on the Promise. The error is silently swallowed by the `catch {}` block, so the float window is never actually destroyed on app exit.

For reference, `useTray.ts:167` correctly uses `await` with `TrayIcon.getById(TRAY_ID)`, which has the same async signature.

**Fix:**
```typescript
// Line 162 -- toggleFloat:
const existing = await WebviewWindow.getByLabel("float");

// Line 203 -- destroyFloat:
const existing = await WebviewWindow.getByLabel("float");
```

## Info

### IN-01: Previous info items status update

**File:** `src/hooks/useFloatWindow.ts`
**Issue:** The 3 info items from the initial review remain tracked:
- IN-01 (`floatVisible` in dependency array): Still applicable, low priority.
- IN-02 (unused `availableMonitors` import): Fully resolved by WR-01 fix.
- IN-03 (`createFloat` stability comment): Still applicable, low priority.
**Fix:** No action required. These are informational only.

---

_Reviewed: 2026-04-29T17:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
