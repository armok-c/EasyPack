---
phase: 17-多行脚本指令 + 16-版本管理
reviewed: 2026-05-15T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src-tauri/src/commands/shell.rs
  - src-tauri/src/commands/update.rs
  - src/components/MainArea.tsx
  - src/components/ScriptEditor.tsx
  - src/components/SettingsDialog.tsx
  - src/hooks/useUpdateCheck.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 17 + 16: Code Review Report

**Reviewed:** 2026-05-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed 6 files spanning Phase 17 fixes (multi-line script execution) and Phase 16 (version management). Found one critical type-safety issue that prevents clean compilation, plus several warnings related to broken guard logic and missing validation.

## Critical Issues

### CR-01: `addCommand` prop type missing 5th parameter -- TypeScript compilation error

**File:** `src/components/MainArea.tsx:19`
**Issue:** The `addCommand` prop is typed as `(name: string, command: string, icon?: string, scope?: "global" | "project") => Promise<void>` but the call site at line 125 passes 5 arguments: `addCommand(data.name, data.command, data.icon, data.scope, { scriptLines, executionMode })`. The 5th argument `extra?: { scriptLines?; executionMode? }` is missing from the type declaration. Running `tsc -p tsconfig.app.json --noEmit` produces `TS2554: Expected 2-4 arguments, but got 5`. This means the Phase 17 WR-01 fix (passing `{ scriptLines, executionMode }` as extra param) is structurally correct in logic but the interface type was not updated to match.
**Fix:**
```typescript
// MainArea.tsx line 19, update the addCommand type:
addCommand: (
  name: string,
  command: string,
  icon?: string,
  scope?: "global" | "project",
  extra?: { scriptLines?: string; executionMode?: "strict" | "lenient" | "batch" }
) => Promise<void>;
```

## Warnings

### WR-01: ScriptEditor sync guard uses wrong ref -- `isExternalUpdate` never read by `updateListener`

**File:** `src/components/ScriptEditor.tsx:109,118-126`
**Issue:** The component-level `isExternalUpdate` ref (line 109) is set to `true` before dispatching external value sync (line 118) and reset to `false` after (line 126). However, the `updateListener` inside `useCodeMirror` (line 62) checks `isSyncUpdate.current` -- a completely separate ref that is never set to `true`. The Phase 17 IN-05 fix renamed the ref inside `useCodeMirror` from `isExternalUpdate` to `isSyncUpdate` but did NOT update the component-level code at lines 109/118/126 to reference the hook's ref. The result: every external value sync triggers a spurious `onChange` callback. This does not cause an infinite loop (the sync useEffect guards on `currentContent !== value`), but it does cause a redundant React state update on every sync.
**Fix:** Expose `isSyncUpdate` from the `useCodeMirror` hook, or move the sync guard logic into the hook itself:
```typescript
// Option A: Return isSyncUpdate from the hook
function useCodeMirror(...) {
  const isSyncUpdate = useRef(false);
  // ...
  return { viewRef, isSyncUpdate };
}

// In ScriptEditor:
const { viewRef, isSyncUpdate } = useCodeMirror(parentRef, value, onChange, darkMode);
// Use isSyncUpdate instead of isExternalUpdate in the sync useEffect
```

### WR-02: `open_folder` has no path validation -- command injection via malformed path

**File:** `src-tauri/src/commands/shell.rs:39-44`
**Issue:** `open_folder` passes user-provided `path` directly to `explorer.exe` via `raw_arg(format!("\"{}\"", path))` with no validation. Unlike `execute_command` and `execute_script` which validate `project_path.contains('"')`, `open_folder` allows any string including quotes. A path containing `"` would break out of the quoting: `explorer.exe "\"C:\Users" && malicious_command` would execute the injected command. While this is a desktop tool where users control their own paths, this is inconsistent with the validation applied to `execute_command` and `execute_script`.
**Fix:**
```rust
pub async fn open_folder(path: String) -> Result<(), String> {
    if path.contains('"') {
        return Err("Invalid path: contains double quote".to_string());
    }
    StdCommand::new("explorer.exe")
        .raw_arg(format!("\"{}\"", path))
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(())
}
```

### WR-03: `checkNow()` in `useUpdateCheck` has no mounted guard -- state update after unmount

**File:** `src/hooks/useUpdateCheck.ts:38-50`
**Issue:** The `checkNow` function calls `setCurrentVersion`, `setUpdateAvailable`, and `setLatestVersion` after `await` without checking if the component is still mounted. The auto-check `useEffect` correctly uses a `mounted` flag (lines 17, 22, 26), but `checkNow` does not. If the component unmounts during the network call (e.g., user navigates away), React will log a "Can't perform a React state update on an unmounted component" warning. In the current architecture, `SettingsDialog` stays mounted via Radix Portal so this is low-risk in practice, but it violates the pattern established in the same hook and could cause issues if the architecture changes.
**Fix:**
```typescript
export function useUpdateCheck(storeReady: boolean) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ... in checkNow:
  async function checkNow(): Promise<boolean> {
    try {
      const version = await getVersion();
      if (!mountedRef.current) return false;
      setCurrentVersion(version);
      const result = await invoke<UpdateCheckResult>("check_for_updates", { force: true });
      if (!mountedRef.current) return false;
      setUpdateAvailable(result.has_update);
      setLatestVersion(result.latest_version);
      return true;
    } catch {
      return false;
    }
  }
```

## Info

### IN-01: Unused `useCallback` import in ScriptEditor

**File:** `src/components/ScriptEditor.tsx:15`
**Issue:** `useCallback` is imported but never used in the component or the hook. TypeScript reports `TS6133: 'useCallback' is declared but its value is never read`.
**Fix:** Remove `useCallback` from the import:
```typescript
import { useRef, useEffect } from "react";
```

### IN-02: `checkLabel` state not reset on successful check

**File:** `src/components/SettingsDialog.tsx:50-65`
**Issue:** When the check succeeds (`ok === true`), `checkLabel` remains "检查更新" (its default), which is fine. But if a previous check failed and set it to "检查失败" with a 2-second timeout reset, and the user clicks again before the timeout fires, the label shows "检查失败" during the new check. The `checking` state disables the button, so this is a visual-only issue.
**Fix:** Reset label at the start of `handleCheckNow`:
```typescript
async function handleCheckNow() {
  if (checking) return;
  setCheckLabel("检查更新");  // Reset to default before starting
  setChecking(true);
  // ...
}
```

---

_Reviewed: 2026-05-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
