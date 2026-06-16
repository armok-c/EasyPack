---
status: fixed
phase: 20
depth: standard
date: 2026-06-05
files_reviewed: 13
findings:
  critical: 2
  warning: 1
  info: 5
  total: 8
---

# Phase 20 Code Review (Round 2)

**Scope**: Phase 20 SUMMARY 文件 + 工作区未提交变更（13 files）
**Depth**: standard
**Date**: 2026-06-05

## Summary

上一轮审查标记 2 Critical + 6 Warning + 5 Info，声称全部 Critical/Warning 已修复并通过 `tsc --noEmit`。
本轮使用 `tsc -b`（项目引用模式）重新验证，发现上一轮的 `tsc --noEmit` 未使用 `-b` flag，遗漏了全部编译错误。

发现 **2 Critical**、**1 Warning**、**5 Info**。2 Critical + 1 Warning + 1 Info 已修复，`tsc -b` 在 Phase 20 范围内全部通过。

---

## Critical Findings

### C1: ScriptEditor `isSyncUpdate` 作用域错误 ✅ FIXED

**File**: `src/components/ScriptEditor.tsx:42,116,124`
**TS Error**: `TS2304: Cannot find name 'isSyncUpdate'`

`isSyncUpdate` ref 在 `useCodeMirror` 内部声明（line 42），但在 `ScriptEditor` 组件的 useEffect 中被引用（lines 116, 124）。两个函数是平级的模块级函数，`isSyncUpdate` 不在 `ScriptEditor` 的作用域内。

上一轮 W6 的修复不完整——`isSyncUpdate` 守卫虽然恢复了，但放在了错误的作用域。

**Fix Applied**: `useCodeMirror` 返回 `{ viewRef, isSyncUpdate }`，`ScriptEditor` 解构使用。

### C2: SettingsDialog `open` prop 遮蔽导入函数 ✅ FIXED

**File**: `src/components/SettingsDialog.tsx:12,48,95`
**TS Error**: `TS6133` + `TS2349: Type 'Boolean' has no call signatures`

组件 prop `open: boolean`（line 48 解构）遮蔽了 `import { open } from "@tauri-apps/plugin-dialog"`（line 12）。`handleImport` 中的 `open({...})`（line 95）实际调用的是 boolean prop，不是文件对话框函数。

**Fix Applied**: 导入重命名为 `import { open as openDialog, save as saveDialog }`，调用处同步更新。

---

## Warning Findings

### W1: shell.rs `shell_command` 未校验双引号字符 ✅ FIXED

**File**: `src-tauri/src/commands/shell.rs`

`project_path` 有 `contains('"')` 校验但 `shell_command` 没有。如果指令包含 `"`，cmd.exe 的引号配对会被破坏。

**Fix Applied**: 添加 `shell_command.contains('"')` 校验 + 对应单元测试。

---

## Info Findings

### I1: MainArea.tsx 未使用的解构 props ✅ FIXED

**File**: `src/components/MainArea.tsx:63-65`, `src/App.tsx:528-530`

`assignShortcut`、`clearShortcut`、`onRecordingChange` 在 Phase 18 快捷键面板集成后不再被 MainArea 使用。

**Fix Applied**: 从 MainAreaProps 接口和 App.tsx 传参中移除。

### I2: SettingsDialog 硬编码暗色主题颜色 — DEFERRED

**File**: `src/components/SettingsDialog.tsx`

`border-white/10`、`text-blue-300`、`bg-blue-500/20` 等仅适用于暗色模式。当前应用仅支持暗色模式，暂不影响功能。

### I3: Store.keys() 使用不安全类型转换 — DEFERRED

**File**: `src/hooks/useProject.ts:162,220,887`

`(s as unknown as { keys: () => Promise<string[]> })` 访问未文档化的 Store API。需等待 tauri-plugin-store 正式暴露此 API。

### I4: ProfileExportData.data 字段均为 unknown — DEFERRED

**File**: `src/lib/types.ts:46-53`

导出格式的 data 字段为 `unknown`。改为具体类型需要较大的类型重构，不适合在 review fix 中执行。

### I5: useProject.ts 超出 800 行指导原则 — DEFERRED

**File**: `src/hooks/useProject.ts` (1055 行)

需要拆分为多个 hook（如 useProfile、useShortcut 等），属于重构任务。

---

## Verification

- `tsc -b --noEmit`: Phase 20 文件 **全部通过**（剩余错误仅在 ShortcutPanel.tsx / useShortcutActions.ts，非 Phase 20 范围）
- `cargo check`: **通过**
- `cargo test test_execute_command_rejects_quoted_command`: **通过**
