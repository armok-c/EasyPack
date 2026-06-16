# Phase 12: 系统托盘 - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

应用常驻系统托盘。关闭窗口不退出程序，隐藏到托盘。托盘图标提供完整操作入口：单击显示窗口、右键菜单含最近执行指令和退出。用户可在设置中开关托盘行为。窗口可见性状态机在此阶段建立，为 Phase 14 边缘抽屉铺路。

涉及需求: TRAY-01, TRAY-02, TRAY-03, TRAY-04, TRAY-05, TRAY-06, TRAY-07, TRAY-08

</domain>

<decisions>
## Implementation Decisions

### 托盘菜单内容
- **D-01:** 显示最近执行的 8 个指令，指令名加前缀 "▸ 执行:"
- **D-02:** 菜单顶部显示当前选中项目名（禁用状态项），如 "▸ EasyPack (my-project)"
- **D-03:** 无最近执行记录时（首次启动），完全隐藏指令区域，仅显示 "显示/隐藏窗口" + 分隔线 + "退出"
- **D-04:** 完整菜单结构：显示/隐藏窗口 → 分隔线 → 项目名（禁用） → 最近指令列表 → 分隔线 → 退出

### 关闭与最小化行为
- **D-05:** 关闭按钮（TitleBar X）→ 隐藏到托盘，不退出
- **D-06:** 最小化按钮 → 正常最小化到任务栏（Discord/Slack 模式）
- **D-07:** Alt+F4 → 也隐藏到托盘，与关闭按钮行为一致
- **D-08:** 唯一真正退出方式：托盘右键菜单 "退出"

### 托盘图标交互
- **D-09:** 单击托盘图标 → 始终显示窗口并聚焦（不是 toggle）
- **D-10:** 双击托盘图标 → 无操作，避免与单击冲突
- **D-11:** 右键托盘图标 → 上下文菜单（见 D-04）
- **D-12:** Tooltip 固定显示 "EasyPack"，不随状态变化

### 设置界面
- **D-13:** TitleBar 新增齿轮图标按钮（Settings 按钮），位于窗口控制按钮左侧
- **D-14:** 通用设置弹窗（SettingsDialog 组件），托盘为其中一个分区，为未来设置项留空间
- **D-15:** 两个开关：①"启用系统托盘"（总开关，关闭后无托盘图标）②"关闭时隐藏到托盘"（控制关闭按钮行为，依赖总开关）
- **D-16:** 关闭总开关立即生效——托盘图标消失，关闭按钮恢复为直接退出应用

### 窗口可见性状态机（为 Phase 14 铺路）
- **D-17:** 建立可见性状态：VISIBLE / TRAY_HIDDEN，状态切换通过明确的函数控制
- **D-18:** Phase 14 将扩展为 VISIBLE / TRAY_HIDDEN / DRAWER_HIDDEN 三态，此阶段为扩展留好接口

### Claude's Discretion
- 最近执行指令的持久化存储方式（store key 结构、最大条目数）
- 最近执行指令列表的更新时机（执行成功后追加、去重逻辑）
- 托盘菜单的动态刷新方式（每次右键时重新构建 vs 状态变化时更新）
- SettingsDialog 组件的 UI 设计（Tab vs Section、开关组件样式）
- TitleBar 齿轮按钮的位置细节（紧贴窗口控制按钮左侧还是有一定间距）
- tray-icon feature 在 Cargo.toml 中的添加方式
- tauri.conf.json 中 trayIcon 配置块的具体字段
- capabilities/default.json 需要追加的权限列表

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/components/TitleBar.tsx` — 关闭按钮需改为 hide()，新增齿轮按钮
- `src/App.tsx` — 托盘初始化、onCloseRequested 拦截、窗口可见性状态机
- `src-tauri/src/lib.rs` — 可能需要在 .setup() 中处理托盘相关初始化
- `src-tauri/Cargo.toml` — 需添加 `"tray-icon"` feature 到 tauri 依赖
- `src-tauri/tauri.conf.json` — 需添加 trayIcon 配置块
- `src-tauri/capabilities/default.json` — 需追加 window show/hide/focus 权限

### 新增文件
- `src/hooks/useTray.ts` — 托盘图标创建、菜单构建、事件处理
- `src/hooks/useRecentCommands.ts` — 最近执行指令列表管理
- `src/components/SettingsDialog.tsx` — 通用设置弹窗（含托盘设置分区）

### Tauri 官方文档
- Tauri v2 System Tray — https://v2.tauri.app/learn/system-tray/ （TrayIcon + Menu JS API）
- Tauri v2 Window API — https://v2.tauri.app/reference/javascript/api/namespacewindow/ （show, hide, setFocus, onCloseRequested）

### 现有模式参考
- `src/components/CommandDialog.tsx` — 现有弹窗模式（SettingsDialog 可参考）
- `src/hooks/useGlobalShortcuts.ts` — Phase 11 新增的 hook 模式（生命周期管理、cleanup）
- `src/hooks/useProject.ts` — executeCommand 执行链路、store 持久化模式

### Prior Phase Context
- `.planning/phases/11-全局快捷键/11-CONTEXT.md` — 直接依赖阶段，全局快捷键在托盘模式下仍然生效（D-02）

### Research Documents
- `.planning/research/FEATURES.md` — Feature 2: System Tray 架构分析和技术实现细节
- `.planning/research/ARCHITECTURE.md` — 托盘集成架构图、close-to-tray 拦截模式、Anti-Patterns

### Requirements
- `.planning/REQUIREMENTS.md` — TRAY-01 ~ TRAY-08
- `.planning/ROADMAP.md` — Phase 12 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TitleBar.tsx` — 已有 handleClose 调用 appWindow.close()，需改为 appWindow.hide()；新增齿轮按钮
- `App.tsx` — 已有 useGlobalShortcuts hook 集成模式，托盘初始化可类似方式加入
- `useProject.ts` — executeCommand 执行链路完整，托盘菜单指令执行可复用同一路径
- `tauri-plugin-store` — 已配置 autoSave，最近执行列表和托盘设置可通过同一 store 持久化
- `CommandDialog.tsx` — 现有弹窗组件模式（Dialog + 表单），SettingsDialog 可参考

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- Hook 生命周期管理（useEffect + cleanup return，参考 useGlobalShortcuts）
- UI 使用 Tailwind CSS utility classes + shadcn/ui 原语
- 弹窗组件使用 Dialog + 自定义内容区域

### Integration Points
- `src-tauri/Cargo.toml` — tauri features 添加 "tray-icon"
- `src-tauri/tauri.conf.json` — 添加 trayIcon 配置块
- `src-tauri/capabilities/default.json` — 追加 show/hide/focus/onCloseRequested 权限
- `src/App.tsx` — 添加 onCloseRequested 拦截、useTray 初始化
- `src/components/TitleBar.tsx` — 修改 close 行为 + 新增齿轮按钮
- `src/hooks/useProject.ts` — 可能需要导出 executeCommand 供托盘菜单使用，或添加最近执行记录功能

</code_context>

<specifics>
## Specific Ideas

- TitleBar 齿轮按钮建议放在最小化按钮左侧，使用 Settings (lucide-react) 图标
- 最近执行指令列表建议在执行成功后追加到列表头部，相同指令去重（移到头部），保持最多 8 条
- SettingsDialog 建议使用 shadcn/ui Dialog + Switch 组件
- 托盘图标直接复用应用图标（已有 icons/ 目录下的资源）
- 关闭总开关时托盘图标立即消失，需要调用 TrayIcon.remove() 或类似 API

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-系统托盘*
*Context gathered: 2026-04-27*
