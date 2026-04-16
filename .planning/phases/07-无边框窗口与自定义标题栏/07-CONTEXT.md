# Phase 7: 无边框窗口与自定义标题栏 - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

将 Tauri 窗口设为无边框模式（decorations: false），创建 React 自定义标题栏组件（含应用图标、名称、拖拽区域、最小化/最大化/关闭按钮），确保窗口 resize 和阴影正常工作，高 DPI 显示清晰。仅涉及窗口外观和交互，不改变现有业务逻辑和数据处理。

</domain>

<decisions>
## Implementation Decisions

### 标题栏视觉风格
- **D-01:** 标题栏高度 28px（紧凑风格），适配当前窗口最小高度 400px，最大化内容区域空间
- **D-02:** 无边界融合风格 — 标题栏与内容区域使用相同背景色，无分割线，整体视觉连贯。匹配当前 Raycast 风格暗色渐变背景
- **D-03:** 窗口控制按钮使用半透明图标，默认几乎不可见，hover 时显示背景高亮。三个按钮位于标题栏右侧：最小化（─）、最大化（□）、关闭（×）

### 标题栏显示内容
- **D-04:** 标题栏左侧显示应用图标（小圆角方形）+ 应用名称 "EasyPack"。图标使用 Tauri 应用图标或自定义小尺寸 SVG

### 拖拽区域与 Resize
- **D-05:** 拖拽区域仅限标题栏整行（除窗口控制按钮外），使用 `data-tauri-drag-region` 属性标记。侧边栏顶部不可拖拽
- **D-06:** Resize 使用 Tauri 内置能力，利用 Windows 原生 WM_NCHITTEST 通过窗口边缘拖拽调整大小。行为与原生窗口一致，无需自定义 CSS/JS
- **D-07:** 窗口阴影使用系统默认行为（Windows 11 DWM 自动添加圆角阴影），不额外强制设置。Windows 10 可能无阴影，属可接受行为

### Claude's Discretion
- 标题栏组件的具体 HTML 结构和 Tailwind CSS 类名
- 窗口控制按钮的图标选择（lucide-react 的 Minus / Square / X 或其他图标库）
- 应用图标的具体来源和尺寸（Tauri 内置图标、自定义 SVG、或 lucide-react Package 图标）
- 高 DPI 相关的 Tauri 配置细节（如 webview 缩放策略）
- 是否处理双击标题栏最大化（标准 Windows 行为，Tauri 可能自动支持）
- 标题栏组件的文件命名和放置位置

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Window Configuration
- `src-tauri/tauri.conf.json` — 当前窗口配置，需改为 `decorations: false` 并可能添加 `shadow: true`
- `src/App.tsx` — 根布局组件，需插入标题栏组件到 `flex h-screen` 布局顶部

### Theme & Styling
- `src/index.css` — 深色主题 oklch 颜色变量（Zinc dark theme），标题栏需使用相同色系保持融合

### Requirements
- `.planning/REQUIREMENTS.md` — WIN-01（自定义标题栏）、WIN-02（阴影和 resize）、WIN-03（高 DPI）

### Tauri 2 Window Documentation
- [Tauri 2 Window Configuration](https://v2.tauri.app/reference/config/#windowconfig) — decorations, shadow, drag region 配置
- [Tauri 2 Window Customization](https://v2.tauri.app/learn/window-customization/) — 无边框窗口和自定义标题栏实现指南

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn/ui Button 组件，可复用于窗口控制按钮的变体样式
- `src/lib/icons.ts` — 现有图标映射，新增窗口控制图标可在此添加
- `src/index.css` — oklch 颜色变量体系，标题栏直接引用保持一致性
- `lucide-react` — 已安装的图标库，提供 Minus / Square / X 等图标

### Established Patterns
- 组件放在 `src/components/` 目录，UI 原语放在 `src/components/ui/`
- 根布局在 `App.tsx` 中使用 `flex h-screen w-screen overflow-hidden`
- 深色主题通过 CSS 变量 + oklch 色值管理
- Tauri 命令通过 `invoke()` 调用 Rust 后端

### Integration Points
- `App.tsx:49` — `<div className="flex h-screen w-screen overflow-hidden">` 是根容器，标题栏需插入此 flex 布局最顶部，将 `h-screen` 改为 `flex-col` 嵌套
- `tauri.conf.json:13-23` — 窗口配置区，需添加 `"decorations": false` 和可能的 `"shadow": true`
- `src-tauri/src/lib.rs` — Rust 后端入口，如需额外的窗口控制命令（如最小化/最大化/关闭的 invoke 调用）在此注册

</code_context>

<specifics>
## Specific Ideas

- 标题栏设计灵感：类似 Raycast / Arc Browser 的无边框融合风格，标题栏是内容的一部分而非独立区域
- 窗口控制按钮行为应严格遵循 Windows 标准：单击最小化收到底栏，单击最大化/还原切换，单击关闭退出应用
- 28px 高度在 1x DPI 下可能显得紧凑，需确保 1.5x 和 2x DPI 下按钮仍可点击

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-无边框窗口与自定义标题栏*
*Context gathered: 2026-04-16*
