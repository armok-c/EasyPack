# Phase 14: 边缘抽屉 - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

主窗口可吸附到屏幕四边隐藏（thin sliver），鼠标接触隐藏边缘自动滑出，鼠标离开延迟收回，拖拽可取消吸附。实现"呼之即来"的桌面工具体验。

涉及需求: DRAWER-01, DRAWER-02, DRAWER-03, DRAWER-04, DRAWER-05, DRAWER-06

</domain>

<decisions>
## Implementation Decisions

### 吸附触发方式
- **D-01:** 松手吸附 — 窗口边缘距屏幕边缘 <= 10px 时松手触发吸附隐藏
- **D-02:** 四边全支持 — 上/下/左/右均可吸附
- **D-03:** 滑入动画 — 松手后窗口平滑滑入边缘隐藏（约 200ms ease-in-out）
- **D-04:** 吸附提示 — 拖拽接近边缘 10px 内时显示半透明边框提示"即将吸附"
- **D-05:** 最大化禁止吸附 — 窗口最大化状态不触发边缘吸附，需先还原

### 隐藏后的视觉表现
- **D-06:** Thin sliver — 窗口缩小为 1-2px 主题色细条保留在屏幕边缘，用于鼠标触发检测
- **D-07:** 主题色细条 — 使用应用主题色/强调色显示，提供视觉辨识度
- **D-08:** DPI 自适应 — 细条宽度根据系统 DPI 缩放自适应，确保物理像素至少 2px

### 滑出与收回行为
- **D-09:** 全窗口滑出 — 鼠标接触细条后窗口完整滑出到吸附前的位置和尺寸
- **D-10:** 延迟收回 — 鼠标离开窗口后延迟 300-500ms 再收回，期间鼠标重新进入则取消收回
- **D-11:** ease-in-out 动画 — 滑出和收回都使用平滑 ease-in-out 过渡，约 200-300ms

### 设置与状态管理
- **D-12:** 设置开关 — 在现有 SettingsDialog 中添加"边缘抽屉"分区，包含启用/禁用开关
- **D-13:** 三态互斥 — 扩展 useVisibilityState 为 VISIBLE / TRAY_HIDDEN / DRAWER_HIDDEN 三态，DRAWER_HIDDEN 和 TRAY_HIDDEN 互斥
- **D-14:** 拖拽取消吸附 — 滑出状态下拖拽窗口超过 20px 自动取消吸附，恢复为 VISIBLE 状态
- **D-15:** 记住原始位置 — 吸附时记录窗口位置和尺寸，取消吸附时恢复到原始位置

### 悬浮窗与抽屉交互
- **D-16:** 悬浮窗独立存活 — 主窗口抽屉隐藏时悬浮窗不受影响，继续独立显示和操作

### 重启状态持久化
- **D-17:** 不持久化抽屉状态 — 应用重启后窗口正常显示，不自动进入抽屉隐藏状态

### 多显示器边界处理
- **D-18:** 仅主显示器 — 本阶段仅支持主显示器边缘吸附，拖到副显示器不触发（DRAWER-07 为未来需求）

### 指令执行与抽屉
- **D-19:** 执行后不收回 — 抽屉滑出状态下点击指令执行，窗口保持滑出，鼠标移开才收回

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

</decisions>

<specifics>
## Specific Ideas

- 吸附提示参考 Windows 11 Snap Layout 的半透明预览效果
- 主题色细条使用与应用强调色一致的蓝色/紫色，在深色和浅色背景下都可见
- 延迟收回 300-500ms 之间，建议研究阶段测试具体值以获得最佳体验
- 吸附时的滑入动画应让窗口向对应边缘方向收窄并移出屏幕

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/hooks/useVisibilityState.ts` — 需从二态扩展为三态（VISIBLE / TRAY_HIDDEN / DRAWER_HIDDEN）
- `src/App.tsx` — 边缘抽屉状态管理、与托盘/悬浮窗的集成
- `src/components/TitleBar.tsx` — 窗口拖拽行为可能需要配合吸附检测
- `src/components/SettingsDialog.tsx` — 添加边缘抽屉设置分区

### 新增文件
- `src/hooks/useEdgeDrawer.ts` — 边缘吸附核心 hook（吸附检测、thin sliver 管理、滑出/收回动画、取消吸附）

### Rust 后端
- `src-tauri/src/lib.rs` — 可能需要 Rust 端窗口位置监听或系统级鼠标 hook
- `src-tauri/tauri.conf.json` — 可能需要新的窗口操作权限
- `src-tauri/capabilities/default.json` — 可能需要追加权限

### 现有模式参考
- `src/hooks/useVisibilityState.ts` — 可见性状态机模式（三态扩展基础）
- `src/hooks/useFloatWindow.ts` — 窗口创建/销毁/监听器管理生命周期模式
- `src/hooks/useTray.ts` — 菜单构建模式、ref 模式避免 stale closure
- `src/components/TitleBar.tsx` — startDragging() 拖拽模式、窗口控制按钮布局
- `src/components/SettingsDialog.tsx` — 设置弹窗分区模式（托盘设置分区）

### Prior Phase Context
- `.planning/phases/13-迷你悬浮窗/13-CONTEXT.md` — 悬浮窗独立存活模式、窗口生命周期
- `.planning/phases/12-系统托盘/12-CONTEXT.md` — 可见性状态机设计、onCloseRequested 拦截、设置弹窗

### 已知风险
- `.planning/STATE.md` — "thin sliver" 方案在不同 DPI 和 Windows 版本下行为未知，需原型验证
- `.planning/debug/float-toggle-close-bugs.md` — WebView JS 运行时暂停问题（主窗口隐藏后 JS 可能不执行）
- `.planning/debug/tray-main-float-close.md` — 同一 WebView 节流根因

### Requirements
- `.planning/REQUIREMENTS.md` — DRAWER-01 ~ DRAWER-06（核心需求）、DRAWER-07/08（未来需求）
- `.planning/ROADMAP.md` — Phase 14 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useVisibilityState.ts` — 已有 VISIBLE / TRAY_HIDDEN 二态，需扩展为三态
- `TitleBar.tsx` — 已有 startDragging() 拖拽模式，吸附检测可在此基础上添加位置监听
- `App.tsx` — 已有完整的窗口生命周期管理（onCloseRequested、show/hide、托盘/悬浮窗集成）
- `SettingsDialog.tsx` — 已有托盘设置分区（trayEnabled + closeToTray 开关），可添加边缘抽屉分区
- `tauri-plugin-store` — 已配置 autoSave，边缘抽屉设置可通过同一 store 持久化

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- Hook 生命周期管理（useEffect + cleanup return）
- 无边框窗口 + startDragging() 拖拽
- SettingsDialog 使用 shadcn/ui Dialog + Switch 组件
- useVisibilityState 状态机：显式状态 + 转换函数

### Integration Points
- `src/hooks/useVisibilityState.ts` — 添加 DRAWER_HIDDEN 状态和相关转换函数
- `src/App.tsx` — 集成 useEdgeDrawer hook，连接状态机和动画系统
- `src/components/SettingsDialog.tsx` — 添加边缘抽屉设置分区
- `src/components/TitleBar.tsx` — 可能需要修改拖拽行为以配合吸附检测
- `src-tauri/capabilities/default.json` — 可能需要追加窗口位置/尺寸操作权限

### Key Technical Risks
- **WebView 节流** — 主窗口隐藏后 WebView JS 可能不执行（Phase 12 已遇到，Rust 端全局事件处理器已部分解决）
- **Thin sliver DPI** — 1-2px 窗口在高 DPI 下可能不可见或不可交互
- **动画性能** — 窗口动画通过 setPosition/setSize 实现，可能不如原生动画流畅
- **边缘检测精度** — 屏幕边缘坐标在不同显示器配置下可能不一致

</code_context>

<deferred>
## Deferred Ideas

- DRAWER-07: 多显示器支持 — 未来版本，需处理多显示器坐标映射和虚拟屏幕空间
- DRAWER-08: DPI-aware thin sliver — 已在本阶段纳入 D-08，增强版（更精细的 DPI 处理）留作未来

</deferred>

---

*Phase: 14-边缘抽屉*
*Context gathered: 2026-05-09*
