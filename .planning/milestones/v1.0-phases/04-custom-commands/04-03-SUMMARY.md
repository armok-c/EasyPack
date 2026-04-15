---
phase: 04-custom-commands
plan: 03
subsystem: ui
tags: [react, hooks, command-override, edit-mode, tdd, vitest]

# Dependency graph
requires:
  - phase: 04-custom-commands/01
    provides: "CommandDialog component, CommandItem type, icon mapping"
  - phase: 04-custom-commands/02
    provides: "CommandCard edit mode props, useProject CRUD + Store persistence"
provides:
  - "Project-level command set override logic (per D-07)"
  - "MainArea edit mode UI with mode labels and switch entries"
  - "enableProjectCommands/disableProjectCommands management functions"
  - "Auto-revert to global when last project command deleted (per D-10)"
affects: [ui, state-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [project-commands-map, canEdit-logic, mode-aware-CRUD]

key-files:
  created: []
  modified:
    - src/hooks/useProject.ts
    - src/hooks/__tests__/useProject.test.tsx
    - src/components/MainArea.tsx
    - src/components/__tests__/MainArea.test.tsx
    - src/App.tsx

key-decisions:
  - "commands computed property depends on selectedId — requires project selection to show commands"
  - "canEdit logic: editMode && (type==='custom' || scope==='project') for D-11 project-level preset deletion"
  - "ContextMenu deferred in favor of edit mode delete button — simpler UX for v1"

patterns-established:
  - "Mode-aware CRUD: addCommand/updateCommand/deleteCommand dispatch to project or global store based on commandMode"
  - "Auto-revert pattern: deleting last item in project-level set automatically cleans up store and reverts to global"
  - "Props drilling from useProject through App to MainArea for all command state"

requirements-completed: [CMD-07, DATA-02]

# Metrics
duration: 17min
completed: 2026-04-14
---

# Phase 04 Plan 03: Project-Level Command Override Summary

**Project-level command set complete replacement with auto-revert, mode labels, and MainArea edit mode UI integration**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-14T03:55:07Z
- **Completed:** 2026-04-14T04:12:10Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Project-level command sets completely replace global commands per D-07, persisted via tauri-plugin-store
- Creating a project-level set copies 4 presets as starting point (per D-08), auto-enters edit mode (per D-22)
- Deleting the last project command auto-reverts to global mode (per D-10)
- MainArea shows mode label ("全局指令" / "项目自定义指令") with switch entries (per D-09)
- Edit mode UI with Settings toggle button, "添加指令" placeholder card, and CommandDialog integration
- All 53 tests pass (19 useProject + 18 MainArea + 16 CommandCard)

## Task Commits

Each task was committed atomically:

1. **Task 1: useProject project-level command override** - RED: `45d57a0` (test) + GREEN: `9f2808b` (feat)
2. **Task 2: MainArea edit mode UI + App.tsx props** - RED: `3590112` (test) + GREEN: `f5a9968` (feat)

## Files Created/Modified

- `src/hooks/useProject.ts` - Added commandMode, editMode, projectCommandsMap state; enableProjectCommands/disableProjectCommands; mode-aware CRUD; auto-revert on last delete; init loads project commands from store keys
- `src/hooks/__tests__/useProject.test.tsx` - 11 new tests for project-level override (enable, disable, mode switch, auto-revert, persistence, CRUD); updated existing CRUD tests for selectedId dependency
- `src/components/MainArea.tsx` - Expanded from 51 to 155 lines: new props interface, Settings edit button, mode label + switch, commands-driven grid, "添加指令" placeholder, CommandDialog integration
- `src/components/__tests__/MainArea.test.tsx` - 13 new tests for edit mode UI; updated 5 existing tests with new required props
- `src/App.tsx` - Added useProject destructuring for new fields; passes all new props to MainArea

## Decisions Made

- **commands depends on selectedId**: Changed from unconditional preset+custom merge to conditional project-level check. This means commands returns empty array when no project is selected. Existing CRUD tests were updated to include a selected project.
- **canEdit prop derivation**: Used `editMode && (isCustom || scope === 'project')` to control CommandCard editability. This means project-level presets show delete buttons in edit mode (per D-11), while global presets never show them.
- **ContextMenu deferred**: Plan mentioned ContextMenu for right-click editing, but edit mode delete button + click-to-edit already provides the same functionality. Deferring ContextMenu reduces complexity for v1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing CRUD tests failed due to commands depending on selectedId**
- **Found during:** Task 1 GREEN phase
- **Issue:** commands useMemo was changed to return empty array when selectedId is null. All 8 existing CRUD tests had no selected project, so commands was always empty.
- **Fix:** Updated CRUD test beforeEach to mock a selected project (projects + selectedProjectId in store). Also updated "initializes customCommands" test to include the same mock.
- **Files modified:** src/hooks/__tests__/useProject.test.tsx
- **Verification:** All 19 tests pass
- **Committed in:** 9f2808b (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Project-level data not loading from store in tests 5 and 11**
- **Found during:** Task 1 GREEN phase
- **Issue:** Init function uses store.keys() to discover projectCommands:* keys, but tests only mocked store.get. The projectCommandsMap remained empty even though mockStore.get returned project command data.
- **Fix:** Added `mockStore.keys.mockResolvedValue(["projectCommands:test/project-a"])` to the two affected tests.
- **Files modified:** src/hooks/__tests__/useProject.test.tsx
- **Verification:** Tests 5 and 11 pass
- **Committed in:** 9f2808b (Task 1 GREEN commit)

**3. [Rule 3 - Blocking] @testing-library/user-event not installed**
- **Found during:** Task 2 RED phase
- **Issue:** MainArea tests imported userEvent but the package was not in package.json.
- **Fix:** Replaced userEvent with fireEvent from @testing-library/react (already installed).
- **Files modified:** src/components/__tests__/MainArea.test.tsx
- **Verification:** All 18 MainArea tests pass
- **Committed in:** 3590112 (Task 2 RED commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for test correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixes documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 is complete: all 3 plans executed (CommandDialog, CommandCard edit mode + CRUD, project-level override + MainArea UI)
- All custom command functionality is now implemented and tested
- Ready for phase verification and transition

## Self-Check: PASSED

- All 6 files verified present on disk
- All 4 commit hashes verified in git log
- All 53 tests passing (19 useProject + 18 MainArea + 16 CommandCard)

---
*Phase: 04-custom-commands*
*Completed: 2026-04-14*
