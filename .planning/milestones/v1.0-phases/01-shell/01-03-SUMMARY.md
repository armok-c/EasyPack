---
phase: 01-shell
plan: 03
subsystem: ui
tags: [tauri, react, typescript, tailwind, shadcn-ui, lucide-react, tauri-plugin-dialog, invoke]

# Dependency graph
requires:
  - phase: 01-shell/01
    provides: "UI scaffolding (App.tsx layout, CSS variables, shadcn/ui components)"
  - phase: 01-shell/02
    provides: "Rust execute_command with Windows Terminal fallback"
provides:
  - "完整用户流程: 选择项目 -> 显示命令卡片 -> 点击执行 -> 终端弹出"
  - "useProject hook (项目状态管理, 文件夹选择, 命令执行)"
  - "PRESET_COMMANDS 预设命令数据 (4 个内置命令)"
  - "CommandCard 组件 (hover/active/disabled 交互状态)"
  - "Sidebar 组件 (标题 + 添加按钮 + 项目名/空状态)"
  - "MainArea 组件 (引导页 / 项目信息 + 命令卡片网格)"
affects: [01-shell, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: ["@tauri-apps/plugin-dialog (already installed in Plan 01)"]
  patterns:
    - "useProject hook: 集中管理项目状态 + Tauri API 调用"
    - "PresetCommand 接口: name/command/icon 三元组"
    - "组件 props 模式: currentProject + onAction callback"

key-files:
  created:
    - src/hooks/useProject.ts
    - src/lib/presets.ts
    - src/components/CommandCard.tsx
    - src/components/Sidebar.tsx
    - src/components/MainArea.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "使用 Tailwind 标准间距值替代 UI-SPEC 自定义 token (p-6 替代 p-lg 等)"
  - "invoke 调用使用 camelCase 参数名 (projectPath, shellCommand)"
  - "路径提取使用 split(/[\\\\/]/).filter(Boolean).pop() 兼容正斜杠和反斜杠"

patterns-established:
  - "Hook 集中模式: useProject 管理所有 Tauri API 交互 (dialog + invoke)"
  - "组件分层: App -> Sidebar/MainArea -> CommandCard, props 单向传递"
  - "Toast 反馈模式: executeCommand 成功/失败均通过 sonner toast 反馈"

requirements-completed: [PROJ-01, UI-04, UI-06]

# Metrics
duration: 8min
completed: 2026-04-12
---

# Phase 1 Plan 3: 文件夹选择器与 Shell 命令执行集成 Summary

**集成 tauri-plugin-dialog 文件夹选择器、4 个预设命令卡片和 Rust execute_command，实现完整的选项目-执行命令用户流程**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-12T08:53:22Z
- **Completed:** 2026-04-12T09:01:44Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- 实现完整用户流程: 启动 -> 点击添加 -> 选择文件夹 -> 看到 4 个命令卡片 -> 点击执行 -> 终端弹出
- 创建 useProject hook 集中管理项目状态、文件夹选择 (tauri-plugin-dialog) 和命令执行 (invoke)
- 创建 4 个预设命令卡片 (打包项目、启动项目、Git Pull、启动 Claude) 带有 hover/active 动画效果
- 实现侧边栏空状态引导 ("还没有项目" + FolderOpen 图标) 和主区域引导页 ("选择一个项目开始")

## Task Commits

Each task was committed atomically:

1. **Task 1: 创建核心 hooks、预设命令数据和所有 UI 组件** - `a3f9fdb` (feat)

## Files Created/Modified
- `src/lib/presets.ts` - 4 个预设命令定义 (PresetCommand 接口 + PRESET_COMMANDS 数组)
- `src/hooks/useProject.ts` - 项目状态管理 hook (selectFolder, executeCommand, currentProject)
- `src/components/CommandCard.tsx` - 命令卡片组件 (图标 + 名称, hover/active/disabled 状态)
- `src/components/Sidebar.tsx` - 侧边栏组件 (EasyPack 标题 + 添加按钮 + 项目名/空状态)
- `src/components/MainArea.tsx` - 主区域组件 (引导页 / 项目信息 + 2x2 命令卡片网格)
- `src/App.tsx` - 更新为整合所有组件，通过 useProject hook 管理状态

## Decisions Made
- 使用 Tailwind 标准间距值 (p-6, gap-3, mb-4 等) 替代 UI-SPEC 的自定义 token (p-lg, gap-card-gap 等)，避免 Tailwind v4 的自定义 spacing 配置复杂性
- invoke 调用使用 camelCase 参数名 (projectPath, shellCommand)，匹配 Tauri 2 Rust 命令的 snake_case 自动转换规则
- 路径分隔符处理使用正则 `/[\\/]/` 兼容 Windows 反斜杠和 Unix 正斜杠

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript 类型检查、Vite 前端构建、Rust 后端测试均一次性通过。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 Shell 阶段全部 3 个计划已完成，EasyPack 核心功能可用
- 用户可以启动应用、选择项目文件夹、点击命令卡片在终端执行命令
- 后续阶段可扩展: 多项目管理 (Phase 2)、自定义指令 (Phase 3)、数据持久化

## Self-Check: PASSED

- All 6 source files exist (src/lib/presets.ts, src/hooks/useProject.ts, src/components/CommandCard.tsx, src/components/Sidebar.tsx, src/components/MainArea.tsx, src/App.tsx)
- SUMMARY.md exists at .planning/phases/01-shell/01-03-SUMMARY.md
- Commit a3f9fdb found in git log
- TypeScript type check passed
- Vite build passed (3.65s)
- Rust cargo test passed (4/4 tests)

---
*Phase: 01-shell*
*Completed: 2026-04-12*
