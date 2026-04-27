---
phase: 12-系统托盘
reviewed: 2026-04-27T15:10:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/hooks/useVisibilityState.ts
  - src/hooks/useRecentCommands.ts
  - src/hooks/useTray.ts
  - src/hooks/__tests__/useVisibilityState.test.ts
  - src/hooks/__tests__/useRecentCommands.test.ts
  - src/components/SettingsDialog.tsx
  - src/components/ui/switch.tsx
  - src/components/TitleBar.tsx
  - src/App.tsx
  - src/hooks/useProject.ts
  - src-tauri/capabilities/default.json
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-27T15:10:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 12 adds system tray support to EasyPack, including a visibility state machine hook (`useVisibilityState`), recent commands tracking (`useRecentCommands`), tray icon management with context menu (`useTray`), a settings dialog with toggle switches (`SettingsDialog`), and window close-to-tray behavior. The overall architecture is sound: hooks are well-separated, the settings dialog is clean, and the visibility state machine is minimal and correct.

One critical issue was found: the `default.json` capabilities file is missing `core:app:allow-default-window-icon`, which means `defaultWindowIcon()` in `useTray.ts` will fail at runtime when the app tries to create the tray icon. This will likely prevent the tray icon from appearing entirely.

Two warnings relate to state synchronization in `useRecentCommands` and a potential tray recreation race condition. Three info-level items cover unused parameters, test coverage gaps, and a minor code clarity issue.

## Critical Issues

### CR-01: Missing `core:app:allow-default-window-icon` permission

**File:** `src-tauri/capabilities/default.json`
**Issue:** The `useTray` hook calls `defaultWindowIcon()` from `@tauri-apps/api/app` (line 129 of `useTray.ts`). In Tauri 2, this API call requires the `core:app:allow-default-window-icon` permission. The current `default.json` only includes `core:default` (which maps to `core:app:default`) and explicit window permissions. The `core:app:default` permission set does NOT include `allow-default-window-icon` -- it only covers `allow-version`, `allow-name`, `allow-tauri-version`, `allow-identifier`, `allow-bundle-type`, `allow-register-listener`, and `allow-remove-listener`. Without this permission, the tray icon creation will fail with a permission denied error.

Note: The `core:tray:default` permission (included via `core:default`) correctly grants `allow-new`, `allow-set-icon`, etc., so the tray API itself is authorized. The gap is specifically the `defaultWindowIcon()` call to retrieve the app icon.

**Fix:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
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
    "core:app:allow-default-window-icon"
  ]
}
```

## Warnings

### WR-01: `addRecentCommand` relies on synchronous state updater side effect for store persistence

**File:** `src/hooks/useRecentCommands.ts:33-50`
**Issue:** The `addRecentCommand` function captures the `updated` array from inside the `setRecentCommands` callback (line 38-42) and then uses it outside the callback to persist to the store (line 44-47). While React calls the state updater function synchronously within the same execution context, this pattern is fragile. If `addRecentCommand` is called twice in rapid succession (e.g., from a batch of command executions), both calls may compute their `updated` arrays based on stale React state via the `setRecentCommands` updaters, but the second store write could overwrite the first because the `storeRef.current.set()` calls are sequential `await`s between separate invocations. The functional updater correctly deduplicates within React state, but the store persistence may write an intermediate value that gets overwritten.

This is mitigated by the fact that commands are typically executed one at a time via user interaction, but it could manifest as a data inconsistency under edge cases.

**Fix:** Move the store persistence inside a `setRecentCommands` callback wrapper, or use a ref to track the latest commands for store writes:
```typescript
const addRecentCommand = useCallback(
  async (name: string, command: string) => {
    const newItem: RecentCommand = { name, command };

    setRecentCommands((prev) => {
      const filtered = prev.filter((c) => c.command !== command);
      const updated = [newItem, ...filtered].slice(0, MAX_COMMANDS);
      // Persist inside the updater where we have the correct computed state
      const currentStore = storeRef.current;
      if (currentStore) {
        currentStore.set(STORE_KEY, updated).catch(() => {});
      }
      return updated;
    });
  },
  []
);
```

### WR-02: Potential tray icon race condition during rapid re-renders

**File:** `src/hooks/useTray.ts:127-183`
**Issue:** The `createTray` function is async and involves multiple `await` calls (lines 129, 132, 135, 141). If the effect's dependencies change rapidly (e.g., `visibility` toggles quickly), React may run the cleanup (which sets `cancelled = true` and closes the tray), then start a new effect. However, if the previous `createTray` hasn't reached an `await` checkpoint yet, both the old and new async functions could be running concurrently. The `cancelled` flag and `trayRef.current` checks provide some protection, but between `TrayIcon.getById(TRAY_ID)` (line 135) and `TrayIcon.new(...)` (line 141), a concurrent `createTray` could create a duplicate tray icon because the check-then-create is not atomic from the async perspective.

The `cancelled` flag check after `await TrayIcon.getById` (line 139) does help, but the window between line 139 and line 141 is vulnerable if the new effect's `createTray` is also executing concurrently.

**Fix:** Add a unique generation counter to ensure only the latest invocation proceeds:
```typescript
useEffect(() => {
  if (!enabled) { /* ... */ return; }

  let generation = 0; // Replaces `cancelled` boolean

  async function createTray() {
    const myGen = ++generation;
    try {
      const icon = await defaultWindowIcon();
      if (generation !== myGen) return;
      // ... rest of creation
      const existing = await TrayIcon.getById(TRAY_ID);
      if (generation !== myGen) return;
      // ... create new tray
    } catch (err) { /* ... */ }
  }

  // ...
  return () => {
    generation++; // Invalidate any in-flight async work
    if (trayRef.current) {
      trayRef.current.close().catch(console.error);
      trayRef.current = null;
    }
  };
}, [/* deps */]);
```

## Info

### IN-01: Unused `commands` parameter in `useTray` dependency array

**File:** `src/hooks/useTray.ts:25,192`
**Issue:** The `useTray` hook accepts `commands: CommandItem[]` in its options interface (line 25) and includes it in the `useEffect` dependency array (line 192), but `commands` is never read inside the effect body. The tray menu only displays `recentCommands`, not `commands`. This means every time the `commands` array reference changes (which happens frequently during normal app usage -- editing commands, switching projects, etc.), the entire tray icon and menu will be torn down and recreated unnecessarily.

**Fix:** Either remove `commands` from the dependency array and the interface if it is truly unused, or document why it is intentionally included (e.g., future expansion). If removed from the interface, also remove it from the call site in `App.tsx` line 114.

### IN-02: Test does not cover store read failure path in `useRecentCommands`

**File:** `src/hooks/__tests__/useRecentCommands.test.ts`
**Issue:** The `useRecentCommands` hook silently catches store read failures (line 28 of the hook), keeping an empty list. The test suite covers the happy path (initial load, add, dedup, max limit, persistence key) but does not test the store failure case. Adding a test where `mockStoreGet` rejects would verify the graceful degradation behavior.

**Fix:** Add a test case:
```typescript
it("store 读取失败时保持空列表", async () => {
  mockStoreGet.mockRejectedValue(new Error("store read failed"));
  const store = createMockStore();
  const { result } = renderHook(() => useRecentCommands({ store }));
  await waitFor(() => {
    expect(result.current.recentCommands).toEqual([]);
  });
});
```

### IN-03: `handleTrayEnabledChange` does not persist the `closeToTray` reset to store

**File:** `src/App.tsx:154-160`
**Issue:** When `trayEnabled` is set to `false`, `closeToTray` is also set to `false` (line 157). However, only `trayEnabled` is persisted to the store (line 159). The `closeToTray` state change is not persisted. This means if the user disables the tray, the `closeToTray` setting will revert to `true` on next app launch (the default), even though the tray is disabled. While the UI will correctly show `closeToTray` as disabled/unchecked when tray is off, the persisted value could be stale.

**Fix:**
```typescript
const handleTrayEnabledChange = useCallback(async (enabled: boolean) => {
  setTrayEnabled(enabled);
  if (!enabled) {
    setCloseToTray(false);
    await store?.set("closeToTray", false);
  }
  await store?.set("trayEnabled", enabled);
}, [store]);
```

---

_Reviewed: 2026-04-27T15:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
