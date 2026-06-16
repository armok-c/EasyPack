# Phase 9: 前端 UI 集成 - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

将指令切换从文本链接改为 Toggle Group 按钮样式，新增"打开文件夹"按钮（outline + FolderOpen 图标），两者在同一行显示。涉及 2 个需求：PROJ-11（打开文件夹）、UI-10（按钮化切换）。不涉及新增指令功能，仅改造现有交互控件。

涉及需求: PROJ-11, UI-10

</domain>

<decisions>
## Implementation Decisions

### 按钮行视觉风格
- **D-01:** Toggle Group 拼合样式 — "全局指令"和"项目指令"两个按钮紧邻拼合，形成类似 Tab 的视觉分组，中间无间隔。当前激活项用 `secondary` variant，非激活项用 `ghost` variant。
- **D-02:** sm 尺寸 — 所有按钮统一使用 `sm` size（h-8, text-xs），与信息栏其他元素（路径、大小、分支）保持视觉一致。
- **D-03:** "打开文件夹"按钮 — 使用 `outline` variant + `FolderOpen`（lucide 图标）+ "打开文件夹"文字，右对齐排列在按钮行中。

### 打开文件夹实现方式
- **D-04:** explorer.exe + raw_arg() — Rust 后端使用 `std::process::Command::new("explorer.exe").raw_arg(format!("\"{}\"", path)).spawn()` 打开文件夹。零新依赖，复用 Phase 6 验证过的 raw_arg 模式。路径用双引号包裹处理空格。

### 切换交互细节
- **D-05:** 空状态禁用 — 当项目没有自定义指令时，"项目指令"按钮灰显禁用不可点击，防止用户进入空白状态。
- **D-06:** 直接切换 — 点击即切换，无确认弹窗。沿用现有 enableProjectCommands/disableProjectCommands 逻辑。

### Claude's Discretion
- Toggle Group 的 CSS 实现细节（圆角处理、分隔线、active 过渡效果）
- 具体颜色/透明度选择（secondary/ghost 在深色主题下的表现）
- 是否需要新增 shadcn ToggleGroup 组件或手写样式
- "打开文件夹"按钮的 hover/active 状态细节
- open_folder 命令放在 shell.rs 还是新建文件

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Rust Backend Context
- `src-tauri/src/commands/shell.rs` — raw_arg() 使用模式参考（Phase 6 验证）
- `src-tauri/src/commands/mod.rs` — 命令模块注册入口
- `src-tauri/src/lib.rs` — invoke_handler 注册机制

### Frontend Context
- `src/components/MainArea.tsx` — 主要改造文件，文本链接切换器（207-228 行）需替换为按钮行
- `src/components/ui/button.tsx` — shadcn Button 组件（6 variant + 4 size）
- `src/hooks/useProject.ts` — enableProjectCommands/disableProjectCommands 逻辑（366-393 行）
- `src/App.tsx` — props 传递链路，需传递 openFolder 回调

### Requirements
- `.planning/REQUIREMENTS.md` — PROJ-11, UI-10
- `.planning/ROADMAP.md` — Phase 9 详细描述

### Prior Phase Context
- `.planning/phases/06-命令执行修复/06-CONTEXT.md` — raw_arg() 模式参考
- `.planning/phases/08-rust-ui/08-CONTEXT.md` — Tauri command 注册模式、MainArea 布局参考

### Architecture Research
- `.planning/research/ARCHITECTURE.md` — "打开文件夹"两种实现方案对比（285-303 行）
- `.planning/research/PITFALLS.md` — explorer.exe 路径空格注意事项（516-555 行）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — 完整 shadcn Button 组件，secondary/ghost/outline variant 和 sm size 可直接使用
- `src-tauri/src/commands/shell.rs` — raw_arg() 调用模式，open_folder 命令可参照实现
- `src/hooks/useProject.ts` — enableProjectCommands/disableProjectCommands 已有完整切换逻辑
- lucide-react — FolderOpen 图标可用

### Established Patterns
- Rust 后端 `#[tauri::command]` + `invoke()` 前端调用
- MainArea.tsx 信息栏使用 text-xs 统一紧凑排版
- 按钮使用 shadcn/ui Button 组件 + Tailwind utility classes

### Integration Points
- `src/components/MainArea.tsx:207-228` — 文本链接切换器，需完全替换为 Toggle Group 按钮行
- `src-tauri/src/lib.rs:invoke_handler` — 注册新 open_folder 命令
- `src/hooks/useProject.ts` — 新增 openFolder 回调函数
- `src/App.tsx` — 传递 openFolder prop 到 MainArea

</code_context>

<specifics>
## Specific Ideas

- Toggle Group 拼合视觉参考：两个按钮紧邻，共用边框，中间无 gap，激活项有背景色区分
- 按钮行整体布局：左侧 Toggle Group，右侧 outline "打开文件夹"按钮，`justify-between` 排列
- explorer.exe 路径必须使用反斜杠（Windows 原生），双引号包裹处理空格
- raw_arg 格式：`StdCommand::new("explorer.exe").raw_arg(&format!("\"{}\"", path))`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-frontend-ui*
*Context gathered: 2026-04-25*
