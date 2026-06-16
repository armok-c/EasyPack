# Phase 8: Rust 后端扩展与快速 UI 修复 - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Rust 后端新增项目信息检测能力：自动从项目目录识别应用图标（智能扫描 package.json/Cargo.toml/常见图标文件）、计算文件夹大小（排除大目录）、读取 Git 当前分支名；支持用户选择自定义图标文件路径（.ico/.png/.svg），图标与现有 lucide 图标系统混合共存。同时修复模态窗在窗口过小时内容被截断的问题，使 DialogContent 具备自适应高度和滚动能力。

涉及需求: PROJ-07, PROJ-08, PROJ-09, PROJ-10, UI-09

</domain>

<decisions>
## Implementation Decisions

### 图标自动识别
- **D-01:** 智能扫描方式 — Rust 后端扫描项目目录中多种图标来源：package.json 的 icon 字段、Cargo.toml 的 icon/package.metadata.icon 字段、常见图标文件名（favicon.ico, app-icon.png, icon.png, logo.png 等）。后端一次性扫描并返回候选列表给前端。
- **D-02:** 混合图标模式 — lucide 预设图标和自定义文件图标共存。侧边栏渲染时根据图标类型分别处理：lucide 用 React 组件渲染，文件图标用 `<img>` 或 CSS background 渲染。
- **D-03:** 手动触发扫描 — 在 ProjectSettingsDialog 中增加"从项目导入"按钮，用户点击后调用 Rust 命令扫描当前项目目录。不在打开模态时自动扫描，避免每次打开都有 I/O 开销。

### 文件夹大小计算
- **D-04:** 选中时即时计算 — 用户选中项目时，前端调用 Rust 命令即时计算文件夹大小。简单直接，大型项目可能有感知延迟（通过超时机制缓解）。
- **D-05:** 固定排除目录列表 — 排除 node_modules, .git, target, dist, .next, .cache, build, __pycache__, .venv 等常见大目录。列表硬编码在 Rust 后端，不做用户配置。
- **D-06:** 超时机制 — 设置 5-10 秒超时，超时后返回部分结果或显示占位提示（如"计算中..."），避免阻塞 UI。

### Git 分支获取
- **D-07:** 读取 .git/HEAD 文件 — 直接读取项目目录下 `.git/HEAD` 文件，解析 `ref: refs/heads/xxx` 格式获取当前分支名。零依赖、极快、无外部进程。非 Git 仓库时文件不存在，自然返回空。
- **D-08:** 与文件夹大小一起返回 — Git 分支信息和文件夹大小在同一个 Rust Tauri 命令中一起返回，前端只需一次 `invoke` 调用获取所有项目信息。

### 模态窗自适应
- **D-09:** 全局 max-height + 滚动 — 在 DialogContent 基础样式中添加 `max-height` 限制（如 `max-h-[90vh]`），使所有使用 DialogContent 的模态窗都具备自适应能力。
- **D-10:** Header/Footer 固定，内容区滚动 — DialogContent 内部使用 `flex flex-col` 布局，DialogHeader 和 DialogFooter 固定不滚动，中间内容区域 `flex-1 overflow-y-auto` 实现滚动。

### Claude's Discretion
- 智能扫描的具体文件名匹配规则和优先级排序
- 排除目录的完整列表和是否支持 glob 模式
- 超时的具体秒数（5s vs 10s）
- 文件图标在侧边栏中的渲染尺寸和 fallback 策略
- 项目信息返回结构体（Rust struct）的字段设计
- max-height 的具体值（90vh / 85vh / 80vh）
- 缓存策略的细节（是否需要、TTL 等）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Rust Backend Context
- `src-tauri/src/commands/shell.rs` — 现有 Tauri command 实现模式参考
- `src-tauri/src/commands/mod.rs` — 命令模块注册入口
- `src-tauri/src/lib.rs` — invoke_handler 注册机制
- `src-tauri/Cargo.toml` — Rust 依赖配置（确认是否需要新增依赖）

### Frontend Context
- `src/components/ProjectSettingsDialog.tsx` — 当前图标选择器实现，需要扩展支持自定义图标
- `src/components/ui/dialog.tsx` — DialogContent 组件，需要添加 max-height 和滚动
- `src/components/Sidebar.tsx` — 侧边栏项目渲染，需要支持文件图标渲染
- `src/hooks/useProject.ts` — 项目管理 hook，需要集成项目信息获取
- `src/components/MainArea.tsx` — 信息栏显示区域

### Requirements
- `.planning/REQUIREMENTS.md` — PROJ-07, PROJ-08, PROJ-09, PROJ-10, UI-09
- `.planning/ROADMAP.md` — Phase 8 详细描述

### Prior Phase Context
- `.planning/phases/06-命令执行修复/06-CONTEXT.md` — Rust 后端 Tauri command 模式参考

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/commands/shell.rs` — Tauri command 实现模式（`#[tauri::command]` + async + Result）
- `src-tauri/src/lib.rs` — invoke_handler 注册，新命令只需加到数组
- `src/components/ui/dialog.tsx` — shadcn/ui Dialog 组件，可修改 DialogContent 样式
- `src/components/ProjectSettingsDialog.tsx` — 图标选择器框架，可扩展"自定义图标"区域
- `src/lib/icons.ts` — ICON_OPTIONS 图标映射表
- `useProject.ts` — ProjectItem 接口（icon 字段为 lucide name string）

### Established Patterns
- Rust 后端通过 `#[tauri::command]` 暴露，前端 `invoke("command_name", { args })` 调用
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- UI 使用 Tailwind CSS utility classes
- 组件使用 shadcn/ui 原语（Dialog, Button, Label 等）
- 不可变更新模式（spread operator）

### Integration Points
- `src-tauri/src/lib.rs:invoke_handler` — 注册新 Rust 命令
- `src/hooks/useProject.ts` — 需要新增项目信息获取函数
- `src/components/MainArea.tsx:162-205` — 项目信息栏区域，需添加文件夹大小和 Git 分支显示
- `src/components/ProjectSettingsDialog.tsx` — 图标选择器，需添加"从项目导入"和"选择文件"功能
- `src/components/Sidebar.tsx` — 项目列表项渲染，需支持文件图标 img 渲染

</code_context>

<specifics>
## Specific Ideas

- .git/HEAD 文件格式：`ref: refs/heads/main\n`（分支时）或 `abc123def...\n`（detached HEAD 时，不显示分支名）
- 文件夹大小显示格式建议：人类可读（如 "12.3 MB"、"1.2 GB"），Rust 端格式化或前端格式化均可
- 排除目录应包含所有常见构建产物/依赖目录：node_modules, .git, target, dist, .next, .cache, build, __pycache__, .venv, .env, .tox, coverage, .terraform, vendor (Go)
- 图标扫描深度：仅扫描项目根目录（不递归子目录），避免性能问题
- ProjectItem.icon 字段需要扩展：目前是 lucide name string，需要能区分 lucide 图标和文件路径图标

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-rust-ui*
*Context gathered: 2026-04-16*
