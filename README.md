# EasyPack

**Windows 开发者的第二大脑——一个按钮，一条命令，告别 cd + 手动输入。**

![Tauri](https://img.shields.io/badge/Tauri-2.10-blue?logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Rust](https://img.shields.io/badge/Rust-1.77+-orange?logo=rust)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 它是什么

EasyPack 是一个 Windows 桌面快捷指令启动器。你在左侧管理本地项目，右侧排列常用指令卡片。选中项目，点击卡片，命令就在系统终端里执行。

**核心价值：选中项目 → 一键执行，不再手动切换目录和输入命令。**

```
┌──────────────────────────────────────────────┐
│  EasyPack                              ─ □ ✕ │
├────────────┬─────────────────────────────────┤
│ 📁 项目A   │  ┌─────┐ ┌─────┐ ┌─────┐       │
│ 📁 项目B ◀ │  │git  │ │npm  │ │claude│       │
│ 📁 项目C   │  │pull │ │build│ │     │       │
│            │  └─────┘ └─────┘ └─────┘       │
│ [+ 添加]   │  ┌─────┐ ┌─────┐ ┌─────┐       │
│            │  │npm  │ │cargo│ │git  │       │
│            │  │dev  │ │test │ │push │       │
│            │  └─────┘ └─────┘ └─────┘       │
└────────────┴─────────────────────────────────┘
```

## 为什么造它

每个开发者都有十几个本地项目。每次操作都要：

1. 打开终端
2. `cd` 到项目目录
3. 输入命令（可能还打错）
4. 切到下一个项目，重复上述步骤

EasyPack 把这四步变成一步：**选中 → 点击**。

## 功能亮点

### 项目管理
- 从本地文件夹添加项目，自动识别 Git 分支、项目图标、文件夹大小
- 拖拽排序项目列表
- 右键菜单快速操作（设置图标颜色、删除）
- 项目图标支持 favicon 自动发现

### 指令卡片
- **25+ 内置预设指令**：覆盖 Git、NPM/Node、Python/Pip、Rust/Cargo 四大类别
- 自定义指令：添加任何你想要的命令
- 全局指令 vs 项目级指令：公共命令一次配置，项目特定命令单独管理
- 拖拽排列指令顺序

### 边缘抽屉模式
- 窗口吸附到屏幕边缘自动收起
- 鼠标靠近边缘时滑出
- 拖拽时实时显示吸附预览指示器
- 享受 macOS 式的窗口管理体验

### 浮动窗口
- 一键切换为迷你浮动面板
- 置顶显示，不遮挡工作区
- 快速执行最近使用的命令

### 系统集成
- 系统托盘图标，最小化到托盘不占任务栏
- 全局快捷键，随时呼出
- 在系统默认终端中执行命令（不内嵌终端模拟器）
- 无装饰窗口 + 自定义标题栏，现代桌面应用体验

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | [Tauri](https://v2.tauri.app/) | 2.10.x | Rust 后端 + Web 前端桌面框架 |
| 前端 | [React](https://react.dev/) | 19.x | UI 组件化 |
| 类型 | [TypeScript](https://www.typescriptlang.org/) | 5.7.x | 类型安全 |
| 构建 | [Vite](https://vite.dev/) | 6.x | 前端构建，HMR 极速刷新 |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) | 4.x | 原子化 CSS，Oxide 引擎 |
| 组件 | [shadcn/ui](https://ui.shadcn.com/) | latest | 可控的 UI 组件库 |
| 后端 | [Rust](https://www.rust-lang.org/) | 1.77+ | Shell 命令执行、文件系统操作 |
| 图标 | [Lucide](https://lucide.dev/) | latest | 轻量 SVG 图标 |

### 为什么是 Tauri 不是 Electron

| 对比项 | Tauri | Electron |
|--------|-------|----------|
| 安装包大小 | ~3 MB | ~50 MB |
| 内存占用 | ~30 MB | ~150 MB |
| 后端语言 | Rust | Node.js |
| 安全模型 | 权限白名单 | 全开放 |

本项目只需要执行 Shell 命令和本地数据持久化，Tauri 的能力完全覆盖且不冗余。

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.77+（通过 rustup 安装）
- [pnpm](https://pnpm.io/)（推荐）或 npm
- Windows 10/11（仅支持 Windows）

### 安装依赖

```bash
# 前端依赖
npm install

# Rust 后端依赖（在 src-tauri/ 目录下，由 Cargo.toml 管理，首次构建时自动下载）
```

### 开发模式

```bash
npm tauri dev
```

这会启动 Vite 开发服务器和 Tauri 窗口，支持前端热更新。

### 构建发布

```bash
npm tauri build
```

输出安装包在 `src-tauri/target/release/bundle/` 目录。

## 项目结构

```
EasyPack/
├── src/                          # 前端源码
│   ├── main.tsx                  # 主入口
│   ├── float-main.tsx            # 浮动窗口入口
│   ├── App.tsx                   # 主应用组件
│   ├── components/
│   │   ├── Sidebar.tsx           # 项目列表侧边栏
│   │   ├── MainArea.tsx          # 指令卡片主区域
│   │   ├── CommandCard.tsx       # 单个指令卡片
│   │   ├── CommandDialog.tsx     # 指令管理对话框
│   │   ├── TitleBar.tsx          # 自定义标题栏
│   │   ├── SnapIndicator.tsx     # 边缘吸附指示器
│   │   ├── FloatApp.tsx          # 浮动窗口应用
│   │   ├── SettingsDialog.tsx    # 全局设置
│   │   ├── ProjectSettingsDialog.tsx  # 项目设置
│   │   └── ui/                   # shadcn/ui 组件
│   ├── hooks/                    # React Hooks
│   │   ├── useProject.ts         # 项目状态管理
│   │   ├── useGlobalShortcuts.ts # 全局快捷键
│   │   ├── useEdgeDrawer.ts      # 边缘抽屉逻辑
│   │   ├── useFloatWindow.ts     # 浮动窗口管理
│   │   ├── useTray.ts            # 系统托盘
│   │   ├── useRecentCommands.ts  # 最近命令
│   │   └── useVisibilityState.ts # 窗口可见性
│   └── lib/                      # 工具函数
│       ├── types.ts              # TypeScript 类型定义
│       ├── presets.ts            # 预设指令数据
│       ├── icons.ts              # 图标系统
│       ├── colors.ts             # 颜色工具
│       ├── shortcutUtils.ts      # 快捷键工具
│       ├── drawer-geometry.ts    # 抽屉几何计算
│       └── drawer-animation.ts   # 抽屉动画逻辑
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # Tauri 入口
│   │   ├── lib.rs                # 插件注册
│   │   └── commands/
│   │       ├── shell.rs          # Shell 命令执行
│   │       └── project_info.rs   # 项目信息读取
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 内置指令一览

### Git（8 条）
`git pull` · `git push` · `git status` · `git log --oneline -10` · `git fetch` · `git checkout main` · `git add .` · `git commit`

### NPM/Node（6 条）
`npm install` · `npm run build` · `npm run dev` · `npm test` · `npm run lint` · `npm start`

### Python/Pip（5 条）
`python` · `pip install` · `pip install -r requirements.txt` · `python -m venv venv` · `pytest`

### Rust/Cargo（6 条）
`cargo build` · `cargo run` · `cargo test` · `cargo clippy` · `cargo fmt` · `cargo check`

当然，你也可以添加任何自定义命令——`claude`、`docker compose up`、`pnpm deploy`，随你。

## 命令执行原理

```
用户点击卡片
    ↓
前端 invoke("execute_command", { projectPath, shellCommand })
    ↓
Rust 后端 std::process::Command
    ↓
cmd.exe /C start "" /d "项目路径" cmd /K "命令"
    ↓
系统终端新窗口执行，窗口保持打开
```



## 许可证

MIT
