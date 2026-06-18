---
phase: 25-sync-diff-comparison
plan: 03
subsystem: diff-view
tags: [diff, refactor, hook, test]
dependency_graph:
  requires:
    - 25-01-sync-diff-comparison (DiffViewDialog, diff-utils)
    - 25-02-sync-diff-comparison (SyncDiffButton, EnvSelectDialog)
  provides:
    - getDiffLanguage
    - useDiffState
  affects:
    - src/components/DiffViewDialog.tsx
tech-stack:
  added:
    - "src/lib/diff-lang.ts: File extension to @git-diff-view/react language mapping"
    - "src/hooks/useDiffState.ts: Immutable diff resolution + undo state management hook"
  patterns:
    - "useDiffState: Immutable Set/object updates with useState + useCallback"
    - "MissingFilePlaceholder: Extracted presentational component with callbacks"
    - "DiffStatusBar: Extracted presentational component with computed props"
key-files:
  created:
    - src/lib/diff-lang.ts
    - src/hooks/useDiffState.ts
    - src/lib/__tests__/diff-lang.test.ts
    - src/hooks/__tests__/useDiffState.test.ts
    - src/components/MissingFilePlaceholder.tsx
    - src/components/DiffStatusBar.tsx
  modified:
    - src/components/DiffViewDialog.tsx
decisions:
  - "getDiffLanguage returns undefined for unknown extensions (not 'text'), letting @git-diff-view/react use no highlighting"
  - "useDiffState tracks resolved hunks as Record<string, Set<number>> for O(1) lookup per fileEnvKey"
metrics:
  duration: ~15 min
  completed: "2026-06-18"
---

# Phase 25 Plan 03: Diff View Gap Fill and Refactor - Summary

Extracted `useDiffState` hook and two presentational components (`MissingFilePlaceholder`, `DiffStatusBar`) from the 811-line `DiffViewDialog.tsx`, created `getDiffLanguage` mapping utility with typed `undefined` return, and added 36 tests.

## Key Results

### getDiffLanguage (`src/lib/diff-lang.ts`)
- 11 extension mappings: .json, .yaml/.yml, .toml, .xml, .conf/.ini/.cfg, .env (plaintext), .txt (plaintext), .md (markdown)
- Returns `undefined` for unknown extensions (differs from `getFileLanguage` which returns "text")
- Case-insensitive extension lookup

### useDiffState (`src/hooks/useDiffState.ts`)
- 12-method API: `markResolved`, `markUnresolved`, `isHunkResolved`, `pushUndo`, `popUndo`, `clearUndo`, `hasUnresolved`, `getResolvedCount`, `getUnresolvedCount`, `isAllResolved`, `undoKey`, plus `resolvedHunks` and `undoStack` state values
- Per-file/env isolation via `fileEnvKey` (format: `"${fileName}::${envId}"`)
- Immutable Set/object updates (no mutation)

### MissingFilePlaceholder (`src/components/MissingFilePlaceholder.tsx`)
- Props: `isMissing`, `wasCreated`, `isCreating`, `onCreate`, `onUndoCreate`
- Renders FileX + explanation + create/undo buttons; returns null when `isMissing=false`

### DiffStatusBar (`src/components/DiffStatusBar.tsx`)
- Props: `totalHunks`, `resolvedCount`, `unresolvedCount`, `isFileMissing`, `isIdentical`
- Computes `allResolved` internally; shows "全部已解决" badge on the right

### DiffViewDialog Refactor
- Replaced inline `resolvedMap`/`setResolvedMap` state with `useDiffState` hook
- Replaced `getFileLanguage` import with `getDiffLanguage` (with `?? "text"` fallback)
- Used `MissingFilePlaceholder` and `DiffStatusBar` components
- Removed 108 lines, added 39 — net -69 lines, same functionality
- Zero functional changes: all D-01 through D-39 design decisions preserved

## Verification

- `npx tsc --noEmit` passes
- All 36 new tests pass (15 diff-lang + 21 useDiffState)
- Pre-existing 3 test failures in CommandCard/useRecentCommands unchanged (known)
- Full suite: 163 passed, 6 failed (3 pre-existing), same as baseline

## Tests

| File | Tests | Status |
|------|-------|--------|
| `src/lib/__tests__/diff-lang.test.ts` | 15 | All passing |
| `src/hooks/__tests__/useDiffState.test.ts` | 21 | All passing |

## Commits

| Hash | Message |
|------|---------|
| `2386e1b` | feat(25-sync-diff-comparison): create diff-lang.ts with getDiffLanguage mapping |
| `95107c5` | feat(25-sync-diff-comparison): create useDiffState hook for diff resolution tracking |
| `19b724b` | test(25-sync-diff-comparison): add tests for getDiffLanguage and useDiffState |
| `888c9dc` | refactor(25-sync-diff-comparison): extract MissingFilePlaceholder from DiffViewDialog |
| `6d4caa5` | refactor(25-sync-diff-comparison): extract DiffStatusBar from DiffViewDialog |
| `4ecf464` | refactor(25-sync-diff-comparison): refactor DiffViewDialog to use useDiffState and extracted components |

## Deviations from Plan

None — plan executed exactly as specified.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- [x] All 6 created files exist
- [x] Modified file exists (DiffViewDialog.tsx)
- [x] All 6 commit hashes verified in git log
