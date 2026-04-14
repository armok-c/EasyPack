# Phase 5: 项目个性化与键盘增强 - Context

**Gathered:** 2026-04-14
**Updated:** 2026-04-14
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
- **D-02:** 颜色标记以左侧彩色边框展示（3px 宽彩色竖条），叠加在现有 border 上（左 border 用颜色，其他三边保持 white/10），类似 VS Code 侧边栏标记风格
- **D-03:** 图标位于项目名称文字左侧（与文字同一行），类似 VS Code 侧边栏文件图标风格。紧凑不增加行高
- **D-04:** 右键菜单极简化——仅包含"设置图标和颜色"一个选项。ContextMenu 组件在 Sidebar 内部处理，选中结果通过新增 props 回调传给 App 层保存。删除等操作保持现有方式
- **D-05:** 颜色选项为 8 色预设盘（红、橙、黄、绿、蓝、紫、粉、青），以小色块网格形式在设置弹窗中展示
- **D-06:** 设置弹窗布局：上半部分 10 个图标网格（复用 icons.ts），下半部分 8 色预设盘，底部预览区域（显示图标+颜色组合效果）+ 保存/取消按钮

### 拖拽排序
- **D-07:** 拖拽方式为拖拽手柄（非整行拖拽）。项目行左侧显示拖拽手柄图标（GripVertical），按住手柄拖动排序
- **D-08:** 拖拽排序范围仅限侧边栏项目列表。主区域指令卡片不参与拖拽排序
- **D-09:** 拖拽手柄悬停时显示（与 X 删除按钮行为一致，opacity-0 → opacity-100），保持侧边栏默认状态简洁
- **D-10:** 排序持久化方案：直接改变 store 中 projects 数组的元素顺序（数组顺序即排序），不新增 sortIndex 字段或独立排序列表。简单直接
- **D-11:** 拖拽完成后立即保存到 store（onDragEnd 事件触发持久化），非拖拽过程中实时保存

### 键盘导航
- **D-12:** 键盘导航覆盖侧边栏 + 卡片双区域。侧边栏区域用上下箭头切换项目、Enter 选中；卡片区域用方向键移动焦点
- **D-13:** 数字键 1-9 直接触发对应位置的指令卡片（1=第一个指令，2=第二个，以此类推）。最多支持 9 个指令的快捷触发，超出部分鼠标操作
- **D-14:** 焦点指示复用现有 focus-visible:ring-2 样式，侧边栏和卡片区域统一使用 ring 样式。与全局按钮焦点样式一致，零额外代码
- **D-15:** 双区域 Tab 切换模型。Tab 在侧边栏和卡片区域之间切换焦点。进入卡片区域后方向键在卡片网格中移动。清晰的两层焦点模型，非全元素 Tab 循环
- **D-16:** 应用启动后焦点默认在侧边栏（第一个项目或"添加项目"按钮）。用户可以立刻用键盘操作

### Claude's Discretion
- 拖拽库选择（推荐 @dnd-kit，React 生态标准选择）
- 8 色预设盘的具体色值选择
- 拖拽动效和占位符样式
- 卡片网格中方向键的移动方向（纯左右 or 上下左右都支持）
- 侧边栏无项目时的键盘行为
- 项目设置弹窗的具体布局细节（图标网格列数、色块大小、预览区样式）
- ProjectItem 接口扩展（新增 icon?: string 和 color?: string 可选字段）
- 初始焦点的具体实现方式（useEffect + ref focus）
- 编辑模式下数字键是否仍然触发指令
- 卡片焦点切换时是否自动滚动到可视区域

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
- `src/components/Sidebar.tsx` — 当前侧边栏组件（需大量改动：右键菜单、拖拽手柄、图标颜色显示、键盘导航）
- `src/hooks/useProject.ts` — ProjectItem 接口和项目 CRUD（需扩展 icon?、color?、拖拽排序方法、键盘操作方法）
- `src/components/CommandCard.tsx` — 卡片组件（需支持键盘焦点）
- `src/components/MainArea.tsx` — 主区域（需支持键盘导航）
- `src/components/ui/context-menu.tsx` — 已安装的 ContextMenu 组件（用于项目右键菜单）
- `src/components/ui/dialog.tsx` — 已安装的 Dialog 组件（用于设置弹窗）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/icons.ts`: ICON_OPTIONS（10 个 lucide 图标）+ getIconByName() + DEFAULT_ICON。可直接复用于项目图标选择
- `src/components/ui/button.tsx`: 已有 focus-visible:ring-2 样式，键盘导航可直接复用
- `src/components/ui/context-menu.tsx`: 已安装的 ContextMenu 组件，可直接用于项目右键菜单
- `src/components/ui/dialog.tsx`: 已安装的 Dialog 组件，可复用于项目图标颜色设置弹窗
- `src/components/CommandDialog.tsx`: 弹窗参考模式（表单 + 图标选择 + 保存/取消）
- `src/components/ui/scroll-area.tsx`: ScrollArea 组件已在侧边栏使用
- `src/hooks/useProject.ts`: Store 持久化模式成熟，排序持久化可在此基础上扩展

### Established Patterns
- Tailwind 透明度风格：`bg-white/5`、`border-white/10`、`hover:bg-white/10`
- 悬停显示模式：`opacity-0 group-hover:opacity-100`（X 删除按钮、拖拽手柄复用此模式）
- Store 持久化：`await load(STORE_PATH, { autoSave: 100 })` → `await store.set(KEY, VALUE)`
- 弹窗模式：shadcn Dialog + 自定义表单内容 + 实时验证（参考 CommandDialog.tsx）
- 项目 ID：路径规范化（lowercase + forward slashes）
- 组件设计：Sidebar 为纯展示组件（flat props），状态由 App 层管理
- ContextMenu 在 Sidebar 内部处理右键菜单，选择结果通过回调 props 传给 App 层

### Integration Points
- `src/components/Sidebar.tsx`: 主要改动点——右键菜单、拖拽手柄、图标颜色显示、键盘导航
- `src/hooks/useProject.ts`: 需扩展 ProjectItem 接口（icon?, color?）+ 拖拽排序 + 键盘操作方法
- `src/components/CommandCard.tsx`: 需支持键盘焦点和数字键快捷触发
- `src/components/MainArea.tsx`: 需支持 Tab 切换焦点区域 + 方向键导航
- `src/App.tsx`: 需传递新的 props（键盘事件处理器、图标颜色更新回调等）
- 可能需要安装 @dnd-kit/core + @dnd-kit/sortable（拖拽排序）

</code_context>

<specifics>
## Specific Ideas

- 左侧彩色边框类似 VS Code 侧边栏标记风格——轻量且清晰
- 拖拽手柄图标可用 lucide-react 的 GripVertical（6 点拖拽图标）
- 数字键 1-9 直接触发指令类似 VS Code Ctrl+1/2/3 切换编辑器的高效操作
- Tab 切换区域的焦点模型类似 macOS 的全键盘控制（系统对话框 Tab 切换区域）
- 右键菜单极简化（仅"设置图标和颜色"），不过度设计

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---
*Phase: 05-personalization-keyboard*
*Context gathered: 2026-04-14*
*Context updated: 2026-04-14*
