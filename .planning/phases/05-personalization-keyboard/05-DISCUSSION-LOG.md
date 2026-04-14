# Phase 5: 项目个性化与键盘增强 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 05-personalization-keyboard
**Areas discussed:** 右键菜单与设置弹窗, 拖拽排序持久化, 键盘焦点管理模型, 图标颜色展示方式
**Updated:** 2026-04-14 (第二次讨论，补充持久化和焦点模型细节)

---

## 右键菜单与设置弹窗

### 右键菜单选项

| Option | Description | Selected |
|--------|-------------|----------|
| 极简：仅"设置图标和颜色" | 右键菜单只有一个选项，保持简洁 | ✓ |
| 实用：多选项菜单 | 包含设置图标颜色、删除项目、复制路径 | |
| 完整：全功能菜单 | 包含重命名、复制路径等完整操作 | |

**User's choice:** 极简：仅"设置图标和颜色"
**Notes:** 删除等操作保持现有方式，右键菜单不过度设计

### 设置弹窗布局

| Option | Description | Selected |
|--------|-------------|----------|
| 图标 + 颜色 + 预览 | 上半部分图标网格 + 下半部分颜色盘 + 底部预览 | ✓ |
| 紧凑单层布局 | 图标和颜色在同一个网格中 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 图标 + 颜色 + 预览
**Notes:** 上半部分 10 个图标网格，下半部分 8 色预设盘，底部预览 + 保存/取消按钮

### ContextMenu 集成方式

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar 内部处理 | ContextMenu 在 Sidebar 内部处理，选中结果通过回调 props 传给 App 层 | ✓ |
| App 层处理菜单状态 | 右键事件通过 props 回调给 App 层 | |

**User's choice:** Sidebar 内部处理
**Notes:** 符合现有 flat props 模式，ContextMenu 包裹在 Sidebar 内部

---

## 拖拽排序持久化

### 排序持久化方案

| Option | Description | Selected |
|--------|-------------|----------|
| 方案 A: 数组顺序即排序 | 直接改变 store 中 projects 数组的元素顺序 | ✓ |
| 方案 B: sortIndex 字段 | 每个 ProjectItem 新增 sortIndex 字段 | |
| 方案 C: 独立排序列表 | 单独维护 projectOrder: string[] | |

**User's choice:** 方案 A: 数组顺序即排序
**Notes:** 简单直接，不增加数据复杂度

### 保存时机

| Option | Description | Selected |
|--------|-------------|----------|
| 拖拽结束即保存 | onDragEnd 事件触发持久化 | ✓ |
| 拖拽中实时保存 | 拖拽过程中实时同步到 store | |

**User's choice:** 拖拽结束即保存
**Notes:** 简单可靠，避免频繁写入

---

## 键盘焦点管理模型

### 初始焦点

| Option | Description | Selected |
|--------|-------------|----------|
| 侧边栏优先 | 焦点默认在侧边栏第一个项目或"添加项目"按钮 | ✓ |
| 无初始焦点 | 不自动聚焦，用户需点击或 Tab | |
| 你来决定 | Claude 决定 | |

**User's choice:** 侧边栏优先

### Tab 行为

| Option | Description | Selected |
|--------|-------------|----------|
| 双区域 Tab 切换 | Tab 在侧边栏和卡片区域间切换，区域内箭头导航 | ✓ |
| 全元素 Tab 循环 | 按浏览器默认行为在所有可聚焦元素间循环 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 双区域 Tab 切换

### 数字键边界处理

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 1-9，超出部分鼠标操作 | 超过 9 个指令时数字键只触发前 9 个 | ✓ |
| 1-9 + 0 触发前 10 个 | 增加一个但复杂度不大 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 仅 1-9，超出部分鼠标操作

### 焦点视觉指示

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 ring 样式 | 侧边栏和卡片均用 focus-visible:ring-2 | ✓ |
| 侧边栏背景 + 卡片 ring | 区分焦点和选中的视觉表现 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 统一 ring 样式

---

## 图标颜色展示方式

### 图标位置

| Option | Description | Selected |
|--------|-------------|----------|
| 文字左侧 | 图标在项目名称左侧，紧凑类似 VS Code 文件图标 | ✓ |
| 文字上方 | 图标在项目名称上方，类似卡片布局 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 文字左侧

### 彩色边框与现有 border 的关系

| Option | Description | Selected |
|--------|-------------|----------|
| 叠加在现有 border | 左 border 用颜色，其他三边保持 white/10 | ✓ |
| 独立竖条元素 | 彩色竖条是独立元素，不影响现有 border | |
| 你来决定 | Claude 决定 | |

**User's choice:** 叠加在现有 border

---

## Claude's Discretion

- 拖拽库选择（推荐 @dnd-kit）
- 8 色预设盘的具体色值
- 拖拽动效和占位符样式
- 卡片网格中方向键的移动方向
- 侧边栏无项目时的键盘行为
- 项目设置弹窗的具体布局细节
- ProjectItem 接口扩展
- 初始焦点的具体实现方式
- 编辑模式下数字键行为
- 卡片焦点切换时是否自动滚动

## Deferred Ideas

None — discussion stayed within phase scope
