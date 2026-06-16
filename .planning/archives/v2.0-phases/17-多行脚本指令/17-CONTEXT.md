# Phase 17: 多行脚本指令 - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

将现有单行指令执行器扩展为支持完整 Windows 批处理语法的多行脚本编辑和执行系统。用户可以在 CommandDialog 中通过 Tab 切换到多行编辑模式，使用 CodeMirror 编辑器编写批处理脚本，脚本通过临时 .bat 文件在终端执行（chcp 65001 确保中文路径兼容）。系统智能检测内容类型，简单多行命令用 &&/& 连接，批处理脚本原样写入。

涉及需求: SCRIPT-01, SCRIPT-02, SCRIPT-03, SCRIPT-04, SCRIPT-05

</domain>

<decisions>
## Implementation Decisions

### 编辑模式切换
- **D-01:** Tab 切换 — CommandDialog 顶部添加"单行"和"多行"两个 Tab，切换后编辑区域在 Input 和 CodeMirror 之间切换
- **D-02:** 新建指令默认显示"单行" Tab，与现有体验一致
- **D-03:** Tab 切换时保留已输入内容 — 从"单行"切到"多行"时，单行命令自动填入多行编辑器第一行
- **D-04:** 预设指令选择器（双下拉框）仅在"单行" Tab 时显示，多行 Tab 不显示

### SCRIPT-04 与 .bat 文件的关系
- **D-05:** 智能模式 — 系统检测内容是否含批处理语法关键字：简单多行命令用 && 或 & 连接写入 .bat；含批处理语法（if/for/goto 等）时原样写入 .bat 不做连接
- **D-06:** 关键字检测列表 — 检测 if、for、goto、set、call、:label 等常见 bat 关键字，匹配到任一即视为批处理脚本
- **D-07:** 严格/宽松开关放在编辑器下方（仅当检测为"简单多行命令"时显示），检测为"批处理脚本"时隐藏开关并提示"已识别为批处理脚本，将原样执行"
- **D-08:** 新建多行指令默认严格模式（&&），更安全
- **D-09:** 临时 .bat 文件执行后不删除，放在系统 temp 目录，随系统清理机制自动回收
- **D-10:** 所有 .bat 文件头部始终添加 `chcp 65001 >nul`，确保中文路径不乱码
- **D-11:** .bat 文件头部自动添加 `cd /d "{projectPath}"` 设置工作目录到当前项目路径，与现有单行执行行为一致

### 编辑器体验与布局
- **D-12:** CodeMirror 编辑器在现有 CommandDialog 内部替换 Input 位置，Tab 切换后 CommandDialog 高度自动扩展
- **D-13:** 编辑器固定 10-12 行高度（约 250-300px），内容超出时滚动
- **D-14:** 编辑器主题跟随应用主题 — 深色模式用 CodeMirror dark 主题（如 oneDark），浅色模式用 light 主题
- **D-15:** 多行脚本在指令卡片上显示为多行文本，最多显示 3 行，超出截断并显示 "..."
- **D-16:** 使用 CodeMirror 的 bat/Shell 语法高亮扩展，支持关键字、字符串、注释等着色

### Claude's Discretion
- CodeMirror 6 在 Tauri WebView 中的 CSP 配置（已知风险需研究确认）
- @codemirror 包的具体版本和子包选择
- CommandDialog 高度扩展时的动画过渡
- 严格/宽松开关的 UI 组件选择（Select / Button pair / Switch）
- .bat 文件命名规则（如 `easypack-{uuid}.bat` 或 `easypack-{timestamp}.bat`）
- bat 语法高亮的语言包选择（@codemirror/lang-shell 或其他）
- 行号显示的具体样式
- CodeMirror 编辑器的快捷键绑定（是否保留默认 CM6 快捷键）
- CommandItem 类型中 scriptLines 的具体数据结构（string[] vs \n 分隔 string）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/components/CommandDialog.tsx` — 需添加 Tab 切换 UI、集成 CodeMirror 编辑器、预设选择器条件显示
- `src/components/CommandCard.tsx` — 需支持多行脚本内容的截断显示（最多 3 行）
- `src/lib/types.ts` — CommandItem 接口需扩展 scriptLines 可选字段
- `src-tauri/src/commands/shell.rs` — 需新增多行脚本执行函数（写 .bat 文件 + 执行）
- `src/hooks/useProject.ts` — executeCommand 需支持多行脚本调用路径

### 新增文件（预期）
- `src/components/ScriptEditor.tsx` — CodeMirror 编辑器组件封装（语法高亮、行号、主题适配）
- `src/hooks/useBatchDetect.ts` — 批处理语法关键字检测 hook

### 现有模式参考
- `src/components/CommandDialog.tsx` — 当前单行编辑 UI、预设选择器、scope 选择、图标选择器
- `src/lib/types.ts` — CommandItem / PresetCommand 类型定义
- `src/lib/presets.ts` — 25 个单行预设命令
- `src-tauri/src/commands/shell.rs` — 当前 execute_command 实现（cmd /K 模式）
- `src-tauri/src/lib.rs` — Rust 端 command 注册模式

### Prior Phase Context
- `.planning/phases/16-版本管理/16-CONTEXT.md` — Rust 端 command 定义模式
- `.planning/phases/15-开机启动/15-CONTEXT.md` — SettingsDialog 扩展模式
- `.planning/phases/14-边缘抽屉/14-CONTEXT.md` — 状态机设计模式

### 已知风险
- `.planning/STATE.md` — "CodeMirror 6 + Tauri WebView CSP 兼容性需在 Phase 17 研究确认"

### Requirements
- `.planning/REQUIREMENTS.md` — SCRIPT-01 ~ SCRIPT-05
- `.planning/ROADMAP.md` — Phase 17 详细描述

### Technology
- CodeMirror 6 — https://codemirror.net/docs/guide/ （官方文档）
- @codemirror/lang-shell — Shell/Bat 语言包（需确认是否支持 bat 语法）
- @codemirror/theme-one-dark — 深色主题

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CommandDialog.tsx` — 已有完整的指令编辑 UI（名称、命令 Input、预设选择器、scope 选择、图标选择），Tab 切换可在此基础上添加
- `CommandCard.tsx` — 已有指令卡片渲染，需扩展支持多行内容显示
- `shell.rs` — 已有 `build_cmd_start_args` 辅助函数生成 cmd.exe 参数，多行脚本需要新函数
- `types.ts` — CommandItem 接口已有 shortcut 可选字段模式，scriptLines 可照此模式添加
- `useProject.ts` — 已有 executeCommand 回调，需添加多行执行分支

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- CommandDialog 使用 shadcn/ui Dialog + Input 组件
- 可选字段用 `field?: Type` 模式（参考 shortcut 字段）

### Integration Points
- `src/components/CommandDialog.tsx` — Tab UI + CodeMirror 集成 + 预设选择器条件显示
- `src/components/CommandCard.tsx` — 多行内容截断显示
- `src/lib/types.ts` — CommandItem 添加 scriptLines? 和 executionMode? 字段
- `src-tauri/src/commands/shell.rs` — 新增 execute_script command
- `src-tauri/src/lib.rs` — 注册新 command
- `src-tauri/Cargo.toml` — 可能需要 tempfile crate 用于 .bat 文件创建
- `package.json` — 需添加 @codemirror/* 依赖
- `src-tauri/capabilities/default.json` — 可能需要追加文件写入权限
- `src-tauri/tauri.conf.json` — 可能需要调整 CSP 配置以支持 CodeMirror

### Key Technical Risks
- **CodeMirror 6 + Tauri WebView CSP** — CM6 使用 eval/Function 等，可能与 Tauri 的 CSP 冲突，需研究确认
- **bat 语法高亮** — @codemirror/lang-shell 可能不完整支持 bat 语法（goto、label、if/else 等），可能需要自定义
- **临时 .bat 文件路径** — 系统临时目录路径可能含空格或中文，需要正确引用

</code_context>

<specifics>
## Specific Ideas

- Tab 切换参考 Postman 的请求体切换 UI（单行/多行/原始文本 Tab）
- 编辑器高度 10-12 行约 250-300px，与 CommandDialog 整体布局协调
- 严格/宽松开关建议用 Button pair（两个按钮互斥切换），与 v1.1 的 scope 选择 UI 风格一致
- 批处理关键字检测可基于正则表达式，匹配行首的 `if `、`for `、`goto `、`set `、`call `、`:` 等

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-多行脚本指令*
*Context gathered: 2026-05-14*
