# Roadmap: EasyPack

## Overview

EasyPack 是一个 Windows 桌面项目快捷指令启动器。从脚手架搭建和 Shell 命令执行核心开始，逐步构建项目侧边栏管理、指令卡片交互、自定义指令扩展，最后完成项目个性化和键盘增强。UI 质量作为核心优先级，从第一阶段起就内建深色主题、紧凑布局和自适应框架，而非最后打磨。共 5 个阶段，24 个 v1 需求全覆盖。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: 应用脚手架与 Shell 命令核心** - 技术栈搭建、深色主题框架、文件夹选择、终端命令执行
- [x] **Phase 2: 项目侧边栏与持久化** - 侧边栏项目管理、选中交互、数据持久化 (completed 2026-04-12)
- [ ] **Phase 3: 指令卡片与核心交互** - 圆角卡片网格、全局默认指令、禁用状态、微动效反馈
- [ ] **Phase 4: 自定义指令与项目级覆盖** - 自定义指令 CRUD、模态弹窗、项目级指令集
- [ ] **Phase 5: 项目个性化与键盘增强** - 图标颜色标记、拖拽排序、键盘导航

## Phase Details

### Phase 1: 应用脚手架与 Shell 命令核心
**Goal**: 用户可以启动应用，选择一个本地文件夹，点击按钮在系统终端中执行命令，深色主题和自适应布局就位
**Depends on**: Nothing (first phase)
**Requirements**: PROJ-01, CMD-04, UI-02, UI-04, UI-06
**Success Criteria** (what must be TRUE):
  1. 应用以深色主题启动，视觉美观，窗口可调整大小且布局自适应
  2. 用户可通过文件夹选择器选择本地项目路径
  3. 点击按钮后在系统默认终端（Windows Terminal / cmd）中打开并执行 Shell 命令
**Plans**: 3 plans

Plans:
- [x] 01-01: Tauri + React + Tailwind CSS + shadcn/ui 脚手架搭建与深色主题配置
- [x] 01-02: Tauri 权限配置与 Rust 命令执行核心实现
- [x] 01-03: 文件夹选择器与 Shell 命令执行集成验证

### Phase 2: 项目侧边栏与持久化
**Goal**: 用户可以在侧边栏管理项目列表，选中项目有清晰反馈，所有数据重启后保留
**Depends on**: Phase 1
**Requirements**: PROJ-02, PROJ-03, PROJ-04, DATA-01, DATA-03
**Success Criteria** (what must be TRUE):
  1. 左侧侧边栏显示已添加的项目名称列表，布局紧凑无多余空白
  2. 点击项目可选中，选中状态有清晰的视觉反馈（高亮/边框/背景色变化）
  3. 用户可从侧边栏删除已添加的项目
  4. 重启应用后，项目列表和排序设置完整恢复
**Plans**: 2 plans

Plans:
- [x] 02-01: tauri-plugin-store 安装与 useProject hook 多项目重构
- [x] 02-02: Sidebar 多项目 UI 重构与全流程集成验证

### Phase 3: 指令卡片与核心交互
**Goal**: 用户选中项目后可在右侧卡片区域点击执行指令，完成"选中项目 -> 点击卡片 -> 终端执行"核心循环
**Depends on**: Phase 2
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-08, UI-01, UI-05
**Success Criteria** (what must be TRUE):
  1. 右侧主区域以紧凑美观的圆角矩形卡片网格展示全局默认指令（打包项目、启动项目、启动 Claude、Git Pull）
  2. 未选中项目时，所有指令卡片灰显禁用，并给出"请先选择项目"的提示
  3. 选中项目后，点击指令卡片在系统终端执行对应 Shell 命令
  4. 所有卡片和交互元素有 hover、active、selected 状态的微动效反馈
**Plans**: 1 plan

Plans:
- [x] 03-01: 自适应网格 + 执行反馈动效 + 测试基础设施

### Phase 4: 自定义指令与项目级覆盖
**Goal**: 用户可以创建和管理自定义指令，为不同项目配置独立指令集，所有自定义数据持久化保存
**Depends on**: Phase 3
**Requirements**: CMD-05, CMD-06, CMD-07, DATA-02, UI-07
**Success Criteria** (what must be TRUE):
  1. 用户可通过模态弹窗添加自定义全局指令（填写名称 + Shell 命令），弹窗操作流畅不打断主流程
  2. 用户可编辑和删除已有的自定义指令
  3. 用户可为特定项目设置独立指令集，覆盖全局默认指令
  4. 自定义指令（全局和项目级）在重启应用后完整恢复
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 04-01: 基础设施 — shadcn 组件安装 + CommandItem 类型 + CommandDialog 弹窗
- [x] 04-02: 交互层 — CommandCard 编辑模式扩展 + useProject 指令 CRUD 与持久化
- [x] 04-03: 项目级覆盖 — 项目级指令集机制 + MainArea 编辑模式 UI 集成

### Phase 5: 项目个性化与键盘增强
**Goal**: 用户可以个性化项目外观（图标、颜色、排序）并通过键盘高效完成所有核心操作
**Depends on**: Phase 4
**Requirements**: PROJ-05, PROJ-06, UI-03
**Success Criteria** (what must be TRUE):
  1. 用户可为项目设置图标和颜色标记，设置后在侧边栏项目中展示
  2. 用户可拖拽调整项目在侧边栏中的排序
  3. 用户可通过键盘上下箭头切换项目、Enter 键选中项目、快捷键触发指令卡片执行
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 05-01-PLAN.md — 项目图标与颜色标记（数据层 + 右键菜单 + 设置弹窗 + 侧边栏展示）
- [ ] 05-02-PLAN.md — 拖拽排序（@dnd-kit/react 安装 + 拖拽手柄 + reorderProjects）
- [ ] 05-03-PLAN.md — 键盘导航（useKeyboard hook + roving tabindex + 数字键快捷 + Tab 区域切换）

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 应用脚手架与 Shell 命令核心 | 0/3 | Planning complete | - |
| 2. 项目侧边栏与持久化 | 2/2 | Complete   | 2026-04-12 |
| 3. 指令卡片与核心交互 | 0/1 | Planning complete | - |
| 4. 自定义指令与项目级覆盖 | 2/3 | In Progress | - |
| 5. 项目个性化与键盘增强 | 0/3 | Planning complete | - |
