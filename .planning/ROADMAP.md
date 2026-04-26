# Roadmap: EasyPack

## Milestones

- **v1.0 MVP** -- Phases 1-5 (shipped 2026-04-15)
- **v1.1 体验增强与预设指令** -- Phases 6-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) -- SHIPPED 2026-04-15</summary>

- [x] Phase 1: 应用脚手架与 Shell 命令核心 (3/3 plans) -- completed 2026-04-10
- [x] Phase 2: 项目侧边栏与持久化 (2/2 plans) -- completed 2026-04-12
- [x] Phase 3: 指令卡片与核心交互 (1/1 plans) -- completed 2026-04-13
- [x] Phase 4: 自定义指令与项目级覆盖 (3/3 plans) -- completed 2026-04-14
- [x] Phase 5: 项目个性化与键盘增强 (3/3 plans) -- completed 2026-04-15

</details>

### v1.1 体验增强与预设指令 (In Progress)

**Milestone Goal:** 修复命令执行核心问题，提升窗口体验和操作效率，引入预设指令系统降低配置成本。

- [x] **Phase 6: 命令执行修复** -- completed 2026-04-17
- [x] **Phase 7: 无边框窗口与自定义标题栏** -- completed 2026-04-17
- [x] **Phase 8: Rust 后端扩展与快速 UI 修复** -- completed 2026-04-25
- [x] **Phase 9: 前端 UI 集成** -- completed 2026-04-25
- [ ] **Phase 10: 预设指令系统** -- 分类的预设指令库、双下拉框选择器、全局/项目级选择

## Phase Details

### Phase 6: 命令执行修复
**Goal**: 用户能正常点击任何项目的任何指令卡片，终端在正确目录下执行命令，路径含空格/中文/特殊字符也不出错
**Depends on**: Phase 5 (v1.0 完成)
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. 用户点击指令卡片后终端正确打开，在项目目录下执行命令，不再报 0x80070002 错误
  2. 项目路径含空格（如 `C:\My Projects\app`）时命令能正确执行
  3. 项目路径含中文字符（如 `C:\用户\项目`）时命令能正确执行
**Plans**: 1 plan

Plans:
- [x] 06-01-PLAN.md -- 使用 raw_arg 修复命令执行传参

### Phase 7: 无边框窗口与自定义标题栏
**Goal**: 应用拥有现代化的无边框窗口外观，顶部显示自定义标题栏（应用名称、拖拽区域、窗口控制按钮），窗口阴影和 resize 正常工作
**Depends on**: Phase 6
**Requirements**: WIN-01, WIN-02, WIN-03
**Success Criteria** (what must be TRUE):
  1. 应用窗口顶部显示自定义标题栏，包含应用名称、拖拽区域和最小化/最大化/关闭按钮，三个按钮功能正常
  2. 窗口保留正常阴影效果，用户可通过鼠标拖拽四边和四角调整窗口大小
  3. 高 DPI 显示器下标题栏文字、按钮和窗口内容显示清晰正常，无模糊或缩放异常
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 07-01-PLAN.md -- 无边框窗口和自定义标题栏实现

### Phase 8: Rust 后端扩展与快速 UI 修复
**Goal**: Rust 后端提供项目信息检测能力（图标识别、文件夹大小、Git 分支、打开文件夹），模态窗在窗口过小时可滚动不被截断
**Depends on**: Phase 7
**Requirements**: PROJ-07, PROJ-08, PROJ-09, PROJ-10, UI-09
**Success Criteria** (what must be TRUE):
  1. 用户在项目设置图标模态中，系统能自动从项目目录识别应用图标（package.json/Cargo.toml/.ico 等）并展示可选列表
  2. 用户可在项目设置图标模态中选择自定义图标文件路径（.ico/.png/.svg），选中后图标在侧边栏中显示
  3. 选中项目后，指令卡片上方信息栏显示文件夹大小（排除 node_modules/.git/target 等大目录）和 Git 分支名（非 Git 仓库则不显示分支）
  4. 模态窗根据窗口大小自适应，窗口过小时模态窗内容可滚动查看，不会被截断
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 08-01-PLAN.md -- Rust 后端命令实现（scan_project_icons + get_project_info）+ assetProtocol 配置
- [x] 08-02-PLAN.md -- DialogContent 自适应高度修复（max-h-[90vh] + flex-col + 内部滚动包装）
- [x] 08-03-PLAN.md -- 图标类型判别工具函数 + Sidebar 文件图标渲染
- [x] 08-04-PLAN.md -- ProjectSettingsDialog 自定义图标 UI（扫描 + 文件选择）+ 人工验证
- [x] 08-05-PLAN.md -- 前端项目信息集成（文件夹大小 + Git 分支显示 + App.tsx props 传递）

### Phase 9: 前端 UI 集成
**Goal**: 指令切换和控制操作以按钮样式呈现在同一行，用户可直接从应用内打开项目文件夹
**Depends on**: Phase 8
**Requirements**: PROJ-11, UI-10
**Success Criteria** (what must be TRUE):
  1. 用户可通过"打开文件夹"按钮在 Windows 文件资源管理器中打开项目目录
  2. 全局指令/项目指令切换改为按钮样式，与"打开文件夹"按钮在同一行显示，点击切换正常工作
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 09-01-PLAN.md -- Toggle Group 按钮行 + 打开文件夹按钮 + open_folder Rust 命令

### Phase 10: 预设指令系统
**Goal**: 用户通过分类下拉框快速选择预设指令（python/pip/git/rust/npm），降低手动配置成本
**Depends on**: Phase 9
**Requirements**: PRE-01, PRE-02, PRE-03, PRE-04
**Success Criteria** (what must be TRUE):
  1. 添加指令模态窗包含双下拉框（先选大分类如 Git/NPM/Python/Rust，再选具体命令），选择后自动填充指令名称和 Shell 命令
  2. 默认指令卡片仅保留 git pull 和 open claude 两个，其他原有默认卡片已移除
  3. 预设命令库涵盖 python、pip、git、rust/cargo、npm/node 常用命令，用户可在下拉框中浏览和选择
  4. 用户通过预设添加指令时，可选择添加为全局指令或当前项目指令，添加后指令卡片立即显示在对应区域
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md -- 预设库数据层扩展（presets.ts 重写 + icons.ts 扩展 + Select 安装）
- [ ] 10-02-PLAN.md -- CommandDialog 双 Select 预设选择器 UI 集成

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10

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
| 10. 预设指令系统 | v1.1 | 1/2 | In Progress | - |
