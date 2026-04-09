# Stack Research

**Domain:** Tauri 2.x Windows 桌面应用（项目快捷指令启动器）
**Researched:** 2026-04-10
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Tauri** | 2.10.x | 桌面应用框架（Rust 后端 + Web 前端） | 安装包比 Electron 小 ~96%，资源占用低，安全性好。本项目只需执行 Shell 命令 + 本地数据持久化，Tauri 的能力边界完全覆盖且不过剩。官方生态稳定，当前最新版 v2.10.3，社区活跃。 |
| **React** | 19.x | 前端 UI 框架 | 生态最成熟，组件库最丰富（shadcn/ui 原生支持 React）。19.x 稳定版自 2024.12 发布，当前 19.2.0，已经历多轮迭代，稳定可靠。对于本项目（侧边栏 + 卡片列表 + 弹窗），React 的组件化模型直观高效。 |
| **TypeScript** | 5.7.x | 类型系统 | 使用 5.7 而非 6.0 的理由：TS 6.0（2026.3 刚发布）是过渡版本，生态工具链（Vite 插件、Tauri 类型定义、shadcn/ui 类型）尚未全面验证。5.7 是经过充分验证的稳定版本，与所有推荐库完全兼容。等 TS 7.0（Go 编写的原生编译器）成熟后再升级。 |
| **Vite** | 6.x | 前端构建工具 | 推荐 Vite 6 而非 8 的理由：Vite 8（2026.3 刚发布）集成了 Rolldown，虽然向后兼容但生态工具链（尤其是 @tailwindcss/vite 插件）刚在 v4.2.2 修复了兼容问题，仍有潜在风险。Vite 6 经过一年验证，与 Tauri、React 19、Tailwind CSS v4 全面兼容，稳定无坑。 |
| **Rust** | 1.77.2+ | Tauri 后端语言 | Tauri 2 Shell Plugin 最低要求 Rust 1.77.2。推荐使用最新稳定版（当前 1.94.x）。通过 rustup 保持更新即可。 |
| **Tailwind CSS** | 4.x (>= 4.2.2) | 原子化 CSS 框架 | v4 全新 Oxide 引擎，构建速度提升 5x。CSS-first 配置（不再需要 tailwind.config.js），自动内容检测，零配置开箱即用。若用 Vite 8 则必须 >= 4.2.2；用 Vite 6 则 4.0+ 即可。本项目 UI 需要圆角卡片、侧边栏布局、紧凑现代风格，Tailwind 的 utility-first 模型能高效实现。 |

### UI Component Library

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **shadcn/ui** | latest (CLI v4) | 预构建 UI 组件库 | 不是 npm 依赖，而是直接复制源码到项目——完全可控，无版本锁定问题。基于 Radix UI 原语，可访问性好。官方已支持 Tailwind CSS v4（文档：ui.shadcn.com/docs/tailwind-v4）。提供 Button、Dialog、Scroll Area、Dropdown Menu 等本项目需要的所有组件。有 tauri-ui (agmmnn/tauri-ui) 专用脚手架工具。 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@tauri-apps/plugin-shell** | 2.x | 在系统终端执行 Shell 命令 | 核心需求。用于从 Tauri 前端调用 `Command.create()` 在 Windows 终端执行 `npm run build`、`git pull` 等命令。必须配置 capabilities/permissions 才能使用。 |
| **@tauri-apps/api** | 2.10.x | Tauri 前端 API | 核心。提供 `invoke()` 函数调用 Rust 后端命令，以及事件系统、窗口管理等 API。 |
| **lucide-react** | latest | SVG 图标库 | shadcn/ui 的默认图标方案。提供 Git、Terminal、Package、Play、Trash 等本项目需要的所有图标。轻量，按需导入。 |
| **clsx** | latest | 条件 className 合并 | shadcn/ui 内置依赖，用于动态组合 CSS 类名。 |
| **tailwind-merge** | latest | Tailwind 类名冲突合并 | shadcn/ui 内置依赖（cn 工具函数），解决 Tailwind 类名优先级冲突。 |
| **class-variance-authoriness (cva)** | latest | 组件变体管理 | shadcn/ui 内置依赖，用于定义 Button 等组件的 size/variant 变体。 |

### Rust Backend Dependencies

| Crate | Version | Purpose | When to Use |
|-------|---------|---------|-------------|
| **tauri** | 2.10.x | Tauri 核心 | 必须。应用框架本体。 |
| **tauri-plugin-shell** | 2.x | Shell 命令执行 | 必须。在系统终端中执行用户配置的命令。 |
| **serde** | 1.x (with derive) | JSON 序列化/反序列化 | 必须。项目列表和自定义指令以 JSON 持久化，需要 serde 进行 Rust <-> JSON 转换。 |
| **serde_json** | 1.x | JSON 读写 | 必须。读取/写入配置文件。 |
| **tauri-plugin-dialog** | 2.x | 系统文件选择对话框 | 可选。用于"添加项目"时选择本地文件夹路径。 |
| **tauri-plugin-fs** | 2.x | 文件系统操作 | 必须。读写本地 JSON 配置文件。 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | 包管理器 | 磁盘效率高（content-addressable store），安装速度快。Tauri 官方文档支持 pnpm。也可用 npm，但 pnpm 更推荐。 |
| **rustup** | Rust 工具链管理 | 用于安装和管理 Rust 版本。Windows 上需要安装 MSVC 工具链（Visual Studio Build Tools）。 |
| **create-tauri-app** | 项目脚手架 | `pnpm create tauri-app` 一键生成 Tauri + React + TS + Vite 项目结构。选择 React + TypeScript + Vite 模板。 |
| **@tailwindcss/vite** | Tailwind CSS Vite 插件 | Tailwind v4 的 Vite 集成插件。不再需要 PostCSS 配置。Vite 6 用最新版即可。 |

## Installation

```bash
# 1. 创建 Tauri + React + TS + Vite 项目
pnpm create tauri-app easypack
# 选择: React, TypeScript, Vite

# 2. 进入项目目录
cd easypack

# 3. 安装 Tailwind CSS v4 (Vite 插件方式)
pnpm add -D @tailwindcss/vite tailwindcss

# 4. 安装 shadcn/ui (初始化会自动配置 Tailwind)
pnpm dlx shadcn@latest init

# 5. 添加需要的 shadcn 组件
pnpm dlx shadcn@latest add button dialog scroll-area dropdown-menu input separator tooltip

# 6. 安装图标库
pnpm add lucide-react

# 7. 安装 Tauri Shell 插件 (前端)
pnpm add @tauri-apps/plugin-shell

# 8. 安装 Tauri FS 插件 (前端)
pnpm add @tauri-apps/plugin-fs

# 9. 安装 Tauri Dialog 插件 (前端, 用于文件夹选择)
pnpm add @tauri-apps/plugin-dialog

# 10. Rust 后端依赖 (在 src-tauri/ 目录)
cd src-tauri
cargo add tauri-plugin-shell tauri-plugin-fs tauri-plugin-dialog serde --features serde/derive
cargo add serde_json
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **React 19** | Svelte 5 | 如果极度追求包体积最小化（Svelte 编译后更小），或偏好更简洁的响应式语法。但 shadcn-svelte 生态不如 shadcn/ui 成熟，React 组件库选择更多。 |
| **React 19** | Vue 3 | 如果团队更熟悉 Vue。Vue + Tauri 同样是官方支持的一等公民。但 shadcn-vue 社区维护度低于 shadcn/ui。 |
| **Vite 6** | Vite 8 | 如果项目在 2026 下半年启动，Vite 8 生态已稳定后可直接使用。Vite 8 的 Rolldown 打包更快。 |
| **shadcn/ui** | Radix UI 直接使用 | 如果需要更细粒度的控制、更小的包体积，或不需要 shadcn 的预设样式。但开发效率会降低。 |
| **shadcn/ui** | Ant Design | 如果需要大量企业级复杂组件（表格、表单、图表）。但 Ant Design 设计语言偏后台管理，不适合本项目"现代紧凑"的定位，且包体积大。 |
| **Tailwind CSS 4** | CSS Modules | 如果团队坚决反对 utility-first 方案。但会失去 shadcn/ui 的兼容性和快速开发优势。 |
| **pnpm** | npm | 如果不想引入额外工具。npm 随 Node.js 自带，零配置。但 pnpm 在依赖管理和磁盘空间上更优。 |
| **TypeScript 5.7** | TypeScript 6.0 | 如果项目在 TS 6.0 生态稳定后（预计 2026 下半年）启动，可直接使用。 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Electron** | 安装包比 Tauri 大 10x+，内存占用高数倍，内嵌 Chromium 冗余。本项目不需要 Node.js 后端能力。 | Tauri 2.x |
| **Vite 8 (当前)** | 2026.3 刚发布，Tailwind CSS v4 在 4.2.2 才修复兼容性，LightningCSS at-rule 问题仍存在。社区模板和文档尚未全面跟进。 | Vite 6.x（稳定验证充分） |
| **TypeScript 6.0 (当前)** | 2026.3 刚发布，是"最后一代 JS 编译器"的过渡版本。Tauri 类型定义、shadcn/ui 类型、Vite 插件链尚未全部验证。 | TypeScript 5.7.x |
| **Tailwind CSS 3.x** | 已是上一代产品。v4 的 Oxide 引擎快 5x，CSS-first 配置更简洁。shadcn/ui 已全面支持 v4。 | Tailwind CSS 4.x |
| **Material UI (MUI)** | 设计语言偏 Google/企业后台，不适合"现代紧凑圆角"桌面工具定位。包体积大，运行时主题系统增加开销。 | shadcn/ui |
| **Chakra UI** | 设计体系固定，定制灵活性不如 shadcn/ui。运行时 CSS-in-JS 有性能开销。 | shadcn/ui |
| **Next.js / Nuxt / SvelteKit** | SSR 框架。Tauri 应用是纯 SPA，不需要服务端渲染、路由、API Routes 等能力。引入只会增加复杂度。 | Vite SPA 模式 |
| **Electron Forge / Electron Builder** | 属于 Electron 生态，与 Tauri 无关。 | Tauri 内置的 bundler |
| **CSS-in-JS (styled-components / Emotion)** | 运行时性能开销，与 Tailwind CSS 设计理念冲突，shadcn/ui 不使用。 | Tailwind CSS utility classes |
| **webpack** | Vite 已是 Tauri 官方推荐的构建工具。webpack 配置复杂，冷启动慢。 | Vite |

## Stack Patterns by Variant

**如果使用 Vite 6（推荐）：**
- Tailwind CSS 4.0+ 即可，无兼容问题
- 安装 `@tailwindcss/vite` 插件，在 `vite.config.ts` 中配置
- 所有生态工具已验证

**如果使用 Vite 8（激进选择）：**
- 必须使用 Tailwind CSS >= 4.2.2（修复了 Vite 8 兼容性）
- 注意 LightningCSS at-rule 错误的潜在问题
- 社区模板可能尚未更新

**如果需要暗色主题：**
- Tailwind CSS v4 原生支持 `dark:` 变体
- shadcn/ui 内置暗色主题支持
- 初始化 shadcn 时选择 dark 模式即可

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Tauri 2.10.x | React 19.x | 官方支持，社区已有 Tauri v2 + React 19 的生产案例 |
| Tauri 2.10.x | Vite 6.x / 8.x | Tauri 消费静态 HTML/JS/CSS 产物，与 Vite 版本无直接耦合 |
| React 19.x | TypeScript 5.7.x | 完全兼容，React 19 类型定义稳定 |
| React 19.x | Vite 6.x / 8.x | @vitejs/plugin-react 支持 React 19 |
| Tailwind CSS 4.2.2+ | Vite 8.x | 2026.3.18 修复兼容性（GitHub issue #19789） |
| Tailwind CSS 4.0+ | Vite 6.x | 完全兼容 |
| shadcn/ui (latest) | Tailwind CSS 4.x | 官方已支持（ui.shadcn.com/docs/tailwind-v4） |
| shadcn/ui (latest) | React 19.x | 完全兼容 |
| tauri-plugin-shell 2.x | Rust >= 1.77.2 | 官方文档明确要求 |
| tauri-plugin-shell 2.x | Windows | 完全支持，注意 capabilities/permissions 配置 |

## 项目架构概要

```
easypack/
  src-tauri/              # Rust 后端
    src/
      main.rs             # Tauri 入口 + 自定义命令
      commands/           # Shell 执行、配置读写等命令
    Cargo.toml            # Rust 依赖
    tauri.conf.json       # Tauri 配置（窗口、权限等）
    capabilities/         # 权限配置（shell、fs、dialog 等）
  src/                    # React 前端
    components/           # UI 组件
      ui/                 # shadcn/ui 组件（自动生成）
      Sidebar.tsx         # 项目列表侧边栏
      CommandCard.tsx     # 指令卡片
      CommandGrid.tsx     # 指令卡片网格
    hooks/                # 自定义 hooks
    lib/                  # 工具函数（cn, invoke 封装）
    App.tsx               # 主布局
    main.tsx              # 入口
    index.css             # Tailwind CSS 入口
  package.json
  vite.config.ts
  tsconfig.json
```

## Key Technical Decisions

### 1. 为什么选择 React 而不是 Svelte

虽然 Svelte 编译后体积更小，与 Tauri 的"轻量"理念更匹配，但考虑到：
- shadcn/ui 的 React 版本是原生的、最成熟的，Svelte 版本由社区维护
- React 的开发者基数更大，遇到问题更容易找到解决方案
- 本项目 UI 复杂度不高（侧边栏 + 卡片），React 和 Svelte 的性能差异可以忽略
- 本项目不需要极致的包体积优化（Tauri 应用本身已经很轻量）

### 2. 为什么选择 Vite 6 而不是 Vite 8

Vite 8 于 2026.3.12 发布，虽然向后兼容，但：
- Tailwind CSS 的 @tailwindcss/vite 插件在 v4.2.2 才修复兼容性（2026.3.18）
- LightningCSS at-rule 问题仍在社区讨论中
- 社区 Tauri 模板尚未全面更新到 Vite 8
- Vite 6 经过一年验证，与所有推荐库完全兼容
- 对于本项目，Vite 6 和 8 的构建速度差异不明显

### 3. 为什么不用 Tauri Shell Plugin 直接执行，而是用自定义 Rust 命令

项目需求是"在系统默认终端中打开并执行命令"（不是在应用内执行）。实现方式：
- 方案 A（推荐）：Rust 后端使用 `std::process::Command` 调用 `cmd.exe /c start` 在新终端窗口执行命令
- 方案 B：使用 Tauri Shell Plugin 的 `Command.spawn()`
- 推荐方案 A，因为更容易控制"在新终端窗口打开"的行为，且避免 Windows 上终端窗口闪烁的已知问题

## Sources

- [Tauri v2 Official Site](https://v2.tauri.app/) — Tauri 2.x 文档与发布信息 — HIGH confidence
- [Tauri Core Ecosystem Releases](https://v2.tauri.app/release/) — 当前版本 v2.10.3 — HIGH confidence
- [Tauri Shell Plugin Docs](https://v2.tauri.app/plugin/shell/) — Shell 命令执行 API — HIGH confidence
- [Tauri Vite Integration](https://v2.tauri.app/start/frontend/vite/) — Vite 配置指南 — HIGH confidence
- [React Versions](https://react.dev/versions) — 当前最新 19.2.0 — HIGH confidence
- [Vite 8.0 Announcement](https://vite.dev/blog/announcing-vite8) — Vite 8 发布信息 — HIGH confidence
- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4) — Tailwind v4 特性 — HIGH confidence
- [Tailwind CSS NPM](https://www.npmjs.com/package/tailwindcss) — 当前版本 4.2.2 — HIGH confidence
- [Tailwind + Vite 8 Compatibility Fix (GitHub #19789)](https://github.com/tailwindlabs/tailwindcss/issues/19789) — v4.2.2 修复 — HIGH confidence
- [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4) — 兼容性指南 — HIGH confidence
- [shadcn CLI v4 Changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) — CLI 最新版本 — HIGH confidence
- [TypeScript 6.0 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — TS 6.0 信息 — HIGH confidence
- [Rust Releases](https://releases.rs/) — 当前稳定版 1.94.1 — HIGH confidence
- [create-tauri-app GitHub](https://github.com/tauri-apps/create-tauri-app) — 脚手架工具 — HIGH confidence
- [tauri-ui by agmmnn](https://github.com/agmmnn/tauri-ui) — Tauri + shadcn/ui 脚手架 — MEDIUM confidence
- [Tauri v2 + React 19 Real-World Example](https://dev.to/purpledoubled/how-i-built-a-desktop-ai-app-with-tauri-v2-react-19-in-2026-1g47) — 社区案例 — MEDIUM confidence

---
*Stack research for: Tauri 2.x Windows 桌面项目启动器*
*Researched: 2026-04-10*
