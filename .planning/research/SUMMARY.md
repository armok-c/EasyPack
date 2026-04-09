# Project Research Summary

**Project:** EasyPack
**Domain:** Tauri 2.x Windows 桌面项目快捷指令启动器
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

EasyPack 是一个面向 Windows 个人开发者的项目快捷指令启动器，核心交互是"选中项目 -> 点击卡片 -> 在系统终端执行命令"。这类工具在生态中存在明显空白：PowerToys Run 专注通用搜索，DevToys 是开发者工具箱，而市面上没有将"项目感知"与"自定义命令卡片"结合的产品。研究一致推荐使用 Tauri 2.x + React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui 的技术栈，所有组件间兼容性已经过验证。

关键架构决策是在 Rust 后端使用 `std::process::Command` 在外部终端执行命令（而非 Tauri Shell Plugin 的 JS API），这既满足了"在可见终端窗口中执行"的需求，也规避了 Shell Plugin 的 CVE-2025-31477 安全风险和复杂的 scope 配置。数据持久化使用 `tauri-plugin-store` 配合 `autoSave` 参数，适合本项目小数据量、低频写入的特点。

主要风险集中在 Tauri 2 的权限/能力（Capabilities）模型配置和 Windows 路径处理。前者是社区公认的 Tauri 2 学习曲线最高点，配置遗漏会导致运行时权限错误且编译期不报错；后者在路径包含空格或中文时极易出错。两者都需要在项目初期建立正确的模式并持续验证。

## Key Findings

### Recommended Stack

研究推荐经过验证的稳定版本组合，避免使用 2026.3 刚发布的 Vite 8 和 TypeScript 6.0（生态工具链尚未全面验证）。完整安装步骤已在 STACK.md 中给出。

**Core technologies:**
- **Tauri 2.10.x**: 桌面应用框架（Rust 后端 + Web 前端） -- 安装包比 Electron 小 96%，本项目只需 Shell 命令执行 + 本地数据持久化，能力边界完全覆盖
- **React 19.x**: 前端 UI 框架 -- shadcn/ui 原生支持，生态最成熟，组件化模型适合侧边栏 + 卡片网格的 UI 结构
- **TypeScript 5.7.x**: 类型系统 -- 经过充分验证，与所有推荐库完全兼容；TS 6.0 生态尚未稳定
- **Vite 6.x**: 前端构建工具 -- 经过一年验证，与 Tauri、React 19、Tailwind CSS v4 全面兼容无坑
- **Tailwind CSS 4.x**: 原子化 CSS 框架 -- Oxide 引擎构建速度快 5x，CSS-first 配置零开箱即用，shadcn/ui 已官方支持
- **shadcn/ui (latest)**: 预构建 UI 组件库 -- 源码直接复制到项目，完全可控，提供 Button、Dialog、Scroll Area 等本项目所需全部组件
- **Rust 1.77.2+**: Tauri 后端语言 -- Shell Plugin 最低要求，推荐使用最新稳定版

### Expected Features

EasyPack 的竞品分析表明，市场上不存在"项目感知 + 自定义命令卡片 + 外部终端执行"三合一的工具。核心价值是填补这一空白。

**Must have (table stakes):**
- 项目列表侧边栏（添加/删除本地项目路径） -- 核心身份
- 一键命令执行（在系统终端打开并运行） -- 即 THE product
- 全局默认指令（build, start, git pull, git push, claude） -- 首次使用即有价值
- 自定义指令创建（name + shell command string） -- 无此功能则工具是玩具
- 按项目覆盖指令集（全局继承 + 项目专属覆盖） -- 不同项目不同构建工具
- 本地 JSON 持久化 -- 重启不丢数据
- 现代圆角卡片 UI -- 视觉身份

**Should have (competitive):**
- 深色/浅色主题 -- 开发者工具默认期望
- 键盘导航 -- 强用户需求
- 命令执行历史 -- 帮助回忆"上次跑了什么"
- 命令分组/分类 -- 10+ 指令时的组织需求
- 拖拽排序 -- 个性化排列

**Defer (v2+):**
- 从 package.json 快速导入 -- 高价值但高复杂度
- 导入/导出配置 -- 跨机器共享
- 多终端配置支持 -- PowerShell / WSL / Git Bash
- 全局热键呼出 -- PowerToys Run 式快捷访问
- 批量执行 -- 跨项目运行"git pull"

### Architecture Approach

EasyPack 采用经典 Tauri 2.x 分层架构：Rust 后端负责系统级操作（Shell 命令执行、路径验证），React 前端负责 UI 渲染和状态管理，通过 Tauri 的 `invoke` 命令系统桥接通信。数据持久化由前端直接通过 `tauri-plugin-store` 读写 JSON 文件，不需要经过 Rust 后端中转。

**Major components:**
1. **Rust Command Handlers** -- 路径验证、命令构建、通过 `std::process::Command` 在外部终端执行
2. **前端 State Layer** -- 管理项目列表、指令列表、选中项目等响应式状态
3. **Store Plugin 持久化层** -- JSON 文件读写，autoSave 100ms 防抖
4. **UI 组件层** -- Sidebar（项目列表）、CommandGrid（卡片网格）、CommandCard（单个卡片）、Dialog（添加/编辑弹窗）
5. **Capabilities 安全层** -- 声明式权限配置，最小权限原则

### Critical Pitfalls

1. **Shell 命令执行方式选错** -- 不要用 Shell Plugin 的 JS API，应在 Rust 后端用 `std::process::Command` 调用 `cmd.exe /C start cmd.exe /K` 在新终端窗口执行；Shell Plugin 曾有 CVE-2025-31477 RCE 漏洞
2. **Capabilities 权限配置遗漏** -- Tauri 2 的三层安全模型（Permissions + Scopes + Capabilities）是社区公认最令人困惑的部分；配置遗漏导致运行时权限错误，编译期不报错
3. **Windows 路径处理错误** -- 空格路径缺少引号包裹、中文路径编码、`PathBuf` 斜杠不一致、canonicalize 的 `\\?\` 前缀
4. **数据持久化不设置 autoSave** -- 强制关闭应用会丢失数据；Store Plugin 默认只在优雅退出时保存
5. **async 命令中使用借用类型或 std::sync::Mutex** -- 导致编译失败或死锁；应使用 owned 类型 + `tokio::sync::Mutex`

## Implications for Roadmap

基于研究发现的依赖关系和风险分布，建议以下阶段结构：

### Phase 1: 项目脚手架与核心架构
**Rationale:** 技术栈安装、权限配置、命令执行方式是所有后续功能的基础。6 个关键 Pitfall 中有 4 个在 Phase 1 就需要预防。
**Delivers:** 可运行的 Tauri 应用骨架，点击按钮能在系统终端执行一条硬编码命令
**Addresses:** 项目初始化、全局默认指令（硬编码版）
**Avoids:** Shell 执行方式选错（Pitfall 1）、Capabilities 配置遗漏（Pitfall 2）、async 借用类型（Pitfall 5）、命令注册遗漏（Pitfall 6）
**Stack:** Tauri 2.10.x + React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui 初始化

### Phase 2: 项目管理与数据持久化
**Rationale:** 项目列表是产品核心身份，持久化是基本可靠性要求。路径处理在此阶段集中处理。
**Delivers:** 侧边栏可添加/删除本地项目，项目和指令数据持久化保存，重启不丢失
**Addresses:** 项目列表侧边栏、本地 JSON 持久化、自定义指令 CRUD
**Avoids:** Windows 路径处理错误（Pitfall 3）、数据持久化策略选错（Pitfall 4）
**Stack:** tauri-plugin-store（autoSave）、tauri-plugin-dialog（文件夹选择器）

### Phase 3: 指令卡片 UI 与命令执行集成
**Rationale:** UI 组件层依赖状态管理层和命令执行系统的就绪。至此核心循环"选中项目 -> 点击卡片 -> 执行命令"完整闭环。
**Delivers:** 卡片式指令网格，全局默认指令 + 按项目覆盖指令集，完整的一键执行体验
**Addresses:** 现代圆角卡片 UI、全局默认指令、按项目覆盖指令、一键命令执行
**Stack:** shadcn/ui 组件（Button, Dialog, Scroll Area, Tooltip）、lucide-react 图标

### Phase 4: 体验增强
**Rationale:** 核心功能闭环后，添加开发者期望的体验优化。这些功能独立性强，可按需添加。
**Delivers:** 深色/浅色主题、键盘导航、命令执行历史、命令分组
**Addresses:** 深色/浅色主题、键盘导航、命令执行历史、命令分组/分类
**Stack:** Tailwind CSS dark 变体、React focus management

### Phase Ordering Rationale

- Phase 1 必须先于所有其他阶段：安装了错误的依赖（如 Shell Plugin 的 JS API 代替 Rust Command）会导致后续大规模返工
- Phase 2 和 Phase 3 有部分并行可能：持久化层和 UI 组件可以独立开发，但集成时需要串行
- Phase 4 完全独立：体验增强功能互不依赖，可按优先级逐个添加
- 路径验证放在 Phase 2 而非 Phase 3：项目添加时就应验证路径，不应延迟到命令执行时

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Shell 命令执行的具体实现（`cmd.exe` vs `wt.exe` 检测逻辑、`/K` vs `/C` 参数组合）需要在编码时验证；Capabilities 完整配置需对照 Tauri 文档逐项确认
- **Phase 2:** `tauri-plugin-store` 的 `autoSave` 行为在强制关闭场景下的实际表现需要测试验证；Store Plugin 的 `LazyStore` API 是否与文档描述一致需确认

Phases with standard patterns (skip research-phase):
- **Phase 3:** shadcn/ui 组件使用、Tailwind CSS 卡片布局是标准模式，文档充分
- **Phase 4:** 深色主题、键盘导航是 React 应用的常见模式，无需专门研究

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 所有推荐技术均有官方文档和版本兼容性验证，多个来源交叉确认 |
| Features | HIGH | 竞品分析覆盖 6 个同类工具，MVP 定义与 PROJECT.md 需求完全对齐，优先级矩阵清晰 |
| Architecture | HIGH | Tauri 2.x 官方架构文档详尽，组件边界和数据流设计有官方最佳实践支撑 |
| Pitfalls | HIGH | 6 个关键 Pitfall 均有官方文档或社区 issue 验证，包含 CVE 编号和具体代码示例 |

**Overall confidence:** HIGH

### Gaps to Address

- **Shell 命令执行细节：** `cmd.exe` 启动新终端窗口的具体参数组合（`/C start cmd.exe /K` vs `cmd.exe /K`）需要在实际 Windows 环境中测试验证，特别是 Windows Terminal 检测逻辑
- **Store Plugin 数据迁移：** 如果后续从 `tauri-plugin-store` 迁移到自定义 Rust 持久化方案，迁移策略未研究
- **生产构建验证：** Pitfalls 中提到的 release 模式下 capabilities 是否生效、`#![windows_subsystem = "windows"]` 配置需要在首次构建时验证
- **应用签名和分发：** Windows 应用的代码签名、MSI 安装包配置未在本次研究中覆盖，属于发布阶段的前置工作

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Official Docs](https://v2.tauri.app/) -- 架构、插件、权限、安全
- [Tauri Shell Plugin](https://v2.tauri.app/plugin/shell/) -- Shell 命令执行 API
- [Tauri Store Plugin](https://v2.tauri.app/plugin/store/) -- 持久化存储 API
- [Tailwind CSS v4 Blog](https://tailwindcss.com/blog/tailwindcss-v4) -- v4 特性与兼容性
- [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4) -- 组件库兼容性
- [React Versions](https://react.dev/versions) -- 版本信息
- [CVE-2025-31477](https://www.sentinelone.com/vulnerability-database/cve-2025-31477/) -- Shell Plugin 安全漏洞

### Secondary (MEDIUM confidence)
- [tauri-ui by agmmnn](https://github.com/agmmnn/tauri-ui) -- Tauri + shadcn/ui 脚手架
- [Tauri 2.0 Learning Curve - Reddit](https://www.reddit.com/r/tauri/comments/1h4nee8/tauri_20_is_a_nightmare_to_learn/) -- Capabilities 配置痛点
- [PowerToys Command Palette](https://learn.microsoft.com/en-us/windows/powertoys/command-palette/overview) -- 竞品分析
- [DevToys Official Site](https://devtoys.app/) -- 竞品分析
- [Evil Martians: Tauri Sidecar](https://evilmartians.com/chronicles/making-desktop-apps-with-revved-up-potential-rust-tauri-sidecar) -- 外部进程执行模式

### Tertiary (LOW confidence)
- [Tauri v2 + React 19 Real-World Example](https://dev.to/purpledoubled/how-i-built-a-desktop-ai-app-with-tauri-v2-react-19-in-2026-1g47) -- 社区案例参考

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
