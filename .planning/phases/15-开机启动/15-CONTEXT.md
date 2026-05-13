# Phase 15: 开机启动 - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

提供开机自启动开关和自愈机制。用户可在设置中启用开机启动，Windows 启动时 EasyPack 自动启动并最小化到系统托盘。如果注册表条目丢失（如被清理工具删除），下次启动时自动修复。

涉及需求: BOOT-01, BOOT-02, BOOT-03, BOOT-04

</domain>

<decisions>
## Implementation Decisions

### 启动行为区分
- **D-01:** 使用命令行参数 `--autostart` 区分"开机自启"和"用户手动启动"——tauri-plugin-autostart 注册自启动项时附带此参数
- **D-02:** 开机自启时如果系统托盘功能关闭，自动开启托盘——开机自启后应用必须有地方待着
- **D-03:** Rust 端 setup 阶段检测 `--autostart` 参数后立即隐藏窗口（在 WebView 加载前），避免窗口闪现
- **D-04:** Rust 端通过 emit 事件（如 `app:autostart-hidden`）通知前端同步 visibility = TRAY_HIDDEN 状态

### 自愈机制策略
- **D-05:** 每次启动时，如果开机启动开关为开启状态，静默检查注册表条目是否有效
- **D-06:** 使用 tauri-plugin-autostart 的 isEnabled() API 检测注册状态
- **D-07:** 发现条目丢失时静默调用 enable() 重新注册，修复失败不提示用户（下次启动会再尝试）
- **D-08:** 自愈逻辑全部在 Rust 端 setup 阶段执行，前端不需要感知自愈逻辑

### 托盘依赖关系
- **D-09:** 开机启动开关放在 SettingsDialog 托盘设置分区内（作为第三个 Switch），与 trayEnabled、closeToTray 在同一区域
- **D-10:** 用户关闭托盘总开关（trayEnabled）时级联关闭开机启动——确保不会出现开机自启后无处可去的状况
- **D-11:** 开机启动开关启用前提条件为 closeToTray=true——只有"关闭时隐藏到托盘"开启时才能开启开机启动

### Claude's Discretion
- tauri-plugin-autostart 的具体注册参数格式（args 配置）
- `--autostart` 参数在 Rust 端的读取方式（std::env::args vs tauri API）
- emit 事件名称的具体命名
- SettingsDialog 中开机启动 Switch 的 UI 文案和描述
- capabilities/default.json 需要追加的 autostart 权限
- Cargo.toml 中 tauri-plugin-autostart 的版本选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src-tauri/src/lib.rs` — Rust 端 setup 中添加 autostart 自愈检查和 --autostart 参数检测逻辑
- `src-tauri/Cargo.toml` — 需添加 tauri-plugin-autostart 依赖
- `src/components/SettingsDialog.tsx` — 在托盘设置分区内添加开机启动 Switch（第三个开关）
- `src/App.tsx` — 监听 Rust 端的 autostart-hidden 事件，同步 visibility 状态

### 新增文件
- 无需新增独立文件——改动集中在现有文件

### Tauri 官方文档
- tauri-plugin-autostart — https://v2.tauri.app/plugin/autostart/ （注册/检查/启用 API）
- Tauri v2 CLI Args — 命令行参数读取方式

### 现有模式参考
- `src/hooks/useVisibilityState.ts` — 可见性状态机（VISIBLE / TRAY_HIDDEN / DRAWER_HIDDEN）
- `src/App.tsx` — 托盘设置加载/持久化模式（loadTraySettings、handleTrayEnabledChange 等）
- `src/components/SettingsDialog.tsx` — 托盘设置分区 UI 模式（Switch + 依赖关系控制）
- `src-tauri/src/lib.rs` — Rust 端 setup 初始化模式、emit 事件模式

### Prior Phase Context
- `.planning/phases/14-边缘抽屉/14-CONTEXT.md` — 可见性状态机三态设计
- `.planning/phases/12-系统托盘/12-CONTEXT.md` — 托盘设置、SettingsDialog、onCloseRequested 模式

### 已知风险
- `.planning/STATE.md` — tauri-plugin-autostart Windows 注册表条目丢失 bug (Issue #771)

### Requirements
- `.planning/REQUIREMENTS.md` — BOOT-01 ~ BOOT-04
- `.planning/ROADMAP.md` — Phase 15 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SettingsDialog.tsx` — 已有托盘设置分区（trayEnabled + closeToTray 两个 Switch），开机启动 Switch 可直接追加，复用依赖控制模式（opacity-50 pointer-events-none）
- `App.tsx` — 已有完整的设置加载/持久化模式（useEffect loadTraySettings + handleXxxChange callbacks），开机启动可完全复用
- `useVisibilityState.ts` — 已有 VISIBLE / TRAY_HIDDEN 状态，前端只需在收到 autostart 事件时调用 hideToTray()
- `lib.rs` — 已有 Rust 端 setup 初始化模式（托盘图标创建、全局事件处理器），autostart 逻辑可嵌入同一 setup 块

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- Rust 端 emit 事件 → 前端 listen 事件（参考 main:shown-from-rust 模式）
- SettingsDialog Switch 组件使用 shadcn/ui Switch + 依赖控制（disabled + opacity）

### Integration Points
- `src-tauri/Cargo.toml` — 添加 tauri-plugin-autostart 依赖
- `src-tauri/src/lib.rs` — setup 中添加 autostart plugin 初始化、--autostart 检测、自愈检查
- `src-tauri/capabilities/default.json` — 可能需要追加 autostart 相关权限
- `src/components/SettingsDialog.tsx` — 托盘分区添加第三个 Switch（autostartEnabled），依赖 closeToTray
- `src/App.tsx` — 添加 autostartEnabled 状态、加载/持久化、监听 autostart-hidden 事件、级联关闭逻辑

</code_context>

<specifics>
## Specific Ideas

- 开机启动 Switch 描述文案建议："Windows 启动时自动运行 EasyPack 并最小化到系统托盘"
- 依赖关系展示：当 closeToTray 关闭时，开机启动 Switch 禁用 + 半透明 + 提示文字"请先开启'关闭时隐藏到托盘'"
- 关闭 trayEnabled 时级联关闭 autostartEnabled 的逻辑应在 handleTrayEnabledChange 回调中实现

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-开机启动*
*Context gathered: 2026-05-14*
