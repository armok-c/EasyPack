---
phase: 5
slug: personalization-keyboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Vite 原生测试框架) |
| **Config file** | vitest.config.ts — Wave 0 创建 |
| **Quick run command** | `pnpm test -- --run` |
| **Full suite command** | `pnpm test -- --run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- --run`
- **After every plan wave:** Run `pnpm test -- --run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PROJ-05 | unit | `pnpm test -- --run src/hooks/__tests__/useProject.icon-color.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | PROJ-05 | unit | `pnpm test -- --run src/components/__tests__/ProjectSettingsDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | PROJ-05 | unit | `pnpm test -- --run src/components/__tests__/Sidebar.icon-color.test.tsx` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | PROJ-06 | unit | `pnpm test -- --run src/hooks/__tests__/useProject.reorder.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | PROJ-06 | unit | `pnpm test -- --run src/components/__tests__/Sidebar.drag.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | UI-03 | unit | `pnpm test -- --run src/hooks/__tests__/useKeyboardNav.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | UI-03 | unit | `pnpm test -- --run src/components/__tests__/Sidebar.keyboard.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 2 | UI-03 | unit | `pnpm test -- --run src/components/__tests__/MainArea.keyboard.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest 配置（jsdom 环境、React 插件）
- [ ] `src/__tests__/setup.ts` — 测试 setup（testing-library cleanup）
- [ ] `pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom` — 安装测试依赖

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 拖拽排序视觉反馈（占位符、动画） | PROJ-06 | 需要视觉验证拖拽过程中的占位符和平滑动画 | 1. 添加 3+ 项目 2. 拖拽中间项目到顶部 3. 确认拖拽过程中有占位符 4. 确认松开后顺序正确 |
| 彩色左边框渲染效果 | PROJ-05 | 需要视觉验证 3px 彩色竖条在侧边栏中的渲染效果 | 1. 为项目设置不同颜色 2. 确认左侧显示 3px 彩色边框 3. 确认颜色与选择一致 |
| 键盘焦点环可见性 | UI-03 | 需要视觉验证焦点环在不同组件上的显示效果 | 1. Tab 进入侧边栏 2. 上下箭头切换项目 3. Tab 进入卡片区域 4. 方向键移动卡片焦点 5. 确认焦点环清晰可见 |
| 数字键 1-9 触发指令 | UI-03 | 需要在真实环境中验证键盘事件触发命令执行 | 1. 选中项目 2. Tab 进入卡片区域 3. 按 1 触发第一个指令 4. 确认终端打开并执行 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
