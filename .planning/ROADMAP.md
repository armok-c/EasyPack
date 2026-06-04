# Roadmap: EasyPack

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-15)
- ✅ **v1.1 体验增强与预设指令** — Phases 6-10 (shipped 2026-04-26)
- ✅ **v1.2 快捷键、托盘与窗口增强** — Phases 11-14 (shipped 2026-05-12)
- 🚧 **v2.0 能力跃升** — Phases 15-20 (in progress)

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

<details>
<summary>✅ v1.2 快捷键、托盘与窗口增强 (Phases 11-14) — SHIPPED 2026-05-12</summary>

- [x] Phase 11: 全局快捷键 (2/2 plans) -- completed 2026-04-27
- [x] Phase 12: 系统托盘 (3/3 plans) -- completed 2026-04-28
- [x] Phase 13: 迷你悬浮窗 (3/3 plans) -- completed 2026-05-10
- [x] Phase 14: 边缘抽屉 (3/3 plans) -- completed 2026-05-10

</details>

### 🚧 v2.0 能力跃升 (In Progress)

**Milestone Goal:** 将 EasyPack 从"单行指令执行器"升级为"多行脚本 + 完整快捷键 + 多配置管理"的强大桌面工具。

- [x] **Phase 15: 开机启动** — 提供开机自启动开关和自愈机制 -- completed 2026-05-14
- [x] **Phase 16: 版本管理** — 应用版本号显示和 GitHub 更新检查 -- completed 2026-05-14
- [x] **Phase 17: 多行脚本指令** — 多行批处理脚本编辑和执行（v2.0 核心价值） -- completed 2026-05-15
- [x] **Phase 18: 快捷键设置面板** — VS Code 风格快捷键自定义面板 -- completed 2026-05-15
- [x] **Phase 19: 悬浮窗改进** — 紧凑布局、可折叠、折叠态项目切换 -- completed 2026-06-02
- [x] **Phase 20: 多配置文件管理** — 多套独立配置 profile 切换和导入导出 (completed 2026-06-04)

## Phase Details

### Phase 15: 开机启动
**Goal**: 用户可以配置 EasyPack 随 Windows 启动，启动后自动最小化到系统托盘
**Depends on**: Nothing (v2.0 第一个阶段，独立功能)
**Requirements**: BOOT-01, BOOT-02, BOOT-03, BOOT-04
**Success Criteria** (what must be TRUE):
  1. 用户可以在设置中切换开机启动开关，开关状态重启后保持
  2. 启用开机启动后，重启 Windows 时 EasyPack 自动启动并最小化到系统托盘，不显示窗口
  3. 如果注册表条目丢失（如被清理工具删除），下次启动 EasyPack 时自动修复
**Plans:** 2 plans
Plans:
- [x] 15-01-PLAN.md — Rust 后端 autostart 插件集成（注册、窗口隐藏、自愈） (completed 2026-05-14)
- [x] 15-02-PLAN.md — 前端 UI 集成（SettingsDialog 开关、状态管理、级联逻辑） (completed 2026-05-14)

### Phase 16: 版本管理
**Goal**: 用户可以看到当前版本号并在有新版本时收到通知
**Depends on**: Nothing (独立功能)
**Requirements**: VER-01, VER-02, VER-03, VER-04
**Success Criteria** (what must be TRUE):
  1. 用户可以在应用标题栏或设置页看到当前版本号
  2. 应用启动时自动检查更新，24 小时内不重复检查（缓存结果）
  3. 发现新版本时，用户看到明确的更新提示（badge 或 toast）
  4. 点击更新提示后，浏览器打开 GitHub Release 下载页面
**Plans:** 2 plans
Plans:
- [x] 16-01-PLAN.md — Rust 后端：check_for_updates command + open_release_page command + Cargo.toml 依赖 (completed 2026-05-14)
- [x] 16-02-PLAN.md — 前端 UI：useUpdateCheck hook + TitleBar 红点 + SettingsDialog 版本号和提示条 (completed 2026-05-14)

### Phase 17: 多行脚本指令
**Goal**: 用户可以编写和执行多行批处理脚本，使用完整的 Windows 批处理语法
**Depends on**: Nothing (核心功能，扩展现有命令系统)
**Requirements**: SCRIPT-01, SCRIPT-02, SCRIPT-03, SCRIPT-04, SCRIPT-05
**Success Criteria** (what must be TRUE):
  1. 用户可以在指令编辑器中编写多行命令，支持 if/else、for、变量、goto 等批处理语法
  2. 多行脚本通过临时 .bat 文件执行，中文路径不乱码（chcp 65001）
  3. 脚本编辑器提供语法高亮和行号显示
  4. 用户可以选择严格模式（失败即停）或宽松模式（继续执行）
  5. 现有单行指令数据完全兼容，scriptLines 为可选字段
**Plans:** 2 plans
Plans:
- [x] 17-01-PLAN.md — Rust 后端：数据模型扩展 + 临时 .bat 文件创建和执行 (completed 2026-05-15)
- [x] 17-02-PLAN.md — 前端 UI：CommandDialog Tab 切换 + CodeMirror 编辑器 + 批处理检测 + 卡片多行显示 (completed 2026-05-15)

### Phase 18: 快捷键设置面板
**Goal**: 用户可以在 VS Code 风格的面板中管理所有快捷键绑定
**Depends on**: Phase 17 (需要完整的操作列表来绑定快捷键)
**Requirements**: KBD-01, KBD-02, KBD-03, KBD-04, KBD-05, KBD-06
**Success Criteria** (what must be TRUE):
  1. 用户可以打开快捷键设置面板，看到所有可绑定操作的列表
  2. 用户可以点击操作后按键录制新快捷键组合
  3. 快捷键冲突时显示警告提示
  4. 用户可以搜索、按分类筛选快捷键，以及重置为默认值
  5. 除指令执行外，窗口操作（显示/隐藏、切换悬浮窗）、项目切换、打开文件夹等操作也可绑定快捷键
  6. 所有快捷键绑定重启后保持
**Plans:** 2 plans
Plans:
- [x] 18-01-PLAN.md — 后端数据模型与快捷键注册扩展（ShortcutAction 类型 + useShortcutActions hook + useGlobalShortcuts 扩展 + 持久化迁移 + 移除旧录制 UI） (completed 2026-05-15)
- [x] 18-02-PLAN.md — 前端 UI ShortcutPanel 面板（搜索 + 分组列表 + 录制 + 冲突检测 + 重置 + SettingsDialog 入口 + App 集成） (completed 2026-05-15)
**UI hint**: yes

### Phase 19: 悬浮窗改进
**Goal**: 悬浮窗更紧凑、可折叠，折叠态支持快速切换项目
**Depends on**: Nothing (独立修改现有组件)
**Requirements**: FLOAT-01, FLOAT-02, FLOAT-03, FLOAT-04, FLOAT-05
**Success Criteria** (what must be TRUE):
  1. 悬浮窗布局更紧凑（更小的内边距和字体），信息显示精简
  2. 用户可以折叠/展开悬浮窗，折叠态只显示项目图标和名称
  3. 折叠态点击项目名称可切换当前选中项目（不展开窗口）
  4. 折叠/展开之间有平滑动画过渡
  5. 悬浮窗可以拖拽移动到屏幕任意位置
**Plans:** 2 plans
Plans:
- [x] 19-01-PLAN.md — FloatApp 折叠/展开 UI + 胶囊折叠态 + CSS 过渡动画 + 展开态紧凑布局 (completed 2026-06-02)
- [x] 19-02-PLAN.md — 项目切换通信 + useFloatWindow 扩展（syncState 推送 projects + resize + float:switch-project 事件） (completed 2026-06-02)
**UI hint**: yes

### Phase 20: 多配置文件管理
**Goal**: 用户可以创建多套独立配置 profile 并在之间切换，支持导入导出
**Depends on**: Phase 15-19 全部完成 (数据层重构需在其他功能稳定后进行)
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06
**Success Criteria** (what must be TRUE):
  1. 用户可以创建、删除、重命名配置 profile（如"工作"、"个人"、"学习"）
  2. 用户可以在不同 profile 之间切换，切换后项目列表和指令立即更新
  3. 用户可以导出当前配置为 JSON 文件
  4. 用户可以导入 JSON 配置文件覆盖当前 profile
  5. 首次启动时，现有单配置数据自动迁移到默认 profile，无数据丢失
  6. Profile 切换操作序列化执行，快速连续切换不会导致数据损坏
**Plans:** 2/2 plans complete
Plans:
- [x] 20-01-PLAN.md — Store 层重构 + Profile 管理 + 数据迁移
- [x] 20-02-PLAN.md — UI 实现 + App.tsx 集成
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 15 → 16 → 17 → 18 → 19 → 20

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
| 11. 全局快捷键 | v1.2 | 2/2 | Complete | 2026-04-27 |
| 12. 系统托盘 | v1.2 | 3/3 | Complete | 2026-04-28 |
| 13. 迷你悬浮窗 | v1.2 | 3/3 | Complete | 2026-05-10 |
| 14. 边缘抽屉 | v1.2 | 3/3 | Complete | 2026-05-10 |
| 15. 开机启动 | v2.0 | 2/2 | Complete | 2026-05-14 |
| 16. 版本管理 | v2.0 | 2/2 | Complete | 2026-05-14 |
| 17. 多行脚本指令 | v2.0 | 2/2 | Complete | 2026-05-15 |
| 18. 快捷键设置面板 | v2.0 | 2/2 | Complete | 2026-05-15 |
| 19. 悬浮窗改进 | v2.0 | 2/2 | Complete | 2026-06-02 |
| 20. 多配置文件管理 | v2.0 | 2/2 | Complete    | 2026-06-04 |
