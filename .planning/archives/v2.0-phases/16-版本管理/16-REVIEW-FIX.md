---
phase: 16-版本管理
fixed_at: 2026-05-14T06:50:00Z
re_fixed_at: 2026-05-14T21:00:00Z
re_review_fixed_at: 2026-05-14T23:45:00Z
final_fixed_at: 2026-05-14
review_path: .planning/phases/16-版本管理/16-REVIEW.md
iteration: 4
findings_in_scope: 15
fixed: 15
skipped: 0
status: complete
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-05-14T06:50:00Z
**Re-fixed at:** 2026-05-14T21:00:00Z
**Re-review fixed at:** 2026-05-14T23:45:00Z
**Final fixed at:** 2026-05-14
**Source review:** .planning/phases/16-版本管理/16-REVIEW.md
**Iteration:** 4

**Summary:**
- Findings in scope: 15 (across all review iterations)
- Fixed: 15
- Skipped: 0

## Iteration 1: Original Fixes (commit 6319717)

### CR-01: Blocking HTTP call on main thread freezes application
**Files:** `src-tauri/src/commands/update.rs`, `src-tauri/Cargo.toml`
**Fix:** Converted to `async fn` + async `reqwest::Client`. Removed `"blocking"` feature.

### CR-02: `open::that()` allows command injection on Windows
**Files:** `src-tauri/src/commands/update.rs`
**Fix:** Added `starts_with("https://")` validation. Extracted URL to constant.

### WR-01: Cache returns stale result on parse failure
**Files:** `src-tauri/src/commands/update.rs`
**Fix:** Delete corrupted cache entries when `semver::Version::parse()` fails.

### WR-02: Store write errors silently discarded
**Files:** `src-tauri/src/commands/update.rs`
**Fix:** Added `eprintln!` logging for `store.save()` failures.

### WR-03: Update check only runs once per app launch
**Files:** `src/hooks/useUpdateCheck.ts`
**Fix:** Added `checkNow` async function exposed in hook return.

### WR-04: `reqwest` includes `"blocking"` feature unnecessarily
**Files:** `src-tauri/Cargo.toml`
**Fix:** Removed `"blocking"`, kept only `["json"]`.

### IN-01: `useUpdateCheck` imports `Store` type unnecessarily
**Files:** `src/hooks/useUpdateCheck.ts`, `src/App.tsx`
**Fix:** Changed parameter to `storeReady: boolean`.

### IN-02: GitHub URL should be constants
**Files:** `src-tauri/src/commands/update.rs`
**Fix:** Extracted `RELEASE_API_URL` and `RELEASE_PAGE_URL` constants.

## Iteration 2: Post-Fix Verification Fixes (uncommitted)

### PF-01: `checkNow` has no UI trigger (WR-03 incomplete)
**Files:** `src/components/SettingsDialog.tsx`, `src/App.tsx`
**Fix:** Added `onCheckNow` prop to SettingsDialog. Wired `checkNow` from App.tsx. Added "检查更新" text button next to version number.

### PF-02: Inconsistent store.save() error handling in cache cleanup
**Files:** `src-tauri/src/commands/update.rs`
**Fix:** Changed `let _ = store.save()` to `if let Err(e) = store.save() { eprintln!(...) }` for consistency with WR-02 fix pattern.

## Iteration 3: Re-Review Fixes

### WR-01r: `checkNow()` silently swallows errors with no user feedback
**Files modified:** `src/hooks/useUpdateCheck.ts`, `src/components/SettingsDialog.tsx`
**Commit:** `6d2f359`
**Applied fix:** Changed `checkNow()` to return `Promise<boolean>`. In SettingsDialog, added `checkLabel` state and error feedback button.

### WR-02r: Empty `tag_name` from GitHub API causes opaque error propagation
**Files modified:** `src-tauri/src/commands/update.rs`
**Commit:** `5fcfa0d`
**Applied fix:** Added `tag_name.is_empty()` guard before parsing.

### IN-01r: Dead code URL validation in `open_release_page()`
**Files modified:** `src-tauri/src/commands/update.rs`
**Commit:** `81e8be2`
**Applied fix:** Added compile-time invariant comment.

### IN-02r: `checkNow()` does not refresh `currentVersion`
**Files modified:** `src/hooks/useUpdateCheck.ts`
**Commit:** `6d2f359`
**Applied fix:** Added `getVersion()` call at start of `checkNow()`.

## Iteration 4: Final Fix (--all scope)

### IN-03: New `reqwest::Client` per invocation (previously skipped)

**Files modified:** `src-tauri/src/commands/update.rs`
**Applied fix:** Replaced per-call `reqwest::Client::new()` with `static REQWEST_CLIENT: LazyLock<reqwest::Client>` using `std::sync::LazyLock` (Rust 1.80+). The shared client reuses its internal connection pool across invocations. No new dependency needed.

---
_Fixed: 2026-05-14T06:50:00Z_
_Re-fixed: 2026-05-14T21:00:00Z_
_Re-review fixed: 2026-05-14T23:45:00Z_
_Final fixed: 2026-05-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 4_
