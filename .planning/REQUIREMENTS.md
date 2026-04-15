# Requirements: EasyPack v1.1

**Defined:** 2026-04-15
**Core Value:** 选中项目 → 一键在终端执行指令，无需手动切换目录和输入命令

## v1.1 Requirements

### FIX — 命令执行修复

- [ ] **FIX-01**: 用户点击任何项目的任何指令卡片后，终端能正确在项目目录下执行命令（不再报 0x80070002）
- [ ] **FIX-02**: 含空格、中文、特殊字符的项目路径也能正确执行命令

### WIN — 窗口体验

- [ ] **WIN-01**: 应用窗口无边框，顶部显示自定义标题栏（应用名称 + 拖拽区域 + 最小化/最大化/关闭按钮）
- [ ] **WIN-02**: 无边框窗口保留窗口阴影和正常的 resize 拖拽能力
- [ ] **WIN-03**: 高 DPI 显示器下无边框窗口元素和文字显示正常

### PROJ — 项目信息增强

- [ ] **PROJ-07**: 用户可在项目设置图标模态中，从项目目录自动识别应用图标（识别 package.json、Cargo.toml、.ico 等）
- [ ] **PROJ-08**: 用户可在项目设置图标模态中，选择自定义图标文件路径（支持 .ico/.png/.svg）
- [ ] **PROJ-09**: 选中项目后，指令卡片上方信息栏显示文件夹大小（排除 node_modules/.git/target 等大目录）
- [ ] **PROJ-10**: 如果项目是 Git 仓库，信息栏显示当前分支名；非 Git 仓库不显示
- [ ] **PROJ-11**: 用户可通过"打开文件夹"按钮在 Windows 文件资源管理器中打开项目目录

### UI — UI 优化

- [ ] **UI-09**: 模态窗根据窗口大小自适应，窗口过小时模态窗内容可滚动显示，不会被截断
- [ ] **UI-10**: 全局指令/项目指令切换改为按钮样式，与"打开文件夹"按钮在同一行显示

### PRE — 预设指令系统

- [ ] **PRE-01**: 添加指令模态窗包含双下拉框（先选大分类，再选具体命令），用于选择预设指令
- [ ] **PRE-02**: 默认卡片仅保留 git pull 和 open claude 两个，移除其他默认指令卡片
- [ ] **PRE-03**: 预设命令库涵盖 python、pip、git、rust/cargo、npm/node 常用命令
- [ ] **PRE-04**: 用户通过预设添加指令时，可选择添加为全局指令或当前项目指令

## Future Requirements

Deferred to future milestones.

| ID | Description | Reason |
|----|-------------|--------|
| WIN-04 | Windows Snap Layout 支持 | 无边框窗口无法触发 Snap，需额外实现 |
| PRE-05 | 从项目 package.json/scripts 自动导入指令 | 需要更复杂的解析逻辑 |
| PROJ-12 | 文件夹大小计算异步进度条 | 当前方案用排除目录优化，进度条是锦上添花 |

## Out of Scope

| Feature | Reason |
|---------|--------|
| macOS / Linux 无边框适配 | 项目仅面向 Windows |
| 内嵌终端 | 彻底改变产品性质，复杂度极高 |
| 自动更新 | 个人工具，手动更新即可 |
| 插件系统 | 自定义指令 + 预设已满足扩展需求 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (pending roadmap creation) | | |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 ⚠️

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 after initial definition*
