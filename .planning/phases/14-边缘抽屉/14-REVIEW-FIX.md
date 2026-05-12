---
phase: 14-边缘抽屉
fixed_at: 2026-05-12T13:00:00Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 8
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 8)

**Fixed at:** 2026-05-12T13:00:00Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 8

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: FloatApp.tsx emit+destroy race — main window ownership model

**Files modified:** `src/components/FloatApp.tsx`, `src/hooks/useFloatWindow.ts`
**Commit:** `9b2e280`
**Applied fix:** Changed the close flow to a main-window-owns-destruction model:
- `FloatApp.tsx`: `handleClose` now only emits `"float:close-requested"`, does NOT call `destroy()`.
- `useFloatWindow.ts`: The `"float:close-requested"` listener now captures the window ref, calls `cleanupFloatState()`, then destroys the window. This eliminates the race where the float window could be destroyed before the main window processed the close event.

### WR-01: `destroyFloat` return type changed to `Promise<void>`

**Files modified:** `src/hooks/useFloatWindow.ts`
**Commit:** `5404e25`
**Applied fix:** Changed `destroyFloat` from `() => void` to `(): Promise<void>`. The function now returns the operationLock promise, so `App.tsx`'s `await destroyFloat()` correctly waits for float window cleanup before destroying the main window. Also replaced `.catch(() => {})` with DEV-gated `console.error`.

### WR-02: `.catch(() => {})` replaced with DEV-gated error logging

**Files modified:** `src/hooks/useFloatWindow.ts`
**Commit:** `2d48903`
**Applied fix:** Replaced the silent `.catch(() => {})` on `toggleFloat`'s operationLock chain with `if (import.meta.env.DEV) { console.error(...) }`. Errors are now visible during development while remaining silent in production.

### WR-03: `positionFloatTopRight` console.error gated behind DEV

**Files modified:** `src/hooks/useFloatWindow.ts`
**Commit:** `d5da03d`
**Applied fix:** Wrapped `console.error("Failed to set float window position:", err)` with `if (import.meta.env.DEV)`, consistent with the pattern already applied to `useEdgeDrawer.ts` in iteration 7.

## Verification

- TypeScript compilation: `npx tsc -b` passes with zero new errors for modified files.
- All 4 commits are atomic and follow the `fix(14): {id} {description}` format.

---
_Fixed by: gsd-code-fixer (iteration 8)_
