---
phase: 22-global-command-removal
verified: 2026-06-17T10:10:00Z
status: passed
score: 21/21 must-haves verified
overrides_applied: 0
gaps: []
---

# Phase 22: 全局指令移除与重构 Verification Report

**Phase Goal:** 移除全局指令系统，将项目指令栏目迁移至全局指令原位置并改名为"项目环境"
**Verified:** 2026-06-17T10:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `CommandItem.scope` 类型不再包含 `"global"` 值 | ✓ VERIFIED | `src/lib/types.ts:15` — `scope: "project"`，单值字面量类型 |
| 2 | 预设库中所有指令的 scope 为 `"project"` | ✓ VERIFIED | `src/lib/presets.ts:73,82` — `getDefaultsAsCommandItems()` 返回 `scope: "project" as const` |
| 3 | `getDefaultsAsCommandItems()` 不再预设 scope 为 global | ✓ VERIFIED | `src/lib/presets.ts:73,82` — scope 值为 "project" |
| 4 | 启动时旧 CUSTOM_COMMANDS_KEY 数据被检测并自动清除，用户看到一次性 toast 通知 | ✓ VERIFIED | `src/hooks/useProject.ts:329-336` — init() 中检测 `ps.get(CUSTOM_COMMANDS_KEY)`，非空则 delete + toast.info |
| 5 | useProject 不再返回 commandMode state | ✓ VERIFIED | `src/hooks/useProject.ts:880-947` — return 对象中无 commandMode；测试确认 (`useProject.test.tsx:76`) |
| 6 | useProject 不再返回 customCommands state | ✓ VERIFIED | `src/hooks/useProject.ts:880-947` — return 对象中无 customCommands；测试确认 (`useProject.test.tsx:81`) |
| 7 | commands 派生逻辑仅包含项目指令 (projectCommandsMap) | ✓ VERIFIED | `src/hooks/useProject.ts:95-108` — useMemo 仅引用 selectedId, projectCommandsMap, shortcutBindings |
| 8 | addCommand/updateCommand/deleteCommand 无 global 分支 | ✓ VERIFIED | `useProject.ts:487-578` — 三个函数均只操作 projectCommandsMap，无 scope 参数/global 分支 |
| 9 | enableProjectCommands 不调用 getDefaultsAsCommandItems() | ✓ VERIFIED | `useProject.ts:664-676` — 初始化空数组 `[]` 而非预设；测试验证 (`useProject.test.tsx:113-115`) |
| 10 | disableProjectCommands 已移除 | ✓ VERIFIED | `useProject.ts:664-676` — 函数不存在；测试确认 (`useProject.test.tsx:86`) |
| 11 | FloatApp 和 useTray 自动跟随 commands 派生变更 (D-09) | ✓ VERIFIED | `App.tsx:152,215` — FloatApp 和 useTray 接收 `commands` prop，React 自动处理派生更新 |
| 12 | MainArea 中没有 Toggle Group 切换按钮组 | ✓ VERIFIED | `MainArea.tsx:216-228` — 区域标签"项目环境"+打开文件夹按钮，无 radio group；测试确认 |
| 13 | MainArea 中标题标签从"项目指令"改为"项目环境" | ✓ VERIFIED | `MainArea.tsx:217` — `<span>项目环境</span>`；测试确认 (`MainArea.test.tsx:170`) |
| 14 | 指令网格第一个卡片是内置"终端"卡片，不可编辑/删除 | ✓ VERIFIED | `MainArea.tsx:238-245` — Terminal Card 在 commands.map 之前渲染，`editMode={false}` |
| 15 | 终端卡片点击后在项目目录打开 cmd.exe | ✓ VERIFIED | `MainArea.tsx:244` — `onClick={() => onExecute("cmd.exe")}`；测试确认 (`MainArea.test.tsx:159`) |
| 16 | CommandDialog 中没有 scope 选择器 | ✓ VERIFIED | `CommandDialog.tsx` — 纯表单，无 scope/selectedScope/commandMode 状态或 UI |
| 17 | App.tsx 不再传递 commandMode prop 到 MainArea | ✓ VERIFIED | `App.tsx:501-517` — MainArea JSX props 中无 commandMode 相关 |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/types.ts` | CommandItem.scope="project", 无 "global" | ✓ VERIFIED | 第15行: `scope: "project"` 单值，无 "global" 引用 |
| `src/lib/presets.ts` | scope="project", min_lines≥85 | ✓ VERIFIED | 87行，scope 值全为 "project" |
| `src/hooks/useProject.ts` | 启动清理逻辑 | ✓ VERIFIED | 329-336行 CUSTOM_COMMANDS_KEY 检测+删除+toast |
| `src/hooks/useProject.ts` | 无 commandMode/customCommands | ✓ VERIFIED | 948行，return 中无 commandMode/customCommands/disableProjectCommands |
| `src/hooks/useProject.ts` | addCommand 无 scope 参数 | ✓ VERIFIED | 第488行 `(name, command, icon?, extra?)` |
| `src/hooks/__tests__/useProject.test.tsx` | 更新后的测试 | ✓ VERIFIED | 590行，24/24 通过 |
| `src/components/MainArea.tsx` | 无 Toggle Group, 含终端卡片 | ✓ VERIFIED | 305行，标签"项目环境"，终端卡片在网格首位 |
| `src/components/CommandDialog.tsx` | 无 scope 选择器 | ✓ VERIFIED | 453行，纯表单，无 scope 相关 |
| `src/App.tsx` | 不传递 commandMode prop | ✓ VERIFIED | 561行，MainArea JSX 无 commandMode |
| `src/components/__tests__/MainArea.test.tsx` | 更新后的测试 | ✓ VERIFIED | 19/19 通过，包含终端卡片/标签测试 |
| `src/components/__tests__/CommandDialog.test.tsx` | 更新后的测试 | ✓ VERIFIED | 16/16 通过 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/lib/presets.ts` | `src/lib/types.ts` | `CommandItem` import | ✓ WIRED | presets.ts:1 `import type { CommandItem } from "./types"` |
| `src/hooks/useProject.ts` | profileStore | `CUSTOM_COMMANDS_KEY` get/delete | ✓ WIRED | useProject.ts:331 `ps.get(CUSTOM_COMMANDS_KEY)` → 333 `ps.delete(CUSTOM_COMMANDS_KEY)` |
| `useProject.ts commands useMemo` | `projectCommandsMap[selectedId]` | `projectCmds.map(injectBinding)` | ✓ WIRED | useProject.ts:96-108 直接引用 projectCommandsMap |
| `MainArea.tsx` → CommandCard | 终端卡片 + `commands.map` | `CommandCard` JSX | ✓ WIRED | MainArea.tsx:238-270 — 终端卡片 + commands.map 渲染 |
| `MainArea.tsx` 终端卡片 onClick | project `executeCommand` | `onExecute("cmd.exe")` | ✓ WIRED | MainArea.tsx:244 — 通过外部 prop 触发执行 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `MainArea.tsx` commands | `commands` (prop) | `useProject.ts` useMemo → `projectCommandsMap` → `loadProfileDataIntoState` → profileStore | ✓ YES — profileStore 读取持久化 projectCommands:* key | ✓ FLOWING |
| `MainArea.tsx` 终端卡片 | 内置 UI | 硬编码 `"cmd.exe"` | ✓ YES — 静态值，对应系统终端命令 | ✓ FLOWING |
| `CommandDialog.tsx` | `initialData` (prop) | 父组件传入 | ✓ YES — 来自 commands 数据 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript 编译通过 | `npx tsc --noEmit` | 0 errors | ✓ PASS |
| useProject 测试通过 | `npx vitest run src/hooks/__tests__/useProject.test.tsx` | 24/24 passed | ✓ PASS |
| MainArea 测试通过 | `npx vitest run src/components/__tests__/MainArea.test.tsx` | 19/19 passed | ✓ PASS |
| CommandDialog 测试通过 | `npx vitest run src/components/__tests__/CommandDialog.test.tsx` | 16/16 passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CMD-09 | 22-01, 22-02, 22-03 | 移除全局指令栏目 — 去掉 MainArea 中全局/项目切换按钮组、commandMode 状态、全局指令 CRUD 所有相关 UI 和逻辑，CommandItem.scope 移除 "global" 值 | ✓ SATISFIED | Toggle Group 已移除 (MainArea.tsx:228)；commandMode 已移除 (useProject.ts:880-947)；scope 类型为 "project" (types.ts:15)；测试全部通过 |
| CMD-10 | 22-01, 22-02, 22-03 | 项目指令替代全局指令 — 原项目指令栏目移至全局指令原位置，UI 标签改为"项目环境"，数据模型保留但仅支持项目级指令 | ✓ SATISFIED | 标签"项目环境" (MainArea.tsx:217)；数据模型 projectCommandsMap 保留；scope 仅 "project" (types.ts:15) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | 无 | — | 无 |

**说明:** 未在本次阶段修改的源文件中发现 TBD/FIXME/XXX 债务标记、stub 模式或硬编码空数据。`useShortcutActions.test.ts:14` 的 `scope: "global" as const` 是预存测试文件（未在此阶段修改），不影响任何生产代码且运行时通过 vitest 测试。

### Human Verification Required

无 — 所有验证可通过自动化检查完成。

### Gaps Summary

无 gap。Phase 22 的全部 must-haves（21/21）已通过验证。

---

_Verified: 2026-06-17T10:10:00Z_
_Verifier: Claude (gsd-verifier)_
