---
phase: 1
slug: shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (前端) + Rust #[test] (后端) |
| **Config file** | 无 — Wave 0 需创建 `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && cd src-tauri && cargo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose` (前端) 或 `cd src-tauri && cargo test` (后端)
- **After every plan wave:** Run `npx vitest run && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | PROJ-01 | integration | `npx vitest run src/components/__tests__/layout.test.tsx` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | CMD-04 | unit (Rust) | `cd src-tauri && cargo test test_execute_command` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | CMD-04 | unit (Rust) | `cd src-tauri && cargo test test_path_with_spaces` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | CMD-04 | unit (Rust) | `cd src-tauri && cargo test test_path_with_cjk` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | D-07 | unit (Rust) | `cd src-tauri && cargo test test_terminal_fallback` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | PROJ-01 | smoke | 手动测试 — Dialog 依赖系统 UI | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | UI-02 | smoke | 手动测试 — 视觉验证 | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 2 | UI-06 | smoke | 手动测试 — 拖拽窗口边缘验证 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest 配置文件
- [ ] `src-tauri/src/commands/shell.rs` 中的 `#[cfg(test)] mod tests` — Rust 单元测试桩
- [ ] `src/hooks/__tests__/useProject.test.ts` — useProject hook 测试桩
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom` — 前端测试框架
- [ ] 手动冒烟测试清单：窗口启动、深色主题、文件夹选择、命令按钮点击

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 文件夹选择器打开并返回路径 | PROJ-01 | Dialog 依赖系统 UI，无法在 headless 环境模拟 | 1. 启动应用 2. 点击"添加项目"按钮 3. 确认系统文件夹选择器弹出 4. 选择文件夹后路径出现在侧边栏 |
| 深色主题 CSS 变量正确加载 | UI-02 | 视觉验证，需人眼确认颜色正确 | 1. 启动应用 2. 确认背景深色、文字浅色、accent 颜色正确 3. 检查 OKLCH 变量在 DevTools 中生效 |
| 窗口尺寸约束生效 | UI-06 | 需拖拽窗口边缘交互验证 | 1. 启动应用 2. 尝试缩小窗口至 minWidth(800) 以下 3. 确认窗口不会小于最小尺寸 |
| 命令在系统终端中执行 | CMD-04 | 需验证外部终端窗口实际弹出 | 1. 选择项目 2. 点击命令按钮 3. 确认 Windows Terminal / cmd 窗口弹出并执行命令 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
