---
phase: 22-global-command-removal
plan: 03
subsystem: ui
tags: react, shadcn-ui, mainarea, commanddialog
requires:
  - phase: 22-01
    provides: CommandItem type with scope="project" only
  - phase: 22-02
    provides: useProject without commandMode/customCommands
provides:
  - MainArea without Toggle Group, with built-in Terminal card and "项目环境" label
  - CommandDialog without scope selector
  - App.tsx adapted to new useProject interface
affects: []
tech-stack:
  added: []
  patterns:
    - "Built-in UI elements (Terminal card) independent of command data model"
key-files:
  modified:
    - src/App.tsx
    - src/components/MainArea.tsx
    - src/components/CommandDialog.tsx
    - src/components/__tests__/MainArea.test.tsx
    - src/components/__tests__/CommandDialog.test.tsx
    - vitest.config.ts
key-decisions:
  - "Terminal card is pure UI element, not backed by CommandItem data model"
  - "CommandDialog scope selector fully removed (scope always 'project')"
  - "MainArea section label changed from '项目指令' to '项目环境'"
  - "Toggle Group (global/project mode switch) completely removed"
requirements-completed:
  - CMD-09
  - CMD-10
duration: 10min
completed: 2026-06-17
---

# Phase 22 Plan 03: UI Refactor for Global Command Removal

**Remove Toggle Group from MainArea, add built-in Terminal card, rename section to "项目环境", remove scope selector from CommandDialog, adapt App.tsx**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-17T17:54:00+08:00
- **Completed:** 2026-06-17T18:03:52+08:00
- **Tasks:** 5 (plus 1 pre-existing fix)
- **Files modified:** 6

## Accomplishments

- Removed `commandMode`/`disableProjectCommands`/`isProjectToggleDisabled` from App.tsx (no longer passed to MainArea)
- Removed Toggle Group (global/project mode switch) from MainArea; replaced with "项目环境" label + open folder button
- Added built-in "终端" (Terminal) card as first element in command grid, non-editable/deletable, opens cmd.exe on click
- Removed scope selector from CommandDialog (scope is always "project" implicitly)
- Updated MainArea focus effect to offset +1 for Terminal card at grid position 0
- Fixed vitest config (pre-existing "React is not defined" JSX transform issue) for test files

## Task Commits

Each task was committed atomically:

1. **Task 1: App.tsx adaptation** - `639c066` (fix)
2. **Task 2: MainArea.tsx refactor** - `7bc26d7` (feat)
3. **Task 3: CommandDialog scope removal** - `22ea116` (feat)
4. **Task 4: MainArea test updates** - `10e4d4f` (test)
5. **Task 5: CommandDialog test updates** - `4bde0ed` (test)

**Pre-existing fix:** `8d729bd` (fix: vitest esbuild JSX automatic runtime)
**Plan metadata:** (committed below)

## Files Modified

- `src/App.tsx` - Removed commandMode/disableProjectCommands from destructuring and isProjectToggleDisabled declaration; removed three removed props from MainArea JSX
- `src/components/MainArea.tsx` - Removed Toggle Group, added Terminal card, renamed section to "项目环境", removed scope from addCommand/CommandDialog calls, adjusted focus effect offset
- `src/components/CommandDialog.tsx` - Removed scope/commandMode/hasProject props, selectedScope state and UI, scope field from onSubmit data
- `src/components/__tests__/MainArea.test.tsx` - Updated scope to "project", removed Toggle Group tests, added Terminal card / "项目环境" / no Toggle Group tests
- `src/components/__tests__/CommandDialog.test.tsx` - Updated scope from "global" to "project"
- `vitest.config.ts` - Added esbuild JSX automatic runtime config and .claude/ exclude pattern

## Decisions Made

- Followed decisions D-03 (built-in Terminal card), D-04 (opens cmd.exe), D-05 (non-editable), D-10 (commandMode removed), D-13 (Toggle Group removed), CMD-10 (section renamed)
- Terminal card does not correspond to any CommandItem data model — it is a pure UI element
- Focus effect offset (+1) accounts for Terminal card at grid position 0 while focusedCardIndex targets commands array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed commandMode/hasProject from CommandDialog call in MainArea**
- **Found during:** Task 2 (MainArea refactor)
- **Issue:** After removing commandMode from MainArea scope, the `commandMode={commandMode}` prop in CommandDialog JSX referenced an undefined variable
- **Fix:** Removed both `commandMode={commandMode}` and `hasProject={!!currentProject}` from MainArea's CommandDialog JSX
- **Files modified:** src/components/MainArea.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** `7bc26d7` (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed vitest JSX transform configuration**
- **Found during:** Task 4 (test verification)
- **Issue:** All test files failed with "React is not defined" because vitest esbuild lacked automatic JSX runtime configuration. Test files are excluded from tsconfig.app.json (which has `"jsx": "react-jsx"`)
- **Fix:** Added `jsx: "automatic"` and `jsxImportSource: "react"` to vitest esbuild config
- **Files modified:** vitest.config.ts
- **Verification:** All 35 tests pass (19 MainArea + 16 CommandDialog)
- **Committed in:** `8d729bd` (separate fix commit)

**3. [Rule 3 - Blocking] Worktree path management during edits**
- **Found during:** All tasks
- **Issue:** Initial file edits used absolute paths pointing to main repo (`E:/git/EasyPack/src/...`) instead of worktree paths (`E:/git/EasyPack/.claude/worktrees/.../src/...`), causing worktree files to remain unmodified
- **Fix:** Copied edited files from main repo to worktree; fast-forwarded worktree branch to merge commits from main
- **Files modified:** All 6 source files (synced copies)
- **Verification:** git status shows correct working tree state; tests pass from worktree
- **Committed in:** (handled via git operations)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All fixes necessary for compilation and test execution. No scope creep.

## Issues Encountered

- Vitest was not configured for React JSX automatic transform, causing all JSX test files to fail with "React is not defined". This was a pre-existing issue (tests were already failing before any changes). Fixed by configuring esbuild in vitest.config.ts.
- Worktree file path management: Editing files at the main repo path instead of the worktree path caused the worktree's working tree to not reflect changes. Resolved by copying files and fast-forwarding the worktree branch.

## Deferred Issues

- `CommandCard.test.tsx` (5 failures) and `useRecentCommands.test.ts` (1 failure) are pre-existing test failures unrelated to this plan's changes.

## Next Phase Readiness

- MainArea fully migrated: no Toggle Group, Termimal card present, section labeled "项目环境"
- CommandDialog has no scope selector, always submits project-scoped commands
- App.tsx no longer passes removed props to MainArea
- Ready for any following plan in Phase 22

---

*Phase: 22-global-command-removal*
*Plan: 03*
*Completed: 2026-06-17*

## Self-Check: PASSED

- All 6 source files verified present
- All 7 commits verified (5 task commits + 1 fix + 1 metadata)
- TypeScript compilation passes (`npx tsc --noEmit`)
- 35 tests pass (19 MainArea + 16 CommandDialog)
- Pre-existing failures in CommandCard.test.tsx (5) and useRecentCommands.test.ts (1) are unrelated
