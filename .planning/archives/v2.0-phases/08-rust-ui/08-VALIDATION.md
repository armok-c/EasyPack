---
phase: 8
slug: 08-rust-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (frontend) + cargo test (Rust backend) |
| **Config file** | vitest.config.ts (frontend) / Cargo.toml (Rust) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && cargo test -p easypack_lib` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && cargo test -p easypack_lib`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | PROJ-07, PROJ-09, PROJ-10 | T-08-01 / T-08-03 | Path validation, excluded dirs | unit (Rust) | `cargo test -p easypack_lib scan_icons` | no W0 | pending |
| 08-01-02 | 01 | 1 | PROJ-07, PROJ-09, PROJ-10 | T-08-02 | assetProtocol scope config | unit (Rust) | `cargo build` | no W0 | pending |
| 08-02-01 | 02 | 1 | UI-09 | T-08-04 | N/A | unit (Vitest) | `npx vitest run Dialog` | no W0 | pending |
| 08-03-01 | 03 | 2 | PROJ-08 | T-08-05 / T-08-06 | File icon type discrimination | unit (Vitest) | `npx vitest run icons` | yes (created by task) | pending |
| 08-03-02 | 03 | 2 | PROJ-08 | T-08-05 | File icon rendering + fallback | unit (Vitest) | `npx vitest run Sidebar` | no W0 | pending |
| 08-04-01 | 04 | 3 | PROJ-07, PROJ-08 | T-08-07 / T-08-08 / T-08-09 | File extension validation, path validation | unit (Vitest) | `npx vitest run ProjectSettingsDialog` | no W0 | pending |
| 08-05-01 | 05 | 2 | PROJ-09, PROJ-10 | T-08-10 / T-08-11 | Timeout error handling (reject, not resolve) | unit (Vitest) | `npx vitest run useProject` | no W0 | pending |
| 08-05-02 | 05 | 2 | PROJ-09, PROJ-10 | T-08-10 | Size display + error state display | unit (Vitest) | `npx vitest run MainArea` | no W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/commands/project_info.rs` tests -- stubs for PROJ-07, PROJ-09, PROJ-10
- [ ] `src/components/__tests__/Dialog.test.tsx` -- stub for UI-09
- [ ] `src/components/__tests__/Sidebar.test.tsx` -- stub for file icon rendering (PROJ-08)
- [ ] `src/components/__tests__/ProjectSettingsDialog.test.tsx` -- stubs for PROJ-07, PROJ-08
- [ ] `src/hooks/__tests__/useProject.test.tsx` -- extended for project info fetch + error state

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File icon rendering in sidebar | PROJ-08 | Requires WebView + asset protocol + real file | Select custom icon, verify sidebar renders `<img>` correctly |
| Folder size accuracy | PROJ-09 | Needs real filesystem with known content | Compare displayed size with Windows Explorer properties |
| Dialog scroll on small window | UI-09 | Requires visual viewport verification | Resize window to small height, verify dialog scrolls |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
