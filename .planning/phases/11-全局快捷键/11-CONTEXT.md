# Phase 11: 全局快捷键 - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

为每个指令支持用户自定义 OS 级全局快捷键绑定。用户在编辑模式下点击卡片上的快捷键徽章进入录制，按键组合即完成绑定。选中项目后，无论 EasyPack 窗口是否在前台，按下已绑定快捷键立即在系统终端执行对应指令。切换项目时自动更新快捷键映射。

涉及需求: KB-01, KB-02, KB-03, KB-04, KB-05, KB-06

</domain>

<decisions>
## Implementation Decisions

### 快捷键作用范围
- **D-01:** 使用 OS 级全局热键 — 需要安装 `tauri-plugin-globalShortcut`，快捷键在任何应用前台都能触发，不仅限于 EasyPack 窗口获焦时
- **D-02:** 始终生效 — 即使 EasyPack 窗口隐藏或最小化（Phase 12 托盘模式），全局快捷键仍然执行指令（在终端中打开）

### 快捷键分配 UI
- **D-03:** 卡片上直接录制 — 用户在编辑模式下点击卡片上的快捷键徽章进入按键录制模式，按下组合键即完成绑定
- **D-04:** 录制入口仅编辑模式可见 — 非编辑模式下卡片不显示录制入口，避免误触
- **D-05:** 非编辑模式下始终显示快捷键徽章 — 已绑定的快捷键以文本徽章形式（如 Ctrl+G）显示在卡片上，用户一眼可见

### 快捷键格式限制
- **D-06:** 必须包含修饰键 — 快捷键必须包含至少一个修饰键（Ctrl、Alt、Shift）加一个普通键，防止误触
- **D-07:** 2-3 键组合 — 最少 2 键（如 Ctrl+G），最多 3 键（如 Ctrl+Shift+R）

### Claude's Discretion
- 现有数字键 1-9 快捷键的处理方式（保留/移除/与自定义快捷键共存策略）
- CommandItem 接口扩展设计（shortcut 字段格式）
- 快捷键冲突检测的具体实现和 UI 反馈
- 快捷键注册/注销的时机（添加、删除、切换项目、启动、关闭）
- 快捷键徽章在卡片上的位置和样式
- 录制模式的 UI 反馈（正在录制状态、成功绑定提示、冲突提示）
- globalShortcut 插件在 Rust 端的注册和前端调用方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/hooks/useKeyboard.ts` — 现有数字键 1-9 DOM 级快捷执行逻辑，需决定是否保留或替换
- `src/lib/types.ts` — CommandItem 接口定义，需扩展 shortcut 字段
- `src/components/CommandCard.tsx` — 指令卡片组件，需添加快捷键徽章显示和录制入口
- `src/components/MainArea.tsx` — 主区域网格渲染，管理编辑模式状态
- `src/hooks/useProject.ts` — 指令 CRUD、项目选择、持久化逻辑，需扩展快捷键绑定管理

### Tauri 全局快捷键插件
- `src-tauri/Cargo.toml` — 需添加 tauri-plugin-globalShortcut 依赖
- `src-tauri/src/lib.rs` — 需注册 globalShortcut 插件
- Tauri v2 GlobalShortcut 文档 — https://v2.tauri.app/plugin/global-shortcut/

### 现有模式参考
- `src/components/CommandDialog.tsx` — 现有添加/编辑弹窗模式（虽然快捷键在卡片上录制，但可参考其交互模式）
- `src/lib/presets.ts` — 预设指令定义和数据结构模式

### Requirements
- `.planning/REQUIREMENTS.md` — KB-01, KB-02, KB-03, KB-04, KB-05, KB-06
- `.planning/ROADMAP.md` — Phase 11 详细描述

### Prior Phase Context
- `.planning/phases/10-预设指令系统/10-CONTEXT.md` — 直接依赖阶段，指令数据模型和 CommandDialog 模式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useKeyboard.ts` — 现有 keydown 监听框架和输入焦点/编辑模式/对话框守卫逻辑，可参考或重构
- `CommandCard.tsx` — 已有 shortcutNumber prop 显示数字徽章（1-9），可扩展为通用快捷键徽章
- `useProject.ts` — executeCommand(projectPath, shellCommand) 执行链路完整，快捷键只需调用同一执行路径
- `tauri-plugin-store` — 已配置 autoSave，快捷键绑定作为 CommandItem 字段的一部分自动持久化
- `MainArea.tsx` — 已有 editMode 状态管理，快捷键录制入口受编辑模式控制

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- UI 使用 Tailwind CSS utility classes + shadcn/ui 原语
- CommandItem 序列化到 JSON 时 icon 使用字符串名称（非组件引用）
- 编辑模式通过铅笔图标切换，编辑状态下卡片显示删除/编辑按钮

### Integration Points
- `src/lib/types.ts` — CommandItem 接口扩展 shortcut 字段
- `src/components/CommandCard.tsx` — 添加快捷键徽章和录制交互
- `src/hooks/useProject.ts` — 快捷键绑定数据的读写和指令合并逻辑
- `src-tauri/Cargo.toml` — 添加 tauri-plugin-globalShortcut 依赖
- `src-tauri/src/lib.rs` — 注册 globalShortcut 插件
- 新增 Rust 端快捷键注册/注销 Tauri command 或通过前端 JS API 直接调用插件

</code_context>

<specifics>
## Specific Ideas

- 快捷键徽章样式参考现有数字键徽章（CommandCard 中的 shortcutNumber 显示）
- 编辑模式下卡片已显示删除和编辑按钮，快捷键录制入口可自然融入
- 录制模式应有明显的视觉状态（如输入框闪烁、提示文字"按下快捷键..."）
- 冲突检测应在录制时即时反馈，而非保存后提示

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-全局快捷键*
*Context gathered: 2026-04-26*
