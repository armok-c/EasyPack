# Phase 12: 系统托盘 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 12-系统托盘
**Areas discussed:** 托盘菜单内容, 关闭与最小化行为, 托盘图标交互, 设置界面位置

---

## 托盘菜单内容

| Option | Description | Selected |
|--------|-------------|----------|
| 全部指令 | 所有指令都出现在托盘右键菜单里。简单直接，但指令多时菜单会很长。 | |
| 收藏指令（新功能） | 用户可以在编辑模式中标记某些指令为"收藏"，仅收藏指令出现在托盘菜单。更干净，但需要额外的收藏机制。 | |
| 最近使用指令 | 显示最近执行的 3-5 个指令。自动推断，无需用户操作。 | ✓ |
| 仅基础菜单（推迟 TRAY-07） | 仅显示"显示/隐藏窗口"和"退出"，不显示任何执行指令。 | |

**User's choice:** 最近使用指令
**Notes:** 最多显示 8 个最近执行指令，指令名加前缀"▸ 执行:"。菜单顶部显示项目名（禁用状态）。空状态时完全隐藏指令区域。

## 关闭与最小化行为

| Option | Description | Selected |
|--------|-------------|----------|
| 最小化→任务栏，关闭→托盘 | 点击最小化按钮正常最小化到任务栏。关闭按钮隐藏到托盘。Discord/Slack 模式。 | ✓ |
| 最小化也→托盘 | 最小化和关闭都隐藏到托盘，不在任务栏显示。 | |

**User's choice:** 最小化→任务栏，关闭→托盘
**Notes:** Alt+F4 也隐藏到托盘（与关闭按钮一致）。唯一退出方式是托盘右键菜单"退出"。

## Alt+F4 行为

| Option | Description | Selected |
|--------|-------------|----------|
| 也隐藏到托盘 | Alt+F4 也隐藏到托盘，与关闭按钮行为一致。防止用户误关退出。 | ✓ |
| 直接退出 | Alt+F4 直接退出应用。给用户一个"真正退出"的键盘快捷方式。 | |

**User's choice:** 也隐藏到托盘

## 退出方式

| Option | Description | Selected |
|--------|-------------|----------|
| 仅托盘菜单"退出" | 托盘右键菜单 "退出" 项是唯一退出方式。简单明确。 | ✓ |
| 托盘 + 设置中都有 | 除了托盘菜单，还在设置中提供"退出应用"按钮。 | |

**User's choice:** 仅托盘菜单"退出"

## 托盘图标交互

### 双击行为

| Option | Description | Selected |
|--------|-------------|----------|
| 无操作 | 双击不做任何事，保持单击的简洁性。避免与单击行为冲突。 | ✓ |
| 同单击，显示窗口 | 双击显示主窗口，单击也显示主窗口。多一种触发方式。 | |

**User's choice:** 无操作

### Tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| 固定"EasyPack" | 固定显示 "EasyPack"。简洁，不随状态变化。 | ✓ |
| 动态显示项目名 | 显示 "EasyPack - my-project"，随当前选中项目变化。 | |

**User's choice:** 固定"EasyPack"

### 单击行为

| Option | Description | Selected |
|--------|-------------|----------|
| 始终显示窗口 | 单击始终显示主窗口。如果已显示则聚焦到前台。简单一致。 | ✓ |
| 切换显示/隐藏 | 单击切换显示/隐藏。如果窗口可见则隐藏，如果隐藏则显示。 | |

**User's choice:** 始终显示窗口
**Notes:** 与 TRAY-03 字面意思（"切换"）不同，用户选择了更直观的"始终显示"。

## 设置界面

### 设置入口

| Option | Description | Selected |
|--------|-------------|----------|
| TitleBar 齿轮按钮 | 在 TitleBar 上添加一个齿轮图标按钮，点击打开设置弹窗。 | ✓ |
| Sidebar 底部 | 在 Sidebar 底部添加设置按钮。 | |
| 融入现有 UI | 不单独做设置入口，将托盘开关放在已有的编辑模式中。 | |

**User's choice:** TitleBar 齿轮按钮

### 设置弹窗结构

| Option | Description | Selected |
|--------|-------------|----------|
| 独立托盘设置弹窗 | 新建一个独立的 SettingsDialog 组件，只有"托盘"相关设置。 | |
| 通用设置弹窗 + 托盘分区 | 新建一个通用 SettingsDialog，用 Tab 或 Section 组织。托盘设置是其中一个分区。 | ✓ |

**User's choice:** 通用设置弹窗 + 托盘分区

### 设置开关项

| Option | Description | Selected |
|--------|-------------|----------|
| 两个开关 | ①"启用系统托盘"（总开关）②"关闭时隐藏到托盘"。第二个依赖第一个。 | ✓ |
| 仅一个开关 | 仅"关闭时隐藏到托盘"。托盘图标始终存在。 | |

**User's choice:** 两个开关

### 禁用托盘的生效时机

| Option | Description | Selected |
|--------|-------------|----------|
| 立即生效，关闭→退出 | 关闭"启用系统托盘"后，关闭按钮直接退出应用。立即生效。 | ✓ |
| 下次启动生效 | 关闭"启用系统托盘"后，下次启动时不再显示托盘图标。 | |

**User's choice:** 立即生效，关闭→退出

## Claude's Discretion

- 最近执行指令的持久化存储方式（store key 结构、最大条目数）
- 最近执行指令列表的更新时机（执行成功后追加、去重逻辑）
- 托盘菜单的动态刷新方式
- SettingsDialog 组件的 UI 设计
- TitleBar 齿轮按钮的位置细节
- tray-icon feature 配置细节

## Deferred Ideas

None — discussion stayed within phase scope
