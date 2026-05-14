---
phase: 15
slug: 开机启动
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + cargo check (Rust) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `cd E:/git/EasyPack && npx tsc --noEmit 2>&1 \| tail -10` |
| **Full suite command** | `cd E:/git/EasyPack/src-tauri && cargo check 2>&1 \| tail -5` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo check` (Rust) or `npx tsc --noEmit` (frontend)
- **After every plan wave:** Run both checks
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | BOOT-02, BOOT-03 | — | Registry writes to HKCU only (not HKLM) | compile | `cd E:/git/EasyPack/src-tauri && cargo check 2>&1 \| tail -5` | W0 | pending |
| 15-02-01 | 02 | 2 | BOOT-01, BOOT-04 | — | No user input validation needed (hardcoded args) | compile | `cd E:/git/EasyPack && npx tsc --noEmit 2>&1 \| tail -10` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/Cargo.toml` — tauri-plugin-autostart 2.x dependency added
- [ ] `src-tauri/capabilities/default.json` — autostart permissions appended
- [ ] No new test files needed — BOOT-02/BOOT-03 require Tauri runtime, only compile checks available

*Existing infrastructure covers all phase requirements that can be automated.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Enable autostart toggle, reboot, app starts minimized to tray | BOOT-01, BOOT-02 | Requires system reboot + Tauri runtime | 1. Enable autostart in Settings 2. Reboot Windows 3. Verify EasyPack is in tray, no window visible |
| Self-heal: disable autostart in Task Manager, restart app | BOOT-03 | Requires system-level registry manipulation | 1. Enable autostart 2. Open Task Manager > Startup tab, disable EasyPack 3. Restart EasyPack 4. Re-check Task Manager, should be re-enabled |
| Settings persist across restarts | BOOT-04 | Requires app restart | 1. Toggle autostart on 2. Close and reopen app 3. Verify switch still shows enabled |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
