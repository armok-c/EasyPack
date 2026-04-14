# Phase 5: 项目个性化与键盘增强 - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以个性化项目外观（图标、颜色标记）并通过拖拽调整排序，同时通过键盘高效完成侧边栏项目切换和指令卡片触发的所有核心操作。覆盖需求 PROJ-05、PROJ-06、UI-03。

**核心提升：** 从 Phase 4 的纯鼠标操作 → Phase 5 的视觉个性化 + 键盘高效操作。

</domain>

<decisions>
## Implementation Decisions

### 项目图标与颜色标记
- **D-01:** 项目图标复用 lucide-react 预设图标体系（icons.ts 已有的 10 个图标：Terminal, Code, Server, Zap, GitBranch, Package, Globe, Wrench, Rocket, Play），与指令图标选择体验统一
- **D-02:** 颜色标记以左侧彩色边框展示（3px 宽彩色竖条），类似 VS Code 侧边栏标记风格。不影响现有布局，视觉清晰且轻量
- **D-03:** 图标和颜色设置入口为右键菜单 + 弹窗。侧边栏项目右键弹出上下文菜单，包含"设置图标和颜色"选项，点击后打开设置弹窗
- **D-04:** 颜色选项为 8 色预设盘（红、橙、黄、绿、蓝、紫、粉、青），以小色块网格形式在设置弹窗中展示

### 拖拽排序
- **D-05:** 拖拽方式为拖拽手柄（非整行拖拽）。项目行左侧显示拖拽手柄图标（GripVertical），按住手柄拖动排序
- **D-06:** 拖拽排序范围仅限侧边栏项目列表。主区域指令卡片不参与拖拽排序
- **D-07:** 拖拽手柄悬停时显示（与 X 删除按钮行为一致，opacity-0 → opacity-100），保持侧边栏默认状态简洁

### 键盘导航
- **D-08:** 键盘导航覆盖侧边栏 + 卡片双区域。侧边栏区域用上下箭头切换项目、Enter 选中；卡片区域用方向键移动焦点
- **D-09:** 数字键 1-9 直接触发对应位置的指令卡片（1=第一个指令，2=第二个，以此类推）。最多支持 9 个指令的快捷触发
- **D-10:** 焦点指示复用现有 focus-visible:ring-2 样式，与全局按钮焦点样式一致，零额外代码
- **D-11:** Tab 键在侧边栏和卡片区域之间切换焦点。进入卡片区域后方向键在卡片网格中移动。清晰的两层焦点模型

### Claude's Discretion
- 拖拽库选择（推荐 @dnd-kit，React 生态标准选择）
- 右键菜单实现方案（shadcn ContextMenu 或 DropdownMenu）
- 8 色预设盘的具体色值选择
- 拖拽动效和占位符样式
- 卡片网格中方向键的移动方向（纯左右 or 上下左右都支持）
- 侧边栏无项目时的键盘行为
- 项目设置弹窗的具体布局
- 排序持久化数据格式（在现有 projects 数组基础上扩展）
- ProjectItem 接口扩展（新增 icon? 和 color? 可选字段）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 技术栈与 UI 规范
- `CLAUDE.md` — 完整技术栈选型、shadcn/ui 配置、Tailwind CSS v4 用法
- `.planning/phases/01-shell/01-UI-SPEC.md` — 完整 UI 设计规范（间距、颜色、字体、动效、组件状态）

### 需求定义
- `.planning/REQUIREMENTS.md` — Phase 5 需求：PROJ-05, PROJ-06, UI-03
- `.planning/ROADMAP.md` Phase 5 — 阶段目标、成功标准、计划列表

### 前序阶段上下文（必须了解的决策）
- `.planning/phases/02-sidebar-persistence/02-CONTEXT.md` — D-12（tauri-plugin-store 持久化模式）、D-13（持久化数据格式）、Sidebar flat props 模式
- `.planning/phases/03-command-cards/03-CONTEXT.md` — D-03（卡片紧凑布局）、D-04（卡片样式）、自适应网格
- `.planning/phases/04-custom-commands/04-CONTEXT.md` — 编辑模式、CommandItem 数据结构、Dialog 弹窗模式、右键菜单模式

### 现有代码
- `src/lib/icons.ts` — 已有 10 个 lucide 图标选项 + getIconByName 函数
- `src/components/Sidebar.tsx` — 当前侧边栏组件（需大量改动）
- `src/hooks/useProject.ts` — ProjectItem 接口和项目 CRUD（需扩展）
- `src/components/CommandCard.tsx` — 卡片组件（需支持键盘焦点）
- `src/components/MainArea.tsx` — 主区域（需支持键盘导航）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/icons.ts`: ICON_OPTIONS（10 个 lucide 图标）+ getIconByName() + DEFAULT_ICON。可直接复用于项目图标选择
- `src/components/ui/button.tsx`: 已有 focus-visible:ring-2 样式，键盘导航可直接复用
- `src/components/CommandDialog.tsx`: shadcn/ui Dialog 弹窗，可作为项目设置弹窗的参考模式
- `src/components/ui/scroll-area.tsx`: ScrollArea 组件已在侧边栏使用
- `src/hooks/useProject.ts`: Store 持久化模式成熟，排序持久化可在此基础上扩展

### Established Patterns
- Tailwind 透明度风格：`bg-white/5`、`border-white/10`、`hover:bg-white/10`
- 悬停显示模式：`opacity-0 group-hover:opacity-100`（X 删除按钮、拖拽手柄复用此模式）
- Store 持久化：`await load(STORE_PATH, { autoSave: 100 })` → `await store.set(KEY, VALUE)`
- 弹窗模式：shadcn Dialog + 自定义表单内容 + 实时验证
- 项目 ID：路径规范化（lowercase + forward slashes）
- 组件设计：Sidebar 为纯展示组件（flat props），状态由 App 层管理

### Integration Points
- `src/components/Sidebar.tsx`: 主要改动点——右键菜单、拖拽手柄、图标颜色显示、键盘导航
- `src/hooks/useProject.ts`: 需扩展 ProjectItem 接口（icon?, color?）+ 排序持久化 + 键盘操作方法
- `src/components/CommandCard.tsx`: 需支持键盘焦点和数字键快捷触发
- `src/components/MainArea.tsx`: 需支持 Tab 切换焦点区域 + 方向键导航
- `src/App.tsx`: 可能需要传递新的 props（键盘事件处理器等）
- 可能需要安装 shadcn/ui ContextMenu 组件（右键菜单）
- 可能需要安装 @dnd-kit/core + @dnd-kit/sortable（拖拽排序）

</code_context>

<specifics>
## Specific Ideas

- 左侧彩色边框类似 VS Code 侧边栏标记风格——轻量且清晰
- 拖拽手柄图标可用 lucide-react 的 GripVertical（6 点拖拽图标）
- 数字键 1-9 直接触发指令类似 VS Code Ctrl+1/2/3 切换编辑器的高效操作
- Tab 切换区域的焦点模型类似 macOS 的全键盘控制（系统对话框 Tab 切换区域）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-personalization-keyboard*
*Context gathered: 2026-04-14*
