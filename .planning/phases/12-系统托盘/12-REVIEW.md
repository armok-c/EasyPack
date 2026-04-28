---
phase: 12-系统托盘
reviewed: 2026-04-28T12:00:00Z
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
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-28T12:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed all 13 files in scope for Phase 12 (system tray support). The implementation covers tray icon lifecycle, visibility state machine, recent command tracking, settings dialog, and window close interception. Found 2 critical bugs and 3 warnings. The critical issues are: (1) the tray "Quit" action has a race condition between `close()` being intercepted by `onCloseRequested` and a subsequent `destroy()` call, causing unpredictable quit behavior; (2) `MainArea` uses `executeCommand` directly, bypassing recent command tracking for all UI-initiated command executions -- only global shortcuts and tray menu executions are tracked. Warnings include unhandled promise rejections in tray callbacks, unnecessary menu rebuilds on every render due to unmemoized `currentProject`, and a logic error where failed commands are still added to recent history.

## Critical Issues

### CR-01: Tray "Quit" action has race condition with onCloseRequested interceptor

**File:** `src/hooks/useTray.ts:108-110`
**Issue:** The tray menu "Quit" action calls `onQuitRef.current()` (which calls `appWindow.close()`) **without await**, then immediately calls `getCurrentWindow().destroy()`. When `closeToTray` is enabled, `appWindow.close()` triggers the `onCloseRequested` handler in `App.tsx:129-132`, which calls `event.preventDefault()` and hides the window instead of closing it. The subsequent `destroy()` call then forces destruction. This creates a race: `hideToTray()` sets visibility state to `TRAY_HIDDEN` before the window is destroyed by `destroy()`. The two operations (`close` intercepted as hide, then `destroy`) are contradictory and their ordering is non-deterministic. When `closeToTray` is false, `close()` destroys the window first, then `destroy()` operates on a destroyed window, potentially throwing errors.

**Fix:**
```typescript
// In App.tsx, change onQuit to use destroy() instead of close() to bypass the interceptor:
onQuit: async () => { await appWindow.destroy(); }

// In useTray.ts buildMenu(), the quit item action should only call onQuit, not also destroy:
items.push(
  await MenuItem.new({
    id: "quit",
    text: "退出",
    action: () => {
      onQuitRef.current();
    },
  })
);
```

### CR-02: MainArea UI commands bypass recent command tracking

**File:** `src/App.tsx:188`
**Issue:** `MainArea` receives `onExecute={executeCommand}` (line 188), which is the raw `executeCommand` from `useProject`. The recent command tracking wrapper `handleExecuteWithRecent` is only wired to `useGlobalShortcuts` (line 108) and `useTray` (line 119). This means commands executed by clicking the command cards in the main UI -- the primary user interaction -- are never recorded in recent commands. The tray menu's recent commands list will always be empty or stale because the most common execution path is excluded.

**Fix:**
```typescript
// In App.tsx, change MainArea's onExecute prop:
<MainArea
  // ... other props
  onExecute={handleExecuteWithRecent}  // was: executeCommand
  // ... other props
/>
```

## Warnings

### WR-01: Failed commands are added to recent history

**File:** `src/App.tsx:96-103`
**Issue:** `handleExecuteWithRecent` calls `await executeCommand(shellCommand)` on line 97, then unconditionally adds the command to recent history on lines 98-103. However, `executeCommand` catches its own errors internally (`useProject.ts:265-268`) and does **not** re-throw. This means `handleExecuteWithRecent` always proceeds to the tracking logic, even when command execution failed. Users will see failed commands in their "recent" tray menu, which is misleading.

**Fix:**
```typescript
// Option A: Refactor executeCommand to return success/failure boolean
// In useProject.ts:
const executeCommand = useCallback(
  async (shellCommand: string): Promise<boolean> => {
    if (!currentProject) return false;
    try {
      await invoke("execute_command", {
        projectPath: currentProject.path,
        shellCommand,
      });
      toast.success(`已执行: ${shellCommand}`);
      return true;
    } catch (error) {
      toast.error(
        `命令执行失败：${error}。请检查项目路径和命令是否正确。`
      );
      return false;
    }
  },
  [currentProject]
);

// Then in handleExecuteWithRecent:
const handleExecuteWithRecent = useCallback(async (shellCommand: string) => {
  const success = await executeCommand(shellCommand);
  if (!success) return;
  const cmd = commands.find((c) => c.command === shellCommand);
  if (cmd) {
    await addRecentCommand(cmd.name, cmd.command);
  } else {
    await addRecentCommand(shellCommand, shellCommand);
  }
}, [executeCommand, commands, addRecentCommand]);
```

### WR-02: Unhandled promise rejections in tray onShow/onHide callbacks

**File:** `src/App.tsx:120-121`
**Issue:** The `onShow` and `onHide` callbacks passed to `useTray` call `appWindow.show()`, `appWindow.setFocus()`, and `appWindow.hide()` without `await` or `.catch()`. These functions return `Promise<void>`. If any of these calls fail (e.g., window already destroyed), the rejected promise is unhandled. While `useTray.ts` itself properly catches errors in its internal `show`/`hide` calls (lines 56, 59-60), the callbacks from `App.tsx` are called first, and their failures go unhandled.

**Fix:**
```typescript
onShow: async () => {
  showFromTray();
  await appWindow.show().catch(console.error);
  await appWindow.setFocus().catch(console.error);
},
onHide: async () => {
  hideToTray();
  await appWindow.hide().catch(console.error);
},
```

### WR-03: Tray menu rebuilds on every render due to unmemoized currentProject reference

**File:** `src/hooks/useTray.ts:201`, `src/hooks/useProject.ts:68-70`
**Issue:** Effect 2's dependency array includes `currentProject`, which is derived via `.find()` in `useProject.ts:68-70` without memoization. This creates a new object reference on every render of the parent component, causing Effect 2 to fire on every render. Each Effect 2 execution calls `buildMenu()` which creates multiple `await MenuItem.new()` calls -- an async operation that rebuilds the entire tray menu unnecessarily. This affects every keystroke, state update, or re-render in the app.

**Fix:**
```typescript
// In useProject.ts, memoize currentProject:
const currentProject = useMemo(
  () => selectedId ? projects.find((p) => p.id === selectedId) ?? null : null,
  [selectedId, projects]
);
```

## Info

### IN-01: Unused `commands` dependency in tray menu update effect

**File:** `src/hooks/useTray.ts:201`
**Issue:** The `commands` prop is included in Effect 2's dependency array but is never read inside `buildMenu()` or the effect body. This causes unnecessary effect re-triggering when commands change. Combined with WR-03, this further increases unnecessary menu rebuilds.

**Fix:** Remove `commands` from the dependency array: `}, [enabled, currentProject, recentCommands, visibility]);`

### IN-02: Redundant null check for store values

**File:** `src/App.tsx:145-146`
**Issue:** `saved !== undefined && saved !== null` is redundant -- checking both is equivalent to `saved != null` (loose equality covers both `null` and `undefined`). The double check is verbose but not harmful.

**Fix:**
```typescript
if (saved != null) setTrayEnabled(saved);
if (savedCTT != null) setCloseToTray(savedCTT);
```

### IN-03: Test uses type assertion to bypass type checking

**File:** `src/hooks/__tests__/useVisibilityState.test.ts:63`
**Issue:** Line 63 uses `state as "TRAY_HIDDEN"` to cast a `string` variable to the `VisibilityState` type. This test appears to be verifying that `setVisibility` accepts string-typed values (the comment says "Phase 14 extension interface"), but it uses a type assertion that defeats the purpose of the test. If the goal is to test runtime string acceptance, the assertion masks what would otherwise be a type error.

**Fix:** If the intent is to test that `setVisibility` accepts dynamic strings at runtime (a future requirement), consider testing with the actual type rather than a cast, or add a comment explaining this is intentionally testing runtime flexibility at the cost of compile-time safety.

---

_Reviewed: 2026-04-28T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
