---
phase: 17-多行脚本指令
verified: 2026-05-15T12:00:00Z
status: gaps_found
score: 7/10 must-haves verified
overrides_applied: 0
gaps:
  - truth: "点击多行指令卡片能调用 execute_script 执行脚本"
    status: failed
    reason: "executeScriptCommand 已在 useProject.ts 中定义并导出，但 MainArea.tsx 第 336 行 onClick 只调用 onExecute(cmd.command) 传递字符串，App.tsx 中 handleExecuteWithRecent 也只调用 executeCommand 而非 executeScriptCommand。多行脚本的 execute_script Rust 命令永远不会被前端触发。"
    artifacts:
      - path: "src/components/MainArea.tsx"
        issue: "第 336 行 onClick={() => onExecute(cmd.command)} 只传递字符串命令，不传递完整 CommandItem，无法区分单行/多行"
      - path: "src/App.tsx"
        issue: "第 123 行 handleExecuteWithRecent 调用 executeCommand(shellCommand) 而非 executeScriptCommand，多行执行路径断开"
      - path: "src/components/MainArea.tsx"
        issue: "第 13 行 onExecute 类型定义为 (command: string) => void，不接受 CommandItem"
    missing:
      - "MainArea.tsx 需要修改 onExecute 回调类型以支持传递完整 CommandItem 或增加独立回调"
      - "App.tsx 需要使用 executeScriptCommand 替代或补充 executeCommand 调用路径"
  - truth: "多行脚本在指令卡片上显示为截断的多行文本"
    status: failed
    reason: "CommandCard 组件已支持 scriptLines prop 并实现截断显示，但 MainArea.tsx 在渲染 CommandCard 时未传递 scriptLines prop，导致多行内容永远不会在卡片上显示。"
    artifacts:
      - path: "src/components/MainArea.tsx"
        issue: "第 326-346 行 CommandCard 渲染处缺少 scriptLines={cmd.scriptLines} prop"
    missing:
      - "MainArea.tsx CommandCard 渲染处需添加 scriptLines={cmd.scriptLines}"
  - truth: "编辑含 scriptLines 的指令时自动选中多行 Tab 并加载内容"
    status: partial
    reason: "CommandDialog 本身正确实现了初始化逻辑（hasInitialScript 时 activeTab 设为 multi），但 MainArea.tsx 的 updateCommand 类型签名可能未包含 scriptLines/executionMode 字段传递"
    artifacts:
      - path: "src/components/MainArea.tsx"
        issue: "第 20 行 updateCommand 类型签名只有 { name, command, icon }，缺少 scriptLines 和 executionMode"
    missing:
      - "MainArea.tsx updateCommand prop 类型需扩展以支持 scriptLines 和 executionMode 传递"
---

# Phase 17: 多行脚本指令 Verification Report

**Phase Goal:** 用户可以编写和执行多行批处理脚本，使用完整的 Windows 批处理语法
**Verified:** 2026-05-15T12:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 用户可以在 CommandDialog 中通过 Tab 切换单行/多行编辑模式 | VERIFIED | CommandDialog.tsx 第 57-59 行 activeTab 状态，第 206-245 行 Tab 按钮渲染 |
| 2 | 多行编辑器提供语法高亮和行号显示 | VERIFIED | ScriptEditor.tsx 使用 CM6 + lineNumbers() + batchSupport()；batch-lang.ts 实现 StreamLanguage tokenizer |
| 3 | 从单行切到多行时已输入的内容自动保留 | VERIFIED | CommandDialog.tsx 第 113-118 行 handleTabChange 中 setScriptContent(command) |
| 4 | 系统智能检测批处理语法关键字，简单命令显示严格/宽松开关 | VERIFIED | CommandDialog.tsx 第 81 行 useBatchDetect，第 393-443 行条件渲染 |
| 5 | 多行脚本在指令卡片上显示为截断的多行文本 | FAILED | CommandCard 支持 scriptLines prop，但 MainArea.tsx 未传递该 prop |
| 6 | 点击多行指令卡片能调用 execute_script 执行脚本 | FAILED | executeScriptCommand 已定义但未接入 MainArea/App 调用路径 |
| 7 | Rust 后端能创建临时 .bat 文件并在新终端窗口中执行 | VERIFIED | shell.rs 第 91-132 行 execute_script 实现，10 个测试全部通过 |
| 8 | .bat 文件始终包含 chcp 65001 >nul 和 cd /d 工作目录 | VERIFIED | shell.rs 第 59-62 行 header 格式，test_build_bat_content_strict 验证 |
| 9 | 简单多行命令用 && 或 & 连接，批处理脚本原样写入 | VERIFIED | shell.rs 第 53-83 行 build_bat_content 三种模式，3 个测试覆盖 |
| 10 | 前端 CommandItem 类型向后兼容，旧数据无 scriptLines 字段时正常工作 | VERIFIED | types.ts 第 18-19 行 scriptLines? 和 executionMode? 均为可选 |

**Score:** 7/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/shell.rs` | execute_script + build_bat_content | VERIFIED | 287 行，execute_script command + 5 个新测试 |
| `src-tauri/Cargo.toml` | tempfile 依赖 | VERIFIED | 第 28 行 tempfile = "3"，第 31 行 tokio dev-dep |
| `src/lib/types.ts` | CommandItem 扩展 | VERIFIED | 第 18-19 行 scriptLines? + executionMode? |
| `src/lib/batch-lang.ts` | CM6 batch tokenizer | VERIFIED | 131 行，StreamLanguage.define + HighlightStyle + batchSupport |
| `src/hooks/useBatchDetect.ts` | 批处理检测 hook | VERIFIED | 37 行，useMemo 包装，3 个正则 |
| `src/components/ScriptEditor.tsx` | CM6 编辑器组件 | VERIFIED | 137 行，useCodeMirror hook + StrictMode 处理 |
| `src/components/CommandDialog.tsx` | Tab 切换 UI | VERIFIED | 511 行，activeTab + ScriptEditor + 检测 + 模式开关 |
| `src/components/CommandCard.tsx` | 多行截断显示 | VERIFIED (code) / NOT WIRED | 支持 scriptLines prop，但 MainArea 未传递 |
| `src/hooks/useProject.ts` | executeScriptCommand | VERIFIED (code) / NOT WIRED | 函数已定义（第 284-311 行），但未被 App/MainArea 调用 |
| `src-tauri/src/lib.rs` | execute_script 注册 | VERIFIED | 第 25 行 commands::shell::execute_script |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| lib.rs | commands::shell::execute_script | invoke_handler registration | WIRED | 第 25 行已注册 |
| CommandDialog.tsx | ScriptEditor.tsx | Tab 切换条件渲染 | WIRED | 第 24 行 import，第 380-385 行渲染 |
| ScriptEditor.tsx | batch-lang.ts | CM6 language extension import | WIRED | 第 21 行 import batchSupport |
| useProject.ts | execute_script (Rust) | invoke call | WIRED | 第 291 行 invoke("execute_script", ...) |
| useBatchDetect.ts | CommandDialog.tsx | 检测结果显示 | WIRED | 第 25 行 import，第 81 行使用 |
| **MainArea.tsx** | **executeScriptCommand** | **onClick callback** | **NOT WIRED** | MainArea 调用 onExecute(cmd.command)，走旧路径 |
| **MainArea.tsx** | **CommandCard scriptLines** | **prop 传递** | **NOT WIRED** | 第 326-346 行未传递 scriptLines prop |
| **App.tsx** | **executeScriptCommand** | **handleExecuteWithRecent** | **NOT WIRED** | 第 123 行只调用 executeCommand |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CommandDialog.tsx | scriptContent | useState + ScriptEditor onChange | Yes (user input) | FLOWING |
| CommandDialog.tsx | executionMode | useState + toggle buttons | Yes (user selection) | FLOWING |
| useProject.ts addCommand | extra.scriptLines | CommandDialog onSubmit | Yes (passed through) | FLOWING |
| CommandCard.tsx | scriptLines prop | MainArea.tsx cmd mapping | No (prop not passed) | DISCONNECTED |
| MainArea.tsx onClick | cmd.command (string) | onExecute callback | Partial (first line only) | HOLLOW |

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
| SCRIPT-04 | 17-02 | 执行模式选择 | SATISFIED (UI) / NOT WIRED (execution) | CommandDialog 有严格/宽松开关，但执行路径未接入 |
| SCRIPT-05 | 17-01 | 向后兼容 | SATISFIED | types.ts 可选字段，旧数据正常工作 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TBD/FIXME/XXX/placeholder markers found |

### Human Verification Required

1. **ScriptEditor 语法高亮视觉效果**
   - Test: 打开 CommandDialog，切换到多行 Tab，输入批处理脚本（如 `if %ERRORLEVEL% EQU 0 (echo ok)`）
   - Expected: 关键字着色、注释灰色、变量绿色、行号可见
   - Why human: 需要视觉确认颜色方案在深色/浅色主题下是否可读

2. **StrictMode 双重渲染稳定性**
   - Test: 在 React StrictMode 下快速打开/关闭 CommandDialog 多次，切换 Tab
   - Expected: ScriptEditor 不崩溃、不出现重复编辑器实例
   - Why human: 需要实际运行应用观察 StrictMode 边界情况

3. **临时 .bat 文件中文路径执行**
   - Test: 添加一个路径含中文的项目，编写多行脚本并执行（需先修复执行路径 gap）
   - Expected: 终端正确执行，路径不乱码
   - Why human: 需要实际终端环境验证 chcp 65001 效果

### Gaps Summary

Phase 17 的后端基础设施（Rust execute_script + build_bat_content）和编辑器 UI（ScriptEditor + batch-lang + CommandDialog Tab 切换）实现完整且经过测试。但存在 **2 个关键接线缺失**，导致核心用户流程断裂：

1. **执行路径断开**（BLOCKER）：用户创建的多行脚本指令无法通过点击卡片执行。`executeScriptCommand` 函数虽已实现，但 `MainArea.tsx` 和 `App.tsx` 的调用链仍在使用旧的 `executeCommand(string)` 路径。修复需要：
   - 修改 `MainArea.tsx` 的 `onExecute` 类型或增加独立回调以传递完整 `CommandItem`
   - 在 `App.tsx` 中将调用分发到 `executeScriptCommand`

2. **多行内容不显示**（BLOCKER）：`CommandCard` 支持 `scriptLines` prop，但 `MainArea.tsx` 渲染时未传递该 prop。多行脚本指令在卡片上与单行指令外观完全相同，用户无法区分。

3. **updateCommand 类型签名不完整**（WARNING）：`MainArea.tsx` 的 `updateCommand` prop 类型只包含 `{ name, command, icon }`，缺少 `scriptLines` 和 `executionMode`。编辑多行指令后保存时，这些字段可能丢失。

---

_Verified: 2026-05-15T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
