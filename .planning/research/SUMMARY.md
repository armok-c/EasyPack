# Project Research Summary

**Project:** EasyPack v1.1
**Domain:** Windows desktop project launcher -- Tauri 2 + React 19
**Researched:** 2026-04-15
**Confidence:** HIGH

## Executive Summary

EasyPack v1.1 是在已有 MVP 基础上进行的体验增强迭代。核心目标是修复阻断所有用户的关键 Bug（命令执行 0x80070002 错误），并在此基础上提升窗口外观、添加智能特性（图标自动识别、项目信息展示）和效率工具（预设指令系统）。技术栈保持完全不变（Tauri 2.10 + React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 4 + shadcn/ui），仅新增一个 Rust crate（walkdir 2.5.0）用于文件夹大小计算。

研究得出的关键结论有三点。第一，命令执行 Bug 的根因已明确：Rust 的 `.args()` 在 Windows 上按 MSVCRT 规则自动转义参数，但 `cmd.exe` 使用自己的解析器，两套规则冲突导致路径引号被二次转义。修复方案是使用 `.current_dir()` 替代 `cd /d` 命令字符串拼接，彻底绕过引号转义问题（PITFALLS.md Pitfall 1，Rust 官方 issue #29494）。第二，无边框窗口是 v1.1 最大的布局变更（App.tsx 从单层 flex-row 变为 TitleBar + flex-row 双层结构），影响所有后续 UI 工作的开发基础，必须在其他 UI 特性之前完成（ARCHITECTURE.md Feature 2）。第三，预设指令系统是代码量最大的新特性，涉及 types、presets 数据、新组件和 MainArea 交互的多处联动，应放在最后以避免与布局变更冲突（FEATURES.md CMD-11）。

关键风险集中在 Windows 上 `decorations: false` 的已知行为（丢失 resize 能力和阴影，需 `shadow: true` 配合并验证四边拖拽行为）和 Rust 参数转义问题（已有明确解决方案：`.current_dir()` 或 `raw_arg()`）。两者均有详细的预防策略和社区验证。

## Key Findings

### Recommended Stack

v1.1 不改变任何现有技术栈。唯一的新增依赖是 Rust 端的 `walkdir` crate (v2.5.0)，用于健壮地递归遍历目录以计算文件夹大小。前端不需要新增任何 npm 包 -- 预设系统的双下拉框使用 shadcn/ui 的 Select 组件（通过 `npx shadcn@latest add select` 脚手架生成，底层依赖 radix-ui 已在项目中）。Git 分支检测通过直接读取 `.git/HEAD` 文件实现，零依赖、零进程创建开销。

**新增内容:**
- `walkdir` 2.5.0: 目录递归遍历 -- 处理符号链接和权限错误，393M+ 下载量，BurntSushi 维护
- `src/components/ui/select.tsx`: shadcn Select 组件 -- 脚手架生成，非新 npm 依赖
- `src/components/TitleBar.tsx`: 自定义标题栏 -- 纯 React 组件，使用已有 `@tauri-apps/api`
- Tauri 配置变更: `decorations: false`, `shadow: true`, 4 个窗口权限

### Expected Features

**Must have (table stakes):**
- CMD-09: 修复命令执行 0x80070002 错误 -- 核心功能完全阻断，必须首先修复，复杂度 LOW
- UI-08: 无边框窗口 + 自定义标题栏 -- 现代桌面应用标配，影响整体视觉定位，复杂度 MEDIUM
- UI-09: 模态窗自适应大小 -- 小窗口下内容截断，基础可用性问题，复杂度 LOW

**Should have (competitive):**
- CMD-11: 预设指令系统（双下拉框）-- 降低配置成本，差异化竞争力，复杂度 HIGH
- PROJ-07: 项目图标自动识别 -- 减少手动设置，提升智能感，复杂度 MEDIUM
- CMD-10: 指令切换按钮化 + 打开文件夹 -- 提升操作效率和可用性，复杂度 LOW

**Defer (v2+):**
- PROJ-08: 文件夹大小 + Git 分支显示 -- 锦上添花，非核心路径，可考虑降级为可选
- 实时文件监听、Windows Snap Layouts、git2 原生集成 -- 明确排除的特性（见 FEATURES.md Anti-Features）

### Architecture Approach

v1.1 延续 v1.0 的分层架构（React 前端 + Rust 后端 + invoke 桥接），新增一个 Rust 命令模块 `commands/project.rs` 承载所有项目相关的系统操作。布局结构从单层 flex-row 变为 TitleBar + flex-row 的双层结构。新增 `useProjectInfo` hook 封装 Rust 数据获取逻辑，新增 `PresetSelector` 组件封装预设选择 UI。核心修复（CMD-09）使用 `.current_dir()` 替代 `cd /d` 字符串拼接，这是一个架构级决策 -- 以后所有需要指定工作目录的命令都应遵循此模式。

**主要组件:**
1. `commands/project.rs` (新建) -- detect_project_info, get_folder_size, get_git_branch, open_folder
2. `TitleBar.tsx` (新建) -- 自定义窗口控制（拖拽、最小化、最大化、关闭）
3. `PresetSelector.tsx` (新建) -- 双下拉框预设指令选择器
4. `useProjectInfo.ts` (新建) -- 项目元数据获取 hook
5. `shell.rs` (修改) -- 使用 `.current_dir()` 替代 `cd /d` 字符串拼接

### Critical Pitfalls

1. **Rust `.args()` 与 cmd.exe 转义冲突 (0x80070002)** -- 使用 `.current_dir()` 设置进程工作目录，完全避免在命令字符串中嵌入路径。这是 Rust 在 Windows 上的已知长期问题（issue #29494，2015 年至今仍 open）
2. **无边框窗口丢失 resize 和阴影** -- 必须设置 `shadow: true`，并验证四边和四角的拖拽调整大小是否正常工作。Tauri 2 在 Windows 上提供了原生 resize 支持，但需在 Windows 10 和 11 上实际验证
3. **标题栏按钮被 data-tauri-drag-region 拦截** -- 按钮元素不得设置 `data-tauri-drag-region` 属性，必要时在按钮上调用 `e.stopPropagation()`
4. **文件夹大小计算阻塞 UI** -- 必须使用 `spawn_blocking` 在独立线程执行，排除 node_modules/.git/target 等大型目录，结果缓存避免重复计算
5. **预设指令 ID 迁移** -- 从索引 ID (`preset-0`) 改为语义化 ID (`preset-git-pull`)，需要数据迁移逻辑避免现有项目配置错乱

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Fix Command Execution
**Rationale:** 核心功能完全阻断，所有新特性的测试和验证都依赖命令能正常执行。这是零依赖的独立修复，风险最低。
**Delivers:** 用户能正常点击指令卡片在终端执行命令
**Addresses:** CMD-09 (执行修复)
**Avoids:** Pitfall 1 (raw_arg 转义冲突) -- 使用 `.current_dir()` 方案完全规避
**Research flag:** 无需额外研究 -- 根因明确（Rust issue #29494），修复方案已验证

### Phase 2: Frameless Window + Custom Title Bar
**Rationale:** 布局结构变更（App.tsx 从单层变双层）影响所有后续 UI 开发。必须在其他 UI 特性之前完成，避免反复调整布局。
**Delivers:** 现代化的无边框窗口 + 自定义标题栏（拖拽、最小化、最大化、关闭）
**Uses:** Tauri `decorations: false`, `shadow: true`, `data-tauri-drag-region`, `getCurrentWindow()` API
**Implements:** TitleBar.tsx 组件, capabilities 权限更新, tauri.conf.json 配置变更
**Avoids:** Pitfall 2 (丢失 resize/阴影), Pitfall 4 (按钮被拖拽拦截)
**Research flag:** 需要实际测试 resize 行为 -- Tauri 2 在 Windows 上的 frameless resize 行为文档不够详细，需在 Windows 10 和 11 上验证

### Phase 3: Rust Backend Expansion + Quick UI Fixes
**Rationale:** 新增的 4 个 Rust 命令（detect_project_info, get_folder_size, get_git_branch, open_folder）彼此独立，可并行开发。模态窗自适应是纯 CSS 修复，风险极低。
**Delivers:** 项目信息检测能力（类型、大小、Git 分支）+ 文件夹打开功能 + 模态窗自适应
**Uses:** walkdir crate, std::fs::metadata, std::fs::read_to_string (.git/HEAD 解析)
**Implements:** commands/project.rs 模块, useProjectInfo hook
**Addresses:** UI-09 (模态窗自适应), PROJ-07 (图标识别后端), PROJ-08 (项目信息后端), CMD-10 partial (打开文件夹后端)
**Avoids:** Pitfall 3 (文件夹计算阻塞 UI) -- 使用 spawn_blocking, Pitfall 5 (Git 非 Git 目录报错) -- 直接读 .git/HEAD 优雅降级
**Research flag:** 标准模式 -- walkdir 和文件检测都是成熟的 Rust 模式

### Phase 4: Frontend UI Integration
**Rationale:** 按钮化切换、打开文件夹按钮、图标识别 UI、项目信息展示都修改 MainArea.tsx，必须顺序执行避免冲突。
**Delivers:** 按钮化指令切换 + 打开文件夹按钮 + 图标自动识别 UI + 项目信息栏
**Implements:** MainArea.tsx 按钮化改造, ProjectSettingsDialog 图标检测展示, Sidebar 标题去重
**Addresses:** CMD-10 (按钮化切换 + 打开文件夹), PROJ-07 (图标识别前端), PROJ-08 (项目信息前端)
**Avoids:** Pitfall 7 (图标检测报错) -- 使用 exists() 检查, Pitfall 11 (串行加载) -- 分层渲染 + 异步加载
**Research flag:** 标准模式 -- 纯 React UI 集成，模式明确

### Phase 5: Preset Command System
**Rationale:** 代码量最大的新特性（types、presets 数据、新组件、MainArea 交互联动），依赖稳定的布局和对话框架构，放在最后避免与其他 UI 变更冲突。
**Delivers:** 分类的预设指令库（Git/NPM/Python/pip/Rust）+ 双下拉框选择器
**Implements:** PresetSelector.tsx, presets.ts 重写, types.ts 扩展, MainArea 集成
**Addresses:** CMD-11 (预设指令系统)
**Avoids:** Pitfall 8 (命令不准确), Pitfall 12 (ID 迁移) -- 语义化 ID + 迁移逻辑
**Research flag:** 需要设计决策 -- 是否实现 package.json/Cargo.toml 动态检测来过滤预设（增加复杂度但提升准确性）

### Phase Ordering Rationale

- Phase 1 必须最前：核心功能阻断，所有后续测试依赖它
- Phase 2 必须在 UI 特性之前：布局变更影响所有 UI 代码的基础结构
- Phase 3 和 4 可部分重叠：Rust 后端扩展不依赖 UI 变更，但前端集成必须等 Rust 命令就绪
- Phase 5 必须最后：涉及最多文件的联动修改，依赖稳定的布局和对话框架构

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** 无边框窗口在 Windows 10 vs 11 上的 resize 行为差异 -- 需实际测试验证，文档不够详细。Issue #7900 请求的 `data-tauri-drag-resize-region` 仍未实现
- **Phase 5:** 预设指令是否需要 package.json/Cargo.toml 动态检测 -- 需在计划阶段做产品决策

Phases with standard patterns (skip research-phase):
- **Phase 1:** 根因明确（Rust issue #29494），修复方案（`.current_dir()`）已验证
- **Phase 3:** walkdir 和文件系统检测是成熟 Rust 模式
- **Phase 4:** 纯 React UI 集成，模式清晰

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 无新技术引入，唯一新增 walkdir 是成熟 crate（393M+ 下载），所有来源为官方文档和 crates.io |
| Features | HIGH | 7 个特性均有详细实现方案和依赖分析，来源为 Tauri 官方文档、Rust issue、社区案例 |
| Architecture | HIGH | 在现有架构上扩展，变更边界清晰，新模块模式与现有代码一致。依赖图完整 |
| Pitfalls | HIGH | 5 个关键陷阱均有根因分析、预防代码和检测方法，来源为 Rust/Tauri 官方 issue |

**Overall confidence:** HIGH

### Gaps to Address

- **无边框窗口 resize 行为:** Tauri 2 在 `decorations: false` 下的 Windows resize 行为文档不够明确，Issue #7900 请求的 `data-tauri-drag-resize-region` 仍未实现。需在 Phase 2 开始时做原型验证，确认是否需要手动实现 CSS resize 边框
- **预设数据迁移:** 现有项目使用 `preset-0` 到 `preset-3` 作为 ID，v1.1 改变默认预设后需要数据迁移逻辑，迁移方案的完整性需要在 Phase 5 计划阶段仔细设计
- **Windows 10 兼容性:** `shadow: true` 在 Windows 10 上的行为可能与 Windows 11 不同，Issue #8632 报告了阴影渲染问题，需在 Phase 2 测试矩阵中覆盖

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- 无边框窗口、data-tauri-drag-region、权限配置
- [Tauri v2 Configuration Reference](https://v2.tauri.app/reference/config/) -- 窗口配置选项
- [rust-lang/rust#29494](https://github.com/rust-lang/rust/issues/29494) -- Windows 参数转义问题根因（2015 年至今 open）
- [walkdir crate v2.5.0](https://crates.io/crates/walkdir) -- 393M+ 下载，BurntSushi 维护
- [shadcn/ui Select Component](https://ui.shadcn.com/docs/components/select) -- 双下拉框实现

### Secondary (MEDIUM confidence)
- [Tauri Issue #8632](https://github.com/tauri-apps/tauri/issues/8632) -- 透明窗口 + 阴影渲染 bug
- [Tauri Issue #11605](https://github.com/tauri-apps/tauri/issues/11605) -- 未聚焦窗口拖拽 bug
- [Microsoft Terminal Issue #4228](https://github.com/microsoft/terminal/issues/4228) -- wt.exe 0x80070002 错误
- [Stack Overflow: cmd /C with spaces in Rust](https://stackoverflow.com/questions/44757893/cmd-c-doesnt-work-in-rust-when-command-includes-spaces) -- Rust 参数转义解决方案
- [SS64: CMD escape characters](https://ss64.com/nt/syntax-esc.html) -- cmd.exe 转义规则参考

### Tertiary (LOW confidence)
- [Tauri Issue #7900](https://github.com/tauri-apps/tauri/issues/7900) -- data-tauri-drag-resize-region 功能请求（未实现）
- [Tauri Issue #14859](https://github.com/tauri-apps/tauri/issues/14859) -- decorations: false + shadow 边框 bug

---
*Research completed: 2026-04-15*
*Ready for roadmap: yes*
