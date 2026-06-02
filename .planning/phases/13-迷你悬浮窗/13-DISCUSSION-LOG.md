# Phase 13: 迷你悬浮窗 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 13-迷你悬浮窗
**Areas discussed:** 悬浮窗内容范围, 悬浮窗外观与布局, 打开入口位置, 悬浮窗行为细节, 悬浮窗窗口装饰, 指令按钮交互反馈, 启动行为

---

## 悬浮窗内容范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全部指令 (推荐) | 显示当前项目的所有指令（全局 + 项目级覆盖合并后的完整列表） | ✓ |
| 仅快捷键指令 | 只显示用户绑定了快捷键的指令 | |
| 仅最近使用 | 显示最近执行的 8 条指令 | |
| 你来决定 | — | |

**User's choice:** 全部指令
**Notes:** 与主窗口看到的完全一致

| Option | Description | Selected |
|--------|-------------|----------|
| 自动高度 + 滚动 (推荐) | 窗口高度随指令数量自动增长，设最大高度（如 600px），超过后出现滚动条 | ✓ |
| 固定大小 + 滚动 | 固定窗口大小（如 300x400），内容区域始终可滚动 | |
| 你来决定 | — | |

**User's choice:** 自动高度 + 滚动

| Option | Description | Selected |
|--------|-------------|----------|
| 显示项目名 (推荐) | 悬浮窗顶部显示当前项目名，主窗口切换项目时实时更新 | ✓ |
| 不显示 | 不显示项目名，只显示指令按钮 | |
| 你来决定 | — | |

**User's choice:** 显示项目名

---

## 悬浮窗外观与布局

| Option | Description | Selected |
|--------|-------------|----------|
| 竖向列表 (推荐) | 每个指令占一整行，图标 + 指令名横向排列 | ✓ |
| 紧凑网格 | 指令以网格形式排列（如 2-3 列） | |
| 横向排列 | 指令横向排列，窗口宽度随指令数自动增长 | |
| 你来决定 | — | |

**User's choice:** 竖向列表

| Option | Description | Selected |
|--------|-------------|----------|
| 窄 (280px) (推荐) | 固定 280px 宽度，刚好放下图标 + 指令名 | ✓ |
| 中 (360px) | 固定 360px，类似手机宽度 | |
| 可调整宽度 | 用户可拖拽边缘调整宽度，并记住大小 | |

**User's choice:** 窄 280px

| Option | Description | Selected |
|--------|-------------|----------|
| 可拖拽移动 (推荐) | 用户可以拖拽悬浮窗在屏幕上自由移动 | ✓ |
| 固定位置 | 位置固定在屏幕某角落，不可拖拽 | |

**User's choice:** 可拖拽移动

---

## 打开入口位置

| Option | Description | Selected |
|--------|-------------|----------|
| 齿轮左侧加按钮 (推荐) | TitleBar 齿轮按钮左侧加一个悬浮窗图标按钮，点击 toggle | ✓ |
| 仅托盘菜单打开 | 不加 TitleBar 按钮，仅从托盘菜单打开 | |
| 你来决定 | — | |

**User's choice:** TitleBar 齿轮左侧加按钮

| Option | Description | Selected |
|--------|-------------|----------|
| 窗口操作区域内 (推荐) | 在"显示/隐藏窗口"项下面加一个"打开/关闭悬浮窗"选项 | ✓ |
| 指令区域上方 | 在最近指令列表上方加悬浮窗选项 | |

**User's choice:** 窗口操作区域内

---

## 悬浮窗行为细节

| Option | Description | Selected |
|--------|-------------|----------|
| 记住位置 (推荐) | 悬浮窗记住上次关闭时的位置 | |
| 不记住位置 | 每次打开默认在屏幕右上角 | ✓ |

**User's choice:** 不记住位置（FLOAT-09 为未来需求）

| Option | Description | Selected |
|--------|-------------|----------|
| 独立存活 (推荐) | 主窗口隐藏到托盘时悬浮窗保持显示，主窗口退出时悬浮窗一起关闭 | ✓ |
| 跟随主窗口 | 主窗口隐藏到托盘时悬浮窗也一起隐藏 | |

**User's choice:** 独立存活

| Option | Description | Selected |
|--------|-------------|----------|
| 空状态提示 (推荐) | 显示"请先在主窗口选择一个项目"，指令按钮全部禁用灰显 | ✓ |
| 禁止打开 | 没有项目时 TitleBar 按钮和托盘选项禁用 | |

**User's choice:** 空状态提示

| Option | Description | Selected |
|--------|-------------|----------|
| 右上角 (推荐) | 每次打开默认出现在屏幕右上角 | ✓ |
| 主窗口右侧 | 出现在主窗口右侧聚贴 | |
| 你来决定 | — | |

**User's choice:** 右上角

| Option | Description | Selected |
|--------|-------------|----------|
| 显示/隐藏切换 (推荐) | 点击 TitleBar 按钮或托盘选项时 toggle 显示/隐藏 | ✓ |
| 仅打开 | 点击只负责打开，关闭由悬浮窗自身处理 | |

**User's choice:** 显示/隐藏切换

---

## 悬浮窗窗口装饰

| Option | Description | Selected |
|--------|-------------|----------|
| 无边框 + 窄拖拽区 (推荐) | 和主窗口一样无边框，顶部窄拖拽区域 + 右侧小关闭按钮 | ✓ |
| 系统边框 | 有系统边框（标题栏 + 关闭按钮） | |
| 你来决定 | — | |

**User's choice:** 无边框 + 窄拖拽区

---

## 指令按钮交互反馈

| Option | Description | Selected |
|--------|-------------|----------|
| 显示快捷键徽章 (推荐) | 悬浮窗指令按钮显示已绑定的快捷键 | |
| 不显示 | 悬浮窗空间紧凑，不显示快捷键 | ✓ |

**User's choice:** 不显示

| Option | Description | Selected |
|--------|-------------|----------|
| 短暂闪烁反馈 (推荐) | 点击后按钮短暂变色（200ms），确认已触发执行 | ✓ |
| 无反馈 | 点击即执行，无视觉反馈 | |

**User's choice:** 短暂闪烁反馈

---

## 启动行为

| Option | Description | Selected |
|--------|-------------|----------|
| 不自动打开 (推荐) | 应用启动时只有主窗口，悬浮窗必须手动打开 | ✓ |
| 记住上次状态 | 如果上次悬浮窗是打开的则启动时自动打开 | |

**User's choice:** 不自动打开

---

## Claude's Discretion

- 悬浮窗 HTML 入口实现方式（Vite 多页面 vs query param）
- 状态同步机制（Tauri event system vs shared store）
- 悬浮窗窗口创建时机和生命周期
- 悬浮窗内部组件具体实现
- 拖拽区域实现方式
- 关闭按钮样式和位置
- tauri.conf.json 窗口属性配置
- Vite 多页面构建配置
- capabilities 权限追加

## Deferred Ideas

None — discussion stayed within phase scope
