# EasyPack

## What This Is

EasyPack 是一个 Windows 桌面项目快捷指令启动器。无边框窗口现代化外观，左侧侧边栏管理本地项目地址（支持图标/颜色标记、自定义图标导入、拖拽排序），右侧以卡片式按钮排列常用指令和自定义指令（支持全局/项目级覆盖、预设指令快速添加）。选中项目后点击指令卡片，即可在系统默认终端中执行对应 Shell 命令。支持键盘导航（方向键切换项目、快捷键触发指令）。面向开发者个人使用，提升本地多项目管理效率。

## Core Value

选中项目 → 一键在终端执行指令，无需手动切换目录和输入命令。

## Requirements

### Validated

- ✓ PROJ-01: 文件夹选择器添加本地项目路径 — v1.0
- ✓ PROJ-02: 项目列表显示在左侧侧边栏 — v1.0
- ✓ PROJ-03: 点击侧边栏项目可选中，选中状态有清晰视觉反馈 — v1.0
- ✓ PROJ-04: 用户可删除已添加的项目 — v1.0
- ✓ PROJ-05: 项目图标和颜色标记，在侧边栏中展示 — v1.0
- ✓ PROJ-06: 拖拽调整项目在侧边栏中的排序 — v1.0
- ✓ CMD-01: 内置全局默认指令卡片 — v1.0
- ✓ CMD-02: 指令以卡片网格形式排列 — v1.0
- ✓ CMD-03: 必须先选中项目，指令卡片才可点击执行 — v1.0
- ✓ CMD-04: 点击指令卡片在系统默认终端执行 Shell 命令 — v1.0
- ✓ CMD-05: 用户可添加自定义全局指令 — v1.0
- ✓ CMD-06: 用户可编辑和删除自定义指令 — v1.0
- ✓ CMD-07: 每个项目可拥有独立指令集覆盖全局默认指令 — v1.0
- ✓ CMD-08: 未选中项目时指令卡片禁用灰显 — v1.0
- ✓ DATA-01: 项目列表保存到本地，重启后恢复 — v1.0
- ✓ DATA-02: 自定义指令持久化保存 — v1.0
- ✓ DATA-03: 项目排序和图标/颜色设置持久化 — v1.0
- ✓ UI-01: 现代圆角矩形卡片设计 — v1.0
- ✓ UI-02: 深色主题支持 — v1.0
- ✓ UI-03: 键盘导航支持 — v1.0
- ✓ UI-04: 侧边栏与主区域布局紧凑 — v1.0
- ✓ UI-05: 交互元素微动效反馈 — v1.0
- ✓ UI-06: 窗口可调整大小，布局自适应 — v1.0
- ✓ UI-07: 模态弹窗操作 — v1.0
- ✓ FIX-01: 命令执行修复（0x80070002） — v1.1
- ✓ FIX-02: 含空格/中文/特殊字符路径正确执行 — v1.1
- ✓ WIN-01: 无边框窗口 + 自定义标题栏 — v1.1
- ✓ WIN-02: 窗口阴影和 resize — v1.1
- ✓ WIN-03: 高 DPI 显示正常 — v1.1
- ✓ PROJ-07: 自动识别应用图标 — v1.1
- ✓ PROJ-08: 自定义图标文件路径 — v1.1
- ✓ PROJ-09: 文件夹大小显示 — v1.1
- ✓ PROJ-10: Git 分支名显示 — v1.1
- ✓ UI-09: 模态窗自适应滚动 — v1.1
- ✓ PROJ-11: 打开文件夹按钮 — v1.1
- ✓ UI-10: Toggle Group 按钮行 — v1.1
- ✓ PRE-01: 双下拉框预设指令选择 — v1.1
- ✓ PRE-02: 默认卡片精简为 git pull + claude — v1.1
- ✓ PRE-03: 预设命令库（4 分类 25 命令） — v1.1
- ✓ PRE-04: 预设指令 scope 选择（全局/项目） — v1.1

## Current Milestone: v1.2 快捷键、托盘与窗口增强

**Goal:** 让 EasyPack 从"点击执行"进化为"键盘驱动 + 随手可用"的桌面工具。

**Target features:**
- 快捷键绑定 — 每个指令可设置快捷键，选中项目后按快捷键直接在终端执行
- 系统托盘 — 关闭窗口最小化到托盘，右键菜单支持完整操作
- 迷你悬浮窗 — 独立小窗口，仅显示常用指令按钮，点击直接对选中项目执行
- 边缘抽屉 — 主窗口可拖到屏幕四边吸附隐藏，鼠标接触自动滑出，移开自动收回

### Active

(None — to be defined in requirements step)

### Out of Scope

| Feature | Reason |
|---------|--------|
| 内嵌终端 | 彻底改变产品性质，技术复杂度极高 |
| macOS / Linux 支持 | 仅面向 Windows 个人开发环境 |
| 远程项目管理 | 仅本地项目 |
| 多用户/账户系统 | 个人工具，无需用户系统 |
| 自动更新 | 个人工具，手动更新即可 |
| 插件系统 | 自定义指令 + 预设已满足扩展需求 |
| Windows Snap Layout | 无边框窗口无法触发 Snap，需额外实现 |

## Context

- **Shipped:** v1.0 MVP (2026-04-15), v1.1 体验增强与预设指令 (2026-04-26)
- **Tech stack:** Tauri 2 + React 19 + TypeScript 5.7 + Tailwind CSS 4 + shadcn/ui + Rust
- **Codebase:** ~4,500 LOC (TypeScript + Rust), ~240 files
- **Persistence:** tauri-plugin-store (JSON)
- **Command execution:** Rust std::process::Command with raw_arg → Windows Terminal / cmd.exe
- **Window:** Frameless + custom TitleBar (startDragging + Window API controls)
- **Test infrastructure:** Vitest (95+ unit tests), cargo test (17 Rust tests)
- **Known issues:** CommandDialog.test.tsx 16 pre-existing test failures; 8 pre-existing TypeScript build errors

## Constraints

- **平台**: 仅 Windows — 工具面向个人 Windows 开发环境
- **技术栈**: Tauri + Web 前端 — Rust 后端处理 Shell 命令执行
- **终端**: 使用系统默认终端 — 不内嵌终端模拟器

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 而非 Electron | 安装包更小、资源占用更低、原生体验更好 | ✓ Validated (v1.0) |
| 外部终端而非内嵌 | 实现简单，用户习惯已有终端工具 | ✓ Validated (v1.0) |
| 本地 JSON 持久化 | 数据量小、无需数据库、简单可靠 | ✓ Validated (v1.0) |
| std::process::Command + raw_arg | 避开 Shell Plugin CVE，修复 0x80070002 | ✓ Validated (v1.1) |
| tauri-plugin-store + autoSave | Tauri 2 官方持久化方案，零配置 | ✓ Validated (v1.0) |
| 项目 ID 使用路径规范化 | lowercase + forward slashes 替代 UUID | ✓ Validated (v1.0) |
| @dnd-kit 实现拖拽排序 | React 生态成熟方案，支持无障碍 | ✓ Validated (v1.0) |
| Roving tabindex 键盘导航 | WAI-ARIA 标准模式 | ✓ Validated (v1.0) |
| startDragging() 窗口拖拽 | data-tauri-drag-region 在 Windows 不可靠 | ✓ Validated (v1.1) |
| Sync core + async Tauri wrapper | 测试可脱离 tokio 运行时 | ✓ Validated (v1.1) |
| file: 前缀区分图标类型 | 简单可靠的图标类型约定 | ✓ Validated (v1.1) |
| 手写 Button pair 替代 ToggleGroup | 仅 2 按钮互斥切换，无需 Radix 抽象 | ✓ Validated (v1.1) |
| Ship 替代 CargoShip | lucide-react 不导出 CargoShip | ✓ Validated (v1.1) |
| explicit scope + commandMode fallback | 向后兼容的指令范围参数 | ✓ Validated (v1.1) |

---
*Last updated: 2026-04-26 after v1.1 milestone*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
