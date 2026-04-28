---
phase: 12-系统托盘
reviewed: 2026-04-28T04:10:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/App.tsx
  - src/components/SettingsDialog.tsx
  - src/components/TitleBar.tsx
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
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 12: Code Review Report (Re-review)

**Reviewed:** 2026-04-28T04:10:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Re-review after fixes for CR-01 (tray quit race condition), CR-02 (MainArea bypass), WR-01 (failed command tracking), WR-02 (unhandled promise rejections), WR-03 (unmemoized currentProject). All five previous findings have been verified as correctly fixed. No regressions introduced by the fixes.

Two new warnings and three info items found. The warnings are: (1) executing recent commands from the tray menu when no project is selected silently fails with no user feedback; (2) Effect 2 in useTray can miss menu updates during the initial tray creation window because `trayRef.current` is still null when Effect 2 runs. Info items cover the remaining unused `commands` dependency from the previous review round, a duplicate tray icon at startup from the tauri.conf.json static definition, and a test naming inconsistency.

## Previous Findings Verification

### CR-01: Tray quit race condition -- VERIFIED FIXED

**Evidence:**
- `src/App.tsx:123`: `onQuit` now uses `await appWindow.destroy()` which bypasses the `onCloseRequested` interceptor entirely.
- `src/hooks/useTray.ts:108-110`: Quit menu item action only calls `onQuitRef.current()`, no redundant `destroy()` call.
- `src-tauri/capabilities/default.json:11`: `core:window:allow-destroy` permission is present.

### CR-02: MainArea bypasses recent command tracking -- VERIFIED FIXED

**Evidence:**
- `src/App.tsx:189`: `onExecute={handleExecuteWithRecent}` correctly wired to MainArea.

### WR-01: Failed commands added to recent history -- VERIFIED FIXED

**Evidence:**
- `src/hooks/useProject.ts:257-274`: `executeCommand` now returns `Promise<boolean>` (true on success, false on failure).
- `src/App.tsx:97-98`: `handleExecuteWithRecent` checks `if (!success) return;` before tracking.

### WR-02: Unhandled promise rejections in tray callbacks -- VERIFIED FIXED

**Evidence:**
- `src/App.tsx:121`: `appWindow.show().catch(console.error); appWindow.setFocus().catch(console.error);`
- `src/App.tsx:122`: `appWindow.hide().catch(console.error);`

### WR-03: Tray menu rebuilds on every render -- VERIFIED FIXED

**Evidence:**
- `src/hooks/useProject.ts:68-71`: `currentProject` wrapped in `useMemo` with `[selectedId, projects]` dependencies.

## Warnings

### WR-01: Tray recent commands silently fail with no user feedback when no project is selected

**File:** `src/hooks/useTray.ts:86-97`, `src/hooks/useProject.ts:259`
**Issue:** When `currentProject` is null (no project selected), the tray menu still shows recent commands from previous sessions. Clicking one of these calls `handleExecuteWithRecent`, which calls `executeCommand`. In `useProject.ts:259`, `executeCommand` returns `false` when `currentProject` is null -- but does so without any toast, error message, or user feedback. The user clicks a tray menu command and nothing happens: no terminal opens, no error toast appears, no visual indication of failure.
**Fix:**
```typescript
// Option A: Show a toast when no project is selected (in executeCommand):
const executeCommand = useCallback(
  async (shellCommand: string): Promise<boolean> => {
    if (!currentProject) {
      toast.error("请先选择一个项目");
      return false;
    }
    // ... rest of function
  },
  [currentProject]
);

// Option B: Disable recent command menu items when no project is selected (in useTray buildMenu):
if (hasCommands) {
  for (let i = 0; i < recentCommands.length; i++) {
    const cmd = recentCommands[i];
    items.push(
      await MenuItem.new({
        id: `cmd-${i}`,
        text: `> run: ${cmd.name}`,
        enabled: currentProject !== null,  // <-- disable when no project
        action: () => {
          onExecuteRef.current(cmd.command);
        },
      })
    );
  }
}
```

### WR-02: Effect 2 in useTray can miss initial menu updates due to async tray creation race

**File:** `src/hooks/useTray.ts:177-200`
**Issue:** When `enabled` changes from false to true, both Effect 1 (tray creation) and Effect 2 (menu update) fire. Effect 2 checks `if (!trayRef.current) return;` at line 179. Since Effect 1's `createTray()` is async (multiple `await` calls: `defaultWindowIcon()`, `buildMenu()`, `TrayIcon.getById()`, `TrayIcon.new()`), `trayRef.current` is still null when Effect 2 runs. Effect 2 skips the update. If no dependency changes after Effect 1 completes, the menu is only set during initial creation via `buildMenu()` inside Effect 1. This is correct for initial load. However, if `currentProject` or `recentCommands` change during the async window between Effect 2's skip and Effect 1's completion, the final menu may reflect stale data because Effect 2 already ran and skipped for that dependency change. The window is small (milliseconds to seconds depending on async operations) but the race exists.
**Fix:**
```typescript
// Option A: After Effect 1 completes, manually trigger a menu update:
useEffect(() => {
  if (!enabled) {
    // ... existing cleanup
    return;
  }

  let cancelled = false;

  async function createTray() {
    try {
      // ... existing creation code ...
      trayRef.current = tray;

      // After creation, build and set menu with latest data
      const latestMenu = await buildMenu();
      if (!cancelled && trayRef.current) {
        await trayRef.current.setMenu(latestMenu);
      }
    } catch (err) {
      console.error("Failed to create tray icon:", err);
    }
  }

  createTray();
  // ... existing cleanup
}, [enabled]);

// Option B: Use a "ready" state flag that Effect 2 depends on:
// (more complex but cleaner separation of concerns)
```

## Info

### IN-01: Unused `commands` dependency in tray menu update effect (carried over from previous review)

**File:** `src/hooks/useTray.ts:200`
**Issue:** The `commands` prop is in Effect 2's dependency array but is never read inside `buildMenu()` or the effect body. This causes unnecessary effect re-triggering when commands change. This was IN-01 in the previous review and was not addressed in the fix round.
**Fix:** Remove `commands` from the dependency array:
```typescript
}, [enabled, currentProject, recentCommands, visibility]);
```

### IN-02: Duplicate tray icon at startup from tauri.conf.json static definition

**File:** `src-tauri/tauri.conf.json:27-31`, `src/hooks/useTray.ts:137-156`
**Issue:** `tauri.conf.json` defines a static `trayIcon` with `id: "main-tray"` that Tauri creates at app startup. Then `useTray.ts` Effect 1 finds this icon via `TrayIcon.getById("main-tray")`, closes it, and creates a new one with the same ID. This creates a brief period at startup where a bare tray icon exists (no menu, no click handler) before being replaced by the JS-managed one. The user may see a momentary tray icon flicker. Consider either: (a) removing the `trayIcon` config from `tauri.conf.json` and relying solely on the JS API, or (b) keeping the config and having `useTray.ts` update the existing icon's menu instead of closing and recreating it.
**Fix:** Either remove the `trayIcon` section from `tauri.conf.json` (if tray is fully JS-managed), or refactor `useTray.ts` to reuse the existing tray icon.

### IN-03: Test naming inconsistency in useRecentCommands test

**File:** `src/hooks/__tests__/useRecentCommands.test.ts:41`
**Issue:** The test is named `"addCommand({name, command}) 后列表长度为 1"` but the actual function being tested is `addRecentCommand`. The test name references `addCommand` which does not exist in the hook's API.
**Fix:** Rename to `"addRecentCommand({name, command}) 后列表长度为 1"`.

---

_Reviewed: 2026-04-28T04:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
