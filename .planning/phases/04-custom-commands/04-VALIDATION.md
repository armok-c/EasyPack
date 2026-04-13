---
phase: 4
slug: custom-commands
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CMD-05, UI-07 | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx -t "添加"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CMD-05 | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx -t "编辑模式"` | ⚠️ 需扩展 | ⬜ pending |
| 04-02-01 | 02 | 1 | CMD-06 | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx -t "删除"` | ⚠️ 需扩展 | ⬜ pending |
| 04-02-02 | 02 | 1 | CMD-06, UI-07 | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx -t "编辑"` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | CMD-07 | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx -t "项目级"` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 1 | CMD-07 | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx -t "模式标签"` | ⚠️ 需扩展 | ⬜ pending |
| 04-04-01 | 04 | 1 | DATA-02 | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx -t "持久化"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/CommandDialog.test.tsx` — stubs for CMD-05, CMD-06, UI-07 (弹窗交互)
- [ ] `src/hooks/__tests__/useProject.test.tsx` — stubs for CMD-07 (项目级覆盖), DATA-02 (持久化)
- [ ] `src/components/__tests__/MainArea.test.tsx` — 需扩展编辑模式、模式标签测试
- [ ] `src/components/__tests__/CommandCard.test.tsx` — 需扩展右键菜单、自定义标记测试

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 编辑模式切换动效 | UI-07 | CSS transition 视觉效果需人工确认 | 切换编辑模式，确认卡片抖动/缩放动效流畅 |
| 右键菜单交互 | CMD-06 | ContextMenu 弹出位置需人工确认 | 右键自定义指令卡片，确认菜单定位正确 |
| 弹窗实时预览 | UI-07 | 预览卡片视觉效果需人工确认 | 在弹窗中输入名称/选择图标，确认预览卡片更新 |
| 项目级指令覆盖 | CMD-07 | 需要完整的交互流程验证 | 创建项目级指令集→确认替换→删除全部→确认回退 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
