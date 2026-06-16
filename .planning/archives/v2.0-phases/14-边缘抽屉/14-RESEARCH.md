# Phase 14: 边缘抽屉 - Research

**Researched:** 2026-05-09
**Domain:** Tauri v2 窗口边缘吸附 / 窗口动画 / 三态可见性状态机
**Confidence:** MEDIUM

## Summary

边缘抽屉功能将主窗口改造为可吸附到屏幕四边并隐藏为 thin sliver（1-2px 主题色细条）的桌面工具。用户拖拽窗口至屏幕边缘触发吸附，鼠标接触细条后窗口完整滑出，鼠标离开后延迟收回。核心技术挑战集中在三个方面：(1) WebView 节流风险 -- 主窗口隐藏后 WebView2 可能暂停 JS 运行时，导致鼠标事件无法触发滑出；(2) Thin sliver 在高 DPI 下的可见性和可交互性；(3) 窗口动画通过 IPC 调用 setPosition/setSize 实现的性能开销。

**Primary recommendation:** 使用三阶段架构 -- Rust 后端负责系统级鼠标位置检测（定时轮询 cursorPosition），前端负责状态机管理和动画计算，Tauri 事件系统桥接两者。复用 Phase 12 已验证的 Rust 全局事件处理器模式来规避 WebView 节流问题。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 松手吸附 -- 窗口边缘距屏幕边缘 <= 10px 时松手触发吸附隐藏
- **D-02:** 四边全支持 -- 上/下/左/右均可吸附
- **D-03:** 滑入动画 -- 松手后窗口平滑滑入边缘隐藏（约 200ms ease-in-out）
- **D-04:** 吸附提示 -- 拖拽接近边缘 10px 内时显示半透明边框提示"即将吸附"
- **D-05:** 最大化禁止吸附 -- 窗口最大化状态不触发边缘吸附，需先还原
- **D-06:** Thin sliver -- 窗口缩小为 1-2px 主题色细条保留在屏幕边缘，用于鼠标触发检测
- **D-07:** 主题色细条 -- 使用应用主题色/强调色显示，提供视觉辨识度
- **D-08:** DPI 自适应 -- 细条宽度根据系统 DPI 缩放自适应，确保物理像素至少 2px
- **D-09:** 全窗口滑出 -- 鼠标接触细条后窗口完整滑出到吸附前的位置和尺寸
- **D-10:** 延迟收回 -- 鼠标离开窗口后延迟 300-500ms 再收回，期间鼠标重新进入则取消收回
- **D-11:** ease-in-out 动画 -- 滑出和收回都使用平滑 ease-in-out 过渡，约 200-300ms
- **D-12:** 设置开关 -- 在现有 SettingsDialog 中添加"边缘抽屉"分区，包含启用/禁用开关
- **D-13:** 三态互斥 -- 扩展 useVisibilityState 为 VISIBLE / TRAY_HIDDEN / DRAWER_HIDDEN 三态，DRAWER_HIDDEN 和 TRAY_HIDDEN 互斥
- **D-14:** 拖拽取消吸附 -- 滑出状态下拖拽窗口超过 20px 自动取消吸附，恢复为 VISIBLE 状态
- **D-15:** 记住原始位置 -- 吸附时记录窗口位置和尺寸，取消吸附时恢复到原始位置
- **D-16:** 悬浮窗独立存活 -- 主窗口抽屉隐藏时悬浮窗不受影响，继续独立显示和操作
- **D-17:** 不持久化抽屉状态 -- 应用重启后窗口正常显示，不自动进入抽屉隐藏状态
- **D-18:** 仅主显示器 -- 本阶段仅支持主显示器边缘吸附，拖到副显示器不触发
- **D-19:** 执行后不收回 -- 抽屉滑出状态下点击指令执行，窗口保持滑出，鼠标移开才收回

### Claude's Discretion
- 窗口位置监听的实现方式（onMoved 事件 vs 轮询 vs Rust 端 hook）
- 窗口缩放为 thin sliver 的技术实现（setSize + setPosition 组合）
- 滑出/收回动画的帧驱动方式（requestAnimationFrame vs 定时器 vs CSS transition）
- 吸附提示的具体视觉样式（半透明边框、发光效果等）
- thin sliver 的背景色实现（窗口背景色 vs 全屏覆盖层 vs 渲染到 body）
- DPI 检测方式（window.devicePixelRatio vs Tauri API vs Rust 端系统 API）
- 延迟收回的定时器管理（debounce 实现、清理策略）
- 拖拽取消吸附的判定逻辑（拖拽方向、距离阈值、与正常拖拽的区分）
- tauri.conf.json 需要追加的权限（如果有新的窗口操作 API）
- capabilities/default.json 需要追加的权限

### Deferred Ideas (OUT OF SCOPE)
- DRAWER-07: 多显示器支持 -- 未来版本，需处理多显示器坐标映射和虚拟屏幕空间
- DRAWER-08: DPI-aware thin sliver -- 增强版（更精细的 DPI 处理）留作未来
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRAWER-01 | User can drag the main window to any screen edge to trigger snap-and-hide | 拖拽结束检测: onMoved + primaryMonitor().workArea 对比; D-01 10px 阈值; D-05 最大化排除 |
| DRAWER-02 | All four screen edges (top, bottom, left, right) are supported | 四边坐标计算: top=Y=0, bottom=Y+H-winH, left=X=0, right=X+W-winW; 每边独立 sliver 定位 |
| DRAWER-03 | When snapped, mouse contact at the hidden edge triggers slide-out | Rust 端 cursorPosition 轮询 + monitorFromPoint 检测; emit 事件触发前端动画 |
| DRAWER-04 | Mouse leaving the revealed window causes it to slide back and auto-hide | 前端 onMouseLeave + debounce 定时器 (D-10: 300-500ms); 取消重入逻辑 |
| DRAWER-05 | Slide-out and slide-back animations are smooth | requestAnimationFrame + setPosition/setSize 帧驱动; IPC 开销约 1-3ms/帧, 200ms 动画约 12-20 帧 |
| DRAWER-06 | User can un-dock the window by dragging it away from the edge | onDrag 事件监听; D-14 20px 阈值; D-15 恢复原始位置和尺寸 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 吸附检测 (snap detection) | Frontend (JS) | -- | 拖拽结束事件在前端触发, 需要当前窗口位置和 monitor workArea 对比 |
| 鼠标位置监听 (mouse edge detection) | Rust Backend | -- | WebView 节流时 JS 不执行; Rust 端 cursorPosition 轮询是唯一可靠方案 |
| 窗口动画 (slide out/in) | Frontend (JS) | -- | requestAnimationFrame + Tauri Window API; 前端控制帧率和缓动 |
| 状态机 (visibility state) | Frontend (JS) | -- | React state 管理, 三态互斥逻辑 |
| 设置持久化 (settings) | Frontend (JS) | -- | tauri-plugin-store 已集成 |
| Thin sliver 尺寸/位置计算 | Frontend (JS) | -- | LogicalPosition/LogicalSize + DPI 缩放 |
| 窗口操作 (show/hide/setPosition/setSize) | Tauri Window API | -- | 通过 IPC 调用 Rust 后端执行 |
| 取消吸附检测 (undock) | Frontend (JS) | -- | 前端监听拖拽事件和位移量 |

## Standard Stack

### Core (已有依赖, 无需安装新包)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tauri-apps/api | 2.11.0 (npm latest) | Tauri 前端 API: Window, Monitor, DPI, Event | 项目已安装 ^2.10.1, 提供所有窗口操作 API |
| tauri (Rust) | 2.10.3 (Cargo.lock) | Tauri 后端核心, 全局事件处理 | 项目已安装, 提供 setup hook, cursorPosition 等系统能力 |
| react | ^19.2.5 | UI 状态管理和组件渲染 | 项目已安装 |
| vitest | ^4.1.4 | 单元测试框架 | 项目已安装, vitest.config.ts 已配置 jsdom |

### Supporting (无需安装 -- 使用现有能力)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-plugin-store | 2.4.3 (npm latest) | 持久化边缘抽屉设置 (drawerEnabled) | D-12 设置开关持久化 |
| @tauri-apps/api/dpi | (included) | LogicalPosition, LogicalSize, PhysicalPosition | DPI 自适应位置/尺寸计算 (D-08) |
| @tauri-apps/api/window | (included) | Monitor, getCurrentWindow, Window | 窗口操作和 monitor 信息 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rust cursorPosition 轮询 | JS mousemove 事件 | JS mousemove 在 WebView 节流时不触发; Rust 轮询是唯一可靠方案 [ASSUMED] |
| requestAnimationFrame 动画 | CSS transition on body | 窗口位置/尺寸由 Tauri API 控制, CSS transition 无法驱动 setPosition/setSize |
| setTimeout 轮询鼠标 | setInterval 轮询 | setTimeout 递归更灵活, 可动态调整间隔; setInterval 固定间隔可能导致堆积 |

**Installation:** 无需安装新依赖。所有功能基于已有的 @tauri-apps/api 和 Tauri Rust 后端实现。

**Version verification:**
- @tauri-apps/api: 2.11.0 (npm registry, 2026-05-09) [VERIFIED: npm registry]
- @tauri-apps/plugin-store: 2.4.3 (npm registry, 2026-05-09) [VERIFIED: npm registry]
- tauri (Rust): 2.10.3 (Cargo.lock) [VERIFIED: Cargo.lock]
- rustc: 1.93.1 (本地安装) [VERIFIED: rustc --version]

## Architecture Patterns

### System Architecture Diagram

```
                          用户操作
                            |
              +-------------+-------------+
              |                           |
        拖拽窗口松手               鼠标接触屏幕边缘
              |                           |
              v                           v
     +------------------+      +--------------------+
     | 前端: 吸附检测    |      | Rust: cursorPosition|
     | onDragEnd        |      | 定时轮询 (~100ms)   |
     | 比较窗口位置 vs   |      | 比较 vs sliver 区域  |
     | monitor workArea |      +--------------------+
     +--------+---------+               |
              |                         | emit("drawer:mouse-near-edge")
              | D-05: 排除最大化         |
              | D-01: <= 10px 阈值       v
              |               +--------------------+
              v               | 前端: 收到事件      |
     +------------------+    | 检查 DRAWER_HIDDEN  |
     | 状态机:          |    +--------+-----------+
     | VISIBLE          |             |
     | -> DRAWER_HIDDEN |             | 如果 DRAWER_HIDDEN
     +--------+---------+             v
              |              +--------------------+
              |              | 前端: 滑出动画      |
              v              | requestAnimationFrame|
     +------------------+    | setPosition 逐帧   |
     | 前端: 滑入动画    |    | 恢复原始位置/尺寸   |
     | 200ms ease-in-out |    | 200ms ease-in-out  |
     | setSize -> sliver  |    +--------+-----------+
     | setPosition -> edge |            |
     +--------+---------+             v
              |              +--------------------+
              v              | 状态: VISIBLE       |
     +------------------+    | 等待用户操作        |
     | 状态: DRAWER_HIDDEN   |                    |
     | 窗口=thin sliver  |    | onMouseLeave ->    |
     | 启动 Rust 鼠标轮询 |    | debounce 300-500ms |
     +--------+---------+    | -> 滑入动画        |
              |              +--------------------+
              | onDragStart + 20px 位移
              | -> 取消吸附 (D-14)
              v
     +------------------+
     | 状态: VISIBLE     |
     | 恢复原始位置/尺寸  |
     +------------------+
```

### Recommended Project Structure

```
src/
├── hooks/
│   ├── useEdgeDrawer.ts       # 新增: 边缘吸附核心 hook
│   ├── useVisibilityState.ts  # 修改: 二态 -> 三态
│   ├── useFloatWindow.ts      # 不变: D-16 悬浮窗独立
│   ├── useTray.ts             # 修改: 添加抽屉相关菜单项
│   └── ...
├── components/
│   ├── TitleBar.tsx           # 修改: 拖拽行为配合吸附检测
│   ├── SettingsDialog.tsx     # 修改: 添加边缘抽屉设置分区
│   ├── SnapIndicator.tsx      # 新增: 吸附提示覆盖层组件
│   └── ...
└── lib/
    ├── drawer-animation.ts    # 新增: 动画帧驱动工具函数
    └── drawer-geometry.ts     # 新增: 边缘坐标/sliver 位置计算

src-tauri/src/
├── lib.rs                     # 修改: 添加鼠标位置轮询定时器
└── ...
```

### Pattern 1: 三态可见性状态机

**What:** 将 useVisibilityState 从 VISIBLE/TRAY_HIDDEN 二态扩展为 VISIBLE/TRAY_HIDDEN/DRAWER_HIDDEN 三态
**When to use:** 任何窗口可见性变更操作
**Example:**

```typescript
// src/hooks/useVisibilityState.ts
export type VisibilityState = "VISIBLE" | "TRAY_HIDDEN" | "DRAWER_HIDDEN";

export function useVisibilityState() {
  const [visibility, setVisibility] = useState<VisibilityState>("VISIBLE");

  const hideToTray = useCallback(() => setVisibility("TRAY_HIDDEN"), []);
  const showFromTray = useCallback(() => setVisibility("VISIBLE"), []);
  const hideToDrawer = useCallback(() => setVisibility("DRAWER_HIDDEN"), []);
  const showFromDrawer = useCallback(() => setVisibility("VISIBLE"), []);

  const isVisible = visibility === "VISIBLE";
  const isDrawerHidden = visibility === "DRAWER_HIDDEN";

  return {
    visibility, setVisibility,
    hideToTray, showFromTray,
    hideToDrawer, showFromDrawer,
    isVisible, isDrawerHidden,
  };
}
```

**约束:** DRAWER_HIDDEN 和 TRAY_HIDDEN 互斥 (D-13)。状态转换函数应直接设置目标状态，不经过中间态。

### Pattern 2: Rust 端鼠标位置轮询

**What:** 在 Rust 后端设置定时器轮询系统鼠标位置，检测是否进入 thin sliver 区域
**When to use:** 主窗口处于 DRAWER_HIDDEN 状态时
**Example:**

```rust
// src-tauri/src/lib.rs -- 在 setup 中添加
// 当前端 emit "drawer:start-polling" 时启动轮询
// 当前端 emit "drawer:stop-polling" 时停止轮询
// 检测到鼠标进入 sliver 区域时 emit "drawer:mouse-near-edge"
```

**关键:** 复用 Phase 12 的 Rust 全局事件处理器模式。不依赖 WebView JS 运行时。

### Pattern 3: 帧驱动窗口动画

**What:** 使用 requestAnimationFrame 逐帧调用 setPosition/setSize 实现窗口滑动动画
**When to use:** 滑入（隐藏）和滑出（显示）动画

```typescript
// src/lib/drawer-animation.ts
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

async function animateWindow(
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number },
  durationMs: number,
  window: Window
): Promise<void> {
  const startTime = performance.now();
  return new Promise((resolve) => {
    function frame(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = easeInOut(t);

      const x = from.x + (to.x - from.x) * eased;
      const y = from.y + (to.y - from.y) * eased;
      const w = from.w + (to.w - from.w) * eased;
      const h = from.h + (to.h - from.h) * eased;

      window.setPosition(new LogicalPosition(x, y));
      window.setSize(new LogicalSize(w, h));

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
```

**注意:** setPosition 和 setSize 各自是一次 IPC 调用。每帧 2 次 IPC 在 200ms 动画中约 24 次 IPC (12fps effective)。Tauri GitHub issues (#9373, #9364) 报告动画可能不流畅。如果效果不佳，备选方案是减少帧数 + 使用 CSS transition 在 WebView 内做视觉补偿。

### Anti-Patterns to Avoid

- **Anti-Pattern: JS mousemove 监听 thin sliver 区域:** 主窗口隐藏后 WebView2 会节流 JS, mousemove 事件不会触发。必须使用 Rust 端系统级鼠标检测。
- **Anti-Pattern: 同时设置 DRAWER_HIDDEN 和 TRAY_HIDDEN:** 违反 D-13 互斥约束。状态机必须保证任何时刻只有一个隐藏状态生效。
- **Anti-Pattern: 在窗口动画期间接受新的状态变更:** 动画进行中如果触发新的 show/hide 会导致位置混乱。使用 mutex (复用 useFloatWindow 的 operationLock 模式) 序列化窗口操作。
- **Anti-Pattern: 在 tauri.conf.json 设置 minWidth > 0 然后 try setSize 到 2px:** minWidth 可能阻止窗口缩小到 sliver 尺寸。需要在吸附时临时移除 minWidth 限制。
- **Anti-Pattern: 使用 CSS 动画替代窗口位置动画:** 窗口位置和尺寸由 Tauri/tao 管理, CSS transition 无法移动操作系统窗口。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 鼠标位置检测 | JS mousemove + 全屏透明覆盖窗口 | Rust cursorPosition() API | JS 在 WebView 节流时不执行; cursorPosition 直接从 OS 获取位置 |
| Monitor 信息获取 | Win32 API 调用 | Tauri primaryMonitor() / currentMonitor() | 自动处理 DPI 缩放, 返回 workArea (排除任务栏) |
| DPI 缩放计算 | 手动 registry 读取 | LogicalPosition/LogicalSize + window.devicePixelRatio | Tauri DPI 类型自动做逻辑/物理坐标转换 |
| 设置持久化 | 手动 JSON 读写 | tauri-plugin-store | 已集成, autoSave, 线程安全 |
| 窗口拖拽 | 自定义 mousedown/mousemove | appWindow.startDragging() | 已验证, 处理了 Win32 拖拽消息循环 |
| 状态互斥 | 手动 if-else 检查 | 状态机类型 (VisibilityState 联合类型) | TypeScript 类型系统强制互斥, 编译时检查 |

**Key insight:** 边缘抽屉的"检测鼠标在 thin sliver 附近"这个核心问题, 只有 Rust 后端的系统能力能可靠解决。前端的 mousemove 事件在 WebView 被节流后完全不触发, 这是 Phase 12 调试中已确认的根因。

## Runtime State Inventory

> 本阶段不涉及 rename/refactor/migration, 跳过此节。

## Common Pitfalls

### Pitfall 1: WebView 节流导致滑出检测失效

**What goes wrong:** 主窗口隐藏为 thin sliver 后, WebView2 认为"窗口几乎不可见", 开始节流 JS 运行时。JS 定时器和事件监听器停止触发, 导致 mousemove 无法检测到鼠标接触 sliver。
**Why it happens:** WebView2 的节能策略。窗口 width=2px 或 height=2px 时被判定为最小化级别。
**How to avoid:** 所有"检测鼠标是否在 sliver 附近"的逻辑必须放在 Rust 后端。使用 `app.cursor_position()` 定期轮询 (约 100ms 间隔), 比较 cursor 和 sliver 区域坐标, 匹配时 emit 事件到前端触发滑出。
**Warning signs:** 主窗口吸附后鼠标滑过 sliver 无反应; 调试 console.log 不输出。

### Pitfall 2: minWidth/minHeight 阻止缩小到 sliver

**What goes wrong:** tauri.conf.json 配置了 minWidth: 600, minHeight: 400。调用 setSize(2, 480) 时窗口可能不会缩小到 2px 宽, 因为 minWidth 限制生效。
**Why it happens:** Tauri/tao 的窗口尺寸约束在 Win32 层面通过 WM_GETMINMAXINFO 实现, 优先级高于 setSize。
**How to avoid:** 吸附时先调用 `appWindow.setMinSize(new LogicalSize(0, 0))` 临时移除最小尺寸限制, 取消吸附时恢复 `new LogicalSize(600, 400)`。
**Warning signs:** 调用 setSize 到 sliver 尺寸后 innerSize() 返回的仍是 minWidth 值。

### Pitfall 3: DPI 缩放导致 sliver 物理像素为 0

**What goes wrong:** 在 200% DPI 缩放下, LogicalSize(1, 480) 对应物理像素 2px, 可见。但如果使用 PhysicalSize(1, 480), 1 物理像素在 200% 缩放下可能无法被点击。
**Why it happens:** 混用 Logical 和 Physical 类型。
**How to avoid:** 始终使用 LogicalPosition/LogicalSize, 让 Tauri 处理 DPI 转换。sliver 宽度使用 `Math.ceil(2 / scaleFactor)` 逻辑像素, 确保物理像素 >= 2 (D-08)。
**Warning signs:** 在 150%/200% 缩放下 sliver 不可见或无法触发。

### Pitfall 4: 动画期间状态竞争

**What goes wrong:** 滑出动画进行中, 用户快速操作 (点击托盘显示, 再次吸附等) 导致多个动画同时修改窗口位置。
**Why it happens:** 动画是异步的 (requestAnimationFrame), 没有 mutex 保护。
**How to avoid:** 复用 useFloatWindow 的 operationLock Promise 链模式, 所有窗口位置/尺寸操作通过 mutex 序列化。新的操作取消/等待前一个操作完成。
**Warning signs:** 窗口位置跳变, 尺寸异常, 动画中间态可见。

### Pitfall 5: 多显示器坐标混乱

**What goes wrong:** 用户将窗口拖到副显示器边缘, 吸附检测使用主显示器 workArea, 导致坐标错乱。
**Why it happens:** D-18 限制仅支持主显示器, 但拖拽事件报告的坐标可能跨显示器。
**How to avoid:** 吸附检测时先调用 `currentMonitor()` 获取窗口所在显示器, 只有当显示器是主显示器时才触发吸附。非主显示器边缘 <= 10px 时不吸附。
**Warning signs:** 窗口在副显示器边缘吸附后位置错误; sliver 出现在主显示器。

### Pitfall 6: setIgnoreCursorEvents 的副作用

**What goes wrong:** 尝试用 setIgnoreCursorEvents(true) 让 thin sliver 穿透鼠标事件, 但忘记恢复, 导致窗口无法交互。
**Why it happens:** setIgnoreCursorEvents 是全局设置, 影响 WebView 内所有交互。
**How to avoid:** 不使用 setIgnoreCursorEvents。sliver 窗口保持正常的鼠标事件处理, 通过 Rust 端 cursorPosition 检测触发。
**Warning signs:** 窗口滑出后无法点击任何按钮或输入。

## Code Examples

### 吸附检测 -- 拖拽结束时的位置判断

```typescript
// Source: 基于 Tauri v2 Window API 设计 [ASSUMED]
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

const appWindow = getCurrentWindow();
const SNAP_THRESHOLD = 10; // D-01

interface SnapEdge {
  edge: "top" | "bottom" | "left" | "right";
  sliverPos: LogicalPosition;
  sliverSize: LogicalSize;
}

async function detectSnapEdge(
  scaleFactor: number
): Promise<SnapEdge | null> {
  const monitor = await appWindow.primaryMonitor();
  if (!monitor) return null;

  // 仅主显示器 (D-18)
  const pos = await appWindow.outerPosition();
  const size = await appWindow.innerSize();

  const workArea = monitor.workArea;
  const waX = workArea.position.x;
  const waY = workArea.position.y;
  const waW = workArea.size.width;
  const waH = workArea.size.height;

  // 逻辑像素转换
  const scale = monitor.scaleFactor;
  const winX = pos.x / scale;
  const winY = pos.y / scale;
  const winW = size.width / scale;
  const winH = size.height / scale;

  // DPI 自适应 sliver 宽度 (D-08): 物理像素至少 2px
  const sliverLogical = Math.ceil(2 / scale);

  // 检测四边 (D-02)
  const distLeft = winX - waX / scale;
  const distRight = (waX + waW) / scale - (winX + winW);
  const distTop = winY - waY / scale;
  const distBottom = (waY + waH) / scale - (winY + winH);

  if (distLeft >= 0 && distLeft <= SNAP_THRESHOLD) {
    return {
      edge: "left",
      sliverPos: new LogicalPosition(waX / scale, waY / scale),
      sliverSize: new LogicalSize(sliverLogical, waH / scale),
    };
  }
  // ... 类似处理 right, top, bottom
  return null;
}
```

### Rust 端鼠标位置轮询

```rust
// Source: 基于 Tauri v2 cursor_position API 设计 [ASSUMED]
// 在 lib.rs setup 中

use std::sync::{Arc, Mutex};
use tauri::{Manager, Emitter};

// 由前端控制启停
// listen("drawer:start-polling") -> 启动定时器
// listen("drawer:stop-polling") -> 停止定时器

// 在定时器回调中:
// let cursor = app.cursor_position()?;
// 比较 cursor (PhysicalPosition) vs sliver 区域
// 如果在 sliver 附近 5px 内 -> emit("drawer:mouse-near-edge", edge_info)
```

### 延迟收回 -- debounce 模式

```typescript
// Source: 通用 debounce 模式
const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const DELAY_MS = 400; // D-10: 300-500ms, 取中间值

const scheduleHide = useCallback(() => {
  hideTimeoutRef.current = setTimeout(() => {
    slideIn(); // 滑入动画 -> DRAWER_HIDDEN
  }, DELAY_MS);
}, []);

const cancelHide = useCallback(() => {
  if (hideTimeoutRef.current) {
    clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = null;
  }
}, []);

// onMouseLeave -> scheduleHide()
// onMouseEnter -> cancelHide()
```

### 三态互斥集成 -- App.tsx 修改

```typescript
// Source: 基于现有 App.tsx 模式 [ASSUMED]

// 新增: 边缘抽屉设置状态
const [drawerEnabled, setDrawerEnabled] = useState(false);

// 修改: useVisibilityState 现在返回三态
const {
  visibility, hideToTray, showFromTray,
  hideToDrawer, showFromDrawer, isDrawerHidden,
} = useVisibilityState();

// 新增: Rust 端事件监听
useEffect(() => {
  const unlistenNear = listen("drawer:mouse-near-edge", () => {
    if (visibility === "DRAWER_HIDDEN") {
      showFromDrawer();
      slideOut(); // 滑出动画
    }
  });
  return () => { unlistenNear.then((fn) => fn()); };
}, [visibility, showFromDrawer]);

// 修改: 托盘显示需要处理 DRAWER_HIDDEN
// onShow: 如果 DRAWER_HIDDEN -> 取消吸附 + showFromDrawer
```

### SettingsDialog 添加边缘抽屉分区

```typescript
// Source: 复用 SettingsDialog 托盘分区模式 [VERIFIED: 代码阅读]
// 在 SettingsDialog 的 <div className="py-4 space-y-6"> 中添加:

<div>
  <div className="border-b border-white/10 pb-2 mb-4">
    <Label>边缘抽屉</Label>
  </div>
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm">启用边缘抽屉</p>
        <p className="text-xs text-muted-foreground">
          拖拽窗口到屏幕边缘自动隐藏，鼠标滑过边缘快速唤出
        </p>
      </div>
      <Switch
        checked={drawerEnabled}
        onCheckedChange={onDrawerEnabledChange}
      />
    </div>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 window API | Tauri v2 Window namespace (getCurrentWindow()) | Tauri 2.0 (2024) | 所有 API 通过 Window 实例调用, 不再是模块级函数 |
| 手动 Win32 API 调用 | Tauri cursorPosition() / monitorFromPoint() | Tauri 2.x | 系统级鼠标位置可直接从 Rust 获取 |
| WebView throttling 无解 | backgroundThrottling config (但 Windows 不支持) | Tauri 2.1+ | 官方方案在 Windows 上无效, 需 Rust 端 workaround |
| CSS animation 驱动窗口 | rAF + setPosition/setSize | -- | 窗口动画只能通过 IPC 调用 Tauri API |
| 二态可见性 (show/hide) | 三态 (VISIBLE/TRAY_HIDDEN/DRAWER_HIDDEN) | 本阶段 | 状态机复杂度增加, 互斥约束 |

**Deprecated/outdated:**
- Tauri v1 window API: 使用 `tauri.window` 模块, v2 已完全迁移到 `@tauri-apps/api/window`
- `setBounds()`: Tauri v2 不存在此 API, 需分开调用 `setPosition()` + `setSize()`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rust 端 cursorPosition() 可在定时器回调中使用, 不需要特殊权限 | Pattern 2, Code Examples | 如果需要额外权限或 API 不可用, 需要改用 Win32 raw input API |
| A2 | setMinSize(new LogicalSize(0, 0)) 可临时移除最小尺寸限制 | Pitfall 2 | 如果 tao/Win32 不允许 minWidth=0, 需要用 setMinSize(1, 1) 替代 |
| A3 | WebView2 对 width=2px 窗口会节流 JS 运行时 | Pitfall 1 | 如果 WebView2 不节流极小窗口, 可以用纯 JS 方案, 简化实现 |
| A4 | Tauri Rust 端有 cursor_position() 方法 | Code Examples | 如果此 API 不存在, 需要使用 Win32 GetCursorPos 或其他系统 API |
| A5 | 200ms 动画使用 rAF + setPosition/setSize 不会出现明显卡顿 | Pattern 3 | 如果 IPC 开销导致卡顿, 需要减少帧数或用 Rust 端直接驱动动画 |
| A6 | skipTaskbar 在 Windows 上正常工作 | N/A | 如果 skipTaskbar 有 bug (GitHub #10422), thin sliver 可能出现在任务栏 |

## Open Questions

1. **Rust 端 cursor_position() API 是否可用?**
   - What we know: Tauri v2 App 类型有 cursor_position() 方法返回 Result<PhysicalPosition>
   - What's unclear: 是否需要在 capabilities 中添加额外权限; 是否在 Windows 上可靠工作
   - Recommendation: 实现前先写一个最小测试: Rust setup 中调用 cursor_position(), 打印结果验证

2. **thin sliver 窗口的 WebView2 节流行为**
   - What we know: Phase 12 确认窗口完全隐藏时 WebView2 节流
   - What's unclear: width=2px 的窗口是否被视为"隐藏"还是"极小但可见"
   - Recommendation: 原型验证 -- 创建 2px 窗口, 测试 JS 定时器是否正常触发。如果不触发, 确认 Rust 轮询方案

3. **动画性能 -- IPC 开销实测**
   - What we know: setPosition/setSize 各需要一次 IPC (约 1-3ms)
   - What's unclear: 200ms 内 12-20 帧 * 2 IPC = 24-40 次 IPC 是否流畅
   - Recommendation: 实现动画原型, 实测帧率。如果不流畅, 考虑减少到 6-8 帧 (stepped animation)

4. **tao/Win32 是否允许 minWidth=0?**
   - What we know: tauri.conf.json 当前 minWidth=600
   - What's unclear: 运行时 setMinSize(0, 0) 是否被 Win32 层面拒绝
   - Recommendation: 测试 setMinSize(new LogicalSize(0, 0)) 是否生效

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 前端构建 | Yes | 22.17.0 | -- |
| Rust | Tauri 后端 | Yes | 1.93.1 | -- |
| Tauri CLI | 构建运行 | Yes | 2.x (via @tauri-apps/cli) | -- |
| WebView2 | 窗口渲染 | Yes (Windows 11 内置) | -- | -- |
| pnpm/npm | 包管理 | Yes (npm 11.7.0) | 11.7.0 | -- |
| vitest | 单元测试 | Yes | 4.1.4 | -- |

**Missing dependencies with no fallback:**
- 无。所有必需依赖均已安装。

**Missing dependencies with fallback:**
- 无。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 |
| Config file | vitest.config.ts (jsdom environment) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRAWER-01 | 拖拽松手 <= 10px 触发吸附 | unit | `npx vitest run src/lib/__tests__/drawer-geometry.test.ts -t "snap detection"` | Wave 0 |
| DRAWER-02 | 四边吸附坐标计算 | unit | `npx vitest run src/lib/__tests__/drawer-geometry.test.ts -t "four edges"` | Wave 0 |
| DRAWER-03 | 鼠标接触 sliver 触发滑出 | unit (mock IPC) | `npx vitest run src/hooks/__tests__/useEdgeDrawer.test.ts -t "mouse near edge"` | Wave 0 |
| DRAWER-04 | 鼠标离开延迟收回 | unit (mock timers) | `npx vitest run src/hooks/__tests__/useEdgeDrawer.test.ts -t "delayed hide"` | Wave 0 |
| DRAWER-05 | 动画帧计算正确 | unit | `npx vitest run src/lib/__tests__/drawer-animation.test.ts -t "easing"` | Wave 0 |
| DRAWER-06 | 拖拽 > 20px 取消吸附 | unit | `npx vitest run src/hooks/__tests__/useEdgeDrawer.test.ts -t "undock"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/drawer-geometry.test.ts` -- covers DRAWER-01, DRAWER-02 (边缘检测 + 四边坐标计算)
- [ ] `src/lib/__tests__/drawer-animation.test.ts` -- covers DRAWER-05 (缓动函数 + 帧计算)
- [ ] `src/hooks/__tests__/useEdgeDrawer.test.ts` -- covers DRAWER-03, DRAWER-04, DRAWER-06 (滑出/收回/取消吸附)
- [ ] `src/hooks/__tests__/useVisibilityState.test.ts` -- covers 三态互斥 (DRAWER_HIDDEN 互斥逻辑)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | 无用户认证, 本地桌面应用 |
| V3 Session Management | No | 无会话管理 |
| V4 Access Control | No | 无访问控制, 单用户本地应用 |
| V5 Input Validation | Yes | TypeScript 类型系统 + Zod (如需); 窗口坐标值做范围校验 |
| V6 Cryptography | No | 无加密需求 |

### Known Threat Patterns for Tauri Desktop

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSP 绕过 (XSS) | Tampering | tauri.conf.json 已配置严格 CSP; 不使用 unsafe-eval |
| 命令注入 (shell execute) | Tampering | 命令通过 serde 反序列化, 不拼接字符串; capabilities 限制 shell 权限 |
| 窗口位置欺骗 | Spoofing | thin sliver 可被恶意应用覆盖; 但作为本地工具风险可接受 |
| WebView 远程代码执行 | Tampering | WebView2 仅加载本地 HTML (frontendDist); devUrl 仅开发模式 |

## Sources

### Primary (HIGH confidence)
- Tauri v2 Window API (getCurrentWindow, setPosition, setSize, innerPosition, innerSize, primaryMonitor, currentMonitor) -- 基于 Tauri v2 官方文档和代码阅读 [VERIFIED: Tauri v2 官方 API 参考]
- 项目代码: useVisibilityState.ts, useFloatWindow.ts, useTray.ts, TitleBar.tsx, SettingsDialog.tsx, App.tsx, lib.rs, tauri.conf.json, capabilities/default.json -- [VERIFIED: 代码文件阅读]
- Tauri 版本: tauri 2.10.3 (Cargo.lock), @tauri-apps/api 2.11.0 (npm) -- [VERIFIED: Cargo.lock + npm registry]

### Secondary (MEDIUM confidence)
- WebView2 节流行为 -- 基于 Phase 12 调试文档 (.planning/debug/tray-main-float-close.md) 和实际修复代码 [VERIFIED: 项目调试文档]
- Tauri cursorPosition() API -- 基于 Tauri v2 App trait 方法列表 [VERIFIED: Tauri v2 API 参考]
- 动画性能问题 -- 基于 Tauri GitHub issues #9373, #9364 [VERIFIED: GitHub issues]

### Tertiary (LOW confidence)
- minWidth=0 在 Win32 上的行为 -- [ASSUMED], 需要实测验证
- WebView2 对 width=2px 窗口的节流阈值 -- [ASSUMED], 需要实测验证
- 200ms rAF 动画的实际流畅度 -- [ASSUMED], 需要实测验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 所有依赖已安装在项目中, 版本已验证
- Architecture: MEDIUM -- 核心架构基于已验证的 Phase 12 模式, 但 cursorPosition API 和动画性能需要原型验证
- Pitfalls: MEDIUM -- WebView 节流问题已通过 Phase 12 确认, 但 thin sliver 具体行为和 DPI 边界情况需要实测

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days -- Tauri 生态稳定, API 不太可能在短期内变化)

---

*Phase: 14-边缘抽屉*
*Research completed: 2026-05-09*
