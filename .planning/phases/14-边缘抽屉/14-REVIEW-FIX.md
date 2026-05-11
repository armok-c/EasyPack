---
phase: 14-边缘抽屉
fixed_at: 2026-05-11T19:30:00Z
review_path: .planning/phases/14-边缘抽屉/14-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-05-11T19:30:00Z
**Source review:** .planning/phases/14-边缘抽屉/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 Critical + 5 Warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: TOCTOU Race in Rust `drawer:start-polling`

**Files modified:** `src-tauri/src/lib.rs`
**Commit:** 2f2c2f0
**Applied fix:** Merged the running flag check and set into a single lock scope, eliminating the TOCTOU window between checking `running == false` and setting `running = true` that could spawn duplicate polling threads.

### CR-02: Stale `from` Capture in `drawer:mouse-near-edge` Listener

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** bd24930
**Applied fix:** Moved state capture (`orig`, `from`) and visibility guard inside the `operationLock.current.then()` callback so all reads happen after any in-flight animation completes. `setIsAnimating(true)` also moved inside the lock.

### WR-01: `onCloseRequested` Does Not Await `restoreFromDrawer`

**Files modified:** `src/App.tsx`
**Commit:** a42d49d
**Applied fix:** Added `await` before `restoreFromDrawer()` in the `onCloseRequested` handler to ensure the window position is fully restored before hiding to tray.

### WR-02: `onMoved` Listener Leaks on Fast Unmount

**Files modified:** `src/App.tsx`
**Commit:** a42d49d
**Applied fix:** Added `cancelled` flag pattern to `setupMoveListener`. The flag is set to `true` in the cleanup function, checked after the async `onMoved` registration returns (to immediately unregister if already cancelled), and checked inside the callback to short-circuit on unmounted component.

### WR-03: Rust `Mutex::unwrap()` Panics on Poisoned Lock

**Files modified:** `src-tauri/src/lib.rs`
**Commit:** 2f2c2f0
**Applied fix:** Replaced all 9 instances of `.lock().unwrap()` with `.lock().unwrap_or_else(|e| e.into_inner())` for poison-resistant recovery across all Mutex operations in `drawer:start-polling`, `drawer:stop-polling`, and the polling thread loop.

### WR-04: `isAnimating` State Inconsistent With Actual Animation Timing

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** bd24930
**Applied fix:** Moved `setIsAnimating(true)` inside the `operationLock.current.then()` callback (right before `animateWindow`) in all three locations: `handleDragEnd`, `drawer:mouse-near-edge` listener, and `handleMouseLeave` timeout. This prevents a previous animation's `finally` block from clearing the flag before the queued animation starts.

### WR-05: `handleMouseLeave` Timeout Does Not Guard Against Stale Visibility

**Files modified:** `src/hooks/useEdgeDrawer.ts`
**Commit:** 3e99e90
**Applied fix:** Added `if (visibilityRef.current !== "VISIBLE") return;` guard at the start of the timeout callback, after the `snapEdgeRef.current === null` check. This prevents the timer from animating the window back to sliver if `restoreFromDrawer()` was already called (e.g., via tray) while the timer was pending.

---

_Fixed: 2026-05-11T19:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
