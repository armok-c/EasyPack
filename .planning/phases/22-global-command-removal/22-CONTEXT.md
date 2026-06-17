# Phase 22: 全局指令移除与重构 - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

移除全局指令系统（`commandMode`、全局/项目切换 Toggle Group、`customCommands` state、`scope: "global"`），将项目指令栏目提升为唯一视图并改名为"项目环境"。同时精简默认指令为单一内置"终端"卡片，保留预设库供 CommandDialog 浏览添加。
</domain>

<decisions>
## Implementation Decisions

### 全局指令数据清理
- **D-01:** 现有全局自定义指令直接丢弃，toast 通知用户「全局指令已移除，请使用项目环境添加指令」
- **D-02:** 应用启动时一次性检测 profileStore 中 `CUSTOM_COMMANDS_KEY` 旧数据 → 删除该键 → toast 通知。之后不再处理

### 内置默认指令
- **D-03:** 始终有一个内置"终端"默认指令卡片，在所有项目指令之前显示。无项目指令时也显示此卡片
- **D-04:** "终端"执行行为：在项目目录打开系统默认终端窗口（`cmd.exe`），不对应 CommandItem 数据模型，是特殊的内置 UI 元素
- **D-05:** "终端"不属于预设库，不可编辑/删除

### 预设系统
- **D-06:** 保留预设库（`ALL_PRESETS` 25 条 + `PRESET_CATEGORIES` 4 分类），CommandDialog 中「从预设选择」下拉功能保留
- **D-07:** 预设 scope 从 `"global"` 改为 `"project"`，添加到项目时自动归属当前项目
- **D-08:** `getDefaultsAsCommandItems()` 不再用于初始化项目指令集。若保留该函数则仅返回终端相关信息

### 子窗口适配
- **D-09:** 悬浮窗（FloatApp）和系统托盘（useTray）自动跟随主窗口 commands 派生逻辑变更，无需独立适配

### 移除范围
- **D-10:** `commandMode` state（`"global" | "project"`）完全移除 —— `useProject.ts` 中 state、auto-detect effect、所有引用
- **D-11:** `customCommands` state 完全移除 —— 不再读取/写入 `CUSTOM_COMMANDS_KEY`
- **D-12:** `CommandItem.scope` 类型移除 `"global"` 值，仅保留 `"project"`（或视情况移除整个字段）
- **D-13:** MainArea 中全局/项目切换 Toggle Group（两个 Button + radiogroup）完全移除
- **D-14:** `addCommand` / `updateCommand` / `deleteCommand` 中所有 global 分支移除，仅保留 project 路径
- **D-15:** `enableProjectCommands` / `disableProjectCommands` 逻辑简化 —— 不再需要模式切换，`enableProjectCommands` 退化为初始化项目指令集的操作

### Claude's Discretion
无 —— 所有决策均由用户明确选择。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 数据模型
- `src/lib/types.ts` — `CommandItem` 接口定义（scope 字段待修改）
- `src/lib/presets.ts` — 预设指令库（ALL_PRESETS、PRESET_CATEGORIES、getDefaultsAsCommandItems）

### 核心逻辑
- `src/hooks/useProject.ts` — `commandMode` state（第74行）、`customCommands` state（第63行）、`commands` 派生逻辑（第99-128行）、addCommand/updateCommand/deleteCommand 中的 global 分支、`enableProjectCommands`/`disableProjectCommands`
- `src/App.tsx` — `commandMode` 通过 props 传递到 MainArea（第510行）

### UI 组件
- `src/components/MainArea.tsx` — 全局/项目切换 Toggle Group（第222-258行）、`commandMode` prop、标签文案、指令卡片网格
- `src/components/CommandDialog.tsx` — scope 下拉选择、预设选择功能
- `src/components/FloatApp.tsx` — 悬浮窗，通过 `float:state-update` 事件接收 commands
- `src/hooks/useFloatWindow.ts` — 向悬浮窗推送 commands 状态
- `src/hooks/useTray.ts` — 系统托盘，消费 commands 构建菜单

### 需求文档
- `.planning/REQUIREMENTS.md` — CMD-09（移除全局指令栏目）、CMD-10（项目指令替代全局指令）
- `.planning/ROADMAP.md` — Phase 22 成功标准与里程碑上下文

### 测试
- `src/components/__tests__/MainArea.test.tsx` — MainArea 测试（含 commandMode 相关断言）
- `src/hooks/__tests__/useProject.test.tsx` — useProject 测试（含 commandMode/customCommands 相关断言）
- `src/components/__tests__/CommandDialog.test.tsx` — CommandDialog 测试（含 scope 相关断言）
- `src/hooks/__tests__/useShortcutActions.test.ts` — 快捷键测试（含 global scope 引用）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CommandCard 组件** — 现有卡片组件支持 icon、name、editMode、onDelete、shortcut 等 props，可直接用于终端卡片和项目指令卡片
- **CommandDialog 组件** — 现有的添加/编辑指令弹窗，包含预设选择下拉、scope 选择、多行脚本编辑器。需移除 scope 下拉（仅保留 project），保留预设选择功能
- **MainArea 布局** — 现有 flex 布局、grid 自适应卡片网格、空状态引导页均可复用

### Established Patterns
- **不可变 state 更新** — useProject 全部使用展开运算符 + setState 回调模式
- **profileStore 持久化** — 所有数据通过 `profileStore.set()` + `profileStore.save()` 持久化
- **toast 通知** — 使用 sonner toast 进行用户反馈
- **派生 state** — `commands` 通过 `useMemo` 从多个 state 派生

### Integration Points
- `useProject.commands` 派生逻辑 → 变更为「终端内置 + 项目指令」
- `useProject.addCommand` → 始终以 project scope 添加
- `MainArea` → 移除 `commandMode` prop，移除 Toggle Group，新增终端卡片
- `useFloatWindow` → `float:state-update` 推送的 commands 自动跟随变更
- `useTray` → 托盘菜单 commands 自动跟随变更
</code_context>

<specifics>
## Specific Ideas

- "终端"卡片图标使用 `Terminal`（lucide-react），卡片名称"终端"，始终显示在指令网格首位
- 项目指令区域标题从"当前项目: {name}"下方的"项目指令"改为"项目环境"
- 编辑模式按钮保留，点击后显示添加指令虚线卡片 + 每条项目指令的编辑/删除按钮
- toast 通知示例：「全局指令已移除，请使用项目环境添加指令」（启动时一次性迁移完成时）
- 预设库中的 25 条预设 scope 从 `"global"` 改为 `"project"`，`getDefaultsAsCommandItems()` 不再被 `addCommand` 调用初始化
</specifics>

<deferred>
## Deferred Ideas

None — 讨论严格限制在 Phase 22 范围内。
</deferred>

---

*Phase: 22-全局指令移除与重构*
*Context gathered: 2026-06-17*
