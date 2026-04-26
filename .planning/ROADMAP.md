# Roadmap: EasyPack

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-15)
- ✅ **v1.1 体验增强与预设指令** — Phases 6-10 (shipped 2026-04-26)
- 🚧 **v1.2 快捷键、托盘与窗口增强** — Phases 11-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-04-15</summary>

- [x] Phase 1: 应用脚手架与 Shell 命令核心 (3/3 plans) -- completed 2026-04-10
- [x] Phase 2: 项目侧边栏与持久化 (2/2 plans) -- completed 2026-04-12
- [x] Phase 3: 指令卡片与核心交互 (1/1 plans) -- completed 2026-04-13
- [x] Phase 4: 自定义指令与项目级覆盖 (3/3 plans) -- completed 2026-04-14
- [x] Phase 5: 项目个性化与键盘增强 (3/3 plans) -- completed 2026-04-15

</details>

<details>
<summary>✅ v1.1 体验增强与预设指令 (Phases 6-10) — SHIPPED 2026-04-26</summary>

- [x] Phase 6: 命令执行修复 (1/1 plans) -- completed 2026-04-17
- [x] Phase 7: 无边框窗口与自定义标题栏 (1/1 plans) -- completed 2026-04-17
- [x] Phase 8: Rust 后端扩展与快速 UI 修复 (5/5 plans) -- completed 2026-04-25
- [x] Phase 9: 前端 UI 集成 (1/1 plans) -- completed 2026-04-25
- [x] Phase 10: 预设指令系统 (3/3 plans) -- completed 2026-04-26

</details>

### 🚧 v1.2 快捷键、托盘与窗口增强 (In Progress)

**Milestone Goal:** 让 EasyPack 从"点击执行"进化为"键盘驱动 + 随手可用"的桌面工具。

- [ ] **Phase 11: 全局快捷键** — 每个指令可绑定快捷键，选中项目后按键直接执行
- [ ] **Phase 12: 系统托盘** — 关闭窗口最小化到托盘，托盘菜单支持完整操作
- [ ] **Phase 13: 迷你悬浮窗** — 独立小窗口显示常用指令按钮，始终置顶，点击直接执行
- [ ] **Phase 14: 边缘抽屉** — 主窗口吸附到屏幕边缘隐藏，鼠标接触自动滑出

## Phase Details

### Phase 11: 全局快捷键
**Goal**: 用户可以通过键盘快捷键直接执行指令，无需鼠标点击
**Depends on**: Phase 10 (预设指令系统)
**Requirements**: KB-01, KB-02, KB-03, KB-04, KB-05, KB-06
**Success Criteria** (what must be TRUE):
  1. 用户在指令设置中可以为任意指令分配快捷键（如 Ctrl+Alt+G）
  2. 选中项目后，按下已绑定的快捷键立即在系统终端执行对应指令
  3. 切换项目时，快捷键自动更新为当前项目的合并指令集（全局 + 项目级覆盖）
  4. 分配快捷键时，如果与已有绑定冲突，用户会看到警告提示
  5. 用户可以清除任意指令的快捷键绑定，且绑定在重启后仍然保留
**Plans:** 2 plans

Plans:
- [ ] 11-01-PLAN.md — Tauri 插件安装 + 类型扩展 + 快捷键工具函数 + useGlobalShortcuts hook
- [ ] 11-02-PLAN.md — useProject 扩展 + CommandCard 徽章状态机 + MainArea 录制管理 + App 集成

**UI hint**: yes

### Phase 12: 系统托盘
**Goal**: 应用可以常驻系统托盘，关闭窗口不退出程序，托盘菜单提供完整操作入口
**Depends on**: Phase 11
**Requirements**: TRAY-01, TRAY-02, TRAY-03, TRAY-04, TRAY-05, TRAY-06, TRAY-07, TRAY-08
**Success Criteria** (what must be TRUE):
  1. 应用运行时系统托盘显示应用图标，关闭窗口后应用不退出
  2. 单击托盘图标可以切换主窗口的显示/隐藏状态
  3. 右键托盘图标弹出上下文菜单，包含"显示/隐藏窗口"和"退出"选项
  4. 托盘菜单可以直接对当前选中项目执行收藏指令
  5. 用户可以在设置中开关托盘常驻和关闭到托盘行为
**Plans**: TBD
**UI hint**: yes

### Phase 13: 迷你悬浮窗
**Goal**: 用户可以打开一个始终置顶的迷你窗口，快速对当前项目执行常用指令
**Depends on**: Phase 12
**Requirements**: FLOAT-01, FLOAT-02, FLOAT-03, FLOAT-04, FLOAT-05, FLOAT-06, FLOAT-07
**Success Criteria** (what must be TRUE):
  1. 用户可以从主窗口工具栏或托盘菜单打开迷你悬浮窗
  2. 悬浮窗显示当前选中项目的指令按钮，始终置顶且不出现在任务栏中
  3. 点击悬浮窗中的指令按钮直接在系统终端执行该指令
  4. 主窗口切换项目时，悬浮窗的指令按钮实时更新
  5. 用户可以独立关闭悬浮窗，不影响主窗口
**Plans**: TBD
**UI hint**: yes

### Phase 14: 边缘抽屉
**Goal**: 主窗口可以吸附到屏幕四边隐藏，鼠标接触自动滑出，实现"呼之即来"的体验
**Depends on**: Phase 13
**Requirements**: DRAWER-01, DRAWER-02, DRAWER-03, DRAWER-04, DRAWER-05, DRAWER-06
**Success Criteria** (what must be TRUE):
  1. 用户可以将主窗口拖到屏幕任意一边（上/下/左/右），窗口自动吸附并隐藏
  2. 鼠标接触隐藏窗口所在的屏幕边缘时，窗口平滑滑出
  3. 鼠标离开滑出的窗口后，窗口自动平滑收回隐藏
  4. 用户可以通过拖拽将窗口从边缘拉出，取消吸附状态
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 11 → 12 → 13 → 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. 应用脚手架与 Shell 命令核心 | v1.0 | 3/3 | Complete | 2026-04-10 |
| 2. 项目侧边栏与持久化 | v1.0 | 2/2 | Complete | 2026-04-12 |
| 3. 指令卡片与核心交互 | v1.0 | 1/1 | Complete | 2026-04-13 |
| 4. 自定义指令与项目级覆盖 | v1.0 | 3/3 | Complete | 2026-04-14 |
| 5. 项目个性化与键盘增强 | v1.0 | 3/3 | Complete | 2026-04-15 |
| 6. 命令执行修复 | v1.1 | 1/1 | Complete | 2026-04-17 |
| 7. 无边框窗口与自定义标题栏 | v1.1 | 1/1 | Complete | 2026-04-17 |
| 8. Rust 后端扩展与快速 UI 修复 | v1.1 | 5/5 | Complete | 2026-04-25 |
| 9. 前端 UI 集成 | v1.1 | 1/1 | Complete | 2026-04-25 |
| 10. 预设指令系统 | v1.1 | 3/3 | Complete | 2026-04-26 |
| 11. 全局快捷键 | v1.2 | 0/2 | Not started | - |
| 12. 系统托盘 | v1.2 | 0/? | Not started | - |
| 13. 迷你悬浮窗 | v1.2 | 0/? | Not started | - |
| 14. 边缘抽屉 | v1.2 | 0/? | Not started | - |
