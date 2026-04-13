# Phase 4: 自定义指令与项目级覆盖 - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以创建和管理自定义指令（全局 + 项目级），为不同项目配置独立指令集覆盖全局默认，所有自定义数据持久化保存。覆盖需求 CMD-05、CMD-06、CMD-07、DATA-02、UI-07。

**核心变更：** Phase 3 的只读预设卡片 → Phase 4 的可自定义指令系统（CRUD + 项目级覆盖）。

</domain>

<decisions>
## Implementation Decisions

### 自定义指令 CRUD 入口
- **D-01:** 主区域有编辑模式切换。项目信息区域（"当前项目: xxx"旁）放置设置/编辑图标按钮，点击进入编辑模式，再次点击退出
- **D-02:** 编辑模式下，卡片网格底部出现半透明"添加指令"占位卡片（虚线边框），点击弹出添加弹窗
- **D-03:** 编辑模式下，自定义指令卡片右上角显示 X 删除按钮，点击直接删除无确认弹窗（与 Phase 2 项目删除一致）
- **D-04:** 编辑模式下，点击自定义指令卡片弹出编辑弹窗（复用添加弹窗，预填数据）。预设指令不可编辑/删除，点击无反应
- **D-05:** 非编辑模式下，右键自定义指令卡片显示上下文菜单（编辑、删除选项）。预设指令右键无菜单或菜单只显示信息
- **D-06:** 未选中项目时编辑按钮隐藏（无指令可编辑）

### 项目级覆盖机制
- **D-07:** 项目级指令集完全替换全局指令。切换到有独立指令集的项目时，卡片网格只显示该项目的指令集
- **D-08:** 创建项目级指令集时，默认包含 4 个预设指令作为起点，用户可以在此基础上添加/删除/编辑
- **D-09:** 项目信息区域显示当前模式标签（"全局指令"或"项目自定义指令"），旁边有切换入口
- **D-10:** 删除项目级指令集中所有指令后，自动回退到全局指令模式
- **D-11:** 全局模式下预设指令（build、dev、git pull、claude）不可删除；项目级指令集中预设指令可删除

### 弹窗表单设计
- **D-12:** 添加/编辑弹窗包含：名称（必填）+ Shell 命令（必填）+ 图标（可选，默认 Terminal 图标）
- **D-13:** 图标选择使用预设图标列表（8-10 个常用 lucide-react 图标，如 Terminal、Code、Server、Zap、GitBranch 等）
- **D-14:** 弹窗底部显示实时预览卡片，展示名称 + 图标的组合效果
- **D-15:** 表单即时验证——名称和命令都有内容时"保存"按钮自动可用，为空时显示红色提示
- **D-16:** 需要安装 shadcn/ui Dialog 组件（当前未安装）

### 指令数据结构与展示
- **D-17:** 自定义指令和预设指令在同一个网格中混合展示，自定义指令有轻微视觉标记（如细微的边框颜色差异或小标签）与预设指令区分
- **D-18:** 统一排序——所有指令按添加顺序排列在同一个网格中，不分区
- **D-19:** 统一数据结构 `CommandItem`（id + name + command + icon + type: 'preset' | 'custom' + scope: 'global' | 'project'），渲染时合并预设和自定义为一个数组
- **D-20:** 全局自定义指令存储在 tauri-plugin-store 中（key 如 `customCommands`），项目级指令按 projectId 存储（key 如 `projectCommands:{projectId}`）
- **D-21:** 项目级指令集的编辑复用主区域编辑模式（同一编辑体验），与全局指令编辑流程一致
- **D-22:** 首次为项目创建独立指令集时（点击"使用项目自定义指令"后）自动进入编辑模式，方便首次配置

### Claude's Discretion
- 自定义指令卡片的视觉标记具体样式（边框颜色、小标签位置等）
- 预设图标列表的具体图标选择（8-10 个）
- 编辑模式的进入/退出动效
- "添加指令"占位卡片的具体样式（虚线边框、透明度等）
- 右键菜单的具体实现方案（shadcn DropdownMenu 或 ContextMenu）
- CommandItem 的 id 生成策略
- 持久化数据的具体 schema 设计
- 项目信息区域的模式标签和切换入口的 UI 布局

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 技术栈与 UI 规范
- `CLAUDE.md` — 完整技术栈选型、shadcn/ui 配置、Tailwind CSS v4 用法
- `.planning/phases/01-shell/01-UI-SPEC.md` — 完整 UI 设计规范（间距、颜色、字体、动效、组件状态）

### 需求定义
- `.planning/REQUIREMENTS.md` — Phase 4 需求：CMD-05, CMD-06, CMD-07, DATA-02, UI-07
- `.planning/ROADMAP.md` Phase 4 — 阶段目标、成功标准、计划列表

### 前序阶段上下文（必须了解的决策）
- `.planning/phases/01-shell/01-CONTEXT.md` — D-10（toast 提示）、D-12（4 个预设命令）、D-20（Raycast 风格）
- `.planning/phases/02-sidebar-persistence/02-CONTEXT.md` — D-12（tauri-plugin-store 持久化模式）、D-13（持久化数据格式）
- `.planning/phases/03-command-cards/03-CONTEXT.md` — D-03（卡片紧凑布局）、D-04（卡片样式）、D-07（动效 Claude 决定）、D-08（自适应网格）

### 已知风险
- `.planning/STATE.md` Blockers/Concerns — Windows 路径空格/中文处理

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/CommandCard.tsx`: 现有卡片组件，接受 name/icon/command/disabled/onClick。需要扩展：支持右键菜单、编辑模式下的删除按钮、自定义指令视觉标记
- `src/lib/presets.ts`: `PresetCommand` 接口（name + command + icon）+ `PRESET_COMMANDS` 数组。需要扩展为统一的 `CommandItem` 数据结构
- `src/hooks/useProject.ts`: tauri-plugin-store 持久化模式已建立（load/set/get + autoSave）。需要扩展：自定义指令的 CRUD 操作、项目级指令集管理
- `src/components/MainArea.tsx`: 网格布局 + 空状态 + 项目信息区域。需要大量改动：编辑模式切换、模式标签、添加占位卡片
- `src/components/ui/button.tsx`: shadcn/ui Button 组件
- `src/components/ui/sonner.tsx`: Toast 组件已集成

### Established Patterns
- Tailwind 透明度风格：`bg-white/5`、`border-white/10`、`hover:bg-white/10`
- 卡片样式：`flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10`
- 动效：CSS `transition-all duration-150 ease-out`
- Store 持久化：`await load(STORE_PATH, { autoSave: 100 })` → `await store.set(KEY, VALUE)`
- 项目 ID：路径规范化（lowercase + forward slashes）
- Toast：`toast.success()` / `toast.error()`，duration 1500ms

### Integration Points
- `src/components/MainArea.tsx`: 主要改动点——编辑模式、模式标签、添加占位卡片、右键菜单
- `src/components/CommandCard.tsx`: 需要支持右键菜单、编辑模式样式、自定义标记
- `src/hooks/useProject.ts`: 需要扩展自定义指令 CRUD 和项目级指令集管理
- `src/lib/presets.ts`: 需要扩展为统一数据结构
- `src/App.tsx`: 可能需要传递新的 props（编辑模式状态等）
- 需要安装 shadcn/ui Dialog 组件（`npx shadcn@latest add dialog`）
- 可能需要安装 shadcn/ui ContextMenu 或 DropdownMenu 组件

</code_context>

<specifics>
## Specific Ideas

- 编辑模式参考 iOS 的编辑模式体验——卡片变可操作，出现删除按钮和添加入口
- 自定义指令和预设指令视觉上轻微区分，但不破坏整体一致的卡片风格
- 弹窗实时预览让用户确认卡片外观后再保存

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-custom-commands*
*Context gathered: 2026-04-13*
