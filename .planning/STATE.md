---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: 快捷键、托盘与窗口增强
status: ready_to_plan
stopped_at: Phase 12 UI-SPEC approved
last_updated: "2026-04-27T03:30:00Z"
last_activity: 2026-04-27
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 25
---

# Project State

**Status:** Ready to plan
**Last Activity:** 2026-04-27
**Current Focus:** Phase 12 — 系统托盘

## Current Position

Phase: 12
Plan: Not started
Status: Phase 12 UI-SPEC approved
Last activity: 2026-04-27 -- Phase 12 UI-SPEC approved

Progress: [██████████] 100%

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-26)

**Core value:** 选中项目 → 一键在终端执行指令，无需手动切换目录和输入命令
**Current focus:** v1.2 快捷键、托盘与窗口增强

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.2 phase ordering: 快捷键 → 托盘 → 悬浮窗 → 边缘抽屉 (dependency chain)
- 窗口可见性状态机必须在托盘阶段设计 (TRAY phase), 为边缘抽屉铺路
- presetShortcutsMap separate state for preset shortcuts: presets are derived fresh, cannot persist shortcut field directly
- group CSS class on CommandCard enables hover-based clear button visibility without JS state
- Phase 12: 托盘菜单显示最近 8 个执行指令 + 项目名，关闭/Alt+F4→隐藏到托盘，最小化→任务栏
- Phase 12: 单击托盘始终显示窗口，Tooltip 固定 "EasyPack"
- Phase 12: TitleBar 齿轮按钮→通用设置弹窗，两个开关（启用托盘 + 关闭到托盘）

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 14 (边缘抽屉) "thin sliver" 方案需要原型验证 — 在不同 DPI 和 Windows 版本下行为未知
- Phase 13 (悬浮窗) Vite 多页构建与 Tauri 集成需要确认 HMR 和打包行为

## Deferred Items

Items acknowledged and deferred at v1.1 milestone close on 2026-04-26:

| Category | Item | Status |
|----------|------|--------|
| verification | Phase 08 VERIFICATION | human_needed |
| verification | Phase 10 VERIFICATION | human_needed |
| test | CommandDialog.test.tsx 16 failures | pre-existing |
| build | 8 TypeScript build errors | pre-existing |

## Session Continuity

Last session: 2026-04-27
Stopped at: Phase 12 UI-SPEC approved
Resume file: .planning/phases/12-系统托盘/12-UI-SPEC.md
