---
phase: 14-边缘抽屉
fixed_at: 2026-05-12T02:30:00Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 6
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 6)

**Fixed at:** 2026-05-12T02:30:00Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 6

**Summary:**
- Findings in scope: 2 (Warning only)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: restoreFromDrawer no-orig branch mutates refs outside operationLock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** `431c4f8`
**Applied fix:** Wrapped the `!orig` fallback branch body (`setMinSize`, `snapEdgeRef.current = null`, `setCurrentSnapEdge(null)`) inside `operationLock.current = operationLock.current.then(async () => { ... })`. This serializes the defensive fallback path mutations through the same lock used by the primary code paths, preventing races with concurrent animations.

### WR-02: handleDragWhileSnapped calls showFromDrawerRef outside operationLock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** `431c4f8`
**Applied fix:** Moved the `visibilityRef.current !== "VISIBLE"` check and `showFromDrawerRef.current()` call from outside the lock (former lines 338-341) into both the `if (orig)` and `else` lock callbacks, after the ref clears. Removed the standalone outside-lock call. This ensures the visibility state transition happens after the restore animation completes, preventing a 400ms race window where `handleMouseLeave` could observe stale state.

## Verification

- **TypeScript compilation** (`tsc --noEmit -p tsconfig.app.json`): No new errors in `useEdgeDrawer.ts`. All reported errors are in test mocks and are pre-existing.

## Skipped Issues (Info — not in default scope)

- IN-01: Stale primaryMonitor property on mockWindow in tests
- IN-02: onRestoreFromDrawer accepted by useTray but never used
- IN-03: console.error in production code (pre-existing)

---

_Fixed: 2026-05-12T02:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 6_
