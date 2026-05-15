---
phase: 18-快捷键设置面板
plan: 01
subsystem: 快捷键类型系统
tags: [shortcut, types, hooks, migration, refactor]
dependency_graph:
  requires: [Phase 11 快捷键基础, Phase 17 多行脚本]
  provides: [ShortcutAction 类型, useShortcutActions hook, shortcutBindings 持久化, 简化 CommandCard/MainArea]
  affects: [useGlobalShortcuts, useProject, App, CommandCard, MainArea]
tech_stack:
  added: []
  patterns: [ShortcutAction 统一类型, ref 模式防闭包过期, 独立 store key 持久化, 一次性数据迁移]
key_files:
  created:
    - src/hooks/useShortcutActions.ts
    - src/hooks/__tests__/useShortcutActions.test.ts
    - src/lib/__tests__/shortcutConflict.test.ts
  modified:
    - src/lib/types.ts
    - src/lib/shortcutUtils.ts
    - src/hooks/useGlobalShortcuts.ts
    - src/hooks/useProject.ts
    - src/App.tsx
    - src/components/CommandCard.tsx
    - src/components/MainArea.tsx
    - src/hooks/__tests__/useGlobalShortcuts.test.ts
decisions:
  - ShortcutAction handler 使用 ref 模式避免闭包过期（RESEARCH Pitfall 4）
  - useGlobalShortcuts 从 actions + bindings 驱动，不再依赖 CommandItem
  - shortcutBindings 使用独立 store key，迁移旧 presetShortcutsMap 和 CommandItem.shortcut
  - 旧 assignShortcut/clearShortcut 函数保留以兼容过渡期
metrics:
  duration: 9m20s
  completed: "2026-05-15"
  tasks: 3
  files: 9
  tests_added: 25
---

# Phase 18 Plan 01: 后端数据模型与快捷键注册扩展 Summary

ShortcutAction 统一类型系统覆盖 command/window/project 三类操作，useShortcutActions hook 构建操作注册表，useGlobalShortcuts 从 actions+bindings 驱动 OS 级注册，shortcutBindings 独立持久化含旧数据一次性迁移，CommandCard/MainArea 中录制 UI 完全移除。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 0 | 单元测试骨架 | `136a0c4` | useShortcutActions.test.ts, shortcutConflict.test.ts |
| 1 | 类型系统 + Hook + 扩展 + 迁移 | `1171dad` | types.ts, useShortcutActions.ts, useGlobalShortcuts.ts, useProject.ts, App.tsx, shortcutUtils.ts |
| 2 | 移除 CommandCard 录制 UI + 简化 MainArea | `a65db61` | CommandCard.tsx, MainArea.tsx |

## Verification Results

- TypeScript 编译: 零错误 (`npx tsc --noEmit`)
- 新增测试: 25 个全部通过
  - useShortcutActions: 5 tests (command/window/project actions + handlers)
  - shortcutConflict: 5 tests (empty bindings, no conflict, conflict, self-exclude, multiple)
  - useGlobalShortcuts: 6 tests (register, disabled, unmount, Pressed state, re-register, partial binding)
  - shortcutUtils: 9 tests (existing, unchanged)

## Key Changes

### types.ts
- 新增 `ShortcutCategory` type union: `"command" | "window" | "project"`
- 新增 `ShortcutAction` interface: `{ id, label, category, handler }`

### useShortcutActions.ts (新建)
- 接受 commands 列表 + 6 个 handler 回调
- 使用 ref 模式避免 handler 闭包过期
- 返回 ShortcutAction[] 包含动态指令 + 2 个窗口操作 + 3 个项目操作

### useGlobalShortcuts.ts
- 接口从 `commands: CommandItem[]` 改为 `actions: ShortcutAction[] + bindings: Record<string, string>`
- 只注册当前 actions 中有 bindings[action.id] 的项
- Handler 通过 actionsMapRef 调用，避免闭包过期

### useProject.ts
- 新增 `SHORTCUT_BINDINGS_KEY = "shortcutBindings"` 常量
- 新增 `shortcutBindings` state 和 `setShortcutBinding` / `clearShortcutBinding` / `resetAllShortcuts` 函数
- 启动时加载 shortcutBindings，如不存在则从旧 CommandItem.shortcut 和 presetShortcutsMap 迁移
- `setShortcutBinding` 使用 `findConflict` 进行全范围冲突检测

### shortcutUtils.ts
- 新增 `findConflict(bindings, excludeActionId, newShortcut)` 纯函数

### App.tsx
- 引入 useShortcutActions 构建 actions 注册表
- 传递 window/project 操作 handler（toggleVisibility, toggleFloat, prevProject, nextProject, openFolder）
- useGlobalShortcuts 从 actions + shortcutBindings 驱动

### CommandCard.tsx
- 移除 6 个录制相关 props（isRecording, onRecordingStart, onRecordingStop, onShortcutAssign, onShortcutClear, hasConflict）
- 移除 keydown 录制 useEffect 和 toast import
- Shortcut badge 变为纯静态显示

### MainArea.tsx
- 移除 recordingCommandId / conflictCommandId state
- 移除 4 个录制 callback（handleRecordingStart/Stop/ShortcutAssign/ShortcutClear）
- 移除 2 个同步 useEffect
- CommandCard 渲染只传 shortcut + shortcutNumber

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Line/Pattern | Reason |
|------|-------------|--------|
| App.tsx | assignShortcut/clearShortcut 传递给 MainArea | 保留以兼容过渡期，Plan 02 面板将使用新的 setShortcutBinding |

## Self-Check: PASSED

- [x] src/hooks/useShortcutActions.ts exists
- [x] src/hooks/__tests__/useShortcutActions.test.ts exists
- [x] src/lib/__tests__/shortcutConflict.test.ts exists
- [x] Commit 136a0c4 exists
- [x] Commit 1171dad exists
- [x] Commit a65db61 exists
- [x] TypeScript compiles without errors
- [x] All 25 related tests pass
