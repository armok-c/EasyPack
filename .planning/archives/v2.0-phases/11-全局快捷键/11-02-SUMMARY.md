---
phase: 11-全局快捷键
plan: 02
subsystem: ui
tags: [shortcut-badge, state-machine, recording-mode, conflict-detection, useGlobalShortcuts, assignShortcut, clearShortcut, tauri-plugin-store]

# Dependency graph
requires:
  - phase: 11-01
    provides: tauri-plugin-global-shortcut plugin config, CommandItem.shortcut field, keyboardEventToShortcut/shortcutToDisplay utils, useGlobalShortcuts hook
provides:
  - assignShortcut/clearShortcut CRUD functions in useProject hook
  - presetShortcutsMap state for persisting preset command shortcuts
  - CommandCard shortcut badge 4-state rendering (Display/Empty Slot/Recording/Conflict)
  - MainArea recording state management with conflict auto-clear
  - useGlobalShortcuts hook integration in App.tsx
affects: [12-系统托盘]

# Tech tracking
tech-stack:
  added: []
  patterns: [presetShortcutsMap for derived preset shortcut persistence, recording state lifted to MainArea, group-hover pattern for clear button visibility]

key-files:
  created: []
  modified:
    - src/hooks/useProject.ts
    - src/App.tsx
    - src/components/CommandCard.tsx
    - src/components/MainArea.tsx
    - src/components/__tests__/CommandCard.test.tsx

key-decisions:
  - "presetShortcutsMap separate state for preset shortcuts: presets are derived fresh each render, cannot persist shortcut field directly; separate map + store key solves this cleanly"
  - "group class on CommandCard outer button enables CSS-only clear button hover visibility without JS state"

patterns-established:
  - "presetShortcutsMap: derived preset commands need separate persistence layer for shortcut overrides, injected into commands useMemo"
  - "Badge state machine: isRecording > hasConflict > shortcut > editMode > shortcutNumber priority chain"
  - "Recording state lifted to parent (MainArea) with callback props flowing down to CommandCard"

requirements-completed: [KB-01, KB-02, KB-03, KB-04, KB-05, KB-06]

# Metrics
duration: 13min
completed: 2026-04-27
---

# Phase 11 Plan 02: UI Integration Summary

**CommandCard 4-state shortcut badge (Display/Empty Slot/Recording/Conflict) + assignShortcut/clearShortcut CRUD + useGlobalShortcuts App integration, 118 tests passing**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-27T02:40:29Z
- **Completed:** 2026-04-27T02:53:51Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended useProject with assignShortcut/clearShortcut supporting project/custom/preset three persistence modes
- Created presetShortcutsMap state to persist shortcuts on derived preset commands that are recreated each render
- Integrated useGlobalShortcuts hook in App.tsx passing commands, executeCommand, and enabled flag
- Implemented CommandCard shortcut badge with 4 visual states: Display (shortcut combo), Empty Slot (+), Recording (pulsing accent), Conflict (destructive red)
- Added recording keydown handler using keyboardEventToShortcut with modifier validation and Esc cancel
- Added clear X button on hover (group-hover CSS pattern) in edit mode for bound shortcuts
- MainArea manages recordingCommandId/conflictCommandId state with auto-clear on edit mode exit
- Shortcut badge takes display priority over number badge when both are available
- 9 new badge tests added (118 total passing, 0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useProject with assignShortcut/clearShortcut + wire useGlobalShortcuts in App** - `8888c74` (feat)
2. **Task 2: Implement CommandCard shortcut badge state machine + MainArea recording management** - `504079b` (feat)

## Files Created/Modified
- `src/hooks/useProject.ts` - Added presetShortcutsMap state, assignShortcut (with conflict detection), clearShortcut; modified commands useMemo to inject preset shortcuts
- `src/App.tsx` - Added useGlobalShortcuts import and invocation; destructured assignShortcut/clearShortcut; passed to MainArea
- `src/components/CommandCard.tsx` - Complete rewrite of badge rendering: 4-state priority chain (isRecording > hasConflict > shortcut > editMode > shortcutNumber); recording keydown useEffect; group class for hover clear button
- `src/components/MainArea.tsx` - Added assignShortcut/clearShortcut props; added recordingCommandId/conflictCommandId state; recording callbacks; edit mode auto-cancel effect; updated CommandCard rendering with all shortcut props
- `src/components/__tests__/CommandCard.test.tsx` - Added shortcutUtils and sonner mocks; 9 new tests for badge states; fixed 2 existing tests affected by multiple buttons in edit mode

## Decisions Made
- presetShortcutsMap as separate state: presets are re-derived from getDefaultsAsCommandItems() on each render cycle, so shortcut field cannot persist on the preset objects themselves. A separate Record<string, string> map persisted to "presetShortcuts" store key solves this cleanly.
- group CSS class on CommandCard outer button: enables the clear X button's opacity-0/opacity-100 group-hover transition without additional JS state, keeping the component simple.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test failures due to multiple buttons in edit mode**
- **Found during:** Task 2 (test verification)
- **Issue:** Two existing tests used `screen.getByRole("button")` which now matches multiple buttons in edit mode (main card button + shortcut "+" button), causing `getMultipleElementsFoundError`
- **Fix:** Changed affected tests to use `screen.getByLabelText(name)` instead, which uniquely identifies the main card button
- **Files modified:** src/components/__tests__/CommandCard.test.tsx
- **Verification:** 118/118 tests passing
- **Committed in:** 504079b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - test query specificity)
**Impact on plan:** Test fix only, no production code behavior change.

## Issues Encountered
- edit mode renders "+" button alongside main card button, breaking `getByRole("button")` queries in existing tests. Resolved by switching to `getByLabelText`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete global shortcut UI flow: edit mode -> click + -> record combo -> assign -> execute via global hotkey
- useGlobalShortcuts integrated in App.tsx, will register/unregister OS-level shortcuts on project switch
- Phase 12 (system tray) can reuse the shortcut infrastructure for tray menu items if needed
- All 118 tests passing, no regressions

---
*Phase: 11-全局快捷键*
*Completed: 2026-04-27*

## Self-Check: PASSED

- All 5 modified files verified on disk
- Both task commits (8888c74, 504079b) verified in git log
