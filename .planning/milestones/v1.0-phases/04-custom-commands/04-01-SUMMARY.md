---
phase: 04-custom-commands
plan: 01
subsystem: ui
tags: [shadcn, dialog, typescript, react, vitest, tdd, command-item, icon-mapping]

# Dependency graph
requires:
  - phase: 03-command-cards
    provides: CommandCard component, vitest infrastructure, UI patterns
provides:
  - CommandItem interface (7-field unified data structure)
  - ICON_OPTIONS icon name-to-component mapping (10 icons)
  - getIconByName helper function
  - getPresetAsCommandItems preset-to-CommandItem converter
  - CommandDialog add/edit modal component
  - 4 shadcn/ui components (Dialog, ContextMenu, Input, Label)
affects: [04-02, 04-03]

# Tech tracking
tech-stack:
  added: [@radix-ui/react-dialog, @radix-ui/react-context-menu, @radix-ui/react-label]
  patterns: [icon-as-string-for-serialization, radio-group-accessibility, form-validation-dirty-state]

key-files:
  created:
    - src/lib/types.ts
    - src/lib/icons.ts
    - src/components/CommandDialog.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/context-menu.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
  modified:
    - src/lib/presets.ts

key-decisions:
  - "Icon stored as string name (not LucideIcon component) for serialization safety per D-19"
  - "PRESET_ICON_NAMES hardcoded array instead of LucideIcon.displayName (unreliable per RESEARCH.md OQ-1)"
  - "Icon picker uses role=radiogroup/radio with aria-checked for accessibility"

patterns-established:
  - "CommandItem as unified data type for both preset and custom commands"
  - "getIconByName string-to-component resolution pattern"
  - "Form dirty-state validation: errors only shown after user interaction"

requirements-completed: [CMD-05, UI-07]

# Metrics
duration: 16min
completed: 2026-04-14
---

# Phase 4 Plan 01: CommandDialog Foundation Summary

**shadcn/ui Dialog + CommandItem 类型定义 + 10 图标映射表 + 添加/编辑指令弹窗组件 (16 tests)**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-14T03:00:29Z
- **Completed:** 2026-04-14T03:16:13Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Defined CommandItem interface as the unified data structure for all Phase 4 features
- Created icon name-to-component mapping with 10 lucide-react icons and safe fallback
- Built CommandDialog modal supporting both add and edit modes with live preview
- Achieved full form validation with dirty-state tracking and 16 unit tests via TDD

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn/ui components + define data structures and icon mapping** - `53f9644` (feat)
2. **Task 2: Create CommandDialog component with TDD** - `5ddc780` (feat)

_Note: Task 2 followed TDD -- tests written first (RED), then implementation (GREEN)._

## Files Created/Modified
- `src/lib/types.ts` - CommandItem interface with 7 fields (id/name/command/icon/type/scope/addedAt)
- `src/lib/icons.ts` - ICON_OPTIONS mapping, DEFAULT_ICON constant, getIconByName helper
- `src/lib/presets.ts` - Extended with getPresetAsCommandItems conversion function
- `src/components/CommandDialog.tsx` - Add/edit command modal with icon picker and live preview
- `src/components/__tests__/CommandDialog.test.tsx` - 16 unit tests for CommandDialog
- `src/components/ui/dialog.tsx` - shadcn/ui Dialog component
- `src/components/ui/context-menu.tsx` - shadcn/ui ContextMenu component
- `src/components/ui/input.tsx` - shadcn/ui Input component
- `src/components/ui/label.tsx` - shadcn/ui Label component

## Decisions Made
- Icon stored as string name in CommandItem (not LucideIcon component) to ensure safe JSON serialization per D-19
- PRESET_ICON_NAMES hardcoded matching PRESET_COMMANDS order, because LucideIcon.displayName is unreliable (RESEARCH.md Open Question 1)
- Icon picker grid uses role=radiogroup/radio with aria-checked for screen reader accessibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI installed components to literal `@/` directory instead of resolved alias**
- **Found during:** Task 1 (shadcn component installation)
- **Issue:** `npx shadcn@latest add` created `@/components/ui/` directory tree instead of `src/components/ui/`
- **Fix:** Moved files from `@/components/ui/` to `src/components/ui/` and removed stray directory
- **Files modified:** dialog.tsx, context-menu.tsx, input.tsx, label.tsx (relocated)
- **Verification:** `ls src/components/ui/` shows all 4 new files; all tests pass
- **Committed in:** 53f9644 (Task 1 commit)

**2. [Rule 1 - Bug] Preview card test used getByLabelText for non-aria text span**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Test `getByLabelText("指令名称")` failed because preview text is a plain `<span>`, not an aria-labeled element
- **Fix:** Changed test to verify preview section via `getByText("预览")` and check icon selection state via `aria-checked`
- **Files modified:** src/components/__tests__/CommandDialog.test.tsx
- **Verification:** All 16 tests pass
- **Committed in:** 5ddc780 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary for correct execution. No scope creep.

## Issues Encountered
- None beyond deviations documented above

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CommandItem type ready for Plan 02 (edit/delete CRUD and persistence)
- CommandDialog ready to be wired into MainArea for add/edit flows
- Icon mapping ready for CommandCard integration
- Preset-to-CommandItem converter available for unified command grid display

## Self-Check: PASSED

- All 10 output files verified present on disk
- Both commit hashes (53f9644, 5ddc780) verified in git log
- Full test suite: 30 tests passing (14 existing + 16 new)

---
*Phase: 04-custom-commands*
*Completed: 2026-04-14*
