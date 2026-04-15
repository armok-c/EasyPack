# EasyPack

## What This Is

EasyPack 是一个 Windows 桌面项目快捷指令启动器。左侧侧边栏管理本地项目地址（支持图标/颜色标记、拖拽排序），右侧以卡片式按钮排列常用指令和自定义指令（支持全局/项目级覆盖）。选中项目后点击指令卡片，即可在系统默认终端中执行对应 Shell 命令。支持键盘导航（方向键切换项目、快捷键触发指令）。面向开发者个人使用，提升本地多项目管理效率。

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
- ✓ CMD-01: 内置全局默认指令卡片（打包、启动、Claude、Git Pull） — v1.0
- ✓ CMD-02: 指令以卡片网格形式排列，紧凑美观 — v1.0
- ✓ CMD-03: 必须先选中项目，指令卡片才可点击执行 — v1.0
- ✓ CMD-04: 点击指令卡片在系统默认终端执行 Shell 命令 — v1.0
- ✓ CMD-05: 用户可添加自定义全局指令（名称 + Shell 命令） — v1.0
- ✓ CMD-06: 用户可编辑和删除自定义指令 — v1.0
- ✓ CMD-07: 每个项目可拥有独立指令集覆盖全局默认指令 — v1.0
- ✓ CMD-08: 未选中项目时指令卡片禁用灰显，给出提示 — v1.0
- ✓ DATA-01: 项目列表保存到本地，重启应用后恢复 — v1.0
- ✓ DATA-02: 自定义指令（全局 + 项目级）保存到本地，重启应用后恢复 — v1.0
- ✓ DATA-03: 项目排序和图标/颜色设置持久化保存 — v1.0
- ✓ UI-01: 现代圆角矩形卡片设计，视觉美观紧凑 — v1.0
- ✓ UI-02: 深色主题支持，作为默认主题 — v1.0
- ✓ UI-03: 键盘导航支持（上下切换项目、Enter 选中、快捷键触发指令） — v1.0
- ✓ UI-04: 侧边栏与主区域布局紧凑，信息密度高 — v1.0
- ✓ UI-05: 所有交互元素有 hover/active/selected 状态微动效反馈 — v1.0
- ✓ UI-06: 窗口可调整大小，布局自适应 — v1.0
- ✓ UI-07: 添加/编辑指令时使用模态弹窗，操作流畅不打断主流程 — v1.0

### Active

（无 — v1.0 全部需求已验证）

### Out of Scope

| Feature | Reason |
|---------|--------|
| 内嵌终端 | 彻底改变产品性质，技术复杂度极高 |
| macOS / Linux 支持 | 仅面向 Windows 个人开发环境 |
| 远程项目管理 | 仅本地项目 |
| 多用户/账户系统 | 个人工具，无需用户系统 |
| 自动更新 | 个人工具，手动更新即可 |
| 插件系统 | v1 过度设计，自定义指令已满足扩展需求 |

## Context

- **Shipped:** v1.0 MVP — 2026-04-15
- **Tech stack:** Tauri 2 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Codebase:** ~3,500 LOC (TypeScript + Rust), 166 files
- **Persistence:** tauri-plugin-store (JSON)
- **Command execution:** Rust std::process::Command → Windows Terminal / cmd.exe
- **Test infrastructure:** Vitest 单元测试已就位

## Constraints

- **平台**: 仅 Windows — 工具面向个人 Windows 开发环境
- **技术栈**: Tauri + Web 前端 — Rust 后端处理 Shell 命令执行
- **终端**: 使用系统默认终端 — 不内嵌终端模拟器

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 而非 Electron | 安装包更小、资源占用更低、原生体验更好 | ✓ Validated (Phase 01) |
| 外部终端而非内嵌 | 实现简单，用户习惯已有终端工具，功能更完整 | ✓ Validated (Phase 01) |
| 本地 JSON 持久化 | 数据量小、无需数据库、简单可靠 | ✓ Validated (Phase 02) |
| std::process::Command 执行命令 | 避开 Shell Plugin CVE-2025-31477，控制终端窗口行为 | ✓ Validated (Phase 01) |
| tauri-plugin-store + autoSave | Tauri 2 官方持久化方案，零配置 | ✓ Validated (Phase 02) |
| 项目 ID 使用路径规范化 | lowercase + forward slashes 替代 UUID，简洁直观 | ✓ Validated (Phase 02) |
| @dnd-kit 实现拖拽排序 | React 生态成熟方案，支持无障碍访问 | ✓ Validated (Phase 05) |
| Roving tabindex 键盘导航 | WAI-ARIA 标准模式，无障碍友好 | ✓ Validated (Phase 05) |

---

*Last updated: 2026-04-15 after v1.0 milestone completion*

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
