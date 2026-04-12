# Phase 1: 应用脚手架与 Shell 命令核心 - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以启动应用，选择一个本地文件夹，点击按钮在系统终端中执行命令，深色主题和自适应布局就位。覆盖需求 PROJ-01、CMD-04、UI-02、UI-04、UI-06。

</domain>

<decisions>
## Implementation Decisions

### 应用窗口与布局
- **D-01:** 默认窗口尺寸 720×480（紧凑窗口）
- **D-02:** 最小窗口尺寸 600×400，防止布局挤压
- **D-03:** 每次启动使用默认位置和大小，不记忆上次窗口状态
- **D-04:** 侧边栏始终可见（包括 Phase 1），为 Phase 2 做布局铺垫
- **D-05:** 主区域布局为上方显示当前项目路径 + 下方按钮区域
- **D-06:** 侧边栏宽度由实现时决定（Claude discretion）

### 终端命令执行体验
- **D-07:** 优先使用 Windows Terminal 打开命令，未安装时回退到 cmd.exe
- **D-08:** 每次执行打开独立的新终端窗口
- **D-09:** 命令执行后终端保持打开（使用 /K 参数），用户可查看输出或继续操作
- **D-10:** 应用内显示轻量 toast 提示（如"已执行: npm run build"），1-2 秒后消失
- **D-11:** 自动 cd 到选中的项目目录再执行命令
- **D-12:** Phase 1 预设全部 4 个内置命令按钮：打包项目（npm run build）、启动项目（npm run dev）、Git Pull、启动 Claude
- **D-13:** Windows 路径包含空格或中文的处理方式由实现时决定（Claude discretion）

### 文件夹选择器交互
- **D-14:** 选择文件夹后仅显示文件夹名称（如"EasyPack"），不显示完整路径
- **D-15:** "添加项目"按钮位于侧边栏顶部
- **D-16:** 选择文件夹后立即选中该项目，命令按钮立即可用
- **D-17:** 再次选择文件夹时替换当前项目（Phase 1 只维护一个当前项目）
- **D-18:** 不能取消选中，只能通过选择新项目来替换

### 空状态与首屏
- **D-19:** 首次启动主区域显示简约引导（提示文字 + 图示），引导用户选择项目
- **D-20:** 深色主题采用 Raycast 风格（渐变背景 + 半透明元素），定义全局 CSS 变量
- **D-21:** 未选择项目时侧边栏显示图标 + "还没有项目"文字 + "添加项目"按钮

### Claude's Discretion
- 侧边栏具体宽度（建议 200-260px 范围）
- Windows 路径空格/中文的 Shell 转义处理方案
- Toast 组件的具体实现（shadcn/ui Sonner 或自定义）
- 渐变背景的具体色值和方向

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 技术栈定义
- `CLAUDE.md` — 完整技术栈选型（Tauri 2 + React 19 + TS 5.7 + Vite 6 + Tailwind CSS 4 + shadcn/ui）、版本兼容性、安装步骤
- `.planning/research/STACK.md` — 技术栈研究详情
- `.planning/research/ARCHITECTURE.md` — 架构决策研究

### 需求定义
- `.planning/REQUIREMENTS.md` — Phase 1 需求：PROJ-01, CMD-04, UI-02, UI-04, UI-06
- `.planning/ROADMAP.md` §Phase 1 — 阶段目标、成功标准、计划列表

### 已知风险
- `.planning/STATE.md` §Blockers/Concerns — Capabilities 权限配置、Shell 参数组合、Windows 路径问题

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 无现有代码（全新项目）

### Established Patterns
- 无（Phase 1 将建立初始模式）

### Integration Points
- Tauri Rust 后端：需实现自定义命令（#[tauri::command]）用于 Shell 执行
- Tauri 前端：通过 @tauri-apps/api invoke() 调用 Rust 命令
- Tauri Dialog 插件：用于文件夹选择器
- shadcn/ui：用于 Button、Toast 等基础组件

</code_context>

<specifics>
## Specific Ideas

- 深色主题参考 Raycast 的视觉风格：渐变背景、半透明元素、现代感
- 4 个预设命令卡片为最终产品的核心形态，Phase 1 提前展示
- 窗口紧凑小巧，适合常驻屏幕角落使用

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-shell*
*Context gathered: 2026-04-12*
