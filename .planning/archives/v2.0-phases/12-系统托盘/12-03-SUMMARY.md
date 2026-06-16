---
phase: 12-系统托盘
plan: 03
subsystem: system-tray
tags: [bugfix, gap-closure, stale-closure, ui-contrast, timing-safety]
dependency_graph:
  requires: [12-01, 12-02]
  provides: [TRAY-01-fixed, TRAY-03-fixed, TRAY-04-fixed, TRAY-07-fixed]
  affects: [src/hooks/useTray.ts, src/components/ui/switch.tsx, src/App.tsx]
tech_stack:
  added: []
  patterns: [ref-pattern-for-closure-fix, settingsLoaded-guard]
key_files:
  created: []
  modified:
    - src/hooks/useTray.ts
    - src/components/ui/switch.tsx
    - src/App.tsx
decisions:
  - buildMenu 从 ref 读取 currentProject/recentCommands 而非闭包变量
  - tray cleanup 先 null ref 再 async close 防止竞态
  - Switch unchecked 色用 muted-foreground/30+40 替代 bg-input
  - settingsLoaded 状态守卫确保 store 加载前关闭行为为 hide
metrics:
  duration: 7min
  completed: 2026-04-28
  tasks: 3/3
  files: 3
  tests_passed: 132
  tsc_clean: true
---

# Phase 12 Plan 03: Gap Closure Summary

修复 Phase 12 UAT 发现的 4 个差距，使系统托盘功能完整可用：闭包过期修复、关闭行为时序安全、Switch 视觉增强。

## Changes

### Task 1: 修复 useTray 闭包过期 + tray cleanup 异步问题

**文件:** `src/hooks/useTray.ts`

- 新增 `currentProjectRef` 和 `recentCommandsRef`，遵循已有的 ref 模式
- `buildMenu()` 内部全部改为从 ref 读取最新状态：`hasProject`、`hasCommands`、项目名、指令遍历、enabled 判断
- tray cleanup 逻辑改为先 `trayRef.current = null` 再 `tray.close()`，防止异步窗口期其他代码使用已关闭的 tray
- Effect 2 依赖数组保持不变，buildMenu 通过 ref 读取最新值

### Task 2: 增强 Switch unchecked 状态视觉区分

**文件:** `src/components/ui/switch.tsx`

- unchecked 背景色从 `bg-input` / `bg-input/80` 改为 `bg-muted-foreground/30` / `bg-muted-foreground/40`
- 在亮色和暗色主题下都与背景有明显视觉区分

### Task 3: 修复 closeToTray 加载时序安全问题

**文件:** `src/App.tsx`

- 新增 `settingsLoaded` 状态，`loadTraySettings` 完成后设为 `true`
- `onCloseBehavior` 在 `settingsLoaded=false` 时默认为 `"hide"`（安全默认值）
- `onCloseRequested` effect 在 `settingsLoaded=false` 时强制拦截（隐藏到托盘）
- 依赖数组加入 `settingsLoaded`

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | 0 errors |
| Vitest (132 tests) | 132 passed |
| `currentProjectRef` in useTray.ts | 5 occurrences (declare + assign + 3 uses) |
| `recentCommandsRef` in useTray.ts | 4 occurrences (declare + assign + 2 uses) |
| `bg-muted-foreground` in switch.tsx | Present (unchecked colors updated) |
| `settingsLoaded` in App.tsx | 4 occurrences (declare + set + 2 guards) |

## Commits

| Hash | Message |
|------|---------|
| `cd59281` | fix(12-03): fix useTray stale closure and tray cleanup race condition |
| `fab7696` | fix(12-03): enhance Switch unchecked state visual contrast |
| `c6c8ccd` | fix(12-03): add settingsLoaded guard for closeToTray timing safety |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

No new threat surface introduced. All changes are internal UI state management.

## Known Stubs

None.

## Self-Check: PASSED

All 3 modified files exist, all 3 commit hashes found in git log, SUMMARY.md created.
