---
phase: 12-系统托盘
reviewed: 2026-04-28T17:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/App.tsx
  - src/components/SettingsDialog.tsx
  - src/components/TitleBar.tsx
  - src/components/__tests__/TitleBar.test.tsx
  - src/components/ui/switch.tsx
  - src/hooks/__tests__/useRecentCommands.test.ts
  - src/hooks/__tests__/useVisibilityState.test.ts
  - src/hooks/useProject.ts
  - src/hooks/useRecentCommands.ts
  - src/hooks/useTray.ts
  - src/hooks/useVisibilityState.ts
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src-tauri/tauri.conf.json
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 12: Code Review Report (Re-review Iteration 9)

**Reviewed:** 2026-04-28T17:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** clean

## Summary

All 14 source files for Phase 12 (System Tray) were reviewed at standard depth. This is re-review iteration 9, verifying fixes from iteration 8 and checking for any remaining or newly introduced issues.

### Previous Fix Verification

**CR-01 (iter 8) -- FIXED and verified.** `useRecentCommands.ts` now correctly uses the `toPersist` capture pattern (lines 36-43). The state updater function runs synchronously per React guarantees, so `toPersist` is assigned before the store write at line 48. The empty dependency array `[]` on `addRecentCommand` is safe because `storeRef.current` is updated on every render (line 19), avoiding stale closures.

**WR-01 (iter 8) -- FIXED and verified.** `TitleBar.test.tsx` no longer references `onCloseBehavior`. All 12 remaining test cases pass only `onSettingsOpen` to TitleBar. The "close" test case (lines 120-125) correctly asserts `mockClose` was called and `mockHide` was not, matching TitleBar's `handleClose` which always calls `appWindow.close()`.

### Cross-file Analysis

- **Effect lifecycle correctness:** `useTray` Effect 1 (tray create/destroy) and Effect 2 (menu updates) have clean responsibility separation. Both use `cancelled` flags for async cleanup. Effect 2 correctly re-runs when `enabled`, `currentProject`, `recentCommands`, `visibility`, or `commands` change.
- **State machine consistency:** `useVisibilityState` provides `hideToTray`/`showFromTray` as stable callbacks (empty deps). These are called before the actual `appWindow.hide()`/`show()` calls, ensuring state is always updated alongside the window operation.
- **onCloseRequested guard:** The `settingsLoaded` flag (line 88) correctly defaults to hiding on close before settings are loaded from store. Once loaded, `closeToTray` determines behavior. The effect cleanup correctly unregisters the listener when `closeToTray` is false.
- **Settings propagation:** `handleTrayEnabledChange` atomically sets both `trayEnabled` and `closeToTray` state, then persists sequentially. When tray is disabled, `closeToTray` is forced to false, the close listener is removed, and the tray icon is destroyed -- all consistent.
- **Security:** No hardcoded secrets, no `eval`, no injection vectors. `assetProtocol` scope is correctly restricted to `$APPDATA/**` and `$HOME/**` (fixed in iter 6). Capabilities in `default.json` list only required permissions.

All reviewed files meet quality standards. No new issues found.

---

_Reviewed: 2026-04-28T17:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
