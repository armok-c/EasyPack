# Phase 13: 迷你悬浮窗 - Research

**Researched:** 2026-04-29
**Domain:** Tauri v2 多窗口 / WebviewWindow 动态创建 / 跨窗口事件通信
**Confidence:** HIGH

## Summary

Phase 13 为 EasyPack 添加一个始终置顶的迷你悬浮窗，显示当前项目的全部指令按钮，点击即可在系统终端执行。核心技术路径：使用 Tauri v2 的 `WebviewWindow` API 在运行时动态创建第二个窗口，通过 Tauri 事件系统（`emit`/`emitTo`/`listen`）实现主窗口与悬浮窗之间的实时状态同步。悬浮窗是一个独立的 HTML 入口，由 Vite 多页构建配置提供。

不需要新增任何 npm 或 Rust 依赖。所有窗口管理能力已包含在现有的 `@tauri-apps/api` v2.10.x 中。核心改造集中在：前端新增 `useFloatWindow` hook 管理窗口生命周期、修改 `TitleBar` 和 `useTray` 添加切换入口、Vite 配置多页构建、Tauri capabilities 扩展多窗口权限。

**Primary recommendation:** 使用 Vite 多页构建方案创建独立 `float.html` 入口，运行时通过 `new WebviewWindow()` 创建窗口，Tauri 事件系统同步项目/指令状态，主窗口 `invoke("execute_command")` 执行指令。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 显示全部指令 -- 当前项目的所有指令（全局 + 项目级覆盖合并后的完整列表），与主窗口看到的完全一致
- **D-02:** 自动高度 + 滚动 -- 窗口高度随指令数量自动增长，设最大高度（如 600px），超过后出现滚动条
- **D-03:** 显示项目名 -- 悬浮窗顶部显示当前项目名，主窗口切换项目时实时更新
- **D-04:** 竖向列表 -- 每个指令占一整行，图标 + 指令名横向排列，类似小型 Launcher 面板
- **D-05:** 固定宽度 280px -- 紧凑不占屏，刚好放下图标 + 指令名
- **D-06:** 可拖拽移动 -- 用户可以拖拽悬浮窗在屏幕上自由移动
- **D-07:** 无边框 + 窄拖拽区 -- 和主窗口风格一致，顶部窄拖拽区域 + 右侧小关闭按钮
- **D-08:** 初始位置屏幕右上角 -- 每次打开默认出现在屏幕右上角
- **D-09:** TitleBar 齿轮按钮左侧加悬浮窗图标按钮 -- 点击 toggle 切换悬浮窗显示/隐藏
- **D-10:** 托盘菜单窗口操作区域内加"打开/关闭悬浮窗"选项 -- 放在"显示/隐藏窗口"项下方
- **D-11:** 不记住位置 -- 每次打开默认右上角（FLOAT-09 为未来需求）
- **D-12:** 主窗口关闭到托盘时悬浮窗独立存活，主窗口退出时悬浮窗一起关闭
- **D-13:** 无项目时显示空状态提示"请先在主窗口选择一个项目"，指令按钮全部禁用灰显
- **D-14:** 应用启动时不自动打开悬浮窗，必须手动打开
- **D-15:** TitleBar 按钮和托盘选项为 toggle 切换行为（打开<->关闭）
- **D-16:** 不显示快捷键徽章 -- 悬浮窗空间紧凑，不显示已绑定的快捷键
- **D-17:** 短暂闪烁反馈 -- 点击按钮后该按钮短暂变色（如 200ms 绿色闪烁），确认已触发执行

### Claude's Discretion
- 悬浮窗 HTML 入口的实现方式（Vite 多页面 vs query param 切换 vs 独立入口）
- 主窗口与悬浮窗之间的状态同步机制（Tauri event system vs shared store）
- 悬浮窗窗口创建的时机和生命周期管理
- 悬浮窗内部组件的具体实现（指令按钮组件、空状态组件）
- 拖拽区域的实现方式（data-tauri-drag-region vs startDragging）
- tauri.conf.json 中的窗口属性配置（alwaysOnTop, skipTaskbar, decorations, minWidth/maxWidth 等）
- Vite 多页面构建配置（如果选择多页面方案）
- capabilities/default.json 需要追加的多窗口相关权限

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLOAT-01 | User can open a mini floating window from main window toolbar or tray menu | WebviewWindow API 动态创建窗口；TitleBar 按钮入口（D-09）+ 托盘菜单入口（D-10）|
| FLOAT-02 | Floating window displays command buttons for the currently selected project | Tauri 事件系统同步 currentProject + commands；竖向列表布局（D-04）|
| FLOAT-03 | Floating window stays always on top of other windows | WebviewWindow options: `alwaysOnTop: true` [VERIFIED: Tauri v2 API docs] |
| FLOAT-04 | Floating window does not appear in the Windows taskbar | WebviewWindow options: `skipTaskbar: true` [VERIFIED: Tauri v2 API docs] |
| FLOAT-05 | Clicking a command in the floating window executes it on the currently selected project in the system terminal | 悬浮窗 emit 事件 -> 主窗口 listen -> invoke("execute_command")；200ms 绿色闪烁反馈（D-17）|
| FLOAT-06 | Floating window reflects project selection changes from main window in real-time | Tauri 事件系统：主窗口 emit("float:project-changed") -> 悬浮窗 listen 实时更新 |
| FLOAT-07 | User can close the floating window independently without affecting the main window | 悬浮窗关闭按钮调用 window.close()；主窗口 onCloseRequested 不影响悬浮窗（D-12）|
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 窗口创建/销毁 | Frontend (Tauri JS API) | -- | WebviewWindow 是前端 API，运行时动态创建 |
| 窗口属性 (alwaysOnTop, skipTaskbar) | Frontend (Tauri JS API) | -- | 通过 WebviewWindow options 一次性设置，不需要 Rust 后端 |
| 跨窗口状态同步 | Frontend (Tauri Events) | -- | emit/emitTo/listen 全部是前端 API |
| 指令执行 | API / Backend (Rust) | -- | 复用现有 invoke("execute_command") 路径 |
| 悬浮窗 UI 渲染 | Browser (React) | -- | 独立 React 根组件，独立 HTML 入口 |
| 窗口权限 | Tauri Config (capabilities) | -- | capabilities/default.json 控制哪些窗口可以使用哪些 API |
| Vite 多页构建 | Build (Vite) | -- | build.rollupOptions.input 配置多个 HTML 入口 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tauri-apps/api | ^2.10.1 (latest: 2.10.1) | WebviewWindow 类、事件系统、窗口管理 | Tauri 项目唯一前端 API，已安装。WebviewWindow 构造函数用于动态创建窗口 [VERIFIED: npm registry] |
| react | ^19.2.5 (latest: 19.2.5) | 悬浮窗 UI 渲染 | 已安装。悬浮窗有独立 React 根组件 [VERIFIED: npm registry] |
| vite | ^6.4.2 (latest: 6.4.2) | 多页构建 | 已安装。通过 rollupOptions.input 添加 float.html 入口 [VERIFIED: npm registry] |
| lucide-react | ^1.8.0 (latest: 1.12.0) | PanelTop 图标 + X 关闭图标 + FolderOpen 空状态图标 | 已安装。shadcn/ui 默认图标库 [VERIFIED: npm registry] |
| tailwindcss | ^4.2.2 (latest: 4.2.4) | 悬浮窗样式 | 已安装。CSS-first 配置，自动检测内容 [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-store | ^2.4.2 | 悬浮窗设置持久化（当前阶段不需要） | 未来 FLOAT-09 记住位置时可能用到 |
| vitest | ^4.1.4 | 单元测试 | 每个新组件和 hook 的测试 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite 多页构建 | query param 切换（?mode=float） | query param 方案代码分支多，需要条件渲染整个 UI，不干净。多页构建是 Tauri 推荐方案，每个窗口有独立入口 [ASSUMED] |
| Tauri 事件系统 | tauri-plugin-store 共享状态 | 事件系统实时性好、单向数据流清晰。store 方案需要轮询或监听 onChange，复杂度更高且实时性差 [ASSUMED] |
| 运行时 WebviewWindow 创建 | tauri.conf.json 静态声明窗口 | 静态声明在应用启动时就创建窗口，与 D-14（不自动打开）矛盾。运行时创建完全控制时机 [VERIFIED: Tauri v2 API docs] |
| startDragging() 拖拽 | data-tauri-drag-region HTML 属性 | 两种方式都可以。startDragging() 与主窗口现有模式一致，Windows 上更可靠 [CITED: CONTEXT.md specifics] |

**Installation:**
```bash
# 无需安装新依赖，所有库已存在
```

**Version verification:** Before writing the Standard Stack table, verify each recommended package version is current:
```bash
npm view @tauri-apps/api version   # 2.10.1
npm view react version             # 19.2.5
npm view vite version              # 6.4.2
npm view lucide-react version      # 1.12.0
npm view tailwindcss version       # 4.2.4
```
所有版本已通过 npm registry 确认。

## Architecture Patterns

### System Architecture Diagram

```
Main Window (label: "main")                    Float Window (label: "float")
+------------------------------------------+   +--------------------------------------+
|  TitleBar                                |   |  FloatApp                            |
|  [PanelTop btn] toggle ---+              |   |  +--[Header: project name + X]---+   |
|                           |              |   |  +--[Command Row]----------------+   |
|  App.tsx                  v              |   |  +--[Command Row]----------------+   |
|  useFloatWindow hook ----+-- creates --> |   |  +--[Command Row]----------------+   |
|  +-- manages lifecycle    |              |   |  +--[ScrollArea if overflow]----+   |
|  +-- emits state sync ----+-- emitTo --> |   |                                      |
|  +-- receives execute <---+-- listen <-- |   |                                      |
+------------------------------------------+   +--------------------------------------+
        |                                                     |
        | invoke("execute_command")                           | emit("float:execute")
        v                                                     |
   Rust Backend                                         Main listens
   std::process::Command                                     |
        v                                                     |
   System Terminal                                            |

Tray Menu
+-- [显示/隐藏窗口]
+-- [打开/关闭悬浮窗] <-- toggle float visibility
+-- [Recent commands]
+-- [退出]
```

### Recommended Project Structure
```
src/
├── App.tsx                     # 修改：集成 useFloatWindow hook
├── main.tsx                    # 不变：主窗口 React 入口
├── float-main.tsx              # 新增：悬浮窗 React 入口
├── float.html                  # 新增：悬浮窗 HTML 入口（项目根目录）
├── components/
│   ├── TitleBar.tsx            # 修改：新增 PanelTop 按钮
│   ├── FloatApp.tsx            # 新增：悬浮窗根组件
│   └── __tests__/
│       ├── TitleBar.test.tsx   # 修改：新增测试用例
│       └── FloatApp.test.tsx   # 新增
├── hooks/
│   ├── useTray.ts              # 修改：新增悬浮窗菜单项
│   ├── useFloatWindow.ts       # 新增：窗口创建/销毁/状态同步
│   └── __tests__/
│       └── useFloatWindow.test.ts  # 新增
├── lib/
│   └── types.ts                # 可能修改：新增 FloatWindow 类型
src-tauri/
├── capabilities/
│   └── default.json            # 修改：扩展 windows 数组和权限
├── tauri.conf.json             # 不变：悬浮窗运行时动态创建
vite.config.ts                  # 修改：多页构建配置
```

### Pattern 1: WebviewWindow 动态创建
**What:** 运行时通过 `new WebviewWindow(label, options)` 创建第二个窗口
**When to use:** 用户首次点击 TitleBar 悬浮窗按钮或托盘菜单选项时创建，之后 toggle show/hide
**Example:**
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const floatWindow = new WebviewWindow("float", {
  url: "float.html",
  width: 280,
  minWidth: 280,
  maxWidth: 280,
  height: 400,
  minHeight: 200,
  decorations: false,
  shadow: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  visible: true,     // 创建后立即可见
  title: "EasyPack Floating",
});

// 等待窗口初始化完成
await floatWindow.once("tauri://created", () => {
  // 窗口创建成功
});

await floatWindow.once("tauri://error", (e) => {
  // 窗口创建失败
  console.error("Float window creation failed:", e);
});
```

### Pattern 2: Tauri 事件系统跨窗口通信
**What:** 使用 `emit`/`emitTo`/`listen` 在主窗口和悬浮窗之间同步状态
**When to use:** 主窗口项目切换时同步到悬浮窗、悬浮窗点击指令时通知主窗口执行
**Example:**
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespaceevent/
import { emit, emitTo } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";

// === 主窗口侧 ===
// 当项目或指令变化时，向悬浮窗推送最新状态
await emitTo("float", "float:state-update", {
  project: currentProject,
  commands: commands,
});

// 监听悬浮窗发来的执行请求
const unlisten = await listen<{ command: string }>("float:execute", (event) => {
  executeCommand(event.payload.command);
});

// === 悬浮窗侧 ===
// 监听主窗口推送的状态更新
await listen<{ project: ProjectItem | null; commands: CommandItem[] }>(
  "float:state-update",
  (event) => {
    setProject(event.payload.project);
    setCommands(event.payload.commands);
  }
);

// 点击指令按钮时，通知主窗口执行
async function handleExecute(command: string) {
  await emit("float:execute", { command });
}
```

### Pattern 3: Vite 多页构建
**What:** 配置 Vite 输出多个 HTML 入口点，为悬浮窗提供独立的 HTML 页面
**When to use:** 悬浮窗是独立窗口，需要独立 HTML 入口
**Example:**
```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        float: path.resolve(__dirname, "float.html"),
      },
    },
  },
});
```

### Pattern 4: Ref-Based Callback 模式（防闭包过时）
**What:** 使用 useRef 保存回调引用，避免 useEffect 闭包捕获过时状态
**When to use:** useTray.ts 已验证此模式，useFloatWindow 的 emit 回调同样需要
**Example:**
```typescript
// 已在 useTray.ts 中验证的模式（src/hooks/useTray.ts 第 39-52 行）
const onExecuteRef = useRef(onExecute);
onExecuteRef.current = onExecute;

// 在异步回调中使用 ref 而非直接使用闭包
action: () => {
  onExecuteRef.current(cmd.command);
},
```

### Pattern 5: 窗口初始位置计算
**What:** 使用 availableMonitors() 获取主显示器工作区尺寸，计算右上角位置
**When to use:** 每次创建悬浮窗时设置初始位置（D-08）
**Example:**
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewindow/
import { availableMonitors } from "@tauri-apps/api/window";
import { LogicalPosition } from "@tauri-apps/api/dpi";

const monitors = await availableMonitors();
const primary = monitors[0]; // 主显示器
if (primary) {
  // workArea 返回的是 PhysicalPosition 和 PhysicalSize
  // 需要考虑 scaleFactor 转换为逻辑坐标
  const { width, height } = primary.workArea.size;
  const { x, y } = primary.workArea.position;
  const scale = primary.scaleFactor;

  // 转换为逻辑坐标：物理像素 / scaleFactor
  const logicalWidth = width / scale;
  const logicalRight = (x + width) / scale;

  // 右上角偏移 16px
  const posX = logicalRight - 280 - 16;
  const posY = (y / scale) + 16;

  await floatWindow.setPosition(new LogicalPosition(posX, posY));
}
```

### Anti-Patterns to Avoid
- **Anti-pattern: tauri.conf.json 静态声明悬浮窗:** 静态声明的窗口在应用启动时自动创建，违反 D-14（不自动打开）。应使用运行时 `new WebviewWindow()` 动态创建。
- **Anti-pattern: 悬浮窗直接 invoke("execute_command"):** 悬浮窗可以调用 Rust 命令，但 `executeCommand` 需要 `currentProject.path`，如果主窗口状态变化，悬浮窗可能持有过时引用。应让悬浮窗通过事件通知主窗口执行，主窗口持有权威的 currentProject 状态。
- **Anti-pattern: 不清理事件监听器:** `listen()` 返回 `UnlistenFn`，组件卸载时必须调用，否则内存泄漏。特别是在悬浮窗关闭时，主窗口注册的针对悬浮窗的事件监听器需要清理。
- **Anti-pattern: 闭包捕获过时状态:** 异步操作（如 buildMenu、事件处理）中直接使用 state 变量会捕获快照值。必须使用 ref 模式（useTray.ts 已验证的方案）。
- **Anti-pattern: 每次切换项目都销毁重建窗口:** 创建/销毁 WebviewWindow 开销大且会闪烁。应创建一次，通过事件系统更新内容，show/hide 切换可见性。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 多窗口创建和管理 | 自定义 IPC 或 postMessage | Tauri WebviewWindow API | 官方 API 处理了窗口生命周期、平台差异、内存管理 [VERIFIED: Tauri v2 docs] |
| 跨窗口通信 | 自定义 WebSocket / localStorage 事件 | Tauri 事件系统 (emit/emitTo/listen) | 内置类型安全、性能好、支持定向发送 [VERIFIED: Tauri v2 docs] |
| 窗口拖拽 | 自定义 mousedown/mousemove 实现 | appWindow.startDragging() | 已在主窗口验证，Windows 上可靠，处理 DPI 和多显示器 [VERIFIED: TitleBar.tsx 已使用] |
| 窗口位置计算 | 硬编码屏幕尺寸 | availableMonitors() + workArea | 处理 DPI 缩放、多显示器、任务栏偏移 [VERIFIED: Tauri v2 API docs] |
| 权限管理 | 修改 Rust 源码添加权限检查 | Tauri capabilities 系统 | 声明式权限控制，安全审计友好 [VERIFIED: capabilities/default.json 已在使用] |

**Key insight:** Tauri v2 的多窗口支持是第一等公民（first-class feature），不需要任何 workaround。WebviewWindow 类同时继承 Window 和 Webview 的所有能力，API 设计完整。

## Common Pitfalls

### Pitfall 1: Vite 多页构建的 HMR 路由
**What goes wrong:** 开发模式下，访问 `http://localhost:1420/` 只显示主页面，悬浮窗的 `float.html` 需要访问 `http://localhost:1420/float.html`
**Why it happens:** Vite 多页构建在开发模式下不会自动路由，需要直接访问 HTML 文件路径
**How to avoid:** 在 WebviewWindow 的 `url` 选项中使用开发环境的完整路径 `http://localhost:1420/float.html`，生产环境使用 `float.html` 相对路径。通过 `import.meta.env.DEV` 区分环境。
**Warning signs:** 悬浮窗显示空白页面或 "page not found"

### Pitfall 2: Capabilities 窗口列表不包含 "float"
**What goes wrong:** 悬浮窗创建成功但调用 `emit`、`listen` 等 API 时抛出权限错误
**Why it happens:** Tauri capabilities 的 `windows` 数组限制哪些窗口可以使用哪些权限。当前只有 `["main"]`
**How to avoid:** 在 `src-tauri/capabilities/default.json` 的 `windows` 数组中添加 `"float"`。或者创建一个独立的 `float.json` capability 文件专门给悬浮窗使用。
**Warning signs:** 控制台出现 "not allowed" 或 "missing capability" 错误

### Pitfall 3: 窗口销毁后引用悬挂
**What goes wrong:** 用户关闭悬浮窗后，再次点击 toggle 按钮尝试 show 一个已销毁的窗口，操作静默失败
**Why it happens:** `window.close()` 销毁窗口后，JS 侧的 WebviewWindow 引用仍然存在，但调用方法会失败
**How to avoid:** 在 `useFloatWindow` 中维护一个 ref 跟踪窗口是否存活。监听 `onCloseRequested` 或 `destroyed` 事件清除引用。toggle 时检查 `WebviewWindow.getByLabel("float")` 返回值是否为 null。
**Warning signs:** 悬浮窗关闭后 toggle 无法重新打开

### Pitfall 4: 悬浮窗内 startDragging 与按钮点击冲突
**What goes wrong:** 点击指令按钮时同时触发了拖拽，窗口移动了位置
**Why it happens:** 拖拽区域包含按钮区域，mousedown 事件冒泡导致 startDragging 被调用
**How to avoid:** 参照 TitleBar.tsx 的 `handleDragStart` 模式：检查 `e.target.closest("button")`，如果是按钮则不触发拖拽。悬浮窗的 header 区域使用相同的 mousedown handler。
**Warning signs:** 点击关闭按钮或拖拽区域附近的指令行时窗口移动

### Pitfall 5: 主窗口退出时悬浮窗未关闭
**What goes wrong:** 用户通过托盘"退出"或关闭主窗口（非 hide to tray），悬浮窗仍然留在屏幕上
**Why it happens:** 两个窗口是独立的，主窗口的 destroy 不会自动关闭其他窗口
**How to avoid:** 在主窗口的 `onCloseRequested` 处理中（真正退出时），显式调用 `WebviewWindow.getByLabel("float")?.destroy()`。或者在 App 组件的 cleanup effect 中处理。
**Warning signs:** 退出应用后悬浮窗仍然可见

### Pitfall 6: availableMonitors 返回物理坐标
**What goes wrong:** 悬浮窗位置偏移，出现在错误位置
**Why it happens:** `availableMonitors()` 返回的 `size` 和 `position` 是物理像素，需要除以 `scaleFactor` 转换为逻辑坐标
**How to avoid:** 使用 `LogicalPosition` 时将物理坐标除以 `scaleFactor`。或者使用 Tauri 的 `fromPhysical` 转换方法。
**Warning signs:** 在 150%/200% DPI 缩放显示器上位置偏移明显

## Code Examples

Verified patterns from official sources and codebase:

### WebviewWindow 创建（含环境判断）
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

function createFloatWindow(): WebviewWindow {
  const url = import.meta.env.DEV
    ? "http://localhost:1420/float.html"
    : "float.html";

  return new WebviewWindow("float", {
    url,
    width: 280,
    minWidth: 280,
    maxWidth: 280,
    height: 400,
    minHeight: 200,
    decorations: false,
    shadow: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    visible: true,
    title: "EasyPack Floating",
  });
}
```

### emitTo 定向发送事件（主窗口 -> 悬浮窗）
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespaceevent/
import { emitTo } from "@tauri-apps/api/event";

// 主窗口：当项目或指令变化时推送状态
async function syncFloatState(
  project: ProjectItem | null,
  commands: CommandItem[]
) {
  await emitTo("float", "float:state-update", {
    project,
    commands,
  });
}
```

### listen 接收事件（悬浮窗侧）
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespaceevent/
import { listen } from "@tauri-apps/api/event";

// 悬浮窗：监听状态更新
const unlisten = await listen<{
  project: ProjectItem | null;
  commands: CommandItem[];
}>("float:state-update", (event) => {
  setProject(event.payload.project);
  setCommands(event.payload.commands);
});

// 组件卸载时清理
return () => {
  unlisten();
};
```

### 窗口是否存在检查（防止悬挂引用）
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

async function isFloatWindowAlive(): Promise<boolean> {
  const existing = WebviewWindow.getByLabel("float");
  if (!existing) return false;
  try {
    // 尝试访问窗口属性来验证是否存活
    await existing.label();
    return true;
  } catch {
    return false;
  }
}
```

### 现有代码中的拖拽模式（TitleBar.tsx 第 11-16 行）
```typescript
function handleDragStart(e: React.MouseEvent<HTMLDivElement>) {
  if (e.button !== 0) return;           // 只响应左键
  const target = e.target as HTMLElement;
  if (target.closest("button")) return;  // 按钮上不触发拖拽
  appWindow.startDragging();
}
```

### 现有代码中的 ref 回调模式（useTray.ts 第 39-52 行）
```typescript
const onExecuteRef = useRef(onExecute);
onExecuteRef.current = onExecute;
const visibilityRef = useRef(visibility);
visibilityRef.current = visibility;

// 在异步构建的菜单中使用 ref
action: () => {
  if (visibilityRef.current === "VISIBLE") {
    onHideRef.current();
  }
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tauri.conf.json 静态多窗口声明 | 运行时 `new WebviewWindow()` 动态创建 | Tauri v2 | 更灵活的窗口生命周期控制，按需创建 |
| Window + Webview 分开创建 | WebviewWindow 合并类 | Tauri v2 | 简化 API，一个构造函数同时配置窗口和 webview |
| postMessage / localStorage 跨窗口通信 | Tauri 内置事件系统 (emit/emitTo/listen) | Tauri v2 | 类型安全、定向发送、自动清理 |
| WindowOptions 在 tauri.conf.json | WindowOptions 作为运行时构造参数 | Tauri v2 | 动态配置，不需要重启应用 |

**Deprecated/outdated:**
- `tauri::window::WindowBuilder::new()` (Tauri v1): Tauri v2 使用 `WebviewWindow::new()` 替代
- `window.__TAURI__` 全局对象: Tauri v2 使用 `@tauri-apps/api` ES module 导入

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite 多页构建在 Tauri 开发模式下 HMR 正常工作 | Architecture Patterns | 如果 HMR 不工作，开发体验差，需要配置 fallback 或使用 query param 方案 |
| A2 | `emitTo("float", ...)` 在目标窗口不存在时静默成功（不抛异常） | Architecture Patterns | 如果抛异常，需要在调用前检查窗口是否存在 |
| A3 | 悬浮窗的 `alwaysOnTop: true` 在 Windows 11 上与其他置顶窗口（如任务管理器）的 z-order 行为一致 | Standard Stack | 如果行为不一致，用户可能觉得悬浮窗"消失"了 |
| A4 | `WebviewWindow.getByLabel("float")` 在窗口被用户通过 Alt+F4 关闭后返回 null | Architecture Patterns | 如果返回非 null 但窗口已死，需要额外存活检查 |
| A5 | Tailwind CSS v4 的自动内容检测能覆盖 `float-main.tsx` 和 `FloatApp.tsx` 中的类名 | Architecture Patterns | 如果不覆盖，悬浮窗样式缺失 |

## Open Questions

1. **Vite 多页构建 + Tauri dev 模式 HMR 行为**
   - What we know: Vite 6 支持多页构建，Tauri dev server 代理到 Vite
   - What's unclear: 悬浮窗页面（float.html）在 `tauri dev` 模式下是否能正确 HMR
   - Recommendation: 实现时优先测试 `tauri dev` 下悬浮窗的热更新行为。如果 HMR 不工作，作为 fallback 可以在开发模式下使用 `?window=float` query param 方案（生产构建仍用多页）。

2. **窗口 close vs destroy 的语义**
   - What we know: `close()` 触发 `closeRequested` 事件可拦截，`destroy()` 强制销毁
   - What's unclear: 用户通过悬浮窗的 X 按钮关闭时，应该用 `close()` 还是 `destroy()`
   - Recommendation: 使用 `close()`（可预测的生命周期）。但主窗口退出时清理悬浮窗应使用 `destroy()`（确保清理）。需要在 useFloatWindow 中处理 `onCloseRequested` 事件。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build | YES | -- | -- |
| pnpm | Package manager | YES | -- | -- |
| Rust toolchain | Tauri backend | YES | -- | -- |
| Vitest | Unit tests | YES | ^4.1.4 | -- |
| jsdom | Test environment | YES | via vitest config | -- |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- None

Step 2.6: 所有依赖已安装，无阻塞项。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLOAT-01 | TitleBar 按钮点击触发 toggle；托盘菜单项存在 | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx src/hooks/__tests__/useFloatWindow.test.ts` | TitleBar.test.tsx YES, useFloatWindow.test.ts Wave 0 |
| FLOAT-02 | 悬浮窗渲染指令列表 | unit | `npx vitest run src/components/__tests__/FloatApp.test.tsx` | Wave 0 |
| FLOAT-03 | 窗口创建时 alwaysOnTop: true | unit | `npx vitest run src/hooks/__tests__/useFloatWindow.test.ts` | Wave 0 |
| FLOAT-04 | 窗口创建时 skipTaskbar: true | unit | `npx vitest run src/hooks/__tests__/useFloatWindow.test.ts` | Wave 0 |
| FLOAT-05 | 指令点击触发 emit execute 事件 | unit | `npx vitest run src/components/__tests__/FloatApp.test.tsx` | Wave 0 |
| FLOAT-06 | 主窗口 emit state-update 后悬浮窗更新 | unit | `npx vitest run src/hooks/__tests__/useFloatWindow.test.ts` | Wave 0 |
| FLOAT-07 | 悬浮窗独立关闭不影响主窗口 | unit | `npx vitest run src/hooks/__tests__/useFloatWindow.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useFloatWindow.test.ts` -- covers FLOAT-01 (toggle), FLOAT-03, FLOAT-04, FLOAT-06, FLOAT-07
- [ ] `src/components/__tests__/FloatApp.test.tsx` -- covers FLOAT-02 (render commands), FLOAT-05 (click execute)
- [ ] `src/components/__tests__/TitleBar.test.tsx` -- needs new test cases for float toggle button (FLOAT-01)
- [ ] `src/hooks/__tests__/useTray.test.ts` -- needs new test case for float menu item (FLOAT-01) -- NOTE: this file does not exist yet; tray tests may be manual-only due to TrayIcon API complexity

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本地桌面应用，无认证 |
| V3 Session Management | no | 无会话概念 |
| V4 Access Control | yes | Tauri capabilities 系统控制窗口权限 |
| V5 Input Validation | yes | 指令名称和 shell command 通过已有 execute_command 路径验证 |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for Tauri Multi-Window

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 跨窗口事件劫持 | Tampering | Tauri 事件系统仅在应用内窗口间传递，不受外部攻击 |
| Capability 提权 | Elevation | 精确配置 capabilities/default.json，只授予必需权限 |
| WebviewWindow label 冲突 | Tampering | 硬编码 label "float"，创建前检查是否已存在 |
| 指令注入 via 事件 payload | Injection | 悬浮窗 emit 的 command 字符串经过主窗口的 executeCommand 路径处理，与主窗口指令卡片同一条验证链 |

## Sources

### Primary (HIGH confidence)
- Tauri v2 WebviewWindow API Reference -- https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/ -- 构造函数、WindowOptions、事件方法
- Tauri v2 Window API Reference -- https://v2.tauri.app/reference/javascript/api/namespacewindow/ -- setAlwaysOnTop, setSkipTaskbar, onCloseRequested, availableMonitors
- Tauri v2 Event API Reference -- https://v2.tauri.app/reference/javascript/api/namespaceevent/ -- emit, emitTo, listen
- npm registry -- @tauri-apps/api 2.10.1, react 19.2.5, vite 6.4.2, tailwindcss 4.2.4, lucide-react 1.12.0

### Secondary (MEDIUM confidence)
- Codebase: src/components/TitleBar.tsx -- 拖拽模式、按钮布局
- Codebase: src/hooks/useTray.ts -- ref 回调模式、buildMenu 模式
- Codebase: src/App.tsx -- hook 集成模式
- Codebase: src-tauri/capabilities/default.json -- 现有权限配置

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 无新依赖，全部使用已安装库的已有 API，通过 npm registry 和 Tauri 官方文档双重验证
- Architecture: HIGH -- WebviewWindow 动态创建 + 事件系统通信是 Tauri v2 官方推荐模式，API 文档详尽
- Pitfalls: HIGH -- 大部分 pitfalls 已通过代码库现有模式验证（TitleBar 拖拽、useTray ref 回调），Vite 多页 HMR 是唯一未验证点

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days -- stable stack, no fast-moving dependencies)
