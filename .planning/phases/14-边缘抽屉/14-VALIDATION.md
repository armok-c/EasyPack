---
phase: 14
slug: 边缘抽屉
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-12
---

# Phase 14 — Validation Strategy

> 边缘抽屉功能验证策略：窗口吸附检测、thin sliver 管理、滑出/收回动画、延迟收回、取消吸附、设置开关。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/__tests__/drawer-geometry.test.ts src/lib/__tests__/drawer-animation.test.ts src/hooks/__tests__/useVisibilityState.test.ts src/hooks/__tests__/useEdgeDrawer.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~9 seconds (168 tests) |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | DRAWER-01, DRAWER-02 | T-14-01 | detectSnapEdge 纯函数，输入由 Tauri API 可信源提供 | unit | `npx vitest run src/lib/__tests__/drawer-geometry.test.ts` | ✅ | ✅ green |
| 14-01-02 | 01 | 1 | DRAWER-05 | T-14-02 | animateWindow onUpdate 回调解耦，无直接 IPC | unit | `npx vitest run src/lib/__tests__/drawer-animation.test.ts` | ✅ | ✅ green |
| 14-01-02 | 01 | 1 | DRAWER-01 (三态) | — | TRAY_HIDDEN/DRAWER_HIDDEN 互斥覆盖 | unit | `npx vitest run src/hooks/__tests__/useVisibilityState.test.ts` | ✅ | ✅ green |
| 14-02-01 | 02 | 2 | DRAWER-01, DRAWER-03, DRAWER-04, DRAWER-06 | T-14-03 | drawer:start-polling payload 仅含坐标矩形，无安全敏感操作 | unit | `npx vitest run src/hooks/__tests__/useEdgeDrawer.test.ts` | ✅ | ✅ green |
| 14-02-02 | 02 | 2 | DRAWER-03 | T-14-05 | Rust 轮询定时器由前端控制启停，stop-polling 清理定时器 | compile | `cd src-tauri && cargo check` | ✅ | ✅ green |
| 14-03-01 | 03 | 3 | DRAWER-01, DRAWER-06 | T-14-07 | 吸附动画卡顿最多 200-300ms，可拖拽取消 | compile | `npx tsc --noEmit` | ✅ | ✅ green |
| 14-03-02 | 03 | 3 | DRAWER-04, DRAWER-05, DRAWER-06 | T-14-08, T-14-09 | drawerEnabled store 值用户手动修改仅影响设置；onMoved 高频事件驱动轻量纯数值计算 | compile | `npx tsc --noEmit` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- `vitest.config.ts` — 已配置 jsdom 环境和 TypeScript 路径别名
- `src/lib/__tests__/drawer-geometry.test.ts` — 12 unit tests (detectSnapEdge + calculateSliverRect)
- `src/lib/__tests__/drawer-animation.test.ts` — 6 unit tests (easeInOut + animateWindow)
- `src/hooks/__tests__/useVisibilityState.test.ts` — 6+ unit tests (三态状态机)
- `src/hooks/__tests__/useEdgeDrawer.test.ts` — 13 unit tests (核心 hook)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SnapIndicator 半透明吸附提示在拖拽中正确显示 (D-04) | DRAWER-01 | 需要 Tauri 窗口拖拽和 onMoved 实时事件，无法在 jsdom 中模拟 | 拖拽窗口到边缘 10px 内，观察蓝色半透明提示条出现 |
| SettingsDialog 边缘抽屉开关持久化 (D-12) | — | tauri-plugin-store IPC 持久化需要完整 Tauri 运行时 | 开启开关 → 重启应用 → 确认设置保持 |
| 悬浮窗在抽屉隐藏时独立存活 (D-16) | — | 涉及两个独立 WebviewWindow 实例的生命周期管理 | 吸附隐藏主窗口 → 确认悬浮窗仍可操作 |
| 重启后不自动进入抽屉状态 (D-17) | — | 需要跨应用生命周期验证 | 吸附隐藏 → 关闭应用 → 重启 → 确认窗口正常显示 |

---

## Validation Audit 2026-05-12

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Resolved gaps:**
- DRAWER-04 延迟收回测试失败：测试缺少滑出步骤（吸附后需先触发 mouse-near-edge 事件恢复 visibility 为 VISIBLE）。已修复测试用例，添加完整的三步流程（吸附 → 滑出 → 延迟收回）。

## Validation Re-Audit 2026-05-12

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests verified | 42/42 passing |

**Result:** All requirements COVERED. No new gaps detected. Automated test suite (42 tests across 4 files) green. TypeScript compilation clean. Manual-only verifications correctly classified.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-12
