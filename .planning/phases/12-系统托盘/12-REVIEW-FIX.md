---
phase: 12-系统托盘
fixed_at: 2026-04-28T14:30:00Z
review_path: .planning/phases/12-系统托盘/12-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-28T14:30:00Z
**Source review:** .planning/phases/12-系统托盘/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical, 4 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Stale closure over `updated` variable causes persistence skip in useRecentCommands

**Files modified:** `src/hooks/useRecentCommands.ts`
**Verification:** TypeScript syntax check passed (no new errors), re-read confirmed correct code structure.

**Applied fix:** Moved the `store.set()` persistence call inside the `setRecentCommands` updater callback. The `updated` array is now computed as a `const` inside the updater where it has the correct value, and persistence happens synchronously within that scope. This eliminates the React batched-update race condition where the outer `let updated` was read before the updater executed.

**Status:** fixed: requires human verification (logic bug fix -- reviewer identified a React state timing issue that cannot be verified by syntax checking alone).

### CR-02: Missing `core:window:allow-destroy` permission -- tray quit action fails at runtime

**Files modified:** `src-tauri/capabilities/default.json`
**Verification:** JSON syntax check passed, re-read confirmed permission added.

**Applied fix:** Added `"core:window:allow-destroy"` to the permissions array, placed immediately after `"core:window:allow-close"`. This grants the tray menu's "quit" action the required permission to call `getCurrentWindow().destroy()`.

### WR-01: Tray menu toggle uses stale `visibility` closure

**Files modified:** `src/hooks/useTray.ts`
**Verification:** TypeScript syntax check passed (only pre-existing errors), re-read confirmed ref usage.

**Applied fix:** Added `visibilityRef` pattern (same pattern as existing `onShowRef`, `onHideRef`, etc.). The ref is updated on every render with `visibilityRef.current = visibility`. Inside `buildMenu`, both the toggle text computation and the action callback now read `visibilityRef.current` instead of the closure-captured `visibility`, ensuring they always read the latest value.

### WR-02: useTray rebuilds entire tray icon on every dependency change instead of updating menu only

**Files modified:** `src/hooks/useTray.ts`
**Verification:** TypeScript syntax check passed (only pre-existing errors), re-read confirmed two-effect structure.

**Applied fix:** Split the single monolithic effect into two effects:

1. **Effect 1 (line 118-175):** Keyed on `[enabled]` only. Handles tray icon creation (with icon loading, menu building, left-click action binding) when `enabled=true`, and tray destruction when `enabled=false` or on cleanup. This effect does NOT re-run when data changes.

2. **Effect 2 (line 177-201):** Keyed on `[enabled, currentProject, recentCommands, visibility, commands]`. Only updates the menu via `trayRef.current.setMenu(menu)` without recreating the tray icon. Guards against running when disabled or when tray does not exist.

The `buildMenu` function was lifted out of both effects to be shared between them (it reads from refs for callback stability).

**Status:** fixed: requires human verification (significant refactoring of effect structure -- verify tray behavior in development).

### WR-03: handleTrayEnabledChange does not persist closeToTray when force-set to false

**Files modified:** `src/App.tsx`
**Verification:** Re-read confirmed correct placement.

**Applied fix:** Added `await store?.set("closeToTray", false)` inside the `if (!enabled)` block, before the `trayEnabled` persistence. This ensures both state changes are persisted together, preventing the inconsistent state where `closeToTray=true` would be loaded from store on restart while `trayEnabled=false`.

### WR-04: CSP set to null disables all Content Security Policy protections

**Files modified:** `src-tauri/tauri.conf.json`
**Verification:** JSON syntax check passed, re-read confirmed CSP policy set.

**Applied fix:** Replaced `"csp": null` with a restrictive CSP policy: `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"`. The `unsafe-inline` for styles is required by Tailwind CSS and shadcn/ui which inject inline style rules. All other directives are restricted to `'self'`.

---

_Fixed: 2026-04-28T14:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
