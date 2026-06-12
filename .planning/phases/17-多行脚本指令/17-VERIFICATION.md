---
phase: 17-多行脚本指令
verified: 2026-05-15T14:30:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/10
  gaps_closed:
    - "点击多行指令卡片能调用 execute_script 执行脚本"
    - "多行脚本在指令卡片上显示为截断的多行文本"
    - "编辑含 scriptLines 的指令时自动选中多行 Tab 并加载内容"
  gaps_remaining: []
  regressions: []
---

# Phase 17: 多行脚本指令 Verification Report

**Phase Goal:** 用户可以编写和执行多行批处理脚本，使用完整的 Windows 批处理语法
**Verified:** 2026-05-15T14:30:00Z
**Status:** passed
**Re-verification:** Yes -- after gap closure (commit 1875ac5)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 用户可以在 CommandDialog 中通过 Tab 切换单行/多行编辑模式 | VERIFIED | CommandDialog.tsx activeTab 状态，Tab 按钮渲染 |
| 2 | 多行编辑器提供语法高亮和行号显示 | VERIFIED | ScriptEditor.tsx 使用 CM6 + lineNumbers() + batchSupport()；batch-lang.ts 实现 StreamLanguage tokenizer |
| 3 | 从单行切到多行时已输入的内容自动保留 | VERIFIED | CommandDialog.tsx handleTabChange 中 setScriptContent(command) |
| 4 | 系统智能检测批处理语法关键字，简单命令显示严格/宽松开关 | VERIFIED | CommandDialog.tsx useBatchDetect + 条件渲染 |
| 5 | 多行脚本在指令卡片上显示为截断的多行文本 | VERIFIED | MainArea.tsx 第 331 行 scriptLines={cmd.scriptLines} 传递至 CommandCard；CommandCard 正确渲染截断多行内容 |
| 6 | 点击多行指令卡片能调用 execute_script 执行脚本 | VERIFIED | MainArea.tsx 第 337 行 onClick={() => onExecute(cmd.command, cmd)} 传递完整 CommandItem；App.tsx 第 124-127 行 handleExecuteWithRecent 检测 cmdItem 并调用 executeScriptCommand |
| 7 | Rust 后端能创建临时 .bat 文件并在新终端窗口中执行 | VERIFIED | shell.rs execute_script 实现，10 个测试全部通过 |
| 8 | .bat 文件始终包含 chcp 65001 >nul 和 cd /d 工作目录 | VERIFIED | shell.rs header 格式，test_build_bat_content_strict 验证 |
| 9 | 简单多行命令用 && 或 & 连接，批处理脚本原样写入 | VERIFIED | shell.rs build_bat_content 三种模式，3 个测试覆盖 |
| 10 | 前端 CommandItem 类型向后兼容，旧数据无 scriptLines 字段时正常工作 | VERIFIED | types.ts scriptLines? 和 executionMode? 均为可选 |

**Score:** 10/10 truths verified

### Gap Closure Details

| Gap | Previous Status | Fix Evidence | Current Status |
|-----|----------------|--------------|----------------|
| 执行路径接线 | FAILED | MainArea.tsx 第 13 行 onExecute 类型接受 `(command: string, cmd?: CommandItem) => void`；第 337 行传递完整 cmd；App.tsx 第 124-127 行分发到 executeScriptCommand | RESOLVED |
| CommandCard scriptLines prop | FAILED | MainArea.tsx 第 331 行 `scriptLines={cmd.scriptLines}` | RESOLVED |
| updateCommand 类型签名 | PARTIAL | MainArea.tsx 第 20 行 updateCommand 类型包含 `scriptLines?` 和 `executionMode?` | RESOLVED |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/shell.rs` | execute_script + build_bat_content | VERIFIED | 287 行，execute_script command + 5 个新测试 |
| `src-tauri/Cargo.toml` | tempfile 依赖 | VERIFIED | tempfile = "3"，tokio dev-dep |
| `src/lib/types.ts` | CommandItem 扩展 | VERIFIED | scriptLines? + executionMode? |
| `src/lib/batch-lang.ts` | CM6 batch tokenizer | VERIFIED | StreamLanguage.define + HighlightStyle + batchSupport |
| `src/hooks/useBatchDetect.ts` | 批处理检测 hook | VERIFIED | useMemo 包装，3 个正则 |
| `src/components/ScriptEditor.tsx` | CM6 编辑器组件 | VERIFIED | useCodeMirror hook + StrictMode 处理 |
| `src/components/CommandDialog.tsx` | Tab 切换 UI | VERIFIED | activeTab + ScriptEditor + 检测 + 模式开关 |
| `src/components/CommandCard.tsx` | 多行截断显示 | VERIFIED | scriptLines prop 渲染，MainArea 正确传递 |
| `src/hooks/useProject.ts` | executeScriptCommand | VERIFIED | 函数已定义，App.tsx 正确调用 |
| `src-tauri/src/lib.rs` | execute_script 注册 | VERIFIED | invoke_handler 注册 |
| `src/components/MainArea.tsx` | 调用接线 | VERIFIED | onExecute 类型 + CommandCard props + updateCommand 类型均完整 |
| `src/App.tsx` | 执行分发 | VERIFIED | handleExecuteWithRecent 正确分发到 executeScriptCommand |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| lib.rs | commands::shell::execute_script | invoke_handler registration | WIRED | 已注册 |
| CommandDialog.tsx | ScriptEditor.tsx | Tab 切换条件渲染 | WIRED | import + 条件渲染 |
| ScriptEditor.tsx | batch-lang.ts | CM6 language extension import | WIRED | import batchSupport |
| useProject.ts | execute_script (Rust) | invoke call | WIRED | invoke("execute_script", ...) |
| useBatchDetect.ts | CommandDialog.tsx | 检测结果显示 | WIRED | import + 使用 |
| MainArea.tsx | executeScriptCommand | onClick -> onExecute -> handleExecuteWithRecent | WIRED | 传递完整 CommandItem，App 分发到 executeScriptCommand |
| MainArea.tsx | CommandCard scriptLines | prop 传递 | WIRED | scriptLines={cmd.scriptLines} |
| App.tsx | executeScriptCommand | handleExecuteWithRecent 分发 | WIRED | cmdItem 存在时调用 executeScriptCommand |
| MainArea.tsx | updateCommand scriptLines/executionMode | 类型签名 + 传递 | WIRED | 类型包含可选字段，handleDialogSubmit 传递 data |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CommandDialog.tsx | scriptContent | useState + ScriptEditor onChange | Yes (user input) | FLOWING |
| CommandDialog.tsx | executionMode | useState + toggle buttons | Yes (user selection) | FLOWING |
| useProject.ts addCommand | extra.scriptLines | CommandDialog onSubmit | Yes (passed through) | FLOWING |
| CommandCard.tsx | scriptLines prop | MainArea.tsx cmd mapping | Yes (cmd.scriptLines) | FLOWING |
| MainArea.tsx onClick | cmd.command + cmd (CommandItem) | onExecute callback | Yes (full CommandItem) | FLOWING |
| App.tsx handleExecuteWithRecent | cmdItem | MainArea onClick | Yes (dispatches to executeScriptCommand) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust build_bat_content strict mode | cargo test test_build_bat_content_strict | passed | PASS |
| Rust build_bat_content lenient mode | cargo test test_build_bat_content_lenient | passed | PASS |
| Rust build_bat_content batch verbatim | cargo test test_build_bat_content_batch_script | passed | PASS |
| Rust execute_script creates bat file | cargo test test_execute_script_creates_bat_file | passed | PASS |
| TypeScript compilation | npx tsc --noEmit | zero errors | PASS |
| batchLanguage export | grep batchLanguage batch-lang.ts | 2 matches | PASS |
| CM6 packages installed | pnpm ls codemirror | 6 packages listed | PASS |

### Probe Execution

Step 7c: SKIPPED (no probes defined for this phase)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCRIPT-01 | 17-02 | 多行脚本编辑和保存 | SATISFIED | CommandDialog Tab + ScriptEditor + addCommand/updateCommand 支持 |
| SCRIPT-02 | 17-01 | 批处理文件执行 | SATISFIED | shell.rs execute_script + tempfile + chcp 65001，测试通过 |
| SCRIPT-03 | 17-02 | 语法高亮 | SATISFIED | batch-lang.ts tokenizer + ScriptEditor CM6 + lineNumbers |
| SCRIPT-04 | 17-02 | 执行模式选择 | SATISFIED | CommandDialog 有严格/宽松开关，执行路径已接入 |
| SCRIPT-05 | 17-01 | 向后兼容 | SATISFIED | types.ts 可选字段，旧数据正常工作 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TBD/FIXME/XXX/placeholder markers found in phase files |

### Human Verification Required

All 4 human verification items passed (2026-06-12).

### Gaps Summary

Phase 17 所有 10 个 must-have truths 已验证通过。三个之前发现的间隙（执行路径接线、scriptLines prop 传递、updateCommand 类型签名）已在 commit 1875ac5 中全部修复：

1. **执行路径接线**：MainArea.tsx 现在传递完整 `CommandItem` 给 `onExecute`，App.tsx 的 `handleExecuteWithRecent` 检测到 `cmdItem` 后分发到 `executeScriptCommand`，多行脚本正确走 `execute_script` Rust 命令。
2. **scriptLines prop 传递**：MainArea.tsx 渲染 CommandCard 时传递 `scriptLines={cmd.scriptLines}`，多行内容在卡片上正确显示。
3. **updateCommand 类型签名**：MainArea.tsx 的 `updateCommand` prop 类型包含 `scriptLines?` 和 `executionMode?`，编辑多行指令后保存时字段不丢失。

---

_Verified: 2026-05-15T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
