# Requirements: EasyPack

**Defined:** 2026-06-16
**Core Value:** 选中项目 → 一键在终端执行指令，无需手动切换目录和输入命令。

## v2.1 Requirements

### 版本管理 (VER)

- [x] **VER-05**: 打包时 (`npm run tauri build`) 自动更新 `src-tauri/tauri.conf.json` 中的 `version` 字段为当前版本号

### 指令重构 (CMD)

- [x] **CMD-09**: 移除全局指令栏目 — 去掉 MainArea 中全局/项目切换按钮组、`commandMode` 状态、全局指令 CRUD 所有相关 UI 和逻辑，`CommandItem.scope` 移除 `"global"` 值
- [x] **CMD-10**: 项目指令替代全局指令 — 原"项目指令"栏目移至全局指令原位置占满右侧区域，UI 标签从"项目指令"改为"项目环境"，数据模型保留但仅支持项目级指令

### 项目环境 (ENV)

- [x] **ENV-01**: 环境标签页 — 项目环境内页顶部横向标签页切换环境，标签页超出宽度可左右滚动
- [x] **ENV-02**: 管理环境 — 点击"管理环境"按钮打开模态窗，顶部新增按钮，下方列表四列（名称/创建时间/修改时间/操作），操作包含重命名和删除按钮，删除有二次确认弹窗
- [x] **ENV-03**: 添加文件 — 点击"添加"按钮向当前标签页环境添加需要管理的配置文件
- [x] **ENV-04**: 删除文件 — 点击"删除"按钮可列表多选不需要管理的文件，删除有二次确认弹窗
- [ ] **ENV-05**: 同步差异 — 点击"同步差异"按钮（需勾选当前标签页文件才可点击），弹窗显示全部其他环境可多选，选择后出现 IDE Git 冲突风格对比模态窗（使用 `@git-diff-view/react`）
- [x] **ENV-06**: 文件列表 — 四列（勾选框 / 文件名+后缀 / 修改时间 / 操作），操作列每行有查看按钮
- [x] **ENV-07**: 文件查看编辑 — 查看按钮打开文本模态窗，支持 xml/yml/json/toml 等多种配置文件语法高亮（CodeMirror 6）+ 语法错误检测，右下角保存按钮
- [x] **ENV-08**: 环境切换栏 — 文件列表上方新增一行，包含下拉框（选择目标环境）和启用按钮，点击启用将所选环境的配置文件内容写入项目根目录

## v3.0 Requirements

Deferred to future release.

(None yet)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 内嵌终端 | 彻底改变产品性质，技术复杂度极高 |
| macOS / Linux 支持 | 仅面向 Windows 个人开发环境 |
| 远程项目管理 | 仅本地项目 |
| 多用户/账户系统 | 个人工具，无需用户系统 |
| 自动更新 | 手动更新即可 |
| 插件系统 | 自定义指令已满足扩展需求 |
| 环境变量注入到终端 | 当前里程碑聚焦配置文件管理，环境变量注入延迟到后续版本 |
| 配置文件模板/脚手架 | 超出当前里程碑范围 |
| 实时文件监控同步 | 手动同步差异已满足需求 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VER-05 | Phase 21 | Complete |
| CMD-09 | Phase 22 | Complete |
| CMD-10 | Phase 22 | Complete |
| ENV-01 | Phase 23 | Complete |
| ENV-02 | Phase 23 | Complete |
| ENV-03 | Phase 24 | Complete |
| ENV-04 | Phase 24 | Complete |
| ENV-05 | Phase 25 | Pending |
| ENV-06 | Phase 24 | Complete |
| ENV-07 | Phase 24 | Complete |
| ENV-08 | Phase 23 | Complete |

**Coverage:**
- v2.1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-16*
*Last updated: 2026-06-16 after initial definition*
