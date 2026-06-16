# Phase 18: 快捷键设置面板 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 18-快捷键设置面板
**Areas discussed:** 面板入口与位置, 可绑定操作的分类体系, 快捷键录制与冲突处理, 默认快捷键与重置策略

---

## 面板入口与位置

### 面板打开方式

| Option | Description | Selected |
|--------|-------------|----------|
| 独立 Dialog | 与 SettingsDialog 分离，避免设置弹窗过长 | ✓ |
| SettingsDialog 内分区 | 在设置弹窗中新增快捷键 Tab/分区 | |
| TitleBar 独立按钮 | TitleBar 上添加键盘图标按钮 | |

**User's choice:** 独立 Dialog
**Notes:** 与 SettingsDialog 分离，避免设置弹窗过长

### 入口位置

| Option | Description | Selected |
|--------|-------------|----------|
| SettingsDialog 底部按钮 | 底部版本号区域旁边添加"快捷键设置..."按钮 | ✓ |
| TitleBar 键盘图标 | 齿轮图标旁添加键盘图标 | |
| 两个入口 | SettingsDialog 底部 + TitleBar 键盘图标 | |

**User's choice:** SettingsDialog 底部按钮
**Notes:** TitleBar 已有 5 个按钮空间紧凑

### 面板布局风格

| Option | Description | Selected |
|--------|-------------|----------|
| 分组列表 + 搜索 | 顶部搜索框，下方按分类折叠显示 | ✓ |
| 表格布局 | 可滚动单表格，列：操作名/快捷键/分类 | |
| 分类 Tab 导航 | 垂直 Tab 分类，右侧显示该分类操作 | |

**User's choice:** 分组列表 + 搜索

### 面板尺寸

| Option | Description | Selected |
|--------|-------------|----------|
| 紧凑弹窗 | 与 SettingsDialog 类似大小（380-450px 宽） | ✓ |
| 宽弹窗 | 更宽的弹窗（550-650px） | |

**User's choice:** 紧凑弹窗

### 指令快捷键管理位置

| Option | Description | Selected |
|--------|-------------|----------|
| 统一在面板管理 | 所有快捷键集中在面板，不再在 CommandDialog 绑定 | ✓ |
| 面板只读 + CommandDialog 绑定 | 面板只查看，绑定仍在 CommandDialog | |
| 双入口绑定 | 两处都可绑定，需保持同步 | |

**User's choice:** 统一在面板管理

### CommandDialog 快捷键 UI 处理

| Option | Description | Selected |
|--------|-------------|----------|
| 移除绑定 UI | 从 CommandDialog 移除快捷键录制按钮 | ✓ |
| 保留显示 + 跳转面板 | 保留只读标签，点击跳转到面板 | |
| 保持原样 | CommandDialog 保持原样 | |

**User's choice:** 移除绑定 UI

---

## 可绑定操作的分类体系

### 操作分类

| Option | Description | Selected |
|--------|-------------|----------|
| 3 分类 | 指令执行 + 窗口操作 + 项目操作 | ✓ |
| 2 分类 | 指令执行 + 应用操作（窗口+项目合并） | |
| 4 分类 | 指令执行 + 窗口操作 + 项目操作 + 通用操作 | |

**User's choice:** 3 分类

### 窗口操作具体内容

| Option | Description | Selected |
|--------|-------------|----------|
| 2 个操作 | 显示/隐藏主窗口 + 切换悬浮窗 | ✓ |
| 3 个操作 | 上述 + 最小化到托盘 | |

**User's choice:** 2 个操作

### 项目操作具体内容

| Option | Description | Selected |
|--------|-------------|----------|
| 3 个操作 | 切换上一个/下一个项目 + 打开文件夹 | ✓ |
| 3+N 个操作 | 上述 + 切换到第 N 个项目（数字键） | |
| 2 个操作 | 仅切换上一个/下一个项目 | |

**User's choice:** 3 个操作

### 指令列表类型

| Option | Description | Selected |
|--------|-------------|----------|
| 动态列表 | 只显示用户已添加的指令（全局+项目级） | ✓ |
| 包含未添加的预设 | 所有指令都显示，包括未添加的 | |

**User's choice:** 动态列表

### 数据模型

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 ShortcutAction 类型 | 统一的 { id, label, category, handler } 类型 | ✓ |
| 混合模式 | 窗口/项目固定列表 + 指令用 CommandItem.shortcut | |

**User's choice:** 统一 ShortcutAction 类型

---

## 快捷键录制与冲突处理

### 录制交互方式

| Option | Description | Selected |
|--------|-------------|----------|
| 单次按键确认 | 按下组合键立即确认，Esc 取消 | ✓ |
| 二次确认 | 按键后需再按 Enter 确认 | |
| 长按确认 | 按住 0.5 秒后确认 | |

**User's choice:** 单次按键确认

### 录制视觉反馈

| Option | Description | Selected |
|--------|-------------|----------|
| 文字提示 + 边框闪烁 | "按下快捷键..." + 虚线边框闪烁动画 | ✓ |
| 图标 + 文字提示 | 红色圆点图标 + 文字提示 | |

**User's choice:** 文字提示 + 边框闪烁

### 冲突处理方式

| Option | Description | Selected |
|--------|-------------|----------|
| 警告 + 用户选择 | 黄色警告条显示冲突操作名，用户选择覆盖或取消 | ✓ |
| 自动替换 + Toast | 自动替换并显示 toast 提示 | |
| 拒绝 + 手动清除 | 直接拒绝冲突快捷键 | |

**User's choice:** 警告 + 用户选择

### 按键限制

| Option | Description | Selected |
|--------|-------------|----------|
| 沿用 v1.2 规则 | 至少一个修饰键 + 1-2 主键，最多 3 键 | ✓ |
| 放宽允许 F 键 | 允许 F1-F12 单键绑定 | |

**User's choice:** 沿用 v1.2 规则

---

## 默认快捷键与重置策略

### 默认快捷键

| Option | Description | Selected |
|--------|-------------|----------|
| 无默认快捷键 | 所有操作初始为"未绑定"，用户完全自定义 | ✓ |
| 窗口/项目操作预设 | 为窗口/项目操作预设少量快捷键 | |
| 全部预设 | 为所有操作预设快捷键 | |

**User's choice:** 无默认快捷键

### 重置范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全部重置 | 面板底部一个"重置所有快捷键"按钮 | ✓ |
| 单个清除 + 全部重置 | 每个操作旁有清除按钮 + 底部全部重置 | |
| 三级重置 | 单个清除 + 分类重置 + 全部重置 | |

**User's choice:** 全部重置

### 重置确认

| Option | Description | Selected |
|--------|-------------|----------|
| 确认弹窗 | 弹出确认 Dialog，防止误操作 | ✓ |
| 直接重置 | 点击后直接重置，无确认 | |

**User's choice:** 确认弹窗

---

## Claude's Discretion

- ShortcutPanel Dialog 的具体实现方式（组件文件结构、状态管理方式）
- ShortcutAction 注册表的初始化和更新时机
- 搜索/筛选的具体实现（实时搜索 vs 防抖、搜索范围）
- 分组列表的折叠/展开状态管理
- 录制状态下对全局快捷键的临时禁用策略
- 快捷键数据的持久化结构（独立的 store key）
- 窗口操作和项目操作 handler 的具体实现
- CommandDialog 中移除快捷键 UI 后的布局调整

## Deferred Ideas

None — discussion stayed within phase scope
