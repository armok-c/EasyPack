---
phase: 12-系统托盘
fixed_at: 2026-04-28T16:30:00Z
review_path: .planning/phases/12-系统托盘/12-REVIEW.md
iteration: 8
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-28T16:30:00Z
**Source review:** .planning/phases/12-系统托盘/12-REVIEW.md
**Iteration:** 8

**Summary:**
- Findings in scope: 2 (1 Critical, 1 Warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### CR-01: useRecentCommands addRecentCommand state/store race condition

**Files modified:** `src/hooks/useRecentCommands.ts`
**Commit:** c3904d2
**Applied fix:** Replaced stale closure-captured `recentCommands` with synchronous value capture from `setRecentCommands` callback. The state updater now writes the computed value into a local `toPersist` variable, which is then used for store persistence. This guarantees store writes always match React state updates. Dependency array simplified from `[recentCommands]` to `[]` since the closure no longer reads `recentCommands`.
**Verification:** TypeScript compilation passed (no errors in modified file). Re-read confirmed correct code structure.

### WR-01: TitleBar test references deleted onCloseBehavior prop

**Files modified:** `src/components/__tests__/TitleBar.test.tsx`
**Commit:** 8b47920
**Applied fix:** Removed `onCloseBehavior` prop from all 10 render calls. Deleted the "hide" test case entirely (behavior no longer exists). Updated the "close" test case: renamed to "close button calls appWindow.close", removed the prop, kept assertions that `mockClose` is called and `mockHide` is not called.
**Verification:** TypeScript compilation passed (no errors in modified file). Re-read confirmed all onCloseBehavior references removed and test structure intact.

---

_Fixed: 2026-04-28T16:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 8_
