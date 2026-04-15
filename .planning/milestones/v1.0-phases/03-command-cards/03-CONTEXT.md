# Phase 3: 指令卡片与核心交互 - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

用户选中项目后可在右侧卡片区域点击执行指令，完成"选中项目 → 点击卡片 → 终端执行"核心循环。未选中项目时主区域显示空状态引导。覆盖需求 CMD-01、CMD-02、CMD-03、CMD-08、UI-01、UI-05。

**核心提升：** 从 Phase 1 的基础卡片骨架 → Phase 3 的完善交互体验（执行反馈动效、自适应网格、视觉打磨）。

</domain>

<decisions>
## Implementation Decisions

### 未选中项目时的主区域表现
- **D-01:** 未选中项目时保持空状态引导页（FolderOpen 图标 + "选择一个项目开始" + 提示文字），不改为灰显卡片布局
- **D-02:** 空状态引导页本身就是"禁用"状态的表现形式——用户看不到可点击的指令卡片，引导文字明确提示需要先选项目。满足 CMD-08 核心意图

### 卡片信息密度
- **D-03:** 保持图标 + 名称的紧凑布局，不显示命令文本（如 "npm run build"）。卡片简洁统一，预设指令和自定义指令用同样的展示方式
- **D-04:** 卡片尺寸和样式保持当前 UI-SPEC 定义：`p-4 rounded-xl bg-white/5 border-white/10`

### 执行反馈动效
- **D-05:** 点击卡片执行命令后，卡片有快速视觉反馈（闪光/回弹/边框高亮），然后恢复正常状态。让用户明确感受到"已触发执行"
- **D-06:** 执行中卡片有短暂的动效反馈（如旋转图标/脉冲边框/闪光），即使命令执行很快也提供视觉确认。与 toast 通知配合使用
- **D-07:** 具体动效实现方式由 Claude 决定，保持与 Raycast 视觉风格一致

### 网格布局
- **D-08:** 指令卡片采用自适应列数网格。窗口变宽时自动增加列数，卡片保持固定最大宽度
- **D-09:** 最小窗口宽度（600px）时至少显示 2 列，确保基本布局不被破坏
- **D-10:** 具体的断点和卡片最大宽度由 Claude 决定

### Claude's Discretion
- 执行反馈动效的具体实现（CSS transition / keyframe / 其他方案）
- 卡片最大宽度和自适应断点
- 是否需要 Tooltip 补充信息（如悬停显示命令文本）
- 项目信息区域的展示方式（当前"当前项目: {name}" + 路径是否需要调整）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 技术栈与 UI 规范
- `CLAUDE.md` — 完整技术栈选型、shadcn/ui 配置、Tailwind CSS v4 用法
- `.planning/phases/01-shell/01-UI-SPEC.md` — 完整 UI 设计规范（间距、颜色、字体、动效、组件状态）

### 需求定义
- `.planning/REQUIREMENTS.md` — Phase 3 需求：CMD-01, CMD-02, CMD-03, CMD-08, UI-01, UI-05
- `.planning/ROADMAP.md` §Phase 3 — 阶段目标、成功标准、计划列表

### 前序阶段上下文（必须了解的决策）
- `.planning/phases/01-shell/01-CONTEXT.md` — D-05（主区域布局）、D-10（toast 提示）、D-12（4 个预设命令）、D-19（空状态引导）、D-20（Raycast 视觉风格）
- `.planning/phases/02-sidebar-persistence/02-CONTEXT.md` — D-05（选中后主区域立即更新）

### 已知风险
- `.planning/STATE.md` §Blockers/Concerns — Windows 路径空格/中文处理

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/CommandCard.tsx`: 已有基础卡片组件，含 hover/active/disabled 状态和 CSS transition。需要增强：执行反馈动效、自适应宽度支持
- `src/lib/presets.ts`: 已定义 4 个预设命令（PresetCommand 接口 + PRESET_COMMANDS 数组）。数据结构已就绪
- `src/components/MainArea.tsx`: 已实现选中/未选中两种状态。未选中时显示空状态引导页（符合 D-01 决策）。选中时显示项目信息 + 卡片网格
- `src/hooks/useProject.ts`: executeCommand 函数已就绪，含 toast 成功/失败提示。currentProject 派生状态可直接用于卡片 disabled 控制
- `src/components/ui/button.tsx`: shadcn/ui Button 组件
- `src/components/ui/sonner.tsx`: Toast 组件已集成

### Established Patterns
- Tailwind 透明度风格：`bg-white/5`、`border-white/10`、`hover:bg-white/10`
- 卡片样式：`flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10`
- 动效：CSS `transition-all duration-150 ease-out`，hover scale(1.02)，active scale(0.98)
- 图标：lucide-react，图标尺寸 `size-6`
- Toast：`toast.success()` / `toast.error()`，duration 1500ms
- 网格：`grid grid-cols-2 gap-3`（当前固定 2 列）

### Integration Points
- `src/components/MainArea.tsx`: 主要改动点 — 网格从固定 2 列改为自适应列数
- `src/components/CommandCard.tsx`: 需要增加执行反馈动效（点击后的闪光/回弹效果）
- `src/App.tsx`: 无需改动（props 接口不变）

</code_context>

<specifics>
## Specific Ideas

- 执行反馈可参考 Raycast 的卡片点击效果：短暂边框高亮 + 微弱闪光
- 自适应网格可使用 CSS Grid 的 `auto-fill` + `minmax()` 实现纯 CSS 响应式

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-command-cards*
*Context gathered: 2026-04-13*
