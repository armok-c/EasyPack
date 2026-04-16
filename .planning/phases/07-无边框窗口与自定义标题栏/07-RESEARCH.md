# Phase 7: 无边框窗口与自定义标题栏 - Research

**Researched:** 2026-04-16
**Domain:** Tauri 2 无边框窗口 + React 自定义标题栏
**Confidence:** HIGH

## Summary

本阶段将 EasyPack 的 Tauri 窗口从原生装饰（decorations）切换为无边框模式，用 React 组件替代系统标题栏。核心技术点包括：`decorations: false` 移除原生窗口 chrome、`data-tauri-drag-region` HTML 属性标记拖拽区域、`@tauri-apps/api/window` 的 `getCurrentWindow()` API 控制最小化/最大化/关闭、以及 `shadow: true` 在 Windows 11 DWM 下保持窗口阴影和圆角。

研究表明 Tauri 2 对无边框窗口有一等公民支持：官方文档提供完整的自定义标题栏指南，`data-tauri-drag-region` 是官方推荐的拖拽方案（无需 Rust 后端代码）。关键注意事项包括：拖拽区域属性不会被子元素继承（每个可拖拽子元素需独立标记），双击标题栏最大化需要手动实现（`e.detail === 2` 检测），以及 Windows 上 `shadow: true` 会在无边框窗口周围产生 1px 白色边框。

**Primary recommendation:** 使用纯前端方案实现标题栏——Tauri Window API 的 `getCurrentWindow().minimize/toggleMaximize/close()` 配合 `data-tauri-drag-region` 属性，无需编写任何 Rust 后端代码。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 标题栏高度 28px（紧凑风格），适配当前窗口最小高度 400px，最大化内容区域空间
- **D-02:** 无边界融合风格 — 标题栏与内容区域使用相同背景色，无分割线，整体视觉连贯。匹配当前 Raycast 风格暗色渐变背景
- **D-03:** 窗口控制按钮使用半透明图标，默认几乎不可见，hover 时显示背景高亮。三个按钮位于标题栏右侧：最小化（─）、最大化（□）、关闭（×）
- **D-04:** 标题栏左侧显示应用图标（小圆角方形）+ 应用名称 "EasyPack"。图标使用 Tauri 应用图标或自定义小尺寸 SVG
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIN-01 | 应用窗口无边框，顶部显示自定义标题栏（应用名称 + 拖拽区域 + 最小化/最大化/关闭按钮） | `decorations: false` 移除原生装饰；`data-tauri-drag-region` 标记拖拽区域；`getCurrentWindow()` API 实现窗口控制按钮；TitleBar React 组件实现 |
| WIN-02 | 无边框窗口保留窗口阴影和正常的 resize 拖拽能力 | `shadow: true` 在 Win11 DWM 下保留阴影和圆角；Windows 原生 WM_NCHITTEST 通过窗口边缘处理 resize，Tauri 2 内置支持 |
| WIN-03 | 高 DPI 显示器下无边框窗口元素和文字显示正常 | Tauri 2 默认使用系统 DPI 缩放；WebView2 自动处理 CSS 像素到物理像素的映射；SVG 图标天然支持任意 DPI |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tauri-apps/api | ^2.10.1 | Tauri 前端 API（getCurrentWindow, minimize, close 等） | 项目已安装，提供完整的窗口控制 API，无需额外依赖 [VERIFIED: package.json] |
| lucide-react | ^1.8.0 | SVG 图标（Minus, Square, X 用于窗口控制按钮） | 项目已安装，shadcn/ui 默认图标方案，包含所有需要的窗口控制图标 [VERIFIED: package.json] |
| react | ^19.2.5 | UI 框架 | 项目已安装，TitleBar 作为 React 组件实现 [VERIFIED: package.json] |
| tailwindcss | ^4.2.2 | CSS 框架 | 项目已安装，用于标题栏样式 [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | ^16.3.2 | React 组件测试 | TitleBar 组件单元测试 [VERIFIED: package.json] |
| vitest | ^4.1.4 | 测试运行器 | 运行 TitleBar 组件测试 [VERIFIED: package.json] |
| jsdom | ^29.0.2 | DOM 环境模拟 | vitest test environment [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lucide-react 图标 | 原生 SVG / HTML 实体字符 | lucide 已安装且风格统一，无需引入额外方案 |
| data-tauri-drag-region | 手动 mousedown + startDragging() | data-tauri-drag-region 是官方推荐方案，自动处理拖拽；手动方式仅在需要精细控制时使用 |
| Tauri Window API | tauri-plugin-shell 调用 PowerShell | Window API 是前端直接调用，无需 Rust 后端，更简洁 |

**Installation:**
```bash
# 无需安装新依赖 — 所有需要的库已在项目中
```

**Version verification:**
- @tauri-apps/api: ^2.10.1 (installed), latest registry: 2.10.1 [VERIFIED: npm view]
- tauri-cli: 2.10.1 [VERIFIED: `npx tauri --version`]

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── TitleBar.tsx          # NEW — 自定义标题栏组件
│   ├── __tests__/
│   │   └── TitleBar.test.tsx # NEW — 标题栏组件测试
│   ├── ui/                   # shadcn/ui 组件（不修改）
│   ├── Sidebar.tsx           # 不修改
│   └── MainArea.tsx          # 不修改
├── lib/
│   └── icons.ts              # 扩展 — 添加窗口控制图标映射
├── App.tsx                   # 修改 — 插入 TitleBar 到根布局
└── index.css                 # 不修改（颜色变量已满足需求）
```

### Pattern 1: Tauri 无边框窗口配置
**What:** 通过 `tauri.conf.json` 配置移除原生窗口装饰，添加系统阴影
**When to use:** 实现无边框窗口的第一步
**Example:**
```json
{
  "app": {
    "windows": [{
      "label": "main",
      "title": "EasyPack",
      "width": 720,
      "height": 480,
      "minWidth": 600,
      "minHeight": 400,
      "resizable": true,
      "center": true,
      "decorations": false,
      "shadow": true
    }]
  }
}
```
Source: [CITED: https://v2.tauri.app/reference/config/#windowconfig]

### Pattern 2: data-tauri-drag-region 拖拽区域
**What:** 使用 HTML 属性标记可拖拽区域，替代原生标题栏的拖拽功能
**When to use:** 自定义标题栏中需要拖拽移动窗口的区域
**Example:**
```tsx
// 整个标题栏容器可拖拽
<div data-tauri-drag-region className="flex items-center h-[28px]">
  {/* 左侧图标+名称 — 可拖拽 */}
  <div data-tauri-drag-region className="flex items-center pl-[10px]">
    <Package className="w-[14px] h-[14px]" />
    <span>EasyPack</span>
  </div>
  {/* 弹性间隔 — 可拖拽 */}
  <div data-tauri-drag-region className="flex-1" />
  {/* 按钮区域 — 不可拖拽（无 data-tauri-drag-region） */}
  <div className="flex items-center h-full">
    <button onClick={handleMinimize}>...</button>
  </div>
</div>
```
**CRITICAL:** `data-tauri-drag-region` 不会被子元素继承。每个需要拖拽的子元素必须独立添加该属性。[CITED: https://v2.tauri.app/learn/window-customization/]

### Pattern 3: 窗口控制 API 调用
**What:** 使用 Tauri Window API 的 getCurrentWindow() 控制窗口状态
**When to use:** 最小化/最大化/关闭按钮的点击处理
**Example:**
```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

async function handleMinimize() {
  await appWindow.minimize();
}

async function handleMaximize() {
  await appWindow.toggleMaximize();
}

async function handleClose() {
  await appWindow.close();
}
```
Source: [CITED: https://v2.tauri.app/learn/window-customization/]

### Pattern 4: 双击标题栏最大化
**What:** 标准 Windows 行为 — 双击标题栏切换最大化/还原
**When to use:** 提升窗口操作的直觉性和一致性
**Example:**
```tsx
function handleTitleBarDoubleClick() {
  appWindow.toggleMaximize();
}

// 在拖拽区域的容器上添加：
<div
  data-tauri-drag-region
  onDoubleClick={handleTitleBarDoubleClick}
>
```
**Note:** `data-tauri-drag-region` 不会自动处理双击最大化。需要手动实现 `onDoubleClick` 事件。使用 `onDoubleClick` 而非 `onMouseDown` + `e.detail === 2`，因为语义更清晰且不会被拖拽事件干扰。[ASSUMED] -- 基于 Tauri 官方文档确认 drag region 不自动处理双击，但具体实现方式（onDoubleClick vs mousedown detail）需要实际验证。

### Pattern 5: 根布局垂直分割
**What:** 将 App.tsx 的水平 flex 布局改为垂直嵌套，顶部固定标题栏
**When to use:** 插入 TitleBar 组件到现有布局
**Example:**
```tsx
// Before:
<div className="flex h-screen w-screen overflow-hidden">
  <Sidebar />
  <MainArea />
</div>

// After:
<div className="flex flex-col h-screen w-screen overflow-hidden">
  <TitleBar />
  <div className="flex flex-1 overflow-hidden">
    <Sidebar />
    <MainArea />
  </div>
</div>
```

### Anti-Patterns to Avoid
- **在 Rust 后端实现窗口控制命令:** 窗口控制（minimize/maximize/close）应使用前端 `@tauri-apps/api/window` 直接调用，不需要 `invoke()` + Rust 命令。增加不必要的复杂度。
- **使用 CSS `-webkit-app-region: drag`:** 这是 Electron 方案。Tauri 使用 `data-tauri-drag-region` HTML 属性，CSS 方案无效。
- **在窗口控制按钮的父容器上添加 data-tauri-drag-region:** 这会导致点击按钮时触发拖拽而非按钮操作。按钮区域不得有此属性。
- **使用 shadcn Button 组件作为窗口控制按钮:** 窗口控制按钮需要精确的 28x28px 尺寸、无 padding、无 border、自定义 hover 效果，shadcn Button 的变体系统不适合。使用原生 `<button>` 元素。
- **在标题栏使用 `position: fixed`:** 标题栏作为 flex-col 的第一个子元素自然固定在顶部，不需要 fixed 定位。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 窗口拖拽 | mousedown/mousemove 手动实现 | `data-tauri-drag-region` HTML 属性 | 官方方案自动处理所有平台差异、DPI 缩放、边界检测 |
| 窗口 resize | CSS resize 或 JS 边缘检测 | Tauri 内置 WM_NCHITTEST (Windows 原生) | `decorations: false` + `shadow: true` 下 Tauri 自动保留边缘 resize 能力 |
| DPI 缩放 | 手动计算物理像素 | Tauri 2 默认系统 DPI 缩放 | WebView2 自动处理 CSS 像素到物理像素映射 |
| 窗口阴影 | CSS box-shadow 模拟 | `shadow: true` 配置项 | Windows 11 DWM 原生阴影和圆角，CSS 模拟会在边缘产生不一致效果 |

**Key insight:** 本阶段的核心实现是"配置 + React 组件"，不涉及复杂的手动窗口管理逻辑。Tauri 2 已经处理了底层窗口管理的所有平台差异。

## Common Pitfalls

### Pitfall 1: data-tauri-drag-region 不继承
**What goes wrong:** 只在标题栏容器上添加 `data-tauri-drag-region`，期望所有子元素都可拖拽，结果只有容器本身可拖拽（点击图标、文字、空白间隔时无法拖动窗口）
**Why it happens:** `data-tauri-drag-region` 不是 CSS 属性，不会通过 DOM 树继承。官方文档明确说明：每个需要拖拽的子元素必须独立添加该属性。
**How to avoid:** 在标题栏容器、图标+名称的 div、以及弹性间隔 spacer 上都添加 `data-tauri-drag-region`。窗口控制按钮区域不添加。
**Warning signs:** 点击标题栏的文字区域或空白区域无法拖动窗口。

### Pitfall 2: Windows 1px 白色边框
**What goes wrong:** 设置 `decorations: false` + `shadow: true` 后，窗口周围出现 1px 白色边框，在深色主题下非常显眼
**Why it happens:** Windows DWM 在无边框窗口上绘制阴影时会产生 1px 白色描边。这是 Windows 系统级行为。
**How to avoid:** 这是已知行为，无法通过 Tauri 配置消除。可以考虑在窗口最外层添加 1px 的深色 border 来覆盖，但需要评估是否影响 resize 区域。根据 D-07 决策，系统默认行为是可接受的。
**Warning signs:** 开发环境切换到暗色桌面壁纸时白色边框更明显。

### Pitfall 3: 双击最大化与拖拽冲突
**What goes wrong:** 实现双击标题栏最大化时，快速双击也会触发短暂的拖拽移动，导致窗口位置偏移
**Why it happens:** `data-tauri-drag-region` 在 mousedown 时立即开始拖拽，而双击检测需要等待第二次点击。
**How to avoid:** 使用 `onDoubleClick` 事件而非 `onMouseDown` + `e.detail === 2`。`onDoubleClick` 在浏览器完成双击判定后才触发，与拖拽不冲突。如果仍有问题，可以考虑在双击后调用 `appWindow.center()` 重置位置。
**Warning signs:** 双击标题栏后窗口位置发生微小偏移。

### Pitfall 4: Tauri capabilities 权限缺失
**What goes wrong:** 调用 `appWindow.minimize()` / `close()` / `toggleMaximize()` 时抛出权限错误
**Why it happens:** Tauri 2 的安全模型要求在 `capabilities/*.json` 中显式声明窗口操作权限。当前 `default.json` 只有 `core:default`、`dialog:default`、`store:default`。
**How to avoid:** 在 `src-tauri/capabilities/default.json` 的 `permissions` 数组中添加所需的窗口权限。
**Warning signs:** 控制台出现 `Unhandled Promise rejection: window not allowed to ...` 错误。

### Pitfall 5: 已知 Tauri bugs（decorations: false）
**What goes wrong:** 某些 Tauri 版本中 `decorations: false` 导致 resize 异常、setSize 不准确、inner size 偏移等问题
**Why it happens:** Tauri GitHub 已有相关 issue：#8519（resize broken）、#12076（setSize broken）、#12285（inner size offset）
**How to avoid:** 使用 Tauri 2.10.x 最新版本（当前已安装 2.10.1），这些 bug 在较新版本中已修复。如果遇到 resize 问题，检查 Tauri 版本并升级。本阶段不使用 `setSize()` API，可避免 #12076。
**Warning signs:** 窗口边缘 resize 不流畅、最小/最大窗口尺寸限制失效。

## Code Examples

### 窗口权限配置（capabilities/default.json）
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "dialog:default",
    "store:default"
  ]
}
```
Source: [CITED: https://v2.tauri.app/learn/window-customization/] -- 窗口操作权限列表

### TitleBar 组件完整实现
```tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Package } from "lucide-react";

const appWindow = getCurrentWindow();

export function TitleBar() {
  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
  };

  const handleClose = async () => {
    await appWindow.close();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-[28px] select-none shrink-0"
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-[6px] pl-[10px]"
      >
        <Package className="w-[14px] h-[14px] text-foreground/80" />
        <span className="text-[13px] font-medium text-foreground">
          EasyPack
        </span>
      </div>
      <div data-tauri-drag-region className="flex-1" />
      <div className="flex items-center h-full">
        <button
          className="titlebar-button"
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <Minus className="w-[12px] h-[12px]" />
        </button>
        <button
          className="titlebar-button"
          onClick={handleMaximize}
          aria-label="最大化"
        >
          <Square className="w-[12px] h-[12px]" />
        </button>
        <button
          className="titlebar-button close-button"
          onClick={handleClose}
          aria-label="关闭"
        >
          <X className="w-[12px] h-[12px]" />
        </button>
      </div>
    </div>
  );
}
```

### 窗口控制按钮 CSS（追加到 index.css 或使用 Tailwind @layer）
```css
/* 窗口控制按钮 — 使用自定义 class 而非 Tailwind，确保精确控制 */
.titlebar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-muted-foreground);
  cursor: default;
  transition: background-color 100ms ease;
}

.titlebar-button:hover {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.titlebar-button.close-button:hover {
  background: oklch(0.5 0.15 25);
  color: white;
}
```

### App.tsx 布局修改
```tsx
import { TitleBar } from "@/components/TitleBar";

function App() {
  // ... existing hooks ...

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar ... />
        <MainArea ... />
      </div>
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `-webkit-app-region: drag` CSS 属性 | `data-tauri-drag-region` HTML 属性 | Tauri v2 (2024) | 不再使用 CSS 方案，使用声明式 HTML 属性 |
| Tauri v1 `appWindow` 全局对象 | `getCurrentWindow()` 函数 | Tauri v2 (2024) | API 导入方式变化，更符合 tree-shaking |
| `tauri.conf.json > tauri > windows` | `tauri.conf.json > app > windows` | Tauri v2 (2024) | 配置路径变化 |
| `allowlist` 白名单 | `capabilities` 权限系统 | Tauri v2 (2024) | 安全模型重构，权限声明方式变化 |

**Deprecated/outdated:**
- `-webkit-app-region: drag/no-drag`: Electron 方案，Tauri 不支持 [CITED: https://v2.tauri.app/learn/window-customization/]
- `tauri.conf.json > tauri.*` 配置路径: Tauri v1 格式，v2 已迁移到 `app.*` [CITED: https://v2.tauri.app/reference/config/]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `onDoubleClick` 事件不会与 `data-tauri-drag-region` 的拖拽行为冲突 | Pattern 4 | 如果冲突，需要使用 `onMouseDown` + `e.detail === 2` 并处理位移补偿 |
| A2 | Tauri 2.10.1 已修复 decorations:false 的 resize bug (#8519) | Pitfall 5 | 如果未修复，resize 可能异常，需要升级 Tauri 版本 |
| A3 | `core:window:allow-start-dragging` 权限不需要显式声明（包含在 `core:default` 中） | Pitfall 4 | 如果需要单独声明，拖拽功能将无法工作 |
| A4 | `shadow: true` 在 Windows 10 上无阴影是可接受行为（符合 D-07） | Pattern 1 | 无风险，D-07 已锁定此决策 |

## Open Questions

1. **双击最大化实现细节**
   - What we know: `data-tauri-drag-region` 不自动处理双击最大化，需要手动实现
   - What's unclear: `onDoubleClick` 是否会与 drag region 的 mousedown 处理冲突
   - Recommendation: 先使用 `onDoubleClick` 实现，如果测试发现冲突，改用 `onMouseDown` + `e.detail === 2` 检测

2. **1px 白色边框处理**
   - What we know: Windows DWM 在无边框+阴影窗口周围产生 1px 白色描边
   - What's unclear: 是否有官方方法消除，或是否影响用户体验
   - Recommendation: 按照当前 D-07 决策接受此行为，不额外处理。如果用户反馈强烈，后续可以考虑在窗口边缘添加深色 border

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 前端构建 | ✓ | 22.17.0 | -- |
| npm | 包管理 | ✓ | 11.7.0 | -- |
| Tauri CLI | 构建/开发 | ✓ | 2.10.1 | -- |
| @tauri-apps/api | 窗口控制 API | ✓ | 2.10.1 | -- |
| lucide-react | 图标 | ✓ | ^1.8.0 | -- |
| vitest | 测试 | ✓ | ^4.1.4 | -- |
| WebView2 | Tauri 运行时 | ✓ (Windows 内置) | 系统版本 | -- |

**Missing dependencies with no fallback:**
- None -- 所有依赖已安装且版本满足需求。

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.4 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/components/__tests__/TitleBar.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIN-01 | TitleBar 组件渲染应用图标、名称、三个窗口控制按钮 | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "renders"` | ❌ Wave 0 |
| WIN-01 | 窗口控制按钮点击调用正确的 Tauri API | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "window control"` | ❌ Wave 0 |
| WIN-01 | 拖拽区域标记正确（data-tauri-drag-region） | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "drag region"` | ❌ Wave 0 |
| WIN-02 | 标题栏高度 28px，使用 shrink-0 不压缩 | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "height"` | ❌ Wave 0 |
| WIN-03 | 无自动测试 — 高 DPI 需要实际显示器验证 | manual-only | N/A | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/__tests__/TitleBar.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/TitleBar.test.tsx` — covers WIN-01 (render, buttons, drag region), WIN-02 (height/shrink)
- [ ] Manual test checklist for WIN-03 (high DPI verification at 1x, 1.5x, 2x)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 桌面应用，无认证需求 |
| V3 Session Management | no | 无会话管理 |
| V4 Access Control | yes | Tauri capabilities 权限系统控制窗口 API 访问 |
| V5 Input Validation | no | 标题栏无用户输入 |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for Tauri + React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 窗口 API 未授权调用 | Elevation of Privilege | Tauri capabilities 权限声明 — 仅允许必需的窗口操作 |
| XSS 通过标题栏注入 | Tampering | 标题栏内容硬编码（"EasyPack"），无动态内容注入点 |

## Sources

### Primary (HIGH confidence)
- [CITED: https://v2.tauri.app/reference/config/#windowconfig] — Tauri 2 Window 配置参考（decorations, shadow, drag region 配置项）
- [CITED: https://v2.tauri.app/learn/window-customization/] — Tauri 2 窗口自定义指南（无边框窗口、自定义标题栏、data-tauri-drag-region 用法）
- [VERIFIED: package.json] — 所有项目依赖和版本
- [VERIFIED: tauri.conf.json] — 当前窗口配置
- [VERIFIED: capabilities/default.json] — 当前权限配置

### Secondary (MEDIUM confidence)
- [VERIFIED: npm view @tauri-apps/api] — 最新版本 2.10.1 确认
- [VERIFIED: npx tauri --version] — Tauri CLI 2.10.1 确认

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有依赖已在项目中，无需安装新包
- Architecture: HIGH — 基于 Tauri 官方文档的推荐模式
- Pitfalls: HIGH — 从官方文档和已知 GitHub issue 确认
- Double-click behavior: MEDIUM — 需要实际测试验证 onDoubleClick 与 drag region 的交互

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (Tauri 2 API 稳定，30 天有效期合理)
