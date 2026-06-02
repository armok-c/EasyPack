# Phase 6: 命令执行修复 - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

修复所有项目点击指令卡片后终端报 0x80070002 (ERROR_FILE_NOT_FOUND) 的阻断性 bug。确保含空格、中文、特殊字符的项目路径也能正确执行命令。仅涉及 `src-tauri/src/commands/shell.rs` 的命令构造和调用逻辑，不涉及 UI 或数据层。

</domain>

<decisions>
## Implementation Decisions

### 命令构造与调用方式
- **D-01:** 使用 `std::os::windows::process::CommandExt::raw_arg()` 传原始命令行字符串给 WT/cmd.exe，绕过 Rust `std::process::Command` 的 MSVC C 运行时自动转义。这是 Rust 官方推荐的 cmd.exe 调用方式（参见 Rust issue #92939 和 CommandExt 文档）。
  - WT 路径：`StdCommand::new("wt").raw_arg("new-tab cmd /K \"cd /d \"\"path\"\" && command\"")`
  - cmd 回退路径：`StdCommand::new("cmd").raw_arg("/C start cmd /K \"cd /d \"\"path\"\" && command\"")`
  - 内层引号用 `""` 转义（cmd.exe 的引号转义规则）

### 终端检测与回退策略
- **D-02:** 保持现有静默回退策略：先试 WT (`wt.exe`)，spawn 失败则回退 `cmd.exe`。不增加预先检测逻辑，用户无感知。

### 错误反馈与诊断
- **D-03:** 保持现有简单的 toast 错误提示，不做复杂的错误分类（终端未找到 / 路径不存在 / 命令语法错误）。修复后错误概率极低，复杂错误分类投入产出比不高。

### Claude's Discretion
- `build_full_command` 函数的具体引号转义细节
- WT 和 cmd 路径的 `raw_arg` 参数拼接格式
- 测试用例的更新（适配新的调用方式）
- 是否需要 `#[cfg(windows)]` 条件编译（当前仅面向 Windows，可能不需要）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug Context
- `src-tauri/src/commands/shell.rs` — 当前命令执行逻辑，bug 所在文件
- `src/hooks/useProject.ts` — 前端 `executeCommand` 调用端（传递 `projectPath` + `shellCommand`）

### Rust Windows Command Documentation
- [Rust `CommandExt::raw_arg` 官方文档](https://doc.rust-lang.org/beta/std/os/windows/process/trait.CommandExt.html) — 包含 cmd.exe / batch files 使用指导
- [Rust issue #92939](https://github.com/rust-lang/rust/issues/92939) — `raw_arg` 跟踪 issue，解释 Windows 命令行参数传递机制
- [GHSA-q455-m56c-85mh](https://github.com/rust-lang/rust/security/advisories/GHSA-q455-m56c-85mh) — Rust Windows 批处理文件参数注入安全公告，说明 `raw_arg` 的安全意义

### Project Context
- `.planning/PROJECT.md` — Key Decisions 表中 `std::process::Command` 的决策记录
- `.planning/REQUIREMENTS.md` — FIX-01 和 FIX-02 需求定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Bug Location
- `src-tauri/src/commands/shell.rs` — 唯一需要修改的文件
  - `build_full_command()` — 生成 `cd /d "path" && command` 格式字符串
  - `execute_command()` — Tauri command，调用 WT 或 cmd.exe
  - 4 个单元测试覆盖基本路径、空格路径、中文路径、预设命令

### Reusable Assets
- `build_full_command()` 函数逻辑本身正确（`cd /d "path" && command` 格式），问题仅在于传参方式
- 单元测试可复用，只需适配 `raw_arg` 后的调用方式

### Established Patterns
- Rust 后端通过 `#[tauri::command]` 暴露给前端
- 前端通过 `invoke("execute_command", { projectPath, shellCommand })` 调用
- 路径用双引号包裹处理空格（per D-11, D-13 in prior phases）

### Integration Points
- `src-tauri/src/lib.rs` — `invoke_handler` 注册 `commands::shell::execute_command`
- `src/hooks/useProject.ts:192-208` — 前端调用 `executeCommand`，传入 `currentProject.path` 和 `shellCommand`

</code_context>

<specifics>
## Specific Ideas

- Bug 根因：Rust `std::process::Command.args()` 使用 MSVC C 运行时转义规则，不适用于 `cmd.exe /K` 的命令行解析。导致 WT 将 `cmd /K cd` 解析为程序名 → 0x80070002 (ERROR_FILE_NOT_FOUND)
- 修复核心：将 `.args([...])` 改为 `.raw_arg(...)` 传原始命令行字符串
- 用户报错原文：`[出现错误 2147942402 (0x80070002) (启动""cmd /K cd" /d E:\git\MultiHub-data && npm run dev"时)]`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-命令执行修复*
*Context gathered: 2026-04-15*
