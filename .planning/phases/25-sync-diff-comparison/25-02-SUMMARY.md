---
phase: 25-sync-diff-comparison
plan: 02
subsystem: ui
tags: [shadcn, radix-ui, react, dialog, checkbox]
requires:
  - phase: 24-file-management-editor
    provides: FileList component with toolbar and file CRUD
provides:
  - SyncDiffButton presentational component for FileList toolbar
  - EnvSelectDialog multi-select environment picker with match/missing file counting
  - FileList onSyncDiff callback prop for downstream integration
affects:
  - Phase 25-03: will consume onSyncDiff output and open DiffViewDialog

tech-stack:
  added:
    - "@radix-ui/react-checkbox (checkbox primitive)"
    - "shadcn/ui Checkbox component (created from primitive)"
  patterns:
    - "Stateless presentational components (SyncDiffButton) with memo optimization"
    - "Multi-select dialog with select-all, indeterminate state, and per-row file counts"
    - "Hook-based immutable state updates for selection arrays"

key-files:
  created:
    - src/components/SyncDiffButton.tsx
    - src/components/EnvSelectDialog.tsx
    - src/components/ui/checkbox.tsx
  modified:
    - src/components/FileList.tsx

key-decisions:
  - "SyncDiffButton uses React.memo for render optimization (pure presentational component)"
  - "EnvSelectDialog used Checkbox prop `checked={someSelected ? 'indeterminate' : allSelected}` pattern for select-all indeterminate support"
  - "Toolbar layout uses `ml-auto` on add/delete div rather than `justify-between` to keep pipe separators flush with items"

patterns-established:
  - "Multi-select dialog: filtered list + select-all header + count metadata per row + confirm/cancel footer"
  - "Dialog reset pattern: useEffect on open triggers state reset per D-08"

requirements-completed: [ENV-05]
---

# Phase 25 Plan 02: Sync Diff Button and Environment Select Dialog

**SyncDiffButton component for FileList toolbar, EnvSelectDialog multi-select environment picker, and added onSyncDiff prop to FileList**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-18T09:17:26Z
- **Completed:** 2026-06-18T09:28:45Z
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- Created SyncDiffButton component with disabled/enabled states, GitCompare icon, and "同步差异" label, wrapped with React.memo for performance
- Created EnvSelectDialog implementing all locked decisions (D-01 through D-08, D-36): multi-select list with select-all (indeterminate support), match/missing file counts per environment, FileX icon for missing files, alphabetical sorting, reset-on-open behavior
- Modified FileList toolbar to insert SyncDiffButton between file count and add button with pipe separators (D-09 layout), added `onSyncDiff` optional callback prop

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SyncDiffButton component** - `47c5f88` (feat)
2. **Task 2: Create EnvSelectDialog** - `bc36e2f` (feat)
3. **Task 3: Modify FileList toolbar integration** - `38331bf` (feat)

## Files Created/Modified

- `src/components/SyncDiffButton.tsx` - Presentational button component with disabled/enabled states, GitCompare icon
- `src/components/EnvSelectDialog.tsx` - Multi-select environment picker dialog with all D-01~D-08 and D-36 behavior
- `src/components/ui/checkbox.tsx` - shadcn/ui Checkbox component (required dependency for EnvSelectDialog)
- `src/components/FileList.tsx` - Added onSyncDiff prop, SyncDiffButton import/usage in toolbar with pipe separators

## Decisions Made

- Used `checked={someSelected ? "indeterminate" : allSelected}` pattern for Radix Checkbox indeterminate support (standard Radix pattern)
- Used `ml-auto` on existing add/delete button div to maintain right-alignment while allowing pipe separators between toolbar items
- Created shadcn/ui Checkbox component manually (following component.json alias) since it was not previously installed - required as dependency for EnvSelectDialog

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing shadcn/ui Checkbox component**
- **Found during:** Task 2 (EnvSelectDialog implementation)
- **Issue:** Plan specified using shadcn Checkbox (`@/components/ui/checkbox`) but component was not installed in the project
- **Fix:** Installed `@radix-ui/react-checkbox` via npm, manually created `src/components/ui/checkbox.tsx` following shadcn new-york pattern
- **Files created:** src/components/ui/checkbox.tsx
- **Verification:** Import resolves, TypeScript compilation passes with no errors
- **Committed in:** bc36e2f (Task 2 commit)

---

**Total deviations:** 1 blocking auto-fix
**Impact on plan:** Essential prerequisite - EnvSelectDialog required Checkbox component. No scope creep.

## Issues Encountered

None - all tasks executed as specified in the plan.

## Stub Check

No stubs identified:
- SyncDiffButton is a stateless presentational component with fully specified props
- EnvSelectDialog is self-contained with all behavior implemented (D-01 through D-08, D-36)
- FileList onSyncDiff prop is properly typed and wired to SyncDiffButton onClick
- Data connection (EnvSelectDialog triggering from SyncDiffButton click) is deferred to Plan 03 (MainArea integration) as specified

## Threat Surface Scan

No new threat flags introduced. Both new components (SyncDiffButton, EnvSelectDialog) are pure UI with no network access, file system access, or user-writable data paths. Environment names (`Environment.name`) are user-created and displayed as-is per design.

## Next Phase Readiness

- SyncDiffButton and EnvSelectDialog components ready for Plan 03 integration
- FileList now exports `onSyncDiff` callback prop for MainArea to wire
- Plan 03 will: connect SyncDiffButton onClick to EnvSelectDialog, create DiffViewDialog and @git-diff-view/react integration, add MissingFilePlaceholder, DiffStatusBar, and hunk operations with undo support
- TypeScript compilation passes with zero errors across all modified files

---
*Phase: 25-sync-diff-comparison*
*Completed: 2026-06-18*
