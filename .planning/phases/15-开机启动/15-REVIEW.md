---
phase: 15-开机启动
reviewed: 2026-05-14T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src-tauri/Cargo.toml
  - src-tauri/src/lib.rs
  - src-tauri/capabilities/default.json
  - src/App.tsx
  - src/components/SettingsDialog.tsx
  - package.json
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: fixed
---

# Phase 15 Code Review

## Summary

Phase 15 adds auto-start on boot functionality via `tauri-plugin-autostart`. The Rust backend correctly registers the plugin, detects the `--autostart` flag, hides the window before WebView loads, and performs self-healing of store settings and registry entries. The frontend integrates an autostart toggle switch in the SettingsDialog with dependency on `closeToTray`.

The implementation is largely sound, but one design specification is violated: D-11 ("Autostart enabled requires closeToTray=true, disabled when !closeToTray") is not fully implemented. When `closeToTray` is toggled off directly (not via `trayEnabled`), `autostartEnabled` is not cascaded to false. Additionally, the store loading logic does not enforce the invariant, allowing an inconsistent state to persist across restarts. There are also silent error catches that swallow autostart plugin failures without any logging.

## Critical Issues

### CR-01: Missing cascade when closeToTray is toggled off -- D-11 violated

**File:** `src/App.tsx:277-280`
**Issue:** Design decision D-11 states "Autostart enabled requires closeToTray=true (disabled when !closeToTray)". When the user toggles `closeToTray` off via `handleCloseToTrayChange`, `autostartEnabled` is NOT cascaded to false. The code only handles the `trayEnabled -> false` cascade (D-10 at line 269-272), but misses the direct `closeToTray -> false` path.

Steps to reproduce:
1. Enable system tray, close-to-tray, and auto-start
2. Disable close-to-tray (keep tray enabled)
3. Auto-start remains enabled in both React state and store
4. On next Windows boot, app launches with `--autostart`, hides itself, but closeToTray is false -- the window is hidden with no way to interact since close-to-tray is disabled

This means on autostart, the window hides but `onCloseRequested` will NOT hide to tray (because `closeToTray` is false), so the window just... stays hidden. The user sees nothing on screen and nothing in taskbar, with no way to recover except killing the process.

**Fix:**
```typescript
const handleCloseToTrayChange = useCallback(async (enabled: boolean) => {
    setCloseToTray(enabled);
    await store?.set("closeToTray", enabled);
    // D-11: 关闭 closeToTray 时级联关闭 autostartEnabled
    if (!enabled) {
      setAutostartEnabled(false);
      await store?.set("autostartEnabled", false);
      try { await autostartDisable(); } catch {}
    }
  }, [store]);
```

## Warnings

### WR-01: Store loading does not enforce autostart-closeToTray invariant

**File:** `src/App.tsx:247-255`
**Issue:** When loading settings from store on mount (line 247-255), `autostartEnabled` is loaded independently without checking whether `closeToTray` is also true. If the store contains `autostartEnabled: true` and `closeToTray: false` (due to the bug in CR-01, or manual store editing), this inconsistent state is loaded as-is. The `effectiveCloseToTray` logic at line 249-251 correctly depends on `effectiveTrayEnabled`, but `autostartEnabled` has no analogous dependency on `effectiveCloseToTray`.

**Fix:** Add enforcement after computing effective values:
```typescript
const effectiveAutostartEnabled =
  effectiveCloseToTray
    ? (savedAutostart !== undefined && savedAutostart !== null ? savedAutostart : false)
    : false;
setAutostartEnabled(effectiveAutostartEnabled);
```
If autostart is loaded as true but closeToTray is false, also persist the corrected value and call `autostartDisable()`.

### WR-02: Silent error swallowing in autostart plugin calls

**File:** `src/App.tsx:272` and `src/App.tsx:292`
**Issue:** Both `try { await autostartDisable(); } catch {}` (line 272) and the try/catch in `handleAutostartEnabledChange` (line 286-292) silently swallow all errors. If the autostart plugin fails (e.g., registry access denied, permissions issue, corrupted registry), the user gets no feedback. The React state says "autostart enabled" but the registry was never written. The existing codebase uses `if (import.meta.env.DEV) console.error(...)` pattern for similar error handling (e.g., lines 175, 176, 178, 231), which is a better approach.

**Fix:** Follow existing codebase convention:
```typescript
} catch (err) {
  if (import.meta.env.DEV) {
    console.error("Failed to configure autostart:", err);
  }
}
```

### WR-03: Rust self-heal logic silently ignores store.save() and manager.enable() failures

**File:** `src-tauri/src/lib.rs:49-59` and `src-tauri/src/lib.rs:78`
**Issue:** In the autostart self-heal section, all `store.set()`, `store.save()`, and `manager.enable()` calls use `let _ =` to discard results. If `store.save()` fails (e.g., file system permissions), the store is left in an inconsistent state: in-memory values are updated but not persisted, so the next restart will re-trigger the self-heal. Similarly, `manager.enable()` failure means the registry entry is still missing. While these are best-effort operations and panicking would be worse, the complete silence makes debugging impossible. At minimum, a `log::warn!` or `eprintln!` would help.

This matches the existing `let _ =` pattern used throughout the file (lines 10-12, 97-102, etc.), so it is consistent with codebase conventions. Flagging because the self-heal logic is specifically designed to correct a broken state, so its own failures are more significant than routine UI operations.

**Fix:** Consider using `log::warn!` for self-heal failures if a logging framework is configured, or `eprintln!` for development. At minimum, add a code comment acknowledging that these are best-effort and intentional.

## Info

### IN-01: autostart:allow-is-enabled permission added but not used from frontend

**File:** `src-tauri/capabilities/default.json:39`
**Issue:** The capability `autostart:allow-is-enabled` is declared but the frontend never calls `isEnabled()` from `@tauri-apps/plugin-autostart`. The self-heal logic in Rust (`lib.rs:77`) uses `manager.is_enabled()` directly, which bypasses the capability system. The frontend only calls `enable()` and `disable()`. While this is not harmful (principle of least privilege would suggest removing unused permissions), it is harmless to keep for future use.

**Fix:** Either remove the unused permission, or add a comment noting it is reserved for future frontend use (e.g., showing current autostart status in settings).

### IN-02: handleCloseToTrayChange does not validate autostart prerequisites

**File:** `src/App.tsx:277-280`
**Issue:** When `closeToTray` is toggled on, the code does not check if autostart was previously enabled and should be restored. This is a minor UX concern, not a bug -- if a user disables closeToTray (which should cascade autostart off per CR-01), then re-enables closeToTray, autostart stays off. This is likely the correct behavior, but worth noting for UX consistency.

**Fix:** No action needed -- this is acceptable UX behavior. Documenting for awareness.

---

_Reviewed: 2026-05-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Fix Log

| Finding | Action | Files Changed |
|---------|--------|---------------|
| CR-01 | Added cascade: `handleCloseToTrayChange(!enabled)` → `setAutostartEnabled(false)` + store persist + `autostartDisable()` | `src/App.tsx` |
| WR-01 | `loadTraySettings` now computes `effectiveAutostartEnabled` based on `effectiveCloseToTray`; auto-corrects store if inconsistent | `src/App.tsx` |
| WR-02 | Replaced all `catch {}` with `if (import.meta.env.DEV) console.error(...)` pattern matching codebase convention | `src/App.tsx` |
| WR-03 | Added comments in Rust self-heal sections explaining best-effort intent | `src-tauri/src/lib.rs` |
| IN-01 | Removed unused `autostart:allow-is-enabled` permission | `src-tauri/capabilities/default.json` |
| IN-02 | No action (acceptable UX) | — |

_All fixes verified: `npx tsc --noEmit` and `cargo check` both pass._
