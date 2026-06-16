---
phase: 17-多行脚本指令
plan: 02
subsystem: frontend-ui, codemirror, script-detection
tags: [codemirror-6, script-editor, tab-switch, batch-highlight, multi-line-display, script-execution]
dependency_graph:
  requires: [17-01]
  provides: [ScriptEditor component, batch-lang tokenizer, useBatchDetect hook, CommandDialog Tab UI, CommandCard multi-line display, executeScriptCommand]
  affects: [src/components/CommandDialog.tsx, src/components/CommandCard.tsx, src/hooks/useProject.ts]
tech_stack:
  added:
    - codemirror 6.0.2
    - "@codemirror/state 6.6.0"
    - "@codemirror/view 6.43.0"
    - "@codemirror/language 6.12.3"
    - "@codemirror/commands 6.10.3"
    - "@codemirror/theme-one-dark 6.1.3"
  patterns:
    - CM6 StreamLanguage custom tokenizer for Windows batch syntax
    - Custom useCodeMirror hook for React lifecycle management
    - Tab-based mode switching with content preservation
    - Memoized batch keyword detection via useMemo
key_files:
  created:
    - src/lib/batch-lang.ts
    - src/hooks/useBatchDetect.ts
    - src/components/ScriptEditor.tsx
  modified:
    - package.json
    - src/components/CommandDialog.tsx
    - src/components/CommandCard.tsx
    - src/hooks/useProject.ts
decisions:
  - Used raw CM6 packages with custom useCodeMirror hook instead of @uiw/react-codemirror wrapper (lighter, fully controlled)
  - StrictMode handled via useEffect cleanup calling view.destroy() and parentRef child-node guard
  - External value sync uses isExternalUpdate ref flag to prevent infinite onChange loops
  - ScriptEditor theme recreated on darkMode change via useEffect dependency
  - executeScriptCommand dispatches to execute_command (single-line) or execute_script (multi-line) based on scriptLines presence
  - addCommand/updateCommand extended with optional extra parameter for backward compatibility
metrics:
  duration: 8m
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 7
---

# Phase 17 Plan 02: Frontend UI for Multi-line Script Editing Summary

CodeMirror 6 编辑器集成 + Tab 切换 + 批处理语法检测 + 指令卡片多行显示 + 脚本执行路径，将 Plan 01 的后端能力完整暴露给用户。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CM6 deps + batch-lang.ts + useBatchDetect.ts + ScriptEditor.tsx | 13a7956 | package.json, src/lib/batch-lang.ts, src/hooks/useBatchDetect.ts, src/components/ScriptEditor.tsx |
| 2 | CommandDialog Tab switch + CommandCard multi-line + useProject executeScript | 1910af0 | src/components/CommandDialog.tsx, src/components/CommandCard.tsx, src/hooks/useProject.ts |

## Key Deliverables

### ScriptEditor Component (CM6)

自定义 `useCodeMirror` hook 管理 EditorView 生命周期，处理 React StrictMode 双重渲染（cleanup 中 destroy view + 创建前清除子节点）。外部 value 变更通过 dispatch transaction 同步，用 `isExternalUpdate` ref 防止 onChange 循环。

### batch-lang Tokenizer

`StreamLanguage.define()` 自定义 tokenizer，支持高亮：
- REM 注释、:: 注释（comment）
- @ 前缀（meta）
- :label 标签（labelName）
- %% 和 %VAR% 变量（variableName）
- "字符串"（string）
- 30+ batch 关键字（keyword）

### useBatchDetect Hook

`useMemo` 包装的正则匹配，检测 if/for/goto/call/set/setlocal/endlocal/shift 关键字、:label、REM 注释。返回 boolean 用于 UI 条件渲染。

### CommandDialog Tab 切换

- 单行/多行 Tab 按钮组（参考 scope selector 的 inline-flex 样式）
- 从单行切到多行时保留已输入内容（D-03）
- 预设选择器仅在单行 Tab 显示（D-04）
- 多行 Tab 使用 ScriptEditor 替代 Input，固定高度 270px
- 多行 Tab DialogContent 加宽到 sm:max-w-[560px]
- 检测为批处理脚本时显示提示文本，简单命令显示严格/宽松 Button pair

### CommandCard 多行显示

- 新增 `scriptLines` prop
- 有多行内容时在图标和名称下方显示截断文本（CSS line-clamp-3）
- title 属性优先显示 scriptLines 完整内容（hover tooltip）

### useProject 脚本执行路径

- 新增 `executeScriptCommand(cmd: CommandItem)`: 根据 scriptLines 存在与否分发到 execute_script 或 execute_command
- `addCommand` 新增 `extra` 参数支持 scriptLines 和 executionMode
- `updateCommand` 数据类型扩展支持 scriptLines 和 executionMode

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` -- zero errors (verified after each task)
- `grep "activeTab" CommandDialog.tsx` -- 16 matches (Tab state present)
- `grep "ScriptEditor" CommandDialog.tsx` -- 3 matches (editor integrated)
- `grep "useBatchDetect" CommandDialog.tsx` -- 2 matches (detection hook used)
- `grep "executeScriptCommand\|execute_script" useProject.ts` -- 4 matches (execution path)
- `grep "scriptLines" CommandCard.tsx` -- 5 matches (multi-line display)
- `grep "batchLanguage" batch-lang.ts` -- 2 matches (tokenizer exported)

## Self-Check: PASSED

All created/modified files verified present. All commits verified in git log.
