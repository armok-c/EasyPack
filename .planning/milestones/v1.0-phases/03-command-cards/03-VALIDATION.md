---
phase: 3
slug: command-cards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (需安装为 devDependency) |
| **Config file** | none — Wave 0 创建 `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CMD-02 | — | N/A | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | CMD-01 | — | N/A | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | CMD-03, CMD-08 | — | N/A | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | UI-05 | — | N/A | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | UI-01 | — | N/A | visual/manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest 配置文件（React + jsdom 环境）
- [ ] `src/components/__tests__/CommandCard.test.tsx` — 卡片渲染、点击、动效测试 stubs
- [ ] `src/components/__tests__/MainArea.test.tsx` — 主区域空状态、网格布局测试 stubs
- [ ] 安装测试依赖: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 卡片圆角、间距、颜色符合 UI-SPEC | UI-01 | CSS 视觉效果无法通过单元测试验证 | 目视检查卡片样式：`rounded-xl`、`bg-white/5`、`border-white/10`、`p-4` |
| 动效时序和流畅度 | UI-05 | CSS animation 时序和流畅度需人工确认 | 点击卡片后观察：边框闪光 300ms + 缩放回弹 150ms，整体 ≤400ms |
| 自适应网格在不同窗口宽度下列数正确 | CMD-02 | 窗口 resize 行为需人工确认 | 拖拽窗口边缘，确认 600px 时 2 列、800px 时 3 列、1000px 时 4 列 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
