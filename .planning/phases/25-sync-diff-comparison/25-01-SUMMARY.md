---
phase: 25-sync-diff-comparison
plan: 01
subsystem: ui
tags: diff, git-diff-view, sync, environment, react, typescript
requires:
  - phase: 23-env-tabs-management
    provides: Environment/ManagedFile types, profileStore, env CRUD
  - phase: 24-file-management-editor
    provides: FileList component, onUpdateFile/addFiles/deleteFiles callbacks
provides:
  - Cross-environment file diff comparison with @git-diff-view/react
  - Hunk-level file content sync between environments
  - Missing file creation across environments
  - Undo/redo for hunk-level file changes
affects: []
tech-stack:
  added:
    - "@git-diff-view/react@0.1.5"
    - "@git-diff-view/file@0.1.5"
    - "diff@^9.0.0"
  patterns:
    - "Custom hunk action controls wrapping @git-diff-view/react DiffView"
    - "Per-pair (fileId::envId) resolved/undo state tracking with Record<string, Set<number>>"
key-files:
  created:
    - src/lib/diff-utils.ts
    - src/components/EnvSelectDialog.tsx
    - src/components/DiffViewDialog.tsx
    - src/components/ui/tabs.tsx
    - .planning/phases/25-sync-diff-comparison/25-01-PLAN.md
  modified:
    - src/components/FileList.tsx
    - src/components/MainArea.tsx
    - src/index.css
    - package.json
key-decisions:
  - "Hunk actions rendered as custom control bars above DiffView (not inline, since @git-diff-view/react doesn't expose hunk-level widget slots)"
  - "diff.structuredPatch() from the `diff` library for hunk line-range computation, separate from @git-diff-view/react DiffFile for visual rendering"
  - "Undo snapshots stored per (fileId, envId, hunkIndex) triple in state for granular rollback"
  - "Missing file creation uses onAddFiles callback, undo uses onDeleteFiles"
requirements-completed:
  - ENV-05
duration: 35min
completed: 2026-06-18
---

# Phase 25 Plan 01: 同步差异对比 — Summary

**@git-diff-view/react 驱动的跨环境配置文件差异对比与同步功能，含逐块双向复制、缺失文件创建、撤销操作**

## Performance

- **Duration:** 35 min (est.)
- **Started:** 2026-06-18T07:30:00Z
- **Completed:** 2026-06-18T08:05:00Z
- **Tasks:** 6
- **Files created/modified:** 10

## Accomplishments

- FileList 工具栏插入「同步差异」按钮（GitCompare 图标 + primary 变体），未勾选文件时禁用 + tooltip
- EnvSelectDialog 多选环境弹窗，显示环境名、匹配/缺失文件数、全选复选框，按名称字母排序
- DiffViewDialog 差异对比模态窗：80% 视口、双层 Tab（文件 + 环境子 Tab）、Split/Unified 模式切换、DiffView 组件集成
- 逐块操作控制：每个 hunk 显示「← 使用源」/「使用目标 →」/「撤销」按钮，已解决块绿色背景标记
- 缺失文件创建流程：FileX 图标 + 「创建此文件」按钮 + 撤销功能
- 底部状态栏显示已解决/未解决计数，全部解决时显示「全部已解决」绿色 badge
- 所有变更立即通过 onUpdateFile/onAddFiles/onDeleteFiles 持久化到 profileStore

## Task Commits

各任务原子化提交：

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | 安装 @git-diff-view/react 依赖 | `a8ce935` | chore |
| 2 | 创建 diff-utils.ts 工具模块 | `9a255e7` | feat |
| 3 | 创建 EnvSelectDialog 组件 | `a0c21be` | feat |
| 4 | 创建 DiffViewDialog 主模态窗 | `3baeda9` | feat |
| 5 | FileList 工具栏插入同步差异按钮 | `3e805ce` | feat |
| 6 | MainArea 集成同步差异流程 | `ba218e7` | feat |

**额外提交：**
- `9b9657a` — chore: 添加 diff 包为直接依赖
- `1aa899f` — chore: 添加 shadcn/ui Tabs 组件
- `32577d6` — docs: 创建 25-01-PLAN.md

## Files Created/Modified

### 新增文件
- `src/lib/diff-utils.ts` — 差异数据预处理工具（generateDiffFile 封装、文件扩展→语言 ID 映射、匹配/缺失计数）
- `src/components/EnvSelectDialog.tsx` — 环境选择多选弹窗（204 行，Dialog + Checkbox + 匹配/缺失信息 + 全选）
- `src/components/DiffViewDialog.tsx` — 差异对比主模态窗（811 行，DiffView + 双层 Tab + hunk 操作 + 缺失文件处理 + 状态栏）
- `src/components/ui/tabs.tsx` — shadcn/ui Tabs 组件

### 修改文件
- `src/components/FileList.tsx` — 工具栏插入「同步差异」按钮，新增 `onSyncDiff` prop
- `src/components/MainArea.tsx` — 新增 sync diff 状态管理、EnvSelectDialog/DiffViewDialog 集成
- `src/index.css` — 导入 `@git-diff-view/react/styles/diff-view.css`
- `package.json` — 新增 `@git-diff-view/react@0.1.5`、`@git-diff-view/file@0.1.5`、`diff@^9.0.0`

## Decisions Made

- **Tabs 组件手动创建而非 npx shadcn**: shadcn CLI 尝试调用 pnpm（未安装），手动创建同构 tabs.tsx 使用 radix-ui 原始包，样式与项目中其他 shadcn 组件一致
- **diff 库直接依赖**: `diff.structuredPatch()` 用于 hunk 行范围计算，与 `@git-diff-view/file` 的 `generateDiffFile` 独立分工（前者算逻辑 hunk，后者生成视觉 DiffFile）
- **Hunk 按钮放在 DiffView 上方而非内联**: @git-diff-view/react v0.1.5 不提供 hunk 级别的小部件插槽，自定义控制条作为独立组件渲染在 DiffView 之上

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 缺少 shadcn/ui Tabs 组件**
- **发现于:** Task 4 (DiffViewDialog 创建)
- **问题:** DiffViewDialog 使用 `<Tabs>` 组件但 src/components/ui/tabs.tsx 不存在
- **修复:** 手动创建 tabs.tsx（与项目中其他 shadcn 组件风格一致，使用 radix-ui 原始包）
- **文件:** src/components/ui/tabs.tsx
- **验证:** tsc --noEmit 通过
- **提交于:** 1aa899f（单独提交）

**2. [Rule 3 - Blocking] 缺少 `diff` 包的直接依赖**
- **发现于:** Task 4 (DiffViewDialog 创建)
- **问题:** 从 `diff` 包直接 `import { structuredPatch }`，但该包仅作为 @git-diff-view/file 的传递依赖
- **修复:** 安装 `diff@^9.0.0` 为直接依赖
- **文件:** package.json
- **验证:** tsc --noEmit 通过，structuredPatch 函数正确导出
- **提交于:** 9b9657a（单独提交）

**3. [Rule 3 - Blocking] pnpm 不可用，使用 npm 安装依赖**
- **发现于:** Task 1 (安装依赖)
- **问题:** `pnpm` 未在 PATH 上，corepack enable 因权限失败
- **修复:** 使用 `npm install` 替代 pnpm
- **影响:** package-lock.json 由 npm 管理（非 pnpm），功能无影响
- **提交于:** a8ce935（Task 1 提交）

---

**总偏差数:** 3 个自动修复（全部 Rule 3 - Blocking）
**对计划的影响:** 所有修复均为必要修正，无范围蔓延。

## Issues Encountered

- `@git-diff-view/react` 的正确 API 用法通过运行时检查确认，类型定义与实际导出匹配
- Tabs 组件的嵌套结构在当前设计中使用独立的状态变量（activeFileName + activeEnvId）而非 TabsContent 包裹，功能正常但可考虑后续重构为标准嵌套 Tabs 模式

## Known Stubs

None — 所有新组件功能完整，无占位符或空数据源。

## Threat Flags

None — 所有新文件均为客户端 UI 组件，无新增网络安全端点、文件访问模式或信任边界变更。

## Next Phase Readiness

- ENV-05（同步差异对比）完成，v2.1 里程碑所有需求已完成
- 后续可基于此差异对比框架扩展：批量文件同步、计划任务同步、差异对比历史查看

---
*Phase: 25-sync-diff-comparison*
*Completed: 2026-06-18*
