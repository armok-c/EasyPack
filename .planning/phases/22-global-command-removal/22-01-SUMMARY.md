---
phase: 22-global-command-removal
plan: 01
subsystem: data-model
tags: typescript, command-item, scope, startup-cleanup, preset

requires:
  - phase: 20-profile-architecture
    provides: profileStore architecture (CUSTOM_COMMANDS_KEY, dual-store pattern)
provides:
  - CommandItem.scope type narrowed to single "project" value (D-12)
  - Preset scope changed from "global" to "project" (D-07)
  - getDefaultsAsCommandItems() deprecated (D-08)
  - Startup CUSTOM_COMMANDS_KEY cleanup with toast notification (D-01/D-02)
affects:
  - 22-02: MainArea ToggleGroup removal, commandMode simplification
  - 22-03: CommandDialog scope dropdown removal

tech-stack:
  added: []
  patterns:
    - startup-time data migration pattern (detect old key, delete, notify)
    - type narrowing via removing union member from interface

key-files:
  created: []
  modified:
    - src/lib/types.ts (CommandItem.scope type change)
    - src/lib/presets.ts (scope values + deprecated annotation)
    - src/hooks/useProject.ts (startup cleanup logic)

key-decisions:
  - "D-12 implemented: CommandItem.scope narrowed from 'global' | 'project' to 'project'"
  - "D-07 implemented: Preset scope values changed to 'project'"
  - "D-08 implemented: getDefaultsAsCommandItems() marked as deprecated"
  - "D-01/D-02 implemented: ProfileStore CUSTOM_COMMANDS_KEY detection + deletion at startup, with toast.info notification"

patterns-established:
  - "Startup migration: detect stale keys in profileStore, delete, notify user via sonner toast"

requirements-completed:
  - CMD-09
  - CMD-10

duration: 5min
completed: 2026-06-17
---

# Phase 22 Plan 01: Data Model Foundation + Startup Cleanup

**CommandItem.scope type narrowed to single "project" value, preset scope updated, getDefaultsAsCommandItems deprecated, and startup CUSTOM_COMMANDS_KEY cleanup with one-time toast notification**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-17T17:33:00+08:00
- **Completed:** 2026-06-17T17:37:00+08:00
- **Tasks:** 3 (plus 1 auto-fix commit)
- **Files modified:** 4

## Accomplishments

- `CommandItem.scope` type narrowed from `"global" | "project"` to `"project"` (D-12)
- `getDefaultsAsCommandItems()` scope values updated from `"global"` to `"project"` (D-07)
- `getDefaultsAsCommandItems()` annotated with `@deprecated Phase 22` (D-08)
- Startup cleanup logic added to `useProject.ts init()`: detects old `CUSTOM_COMMANDS_KEY` data, deletes it, shows `toast.info` notification (D-01/D-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: types.ts — Remove "global" from CommandItem.scope** - `15f8752` (feat)
2. **Task 2: presets.ts — Update scope + deprecate function** - `2f7afb4` (feat)
3. **Task 3: useProject.ts — Startup cleanup** - `8df84d9` (feat)
4. **Deviation: Fix tests for scope change** - `6f4af07` (test)

## Files Created/Modified

- `src/lib/types.ts` - CommandItem.scope changed from `"global" | "project"` to `"project"`
- `src/lib/presets.ts` - Two `scope: "global" as const` changed to `scope: "project" as const`; added `@deprecated Phase 22` annotation
- `src/hooks/useProject.ts` - Added CUSTOM_COMMANDS_KEY check in init() between loadProfileDataIntoState() and setProfileStore()
- `src/hooks/__tests__/useProject.test.tsx` - Updated test fixtures and assertions to use `scope: "project"` (Rule 1 auto-fix)

## Decisions Made

None - all decisions were documented in 22-CONTEXT.md and implemented as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tests broken by scope type change**
- **Found during:** Post-task verification (running `npx vitest run`)
- **Issue:** Changing `CommandItem.scope` from `"global" | "project"` to `"project"` broke 3 tests in `useProject.test.tsx` that asserted `c.scope === "global"`. Additionally, the test fixture at line 190 used `scope: "global"` which is no longer a valid CommandItem value.
- **Fix:** Updated test fixture data (`scope: "global"` to `scope: "project"`) and changed 3 `c.scope === "global"` assertions to `c.scope === "project"`
- **Files modified:** `src/hooks/__tests__/useProject.test.tsx`
- **Verification:** useProject tests now pass (19/19); remaining pre-existing failures (6 files, 80 tests) are "React is not defined" environment issues, unrelated to this change
- **Committed in:** `6f4af07`

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** Necessary to maintain test correctness after type change. No scope creep.

## Issues Encountered

- Pre-existing test infrastructure issue ("React is not defined") affects 6 test files (80 tests) across CommandCard, TitleBar, Dialog, MainArea, CommandDialog, and useRecentCommands. These are documented in PROJECT.md as known pre-existing failures and are not caused by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Data model foundation is ready: `CommandItem.scope` no longer accepts `"global"`
- Plan 02 can safely remove MainArea ToggleGroup and commandMode UI
- Plan 03 can remove the scope dropdown from CommandDialog

---
*Phase: 22-global-command-removal*
*Completed: 2026-06-17*
