---
phase: 22-global-command-removal
plan: 02
type: execute
subsystem: useProject.ts
tags: [refactor, core-logic, commandMode-removal, customCommands-removal, CRUD-simplification]
dependency_graph:
  requires: [22-01]
  provides: [22-03, 22-04, 22-05]
  affects: [MainArea, FloatApp, useTray, useShortcutActions]
tech-stack:
  added: []
  patterns: [immutable-state-updates, useMemo-derived-state]
key-files:
  modified:
    - src/hooks/useProject.ts (948 lines, -149 from ~1097)
    - src/hooks/__tests__/useProject.test.tsx (590 lines)
  created: []
decisions:
  - D-10: commandMode state fully removed from useProject
  - D-11: customCommands state fully removed from useProject
  - D-14: CRUD operations have no global branch
  - D-15: enableProjectCommands simplified, disableProjectCommands removed
metrics:
  duration: 521s (8m 41s)
  completed_date: "2026-06-17T17:51:00+08:00"
  commits: 3
  tests_passed: 24/24
references:
  - PLAN: 22-02-PLAN.md
  - CONTEXT: 22-CONTEXT.md
---

# Phase 22 Plan 02: Core Logic Refactor — Summary

从 useProject.ts 中完全移除 `commandMode`、`customCommands` 状态和所有全局指令相关的 CRUD 分支。简化 `commands` 派生逻辑、`enableProjectCommands` 以及 `assignShortcut`/`clearShortcut`。同步更新测试用例。

## Commit History

| Commit | Message |
|--------|---------|
| `18f24dc` | test(22-02): add failing tests for useProject core logic refactor |
| `ee81b1c` | feat(22-02): remove commandMode, customCommands from useProject.ts |
| `b9dd0d2` | test(22-02): update useProject tests for simplified API |

## Task Results

### Task 1: useProject.ts — 核心逻辑重构 (TDD)

**状态:** 完成

**RED 阶段** (commit `18f24dc`): 添加 6 个 RED 测试，验证新契约：
- commandMode 不再返回
- customCommands 不再返回
- disableProjectCommands 不再返回
- addCommand 接受 (name, command, icon?, extra?) 无 scope 参数
- commands 仅从 projectCommandsMap 派生
- enableProjectCommands 不初始化默认预设

**GREEN 阶段** (commit `ee81b1c`): 实现所有变更（见详细重构清单）

**重构清单:**
1. 移除 `customCommands` state declaration
2. 移除 `commandMode` state declaration
3. 简化 `commands` useMemo — 仅派生自 projectCommandsMap，无 global 分支
4. 删除 auto-detect commandMode useEffect
5. 从 loadProfileDataIntoState 移除 CUSTOM_COMMANDS_KEY 读取
6. 从 migrateToProfiles 移除 CUSTOM_COMMANDS_KEY 引用
7. 简化 addCommand — 无 scope 参数，无 global 分支
8. 简化 updateCommand — 无 global 分支
9. 简化 deleteCommand — 无 global 分支，无 auto-revert to global
10. 简化 enableProjectCommands — 不调用 getDefaultsAsCommandItems()
11. 移除 disableProjectCommands
12. 简化 selectProject — 移除 setCommandMode
13. 简化 switchProfile — 移除 setCommandMode
14. 简化 assignShortcut — 仅操作 projectCommandsMap
15. 简化 clearShortcut — 仅操作 projectCommandsMap
16. 更新 return 语句 — 移除 commandMode/customCommands/disableProjectCommands
17. 移除 getDefaultsAsCommandItems 导入

**文件变化:** 92 行插入, 240 行删除 (净减 148 行)
**最终大小:** 948 行 (目标 950)

### Task 2: useProject.test.tsx — 更新测试用例 (TDD)

**状态:** 完成

- 移除所有 commandMode / customCommands / disableProjectCommands 断言
- 更新 enableProjectCommands 测试 — 验证空数组初始化
- 更新 addCommand 测试 — 无 scope 参数，无预设自动初始化
- 更新 deleteCommand 测试 — 无 auto-revert to global mode
- 删除 initializes customCommands 测试 → 替换为 projectCommands 测试
- 删除 disableProjectCommands 测试
- 更新 commands 派生测试 — 仅 projectCommandsMap

**测试结果:** 24/24 通过

## Deviations from Plan

### Rule 3 — Worktree path issue

**发现于:** Task 1 执行期间
**问题:** Git worktree 模式下，编辑工具使用的绝对路径 `E:\git\EasyPack\src\...` 解析到主仓库文件，而非工作树文件。测试运行器读取工作树文件。
**修复:** 将编辑后的文件从主仓库复制到工作树路径。工作树文件需通过 `.claude/worktrees/<id>/` 路径访问。
**影响:** 无功能影响，但后续在 worktree 中执行时需注意路径解析。
**文件:** - (工作流问题, 非代码变更)

## Verification

- `npx tsc --noEmit` — 通过 (无错误)
- `npx vitest run src/hooks/__tests__/useProject.test.tsx` — 24/24 通过

## Files Modified

| File | Description |
|------|-------------|
| `src/hooks/useProject.ts` | 核心逻辑重构 — 移除 commandMode/customCommands/disableProjectCommands |
| `src/hooks/__tests__/useProject.test.tsx` | 测试用例更新 — 匹配简化后的 API |

## Threat Flags

无新威胁面引入 — 所有变更均为内部状态移除和逻辑简化。export/import 中的 `CUSTOM_COMMANDS_KEY` 引用保留用于向后兼容。

## Self-Check: PASSED

- [x] useProject.ts 不返回 commandMode, customCommands, disableProjectCommands
- [x] addCommand 签名无 scope 参数
- [x] commands 派生仅包含 projectCommandsMap 中数据
- [x] enableProjectCommands 不调用 getDefaultsAsCommandItems()
- [x] 所有 24 个测试通过
- [x] TypeScript 编译通过
- [x] 每个任务独立提交
