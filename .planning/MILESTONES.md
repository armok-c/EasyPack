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

## v1.1 体验增强与预设指令 (Shipped: 2026-04-26)

**Phases completed:** 5 phases (6-10), 11 plans
**Timeline:** 2026-04-15 → 2026-04-26 (11 days)
**Stats:** 70 files changed, +10,019 / -255 lines, ~78 commits

**Key accomplishments:**

- raw_arg 修复命令执行 0x80070002 错误，支持含空格/中文路径
- 无边框窗口 + 自定义 TitleBar（拖拽、窗口控制、阴影、高 DPI）
- Rust 后端项目信息（图标扫描、文件夹大小、Git 分支）+ 模态窗自适应滚动
- Toggle Group 按钮行 + 打开文件夹按钮
- 预设指令系统（4 分类 25 命令，双 Select 选择器，scope 选择）

**Key decisions:**

- raw_arg 替换 args（绕过 MSVC 转义）
- startDragging() 替代 data-tauri-drag-region（Windows 兼容性）
- Sync core + async Tauri command wrapper（测试友好）
- file: 前缀约定区分图标类型
- Ship 替代 CargoShip（lucide-react 可用性）
- explicit scope 参数 + commandMode fallback（向后兼容）

**Known deferred items at close:** 2 verification gaps (Phase 08, 10 human_needed)

---
