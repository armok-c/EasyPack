# Phase 1: 应用脚手架与 Shell 命令核心 - Research

**Researched:** 2026-04-12
**Domain:** Tauri 2.x 桌面应用初始化 + Windows Shell 命令执行 + React 前端 UI
**Confidence:** HIGH

## Summary

Phase 1 的核心任务是从零搭建 EasyPack 桌面应用脚手架，实现 Tauri 2 + React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 4 + shadcn/ui 的完整技术栈集成，并完成 Shell 命令在系统终端中执行的核心功能。本阶段覆盖需求 PROJ-01（文件夹选择器添加项目）、CMD-04（在系统终端执行 Shell 命令）、UI-02（深色主题）、UI-04（侧边栏+主区域紧凑布局）、UI-06（窗口自适应）。

关键技术决策已锁定：Rust 后端使用 `std::process::Command` 而非 Tauri Shell Plugin 执行命令（避免 CVE-2025-31477）；优先使用 Windows Terminal (wt.exe) 打开命令，回退到 cmd.exe；使用 Tauri Dialog Plugin 提供原生文件夹选择器；深色主题采用 Raycast 风格（渐变背景+半透明元素）。

**Primary recommendation:** 使用 `create-tauri-app` 脚手架创建项目，通过 Rust 自定义命令实现 Shell 执行，shadcn/ui 的 new-york 样式配合 Sonner toast 提供现代 UI 组件，Tailwind CSS v4 的 CSS-first 配置定义深色主题变量。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 默认窗口尺寸 720x480（紧凑窗口）
- **D-02:** 最小窗口尺寸 600x400，防止布局挤压
- **D-03:** 每次启动使用默认位置和大小，不记忆上次窗口状态
- **D-04:** 侧边栏始终可见（包括 Phase 1），为 Phase 2 做布局铺垫
- **D-05:** 主区域布局为上方显示当前项目路径 + 下方按钮区域
- **D-06:** 侧边栏宽度由实现时决定（Claude discretion）
- **D-07:** 优先使用 Windows Terminal 打开命令，未安装时回退到 cmd.exe
- **D-08:** 每次执行打开独立的新终端窗口
- **D-09:** 命令执行后终端保持打开（使用 /K 参数），用户可查看输出或继续操作
- **D-10:** 应用内显示轻量 toast 提示（如"已执行: npm run build"），1-2 秒后消失
- **D-11:** 自动 cd 到选中的项目目录再执行命令
- **D-12:** Phase 1 预设全部 4 个内置命令按钮：打包项目（npm run build）、启动项目（npm run dev）、Git Pull、启动 Claude
- **D-13:** Windows 路径包含空格或中文的处理方式由实现时决定（Claude discretion）
- **D-14:** 选择文件夹后仅显示文件夹名称（如"EasyPack"），不显示完整路径
- **D-15:** "添加项目"按钮位于侧边栏顶部
- **D-16:** 选择文件夹后立即选中该项目，命令按钮立即可用
- **D-17:** 再次选择文件夹时替换当前项目（Phase 1 只维护一个当前项目）
- **D-18:** 不能取消选中，只能通过选择新项目来替换
- **D-19:** 首次启动主区域显示简约引导（提示文字 + 图示），引导用户选择项目
- **D-20:** 深色主题采用 Raycast 风格（渐变背景 + 半透明元素），定义全局 CSS 变量
- **D-21:** 未选择项目时侧边栏显示图标 + "还没有项目"文字 + "添加项目"按钮

### Claude's Discretion
- 侧边栏具体宽度（建议 200-260px 范围）
- Windows 路径空格/中文的 Shell 转义处理方案
- Toast 组件的具体实现（shadcn/ui Sonner 或自定义）
- 渐变背景的具体色值和方向

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-01 | 用户可通过文件夹选择器添加本地项目路径 | Tauri Dialog Plugin 提供 `open` API，设置 `directory: true` 可选择文件夹而非文件。返回路径字符串。 |
| CMD-04 | 点击指令卡片后在系统默认终端中打开并执行对应 Shell 命令 | Rust `std::process::Command` 配合 `wt.exe`（优先）或 `cmd.exe /C start cmd.exe /K`（回退）。在新终端窗口执行命令。 |
| UI-02 | 深色主题支持，作为默认主题 | Tauri `tauri.conf.json` 设置 `theme: "dark"`；shadcn/ui 内置 dark 模式；Tailwind CSS v4 `dark:` 变体；OKLCH 色彩变量。 |
| UI-04 | 侧边栏与主区域布局紧凑，无多余空白，信息密度高 | CSS Flexbox 布局，侧边栏固定宽度 + 主区域 flex-1；窗口 720x480 紧凑设计。 |
| UI-06 | 窗口可调整大小，布局自适应 | `tauri.conf.json` 设置 `resizable: true`、`minWidth: 600`、`minHeight: 400`；CSS 响应式处理。 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | 2.10.x (core crate) | 桌面应用框架 | 项目核心框架。Rust 后端 + WebView 前端，安装包极小。npm: @tauri-apps/api 2.10.1 |
| React | 19.2.5 | UI 框架 | 生态最成熟，shadcn/ui 原生支持。19.x 稳定版经过充分迭代。 |
| React DOM | 19.2.5 | React DOM 渲染 | React 19 配套。 |
| TypeScript | 5.7.3 | 类型系统 | 稳定验证充分，与所有推荐库完全兼容。不用 6.0（过渡版本）。 |
| Vite | 6.4.2 | 前端构建工具 | 经过一年验证，与 Tauri/React 19/Tailwind CSS v4 全面兼容。不用 8.x。 |
| Tailwind CSS | 4.2.2 | 原子化 CSS | v4 Oxide 引擎，CSS-first 配置（无 tailwind.config.js）。 |
| @tailwindcss/vite | 4.2.2 | Tailwind Vite 插件 | v4 的 Vite 集成，无需 PostCSS。 |
| @vitejs/plugin-react | 6.0.1 | React Vite 插件 | 支持 React 19 的快速刷新。 |
| shadcn/ui | CLI v4 (latest) | UI 组件库 | 源码复制模式，无版本锁定。已支持 Tailwind CSS v4。 |
| Rust | 1.93.1 (stable-msvc) | 后端语言 | 已安装。满足 tauri-plugin-shell 最低要求 1.77.2+。 |

### Frontend Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api | 2.10.1 | Tauri 前端 API | 核心。`invoke()` 调用 Rust 命令、窗口管理。 |
| @tauri-apps/plugin-dialog | 2.7.0 | 文件夹选择器 | "添加项目"时弹出原生文件夹选择对话框。 |
| lucide-react | 1.8.0 | SVG 图标 | shadcn/ui 默认图标方案。Button/卡片图标。 |
| sonner | 2.0.7 | Toast 通知 | shadcn/ui 推荐（替代已废弃的 toast 组件）。命令执行反馈。 |
| clsx | 2.1.1 | 条件 className | shadcn/ui 内置依赖。 |
| tailwind-merge | 3.5.0 | Tailwind 类名合并 | shadcn/ui 内置依赖（cn 工具函数）。 |
| class-variance-authority | 0.7.1 | 组件变体 | shadcn/ui 内置依赖（Button size/variant）。 |
| tw-animate-css | 1.4.0 | CSS 动画 | 替代 tailwindcss-animate。shadcn/ui Tailwind v4 使用。 |

### Rust Backend

| Crate | Version | Purpose | When to Use |
|-------|---------|---------|-------------|
| tauri | 2.10.x | 应用框架 | 必须。 |
| tauri-plugin-dialog | 2.x | 文件夹选择对话框 | 必须。前端调用 `open()` 时需要 Rust 端注册。 |
| serde | 1.x (derive) | 序列化 | 必须。IPC 参数和返回值的 JSON 序列化。 |
| serde_json | 1.x | JSON 处理 | 必须。配置文件读写。 |

**注意：** 本阶段不使用 `tauri-plugin-shell`（用 `std::process::Command` 替代）、不使用 `tauri-plugin-fs`（Phase 1 无持久化需求）、不使用 `tauri-plugin-store`（Phase 2 数据持久化时引入）。

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm | npm | pnpm 未安装，Phase 1 可用 npm（随 Node.js 自带）。后续可随时切换到 pnpm。 |
| Sonner (toast) | 自定义 toast | Sonner 是 shadcn/ui 官方推荐，开箱即用，样式一致。自定义实现增加工作量。 |
| wt.exe + cmd.exe 回退 | 仅 cmd.exe | wt.exe 提供更好的用户体验（标签页、主题），但需要检测是否安装。 |
| Tailwind CSS variables | CSS custom properties | Tailwind 变量与 utility classes 深度集成，shadcn/ui 依赖此模式。 |

### Installation

```bash
# 0. 安装 pnpm（可选，也可使用 npm）
npm install -g pnpm

# 1. 创建 Tauri + React + TS + Vite 项目
pnpm create tauri-app easypack
# 选择: React, TypeScript, Vite
# 或使用 npm: npm create tauri-app@latest easypack

# 2. 进入项目目录
cd easypack

# 3. 安装 Tailwind CSS v4 (Vite 插件方式)
pnpm add -D @tailwindcss/vite tailwindcss

# 4. 初始化 shadcn/ui (自动配置 Tailwind v4)
npx shadcn@latest init
# 选择: New York style, Zinc base color, CSS variables: yes

# 5. 添加 shadcn/ui 组件
npx shadcn@latest add button sonner
# tw-animate-css 会作为依赖自动安装

# 6. 安装图标库
pnpm add lucide-react

# 7. 安装 Tauri Dialog 插件 (前端)
pnpm add @tauri-apps/plugin-dialog

# 8. Rust 后端依赖 (在 src-tauri/ 目录)
cd src-tauri
cargo add tauri-plugin-dialog serde --features serde/derive
cargo add serde_json
```

**Version verification (2026-04-12):**
```
react: 19.2.5, typescript: 6.0.2 (项目锁定 5.7.3), vite: 8.0.8 (项目锁定 6.4.2)
tailwindcss: 4.2.2, @tailwindcss/vite: 4.2.2, @vitejs/plugin-react: 6.0.1
@tauri-apps/api: 2.10.1, @tauri-apps/plugin-dialog: 2.7.0
lucide-react: 1.8.0, sonner: 2.0.7, clsx: 2.1.1, tailwind-merge: 3.5.0
class-variance-authority: 0.7.1, tw-animate-css: 1.4.0
create-tauri-app: 4.6.2
Node: v22.22.0, Rust: 1.93.1 (stable-x86_64-pc-windows-msvc)
```

## Project Constraints (from CLAUDE.md)

- **平台**: 仅 Windows -- 工具面向个人 Windows 开发环境
- **技术栈**: Tauri 2 + Web 前端 -- Rust 后端处理 Shell 命令执行
- **终端**: 使用系统默认终端 -- 不内嵌终端模拟器
- **TypeScript**: 使用 5.7.x（不用 6.0）-- 稳定验证充分
- **Vite**: 使用 6.x（不用 8.x）-- 生态工具链已全面验证
- **Shell 执行**: 使用 Rust `std::process::Command`（不用 tauri-plugin-shell 的 JS API）-- 避免 CVE-2025-31477
- **CSS**: 使用 Tailwind CSS v4（不用 v3.x, 不用 CSS-in-JS）
- **UI 库**: 使用 shadcn/ui（不用 MUI, Chakra UI, Ant Design）

## Architecture Patterns

### Recommended Project Structure

```
easypack/
  src-tauri/                    # Rust 后端
    src/
      main.rs                   # Tauri 入口 (Windows 子系统配置)
      lib.rs                    # Builder + generate_handler! 注册所有命令
      commands/
        mod.rs                  # 命令模块入口
        shell.rs                # Shell 命令执行 (execute_command)
    Cargo.toml                  # Rust 依赖
    tauri.conf.json             # Tauri 配置 (窗口、标识符)
    capabilities/
      default.json              # 权限声明 (dialog, core:default)
    icons/                      # 应用图标
  src/                          # React 前端
    components/
      ui/                       # shadcn/ui 组件 (button.tsx, sonner.tsx)
      Sidebar.tsx               # 侧边栏 (添加项目按钮 + 项目名)
      MainArea.tsx              # 主区域 (引导页 / 命令按钮)
      CommandCard.tsx           # 单个命令按钮卡片
    hooks/
      useProject.ts             # 项目状态管理 hook
    lib/
      utils.ts                  # cn() 工具函数 (shadcn/ui 生成)
    App.tsx                     # 主布局 (Sidebar + MainArea)
    main.tsx                    # 入口
    index.css                   # Tailwind CSS 入口 + CSS 变量 + 渐变背景
  package.json
  vite.config.ts                # Vite 配置 (React + Tailwind 插件)
  tsconfig.json
  components.json               # shadcn/ui 配置
```

### Pattern 1: Tauri 自定义命令 (Rust 后端)

**What:** 所有前端到 Rust 的通信通过 `#[tauri::command]` + `invoke()` 完成。
**When:** 每次前端需要执行系统级操作时。

**Example:**
```rust
// src-tauri/src/commands/shell.rs
use std::process::Command as StdCommand;

/// 在系统终端中执行命令
/// 优先使用 Windows Terminal (wt.exe)，未安装时回退到 cmd.exe
#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String> {
    // 构建完整的命令：先 cd 到项目目录，再执行目标命令
    let full_command = format!("cd /d \"{}\" && {}", project_path, shell_command);

    // 优先尝试 Windows Terminal
    let result = StdCommand::new("wt")
        .args(["new-tab", "cmd", "/K", &full_command])
        .spawn();

    match result {
        Ok(_) => Ok(()),
        Err(_) => {
            // 回退到 cmd.exe：/C 执行 start 命令打开新窗口
            StdCommand::new("cmd")
                .args(["/C", "start", "cmd", "/K", &full_command])
                .spawn()
                .map_err(|e| format!("Failed to execute command: {}", e))?;
            Ok(())
        }
    }
}
```

```typescript
// 前端调用
import { invoke } from '@tauri-apps/api/core';

async function runCommand(projectPath: string, command: string) {
    await invoke('execute_command', { projectPath, shellCommand: command });
}
```

### Pattern 2: 文件夹选择器 (Dialog Plugin)

**What:** 使用 Tauri Dialog Plugin 打开系统原生文件夹选择对话框。
**When:** 用户点击"添加项目"按钮时。

**Example:**
```typescript
import { open } from '@tauri-apps/plugin-dialog';

async function selectProjectFolder(): Promise<string | null> {
    const selected = await open({
        directory: true,      // 选择文件夹而非文件
        multiple: false,      // 单选
        title: '选择项目文件夹'
    });

    // open() 返回 string | string[] | null
    if (typeof selected === 'string') {
        return selected;
    }
    return null;
}
```

### Pattern 3: 窗口配置 (tauri.conf.json)

**What:** 在 `tauri.conf.json` 中配置窗口尺寸、主题和约束。
**When:** 项目初始化时。

**Example:**
```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "EasyPack",
        "width": 720,
        "height": 480,
        "minWidth": 600,
        "minHeight": 400,
        "resizable": true,
        "center": true,
        "theme": "dark"
      }
    ]
  }
}
```

**注意：** `minWidth` 和 `minHeight` 应同时设置。已知 Tauri issue #7075：单独设置 minWidth 可能不生效，必须同时设置 minHeight。

### Pattern 4: Tailwind CSS v4 + 深色主题

**What:** Tailwind CSS v4 使用 CSS-first 配置，在 `index.css` 中定义所有主题变量。
**When:** 全局样式配置。

**Example:**
```css
/* src/index.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* shadcn/ui 使用 OKLCH 色彩格式 */
  --color-background: oklch(0.145 0.014 285.823);
  --color-foreground: oklch(0.985 0.002 247.858);
  --color-card: oklch(0.145 0.014 285.823);
  --color-card-foreground: oklch(0.985 0.002 247.858);
  --color-primary: oklch(0.985 0.002 247.858);
  --color-primary-foreground: oklch(0.205 0.006 285.885);
  --color-secondary: oklch(0.269 0.008 285.877);
  --color-secondary-foreground: oklch(0.985 0.002 247.858);
  --color-muted: oklch(0.269 0.008 285.877);
  --color-muted-foreground: oklch(0.708 0.012 285.877);
  --color-accent: oklch(0.269 0.008 285.877);
  --color-accent-foreground: oklch(0.985 0.002 247.858);
  --color-border: oklch(0.269 0.008 285.877);
  --color-ring: oklch(0.556 0.019 285.938);
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}
```

**注意：** shadcn/ui Tailwind v4 已从 HSL 切换到 OKLCH 色彩格式。使用 `npx shadcn@latest init` 会自动生成正确的 CSS 变量。

### Pattern 5: Sonner Toast 集成

**What:** 使用 shadcn/ui 推荐的 Sonner 组件显示命令执行反馈。
**When:** 命令执行后显示 toast（如"已执行: npm run build"），1-2 秒后消失。

**Example:**
```typescript
// App.tsx 顶层添加 Toaster
import { Toaster } from '@/components/ui/sonner';

function App() {
    return (
        <>
            {/* 主布局 */}
            <Toaster richColors position="bottom-right" duration={1500} />
        </>
    );
}

// 在命令执行处调用
import { toast } from 'sonner';

async function handleExecute(command: string) {
    await invoke('execute_command', { projectPath, shellCommand: command });
    toast.success(`已执行: ${command}`);
}
```

### Pattern 6: Capabilities 权限配置

**What:** 在 `src-tauri/capabilities/default.json` 中声明所需权限。
**When:** 项目初始化后立即配置。

**Example:**
```json
{
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "default",
    "description": "Capability for the main window",
    "windows": ["main"],
    "permissions": [
        "core:default",
        "dialog:default"
    ]
}
```

**关键：** 由于使用 `std::process::Command`（而非 tauri-plugin-shell），不需要配置 shell 权限。Dialog Plugin 只需 `dialog:default` 即可使用 `open()` API。

### Anti-Patterns to Avoid

- **不要在前端使用 `@tauri-apps/plugin-shell` 的 JS API:** Shell Plugin 的 `Command.create()` 是在 Tauri 进程内部执行，不会打开新终端窗口。且存在 CVE-2025-31477 安全漏洞。所有 Shell 执行通过 Rust `std::process::Command` 完成。
- **不要使用 localStorage:** Phase 2 会引入 tauri-plugin-store。Phase 1 的当前项目状态用 React state 管理即可（不需要跨会话持久化）。
- **不要手动拼接 Shell 命令字符串不做转义:** Windows 路径包含空格或中文时，必须用双引号包裹路径。
- **不要在 async 命令中使用 `&str` 借用类型:** Tauri async 命令不支持借用参数，使用 `String` owned 类型。
- **不要忘记在 `generate_handler!` 中注册命令:** 每个新命令都必须添加到宏数组中，否则前端 invoke 找不到。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 文件夹选择对话框 | 自定义 HTML 文件选择器 | `@tauri-apps/plugin-dialog` 的 `open()` | 原生体验、安全、系统风格一致 |
| Toast 通知组件 | 自定义 toast 动画和定时器 | `sonner` (shadcn/ui 集成) | 动画、堆叠、主题一致，开箱即用 |
| CSS 类名合并 | 手动拼接 className 字符串 | `clsx` + `tailwind-merge` (cn 函数) | shadcn/ui 标准模式，处理 Tailwind 类冲突 |
| 组件变体系统 | 手写 if/else 切换样式 | `class-variance-authority` (cva) | shadcn/ui Button 等组件的标准变体管理 |
| 终端检测逻辑 | 手动查找 wt.exe 路径 | `std::process::Command::new("wt").spawn()` 检测 | spawn 失败即回退到 cmd.exe，简单可靠 |

**Key insight:** shadcn/ui 的"复制源码"模式已经处理了组件的可访问性、变体管理和主题集成。不要重新实现 shadcn/ui 已提供的组件。

## Common Pitfalls

### Pitfall 1: Capabilities 权限遗漏

**What goes wrong:** Dialog Plugin 功能无法使用，运行时抛出 "Not allowed on this command" 或 "Permission denied" 错误。编译时不会报错。
**Why it happens:** Tauri 2 的权限配置在 `src-tauri/capabilities/*.json` 中，开发者容易忘记创建此文件或遗漏插件权限。
**How to avoid:** 项目初始化后立即创建 `default.json`，声明 `"core:default"` 和 `"dialog:default"`。使用 `$schema` 引用获取 IDE 自动补全。
**Warning signs:** 运行时控制台出现 "Not allowed" 错误；点击"添加项目"按钮无反应。

### Pitfall 2: Shell 命令执行方式选错

**What goes wrong:** 使用 tauri-plugin-shell 的前端 JS API 执行命令，命令在后台运行而不打开可见终端窗口。或使用了 CVE-2025-31477 漏洞版本。
**Why it happens:** Tauri 官方 Shell Plugin 文档排在搜索前列，容易误以为这是唯一方式。
**How to avoid:** 始终使用 Rust `std::process::Command`。前端只通过 `invoke()` 调用 Rust 命令。
**Warning signs:** 前端代码中出现 `import { Command } from '@tauri-apps/plugin-shell'`；命令执行后无终端窗口弹出。

### Pitfall 3: Windows 路径空格和中文

**What goes wrong:** 路径如 `D:\My Projects\app` 或 `D:\用户\项目` 导致命令执行失败或截断。
**Why it happens:** cmd.exe 不加引号时将空格视为参数分隔符。中文路径在某些编码下可能乱码。
**How to avoid:** 在 Rust 端构建命令时始终用双引号包裹路径：`format!("cd /d \"{}\" && {}", path, cmd)`。使用 `PathBuf` 处理路径操作。
**Warning signs:** 路径含空格的目录无法执行命令；中文路径显示乱码。

### Pitfall 4: async 命令使用借用类型

**What goes wrong:** 编译错误 `async fn with &str argument is not supported`。
**Why it happens:** Tauri async 命令在独立 tokio 任务上执行，借用参数的生命周期无法跨越 `.await` 点。
**How to avoid:** async 命令中使用 `String` 代替 `&str`，使用 owned 类型。
**Warning signs:** 编译错误提到 "borrowed type in async command"。

### Pitfall 5: generate_handler! 遗漏注册

**What goes wrong:** 前端 `invoke('command_name')` 抛出 "Command not found" 错误。
**Why it happens:** 创建了 `#[tauri::command]` 函数但忘记在 `generate_handler!` 宏中注册。多次调用 `.invoke_handler()` 只有最后一次生效。
**How to avoid:** 所有命令集中在一个 `generate_handler![]` 调用中注册。使用独立 `commands/` 模块管理。
**Warning signs:** 新添加的命令前端调用失败。

### Pitfall 6: shadcn/ui 初始化配置错误

**What goes wrong:** shadcn/ui 组件样式不正确，CSS 变量不生效，或 Tailwind v4 配置冲突。
**Why it happens:** shadcn/ui CLI v4 需要配合 Tailwind CSS v4 的 CSS-first 配置。手动修改 `tailwind.config.js`（v4 已废弃此文件）会导致冲突。
**How to avoid:** 使用 `npx shadcn@latest init` 自动配置。不要手动创建 `tailwind.config.js`。确认 `components.json` 中 `tailwind.css` 字段指向正确的 CSS 入口文件。
**Warning signs:** 组件没有样式；CSS 变量未定义；存在 `tailwind.config.js` 文件。

### Pitfall 7: pnpm 未安装

**What goes wrong:** 执行 `pnpm create tauri-app` 或 `pnpm add` 时命令不存在。
**Why it happens:** pnpm 不是 Node.js 默认包管理器，需要单独安装。
**How to avoid:** 先用 `npm install -g pnpm` 安装，或回退到 `npm`（所有 pnpm 命令都有 npm 等价命令）。
**Warning signs:** `command not found: pnpm`。

## Code Examples

### Tauri Builder 注册 (lib.rs)

```rust
// src-tauri/src/lib.rs
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::execute_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Windows Terminal 检测与回退

```rust
// src-tauri/src/commands/shell.rs
use std::process::Command as StdCommand;

#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String> {
    let full_command = format!("cd /d \"{}\" && {}", project_path, shell_command);

    // 尝试 Windows Terminal
    let wt_result = StdCommand::new("wt")
        .args(["new-tab", "cmd", "/K", &full_command])
        .spawn();

    if wt_result.is_ok() {
        return Ok(());
    }

    // 回退到 cmd.exe
    StdCommand::new("cmd")
        .args(["/C", "start", "cmd", "/K", &full_command])
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(())
}
```

**Source:** Microsoft 官方文档 learn.microsoft.com -- Windows Terminal 命令行参数。`wt new-tab cmd /K <command>` 在新标签页中运行 cmd 并保持窗口打开。`cmd /C start cmd /K <command>` 使用 Windows 内置 cmd 打开新窗口。

### Vite 配置 (Tailwind v4 + React)

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
        watch: { ignored: ["**/src-tauri/**"] },
    },
});
```

**Source:** Tauri 官方 Vite 集成文档 + Tailwind CSS v4 Vite 插件文档。

### 前端项目状态管理 (React Hook)

```typescript
// src/hooks/useProject.ts
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface Project {
    name: string;    // 文件夹名称
    path: string;    // 完整路径
}

export function useProject() {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);

    async function selectFolder() {
        const selected = await open({
            directory: true,
            multiple: false,
            title: '选择项目文件夹',
        });

        if (typeof selected === 'string') {
            // 从路径中提取文件夹名称 (D-14: 只显示文件夹名)
            const name = selected.split(/[\\/]/).filter(Boolean).pop() || selected;
            setCurrentProject({ name, path: selected });
        }
    }

    async function executeCommand(shellCommand: string) {
        if (!currentProject) return;
        await invoke('execute_command', {
            projectPath: currentProject.path,
            shellCommand,
        });
    }

    return { currentProject, selectFolder, executeCommand };
}
```

### 预设命令定义

```typescript
// src/lib/presets.ts
export const PRESET_COMMANDS = [
    { name: '打包项目', command: 'npm run build', icon: 'Package' },
    { name: '启动项目', command: 'npm run dev', icon: 'Play' },
    { name: 'Git Pull', command: 'git pull', icon: 'GitPullRequest' },
    { name: '启动 Claude', command: 'claude', icon: 'Sparkles' },
] as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js 配置 | CSS-first `@theme inline` 配置 | Tailwind v4.0 (2025.1) | 不再需要 JS 配置文件，CSS 中直接定义变量 |
| HSL 颜色格式 | OKLCH 颜色格式 | shadcn/ui CLI v4 (2026.3) | 色彩感知更均匀，CSS 变量格式变更 |
| tailwindcss-animate | tw-animate-css | shadcn/ui Tailwind v4 迁移 | 纯 CSS 动画库，无 JS 运行时开销 |
| shadcn/ui Toast 组件 | Sonner (sonner) | shadcn/ui 近期更新 | 更好的动画和堆叠效果，旧 Toast 已废弃 |
| Tauri 1.x allowlist | Tauri 2.x Capabilities/Permissions | Tauri 2.0 (2024.10) | 全新的三层安全模型，配置位置和格式完全不同 |
| `#[windows_subsystem = "windows"]` 在 main.rs | 由 Tauri 自动处理 | Tauri 2.x | 不再需要手动添加，Tauri 框架自动管理 |

**Deprecated/outdated:**
- `tailwind.config.js`: Tailwind v4 已废弃，使用 CSS `@theme inline` 指令
- `tailwindcss-animate`: 被 `tw-animate-css` 替代
- shadcn/ui 旧 Toast 组件: 被 Sonner 替代
- Tauri 1.x `allowlist`: Tauri 2.x 已完全移除

## Open Questions

1. **wt.exe 是否在 `PATH` 中？**
   - What we know: Windows 11 默认安装 Windows Terminal，wt.exe 通常在 PATH 中
   - What's unclear: 从 Rust `std::process::Command::new("wt")` 能否直接找到
   - Recommendation: 使用 `spawn()` 结果判断是否可用，失败则回退到 cmd.exe（已包含在代码示例中）

2. **create-tauri-app 默认生成的 Vite 版本**
   - What we know: create-tauri-app 4.6.2 可能生成 Vite 8.x 项目（最新版）
   - What's unclear: 是否需要在创建后手动降级到 Vite 6.x
   - Recommendation: 创建后检查 `package.json` 中的 vite 版本，如为 8.x 则 `npm install vite@6` 降级

3. **shadcn/ui init 对 Tailwind v4 的自动配置程度**
   - What we know: shadcn CLI v4 声称支持 Tailwind v4 自动配置
   - What's unclear: 是否需要手动调整 `index.css` 或 `vite.config.ts`
   - Recommendation: 执行 `npx shadcn@latest init` 后检查生成文件，确认 `@tailwindcss/vite` 插件已配置

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 前端构建 | Yes | v22.22.0 | -- |
| Rust (stable-msvc) | Tauri 后端 | Yes | 1.93.1 | -- |
| Cargo | Rust 包管理 | Yes | 1.93.1 | -- |
| MSVC Build Tools | Rust 编译 | Yes | (detected) | -- |
| pnpm | 包管理 (首选) | No | -- | 使用 npm (随 Node.js 自带) |
| npm | 包管理 (备选) | Yes | (随 Node.js) | -- |
| WebView2 | Tauri 运行时 | Yes | Windows 11 预装 | Tauri 安装程序可自动安装 |
| git | 版本控制 | Yes | (detected) | -- |

**Missing dependencies with no fallback:**
- None -- 所有核心依赖都已就位。

**Missing dependencies with fallback:**
- **pnpm:** 未安装。回退到 npm。所有 `pnpm add` 命令可替换为 `npm install`，`pnpm create` 替换为 `npm create`，`pnpm dlx` 替换为 `npx`。功能完全等价，仅磁盘效率略低（对本项目无影响）。

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (Phase 1 前端) + Rust #[test] (后端) |
| Config file | 无 -- Wave 0 需创建 `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && cd src-tauri && cargo test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | 文件夹选择器打开并返回路径 | integration (Tauri) | 手动测试 -- Dialog 依赖系统 UI | Wave 0 |
| CMD-04 | 命令在系统终端中执行 | unit (Rust) | `cd src-tauri && cargo test test_execute_command` | Wave 0 |
| CMD-04 | 路径含空格时命令正确执行 | unit (Rust) | `cd src-tauri && cargo test test_path_with_spaces` | Wave 0 |
| CMD-04 | 路径含中文时命令正确执行 | unit (Rust) | `cd src-tauri && cargo test test_path_with_cjk` | Wave 0 |
| UI-02 | 深色主题 CSS 变量正确加载 | smoke | 手动测试 -- 视觉验证 | Wave 0 |
| UI-04 | 侧边栏+主区域布局渲染 | unit (React) | `npx vitest run src/components/__tests__/layout.test.tsx` | Wave 0 |
| UI-06 | 窗口尺寸约束生效 | smoke | 手动测试 -- 拖拽窗口边缘验证 | Wave 0 |
| D-07 | wt.exe 优先，cmd.exe 回退 | unit (Rust) | `cd src-tauri && cargo test test_terminal_fallback` | Wave 0 |
| D-14 | 仅显示文件夹名称 | unit (React) | `npx vitest run src/hooks/__tests__/useProject.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (前端) 或 `cd src-tauri && cargo test` (后端)
- **Per wave merge:** `npx vitest run && cd src-tauri && cargo test`
- **Phase gate:** Full suite green + 手动冒烟测试通过（窗口启动、文件夹选择、命令执行、主题显示）

### Wave 0 Gaps

- [ ] `vitest.config.ts` -- Vitest 配置文件，需安装 `vitest` 和 `@testing-library/react`
- [ ] `src-tauri/src/commands/shell.rs` 中的 `#[cfg(test)] mod tests` -- Rust 单元测试
- [ ] `src/hooks/__tests__/useProject.test.ts` -- useProject hook 测试
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom` -- 前端测试框架
- [ ] 手动冒烟测试清单：窗口启动、深色主题、文件夹选择、4 个命令按钮点击

## Sources

### Primary (HIGH confidence)

- Tauri v2 官方文档 -- v2.tauri.app -- 窗口配置、命令系统、Dialog Plugin、Capabilities 模型
- Tauri Dialog Plugin -- https://v2.tauri.app/plugin/dialog/ -- `open()` API 参数
- Microsoft Windows Terminal 文档 -- learn.microsoft.com -- wt.exe 命令行参数 (new-tab, /K)
- shadcn/ui Tailwind v4 文档 -- https://ui.shadcn.com/docs/tailwind-v4 -- CSS-first 配置、OKLCH 色彩
- Tailwind CSS v4 官方文档 -- tailwindcss.com -- @theme inline、@tailwindcss/vite 插件
- npm registry 实时版本验证 -- 所有包版本通过 `npm view` 命令确认 (2026-04-12)
- .planning/research/STACK.md -- 技术栈选型详情
- .planning/research/ARCHITECTURE.md -- 架构模式与数据流
- .planning/research/PITFALLS.md -- 常见陷阱与规避策略

### Secondary (MEDIUM confidence)

- Sonner 官方文档 -- sonner.emilkowal.dev -- Toast 配置选项
- tw-animate-css npm -- 替代 tailwindcss-animate 的纯 CSS 动画库
- Tauri issue #7075 -- minWidth 需同时设置 minHeight

### Tertiary (LOW confidence)

- None -- 所有关键信息已有 HIGH/MEDIUM 来源验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 版本通过 npm registry 实时验证，安装命令经过交叉确认
- Architecture: HIGH -- 基于 Tauri 官方文档和已有研究文档（STACK.md、ARCHITECTURE.md、PITFALLS.md）
- Pitfalls: HIGH -- 7 个陷阱中 5 个来自 PITFALLS.md（经过社区验证），2 个来自 shadcn/ui 官方文档变更

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (技术栈稳定，30 天有效)

---

*Phase: 01-shell*
*Research completed: 2026-04-12*
