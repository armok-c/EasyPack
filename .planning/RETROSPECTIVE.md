# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — 体验增强与预设指令

**Shipped:** 2026-04-26
**Phases:** 5 (6-10) | **Plans:** 11 | **Timeline:** 11 days

### What Was Built
- raw_arg 命令执行修复，支持含空格/中文路径
- 无边框窗口 + 自定义 TitleBar（拖拽、窗口控制、阴影）
- Rust 后端项目信息（图标扫描、文件夹大小、Git 分支）+ 模态窗自适应滚动 + 自定义图标导入
- Toggle Group 按钮行 + 打开文件夹按钮
- 预设指令系统（4 分类 25 命令，双 Select 选择器，全局/项目 scope 选择）

### What Worked
- TDD 模式在 Phase 7 (TitleBar) 和 Phase 8 (Dialog) 表现出色，8-9 个测试零回归
- raw_arg 修复精准命中根因，13 分钟完成
- Phase 8 拆分为 5 个独立 plan，并行依赖清晰，每个 plan 8-12 分钟完成
- auto_advance 模式减少了人工验证阻塞

### What Was Inefficient
- Phase 8 和 Phase 10 之间有 8 天空白期（2026-04-17 到 2026-04-25），中断后重新加载上下文成本高
- CargoShip 图标在 lucide-react 中不存在，Phase 10 需额外 gap closure plan 修复
- shadcn CLI 将 Select 组件输出到错误路径（`@/` 目录），需手动移动
- CommandDialog.test.tsx 16 个 pre-existing 测试失败未在 v1.1 修复

### Patterns Established
- Sync core + async Tauri command wrapper：Rust 业务逻辑用同步函数，Tauri 命令用 async 包装，测试无需 tokio 运行时
- file: 前缀图标类型约定：简单可靠的图标类型区分方案
- explicit scope + fallback 模式：新参数带默认值回退，保持向后兼容

### Key Lessons
1. lucide-react 图标验证：添加图标前先确认 lucide-react 版本是否导出该图标，避免运行时崩溃
2. shadcn CLI 路径问题：shadcn@latest add 命令有时输出到 `@/` 而非 `src/`，需要验证并手动修正
3. pre-existing 测试失败应尽早修复，避免在后续 phase 的验证中产生干扰噪音
4. 长 gap 后恢复开发时，先运行完整测试套件和 build 确认基线状态

### Cost Observations
- Model mix: 100% sonnet (quality profile)
- Sessions: ~5 (Phase 6-7 连续完成，Phase 8-10 两次 session)
- Notable: Phase 8 五个 plan 平均 8 分钟完成，拆分粒度显著提升效率

---

## Milestone: v2.0 — 能力跃升

**Shipped:** 2026-06-12
**Phases:** 6 (15-20) | **Plans:** 12 | **Timeline:** 30 days

### What Was Built
- 开机自启动 + 自愈机制（tauri-plugin-autostart）
- 版本管理 + GitHub Releases 更新检查
- 多行脚本指令 — 临时 .bat 文件 + CodeMirror 6 编辑器
- VS Code 风格快捷键设置面板
- 悬浮窗折叠/展开胶囊态 + 紧凑布局
- 多配置 Profile 系统 — 双 store 架构 + 导入导出

### What Worked
- Phase 15 和 16 同日完成（开机启动 + 版本管理），独立功能并行推进效率高
- Phase 17 多行脚本 Rust 后端仅 10 分钟完成，tempfile crate 选择正确
- Phase 18 ShortcutAction 统一类型设计为面板提供了干净的数据驱动架构
- Phase 20 双 store 重构只涉及 2 个文件修改，影响范围控制得当

### What Was Inefficient
- Phase 19 悬浮窗改进跨度较长（2026-05-15 到 2026-06-02），中间有中断
- 6 个 debug session 在里程碑期间积累，部分根因已找到但未及时关闭
- 4 个 verification gaps (human_needed) 贯穿多个阶段，拖到里程碑末尾才处理

### Patterns Established
- 双 store 架构模式：mainStore 管理元信息，profileStore 管理用户数据，关注点分离
- ShortcutAction 统一操作类型：将分散的快捷键功能收拢到统一类型系统
- tempfile::Builder + .keep()：Windows 临时文件安全创建模式
- useRef 并发锁模式：替代 useState 避免异步状态竞争

### Key Lessons
1. 独立功能应安排在阶段初期并行开发（Phase 15+16 同日完成）
2. debug session 应在 phase 完成时及时关闭，避免累积
3. 双 store 重构成功的关键是最小化影响范围（只改 2 个核心文件）
4. ref 模式是 React 中处理异步回调闭包问题的可靠方案

### Cost Observations
- Model mix: 100% sonnet (quality profile)
- Sessions: ~6 (Phase 15-16 同 session, Phase 17-18 同 session, Phase 19-20 各一次)
- Notable: 12 个 plan 平均执行时间 10 分钟，GSD 任务拆分粒度对效率贡献显著

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 days | 5 | 从零搭建，建立核心架构 |
| v1.1 | 11 days | 5 | 修复+增强模式，Rust 后端深度集成 |
| v1.2 | 15 days | 4 | 快捷键+托盘+悬浮窗，多窗口架构 |
| v2.0 | 30 days | 6 | 能力跃升，多行脚本+快捷键面板+多配置 |

### Cumulative Quality

| Milestone | Unit Tests | LOC | Files |
|-----------|-----------|-----|-------|
| v1.0 | ~60 | ~3,500 | 166 |
| v1.1 | 95+ (TS) + 17 (Rust) | ~4,500 | ~240 |
| v1.2 | ~150 (TS) + 17 (Rust) | ~9,300 | ~240 |
| v2.0 | 168+ (TS) + 23+ (Rust) | ~12,100 | ~240 |

### Top Lessons (Verified Across Milestones)

1. TDD 在 UI 组件中显著减少回归（TitleBar 8 tests, Dialog 9 tests, Icons 9 tests）
2. Rust 后端测试应避免依赖 Tauri 运行时——sync core + async wrapper 模式
3. 每次 phase 完成后立即提交原子 commit，保持 git 历史清晰
4. 独立功能应安排在阶段初期并行开发，最大化吞吐
5. 双 store / 分层架构重构成功的关键是最小化影响范围（改核心文件少、边界清晰）
