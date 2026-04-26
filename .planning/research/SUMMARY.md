# Project Research Summary

**Project:** EasyPack v1.2
**Domain:** Windows desktop project launcher -- Tauri 2 + React 19
**Researched:** 2026-04-26
**Confidence:** HIGH

## Executive Summary

EasyPack v1.2 将应用从"点击执行"进化为"键盘驱动 + 随手可用"的桌面工具。四个目标特性形成一条渐进增强链：快捷键绑定（核心里程碑承诺）、系统托盘（应用常驻基础）、迷你悬浮窗（轻量快速入口）和边缘抽屉（窗口呼之即来）。技术栈延续 v1.1 不变，唯一的新增 npm 依赖是 `@tauri-apps/plugin-global-shortcut`，唯一的新增 Rust crate 是 `tauri-plugin-global-shortcut`。系统托盘使用 Tauri 内置的 `tray-icon` feature（无需额外依赖），多窗口使用内置的 `WebviewWindow` API（同样无需额外依赖）。

研究得出的关键结论有三点。第一，四个特性的技术难度差异巨大。快捷键和系统托盘有成熟的 Tauri 官方支持，属于标准集成模式，每个预计 1-2 个工作单元。迷你悬浮窗使用 Tauri 多窗口 API，官方支持但需要自行设计窗口间状态同步机制（基于 `emit`/`listen` 事件），难度中等。边缘抽屉是唯一没有现成方案的特性 -- Tauri 2 不提供任何窗口吸附、自动隐藏、鼠标边缘检测的能力，必须从零实现，涉及 Win32 API 知识（或 "thin sliver" 替代方案），是多显示器和高 DPI 兼容性风险最高的部分。

第二，窗口可见性管理是 v1.2 最关键的架构决策。托盘隐藏（`hide()`）和边缘抽屉隐藏（`setPosition` 移到屏幕外）操作不同的窗口属性，如果不建立统一的状态机，两种机制会互相干扰导致窗口"消失"。必须在设计阶段就定义好 `VISIBLE / TRAY_HIDDEN / DRAWER_HIDDEN` 三种状态的转换规则，以及托盘"显示"操作如何感知并恢复边缘抽屉状态。

第三，快捷键的项目级覆盖是容易出错的细节。全局指令和项目级指令可以有相同的快捷键绑定，项目切换时必须重新注册所有快捷键（先 unregister 全部再按当前生效的指令集 register），否则快捷键会指向错误的指令。

## Key Findings

**Stack:** v1.1 技术栈完全不变。新增 `tauri-plugin-global-shortcut`（Rust + npm）用于系统级快捷键。系统托盘通过 Tauri 内置 `tray-icon` feature 启用（仅需修改 Cargo.toml features）。多窗口使用内置 `WebviewWindow` API。边缘抽屉可能需要 `windows` crate 用于 Win32 鼠标钩子，但推荐先尝试 "thin sliver" 方案（无需额外依赖）。

**Architecture:** 引入多窗口架构（主窗口 + 悬浮窗），通过 Tauri 事件系统（`emit`/`listen`）进行单向状态同步（主窗口 -> 悬浮窗）。引入全局快捷键生命周期管理 hook（`useGlobalShortcut`），在指令 CRUD 和项目切换时自动注册/注销。引入统一窗口可见性状态机协调托盘和边缘抽屉。

**Critical pitfall:** 托盘隐藏与边缘抽屉隐藏操作不同的窗口属性，不建立统一状态机会导致窗口"消失"。这是影响两个特性的跨功能风险，必须在第一个涉及窗口隐藏的特性（托盘）开始时就设计好状态机。

## Implications for Roadmap

Based on research, suggested phase structure:

1. **全局快捷键** -- 核心里程碑承诺，无外部依赖，可独立开发
   - Addresses: KB-01 (per-command keyboard shortcuts)
   - Uses: `tauri-plugin-global-shortcut`, `useGlobalShortcut` hook, `ShortcutInput` component
   - Avoids: Pitfall 1 (冲突检测), Pitfall 5 (项目级覆盖)
   - Research flag: 无需额外研究 -- 官方文档详尽，API 直观

2. **系统托盘** -- 应用常驻基础，后续特性的前提
   - Addresses: TRAY-01 (system tray + close-to-tray)
   - Uses: Tauri built-in `tray-icon` feature, `TrayIcon` + `Menu` API
   - Avoids: Pitfall 2 (窗口状态机), Pitfall 12 (退出被拦截)
   - Research flag: 需验证 `onCloseRequested` + `hide()` 在 Windows 上的行为是否如预期

3. **迷你悬浮窗** -- 依赖托盘（悬浮窗出现在托盘菜单中），独立 UI 入口
   - Addresses: FLOAT-01 (mini floating window)
   - Uses: `WebviewWindow` API, Vite multi-page build, `emit`/`listen` events
   - Avoids: Pitfall 3 (状态同步), Pitfall 7 (Vite 构建), Pitfall 11 (窗口标签冲突)
   - Research flag: 需验证 Vite 多页构建对 Tauri 前端打包的影响 -- 这是 v1.2 唯一需要修改构建配置的特性

4. **边缘抽屉** -- 最高风险特性，依赖所有窗口管理特性稳定
   - Addresses: DRAWER-01 (edge snap, auto-hide, auto-reveal)
   - Uses: Tauri Window API (`setPosition`, `setSize`), possibly `windows` crate
   - Avoids: Pitfall 4 (多显示器/DPI), Pitfall 9 (thin sliver 可见性)
   - Research flag: 需要原型验证 -- "thin sliver" 方案（窗口部分移到屏幕外）在不同 Windows 版本和 DPI 设置下的行为需要实际测试

**Phase ordering rationale:**
- Phase 1 (快捷键) 最先：核心里程碑承诺，无外部依赖，独立开发风险最低
- Phase 2 (托盘) 在快捷键之后：独立但需要先设计好窗口可见性状态机（为 Phase 4 铺路）
- Phase 3 (悬浮窗) 依赖托盘：悬浮窗入口出现在托盘菜单中，窗口管理需要稳定
- Phase 4 (边缘抽屉) 最后：最高风险，与托盘和悬浮窗都有交互，需要所有窗口管理特性稳定

**Research flags for phases:**
- Phase 1: 标准模式 -- `tauri-plugin-global-shortcut` 有详尽官方文档
- Phase 2: 标准模式 -- `tray-icon` 是 Tauri 2 内置 feature，文档完整
- Phase 3: 需要原型验证 -- Vite 多页构建 + Tauri 集成需要确认 HMR 和打包行为
- Phase 4: 需要深度研究 -- "thin sliver" 方案在 Windows 上的实际行为需要原型验证；如果不可行，需要研究 `windows` crate 的 `WH_MOUSE_LL` 钩子方案

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 新增依赖明确（global-shortcut 插件），其余使用 Tauri 内置功能。所有来源为官方文档和 crates.io |
| Features | HIGH | 4 个特性均有详细实现方案。快捷键和托盘是标准集成模式。悬浮窗有官方 API。边缘抽屉是唯一需要从零实现的特性 |
| Architecture | HIGH | 多窗口 + 事件通信是 Tauri 的标准模式。窗口可见性状态机设计已明确。边缘抽屉的 "thin sliver" 方案需要验证 |
| Pitfalls | HIGH | 5 个关键陷阱均有根因分析和预防方案。最大的跨功能风险（窗口状态冲突）已识别 |

## Gaps to Address

- **边缘抽屉 "thin sliver" 方案验证:** 窗口部分移到屏幕外（4px 可见）在不同 Windows 版本（10 vs 11）、DPI 缩放（100%/150%/200%）、多显示器配置下的行为需要实际原型测试。如果该方案不可行，需要引入 `windows` crate 实现 Win32 鼠标钩子。
- **Vite 多页构建与 Tauri 集成:** 添加 `floating.html` 入口后，需确认 Tauri 的 `frontendDist` 配置、开发模式 HMR、和打包输出是否正常工作。这是 v1.2 唯一需要修改构建配置的变更。
- **悬浮窗状态同步的可靠性:** `emit`/`listen` 事件在主窗口隐藏（托盘或抽屉）时是否仍然正常传递需要验证。如果主窗口的 WebView 在隐藏时不处理事件，悬浮窗将无法接收到状态更新。

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- 官方插件文档、JS API、权限配置
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) -- 内置 tray feature、Menu API
- [Tauri v2 Window Configuration](https://v2.tauri.app/reference/config/) -- WindowConfig、TrayIconConfig
- [Tauri v2 WebviewWindow API](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/) -- 多窗口创建和管理
- [Tauri v2 Event System](https://v2.tauri.app/develop/calling-frontend/) -- emit/listen 通信机制
- [Tauri v2 Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) -- setPosition, setSize, show, hide, onCloseRequested

### Secondary (MEDIUM confidence)
- [Vite Multi-Page App](https://vite.dev/guide/build#multi-page-app) -- 多页构建配置
- [Win32 WH_MOUSE_LL Hook](https://learn.microsoft.com/en-us/windows/win32/winmsg/about-hooks) -- 鼠标钩子（备选方案）
- [windows crate](https://crates.io/crates/windows) -- Rust Win32 API 绑定（备选方案）

---
*Research completed: 2026-04-26*
*Ready for roadmap: yes*
