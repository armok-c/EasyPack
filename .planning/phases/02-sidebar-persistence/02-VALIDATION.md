---
phase: 2
slug: sidebar-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (前端) + Rust #[test] (后端) |
| **Config file** | 无 — Wave 0 需创建 `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && cd src-tauri && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PROJ-02 | unit | `npx vitest run src/components/__tests__/sidebar.test.tsx` | Wave 0 | pending |
| 02-01-02 | 01 | 1 | PROJ-02 | unit | `npx vitest run src/components/__tests__/sidebar.test.tsx` | Wave 0 | pending |
| 02-02-01 | 02 | 1 | PROJ-03 | unit | `npx vitest run src/components/__tests__/sidebar.test.tsx` | Wave 0 | pending |
| 02-02-02 | 02 | 1 | PROJ-04 | unit | `npx vitest run src/hooks/__tests__/useProject.test.ts` | Wave 0 | pending |
| 02-03-01 | 03 | 2 | DATA-01 | integration | `npx vitest run src/hooks/__tests__/useProject.test.ts` | Wave 0 | pending |
| 02-03-02 | 03 | 2 | DATA-03 | integration | `npx vitest run src/hooks/__tests__/useProject.test.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest 配置文件
- [ ] `src/hooks/__tests__/useProject.test.ts` — useProject hook 多项目 + store 测试
- [ ] `src/components/__tests__/sidebar.test.tsx` — Sidebar 多项目渲染测试
- [ ] `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom` — 前端测试框架

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 选中状态视觉反馈 | PROJ-03 | CSS 渐变和透明度难以自动验证 | 选中项目后目视检查背景高亮和边框 |
| 侧边栏布局紧凑性 | PROJ-02 | 主观视觉评估 | 检查无多余空白，项目间距合理 |
| 重启后数据恢复 | DATA-01 | 需要关闭再启动 Tauri 应用 | 添加多个项目 → 关闭 → 重启 → 验证列表和选中状态完整 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
