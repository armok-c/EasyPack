---
phase: 7
slug: 无边框窗口与自定义标题栏
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.4 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/components/__tests__/TitleBar.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/__tests__/TitleBar.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | WIN-01 | T-7-01 | N/A | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "renders"` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | WIN-01 | T-7-01 | N/A | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "window control"` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | WIN-01 | — | N/A | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "drag region"` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | WIN-02 | — | N/A | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "height"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/TitleBar.test.tsx` — stubs for WIN-01 (render, buttons, drag region), WIN-02 (height/shrink)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 高 DPI 显示清晰 | WIN-03 | 需要实际显示器验证不同缩放比例 | 在 1x (96 DPI)、1.5x (144 DPI)、2x (192 DPI) 显示器上验证标题栏文字和按钮清晰正常 |
| 窗口阴影效果 | WIN-02 | Windows DWM 系统级行为，无法在测试中验证 | 在 Windows 11 上验证窗口有圆角阴影，Windows 10 上验证无阴影但 resize 正常 |
| 窗口 resize 边缘拖拽 | WIN-02 | 需要 native 窗口行为验证 | 拖拽窗口四边和四角验证 resize 正常工作 |
| 双击标题栏最大化 | WIN-01 | 需要 native 窗口事件验证 | 双击标题栏拖拽区域验证最大化/还原切换正常 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
