# Architecture Patterns

**Domain:** Tauri 2.x Windows Desktop Project Launcher
**Researched:** 2026-04-10

## Recommended Architecture

EasyPack 采用经典的 Tauri 2.x 分层架构：Rust 后端负责系统级操作（Shell 命令执行、进程管理），Web 前端负责 UI 渲染和用户交互，通过 Tauri 的 `invoke` 命令系统进行桥接通信。

```
+----------------------------------------------------------+
|                    Tauri Application                       |
|                                                           |
|  +---------------------+     +-------------------------+  |
|  |   Web Frontend      |     |   Rust Backend           |  |
|  |   (Svelte/Solid)    |     |   (src-tauri/)           |  |
|  |                     |     |                         |  |
|  |  +---------------+  |     |  +-------------------+  |  |
|  |  | UI Components |  |     |  | Command Handlers  |  |  |
|  |  |  - Sidebar    |  |     |  |  - execute_shell  |  |  |
|  |  |  - CardGrid   |  | invoke  |  - validate_path  |  |  |
|  |  |  - Dialogs     |--------->|  - manage_data    |  |  |
|  |  +---------------+  |     |  +-------------------+  |  |
|  |        |            |     |          |              |  |
|  |  +---------------+  |     |  +-------------------+  |  |
|  |  | State Layer   |  |     |  | Shell Plugin      |  |  |
|  |  |  - projects   |  |     |  |  - cmd.exe spawn  |  |  |
|  |  |  - commands   |  |     |  |  - wt.exe spawn   |  |  |
|  |  +---------------+  |     |  +-------------------+  |  |
|  |        |            |     |          |              |  |
|  |  +---------------+  |     |  +-------------------+  |  |
|  |  | Store Plugin  |<-------->|  | Store Plugin     |  |  |
|  |  |  (JSON persist)|  |     |  |  (Rust side)     |  |  |
|  |  +---------------+  |     |  +-------------------+  |  |
|  +---------------------+     +-------------------------+  |
+----------------------------------------------------------+
                    |
                    v
        +-----------------------+
        |  Windows System Shell |
        |  cmd.exe / wt.exe     |
        +-----------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **UI Layer** (Svelte/Solid) | 渲染侧边栏、卡片网格、对话框；处理用户点击和输入 | State Layer (读写), Rust Backend (通过 invoke) |
| **State Layer** (前端 Store) | 管理前端响应式状态：当前选中项目、指令列表、UI 状态 | UI Layer (提供响应式数据), Store Plugin (持久化) |
| **Command Handlers** (Rust) | 处理来自前端的 invoke 调用：路径验证、命令构建与执行 | 前端 (通过 invoke), Shell Plugin (进程创建) |
| **Shell Plugin** (tauri-plugin-shell) | 在外部终端中 spawn 进程执行 Shell 命令 | Command Handlers (被调用), Windows System Shell |
| **Store Plugin** (tauri-plugin-store) | 持久化项目列表和自定义指令到本地 JSON 文件 | State Layer (前端读写), Command Handlers (Rust 侧读取) |
| **Capabilities Config** | 定义安全权限：哪些 Shell 命令允许执行 | Shell Plugin (权限控制) |

### Data Flow

#### 主数据流：执行命令

```
User clicks card button
    |
    v
UI Component captures click event
    |
    v
invoke('execute_command', { projectPath, command })
    |
    v
Rust Command Handler:
  1. 验证 projectPath 存在且为有效目录
  2. 构建完整 Shell 命令字符串（cd + target command）
  3. 使用 std::process::Command::new("cmd")
     .args(["/k", "cd /d {path} && {command}"])
     .spawn()
    |
    v
Windows cmd.exe / Windows Terminal 打开
用户在终端中看到命令执行结果
```

#### 持久化数据流

```
App Start
    |
    v
Store Plugin loads projects.json / commands.json
    |
    v
前端 State Layer 初始化响应式状态
    |
    v
UI Components 从 State Layer 读取数据渲染

User adds project / command:
    |
    v
UI 调用 Store Plugin 的 set() + save()
    |
    v
Store Plugin 写入 JSON 文件到 AppData 目录
    |
    v
前端 State Layer 同步更新
    |
    v
UI 自动重新渲染
```

### 核心数据模型

```typescript
// 项目
interface Project {
  id: string;          // UUID
  name: string;        // 显示名称
  path: string;        // 本地目录绝对路径
  commands?: Command[]; // 项目专属指令（可选）
}

// 指令
interface Command {
  id: string;          // UUID
  name: string;        // 显示名称（如 "打包项目"）
  shellCommand: string; // Shell 命令（如 "npm run build"）
  icon?: string;       // 图标标识（可选）
  isGlobal: boolean;   // 是否为全局默认指令
}

// 持久化结构
interface AppStore {
  projects: Project[];
  globalCommands: Command[];  // 全局默认指令
  selectedProjectId: string | null;
}
```

## Patterns to Follow

### Pattern 1: Tauri Command 系统封装

**What:** 所有前端到 Rust 的通信通过 `#[tauri::command]` 注解函数 + `invoke()` 调用完成，不使用直接文件系统访问或绕过 Tauri 安全模型的方式。

**When:** 每次前端需要执行系统级操作（Shell 命令、路径验证、文件操作）时。

**Example:**
```rust
// src-tauri/src/commands/shell.rs
#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String> {
    let full_command = format!("cd /d \"{}\" && {}", project_path, shell_command);

    std::process::Command::new("cmd")
        .args(["/k", &full_command])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

```typescript
// 前端调用
import { invoke } from '@tauri-apps/api/core';

async function runCommand(projectPath: string, command: string) {
    await invoke('execute_command', { projectPath, shellCommand: command });
}
```

### Pattern 2: 前端响应式状态 + Store Plugin 持久化

**What:** 前端使用框架内置的响应式 Store 管理运行时状态，通过 `@tauri-apps/plugin-store` 将数据持久化到 JSON 文件。两层分离：响应式层负责 UI 更新，持久化层负责数据保存。

**When:** 所有需要跨会话持久保存的数据（项目列表、自定义指令）。

**Example:**
```typescript
// 使用 Store Plugin 进行持久化
import { LazyStore } from '@tauri-apps/plugin-store';

const store = new LazyStore('easypack-data.json');

// 读取
const projects = await store.get<Project[]>('projects') ?? [];

// 写入
await store.set('projects', updatedProjects);
// autoSave 默认启用，100ms debounce 后自动写入磁盘
```

### Pattern 3: Windows 外部终端启动

**What:** 使用 `std::process::Command` 启动 `cmd.exe /k` 在新终端窗口中执行命令。`/k` 参数保持终端窗口打开，`cd /d` 参数支持跨驱动器切换目录。

**When:** 用户点击指令卡片执行命令时。

**Example:**
```rust
// 方案 A: 使用 cmd.exe（最广泛兼容）
Command::new("cmd")
    .args(["/k", &format!("cd /d \"{}\" && {}", path, cmd)])
    .spawn()?;

// 方案 B: 优先使用 Windows Terminal（如果已安装）
// wt.exe 默认从用户 profile 启动目录开始
Command::new("wt")
    .args(["cmd", "/k", &format!("cd /d \"{}\" && {}", path, cmd)])
    .spawn()?;
```

### Pattern 4: 安全 Capability 配置

**What:** 在 `src-tauri/capabilities/default.json` 中显式声明允许的 Shell 命令范围，遵循最小权限原则。由于用户可以自定义指令（动态命令），需要使用通配验证器。

**When:** 配置 Shell 插件权限时。

**Example:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default",
    {
      "identifier": "shell:allow-spawn",
      "allow": [
        {
          "name": "cmd",
          "cmd": "cmd",
          "args": true
        }
      ]
    }
  ]
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: 在前端直接执行 Shell 命令

**What:** 通过 `@tauri-apps/plugin-shell` 的 JavaScript API 直接在前端调用 `Command.create()` 执行命令。

**Why bad:** 绕过了 Rust 后端的验证层，无法对路径和命令进行安全检查。前端代码暴露在 WebView 中，更容易被注入攻击。混合了关注点，导致前端逻辑变复杂。

**Instead:** 所有 Shell 执行请求通过 `invoke()` 发送到 Rust 后端，在 Rust 侧进行路径验证和命令构建后再执行。

### Anti-Pattern 2: 使用 Store Plugin 存储大量二进制数据

**What:** 在 Store 的 JSON 文件中存储大块数据（如 Base64 编码的图标、长日志）。

**Why bad:** Store Plugin 底层是 JSON 文件，每次修改会重写整个文件。大量数据会导致读写性能下降。

**Instead:** 只存储结构化元数据（项目信息、指令配置）。图标使用系统图标或轻量级 SVG 标识符。日志不需要持久化。

### Anti-Pattern 3: 使用内嵌终端模拟器

**What:** 在 WebView 中用 xterm.js 等库实现终端模拟器，捕获 stdout/stderr 显示在 UI 中。

**Why bad:** 大幅增加实现复杂度（需要处理 PTY、ANSI 转义码、输入输出流、窗口大小调整）。用户体验不如专用终端工具（Windows Terminal 支持 tab、分屏、主题等）。违反项目范围定义。

**Instead:** 在外部系统终端（cmd.exe / Windows Terminal）中执行命令，让用户使用已有的终端工具。

### Anti-Pattern 4: Rust 后端管理前端 UI 状态

**What:** 把所有状态（包括 UI 选中状态、展开/折叠状态）都通过 Tauri 的 `State<Mutex<T>>` 在 Rust 侧管理。

**Why bad:** 每次状态更新都需要跨 IPC 通信，增加延迟。前端框架（Svelte/Solid）已经有优秀的响应式系统来管理 UI 状态。

**Instead:** Rust 只管理系统级状态（如果需要），前端 UI 状态完全在前端框架内管理。持久化数据通过 Store Plugin 直接从前端读写。

## Build Order (Component Dependencies)

组件构建顺序基于依赖关系：

```
1. 项目脚手架 & 基础配置
   |-- Tauri 2.x 项目初始化
   |-- 前端框架选择 & 配置（Svelte/Solid）
   |-- 插件安装（shell, store）
   |-- Capability 权限配置
   |
   v
2. 持久化层（Store Plugin 集成）
   |-- 定义数据模型（Project, Command）
   |-- 实现 CRUD 操作（load/save/get/set）
   |-- 验证数据读写可靠性
   |
   v
3. Rust 后端命令系统
   |-- execute_command（核心：在外部终端执行命令）
   |-- validate_path（验证项目路径有效性）
   |-- 单元测试
   |
   v
4. 前端状态管理层
   |-- 响应式 Store（projects, commands, selectedProject）
   |-- 与 Store Plugin 的同步逻辑
   |
   v
5. UI 组件层
   |-- Sidebar 组件（项目列表、添加/删除）
   |-- CardGrid 组件（指令卡片网格）
   |-- CommandCard 组件（单个指令按钮）
   |-- Dialog 组件（添加项目、添加自定义指令）
   |
   v
6. 集成 & 完善
   |-- 全局默认指令预设
   |-- 项目专属指令覆盖
   |-- 错误处理 & 用户反馈
   |-- UI 打磨（动画、响应式布局）
```

**构建顺序说明：**
- **层 1 是所有后续层的基础**：没有项目脚手架和权限配置，后续开发无法进行
- **层 2 不依赖层 3**：Store Plugin 可以从前端直接使用，不需要 Rust 后端参与
- **层 3 不依赖层 2**：命令执行系统独立于数据持久化
- **层 4 依赖层 2**：状态管理需要能读写持久化数据
- **层 5 依赖层 3 和层 4**：UI 需要调用命令和读取状态
- **层 6 依赖所有前置层**：集成完善需要全部组件就位

## Scalability Considerations

| Concern | At 10 projects | At 100 projects | At 1000+ projects |
|---------|---------------|-----------------|-------------------|
| Store 文件读写 | JSON 全量读写，无感知 | JSON 全量读写，仍可接受（数据量仍小） | 考虑分片存储或 SQLite（但个人工具不太可能到这个量级） |
| UI 渲染 | 侧边栏直接渲染全部项目 | 考虑虚拟滚动或搜索过滤 | 必须虚拟滚动 + 搜索 + 分组 |
| Shell 命令启动 | 每次一个终端窗口 | 无影响 | 无影响（每次点击独立终端进程） |
| 内存占用 | WebView 基础 ~30-40MB | 增长极小（纯文本数据） | 增长仍小（除非图标等资源） |

对于 EasyPack 这类个人开发者工具，实际使用规模通常在 5-50 个项目之间，上述架构完全可以应对，无需过早优化。

## Sources

- [Tauri v2 Architecture](https://v2.tauri.app/concept/architecture/) -- 官方架构概述 (HIGH confidence)
- [Tauri v2 Project Structure](https://v2.tauri.app/start/project-structure/) -- 项目结构文档 (HIGH confidence)
- [Calling Rust from the Frontend](https://v2.tauri.app/develop/calling-rust/) -- Command 系统文档 (HIGH confidence)
- [Shell Plugin](https://v2.tauri.app/plugin/shell/) -- Shell 插件 API 与权限配置 (HIGH confidence)
- [Store Plugin](https://v2.tauri.app/plugin/store/) -- 持久化存储 API (HIGH confidence)
- [State Management](https://v2.tauri.app/develop/state-management/) -- Tauri 状态管理文档 (HIGH confidence)
- [StackOverflow: Open terminal with default command](https://stackoverflow.com/questions/74872011/can-tauri-open-the-terminal-with-a-default-command) -- cmd.exe /k 模式验证 (MEDIUM confidence, 社区验证)
- [CrabNebula: Best UI Libraries for Tauri](https://crabnebula.dev/blog/the-best-ui-libraries-for-cross-platform-apps-with-tauri/) -- 前端框架选择参考 (MEDIUM confidence)
- [GitHub Issue #11513: spawn() hangs in production](https://github.com/tauri-apps/tauri/issues/11513) -- 已知生产环境问题 (HIGH confidence, 官方 issue)
