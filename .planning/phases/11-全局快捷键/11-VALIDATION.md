---
phase: 11
slug: 11-全局快捷键
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.4 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | KB-01 | T-11-03 | keyboardEventToShortcut validates modifier required (D-06), key count <= 3 (D-07) | unit | `npx vitest run src/lib/__tests__/shortcutUtils.test.ts` | Wave 0 | pending |
| 11-01-02 | 01 | 1 | KB-02 | — | register() handler checks event.state === 'Pressed' to prevent double-fire | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Wave 0 | pending |
| 11-02-01 | 02 | 1 | KB-03 | — | Project switch calls unregisterAll() then registers new project shortcuts | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Wave 0 | pending |
| 11-02-02 | 02 | 1 | KB-04 | — | Conflict detection checks isRegistered() + scans current project commands | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Wave 0 | pending |
| 11-03-01 | 03 | 2 | KB-01 | — | Badge state machine renders 4 states correctly (empty, display, recording, conflict) | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx` | Exists (extend) | pending |
| 11-03-02 | 03 | 2 | KB-05 | — | User can clear shortcut binding and store persists change | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx` | Exists (extend) | pending |
| 11-03-03 | 03 | 2 | KB-06 | — | Shortcut field persists in CommandItem JSON across app restart | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx` | Exists (extend) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/shortcutUtils.test.ts` — stubs for keyboardEventToShortcut conversion and validation
- [ ] `src/hooks/__tests__/useGlobalShortcuts.test.ts` — stubs for KB-01/02/03/04 registration lifecycle
- [ ] Extend `src/components/__tests__/CommandCard.test.tsx` — add shortcut badge rendering tests
- [ ] Extend `src/hooks/__tests__/useProject.test.tsx` — add assignShortcut/clearShortcut tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Global shortcut fires when app is minimized | KB-02 | Requires OS-level window state change | Minimize app, press bound shortcut, verify terminal opens |
| Shortcut hijacking by another app | T-11-02 | OS-level behavior, cannot mock | Bind same shortcut in another app, verify EasyPack behavior |
| Shortcut works after OS sleep/wake | KB-02 | OS state transition | Sleep/wake PC, verify shortcuts still registered |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
