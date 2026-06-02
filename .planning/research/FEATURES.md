# Feature Research: v2.0 Milestone

**Domain:** Windows desktop project launcher -- v2.0 capability upgrade
**Researched:** 2026-05-13
**Confidence:** HIGH
**Scope:** Only the 6 new features for v2.0. Existing v1.0/v1.1/v1.2 features are documented in PROJECT.md and the v1.2 FEATURES.md.

## Executive Summary

v2.0 的核心目标是将 EasyPack 从"单行指令执行器"升级为"多行脚本 + 完整快捷键管理 + 多配置系统"的强大桌面工具。6 个特性按复杂度和技术依赖可分为三个层次：

**低复杂度层（快速交付）：** 开机自启 + 应用版本管理。两个特性都有成熟的 Tauri 官方插件（`tauri-plugin-autostart` 和 GitHub REST API），实现模式简单直接。开机自启本质是 tray-icon 的延伸，版本检查只需要一个 HTTP 请求。合计约 3-5 天工作量。

**中等复杂度层（核心升级）：** 多行脚本指令 + 完整快捷键面板。多行脚本是 v2.0 最有价值的功能 -- 从"一条命令一个终端窗口"升级为"多行脚本顺序执行 + 流控制"。快捷键面板则是对 v1.2 已有快捷键功能的 UI 升级，从"卡片上直接绑定"变为"VS Code 风格的集中管理面板"。两者合计约 8-12 天。

**高复杂度层（体验优化）：** 悬浮窗改进 + 多配置文件。悬浮窗折叠态需要在运行时动态调整 WebviewWindow 大小，涉及窗口动画和状态管理。多配置文件需要重构整个 store 层，将现有的"单一扁平 JSON"升级为"多 profile 隔离"的数据架构。合计约 6-9 天。

**关键技术发现：**
- 多行脚本不需要实现完整的脚本语言解释器。最务实的方案是将多行脚本写入临时 `.bat` 文件，让 `cmd.exe` 执行，这样天然支持 if/else/for/变量 等 cmd.exe 原生语法。
- Tauri 官方 updater 插件强制要求签名验证，不适合个人开源项目。推荐直接用 GitHub REST API `GET /repos/{owner}/{repo}/releases/latest` 检查版本，仅做通知，不做自动下载。
- 悬浮窗折叠态可通过 `WebviewWindow.setSize()` + CSS 动画实现，不需要创建新窗口。
- 多配置文件的核心挑战不是"切换"（只是换一组 store keys），而是"导入/导出"需要定义稳定的数据格式版本。

---

## Feature 1: Multi-line Script Commands with Flow Control

### What Users Expect

用户期望从"每条指令打开一个终端窗口执行单行命令"升级为"一条指令可以包含多行脚本，按顺序执行，支持条件判断"。这是 v2.0 最核心的能力提升。

### Table Stakes

| Aspect | Expectation | Notes |
|--------|-------------|-------|
| 多行编辑器 | 不是单行 Input，而是多行文本区域，每行一条命令 | 当前 CommandDialog 的 Shell 命令字段是 `<Input>` 单行输入。需要换为 `<textarea>` 或代码编辑器组件 |
| 顺序执行 | 多行命令从上到下依次执行 | cmd.exe 天然支持：`cmd /K "line1 & line2 & line3"` 或 `.bat` 文件 |
| 错误处理 | 默认某行失败后是否继续执行需要明确行为 | `&`（无论前一条是否成功继续）vs `&&`（前一条成功才继续）。推荐默认 `&&`，提供切换选项 |
| 变量/条件 | 支持 cmd.exe 原生的 if/else/for/变量 | 不需要自己实现解释器，直接利用 cmd.exe 的脚本能力 |

### Differentiators

| Aspect | Value | Notes |
|--------|-------|-------|
| 内置模板 | 提供常用多行脚本模板（如"拉取+安装+构建"三件套） | 用户一键添加，不用手写复杂脚本 |
| 错误策略选择 | 每个多行脚本可选"严格模式"（失败即停）或"宽松模式"（继续执行） | 区别于简单 bat 文件，提供 UI 级别的控制 |

### Anti-Features

| Anti-Feature | Why Avoid | Instead |
|--------------|-----------|---------|
| 内置脚本解释器 | 实现一个 DSL 或解释器是巨大的工程黑洞，且 cmd.exe 已经能做所有事 | 将多行脚本写入临时 .bat 文件，由 cmd.exe 执行 |
| 实时输出回显 | 需要内嵌终端或复杂的 stdout/stderr 流式传输，违背"外部终端"的产品定位 | 仍在外部终端窗口执行，保持 v1.0 的设计哲学 |
| 可视化流程图 | 像 Scratch/Blueprint 那样的拖拽式流程编辑器，复杂度极高且用户群不需要 | 纯文本多行编辑器 + 语法高亮即可 |
| 支持 Bash/zsh 语法 | EasyPack 是 Windows-only 工具，Windows 默认终端是 cmd.exe 或 PowerShell | 仅支持 cmd.exe 批处理语法，未来可扩展 PowerShell |

### Technical Approach

**方案（推荐）：临时 .bat 文件**

当前 `execute_command` 使用 `cmd /C start "" cmd /K "command"` 在新终端窗口执行单行命令。多行脚本的最简方案：

1. 前端将多行命令（用 `\n` 分隔的字符串）发送到 Rust 后端
2. Rust 将多行命令写入临时 `.bat` 文件（`std::env::temp_dir()` + 随机文件名）
3. 用 `cmd /C start "" /d "project_path" cmd /K "temp.bat"` 执行
4. 执行后可选删除临时文件

```rust
// 伪代码
fn execute_multiline_command(project_path: &str, script_lines: &str, error_mode: &str) {
    let separator = match error_mode {
        "strict" => " && ",    // 任何一行失败即停止
        "lenient" => " & ",    // 无论成功失败继续
        _ => "\n",             // bat 文件模式，每行一条命令
    };
    let script_content = script_lines;
    // 写入临时 .bat 文件
    let temp_path = std::env::temp_dir().join(format!("easypack_{}.bat", uuid::Uuid::new_v4()));
    std::fs::write(&temp_path, script_content)?;
    // 执行
    StdCommand::new("cmd")
        .raw_arg(format!(r#"/C start "" /d "{}" cmd /K "{}""#, project_path, temp_path.display()))
        .spawn()?;
}
```

**数据模型变更：**

```typescript
// 现有 CommandItem.command 是单行字符串
// 扩展为支持多行
interface CommandItem {
  // ... existing fields ...
  command: string;           // 单行命令（向后兼容）
  script?: string;           // 多行脚本（新字段，存在时优先使用）
  errorMode?: "strict" | "lenient";  // 错误处理策略，默认 "strict"
  isMultiLine?: boolean;     // 快速判断是否为多行脚本
}
```

### Complexity Assessment

| Component | Complexity | Reason |
|-----------|------------|--------|
| 前端多行编辑器 | MEDIUM | textarea + 基础语法高亮，或引入轻量编辑器（如 CodeMirror 6） |
| Rust 临时文件写入 | LOW | std::fs::write + temp_dir，标准模式 |
| CommandDialog 扩展 | LOW-MEDIUM | 单行/多行模式切换，多行时显示 textarea |
| 预设模板系统 | LOW | 只是预定义的多行 script 字符串 |

### Dependencies on Existing Features

- **CommandDialog**：需要扩展为支持单行/多行两种模式。单行模式保持现有 `<Input>`，多行模式切换为 `<textarea>`。
- **execute_command (Rust)**：需要新增或扩展命令，支持接收多行脚本内容。
- **CommandItem 类型**：新增 `script`、`errorMode`、`isMultiLine` 字段。需向后兼容（这些字段可选，旧数据不受影响）。
- **CommandCard**：需要区分显示单行命令和多行脚本（如显示行数标记）。

---

## Feature 2: App Version Display + GitHub Update Check

### What Users Expect

用户想知道当前安装的版本号，并在有新版本时收到提醒。这是桌面应用的基本期望。

### Table Stakes

| Aspect | Expectation | Notes |
|--------|-------------|-------|
| 版本号显示 | 在标题栏或设置页面显示当前版本号 | 从 `tauri.conf.json` 的 `version` 字段读取，或从 `package.json` 读取 |
| 更新检查 | 能检查 GitHub 上是否有新版本 | 调用 GitHub REST API，对比 semver 版本号 |
| 更新通知 | 有新版本时显示 toast 或 badge 提示 | 不自动下载，只提示用户前往 GitHub Release 页面 |

### Differentiators

| Aspect | Value | Notes |
|--------|-------|-------|
| Changelog 展示 | 显示新版本的更新日志 | 从 GitHub Release 的 body 字段解析 markdown |

### Anti-Features

| Anti-Feature | Why Avoid | Instead |
|--------------|-----------|---------|
| 自动下载安装 | Tauri updater 强制要求签名验证（"This cannot be disabled"），对个人开源项目来说配置签名密钥和工作流的维护成本远大于收益 | 仅通知，引导用户手动去 GitHub Release 下载 |
| 自动检查定时器 | 后台定时检查消耗资源，且个人工具不需要实时更新感知 | 用户主动触发检查（如点击"检查更新"按钮），或每次启动时检查一次 |
| 使用 Tauri updater 插件 | 强制签名验证 + 需要配置 pubkey + 需要 GitHub Actions 签名工作流 + 需要维护 latest.json 端点。对于个人开源项目来说是过度工程 | 直接用 GitHub REST API 获取最新 release 信息 |

### Technical Approach

**版本号来源：**
- `tauri.conf.json` 中的 `version` 字段（当前是 `"0.1.0"`，需在发布时更新）
- 或从 Rust 端通过 `env!("CARGO_PKG_VERSION")` 编译时注入

**更新检查 API：**
```
GET https://api.github.com/repos/{owner}/{repo}/releases/latest
```

返回 `tag_name`（如 `"v2.0.0"`）、`html_url`（Release 页面链接）、`body`（changelog markdown）。

**版本比较：** 简单的 semver 比较。解析 `major.minor.patch`，逐段对比。

**GitHub API 限制：** 未认证请求 60 次/小时，对个人工具绰绰有余。如果不够，可以加 `Authorization: token` 头（无需权限的 public_repo token）。

**UI 位置：**
- 当前版本号：SettingsDialog 底部或 TitleBar
- 更新提示：toast 通知 + SettingsDialog 中的"检查更新"按钮
- 新版本信息：Dialog 弹窗显示 changelog + "前往下载"按钮

### Complexity Assessment

| Component | Complexity | Reason |
|-----------|------------|--------|
| 版本号读取 | LOW | 从 tauri.conf.json 或 Cargo.toml 编译时注入 |
| GitHub API 调用 | LOW | 单个 fetch 请求，Rust 端用 reqwest 或前端用 Tauri HTTP 插件 |
| Semver 比较 | LOW | 简单的字符串解析和数字比较 |
| UI 集成 | LOW | SettingsDialog 加一个区域 |

### Dependencies on Existing Features

- **SettingsDialog**：添加"关于"或"版本"区域，包含当前版本号 + 检查更新按钮。
- **tauri.conf.json**：需要在每次发布前更新 `version` 字段。

---

## Feature 3: VS Code Style Keyboard Shortcut Customization Panel

### What Users Expect

v1.2 已实现了基础快捷键绑定（在 CommandCard 上直接录音绑定）。v2.0 的升级是将此功能从"散落在各卡片上"变为"集中管理的专用面板"，参考 VS Code 的 Keyboard Shortcuts 编辑器。

### Table Stakes

| Aspect | Expectation | Notes |
|--------|-------------|-------|
| 集中式快捷键列表 | 所有快捷键在一个面板中统一展示和管理，而非分散在各个 CommandCard 上 | 类似 VS Code 的 `Ctrl+K Ctrl+S` 快捷键面板 |
| 搜索/筛选 | 能搜索命令名称，快速找到要修改的快捷键 | 输入框 + 列表过滤 |
| 录音式绑定 | 点击某行，按下快捷键组合，立即绑定 | 复用 v1.2 已实现的录音逻辑 |
| 冲突检测 | 绑定时检测是否有冲突，显示警告 | 复用 v1.2 已实现的冲突检测 |
| 重置/清除 | 能清除单个快捷键或重置全部 | 单行右键菜单或按钮 |

### Differentiators

| Aspect | Value | Notes |
|--------|-------|-------|
| 分类展示 | 按项目/全局分组，或按功能分组 | 帮助用户理解哪些快捷键是全局的，哪些是项目级的 |
| 未绑定筛选 | 一键筛选所有未绑定快捷键的命令 | 帮助用户发现可分配快捷键的命令 |

### Anti-Features

| Anti-Feature | Why Avoid | Instead |
|--------------|-----------|---------|
| 快捷键方案导入/导出 | 与多配置文件功能重复，且快捷键已随 store 持久化 | 快捷键随 profile 导入/导出，不需要独立功能 |
| 快捷键多方案切换 | 不需要类似 VS Code 的 Vim/Emacs 键映射方案 | 一套快捷键方案，简单直接 |
| 快捷键冲突时自动覆盖 | 静默覆盖会让用户困惑"为什么之前的快捷键不工作了" | 明确提示冲突，让用户确认是否覆盖 |

### Technical Approach

**UI 组件结构：**

```
ShortcutPanel (Dialog 或独立页面)
├── SearchInput                    -- 搜索命令名称
├── FilterTabs                     -- 全部 / 全局 / 当前项目
└── ShortcutList                   -- 虚拟化列表
    └── ShortcutRow (per command)
        ├── CommandIcon + CommandName
        ├── CurrentShortcut (badge)
        └── Actions (Record / Clear / Edit)
```

**数据来源：** 直接读取当前 commands 列表（已有 shortcut 字段）。不需要新的数据结构。

**实现方式：**
1. 新建 `ShortcutPanel.tsx` 组件
2. 从 `useProject` 获取 `commands`、`assignShortcut`、`clearShortcut`
3. 录音逻辑复用 v1.2 已有的 `useGlobalShortcuts` 中的录音机制
4. 搜索用简单的 `String.includes()` 过滤
5. 分类标签过滤 commands 的 `scope` 字段

**入口：** SettingsDialog 中添加"快捷键管理"按钮，点击打开 ShortcutPanel Dialog。或 TitleBar 上添加快捷键图标按钮。

### Complexity Assessment

| Component | Complexity | Reason |
|-----------|------------|--------|
| ShortcutPanel UI | MEDIUM | 新组件，但主要是列表 + 搜索 + 录音交互，模式成熟 |
| 搜索/筛选逻辑 | LOW | 简单的字符串过滤 |
| 录音交互 | LOW | 复用 v1.2 已有逻辑 |
| 冲突检测展示 | LOW | 复用 v1.2 已有逻辑，增加行内提示 |

### Dependencies on Existing Features

- **useProject.assignShortcut / clearShortcut**：直接复用，不需要修改。
- **useGlobalShortcuts**：录音机制复用，可能需要提取公共的录音 hook。
- **CommandItem.shortcut**：数据结构不需要变更。
- **SettingsDialog**：添加入口按钮。

---

## Feature 4: Collapsible Floating Window

### What Users Expect

当前悬浮窗（v1.2 实现）是一个 220x300 的固定大小窗口，显示项目名和命令列表。v2.0 的升级是让它可以"折叠"为一个更小的形态，只显示项目名和图标，点击后展开恢复。

### Table Stakes

| Aspect | Expectation | Notes |
|--------|-------------|-------|
| 折叠态 | 点击折叠按钮后，窗口缩小为仅显示项目图标+名称的迷你条 | 约 220x28 px（与当前 header 等高） |
| 展开态 | 点击折叠态的迷你条，窗口恢复完整大小 | 220x300 px（当前大小） |
| 切换项目 | 折叠态点击项目名称弹出项目列表选择器 | 解决"折叠后无法切换项目"的问题 |
| 状态记忆 | 折叠/展开状态跨会话记住 | 存储在 store 中 |

### Differentiators

| Aspect | Value | Notes |
|--------|-------|-------|
| 折叠态执行最近命令 | 折叠态显示最近执行的命令名，单击快速重新执行 | 提升折叠态的实用性 |

### Anti-Features

| Anti-Feature | Why Avoid | Instead |
|--------------|-----------|---------|
| 窗口内嵌动画 resize | Tauri WebviewWindow.setSize 是即时生效的，没有原生动画支持。逐帧 setSize 会有闪烁 | 用 CSS transform: scale/height 动画在视觉上平滑过渡，resize 在动画结束后一次性应用 |
| 折叠态显示所有项目列表 | 220px 宽的空间不适合显示完整的项目列表 | 折叠态只显示当前项目名+图标，点击弹出下拉选择 |
| 始终折叠 | 悬浮窗的价值在于快速访问命令，始终折叠失去了意义 | 默认展开，用户主动折叠 |

### Technical Approach

**实现方案：**

1. **FloatApp.tsx 增加 collapsed state**
   - 新增 `collapsed: boolean` state
   - collapsed=true 时只渲染 header bar（项目图标+名称+折叠按钮）
   - collapsed=false 时渲染完整命令列表

2. **窗口大小调整**
   - 切换 collapsed 时，通过 Tauri 事件通知主窗口
   - 主窗口调用 `floatWin.setSize(new LogicalSize(220, collapsed ? 28 : 300))`
   - 注意：setSize 后需要重新定位（底部锚定或顶部锚定）

3. **折叠态项目切换**
   - 点击项目名称 -> 弹出 Dropdown/Popover 显示项目列表
   - 选择项目 -> emit 事件到主窗口 -> 主窗口切换项目 -> 推送新状态回悬浮窗

4. **状态持久化**
   - 在 store 中保存 `floatCollapsed: boolean`
   - 悬浮窗创建时读取并发送初始状态

**窗口 resize 注意事项（基于代码库现有实现）：**

当前 `useFloatWindow.ts` 创建悬浮窗时设置了固定大小：
```typescript
const floatWin = new WebviewWindow("float", {
  width: 220, minWidth: 220, maxWidth: 220,
  height: 300, minHeight: 200,
  resizable: false,
  // ...
});
```

折叠时需要：
- 调整 `height` 和 `minHeight`（通过 `setSize` + `setMinSize`）
- 重新定位窗口（避免窗口底部位置跳动）

### Complexity Assessment

| Component | Complexity | Reason |
|-----------|------------|--------|
| FloatApp 折叠 UI | LOW-MEDIUM | 条件渲染，CSS 过渡动画 |
| 窗口大小动态调整 | MEDIUM | 需要处理 resize + reposition 的协调 |
| 折叠态项目选择器 | LOW | 复用 Dropdown/Popover 组件 |
| 状态同步 | LOW | 复用已有的 Tauri 事件系统 |
| 状态持久化 | LOW | store.set("floatCollapsed", boolean) |

### Dependencies on Existing Features

- **FloatApp.tsx**：核心修改目标，增加折叠/展开条件渲染。
- **useFloatWindow.ts**：需要支持 resize 指令（新增 `resizeFloat` 方法或通过事件触发）。
- **项目列表数据**：折叠态项目选择器需要从主窗口获取 projects 列表（扩展 `float:state-update` 事件）。

---

## Feature 5: Auto-start on Boot (Windows)

### What Users Expect

用户期望能设置 EasyPack 开机自动启动，启动后最小化到托盘（不显示窗口）。这是"常驻后台"桌面工具的标准能力。

### Table Stakes

| Aspect | Expectation | Notes |
|--------|-------------|-------|
| 开机自启开关 | 在设置中提供开关，启用/禁用开机自启 | 使用 Tauri autostart 插件 |
| 启动后最小化 | 开机自启时，不显示主窗口，直接隐藏到托盘 | 需要区分"用户手动启动"和"开机自启" |
| 与托盘联动 | 开机自启依赖系统托盘（v1.2 已实现） | autostart 只负责注册/取消注册启动项 |

### Differentiators

| Aspect | Value | Notes |
|--------|-------|-------|
| 启动参数传递 | 自启时传入 `--hidden` 参数，Rust 端检测到后自动隐藏窗口 | 区分"用户双击启动"和"开机自启" |

### Anti-Features

| Anti-Feature | Why Avoid | Instead |
|--------------|-----------|---------|
| 手动操作注册表 | 直接写 Windows 注册表 HKCU\Software\Microsoft\Windows\CurrentVersion\Run 虽然可行，但需要处理路径转义、卸载清理等问题 | 使用 Tauri 官方 `tauri-plugin-autostart` 插件，已处理所有平台细节 |
| 启动延迟设置 | "延迟 30 秒再启动"等功能对个人工具来说是过度设计 | 系统默认的启动时机即可 |

### Technical Approach

**Tauri autostart 插件（官方，HIGH confidence）：**

1. **安装：** `cargo add tauri-plugin-autostart` + `npm install @tauri-apps/plugin-autostart`
2. **注册插件：** `app.handle().plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))`
3. **权限配置：** 在 capabilities 中添加 `"autostart:allow-enable"`, `"autostart:allow-disable"`, `"autostart:allow-is-enabled"`
4. **JS API：** `enable()` / `disable()` / `isEnabled()`
5. **启动参数：** `init` 的第二个参数可传入启动参数（如 `Some(vec!["--autostarted"])`）

**启动后隐藏逻辑：**

```rust
// lib.rs setup 中
app.handle().plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    Some(vec!["--autostarted"]),  // 自启时传入此参数
));
```

```typescript
// 前端检测
const args = await getCLIArgs(); // 或检查 window.__TAURI__
if (args.includes("--autostarted")) {
  // 开机自启：隐藏到托盘，不显示窗口
  await appWindow.hide();
  hideToTray();
}
```

**SettingsDialog UI：** 在现有的"系统托盘"区域下添加"开机自启"开关。

### Complexity Assessment

| Component | Complexity | Reason |
|-----------|------------|--------|
| 插件安装+注册 | LOW | 标准的 Tauri 插件集成模式 |
| 启动参数检测 | LOW-MEDIUM | 需要确认 Tauri 2 中获取启动参数的 API（可能需要 `@tauri-apps/plugin-process`） |
| UI 开关 | LOW | SettingsDialog 添加一个 Switch |

### Dependencies on Existing Features

- **tauri-plugin-autostart**：新依赖，需要添加到 Cargo.toml 和 package.json。
- **SettingsDialog**：添加"开机自启"开关区域。
- **useTray / App.tsx**：启动时检测 `--autostarted` 参数，决定是否隐藏窗口。
- **tray-icon 功能**：必须已启用（v1.2 已实现）。开机自启后窗口隐藏，用户只能通过托盘找回。

---

## Feature 6: Multi-config Profile System with Import/Export

### What Users Expect

用户期望能保存多套独立配置（如"工作项目"、"个人项目"、"客户A项目"），并能在不同配置间切换。还需要能导出配置为文件，在另一台电脑上导入。

### Table Stakes

| Aspect | Expectation | Notes |
|--------|-------------|-------|
| 多 profile 管理 | 创建、切换、重命名、删除 profile | 每个 profile 包含独立的项目列表 + 指令配置 + 快捷键绑定 + 偏好设置 |
| Profile 切换 | 一键切换当前活跃 profile | 切换后所有数据（项目、指令、快捷键）立即更新 |
| 导出 | 将当前 profile 导出为 JSON 文件 | 包含所有配置数据的完整快照 |
| 导入 | 从 JSON 文件导入 profile | 支持版本迁移（旧格式 -> 新格式） |
| 默认 profile | 首次使用自动创建 "Default" profile | 向后兼容：现有用户数据自动迁移到 Default profile |

### Differentiators

| Aspect | Value | Notes |
|--------|-------|-------|
| 数据格式版本化 | 导出的 JSON 包含 `schemaVersion` 字段 | 未来格式变更时可自动迁移 |
| 选择性导入 | 导入时可选覆盖/合并 | 避免用户担心导入会覆盖现有配置 |

### Anti-Features

| Anti-Feature | Why Avoid | Instead |
|--------------|-----------|---------|
| 云同步 | 需要后端服务、用户账户、冲突解决。严重超出产品范围 | 仅本地文件导入/导出 |
| Profile 间共享指令 | "全局指令跨 profile 共享"增加数据模型复杂度 | 每个 profile 完全独立，简单清晰 |
| 加密导出 | 个人开发工具的配置不含敏感信息（只有本地路径和命令） | 明文 JSON，方便用户查看和手动编辑 |
| 自动定时备份 | 对于配置变更频率极低的工具来说不需要 | 导出操作足够简单，用户手动备份即可 |

### Technical Approach

**数据模型变更：**

当前 store 是扁平的：
```
easypack-store.json:
{
  "projects": [...],
  "selectedProjectId": "...",
  "customCommands": [...],
  "projectCommands:xxx": [...],
  "presetShortcuts": {...},
  "trayEnabled": true,
  "closeToTray": true,
  "drawerEnabled": false
}
```

多 profile 方案需要将数据隔离：

```
easypack-store.json:
{
  "activeProfile": "default",
  "profiles": {
    "default": {
      "name": "默认",
      "projects": [...],
      "selectedProjectId": "...",
      "customCommands": [...],
      "projectCommands:xxx": [...],
      "presetShortcuts": {...},
    },
    "work": {
      "name": "工作",
      "projects": [...],
      // ...
    }
  },
  // 全局设置（跨 profile 共享）
  "trayEnabled": true,
  "closeToTray": true,
  "drawerEnabled": false,
  "autostartEnabled": false
}
```

**关键设计决策：**

1. **全局 vs Profile 级别设置：**
   - Profile 级别：projects, commands, shortcuts, selectedProjectId
   - 全局级别：trayEnabled, closeToTray, drawerEnabled, autostartEnabled, floatCollapsed
   - 理由：系统行为设置（托盘、自启）不应随 profile 变化

2. **数据迁移策略：**
   - 检测 store 中是否已有 `profiles` key
   - 如果没有（旧版数据），将所有 profile 级别的数据迁移到 `profiles.default` 下
   - 迁移是自动的、一次性操作

3. **导出格式：**
```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-13T10:00:00Z",
  "appName": "EasyPack",
  "appVersion": "2.0.0",
  "profileName": "工作",
  "data": {
    "projects": [...],
    "customCommands": [...],
    "projectCommands": {...},
    "presetShortcuts": {...}
  }
}
```

4. **导入流程：**
   - 用户选择 JSON 文件（tauri-plugin-dialog）
   - 验证格式和 schemaVersion
   - 创建新 profile 或覆盖现有 profile
   - 切换到导入的 profile

**UI 位置：**
- SettingsDialog 新增"配置管理"区域
- Profile 下拉选择器（当前活跃 profile）
- "新建" / "重命名" / "删除" 按钮
- "导出当前配置" / "导入配置" 按钮

### Complexity Assessment

| Component | Complexity | Reason |
|-----------|------------|--------|
| 数据模型重构 | HIGH | 现有所有 store 读写操作都需要适配 profile 前缀。useProject.ts 是最大的改动点，~600 行代码需要审查每个 store.get/store.set 调用 |
| 数据迁移 | MEDIUM | 需要一次性迁移逻辑，处理各种边缘情况（空数据、损坏数据） |
| Profile 切换 | MEDIUM | 切换时需要清空当前 React state，加载新 profile 的数据，重新注册快捷键 |
| 导入/导出 | MEDIUM | 文件读写（tauri-plugin-fs 或 tauri-plugin-dialog），格式验证，错误处理 |
| UI 组件 | LOW-MEDIUM | Profile 选择器 + 管理按钮，模式成熟 |

### Dependencies on Existing Features

- **useProject.ts**：核心修改目标。所有 store 操作需要加上 profile 前缀。
- **tauri-plugin-store**：不需要更换，仍然是 JSON 持久化。
- **SettingsDialog**：添加配置管理 UI。
- **tauri-plugin-dialog**：导入时选择文件，导出时选择保存位置。
- **useGlobalShortcuts**：Profile 切换后需要重新注册快捷键。
- **useFloatWindow**：Profile 切换后需要同步新状态到悬浮窗。

---

## Feature Dependencies (Cross-feature)

```
Feature 1: Multi-line Script
    |
    +--depends on--> CommandDialog (extension)
    +--depends on--> execute_command (Rust backend extension)
    +--depends on--> CommandItem type (add script, errorMode fields)
    +--integrates--> Feature 6 (profile system stores scripts)

Feature 2: Version + Update Check
    |
    +--standalone--> No dependencies on other v2.0 features
    +--integrates--> SettingsDialog (add version area)
    +--requires--> tauri.conf.json version field (process)

Feature 3: Shortcut Panel
    |
    +--depends on--> v1.2 shortcut infrastructure (assignShortcut, clearShortcut, useGlobalShortcuts)
    +--integrates--> SettingsDialog (add entry button)
    +--integrates--> Feature 6 (shortcuts are profile-scoped)

Feature 4: Collapsible Float Window
    |
    +--depends on--> v1.2 floating window infrastructure (useFloatWindow, FloatApp)
    +--requires--> WebviewWindow.setSize() API
    +--integrates--> Feature 6 (floatCollapsed is global setting)

Feature 5: Auto-start on Boot
    |
    +--depends on--> v1.2 tray-icon infrastructure (must be able to hide to tray on launch)
    +--requires--> tauri-plugin-autostart (new Rust + npm dependency)
    +--integrates--> SettingsDialog (add autostart toggle)
    +--integrates--> App.tsx startup flow (detect --autostarted flag)

Feature 6: Multi-config Profile
    |
    +--BLOCKS: Nothing (can be built last)
    +--depends on--> All existing store-using code (useProject, App.tsx settings)
    +--requires--> Data migration logic
    +--requires--> tauri-plugin-dialog (for file picker in import/export)
    +--integrates--> Features 1, 3 (their data becomes profile-scoped)
```

### Dependency Notes

- **Feature 6 (Multi-config) should be built LAST** because it touches the data layer that all other features depend on. Building it first would mean every subsequent feature must immediately work with the new profile structure. Building it last means each feature can be built and tested with the current flat store, then adapted during the profile refactor.
- **Feature 5 (Auto-start) is the simplest** and can be done anytime after v1.2 tray is stable (which it is).
- **Feature 2 (Version check) is fully standalone** and can be done at any point.
- **Features 1 and 3 share the CommandDialog** but touch different aspects (script editing vs shortcut binding), so they can be parallelized.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority | Suggested Phase |
|---------|------------|---------------------|------|----------|-----------------|
| F1: Multi-line scripts | VERY HIGH (core capability upgrade) | MEDIUM-HIGH | MEDIUM | P0 | Phase 1 -- most impactful single feature |
| F2: Version + update check | LOW-MEDIUM (basic expectation) | LOW | LOW | P2 | Phase 2 -- quick win between complex features |
| F3: Shortcut panel | MEDIUM (UX polish) | MEDIUM | LOW | P1 | Phase 2 -- extends v1.2 foundation |
| F4: Collapsible float window | LOW-MEDIUM (power-user refinement) | MEDIUM | LOW-MEDIUM | P2 | Phase 3 -- optional enhancement |
| F5: Auto-start on boot | MEDIUM (convenience) | LOW | LOW | P2 | Phase 2 -- quick win, official plugin |
| F6: Multi-config profiles | HIGH (power-user essential) | HIGH | MEDIUM | P1 | Phase 4 -- foundational but should come last due to data layer scope |

---

## Competitor Feature Analysis (v2.0 Scope)

| Feature | VS Code | Raycast | PowerToys | EasyPack v2.0 |
|---------|---------|---------|-----------|---------------|
| Multi-line task/scripts | Tasks (tasks.json) | Script Commands | No | Multi-line script commands (bat files) |
| Version check + update | Built-in auto-update | Built-in auto-update | Microsoft Store | GitHub API check + manual download |
| Shortcut management panel | Keyboard Shortcuts editor | Hotkey configuration | Keyboard Manager | VS Code-style shortcut panel |
| Collapsible mini window | Zen Mode (not really) | Compact mode | Run popup | Collapsible floating window |
| Auto-start on boot | Yes (standard) | Yes (Launch at Login) | Yes (standard) | tauri-plugin-autostart |
| Multi-config/profiles | Workspaces | No | No | Profile system with import/export |

### Competitive Position for v2.0

v2.0 将 EasyPack 从"便利工具"提升为"专业开发者工具"。多行脚本是最核心的差异化能力 -- 大多数启动器只能执行单行命令，能执行多行脚本的几乎没有。多配置文件系统在同类工具中也很少见（VS Code 的 Workspaces 是类似概念但不同实现）。这两个功能组合让 EasyPack 能够满足"不同工作环境需要不同指令集"的真实需求。

---

## UX Patterns and User Expectations

### Multi-line Script Editor

**Desktop convention (MEDIUM confidence, based on terminal/IDE multi-line input patterns):**

1. **编辑器形式**：多行文本区域（textarea），每行一条命令。不需要完整的代码编辑器，但需要 monospace 字体和基础格式（行号可选）。

2. **单行/多行切换**：在 CommandDialog 中提供切换按钮或自动检测（输入含换行符自动切换为多行模式）。推荐自动检测 + 手动切换。

3. **执行方式**：多行脚本在同一个终端窗口中执行（不像单行命令那样可以多窗口并行）。这是用户的自然期望 -- 多行脚本本质是一个原子操作。

4. **错误策略**：默认"严格模式"（`&&` 连接，失败即停），因为大多数开发场景期望构建失败后不继续部署。提供"宽松模式"选项。

### Version Check

**Desktop convention (HIGH confidence, universal pattern):**

1. **检查时机**：用户手动点击"检查更新"按钮。不自动后台检查（个人工具，不需要实时更新）。

2. **结果展示**：当前是最新版 -> toast 提示"已是最新版本"。有新版本 -> Dialog 弹窗显示版本号 + changelog + "前往下载"按钮。

3. **版本号格式**：显示为 `v2.0.0` 格式，与 Git tag 一致。

### Shortcut Panel

**Desktop convention (HIGH confidence, based on VS Code / JetBrains):**

1. **面板布局**：顶部搜索栏 + 中间列表（命令名 | 快捷键 | 操作按钮）+ 底部可能的状态栏。这是 VS Code 键盘快捷键面板的标准布局。

2. **录音交互**：点击某行的快捷键区域，进入录音模式（背景高亮），按下组合键，显示捕获的快捷键。如果冲突，行内显示红色警告。

3. **搜索**：实时过滤，输入 "git" 过滤出所有 git 相关命令。同时支持按快捷键搜索（按下 Ctrl+G 过滤出绑定了 Ctrl+G 的命令）。

### Collapsible Float Window

**Desktop convention (MEDIUM confidence, similar to chat widgets/music players):**

1. **折叠按钮**：header 右上角的折叠/展开图标（chevron-down / chevron-up），位置醒目。

2. **折叠动画**：从底部向上收缩，内容区域 fade-out，窗口高度平滑减小。CSS transition 即可实现视觉效果。

3. **折叠态外观**：仅 header bar（28px 高），显示项目图标 + 项目名称 + 展开按钮。外观与展开态的 header 一致，没有视觉割裂。

4. **展开操作**：点击折叠态的任意位置展开。整个折叠态都是可点击区域。

### Auto-start on Boot

**Desktop convention (HIGH confidence, universal pattern):**

1. **设置位置**：系统托盘设置区域下方（逻辑上相关，都是"系统级行为"设置）。

2. **开关描述**：显示"开机自动启动"和副标题"启动后自动隐藏到系统托盘"。

3. **首次启用行为**：调用 `enable()` 后 Windows 可能弹出 UAC 提示（取决于注册方式）。Tauri autostart 插件使用 CurrentUser 注册表路径，通常不需要 UAC。

### Multi-config Profiles

**Desktop convention (MEDIUM confidence, based on browser profiles / VS Code workspaces):**

1. **Profile 切换**：下拉选择器，切换后立即生效（不需要重启）。类似 Chrome 的多用户切换。

2. **Profile 管理**：新建（输入名称）、重命名、删除（需确认）。简单 CRUD，不需要复杂的 UI。

3. **导入/导出**：导出按钮 -> 选择保存位置 -> 生成 JSON。导入按钮 -> 选择文件 -> 预览内容 -> 确认导入。

4. **迁移透明性**：旧用户升级后自动进入 "Default" profile，数据完全保留，无感知。

---

## MVP Recommendation

**Phase 1 (P0 -- Core Upgrade):**
- F1: Multi-line scripts -- 最核心的能力提升，从"单行执行器"升级为"脚本运行器"

**Phase 2 (P1 -- Quick Wins + Polish):**
- F5: Auto-start on boot -- 最简单，官方插件，1-2 天
- F2: Version + update check -- 简单的 HTTP 请求，1-2 天
- F3: Shortcut panel -- UI 重构，但逻辑已存在，3-4 天

**Phase 3 (P2 -- Experience Enhancement):**
- F4: Collapsible float window -- 现有功能的增强，2-3 天

**Phase 4 (P3 -- Data Architecture):**
- F6: Multi-config profiles -- 数据层重构，范围最大，放最后。4-6 天

**Defer for future:**
- PowerShell 脚本支持（cmd.exe 优先）
- 脚本模板市场（用户共享模板）
- 跨设备同步（需要后端）
- 多行脚本实时输出流（需要内嵌终端）

---

## Sources

- [Tauri v2 Autostart Plugin](https://v2.tauri.app/plugin/autostart/) -- official plugin docs, permissions, setup -- HIGH confidence
- [tauri-plugin-autostart GitHub](https://github.com/tauri-apps/tauri-plugin-autostart) -- source code, platform support -- HIGH confidence
- [Tauri v2 Updater Plugin](https://v2.tauri.app/plugin/updater/) -- signature requirement: "This cannot be disabled" -- HIGH confidence
- [Tauri v2 Store Plugin](https://v2.tauri.app/plugin/store/) -- JS API reference for store operations -- HIGH confidence
- [Tauri v2 Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) -- setSize, setPosition, WebviewWindow -- HIGH confidence
- [GitHub REST API: Releases](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28) -- `GET /repos/{owner}/{repo}/releases/latest` -- HIGH confidence
- [VS Code Keybindings](https://code.visualstudio.com/docs/configure/keybindings) -- UX pattern reference for shortcut panel -- HIGH confidence
- [Windows cmd.exe batch scripting](https://stackoverflow.com/questions/20952175/run-multiple-commands-sequentially) -- `&&` vs `&` operators for sequential execution -- HIGH confidence
- [Tauri WebviewWindow setSize](https://v2.tauri.app/reference/javascript/api/namespacewebview/) -- programmatic resize API -- HIGH confidence
- [Cal.com AI Desktop Tauri Notes](https://github.com/calcom/ai-desktop/blob/main/AGENTS.md) -- real-world note: `resizable: false` on macOS blocks programmatic resize -- MEDIUM confidence

---
*Feature research for: EasyPack v2.0 milestone*
*Researched: 2026-05-13*
