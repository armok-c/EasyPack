---
phase: 23-env-tabs-management
plan: 03
type: execute
subsystem: UI-Env
tags: [env-tab-bar, env-switch-bar, manage-env-dialog, mainarea-integration]
dependency_graph:
  requires: [23-01, 23-02]
  provides: []
  affects: [MainArea, App, useProject]
tech-stack:
  added: []
  patterns: [inline-rename-dialog, alertdialog-delete-confirmation, select-with-placeholder-fallback]
key-files:
  modified:
    - src/components/MainArea.tsx
    - src/App.tsx
    - src/index.css (added scrollbar-none utility)
  created:
    - src/components/EnvTabBar.tsx
    - src/components/EnvSwitchBar.tsx
    - src/components/ManageEnvDialog.tsx
    - src/components/ui/alert-dialog.tsx
    - src/components/ui/table.tsx
decisions:
  - D-14: Tab selected state independent from active/applied env
  - D-15: CSS overflow-x: auto with scrollbar-none for tab scrolling
  - D-16: Manage env button sticky-right in tab bar
  - D-17: Zero env shows centered empty state with manage button
  - D-18: Delete env auto-switches to nearest neighbor tab
  - D-19: File area is dashed placeholder in Phase 23
  - D-20: Environment names must be unique per project
  - D-21: Cannot delete applied env (confirm button disabled)
  - D-22: Delete AlertDialog shows extra warning for applied env
  - D-23: Layout order: project info / switch bar / tab bar / open folder / cards
  - D-24: Select defaults to activeEnvId or placeholder
  - D-25: Same env selected disables apply button
metrics:
  duration: pending
  completed_date: pending
  commits: 3
---

# Phase 23 Plan 03: Environment UI Components — Summary

创建环境标签页栏、环境切换栏和管理环境模态窗三个 UI 组件，集成到 MainArea 和 App.tsx 中。

## What was built

三个新组件和一个重新布局的 MainArea：

### 1. EnvTabBar (`src/components/EnvTabBar.tsx`)
- 横向可滚动标签页栏（overflow-x: auto + scrollbar-none），`shrink-0` 固定宽度标签
- 标签选中态样式（bg-accent 高亮），绿色圆点标记已应用环境（D-14）
- 「管理环境」按钮 sticky right-0，始终可见（D-16）
- 零环境时显示居中引导空状态：「暂无环境」+ 管理环境按钮（D-17）
- 文件占位区域：虚线边框，提示「文件管理功能将在后续版本中提供」（D-19）

### 2. EnvSwitchBar (`src/components/EnvSwitchBar.tsx`)
- shadcn Select 下拉框：默认显示 activeEnvId 或占位文字「选择环境」（D-24）
- 「启用」按钮：环境相同时禁用（D-25），loading 状态
- 无环境时 Select 和 Button 均禁用

### 3. ManageEnvDialog (`src/components/ManageEnvDialog.tsx`)
- Dialog 标题「管理环境」
- 顶部：Input + 「新增」按钮（D-20 重名检测，回车键支持）
- 四列表格：名称（绿色圆点标记已应用）、创建时间、修改时间、操作
- 重命名：点击弹出独立 Dialog 输入框，验证重名
- 删除：AlertDialog 二次确认（D-21/D-22），已应用环境禁用确认按钮并显示额外警告
- 所有操作使用 sonner toast 反馈

### 4. MainArea 布局更新
- 新布局顺序（D-23）：项目信息 → 环境切换栏 → 标签页行+管理按钮 → 打开文件夹行 → 指令卡片网格
- 内部状态：selectedEnvId（独立于 activeEnvId）、manageEnvOpen、applyingEnv
- handleDeleteEnv：删除后自动切换到最近邻环境（D-18）
- handleApplyEnv：loading 状态包裹器
- useEffect：envs 变化时自动选择第一个环境（D-14）
- ManageEnvDialog 挂载在 MainArea 内部

### 5. App.tsx 更新
- 从 useProject 解构 env 方法（projectEnvsMap, projectActiveEnvMap, createEnv, renameEnv, deleteEnv, setActiveEnv, applyEnv, getProjectEnvs, getProjectActiveEnv）
- useMemo 推导 envList 和 activeEnvIdDerived
- 4 个包装处理器传递到 MainArea

### 6. 缺失 UI 组件补充
- AlertDialog（radix-ui/react-alert-dialog）— 删除确认
- Table（HTML table 封装）— 环境列表
- scrollbar-none CSS utility — 标签页滚动条隐藏

## Commit History

| Commit | Message |
|--------|---------|
| `b427b72` | feat(23-03): create EnvTabBar and EnvSwitchBar components |
| `efda334` | feat(23-03): create ManageEnvDialog component |
| `27e54a8` | feat(23-03): integrate env components into MainArea and App.tsx |

## Deviations from Plan

### Rule 3 — Missing AlertDialog and Table shadcn components

**Found during:** Task 1 execution
**Issue:** `AlertDialog` and `Table` shadcn UI components were not installed. The plan references `shadcn/ui AlertDialog` and `shadcn/ui Table`, but only `dialog.tsx`, `select.tsx`, `button.tsx`, `input.tsx`, and `scroll-area.tsx` existed.
**Fix:** Created `src/components/ui/alert-dialog.tsx` (using `radix-ui` react-alert-dialog primitive) and `src/components/ui/table.tsx` (plain HTML table with Tailwind styling matching shadcn pattern). Added `scrollbar-none` utility to `index.css`.
**Files modified:** `src/components/ui/alert-dialog.tsx` (new), `src/components/ui/table.tsx` (new), `src/index.css`

## Threat Flags

None — all new components are UI-only. The T-23-07 (applied env delete blocked) and T-23-08 (same env apply disabled) mitigations are implemented in ManageEnvDialog and EnvSwitchBar respectively.

## Verification

- `npx tsc --noEmit` — PASS (no errors)
- 3 new components created and exported (EnvTabBar, EnvSwitchBar, ManageEnvDialog)
- All 5 env props passed through MainAreaProps
- App.tsx correctly derives env state and passes wrapper handlers
- Layout order matches D-23 specification
- Zero-env backward compatibility: empty env array shows empty state

## Self-Check: PASSED

- [x] EnvTabBar: horizontal scroll, sticky manage button, zero-env state, green dot, file placeholder
- [x] EnvSwitchBar: Select dropdown + apply button, disabled when same env, loading state
- [x] ManageEnvDialog: create/rename/delete env, name uniqueness, AlertDialog confirmation, applied env protection
- [x] MainArea layout per D-23 order
- [x] App.tsx derives envList/activeEnvId and passes wrapper handlers
- [x] TypeScript compilation passes
- [x] Backward compatible: empty env data shows zero-env empty state
