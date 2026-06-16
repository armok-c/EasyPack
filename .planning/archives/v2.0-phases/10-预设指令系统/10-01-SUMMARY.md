---
phase: 10-预设指令系统
plan: 01
subsystem: data-layer
tags: [presets, icons, shadcn-select, categorized-commands]
dependency_graph:
  requires: [types.ts CommandItem interface]
  provides: [PRESET_CATEGORIES, ALL_PRESETS, getDefaultsAsCommandItems, PresetCategory type, PresetCommand type, ICON_OPTIONS with Sparkles+CargoShip, Select component]
  affects: [src/hooks/useProject.ts, src/components/__tests__/MainArea.test.tsx, src/hooks/__tests__/useProject.test.tsx]
tech_stack:
  added: [shadcn/ui Select component, lucide-react Sparkles+CargoShip icons]
  patterns: [categorized preset library, string-based icon references]
key_files:
  created:
    - src/components/ui/select.tsx
  modified:
    - src/lib/presets.ts
    - src/lib/icons.ts
    - src/hooks/useProject.ts
    - src/hooks/__tests__/useProject.test.tsx
    - src/components/__tests__/MainArea.test.tsx
decisions:
  - D-06: 默认卡片精简为 2 个 (git pull + claude)，替代旧 4 个预设
  - preset IDs 从 `preset-{idx}` 改为语义化 `preset-git-pull` 格式
  - preset-claude ID 不在 ALL_PRESETS 中，只在 defaults 中使用
metrics:
  duration: 490s
  completed: "2026-04-26"
  tasks_completed: 2
  files_modified: 6
  tests_updated: 2
---

# Phase 10 Plan 01: 预设库数据层与 Select 组件 Summary

分类预设库数据层（4 分类 25 命令）和 shadcn Select 组件安装，默认卡片精简为 git pull + claude 两个

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | 安装 shadcn Select 组件 + 扩展 icons.ts | `498c54e` | src/components/ui/select.tsx, src/lib/icons.ts |
| 2 | 重写 presets.ts 为分类预设库 | `08d8c5e` | src/lib/presets.ts, src/hooks/useProject.ts, 2 test files |

## Changes Summary

### Task 1: Select 组件 + 图标扩展
- 安装 shadcn Select 组件到 `src/components/ui/select.tsx`（shadcn 错误地输出到 `@/` 目录，手动移动到 `src/components/ui/`）
- 在 `src/lib/icons.ts` 中添加 Sparkles 和 CargoShip 图标（10 -> 12 个图标）

### Task 2: 分类预设库重写
- 完全重写 `src/lib/presets.ts`：
  - 新增 `PresetCategory` 接口（id, label, icon）
  - 新增 `PresetCommand` 接口（id, name, command, icon, category）-- icon 改为 string
  - 导出 `PRESET_CATEGORIES`：4 分类（Git, NPM/Node, Python/Pip, Rust/Cargo）
  - 导出 `ALL_PRESETS`：25 个预设命令（git:8, npm:6, python:5, rust:6）
  - 导出 `getDefaultsAsCommandItems()`：返回 2 个默认 CommandItem（git pull + claude）
  - 删除旧的 `PRESET_COMMANDS`、`PRESET_ICON_NAMES`、`getPresetAsCommandItems()`
  - 不再从 lucide-react 直接导入图标组件
- 更新 `src/hooks/useProject.ts`：3 处引用从 `getPresetAsCommandItems` 改为 `getDefaultsAsCommandItems`
- 更新 `src/hooks/__tests__/useProject.test.tsx`：预设数量从 4 改为 2，命令名称断言更新
- 更新 `src/components/__tests__/MainArea.test.tsx`：预设 ID 和命令名称断言更新

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn Select 输出到错误路径**
- **Found during:** Task 1
- **Issue:** `npx shadcn@latest add select` 将文件创建在 `@/components/ui/select.tsx` 而非 `src/components/ui/select.tsx`
- **Fix:** 手动 `mv` 到正确路径，清理空的 `@/` 目录
- **Files modified:** src/components/ui/select.tsx
- **Commit:** 498c54e

**2. [Rule 2 - Missing Critical] 测试文件引用旧预设 ID 和旧函数名**
- **Found during:** Task 2 (per critical risk warning)
- **Issue:** MainArea.test.tsx 使用 `preset-0` 到 `preset-3` 旧 ID；useProject.test.tsx 断言 4 个预设而非 2 个
- **Fix:** 更新所有测试中的预设 ID、命令名称、数量断言
- **Files modified:** MainArea.test.tsx, useProject.test.tsx
- **Commit:** 08d8c5e

## Pre-existing Issues

- `src/components/__tests__/CommandDialog.test.tsx`：16 个测试在修改前就已全部失败（`Element type is invalid` 错误）。这是 shadcn 组件导入问题，与本次修改无关。记录在此供后续修复。

## Verification Results

- shadcn Select 组件文件存在且可导入
- icons.ts 包含 12 个图标（原 10 + Sparkles + CargoShip）
- presets.ts 导出 PRESET_CATEGORIES（4 分类）、ALL_PRESETS（25 命令）、getDefaultsAsCommandItems()（2 默认）
- useProject.ts 使用 getDefaultsAsCommandItems 替代旧函数
- TypeScript 编译零错误
- 79/79 测试通过（排除 pre-existing CommandDialog 失败）

## Self-Check: PASSED

- All 6 key files verified to exist on disk
- Both commits (498c54e, 08d8c5e) verified in git log
- SUMMARY.md file itself exists at correct path
