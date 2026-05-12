---
phase: 14-边缘抽屉
fixed_at: 2026-05-12T12:30:00Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 7
findings_in_scope: 4
fixed: 3
skipped: 1
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 7)

**Fixed at:** 2026-05-12T12:30:00Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 7

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warning)
- Fixed: 3
- Skipped: 1

## Fixed Issues

### CR-01: Missing `core:window:allow-center` permission

**Files modified:** `src-tauri/capabilities/default.json`
**Applied fix:** Added `"core:window:allow-center"` to the permissions array in `default.json`. Without this permission, `appWindow.center()` in `handleDragWhileSnapped` fallback branch would fail at runtime with a Tauri IPC permission error, leaving the window stuck as a tiny sliver with no way to recover.

### WR-02: `handleDragEnd` state mutations outside operationLock

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Applied fix:** Moved `originalRectRef.current` assignment and `appWindow.setMinSize()` call from outside the `operationLock` callback into the callback body. Values are captured in local variables before the lock, then applied inside. Added re-entry guard (`if (snapEdgeRef.current !== null) return`) at the top of the lock callback.

### WR-03: `console.error` statements in production code

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Applied fix:** Wrapped both `console.error` calls (in `handleDragEnd` catch and `handleMouseLeave` catch) with `if (import.meta.env.DEV) { ... }` guard, removing them from production builds.

## Skipped Issues

### WR-01: Potential missing `core:window:allow-on-moved` for `onMoved` listener

**Reason:** Reviewer determined that window event listeners in Tauri 2.x are handled through the generic event system. The existing `core:event:default` permission covers `onMoved`. Recommendation is to verify at runtime that callbacks fire during dragging. No immediate code change required.

---

_Fixed by: gsd-code-fixer (iteration 7)_
