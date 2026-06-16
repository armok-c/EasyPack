# Phase 13 Plan 01 -- SUMMARY

**Phase:** 13-迷你悬浮窗
**Plan:** 01
**Status:** Complete
**Commits:**
- `04b4bf6` feat(13-01): add Vite multi-page build, float HTML entry, and window capabilities
- `46b2f6c` feat(13-01): implement FloatApp component and useFloatWindow hook

## What was done

### Task 1: 基础设施 -- Vite 多页构建 + capabilities + HTML 入口

- **vite.config.ts** -- 添加 `build.rollupOptions.input` 配置，同时输出 `index.html`（主窗口）和 `float.html`（悬浮窗）两个入口
- **float.html** -- 悬浮窗独立 HTML 入口，引用 `float-main.tsx`，不含 favicon 以减少加载开销
- **src/float-main.tsx** -- 悬浮窗 React 渲染入口，将 FloatApp 挂载到 `#float-root`（不使用 StrictMode，轻量级视图无需双重渲染调试）
- **src-tauri/capabilities/default.json** -- 扩展多窗口权限：
  - `windows` 数组添加 `"float"`
  - 新增权限：`core:webview:allow-create-webview-window`、`core:webview:allow-set-webview-size`、`core:window:allow-set-position`、`core:window:allow-set-always-on-top`、`core:window:allow-set-skip-taskbar`、`core:window:allow-is-maximized`、`core:event:default`

### Task 2: 悬浮窗 UI 组件 + 窗口生命周期 Hook

- **src/components/FloatApp.tsx** -- 悬浮窗根组件：
  - 项目名 header + 拖拽移动（`startDragging()`）
  - 指令行列表，每行 32px 高，图标 14px + 指令名
  - 200ms 绿色闪烁反馈（`bg-green-500/20 border border-green-500/40`）
  - 空状态显示（FolderOpen 图标 + "请先在主窗口选择一个项目"）
  - 关闭按钮（X 图标，hover 变红）
  - 通过 `float:state-update` 事件接收项目/指令数据
  - 通过 `emit("float:execute")` 通知主窗口执行指令
  - 无障碍属性：`role="dialog"`、`aria-label`、`aria-live="polite"`

- **src/hooks/useFloatWindow.ts** -- 窗口生命周期管理 hook：
  - `createFloat()` -- 创建 WebviewWindow，设置 alwaysOnTop/skipTaskbar/decorations:false/280px 固定宽度
  - D-08 右上角初始位置（`availableMonitors()` + `LogicalPosition`，考虑 DPI 缩放）
  - `toggleFloat()` -- toggle show/hide，窗口不存在时动态创建
  - `syncState()` -- 通过 `emitTo("float", "float:state-update")` 同步项目/指令状态
  - 自动同步 effect -- 项目/指令变化时推送最新状态
  - `destroyFloat()` -- D-12 主窗口退出时销毁悬浮窗
  - 事件监听清理 -- `unlistenersRef` 收集所有 UnlistenFn，窗口关闭/组件卸载时统一清理
  - Ref 回调模式 -- 防止闭包过时（遵循 useTray.ts 已验证模式）

## Verification

- TypeScript 编译无错误（`npx tsc --noEmit`）
- Vite 构建成功，输出包含 `dist/float.html` 和 `dist/index.html`
- 所有 acceptance_criteria 检查通过

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `vite.config.ts` | modified | 多页构建配置 |
| `float.html` | created | 悬浮窗 HTML 入口 |
| `src/float-main.tsx` | created | 悬浮窗 React 渲染入口 |
| `src/components/FloatApp.tsx` | created | 悬浮窗根组件 |
| `src/hooks/useFloatWindow.ts` | created | 窗口生命周期管理 hook |
| `src-tauri/capabilities/default.json` | modified | 扩展多窗口权限 |

## Next Steps (Plan 02)

Plan 02 需要将 useFloatWindow hook 集成到主窗口：
- App.tsx -- 调用 useFloatWindow，传递 currentProject/commands/onExecute
- TitleBar.tsx -- 新增 PanelTop 按钮，调用 toggleFloat
- useTray.ts -- 托盘菜单添加"打开/关闭悬浮窗"选项
- onCloseRequested -- 退出时调用 destroyFloat
