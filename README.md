<h1 align="center">EasyPack</h1>

<p align="center">
  <strong>Windows 开发者的快捷指令启动器</strong><br>
  选中项目 → 点击卡片 → 命令在终端执行，告别重复的 cd 和手动输入。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.10-blue?logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Rust-1.77+-orange?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

```
┌──────────────────────────────────────────────┐
│  EasyPack                              ─ □ ✕ │
├────────────┬─────────────────────────────────┤
│ 📁 项目A   │  ┌─────┐ ┌─────┐ ┌─────┐       │
│ 📁 项目B ◀│  │git  │ │npm  │ │claude│       │
│ 📁 项目C   │  │pull │ │build│ │     │       │
│            │  └─────┘ └─────┘ └─────┘       │
│ [+ 添加]   │  ┌─────┐ ┌─────┐ ┌─────┐       │
│            │  │npm  │ │cargo│ │git  │       │
│            │  │dev  │ │test │ │push │       │
│            │  └─────┘ └─────┘ └─────┘       │
└────────────┴─────────────────────────────────┘
```

## 功能

### 📁 项目管理

从本地文件夹添加项目，自动识别 Git 分支与项目图标，支持拖拽排序和右键菜单快速操作。

### 🎴 指令卡片

25+ 内置预设指令，覆盖 Git / NPM / Python / Cargo 四大类别。支持自定义指令、全局与项目级指令分层管理、拖拽排列顺序。

### 📌 边缘抽屉

窗口吸附到屏幕边缘时自动收起，鼠标靠近边缘即滑出。支持拖拽时实时显示吸附预览指示器。

### 🔲 浮动窗口

一键切换为迷你浮动面板，置顶显示不遮挡工作区，可快速执行最近使用的命令。

### ⌨️ 快捷指令面板

通过全局快捷键随时呼出指令面板，无需切换窗口即可快速搜索并执行任意命令。

### 🖥️ 系统集成

最小化到系统托盘不占任务栏，命令在系统默认终端中执行，无装饰窗口搭配自定义标题栏，开箱即用。

## 技术栈

**Tauri 2** + **React 19** + **TypeScript** + **Tailwind CSS 4** + **shadcn/ui** + **Rust**

> 为什么不用 Electron？安装包 ~3 MB vs ~50 MB，内存 ~30 MB vs ~150 MB。

## 快速开始

**前置要求：** Node.js 18+ · Rust 1.77+ · pnpm（推荐）

```bash
npm install
npm tauri dev        # 开发模式
npm tauri build      # 构建安装包
```

## 内置指令

| 类别 | 指令 |
|------|------|
| **Git** | `pull` · `push` · `status` · `log` · `fetch` · `checkout main` · `add .` · `commit` |
| **NPM** | `install` · `run build` · `run dev` · `test` · `run lint` · `start` |
| **Python** | `python` · `pip install` · `pip install -r requirements.txt` · `venv` · `pytest` |
| **Cargo** | `build` · `run` · `test` · `clippy` · `fmt` · `check` |

也可以添加任意自定义命令。

## 命令执行原理

```
点击卡片 → invoke("execute_command") → Rust std::process::Command → 系统终端新窗口执行
```

## 许可证

MIT
