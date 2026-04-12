# EasyPack

## What This Is

EasyPack 是一个 Windows 桌面项目快捷指令启动器。左侧侧边栏管理本地项目地址，右侧以卡片式按钮排列常用指令（打包、启动、Git 操作、启动 Claude 等）。选中项目后点击指令卡片，即可在系统默认终端中执行对应 Shell 命令。面向开发者个人使用，提升本地多项目管理效率。

## Core Value

选中项目 → 一键在终端执行指令，无需手动切换目录和输入命令。

## Requirements

### Validated

- [x] 右侧卡片式指令按钮布局，点击后在默认终端执行 Shell 命令 (Phase 01: Shell)
- [x] 内置全局默认指令：打包项目、启动项目、启动 Claude、Git 操作 (Phase 01: Shell)
- [x] 现代、紧凑、圆角矩形 UI 设计 (Phase 01: Shell)

### Active

- [ ] 左侧侧边栏可添加、删除本地项目路径
- [ ] 支持添加自定义指令
- [ ] 每个项目可拥有独立的指令集，也可使用全局默认指令
- [ ] 项目列表和自定义指令本地持久化保存

### Out of Scope

- 内嵌终端 — 直接使用系统默认终端
- macOS / Linux 支持 — 仅 Windows
- 远程项目管理 — 仅本地项目
- 多用户/账户系统 — 个人工具

## Context

- 技术栈：Tauri + Web 前端，仅 Windows 平台
- 命令执行方式：通过 Tauri 后端调用系统 Shell，在默认终端（Windows Terminal / cmd）中打开并执行
- 指令本质是 Shell 命令（如 `npm run build`、`git pull`、`claude` 等）
- 每个项目路径对应一个本地代码仓库/工程目录
- 数据持久化方案：本地文件存储（如 JSON 配置文件）

## Constraints

- **平台**: 仅 Windows — 工具面向个人 Windows 开发环境
- **技术栈**: Tauri + Web 前端 — Rust 后端处理 Shell 命令执行
- **终端**: 使用系统默认终端 — 不内嵌终端模拟器

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 而非 Electron | 安装包更小、资源占用更低、原生体验更好 | — Validated (Phase 01) |
| 外部终端而非内嵌 | 实现简单，用户习惯已有终端工具，功能更完整 | — Validated (Phase 01) |
| 本地 JSON 持久化 | 数据量小、无需数据库、简单可靠 | — Pending |

---

*Last updated: 2026-04-12 after Phase 01 completion*

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
