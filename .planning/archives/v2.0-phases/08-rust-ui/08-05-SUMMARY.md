---
phase: 08-rust-ui
plan: 05
subsystem: frontend
tags: [project-info, folder-size, git-branch, useProject-hook, MainArea]
dependency_graph:
  requires: [08-01]
  provides: [project-info-fetch, project-info-display]
  affects: [useProject, MainArea, App]
tech_stack:
  added: [ProjectInfoResult interface, Promise.race timeout pattern]
  patterns: [async-fetch-with-timeout, error-flag-state]
key_files:
  created: []
  modified:
    - src/hooks/useProject.ts
    - src/components/MainArea.tsx
    - src/App.tsx
decisions:
  - D-06: 前端 Promise.race 8秒超时，reject 而非 resolve，统一超时和 invoke 错误到 catch 分支
  - 使用独立 boolean error 标志区分三种状态（加载中/成功/失败），不在数据中混入错误字符串
metrics:
  duration: 216s
  completed: "2026-04-25"
  tasks: 2
  files: 3
  commits: 2
---

# Phase 08 Plan 05: 项目信息显示 Summary

**One-liner:** 选中项目后信息栏展示文件夹大小（排除 node_modules/.git）和 Git 分支，前端 8 秒超时保护，独立错误标志区分加载/成功/失败三态。

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | 在 useProject hook 中添加项目信息获取逻辑 | 3fa11bf | src/hooks/useProject.ts |
| 2 | 修改 App.tsx 传递 props 并在 MainArea 信息栏显示 | bde038a | src/App.tsx, src/components/MainArea.tsx |

## Changes Summary

### Task 1: useProject hook 项目信息获取

- 新增 `ProjectInfoResult` 接口，定义 `size: string` 和 `branch: string | null`
- 新增 `projectInfo`、`projectInfoLoading`、`projectInfoError` 三个状态
- 新增 `fetchProjectInfo` 函数，使用 `Promise.race` 实现 8 秒超时保护
- 超时 Promise 使用 `reject`（非 resolve），确保超时和 invoke 错误统一走 catch 分支
- `selectProject` 切换项目时自动触发 `fetchProjectInfo`
- 初始化时如果有已保存的 selectedId，也触发对应项目的 fetchProjectInfo
- 所有新增状态通过 return 对象导出

### Task 2: MainArea 信息栏显示

- `App.tsx` 从 useProject 解构 `projectInfo`、`projectInfoLoading`、`projectInfoError` 并传递给 MainArea
- `MainAreaProps` 接口扩展了三个 project info 字段
- 信息栏在 path 行下方显示：
  - 加载中: "计算中..."
  - 错误: "无法计算"（由独立 `projectInfoError` 标志触发）
  - 成功: 文件夹大小（如 "12.3 MB"）
  - Git 分支: "分支: {name}"，非 Git 项目不显示
  - 分隔符: "·"
- `aria-live="polite"` 用于无障碍状态更新

## Decisions Made

1. **超时 Promise 使用 reject**: 超时和 invoke 错误都走 catch 分支，无需额外区分超时类型，简化错误处理逻辑
2. **独立 boolean error 标志**: 使用 `projectInfoError: boolean` 而非在数据中混入错误字符串，UI 可明确区分三种状态
3. **8 秒超时**: 在 D-06 建议的 5-10 秒范围内取中间值，对大多数项目目录足够

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

- All 95 vitest tests passed (baseline and post-change)
- No test failures or regressions

## Self-Check

- [x] `src/hooks/useProject.ts` exists and contains `ProjectInfoResult` interface
- [x] `src/hooks/useProject.ts` contains `fetchProjectInfo` with `get_project_info` invoke
- [x] `src/hooks/useProject.ts` contains `projectInfoError` state
- [x] `src/components/MainArea.tsx` contains `projectInfo` in props
- [x] `src/components/MainArea.tsx` contains "分支:" text
- [x] `src/components/MainArea.tsx` contains "计算中..." text
- [x] `src/components/MainArea.tsx` contains "无法计算" text
- [x] `src/App.tsx` contains `projectInfo` prop passing to MainArea
- [x] Commits 3fa11bf and bde038a exist in git log

## Self-Check: PASSED

All files and commits verified present.
