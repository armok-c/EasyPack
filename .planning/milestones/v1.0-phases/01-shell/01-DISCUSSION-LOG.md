# Phase 1: 应用脚手架与 Shell 命令核心 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 01-应用脚手架与 Shell 命令核心
**Areas discussed:** 应用窗口与布局, 终端命令执行体验, 文件夹选择器交互, 空状态与首屏

---

## 应用窗口与布局

| Option | Description | Selected |
|--------|-------------|----------|
| 紧凑窗口 (720×480) | 更小巧，不遮挡其他窗口，适合常驻屏幕角落 | ✓ |
| 中等窗口 (900×600) | 常见桌面工具尺寸，类似 VS Code | |
| 宽屏窗口 (1100×650) | 宽屏布局，适合大屏幕 | |

**User's choice:** 紧凑窗口 (720×480)

| Option | Description | Selected |
|--------|-------------|----------|
| 固定宽度 (240px) | 简单稳定 | |
| 可拖拽调整宽度 | 更灵活但复杂 | |
| Claude discretion | 交给实现时决定 | ✓ |

**User's choice:** Claude discretion

| Option | Description | Selected |
|--------|-------------|----------|
| 最小 600×400 | 保持布局可读 | ✓ |
| 最小 480×320 | 更灵活但可能挤压 | |
| 不设最小值 | 自由缩放 | |

**User's choice:** 最小 600×400

| Option | Description | Selected |
|--------|-------------|----------|
| 居中卡片式 | 大圆角卡片居中，为 Phase 3 铺垫 | |
| 上方路径 + 下方按钮 | 传统工具布局 | ✓ |
| Claude discretion | 交给实现时决定 | |

**User's choice:** 上方路径 + 下方按钮

| Option | Description | Selected |
|--------|-------------|----------|
| 每次默认启动 | 简单稳定，Phase 1 不需要持久化窗口状态 | ✓ |
| 记住上次位置 | 更方便但依赖持久化 | |

**User's choice:** 每次默认启动

| Option | Description | Selected |
|--------|-------------|----------|
| 始终可见 | Phase 1 作为占位区域，为 Phase 2 做布局铺垫 | ✓ |
| Phase 1 隐藏 | 等有内容再显示 | |

**User's choice:** 始终可见

---

## 终端命令执行体验

| Option | Description | Selected |
|--------|-------------|----------|
| Windows Terminal（优先） | Win11 默认，支持多标签页，未安装回退 cmd | ✓ |
| cmd.exe | Windows 自带，兼容性最强 | |
| PowerShell | 功能强大但非所有开发者日常使用 | |

**User's choice:** Windows Terminal（优先），回退 cmd

| Option | Description | Selected |
|--------|-------------|----------|
| 新窗口（独立执行） | 每次新窗口，多命令并行互不干扰 | ✓ |
| 新标签页 | 窗口更少，需处理标签页管理 | |

**User's choice:** 新窗口（独立执行）

| Option | Description | Selected |
|--------|-------------|----------|
| /K 保持打开 | 命令后终端保持，用户可查看输出 | ✓ |
| /C 执行完关闭 | 输出一闪而过 | |

**User's choice:** /K 保持打开

| Option | Description | Selected |
|--------|-------------|----------|
| 仅终端弹出（无应用内反馈） | 简单直觉 | |
| 轻量 toast 提示 | 简短提示如"已执行: npm run build"，1-2 秒消失 | ✓ |
| 执行状态追踪 | 需终端回调，复杂度高 | |

**User's choice:** 轻量 toast 提示

| Option | Description | Selected |
|--------|-------------|----------|
| 自动 cd 到项目目录（必须） | 核心体验 | ✓ |
| 作为参数传递 | 需命令本身支持 | |

**User's choice:** 自动 cd 到项目目录

| Option | Description | Selected |
|--------|-------------|----------|
| 单一测试按钮 | 最简单，验证核心链路 | |
| 预设 2-3 个典型命令 | 提前展示最终产品感觉 | |
| 命令输入框 | 灵活但偏离卡片形态 | |

**User's choice:** 预设典型命令

| Option | Description | Selected |
|--------|-------------|----------|
| 打包 + 启动 (2个) | 最常见 Node.js 命令 | |
| 打包 + 启动 + Git Pull (3个) | 覆盖 Git 操作 | |
| 打包 + 启动 + Git Pull + Claude (4个) | 覆盖全部内置默认指令 | ✓ |

**User's choice:** 全部 4 个内置命令

| Option | Description | Selected |
|--------|-------------|----------|
| Claude discretion | 正确的引号和转义处理 | ✓ |
| 展开讨论 | 了解具体策略 | |

**User's choice:** Claude discretion

---

## 文件夹选择器交互

| Option | Description | Selected |
|--------|-------------|----------|
| 显示完整路径 | 信息完整，长路径截断显示 | |
| 仅显示文件夹名 | 简洁，如"EasyPack" | ✓ |

**User's choice:** 仅显示文件夹名

| Option | Description | Selected |
|--------|-------------|----------|
| 侧边栏顶部 | 布局连贯，Phase 2 项目列表在下方 | ✓ |
| 主区域中 | 和命令执行在同一区域 | |
| 标题栏区域 | 更紧凑 | |

**User's choice:** 侧边栏顶部

| Option | Description | Selected |
|--------|-------------|----------|
| 立即选中并可用 | 最快到达核心体验 | ✓ |
| 显示但需确认选中 | 多一步操作 | |

**User's choice:** 立即选中并可用

| Option | Description | Selected |
|--------|-------------|----------|
| 替换当前项目 | Phase 1 只维护一个当前项目 | ✓ |
| 累积保留 | Phase 1 无法展示列表，导致困惑 | |

**User's choice:** 替换当前项目

| Option | Description | Selected |
|--------|-------------|----------|
| 可以取消选中 | 侧边栏有"×"按钮回到空状态 | |
| 只能替换不能取消 | 更简单 | ✓ |

**User's choice:** 只能替换不能取消

---

## 空状态与首屏

| Option | Description | Selected |
|--------|-------------|----------|
| 简约引导（提示 + 图示） | 简洁提示 + 图示引导点击"添加项目" | ✓ |
| 欢迎页面（名称 + 介绍） | 更正式但可能过度 | |
| 极简空状态 | 空白区域 + 一行小字 | |

**User's choice:** 简约引导（提示 + 图示）

| Option | Description | Selected |
|--------|-------------|----------|
| VS Code 风格（深灰 + 高对比） | 开发者最熟悉 | |
| Linear 风格（更深 + 柔和） | 更现代精致 | |
| Raycast 风格（渐变 + 半透明） | 更炫酷 | ✓ |

**User's choice:** Raycast 风格（渐变 + 半透明）

| Option | Description | Selected |
|--------|-------------|----------|
| 按钮 + 提示文字 | 简单明确 | |
| 仅有按钮 | 最简 | |
| 图标 + 文字 + 按钮 | 更丰富 | ✓ |

**User's choice:** 图标 + 文字 + 按钮

---

## Claude's Discretion

- 侧边栏具体宽度（建议 200-260px）
- Windows 路径空格/中文的 Shell 转义
- Toast 组件实现方案
- 渐变背景具体色值

## Deferred Ideas

None — discussion stayed within phase scope
