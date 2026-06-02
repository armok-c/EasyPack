# Architecture Patterns: EasyPack v2.0 Feature Integration

**Domain:** Tauri 2 + React 桌面应用 -- 6 个新功能集成到现有架构
**Researched:** 2026-05-13
**Overall confidence:** HIGH

## Executive Summary

EasyPack v1.x 已经建立了一套成熟的架构模式：Rust 后端处理系统级操作（Shell 执行、文件扫描、鼠标轮询），React 前端通过 Tauri `invoke` + 事件系统与后端通信，`tauri-plugin-store` 管理所有持久化。v2.0 的 6 个新功能全部可以融入这套架构，不需要引入新的架构范式。关键挑战不在架构模式，而在数据模型演进和向后兼容。

**核心原则：** 每个新功能应复用现有模式（invoke 调用、store 持久化、事件通信、hooks 状态管理），只在确实需要时才引入新的依赖或组件。

## Recommended Architecture

### System Diagram (v2.0 新增部分标注 *)

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (main window)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ App.tsx  │ │ Sidebar  │ │  MainArea    │ │ TitleBar   │ │
│  │          │ │          │ │ + ShortcutPanel*│ │ + Version*│ │
│  └────┬─────┘ └──────────┘ └──────────────┘ └────────────┘ │
│       │ useProject()                                       │
│       │ useGlobalShortcuts()                               │
│       │ useFloatWindow() ──→ FloatApp.tsx (float window)   │
│       │ useProfiles()*    ──→ Config profile switching      │
│       │ useAutoStart()*   ──→ Autostart toggle              │
│       │ useVersion()*     ──→ GitHub version check          │
│  ┌────┴──────────────────────────────────────────────────┐  │
│  │  tauri-plugin-store (easypack-store.json)             │  │
│  │  + profile-aware keys*                                │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ invoke() / emit()
┌──────────────────────┴──────────────────────────────────────┐
│  Rust Backend (src-tauri/src/)                               │
│  ┌────────────┐ ┌──────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ shell.rs   │ │project_  │ │ version.rs* │ │autostart* │ │
│  │ + multi-   │ │info.rs   │ │ HTTP check  │ │plugin     │ │
│  │ line exec* │ │          │ │             │ │           │ │
│  └────────────┘ └──────────┘ └─────────────┘ └───────────┘ │
│  Plugins: store, dialog, global-shortcut, single-instance,  │
│           autostart*, http* (or reqwest)                     │
└─────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | New/Modified | Communicates With |
|-----------|---------------|-------------|-------------------|
| `shell.rs` | Shell 命令执行 | **Modified**: 新增多行脚本解析和执行 | 前端 `invoke("execute_command")` |
| `version.rs` (NEW) | GitHub Releases 版本检查 | **New**: HTTP 请求 GitHub API | 前端 `invoke("check_update")` |
| `tauri-plugin-autostart` | Windows 注册表开机启动 | **New**: 插件集成 | 前端 `enable/disable/isEnabled` |
| `useProject.ts` | 核心 state 管理 | **Modified**: profile-aware store keys | store, 前端组件 |
| `useProfiles.ts` (NEW) | 多配置文件管理 | **New**: profile CRUD + 切换 | store, useProject |
| `useVersion.ts` (NEW) | 版本检查状态 | **New**: 检查频率控制 | `invoke("check_update")` |
| `useAutoStart.ts` (NEW) | 开机启动控制 | **New**: autostart 开关 | `@tauri-apps/plugin-autostart` |
| `ShortcutPanel.tsx` (NEW) | VS Code 风格快捷键面板 | **New**: 独立设置页面/弹窗 | `useGlobalShortcuts`, `assignShortcut` |
| `FloatApp.tsx` | 悬浮窗 UI | **Modified**: 可折叠 + 项目切换 | 主窗口事件 |
| `useFloatWindow.ts` | 悬浮窗生命周期 | **Modified**: 折叠态管理 | WebviewWindow, 事件 |
| `SettingsDialog.tsx` | 设置面板 | **Modified**: 新增 autostart/profile 设置项 | useAutoStart, useProfiles |
| `CommandDialog.tsx` | 指令编辑弹窗 | **Modified**: 支持多行脚本编辑 | MainArea |

## Feature-by-Feature Architecture

### 1. 多行脚本指令

**Integration approach:** 在现有 `execute_command` 基础上扩展，保持向后兼容。

#### Data Model Changes

```typescript
// 现有 CommandItem.command 是单行字符串
// 新方案：扩展 CommandItem 而非替换

export interface CommandItem {
  id: string;
  name: string;
  command: string;        // 保持不变（向后兼容）
  scriptLines?: string[]; // NEW: 多行脚本（undefined = 单行模式）
  icon: string;
  type: "preset" | "custom";
  scope: "global" | "project";
  addedAt: number;
  shortcut?: string;
  // 多行脚本配置
  stopOnError?: boolean;  // NEW: 遇到错误是否停止（默认 true）
}
```

**设计决策：** 用 `scriptLines?: string[]` 而非改变 `command` 类型。理由：
1. 向后兼容 -- 现有 store 数据无需迁移
2. 预设指令仍然用单行 `command`，不需要多行
3. `undefined` = 单行模式，`string[]` = 多行模式，二进制状态简单可靠

#### Rust Backend Changes

现有 `execute_command` 调用 `cmd /K "command"` -- 单行命令在新终端窗口执行。多行脚本需要修改：

```rust
// shell.rs 新增
#[tauri::command]
pub async fn execute_script(
    project_path: String,
    script_lines: Vec<String>,
    stop_on_error: bool,
) -> Result<(), String> {
    // 将多行脚本写入临时 .bat 文件
    // 用 cmd /K 执行该 .bat 文件
    // stop_on_error 控制是否在行间插入 `|| exit /b` 错误处理
}
```

**为什么不支持条件/流程控制（if/else、变量）：**
- 原始需求提到"条件/流程控制"，但这会让 EasyPack 变成脚本编辑器
- cmd.exe 脚本本身支持 if/else/goto/变量，用户可以在多行脚本中自由使用
- EasyPack 不需要解析或验证脚本语法 -- 只需要按行写入 .bat 文件并执行
- 这是一个正确的边界：EasyPack 是"命令启动器"，不是"脚本运行时"

#### Execution Flow

```
用户点击多行指令卡片
  → 前端检查 scriptLines 是否存在
  → 如果是: invoke("execute_script", { projectPath, scriptLines, stopOnError })
  → 如果否: invoke("execute_command", { projectPath, shellCommand })  // 现有路径
  → Rust 写入临时 .bat 到系统 TEMP 目录
  → cmd.exe /K 执行 .bat
  → 终端窗口显示执行结果
```

#### 前端组件修改

- `CommandDialog.tsx`: 新增"多行模式"切换，单行用 `<Input>`，多行用 `<textarea>`
- `CommandCard.tsx`: 多行指令卡片显示行数标记（如"3行脚本"）
- `MainArea.tsx`: `onExecute` 逻辑分支

**Complexity:** Medium。数据模型向后兼容，Rust 端新增一个命令，前端 UI 修改有限。

---

### 2. 应用版本管理

**Integration approach:** Rust 后端用 `reqwest`（或 `tauri-plugin-http`）调用 GitHub Releases API，前端展示版本信息。

#### Rust Backend

```rust
// commands/version.rs (NEW)
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct VersionInfo {
    pub current: String,         // 当前版本 (from tauri.conf.json or Cargo.toml)
    pub latest: Option<String>,  // 最新版本 (from GitHub)
    pub download_url: Option<String>,
    pub release_notes: Option<String>,
    pub checked_at: String,      // ISO 8601 timestamp
}

#[tauri::command]
pub async fn check_update() -> Result<VersionInfo, String> {
    // 1. 读取当前版本 (get from env!("CARGO_PKG_VERSION") or include tauri.conf.json)
    // 2. GET https://api.github.com/repos/{owner}/{repo}/releases/latest
    //    Headers: User-Agent: EasyPack, Accept: application/vnd.github.v3+json
    // 3. 解析 tag_name, html_url, body
    // 4. 返回 VersionInfo
}
```

**选择 reqwest 还是 tauri-plugin-http：**
- **推荐 reqwest**（直接添加到 Cargo.toml）
- 理由：版本检查逻辑纯粹在后端，不需要前端 JS 参与 HTTP 请求
- tauri-plugin-http 更适合前端发起的 HTTP 请求场景
- reqwest 是 Rust 生态标准 HTTP 客户端，成熟稳定
- 无需新增 Tauri plugin 的权限配置

**GitHub API 限流处理：**
- 未认证请求: 60 次/小时 -- 对于版本检查绰绰有余
- 每次检查结果缓存到 store，24 小时内不重复请求
- 请求失败时返回缓存的结果

#### Frontend Hook

```typescript
// hooks/useVersion.ts (NEW)
export function useVersion() {
  // 从 store 读取缓存的版本信息
  // check_update() 调用频率：启动时检查一次（24h 缓存）
  // 手动检查按钮
  // 返回 { currentVersion, latestVersion, updateAvailable, checkNow, checking }
}
```

#### Frontend Display

- TitleBar 右侧版本号显示
- 有新版本时显示绿色圆点/更新提示
- 点击弹出 changelog 弹窗（用现有 Dialog 组件）
- SettingsDialog 新增"检查更新"按钮

**Complexity:** Low。一个新 Rust 命令，一个新 hook，少量 UI。

---

### 3. 完整快捷键面板（VS Code 风格）

**Integration approach:** 新增独立弹窗/页面组件，复用现有 `assignShortcut` / `clearShortcut` 逻辑。

#### Component Design

```
ShortcutPanel.tsx (NEW)
├── 搜索框（Input）
├── 快捷键列表（ScrollArea）
│   ├── 分类标题行
│   └── 快捷键行
│       ├── 指令名称
│       ├── 当前快捷键（可点击录制新快捷键）
│       ├── 清除按钮
│       └── 冲突警告
└── "重置所有快捷键"按钮
```

#### Data Flow

```
ShortcutPanel
  → 读取 commands (from useProject)
  → 搜索过滤（本地 filter，无需后端）
  → assignShortcut(commandId, shortcut) → 更新 store → 重新注册全局快捷键
  → clearShortcut(commandId) → 清除 store → 取消注册
```

#### 与现有架构的关系

- 不需要新的 Rust 命令
- 不需要新的数据结构
- 复用 `useGlobalShortcuts` 的注册/取消注册逻辑
- 复用 `useProject` 中的 `assignShortcut` / `clearShortcut`
- 本质上是对现有快捷键管理功能的 UI 增强

#### Trigger Point

- TitleBar 设置按钮旁新增"快捷键"图标按钮
- 或 SettingsDialog 内新增"快捷键"标签页
- 推荐后者（与现有设置入口一致）

**Complexity:** Low-Medium。纯前端组件，不涉及后端修改。

---

### 4. 悬浮窗改进（可折叠 + 项目切换）

**Integration approach:** 修改现有 FloatApp.tsx 和 useFloatWindow.ts，新增折叠态 UI 和项目切换事件。

#### 现有架构

当前 FloatApp 运行在独立 `float` WebviewWindow 中，通过 Tauri 事件系统与主窗口通信：
- 主窗口 → 悬浮窗: `emitTo("float", "float:state-update", { project, commands })`
- 悬浮窗 → 主窗口: `emit("float:execute", { command })`
- 悬浮窗 → 主窗口: `emit("float:close-requested")`

#### 新增交互

```
折叠态:
┌──────────────┐
│ 🟢 EasyPack │  ← 项目图标 + 名称
└──────────────┘  ← 点击名称触发项目切换列表

展开态（现有）:
┌──────────────┐
│ EasyPack   ✕ │
│ ──────────── │
│ ▸ git pull   │
│ ▸ claude     │
│ ...          │
└──────────────┘
```

#### 新增事件

```typescript
// 悬浮窗 → 主窗口
emit("float:toggle-collapse")     // 通知主窗口折叠/展开状态变化
emit("float:switch-project", { projectId })  // 请求切换项目

// 主窗口 → 悬浮窗（新增 payload 字段）
emitTo("float", "float:state-update", {
  project,
  commands,
  projectsList: projects,  // NEW: 所有项目列表（用于折叠态切换）
})
```

#### 窗口尺寸变化

- 展开态: 220x300（现有）
- 折叠态: 160x32（仅显示项目名+图标）
- 切换时动态 resize WebviewWindow

#### 修改范围

| 文件 | 修改内容 |
|------|---------|
| `FloatApp.tsx` | 新增折叠态 UI、项目切换下拉、折叠/展开切换 |
| `useFloatWindow.ts` | 新增 collapse/expand 状态管理、窗口 resize |
| `useProject.ts` | 无修改（项目切换走现有 `selectProject`） |
| `App.tsx` | 新增 `float:switch-project` 事件监听 |

**Complexity:** Medium。修改现有组件，不引入新依赖。关键在于折叠态的 UI 设计和窗口尺寸动态调整。

---

### 5. 开机启动

**Integration approach:** 使用官方 `tauri-plugin-autostart` 插件。

#### 为什么用官方插件而非手写注册表操作

- 官方插件底层用 `auto-launch` crate，写入 `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
- 处理了路径引号、命令行参数等边界情况
- 跨平台支持（虽然本项目仅 Windows）
- 维护成本为零

#### Rust Backend Changes

```toml
# Cargo.toml 新增
tauri-plugin-autostart = "2"
```

```rust
// lib.rs setup 中新增
.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    None, // Windows 不需要额外参数
))
```

#### Frontend

```typescript
// hooks/useAutoStart.ts (NEW)
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export function useAutoStart() {
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  useEffect(() => {
    isEnabled().then(setAutoStartEnabled);
  }, []);

  const toggleAutoStart = async (enabled: boolean) => {
    if (enabled) {
      await enable();
    } else {
      await disable();
    }
    setAutoStartEnabled(enabled);
  };

  return { autoStartEnabled, toggleAutoStart };
}
```

#### SettingsDialog 新增

在现有"系统托盘"section 下新增开关：
```
设置
├── 系统托盘
│   ├── [开关] 启用系统托盘
│   └── [开关] 关闭时隐藏到托盘
├── 边缘抽屉
│   └── [开关] 启用边缘抽屉
└── 开机启动 (NEW)
    └── [开关] 开机自动启动
```

#### Capabilities 新增

```json
// capabilities/default.json 新增
"autostart:allow-enable",
"autostart:allow-disable",
"autostart:allow-is-enabled"
```

#### 启动时最小化行为

如果用户启用了"开机启动"+"关闭时隐藏到托盘"，启动时应该直接隐藏到托盘：
- 在 `lib.rs` setup 中检查是否由 autostart 触发
- 如果是，初始窗口设为 `visible: false`
- 通过命令行参数或环境变量标识 autostart 启动

**Complexity:** Low。官方插件一站式解决，前端一个 hook + 一个开关。

---

### 6. 多配置文件管理

**Integration approach:** 在现有 store 层面引入 profile 命名空间，需要数据迁移策略。

#### Data Model

```typescript
// 新增 profile 类型
export interface ConfigProfile {
  id: string;           // crypto.randomUUID()
  name: string;         // 用户自定义名称
  createdAt: number;    // Date.now()
  isDefault: boolean;   // 只有一个 default
}

// Store 结构变更
// 现有: 扁平 key-value
//   projects: [...]
//   customCommands: [...]
//   projectCommands:xxx: [...]

// 新方案: profile-prefixed keys
//   activeProfile: "default"
//   profiles: [{ id: "default", name: "默认配置", ... }]
//   profile:default:projects: [...]
//   profile:default:customCommands: [...]
//   profile:default:projectCommands:xxx: [...]
//   profile:xxx:projects: [...]
//   profile:xxx:customCommands: [...]
```

#### Migration Strategy

```
启动时检测 store 中是否存在 "profiles" key:
  如果不存在 → 执行一次性迁移:
    1. 创建 default profile: { id: "default", name: "默认配置", isDefault: true }
    2. 将所有现有 key (projects, customCommands, projectCommands:*) 重命名为 profile:default:*
    3. 写入 "profiles" = [default]
    4. 写入 "activeProfile" = "default"
  如果存在 → 正常加载 activeProfile 的数据
```

#### Profile Switching Flow

```
用户切换 profile
  → 保存当前 profile 的所有状态到 store (profile:{id}:*)
  → 清空内存中的 projects, commands, projectCommandsMap 等
  → 从 store 加载新 profile 的数据
  → 更新 UI
  → 无需重启应用
```

#### Import/Export

```typescript
// 导出: 将 profile 的所有 key-value 序列化为 JSON 文件
// 导入: 读取 JSON 文件，验证 schema，写入 store
async function exportProfile(profileId: string): Promise<string> {
  // 收集 profile:{profileId}:* 下的所有 key-value
  // 合并为一个 JSON 对象
  // 用 tauri-plugin-dialog 的 save() 让用户选择保存位置
}

async function importProfile(filePath: string): Promise<void> {
  // 读取文件内容
  // 验证 JSON schema
  // 生成新 profile ID（避免冲突）
  // 写入 store
}
```

#### UI Changes

- Sidebar 顶部新增 profile 下拉选择器（或 TitleBar）
- SettingsDialog 新增"配置管理" section:
  - 当前配置名称编辑
  - 新建配置
  - 删除配置（default 不可删）
  - 导入/导出按钮

#### 修改范围

| 文件 | 修改内容 |
|------|---------|
| `useProject.ts` | **重大修改**: store key 加 profile 前缀，初始化时 migration |
| `useProfiles.ts` (NEW) | profile CRUD, 切换, 导入/导出 |
| `Sidebar.tsx` | 顶部 profile 选择器 |
| `SettingsDialog.tsx` | 配置管理 section |
| `App.tsx` | 集成 useProfiles，传递 profile 上下文 |
| `FloatApp.tsx` | 显示当前 profile 名称 |

**Complexity:** High。这是 v2.0 中最复杂的特性。涉及数据迁移、store 结构重组、所有数据操作的 profile 感知。

**重要简化建议：** 如果 v2.0 时间紧张，可以先实现"导入/导出"（纯文件操作），延迟"多 profile 同时存在 + 热切换"到后续版本。导入/导出用 `tauri-plugin-dialog` + `tauri-plugin-fs` 即可实现，不需要改动 store 结构。

## Patterns to Follow

### Pattern 1: Sync Core + Async Tauri Wrapper (已有)

**What:** 核心逻辑写为同步函数，Tauri command 是 async 薄包装。
**When:** 所有新 Rust 命令。
**Example:**
```rust
// 同步核心（可脱离 tokio 测试）
fn write_script_to_temp(lines: &[String]) -> Result<PathBuf, String> { ... }

// Tauri 命令包装
#[tauri::command]
pub async fn execute_script(project_path: String, script_lines: Vec<String>) -> Result<(), String> {
    write_script_to_temp(&script_lines)?;
    // ...
}
```

### Pattern 2: Ref-Based Event Handlers (已有)

**What:** 用 `useRef` 存储最新回调，避免 useEffect 闭包过时。
**When:** 所有涉及事件监听的新 hooks。
**Example:** 遵循 `useFloatWindow.ts` 和 `useTray.ts` 已验证的模式。

### Pattern 3: Store Key Namespacing (已有 + 扩展)

**What:** 用冒号分隔的 key 前缀组织数据。
**When:** Profile 系统。
**Example:**
```
现有: projectCommands:{projectId}
新增: profile:{profileId}:projects
      profile:{profileId}:customCommands
```

### Pattern 4: Operation Lock Mutex (已有)

**What:** 用 Promise chain 序列化异步操作，防止竞态。
**When:** 悬浮窗折叠/展开（尺寸变化 + 状态更新）。
**Example:** `useFloatWindow.ts` 的 `operationLock` 模式。

## Anti-Patterns to Avoid

### Anti-Pattern 1: 前端解析脚本语法

**What:** 在前端 JavaScript 中解析 if/else/变量等脚本控制流。
**Why bad:** EasyPack 是命令启动器，不是脚本运行时。cmd.exe 脚本本身支持这些语法。
**Instead:** 多行脚本直接写入 .bat 文件，让 cmd.exe 解释执行。

### Anti-Pattern 2: Profile 系统全量克隆 store

**What:** 切换 profile 时销毁并重建整个 store 实例。
**Why bad:** store 初始化是异步的，会导致闪烁和状态丢失。
**Instead:** 保持单个 store 实例，用 key 前缀区分 profile 数据。

### Anti-Pattern 3: 悬浮窗内管理项目状态

**What:** 在 FloatApp 中复制 useProject 的逻辑。
**Why bad:** 悬浮窗是瘦客户端，主窗口是数据权威源。
**Instead:** 保持现有架构 -- 主窗口推送状态，悬浮窗只渲染和发送事件。

### Anti-Pattern 4: 版本检查阻塞启动

**What:** 在 App.tsx useEffect 初始化时同步等待版本检查完成。
**Why bad:** 网络请求失败会导致应用启动延迟。
**Instead:** 异步后台检查，使用缓存的版本信息立即渲染，有更新时通过状态变更触发 UI 更新。

## Suggested Build Order

基于依赖关系和风险排序：

### Phase 15: 开机启动（最简单，独立性强）

- 新增 `tauri-plugin-autostart`
- 新增 `useAutoStart.ts`
- 修改 `SettingsDialog.tsx` 新增开关
- 修改 `lib.rs` 注册插件
- **依赖:** 无（独立于其他功能）
- **风险:** 低（官方插件，一次集成）

### Phase 16: 版本管理（简单，独立性强）

- 新增 `commands/version.rs`，Cargo.toml 添加 `reqwest` + `tokio`
- 新增 `useVersion.ts`
- 修改 `TitleBar.tsx` 显示版本号
- 修改 `SettingsDialog.tsx` 新增"检查更新"
- **依赖:** 无（独立于其他功能）
- **风险:** 低（GitHub API 稳定，有缓存降级）
- **注意:** `reqwest` 需要 `tokio` 运行时。Tauri 2 已经内部使用 tokio，只需在 Cargo.toml 中添加 `reqwest = { version = "0.12", features = ["json"] }`。不需要显式添加 tokio 依赖。

### Phase 17: 多行脚本指令（中等复杂度，核心功能增强）

- 修改 `CommandItem` 类型（新增 `scriptLines`, `stopOnError`）
- 新增 `commands/shell.rs` 的 `execute_script` 命令
- 修改 `CommandDialog.tsx` 支持多行编辑
- 修改 `MainArea.tsx` / `useProject.ts` 的执行逻辑分支
- **依赖:** 无（独立于其他功能）
- **风险:** 中（临时文件管理、向后兼容）
- **注意:** 这是 v2.0 的核心卖点，优先实现

### Phase 18: 快捷键面板（纯前端，中等复杂度）

- 新增 `ShortcutPanel.tsx`
- 修改 `SettingsDialog.tsx` 或 TitleBar 新增入口
- **依赖:** 依赖 Phase 17（如果多行指令也有快捷键需求）
- **风险:** 低（纯前端，复用现有逻辑）

### Phase 19: 悬浮窗改进（修改现有组件，中等复杂度）

- 修改 `FloatApp.tsx`（折叠态 + 项目切换）
- 修改 `useFloatWindow.ts`（折叠状态管理 + resize）
- 修改 `App.tsx`（新增 `float:switch-project` 事件监听）
- **依赖:** 无（独立于其他功能）
- **风险:** 中（修改已验证的组件，需回归测试）

### Phase 20: 多配置文件（最复杂，依赖 store 结构变更）

- 新增 `useProfiles.ts`
- 修改 `useProject.ts`（profile-prefixed keys + migration）
- 修改 `Sidebar.tsx`（profile 选择器）
- 修改 `SettingsDialog.tsx`（配置管理）
- **依赖:** 应该最后实现，因为改动 store 结构影响所有其他功能
- **风险:** 高（数据迁移、状态管理复杂度、回归范围大）
- **建议:** 可以先只实现"导入/导出"（不影响 store 结构），热切换延迟到 v2.1

### Build Order Rationale

```
Phase 15 (autostart)     ──→ 独立，最低风险，快速交付
Phase 16 (version)       ──→ 独立，低风险，快速交付
Phase 17 (multi-line)    ──→ 核心价值，中等风险
Phase 18 (shortcut panel)──→ 依赖 17（多行指令的快捷键），纯前端
Phase 19 (float improve) ──→ 独立，修改现有组件
Phase 20 (profiles)      ──→ 最复杂，store 结构变更，应最后实现
```

Phase 15-16 可以并行开发。Phase 17 是核心，应在 Phase 18 之前完成。Phase 20 应该在所有其他功能稳定后再做。

## Scalability Considerations

| Concern | Current (v1.x) | With v2.0 Features |
|---------|----------------|-------------------|
| Store size | < 100KB (JSON) | Profile 系统可能 2-3x，但仍在 KB 级别 |
| Commands per project | ~10-20 | 多行脚本可能增加单个指令数据量，但总数不变 |
| Startup time | ~1s | 版本检查异步，不影响。Autostart 场景需要 fast launch |
| Memory | ~30MB WebView | 新增功能几乎无额外内存（除了 reqwest 的一次性 HTTP 请求） |

## Sources

- [Tauri Autostart Plugin](https://v2.tauri.app/plugin/autostart/) -- 官方文档 -- HIGH confidence
- [tauri-plugin-autostart crates.io](https://crates.io/crates/tauri-plugin-autostart) -- 当前版本 2.5.1 -- HIGH confidence
- [auto-launch crate](https://docs.rs/crate/tauri-plugin-autostart/latest/source/Cargo.toml) -- Windows 注册表实现 -- HIGH confidence
- [Tauri HTTP Client Plugin](https://v2.tauri.app/plugin/http-client/) -- 官方文档 -- HIGH confidence
- [reqwest crate](https://crates.rs/crates/reqwest) -- Rust 标准HTTP 客户端 -- HIGH confidence
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases) -- 版本检查 -- HIGH confidence
- 现有代码库架构分析 -- 基于完整代码阅读 -- HIGH confidence
