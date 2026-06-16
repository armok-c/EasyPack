# Phase 16: 版本管理 - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以看到当前版本号并在有新版本时收到通知。应用启动时通过 GitHub Releases API 检查更新（24h 缓存），发现新版本后在设置齿轮图标上显示红点，用户打开设置弹窗后看到更新提示条，点击跳转到 GitHub Releases 下载页面。

涉及需求: VER-01, VER-02, VER-03, VER-04

</domain>

<decisions>
## Implementation Decisions

### 版本号显示位置
- **D-01:** 当前版本号显示在 SettingsDialog 底部，作为一行小文字（如 "v0.1.0"）
- **D-02:** 不在 TitleBar 上显示版本号——TitleBar 空间已紧凑（图标+拖拽区+按钮行），版本号不需要常驻可见

### 更新通知 UI
- **D-03:** 齿轮（Settings）图标右上角显示红色小圆点——表示有新版本可用
- **D-04:** 设置弹窗内，在版本号文字区域上方显示提示条——如"发现新版本 v0.2.0，点击下载"
- **D-05:** 点击提示条后用系统默认浏览器打开 GitHub Releases 页面（https://github.com/armok-c/EasyPack/releases/latest）
- **D-06:** 红点和提示条持续显示，直到用户更新到新版本——不因关闭设置弹窗而消失

### 版本号管理策略
- **D-07:** 三个文件（Cargo.toml、package.json、tauri.conf.json）的版本号手动同步——个人工具不频繁发版，手动改三处可接受
- **D-08:** 应用内版本号由 Rust 端从 tauri.conf.json 读取，通过 `#[tauri::command]` 返回给前端
- **D-09:** 前端不直接读取 package.json 的版本号

### Claude's Discretion
- Rust 端获取 tauri.conf.json version 的具体 API（tauri::Config 或 env! 宏）
- GitHub Releases API 调用的具体实现（Rust reqwest vs 前端 fetch）
- semver 版本比较逻辑的实现位置和库选择
- 24h 缓存的具体存储方式（tauri-plugin-store vs 文件 vs 内存）
- 红点组件的具体实现方式（absolute 定位小圆点）
- 设置弹窗内提示条的具体样式（参考 shadcn/ui Alert 组件）
- 网络错误或 API 限流时的静默失败策略
- capabilities/default.json 需要追加的权限（如果有新的 HTTP 请求权限）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/components/SettingsDialog.tsx` — 底部添加版本号显示、更新提示条
- `src/components/TitleBar.tsx` — 齿轮图标上添加红点（absolute 定位小圆点）
- `src-tauri/src/lib.rs` — 添加版本号获取 command、可能添加更新检查 command
- `src/App.tsx` — 更新检查状态管理、红点状态传递

### 新增文件
- 可能新增 `src/hooks/useUpdateCheck.ts` — 更新检查 hook（启动时检查、缓存管理、状态管理）

### 现有模式参考
- `src/components/SettingsDialog.tsx` — 设置弹窗分区模式（托盘/抽屉/开机启动），底部版本号区域
- `src/components/TitleBar.tsx` — 按钮布局模式，红点可参照 absolute 定位在图标右上角
- `src-tauri/src/lib.rs` — Rust 端 `#[tauri::command]` 定义模式
- `src/App.tsx` — 设置加载/持久化模式（useEffect loadSettings + handleXxxChange callbacks）

### Prior Phase Context
- `.planning/phases/15-开机启动/15-CONTEXT.md` — Rust 端 setup 初始化模式、SettingsDialog Switch 添加模式
- `.planning/phases/12-系统托盘/12-CONTEXT.md` — SettingsDialog 设置弹窗设计、App.tsx 状态管理

### Requirements
- `.planning/REQUIREMENTS.md` — VER-01 ~ VER-04
- `.planning/ROADMAP.md` — Phase 16 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SettingsDialog.tsx` — 已有完整设置弹窗（托盘/抽屉/开机启动分区），底部可自然添加版本号区域和更新提示条
- `TitleBar.tsx` — 已有齿轮按钮（Settings icon），红点可作为 absolute 定位子元素叠加
- `App.tsx` — 已有完整的设置加载/持久化模式，更新检查状态可复用同一模式
- `lib.rs` — 已有 Rust 端 command 定义模式，添加版本号/更新检查 command 零学习成本
- `tauri-plugin-store` — 已配置 autoSave，更新检查缓存可通过同一 store 持久化

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- Hook 生命周期管理（useEffect + cleanup return）
- UI 使用 Tailwind CSS utility classes + shadcn/ui 原语
- SettingsDialog 使用 shadcn/ui Dialog + Switch 组件

### Integration Points
- `src/components/SettingsDialog.tsx` — 底部添加版本号区域 + 更新提示条（在现有设置内容下方）
- `src/components/TitleBar.tsx` — 齿轮按钮上添加红点指示器（需要接收 updateAvailable prop）
- `src-tauri/src/lib.rs` — 添加 get_app_version command，可能添加 check_for_updates command
- `src/App.tsx` — 添加 updateAvailable 状态、启动时触发检查、传递状态给 TitleBar 和 SettingsDialog
- `src-tauri/Cargo.toml` — 可能需要添加 reqwest 依赖（如果 Rust 端做 HTTP 检查）

</code_context>

<specifics>
## Specific Ideas

- 版本号文字样式建议: `text-xs text-muted-foreground`，与设置弹窗其他描述文字风格一致
- 更新提示条样式建议: 参考 shadcn/ui Alert 组件，带蓝色/绿色左边框的信息条样式
- 红点样式建议: 6px 红色圆点，absolute 定位在齿轮图标右上角，使用 `bg-red-500 rounded-full`
- GitHub Releases URL: `https://github.com/armok-c/EasyPack/releases/latest`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-版本管理*
*Context gathered: 2026-05-14*
