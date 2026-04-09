# Requirements: EasyPack

**Defined:** 2026-04-10
**Core Value:** 选中项目 → 一键在终端执行指令，无需手动切换目录和输入命令

## v1 Requirements

### 项目管理

- [ ] **PROJ-01**: 用户可通过文件夹选择器添加本地项目路径
- [ ] **PROJ-02**: 项目列表显示在左侧侧边栏，显示项目名称
- [ ] **PROJ-03**: 点击侧边栏项目可选中，选中状态有清晰视觉反馈
- [ ] **PROJ-04**: 用户可删除已添加的项目
- [ ] **PROJ-05**: 用户可为项目设置图标和颜色标记，在侧边栏中展示
- [ ] **PROJ-06**: 用户可拖拽调整项目在侧边栏中的排序

### 指令系统

- [ ] **CMD-01**: 内置全局默认指令卡片：打包项目、启动项目、启动 Claude、Git Pull
- [ ] **CMD-02**: 指令以卡片网格形式排列在右侧主区域，紧凑美观
- [ ] **CMD-03**: 必须先选中左侧项目，右侧指令卡片才可点击执行
- [ ] **CMD-04**: 点击指令卡片后在系统默认终端中打开并执行对应 Shell 命令
- [ ] **CMD-05**: 用户可添加自定义全局指令（名称 + Shell 命令）
- [ ] **CMD-06**: 用户可编辑和删除自定义指令
- [ ] **CMD-07**: 每个项目可拥有独立的指令集覆盖全局默认指令
- [ ] **CMD-08**: 未选中项目时指令卡片显示为禁用/灰显状态，给出提示

### 数据持久化

- [ ] **DATA-01**: 项目列表保存到本地，重启应用后恢复
- [ ] **DATA-02**: 自定义指令（全局 + 项目级）保存到本地，重启应用后恢复
- [ ] **DATA-03**: 项目排序和图标/颜色设置持久化保存

### UI/UX（核心重点）

- [ ] **UI-01**: 现代圆角矩形卡片设计，整体视觉美观紧凑
- [ ] **UI-02**: 深色主题支持，作为默认主题
- [ ] **UI-03**: 键盘导航支持（上下切换项目、Enter 选中、快捷键触发指令）
- [ ] **UI-04**: 侧边栏与主区域布局紧凑，无多余空白，信息密度高
- [ ] **UI-05**: 所有交互元素有 hover/active/selected 状态的微动效反馈
- [ ] **UI-06**: 窗口可调整大小，布局自适应
- [ ] **UI-07**: 添加/编辑指令时使用模态弹窗，操作流畅不打断主流程

## v2 Requirements

### 体验增强

- **ENH-01**: 执行历史记录，可查看最近执行的命令及结果状态
- **ENH-02**: 指令分组管理（按类别分组展示卡片）
- **ENH-03**: 系统托盘集成，最小化到托盘
- **ENH-04**: package.json 自动扫描导入 npm scripts
- **ENH-05**: 浅色主题

### 高级功能

- **ADV-01**: 批量执行多个指令
- **ADV-02**: 指令模板变量（如 `{{project_path}}` 自动替换）
- **ADV-03**: 导入/导出配置

## Out of Scope

| Feature | Reason |
|---------|--------|
| 内嵌终端 | 彻底改变产品性质，技术复杂度极高，PROJECT.md 明确排除 |
| macOS / Linux 支持 | 仅面向 Windows 个人开发环境 |
| 远程项目管理 | 仅本地项目 |
| 多用户/账户系统 | 个人工具，无需用户系统 |
| 自动更新 | 个人工具，手动更新即可 |
| 插件系统 | v1 过度设计，自定义指令已满足扩展需求 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROJ-01 | — | Pending |
| PROJ-02 | — | Pending |
| PROJ-03 | — | Pending |
| PROJ-04 | — | Pending |
| PROJ-05 | — | Pending |
| PROJ-06 | — | Pending |
| CMD-01 | — | Pending |
| CMD-02 | — | Pending |
| CMD-03 | — | Pending |
| CMD-04 | — | Pending |
| CMD-05 | — | Pending |
| CMD-06 | — | Pending |
| CMD-07 | — | Pending |
| CMD-08 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| UI-04 | — | Pending |
| UI-05 | — | Pending |
| UI-06 | — | Pending |
| UI-07 | — | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial definition*
