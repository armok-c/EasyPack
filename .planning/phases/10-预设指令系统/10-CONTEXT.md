# Phase 10: 预设指令系统 - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

将现有 4 个硬编码预设扩展为分类预设指令库（Git/NPM/Python/Rust 约 25 个命令），改造 CommandDialog 为双下拉框预设选择 + 可编辑填充模式，精简默认卡片为仅 git pull 和 claude 两个。用户选择预设后名称/命令/图标自动填充但可修改，添加时自动跟随当前全局/项目模式。

涉及需求: PRE-01, PRE-02, PRE-03, PRE-04

</domain>

<decisions>
## Implementation Decisions

### 预设分类与命令清单
- **D-01:** 预设库 4 个分类 — Git、NPM/Node、Python/Pip、Rust/Cargo，每个分类 5-8 个常用命令，共计约 25 个预设命令
- **D-02:** 移除的默认卡片（"打包项目" npm run build、"启动项目" npm run dev）放入 NPM 预设库中供用户手动选择添加

### 双下拉框交互流程
- **D-03:** 预设选择后自动填充 — 弹窗顶部为双下拉框（分类 + 命令），选择后自动填充下方名称、Shell 命令、图标字段，用户可修改填充后的内容
- **D-04:** 图标按分类自动匹配 — Git→GitBranch, NPM/Node→Package, Python→Terminal, Rust→CargoShip。用户仍可通过现有图标选择器手动更改
- **D-05:** 使用 shadcn Select 组件 — 需新安装 Select 组件（当前项目未安装），简单下拉选择，适合有限的选项列表

### 默认卡片精简策略
- **D-06:** 默认仅保留 2 个卡片 — git pull 和 claude，其他原有默认卡片（打包项目、启动项目）移除
- **D-07:** 无需新用户引导 — 默认 2 个卡片足够展示产品功能，预设库在用户点击"添加指令"时自然可见

### 全局/项目级选择交互
- **D-08:** 自动跟随当前模式 — 添加预设指令时，当前处于全局模式则添加到全局指令，处于项目模式则添加到项目指令，弹窗内无需额外 scope 选择器

### Claude's Discretion
- 预设命令的具体数据结构设计（预设库存储方式、ID 格式）
- 双下拉框的级联逻辑实现（选分类后如何过滤/显示命令列表）
- 预设 ID 从 `preset-0` 迁移到语义化 ID 的迁移策略
- 预设库数据文件位置（presets.ts 扩展 vs 新建数据文件）
- Select 组件的样式定制（与现有深色主题一致）
- 手动输入时的表单行为（是否清空预设选择状态）

### Folded Todos

无折叠的 Todo 项。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/components/CommandDialog.tsx` — 当前添加/编辑指令弹窗，需改造为双下拉框预设选择 + 可编辑模式
- `src/lib/presets.ts` — 当前 4 个硬编码预设定义，需扩展为完整预设库
- `src/lib/types.ts` — CommandItem 接口定义，预设相关类型可能需扩展
- `src/lib/icons.ts` — ICON_OPTIONS 图标映射表，预设图标匹配参考

### 状态管理与数据流
- `src/hooks/useProject.ts` — 指令 CRUD、全局/项目切换、持久化逻辑
- `src/components/MainArea.tsx` — 指令网格渲染、编辑模式协调、弹窗调用入口

### shadcn/ui 组件
- `components.json` — shadcn/ui 配置（new-york 风格），新增 Select 组件参考
- `src/components/ui/button.tsx` — 现有 Button 组件（弹窗内使用）
- `src/components/ui/dialog.tsx` — Dialog 组件（弹窗容器，已含 max-h-[90vh] 自适应）

### Requirements
- `.planning/REQUIREMENTS.md` — PRE-01, PRE-02, PRE-03, PRE-04
- `.planning/ROADMAP.md` — Phase 10 详细描述

### Prior Phase Context
- `.planning/phases/08-rust-ui/08-CONTEXT.md` — Tauri command 注册模式、模态窗自适应参考
- `.planning/phases/09-frontend-ui/09-CONTEXT.md` — Button 组件使用模式、MainArea 布局参考

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CommandDialog.tsx` — 现有弹窗框架（名称/命令输入 + 图标网格 + 预览），可在其基础上添加双下拉框区域
- `presets.ts` — PRESET_COMMANDS 数组和 getPresetAsCommandItems() 函数，可扩展为完整预设库
- `icons.ts` — getIconByName() 函数和 ICON_OPTIONS 映射，可用于预设图标自动匹配
- `useProject.ts` — addCommand() 已支持 scope 参数，预设添加可复用现有逻辑
- `components.json` — shadcn/ui 配置就绪，可通过 CLI 安装 Select 组件

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- UI 使用 Tailwind CSS utility classes + shadcn/ui 原语
- 模态窗使用 shadcn/ui Dialog + max-h-[90vh] 自适应滚动（Phase 8）
- 预设 ID 格式 `preset-{idx}`，项目指令通过 enableProjectCommands() 复制并分配新 UUID

### Integration Points
- `src/components/CommandDialog.tsx` — 主要改造文件：在表单顶部添加分类/命令双下拉框
- `src/lib/presets.ts` — 从 4 个硬编码预设扩展为分类预设库
- `src/components/MainArea.tsx` — 弹窗调用入口，传递当前 commandMode 给弹窗
- `src/hooks/useProject.ts` — addCommand() 函数，预设添加复用现有逻辑

</code_context>

<specifics>
## Specific Ideas

- 预设分类图标映射：Git→GitBranch, NPM/Node→Package, Python→Terminal, Rust→CargoShip
- 双下拉框布局：弹窗顶部依次为"分类"Select → "命令"Select，选择后下方名称/命令/图标字段自动填充
- 预设库分类结构示例：
  - Git: pull, push, status, log, fetch, checkout, add ., commit
  - NPM/Node: install, run build, run dev, run test, run lint, start
  - Python/Pip: python, pip install, pip install -r requirements.txt, python -m venv, pytest
  - Rust/Cargo: build, run, test, clippy, fmt, check, update
- 默认卡片仅保留：git pull（GitPullRequest 图标）和 claude（Sparkles 图标）
- 预设 ID 迁移：`preset-0` → `preset-git-pull`，`preset-3` → `preset-claude` 等语义化格式

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-预设指令系统*
*Context gathered: 2026-04-25*
