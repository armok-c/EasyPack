# Phase 13: 迷你悬浮窗 - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

创建一个独立的始终置顶迷你窗口，显示当前选中项目的全部指令按钮。用户可从主窗口 TitleBar 按钮或托盘菜单打开悬浮窗，点击按钮直接在系统终端执行指令，独立关闭不影响主窗口。悬浮窗为无边框设计，竖向列表布局，可拖拽移动。

涉及需求: FLOAT-01, FLOAT-02, FLOAT-03, FLOAT-04, FLOAT-05, FLOAT-06, FLOAT-07

</domain>

<decisions>
## Implementation Decisions

### 悬浮窗内容范围
- **D-01:** 显示全部指令 — 当前项目的所有指令（全局 + 项目级覆盖合并后的完整列表），与主窗口看到的完全一致
- **D-02:** 自动高度 + 滚动 — 窗口高度随指令数量自动增长，设最大高度（如 600px），超过后出现滚动条
- **D-03:** 显示项目名 — 悬浮窗顶部显示当前项目名，主窗口切换项目时实时更新

### 悬浮窗外观与布局
- **D-04:** 竖向列表 — 每个指令占一整行，图标 + 指令名横向排列，类似小型 Launcher 面板
- **D-05:** 固定宽度 280px — 紧凑不占屏，刚好放下图标 + 指令名
- **D-06:** 可拖拽移动 — 用户可以拖拽悬浮窗在屏幕上自由移动
- **D-07:** 无边框 + 窄拖拽区 — 和主窗口风格一致，顶部窄拖拽区域 + 右侧小关闭按钮
- **D-08:** 初始位置屏幕右上角 — 每次打开默认出现在屏幕右上角

### 打开入口位置
- **D-09:** TitleBar 齿轮按钮左侧加悬浮窗图标按钮 — 点击 toggle 切换悬浮窗显示/隐藏
- **D-10:** 托盘菜单窗口操作区域内加"打开/关闭悬浮窗"选项 — 放在"显示/隐藏窗口"项下方

### 悬浮窗行为细节
- **D-11:** 不记住位置 — 每次打开默认右上角（FLOAT-09 为未来需求）
- **D-12:** 主窗口关闭到托盘时悬浮窗独立存活，主窗口退出时悬浮窗一起关闭
- **D-13:** 无项目时显示空状态提示"请先在主窗口选择一个项目"，指令按钮全部禁用灰显
- **D-14:** 应用启动时不自动打开悬浮窗，必须手动打开
- **D-15:** TitleBar 按钮和托盘选项为 toggle 切换行为（打开↔关闭）

### 指令按钮交互
- **D-16:** 不显示快捷键徽章 — 悬浮窗空间紧凑，不显示已绑定的快捷键
- **D-17:** 短暂闪烁反馈 — 点击按钮后该按钮短暂变色（如 200ms 绿色闪烁），确认已触发执行

### Claude's Discretion
- 悬浮窗 HTML 入口的实现方式（Vite 多页面 vs query param 切换 vs 独立入口）
- 主窗口与悬浮窗之间的状态同步机制（Tauri event system vs shared store）
- 悬浮窗窗口创建的时机和生命周期管理
- 悬浮窗内部组件的具体实现（指令按钮组件、空状态组件）
- 拖拽区域的实现方式（data-tauri-drag-region vs startDragging）
- 悬浮窗关闭按钮的样式和位置细节
- tauri.conf.json 中的窗口属性配置（alwaysOnTop, skipTaskbar, decorations, minWidth/maxWidth 等）
- Vite 多页面构建配置（如果选择多页面方案）
- capabilities/default.json 需要追加的多窗口相关权限

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/components/TitleBar.tsx` — 新增悬浮窗图标按钮（齿轮左侧）
- `src/App.tsx` — 悬浮窗创建/销毁/状态同步管理
- `src/hooks/useTray.ts` — 托盘菜单添加"打开/关闭悬浮窗"选项
- `src-tauri/tauri.conf.json` — 悬浮窗窗口属性配置或运行时动态创建
- `src-tauri/capabilities/default.json` — 追加多窗口相关权限

### 新增文件
- 悬浮窗入口 HTML（如 `float.html`）— 悬浮窗独立页面入口
- 悬浮窗入口 TS（如 `float-main.tsx`）— React 渲染入口
- 悬浮窗根组件（如 `FloatApp.tsx`）— 悬浮窗 UI（项目名 + 指令列表 + 关闭按钮）
- `src/hooks/useFloatWindow.ts` — 悬浮窗创建/显示/隐藏/销毁管理

### Tauri 官方文档
- Tauri v2 Multi-Window — https://v2.tauri.app/learn/multi-window/ （WebviewWindow API）
- Tauri v2 Window API — https://v2.tauri.app/reference/javascript/api/namespacewindow/ （setAlwaysOnTop, setSkipTaskbar, onCloseRequested）
- Tauri v2 Events — https://v2.tauri.app/develop/calling-rust/#events （窗口间通信）

### 现有模式参考
- `src/components/TitleBar.tsx` — 齿轮按钮模式，新按钮参照同样风格
- `src/hooks/useTray.ts` — 托盘菜单构建模式，追加悬浮窗选项
- `src/hooks/useVisibilityState.ts` — 可见性状态机（需扩展 DRAWER_HIDDEN 为 Phase 14 铺路）
- `src/hooks/useProject.ts` — executeCommand 执行链路，悬浮窗指令执行复用同一路径
- `src/components/CommandCard.tsx` — 指令卡片样式参考（悬浮窗按钮可简化版）
- `src/components/SettingsDialog.tsx` — 弹窗模式参考

### Prior Phase Context
- `.planning/phases/12-系统托盘/12-CONTEXT.md` — 直接依赖阶段，托盘菜单、TitleBar 改造、设置弹窗
- `.planning/phases/11-全局快捷键/11-CONTEXT.md` — 全局快捷键在悬浮窗模式下仍然生效

### Spike Findings
- `.planning/spikes/001-minimal-tray-api/README.md` — Tauri 2 JS API 验证结论（PredefinedMenuItem 参数格式、showMenuOnLeftClick 等）

### Requirements
- `.planning/REQUIREMENTS.md` — FLOAT-01 ~ FLOAT-07
- `.planning/ROADMAP.md` — Phase 13 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useProject.ts` — executeCommand(projectPath, shellCommand) 执行链路完整，悬浮窗指令执行可复用同一路径
- `useVisibilityState.ts` — 已有 VISIBLE / TRAY_HIDDEN 状态，需为 Phase 14 预留 DRAWER_HIDDEN
- `TitleBar.tsx` — 已有齿轮按钮（Settings icon）、窗口控制按钮布局，新增悬浮窗按钮参照同样模式
- `useTray.ts` — 已有 buildMenu 函数动态构建托盘菜单，可追加悬浮窗选项
- `tauri-plugin-store` — 已配置 autoSave，悬浮窗相关设置可通过同一 store 持久化
- `CommandCard.tsx` — 指令卡片组件，悬浮窗按钮可作为简化版复用

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- Hook 生命周期管理（useEffect + cleanup return）
- UI 使用 Tailwind CSS utility classes + shadcn/ui 原语
- 无边框窗口 + startDragging() 拖拽（主窗口已验证）
- TitleBar 按钮使用 lucide-react 图标

### Integration Points
- `src-tauri/tauri.conf.json` — 悬浮窗窗口配置（动态创建 vs 静态声明）
- `vite.config.ts` — 可能需要改为多页面配置（添加 float.html 入口）
- `src/App.tsx` — 悬浮窗创建/销毁生命周期管理
- `src/components/TitleBar.tsx` — 新增悬浮窗 toggle 按钮
- `src/hooks/useTray.ts` — buildMenu 中追加悬浮窗选项
- `src/hooks/useVisibilityState.ts` — 可能需要扩展状态类型
- `src-tauri/capabilities/default.json` — 追加 webview create/show/hide 权限

</code_context>

<specifics>
## Specific Ideas

- 悬浮窗按钮使用 PanelTop (lucide-react) 图标，暗示"浮动面板"
- 悬浮窗拖拽区域建议使用 startDragging() 而非 data-tauri-drag-region（与主窗口一致，Windows 上更可靠）
- 悬浮窗关闭按钮建议小型 X 按钮，位于右上角拖拽区域内
- 空状态文字建议简洁："选择一个项目以开始"
- 执行反馈闪烁建议使用 Tailwind 的 `animate-ping` 或自定义 transition

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-迷你悬浮窗*
*Context gathered: 2026-04-29*
