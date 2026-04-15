# Milestones

## v1.0 MVP (Shipped: 2026-04-15)

**Phases completed:** 5 phases, 12 plans, 19 tasks
**Timeline:** 2026-04-10 → 2026-04-15 (5 days)
**Stats:** 166 files changed, ~3,500 LOC (TypeScript + Rust), 92 commits

**Key accomplishments:**

- Tauri + React + Tailwind CSS 脚手架搭建，深色主题与毛玻璃侧边栏
- Rust 后端 Shell 命令执行核心，支持 Windows Terminal / cmd 回退
- 项目侧边栏管理，多项目 CRUD + tauri-plugin-store 持久化
- 指令卡片自适应网格布局，执行动效反馈与空状态引导
- 自定义指令系统，支持全局/项目级指令 CRUD 与模态弹窗编辑
- 项目个性化（图标颜色标记、拖拽排序）与键盘导航增强

**Key decisions:**

- Tauri 而非 Electron（安装包更小、资源更低）
- 外部终端而非内嵌（实现简单、用户习惯）
- 本地 JSON 持久化（数据量小、简单可靠）
- std::process::Command 执行命令（避开 Shell Plugin 安全问题）
- tauri-plugin-store 配合 autoSave 用于数据持久化

---
