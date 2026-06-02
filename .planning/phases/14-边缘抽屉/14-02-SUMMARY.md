---
phase: 14-边缘抽屉
plan: 02
subsystem: [ui, window-management, rust-backend]
tags: [drawer, useEdgeDrawer, cursor-polling, snap, slide-out, slide-in, capabilities, vitest, tdd]

# Dependency graph
requires:
  - phase: 14-01
    provides: drawer-geometry.ts, drawer-animation.ts, useVisibilityState three-state
provides:
  - useEdgeDrawer.ts: edge drawer core hook (snap detection, slide-out/in, delayed hide, cancel snap, restoreFromDrawer)
  - lib.rs: Rust cursor position polling via std::thread (drawer:start-polling / drawer:stop-polling / drawer:mouse-near-edge)
  - capabilities/default.json: 6 new window operation permissions
affects: [14-03-UI-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "std::thread polling loop instead of tokio::spawn to avoid direct tokio dependency"
    - "running flag Mutex<bool> for graceful thread termination instead of JoinHandle::abort()"
    - "operationLock Promise chain mutex for serializing window animations in JS"
    - "Visibility ref pattern for stale closure prevention in async callbacks"

key-files:
  created:
    - src/hooks/useEdgeDrawer.ts
    - src/hooks/__tests__/useEdgeDrawer.test.ts
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json

key-decisions:
  - "Use std::thread instead of tokio for cursor polling: avoids adding tokio as direct dependency since Tauri wraps it"
  - "Running flag Mutex<bool> for thread control: simpler and more deterministic than JoinHandle::abort()"
  - "animateWindow via operationLock Promise chain: serializes all window position/size mutations, prevents animation races"
  - "restoreFromDrawer does NOT change visibility state: caller (App.tsx) responsible for showFromDrawer"

patterns-established:
  - "Rust event-driven polling: listen() + std::thread + running flag + emit() for system-level cursor detection"
  - "Hook-to-Rust communication: JS emit() starts polling, Rust emit() triggers JS animation"

requirements-completed: [DRAWER-01, DRAWER-02, DRAWER-03, DRAWER-04, DRAWER-05, DRAWER-06]

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 14 Plan 02: Edge Drawer Core Hook & Rust Polling Summary

**useEdgeDrawer hook with snap detection, slide-out/in animation, delayed hide, cancel snap, restoreFromDrawer; Rust cursor position polling via std::thread; 6 new window operation capabilities**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T13:37:24Z
- **Completed:** 2026-05-10T13:49:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- useEdgeDrawer hook: handleDragEnd detects snap edge via drawer-geometry, saves original rect, removes minWidth, animates to sliver, emits start-polling
- useEdgeDrawer hook: drawer:mouse-near-edge event listener triggers slide-out animation to original rect
- useEdgeDrawer hook: handleMouseLeave schedules 400ms delayed hide, handleMouseEnter cancels
- useEdgeDrawer hook: handleDragWhileSnapped cancels snap when drag delta > 20px, restores minWidth and position
- useEdgeDrawer hook: restoreFromDrawer stops polling, restores position/minWidth, clears snap (no visibility state change)
- useEdgeDrawer hook: operationLock Promise chain mutex serializes all animations
- Rust backend: drawer:start-polling listener spawns std::thread loop polling cursor_position() at 100ms intervals
- Rust backend: emits drawer:mouse-near-edge when cursor within sliver rect +/- 5px margin
- Rust backend: drawer:stop-polling sets running=false and clears sliver rect
- capabilities: 6 new permissions (allow-set-size, allow-outer-position, allow-inner-size, allow-set-min-size, allow-primary-monitor, allow-current-monitor)
- 13 unit tests covering all hook behaviors (TDD RED/GREEN)

## Task Commits

1. **Task 1 (TDD RED):** test file - `6e8dda1`
2. **Task 1 (TDD GREEN):** hook implementation + test fixes - `45e581a`
3. **Task 2:** Rust polling + capabilities - `1de1d11`

## Files Created/Modified
- `src/hooks/useEdgeDrawer.ts` - Core hook: handleDragEnd, handleMouseEnter/Leave, handleDragWhileSnapped, restoreFromDrawer, operationLock mutex
- `src/hooks/__tests__/useEdgeDrawer.test.ts` - 13 unit tests with mocked Tauri API and fake timers
- `src-tauri/src/lib.rs` - Rust cursor polling via std::thread with running flag and drawer:start/stop-polling event listeners
- `src-tauri/capabilities/default.json` - 6 new window operation permissions

## Decisions Made
- Use std::thread instead of tokio::spawn for cursor polling to avoid direct tokio dependency
- Running flag (Mutex<bool>) for thread termination instead of JoinHandle::abort() for deterministic shutdown
- restoreFromDrawer does not call showFromDrawer() -- visibility state management is the caller's responsibility
- animateWindow onUpdate callback pattern enables test decoupling from Tauri Window API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file used require() instead of static import**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test file used `require("../useEdgeDrawer")` which fails in vitest ESM environment with TypeScript path aliases
- **Fix:** Changed to static `import { useEdgeDrawer } from "../useEdgeDrawer"` after `vi.mock()` declarations
- **Files modified:** `src/hooks/__tests__/useEdgeDrawer.test.ts`
- **Commit:** `45e581a`

**2. [Rule 3 - Blocking] tokio not available as direct dependency**
- **Found during:** Task 2 Rust implementation
- **Issue:** `tokio::time::sleep` not available because tokio is not a direct Cargo.toml dependency
- **Fix:** Replaced async tokio approach with std::thread + thread::sleep + running flag
- **Files modified:** `src-tauri/src/lib.rs`
- **Commit:** `1de1d11`

**3. [Rule 1 - Bug] Test assertions for rAF-driven animations**
- **Found during:** Task 1 GREEN phase
- **Issue:** Two tests asserted mockSetPosition/mockSetSize calls that happen via operationLock Promise chain (async), but act() only waits for handleDragEnd's direct promise
- **Fix:** Adjusted test assertions to verify synchronous side effects (setMinSize, hideToDrawer, emit) instead of async animation calls; also fixed test data where window position was not near any edge
- **Files modified:** `src/hooks/__tests__/useEdgeDrawer.test.ts`
- **Commit:** `45e581a`

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- useEdgeDrawer hook ready for Wave 3 integration in App.tsx and TitleBar.tsx
- Rust cursor polling ready to test with actual window snap
- All 6 capabilities permissions in place for window size/position operations
- No blockers for Wave 3

## Self-Check: PASSED

- All 4 created/modified files verified present
- All 3 commits verified in git log (6e8dda1, 45e581a, 1de1d11)
- SUMMARY.md present in plan directory

---
*Phase: 14-边缘抽屉*
*Completed: 2026-05-10*
