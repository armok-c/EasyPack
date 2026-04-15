# Phase 2: 项目侧边栏与持久化 - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以在侧边栏管理项目列表（展示、选中切换、删除），并将项目数据（列表、排序、选中状态）持久化到本地存储，重启后完整恢复。覆盖需求 PROJ-02、PROJ-03、PROJ-04、DATA-01、DATA-03。

**核心变更：** Phase 1 的单项目模式 → Phase 2 的多项目列表模式。

</domain>

<decisions>
## Implementation Decisions

### 项目列表渲染
- **D-01:** 侧边栏展示多个项目，使用 ScrollArea 组件（已安装）支持滚动
- **D-02:** 项目排列顺序为添加时间顺序，新添加的项目在列表底部（Phase 5 加入拖拽排序）
- **D-03:** 每个项目只显示文件夹名称（沿用 Phase 1 D-14），不显示完整路径
- **D-04:** 重复项目处理：检测到已存在路径时显示 toast 提示"项目已存在"，不重复添加

### 项目选中交互
- **D-05:** 点击侧边栏项目即可选中，选中后主区域立即更新显示该项目
- **D-06:** 选中的项目有明显的视觉反馈：`bg-white/10` + `border-white/20`（在 Phase 1 的 `bg-white/5` + `border-white/10` 基础上加强）
- **D-07:** 未选中项目使用微弱背景（`bg-white/5` 或透明），与选中状态形成对比
- **D-08:** 未选中项目悬停时显示轻微背景变化（`bg-white/[0.08]`）+ 显示 X 删除按钮

### 项目删除交互
- **D-09:** 悬停项目时右侧出现 X 图标按钮，点击直接删除（无确认弹窗）
- **D-10:** 删除当前选中项目后，自动选中列表中邻近的项目（优先下一个，无下一个则选上一个）
- **D-11:** 删除最后一个项目后回到空状态（沿用 Phase 1 D-21 空状态引导）

### 数据持久化
- **D-12:** 使用 tauri-plugin-store + autoSave 进行持久化（ROADMAP 已锁定）
- **D-13:** 持久化数据包括：项目列表（name + path + 添加时间）、选中项目 ID、项目排列顺序
- **D-14:** 应用启动时从 store 恢复项目列表和选中状态

### Claude's Discretion
- Store 的 key 命名和数据 schema 设计
- useProject hook 的重构方式（从 useState → store-backed state）
- 项目 ID 生成策略（path 作为唯一标识 vs UUID）
- X 按钮的具体位置和尺寸
- 持久化失败时的降级处理

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 技术栈定义
- `CLAUDE.md` — 完整技术栈选型、tauri-plugin-store 在依赖列表中
- `.planning/research/STACK.md` — 技术栈研究详情

### 需求定义
- `.planning/REQUIREMENTS.md` — Phase 2 需求：PROJ-02, PROJ-03, PROJ-04, DATA-01, DATA-03
- `.planning/ROADMAP.md` §Phase 2 — 阶段目标、成功标准、计划列表

### Phase 1 上下文（必须了解的决策）
- `.planning/phases/01-shell/01-CONTEXT.md` — D-04（侧边栏始终可见）、D-14（仅显示文件夹名）、D-15（添加按钮在顶部）、D-16（选中后立即切换）、D-21（空状态引导）

### 已知风险
- `.planning/STATE.md` §Blockers/Concerns — Windows 路径空格/中文处理

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Sidebar.tsx`: 现有侧边栏组件，需从单项目模式重构为多项目列表。布局和样式模式可复用
- `src/components/ui/scroll-area.tsx`: 已安装的 ScrollArea 组件，可直接用于项目列表滚动
- `src/components/ui/button.tsx`: Button 组件，用于"添加项目"和 X 删除按钮
- `src/hooks/useProject.ts`: 现有 hook，需从 `useState<Project | null>` 重构为多项目管理 + store 持久化
- `src/components/ui/sonner.tsx` + `sonner` 库: Toast 提示已集成，可直接用于"项目已存在"等提示

### Established Patterns
- 侧边栏宽度 `w-[240px]`，样式 `border-r border-white/10 bg-black/40 backdrop-blur-sm`
- 项目卡片样式 `px-2 py-2 rounded-lg bg-white/5 border border-white/10`
- Tailwind 透明度风格：`bg-white/5`、`border-white/10`、`hover:bg-white/10`
- 使用 lucide-react 图标，已有 FolderOpen、Plus 等
- Toast 使用 `toast.success()` / `toast.error()`，duration 1500ms

### Integration Points
- `App.tsx`: 需更新 Sidebar 和 MainArea 的 props 接口（从单个项目 → 项目列表 + 选中项目）
- `src-tauri/src/lib.rs`: 需注册 tauri-plugin-store 插件
- `src-tauri/Cargo.toml`: 需添加 `tauri-plugin-store` 依赖
- 前端需安装 `@tauri-apps/plugin-store` npm 包

</code_context>

<specifics>
## Specific Ideas

- 无特定外部参考 — 所有决策基于 Phase 1 已建立的模式和组件

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-sidebar-persistence*
*Context gathered: 2026-04-12*
