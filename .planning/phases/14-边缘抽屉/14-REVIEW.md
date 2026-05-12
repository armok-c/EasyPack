---
phase: 14-边缘抽屉
reviewed: 2026-05-12T12:00:00Z
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
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 14: Code Review Report (Iteration 9)

**Reviewed:** 2026-05-12T12:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Iteration 9 re-review of all Phase 14 source files plus 3 uncommitted changes (tauri.conf.json trayIcon removal, SnapIndicator.tsx viewport-relative CSS fix, .claude/settings.local.json).

**Prior iteration fixes verified as still in place:**

| Fix (Iteration) | Status | Evidence |
|-----|--------|----------|
| CR-01 (iter 8): FloatApp emit+destroy race | VERIFIED | `FloatApp.tsx:55-56` sends `float:close-requested` only, no destroy. Main window owns destruction at `useFloatWindow.ts:112-121` |
| WR-01 (iter 8): destroyFloat returns Promise\<void\> | VERIFIED | `useFloatWindow.ts:266` signature `(): Promise<void>`, caller at `App.tsx:166` uses `await` |
| WR-02 (iter 8): toggleFloat error logging DEV-gated | VERIFIED | `useFloatWindow.ts:253` uses `if (import.meta.env.DEV)` |
| WR-03 (iter 8): positionFloatTopRight console.error DEV-gated | VERIFIED | `useFloatWindow.ts:39` uses `if (import.meta.env.DEV)` |
| IN-01 (iter 8): onMoved listener re-registration overhead | ACCEPTED | Minor overhead, no correctness impact |
| IN-02 (iter 8): SnapIndicator viewport-relative CSS | VERIFIED | Now uses `0`/`100vh`/`100vw` correctly for `position:fixed` |

**Uncommitted changes reviewed:**
- `tauri.conf.json`: Removal of declarative `trayIcon` section. Correct -- avoids duplicate tray creation since `useTray.ts` manages the full lifecycle programmatically with the same ID `"main-tray"`.
- `SnapIndicator.tsx`: Changed from `workArea` coordinates to viewport-relative CSS (`100vh`/`100vw` and `0`). Removed unused `Rect` import and `workArea` prop. Correct -- `position:fixed` is viewport-relative, so using workArea coordinates was wrong.

**New findings:** 3 warnings. No critical issues found. All prior fixes remain intact.

## Warnings

### WR-01: Unhandled promise rejection risk in useEdgeDrawer operationLock chain

**File:** `src/hooks/useEdgeDrawer.ts:142,185,267,319,330,363,373`
**Issue:** The `operationLock` mutex pattern chains 7 `.then()` calls without any `.catch()` handler. If any operation inside the lock throws (e.g., `animateWindow`, `applyAnimState`, Tauri API call failures), the error propagates to the promise chain as an unhandled rejection. In contrast, `useFloatWindow.ts` (same pattern) correctly attaches `.catch()` handlers at lines 252-256 and 275-279.

While the outer `handleDragEnd` and `handleMouseLeave` functions have their own `try/catch` blocks, these only cover the synchronous portion before the lock. Once work is queued via `operationLock.current = operationLock.current.then(async () => {...})`, the queued work runs asynchronously and its rejections escape the outer try/catch.

**Fix:**
```typescript
// Add .catch() to each operationLock chain, e.g. line 142:
operationLock.current = operationLock.current.then(async () => {
  // ... existing lock body ...
}).catch((err) => {
  if (import.meta.env.DEV) {
    console.error("useEdgeDrawer operation failed:", err);
  }
});
```

Apply the same `.catch()` pattern to all 7 `.then()` chains in the file (lines 142, 185, 267, 319, 330, 363, 373), consistent with how `useFloatWindow.ts` handles the same pattern.

### WR-02: console.error in onCloseRequested not gated behind DEV mode

**File:** `src/App.tsx:212`
**Issue:** `console.error("Failed to hide window:", err)` is not gated behind `import.meta.env.DEV`. This is inconsistent with the WR-02/WR-03 fixes from iterations 7-8, which added DEV gating to equivalent error logging in `useFloatWindow.ts` and `useEdgeDrawer.ts`. While this code path originated in Phase 12 (pre-existing), it is within the reviewed file set and should follow the established convention.

**Fix:**
```typescript
} catch (err) {
  if (import.meta.env.DEV) {
    console.error("Failed to hide window:", err);
  }
}
```

### WR-03: restoreFromDrawer() called without await in tray onShow callback

**File:** `src/App.tsx:156`
**Issue:** In the tray `onShow` callback, `restoreFromDrawer()` is called without `await`, while the same call in `main:shown-from-rust` listener (line 182) and `onCloseRequested` handler (line 205) both use `await restoreFromDrawer()`. The inconsistency reduces code clarity.

Note: `await` on `restoreFromDrawer()` does not wait for the restore animation to complete (the function queues work on `operationLock` and returns immediately). However, the `await` at least ensures the synchronous portion (stopping polling, clearing timeout) completes before `showFromDrawer()` and `appWindow.show()` run. Without `await`, there is a brief window where visibility is set to "VISIBLE" by `showFromDrawer()` before `restoreFromDrawer` has even started its synchronous cleanup.

**Fix:**
```typescript
onShow: async () => {
  if (isDrawerHidden || visibility === "DRAWER_HIDDEN") {
    await restoreFromDrawer();
    showFromDrawer();
  } else {
    showFromTray();
  }
  appWindow.show().catch(console.error);
  appWindow.setFocus().catch(console.error);
},
```

## Info

### IN-01: Pre-existing .catch(console.error) patterns in App.tsx not DEV-gated

**File:** `src/App.tsx:161,162,164`
**Issue:** Lines `appWindow.show().catch(console.error)`, `appWindow.setFocus().catch(console.error)`, and `appWindow.hide().catch(console.error)` use bare `console.error` in `.catch()` handlers without DEV gating. These are pre-existing patterns from Phase 12, outside the strict scope of Phase 14 iteration fixes. Flagged for awareness -- these should be gated behind `import.meta.env.DEV` to match the convention established in iterations 7-8.

**Fix:** No immediate action required. Consider a project-wide pass to gate all `console.error` behind DEV mode in a future cleanup phase.

---

_Reviewed: 2026-05-12T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 9_
