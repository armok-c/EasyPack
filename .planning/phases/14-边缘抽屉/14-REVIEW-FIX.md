---
phase: 14-边缘抽屉
fixed_at: 2026-05-12T14:00:00Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 9
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 9)

**Fixed at:** 2026-05-12T14:00:00Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 9

**Summary:**
- Findings in scope: 4 (0 Critical, 3 Warning, 1 Info)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Unhandled promise rejection risk in useEdgeDrawer operationLock chain

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** `cd8a98e`
**Applied fix:** Added `.catch()` with DEV-gated `console.error` to all 7 `.then()` chains on the `operationLock` mutex (handleDragEnd, mouse-near-edge, handleMouseLeave, handleDragWhileSnapped x2, restoreFromDrawer x2). Now matches the established pattern in `useFloatWindow.ts`.

### WR-02: console.error in onCloseRequested not gated behind DEV mode

**Files modified:** `src/App.tsx`
**Commit:** `79f6cc9`
**Applied fix:** Wrapped `console.error("Failed to hide window:", err)` with `if (import.meta.env.DEV)`, consistent with iterations 7-8 fixes in useEdgeDrawer.ts and useFloatWindow.ts.

### WR-03: restoreFromDrawer() called without await in tray onShow callback

**Files modified:** `src/App.tsx`
**Commit:** `79f6cc9`
**Applied fix:** Changed `onShow` callback from `() =>` to `async () =>` and added `await` before `restoreFromDrawer()`, matching the pattern at lines 182 and 205 where the same call uses `await`.

### IN-01: Pre-existing .catch(console.error) patterns in App.tsx not DEV-gated

**Files modified:** `src/App.tsx`
**Commit:** `79f6cc9`
**Applied fix:** Replaced bare `.catch(console.error)` on `appWindow.show()`, `appWindow.setFocus()`, and `appWindow.hide()` with DEV-gated inline `.catch((err) => { if (import.meta.env.DEV) console.error(err); })`.

## Verification

- TypeScript compilation: `npx tsc -b --noEmit` passes with zero new errors for modified files (pre-existing test file errors unchanged).
- All 3 commits are atomic and follow the `fix(14): {id} {description}` format.

---
_Fixed by: gsd-code-fixer (iteration 9)_
