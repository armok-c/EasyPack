---
phase: 24-file-management-editor
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - package.json
  - src/App.tsx
  - src/components/AddFileDialog.tsx
  - src/components/FileEditorDialog.tsx
  - src/components/FileList.tsx
  - src/components/MainArea.tsx
  - src/components/ScriptEditor.tsx
  - src/hooks/useCodeMirror.ts
  - src/hooks/useProject.ts
  - src/lib/file-lang.ts
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed 10 files related to Phase 24 (File Management & Editor) and surrounding infrastructure. Found 3 critical security/correctness bugs, 4 warnings, and 3 info items. Key issues include an unvalidated path traversal in AddFileDialog, destructive rollback in applyEnv, and CodeMirror extensions not updating when switching files with the same extension count.

## Critical Issues

### CR-01: Path traversal in manual file input allows reading files outside project directory

**File:** `src/components/AddFileDialog.tsx:98-108,164`

**Issue:** The `handleManualAdd` function constructs a file path from user input and sends it to the Rust backend via `invoke("read_file_content")`. The `toRelativePath` function only checks string prefix matching and does not sanitize path traversal sequences (`../`). An attacker (or malicious file name) can read any file on the system.

The construction at line 164:
```tsx
const fullPath = `${projectPath.replace(/\\/g, "/")}/${trimmed}`;
```

If `trimmed` is `../../Windows/win.ini`, the resulting `fullPath` still starts with the `projectPath` prefix at the string level, so `toRelativePath` returns `../../Windows/win.ini` as the relative name. This is passed directly to the Rust `read_file_content` command.

**Fix:** Validate that the resolved path stays within the project directory before accepting it. Add path traversal sanitization in `toRelativePath`:

```tsx
function toRelativePath(absolutePath: string, projectPath: string): string {
  const normalizedAbs = absolutePath.replace(/\\/g, "/");
  const normalizedProj = projectPath.replace(/\\/g, "/");
  const prefix = normalizedProj.endsWith("/") ? normalizedProj : `${normalizedProj}/`;

  // Resolve path to detect traversal
  const resolved = new URL(prefix).pathname; // not available in all runtimes
  // Alternative: check that the normalized absolute path, when resolved,
  // actually starts with the project path

  if (normalizedAbs.startsWith(prefix)) {
    const relative = normalizedAbs.substring(prefix.length);
    // Ensure no path traversal components remain
    if (relative.includes("..") || relative.startsWith("/")) {
      throw new Error("文件路径超出项目目录范围");
    }
    return relative;
  }
  return normalizedAbs;
}
```

Additionally, validate on the Rust backend side with `std::fs::canonicalize` and verify the resolved path starts with the project directory.

---

### CR-02: Destructive rollback in applyEnv writes empty content to files on failure

**File:** `src/hooks/useProject.ts:766-775`

**Issue:** When `applyEnv` fails partway through writing files, the rollback mechanism writes empty string (`content: ""`) to files that were already written:

```tsx
await invoke("write_file_content", {
  projectPath,
  fileName: writtenName,
  content: "",               // <-- DESTRUCTIVE: empties the file
});
```

This destroys the file content rather than restoring it. If a multi-file environment write fails (e.g., network issue, disk full), already-written files are zeroed out instead of being restored to their original content.

**Fix:** Read and cache the original content of each file BEFORE writing, then restore original content on rollback:

```tsx
const originalContents: Map<string, string> = new Map();

for (const file of env.files) {
  try {
    // Read original content before overwriting
    try {
      const original = await invoke<string>("read_file_content", {
        projectPath,
        fileName: file.name,
      });
      originalContents.set(file.name, original);
    } catch {
      // File might not exist yet; that's fine
    }

    await invoke("write_file_content", {
      projectPath,
      fileName: file.name,
      content: file.content,
    });
    writtenFiles.push(file.name);
  } catch (error) {
    // Rollback: restore original content
    for (const writtenName of writtenFiles) {
      try {
        const original = originalContents.get(writtenName) ?? "";
        await invoke("write_file_content", {
          projectPath,
          fileName: writtenName,
          content: original,
        });
      } catch {
        // Log rollback failure but continue
      }
    }
    toast.error(...);
    return false;
  }
}
```

---

### CR-03: CodeMirror extensions not updating when switching files with same extension count

**File:** `src/components/FileEditorDialog.tsx:200`, `src/hooks/useCodeMirror.ts:89-90`

**Issue:** When the user switches between file types that have the same `extensions.length` (e.g., `.json` and `.yaml` both return 2 extensions: language + lint), the editor view is not recreated with the new extensions. The `editorKey` on the container div is computed as:

```tsx
const editorKey = file ? `${file.name}-${extensions.length}` : "no-file";
```

Since `.json` and `.yaml` both have `extensions.length === 2`, the key does not change when switching between them. React does not remount the div, so `useCodeMirror`'s first `useEffect` (which creates the `EditorView`) does not re-run because its dependency array `[darkMode, height]` has not changed. The editor retains the previous file's language and lint extensions.

**Reproduction:** Open a `.json` file, then open a `.yaml` file — YAML content is displayed with JSON syntax highlighting and JSON linter rules.

**Fix option A (simplest):** Use only the file name as the key, which is always unique:

```tsx
const editorKey = file?.name ?? "no-file";
```

**Fix option B (correct):** Add `extensions` to the dependency array of useCodeMirror's view-creation effect:

```tsx
useEffect(() => {
  // ... create view with extensions ...
  return () => { view.destroy(); viewRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [darkMode, height, ...extensions]);  // spread to capture changes
```

However, option B requires the extensions array to be referentially stable between identical configurations to avoid unnecessary recreation.

---

## Warnings

### WR-01: App-level phase-24 handlers ignore projectId parameter, always use selectedId

**File:** `src/App.tsx:139-156`

**Issue:** The three phase-24 handler callbacks (`handleAddFiles`, `handleDeleteFiles`, `handleUpdateFile`) all accept a `projectId` parameter in their signature but ignore it, using `selectedId` from closure instead:

```tsx
const handleAddFiles = useCallback(
  async (projectId: string, envId: string, files: ManagedFile[]) => {
    if (selectedId) await addFiles(selectedId, envId, files);  // selectedId, not projectId
  },
  [selectedId, addFiles]
);
```

While in the current code flow `selectedId` always matches `currentProject.id` (which is what MainArea passes as `projectId`), this is a fragile contract. If code is refactored and someone passes a different `projectId`, the operation silently targets the wrong project.

**Fix:** Either use the passed `projectId` parameter:
```tsx
const handleAddFiles = useCallback(
  async (projectId: string, envId: string, files: ManagedFile[]) => {
    if (projectId) await addFiles(projectId, envId, files);
  },
  [addFiles]
);
```
Or remove the unused `projectId` parameter from all three handler signatures.

---

### WR-02: Broken isSyncUpdate guard between ScriptEditor and useCodeMirror

**File:** `src/components/ScriptEditor.tsx:39,45,54,62`, `src/hooks/useCodeMirror.ts:45,68,99,107`

**Issue:** Both `ScriptEditor` and `useCodeMirror` declare separate `isSyncUpdate` refs. `useCodeMirror`'s update listener checks its OWN ref to suppress `onChange` during external value sync. But `ScriptEditor`'s sync `useEffect` sets `ScriptEditor`'s own `isSyncUpdate` ref before dispatching — not `useCodeMirror`'s. This means the guard never triggers during ScriptEditor-initiated syncs:

In `useCodeMirror.ts`:
```tsx
const isSyncUpdate = useRef(false);  // useCodeMirror's ref
// ...
EditorView.updateListener.of((update) => {
  if (update.docChanged && !isSyncUpdate.current) {  // checks useCodeMirror's ref
    onChange(update.state.doc.toString());
  }
}),
```

In `ScriptEditor.tsx`:
```tsx
const isSyncUpdate = useRef(false);  // ScriptEditor's own ref — DIFFERENT!
// ...
isSyncUpdate.current = true;      // sets ScriptEditor's ref
view.dispatch({changes: {...}});
isSyncUpdate.current = false;     // sets ScriptEditor's ref
```

Additionally, `useCodeMirror` already has its own external value sync `useEffect` (line 93-109), making ScriptEditor's sync `useEffect` at line 48-64 entirely duplicative. The duplicate can cause brief onChange re-entrancy (though it converges because the value matches immediately).

**Fix:** Remove the duplicate sync `useEffect` from `ScriptEditor.tsx` entirely — `useCodeMirror` already handles external value synchronization. The entire effect at lines 48-64 can be deleted, and `isSyncUpdate` ref is no longer needed there.

---

### WR-03: Duplicate lineNumbers() extension in useCodeMirror

**File:** `src/hooks/useCodeMirror.ts:66`

**Issue:** `basicSetup` (imported from `codemirror` package at line 16) already includes `lineNumbers()` as part of its default configuration. Adding `lineNumbers()` as a separate extension at line 66 is redundant:

```tsx
extensions: [
  basicSetup,       // Already includes lineNumbers
  lineNumbers(),    // DUPLICATE
  EditorView.updateListener.of(...),
  theme,
  darkMode ? oneDark : [],
  ...extensions,
],
```

While CodeMirror deduplicates via Facet identity, this is misleading and suggests a misunderstanding of what `basicSetup` provides.

**Fix:** Remove the redundant `lineNumbers()` call.

---

### WR-04: Case-sensitive file name sorting on case-insensitive filesystem

**File:** `src/components/FileList.tsx:78`

**Issue:** File names are sorted with default `localeCompare` which is case-sensitive. On Windows (where the filesystem is case-insensitive), this produces unexpected ordering — e.g., `Config.json` sorts before `app.json` in some locales.

```tsx
() => [...files].sort((a, b) => a.name.localeCompare(b.name))
```

**Fix:** Use case-insensitive comparison:
```tsx
() => [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
```

---

## Info

### IN-01: formatRelativeTime shows "刚刚" for future timestamps

**File:** `src/lib/file-lang.ts:211-221`

**Issue:** If a timestamp is in the future (e.g., from a clock skew or corrupt data), `Date.now() - timestamp` is negative. All thresholds (`days > 0`, `hours > 0`, `minutes > 0`) evaluate to false, so the function returns "刚刚", which is misleading for a future timestamp.

```tsx
const diff = now - timestamp;  // negative for future timestamps
```

**Suggestion:** Add a guard for negative diffs:
```tsx
const diff = now - timestamp;
if (diff < 0) return "未来时间";
```

---

### IN-02: The `toRelativePath` fallback stores absolute paths as "relative" names

**File:** `src/components/AddFileDialog.tsx:105-107`

**Issue:** When the selected file's absolute path does not start with the project path prefix (e.g., if the user selects a file outside the project via the system dialog), `toRelativePath` returns the absolute path as-is:

```tsx
return normalizedAbs;
```

This absolute path is stored as a "relative" name in the `ManagedFile` object. When the Rust backend later resolves this path, the behavior is undefined — it could fail or write to an unexpected location depending on how the backend concatenates `projectPath + fileName`.

**Suggestion:** Either throw an error instead of falling through, or reject files outside the project directory with a user-facing message.

---

### IN-03: useCodeMirror's second useEffect omits `viewRef` from dependency array

**File:** `src/hooks/useCodeMirror.ts:109`

**Issue:** The external value sync effect only includes `[value]` in its dependency array but accesses `viewRef.current`. Since `viewRef` is a ref, it doesn't trigger re-execution when populated. This works in practice because effects run in declaration order (view creation runs first), but the missing dependency is misleading and could be flagged by lint rules.

```tsx
useEffect(() => {
  const view = viewRef.current;
  if (!view) return;
  // ... sync logic ...
}, [value]);  // viewRef intentionally omitted but worth documenting why
```

**Suggestion:** Add an inline comment explaining why `viewRef` is intentionally excluded from the dependency array (it's a stable ref that is always populated before this effect's first meaningful run).

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
