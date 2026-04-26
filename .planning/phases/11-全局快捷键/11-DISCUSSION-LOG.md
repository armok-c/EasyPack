# Phase 11: 全局快捷键 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 11-全局快捷键
**Areas discussed:** 快捷键作用范围, 快捷键分配 UI 位置, 允许的快捷键格式

---

## 快捷键作用范围

| Option | Description | Selected |
|--------|-------------|----------|
| 应用内 | 仅 EasyPack 窗口获焦时生效，DOM keydown 监听，无需新增 Rust 插件 | |
| OS 级全局热键 | 任何应用前台都能触发，需安装 tauri-plugin-globalShortcut | ✓ |

**User's choice:** OS 级全局热键
**Notes:** 用户选择了更强大的方案。需要安装 Tauri globalShortcut 插件。

### Follow-up: 窗口隐藏时行为

| Option | Description | Selected |
|--------|-------------|----------|
| 始终生效 | 窗口隐藏/最小化时热键仍执行指令（在终端中打开） | ✓ |
| 窗口可见时生效 | 窗口显示时热键才生效，隐藏时不触发 | |

**User's choice:** 始终生效
**Notes:** 与 Phase 12 托盘模式配合，窗口隐藏时快捷键仍然可用。

---

## 快捷键分配 UI 位置

| Option | Description | Selected |
|--------|-------------|----------|
| CommandDialog 内 | 在添加/编辑弹窗中新增快捷键字段 | |
| 卡片上直接录制 | 点击卡片上的快捷键徽章进入录制模式 | ✓ |
| 独立管理面板 | 独立的快捷键管理页面，集中管理所有绑定 | |

**User's choice:** 卡片上直接录制
**Notes:** 更直观的交互方式，直接在卡片上操作。

### Follow-up: 录制入口可见性

| Option | Description | Selected |
|--------|-------------|----------|
| 仅编辑模式可见 | 录制入口仅在编辑模式下显示，不占用正常卡片空间 | ✓ |
| 始终可见 | 始终显示录制入口，但可能占用空间或导致误触 | |

**User's choice:** 仅编辑模式可见

### Follow-up: 非编辑模式显示

| Option | Description | Selected |
|--------|-------------|----------|
| 始终显示徽章 | 非编辑模式下在卡片上显示快捷键文本徽章（如 Ctrl+G） | ✓ |
| 仅编辑模式显示 | 非编辑模式下不显示快捷键信息 | |

**User's choice:** 始终显示徽章

---

## 允许的快捷键格式

### 修饰键要求

| Option | Description | Selected |
|--------|-------------|----------|
| 必须带修饰键 | 必须包含 Ctrl/Alt/Shift + 普通键，防止误触 | ✓ |
| 无限制 | 允许任何组合，包括单键 | |

**User's choice:** 必须带修饰键

### 组合键数范围

| Option | Description | Selected |
|--------|-------------|----------|
| 2-3 键组合 | 最少 Ctrl+G（2 键），最多 Ctrl+Shift+R（3 键） | ✓ |
| 无限制 | 允许任何长度的组合 | |

**User's choice:** 2-3 键组合

---

## Claude's Discretion

- 现有数字键 1-9 快捷键的处理方式（保留/移除/与自定义快捷键共存）
- CommandItem 接口 shortcut 字段的格式设计
- 快捷键冲突检测的具体实现和 UI 反馈
- 快捷键注册/注销时机
- 徽章样式和位置

## Deferred Ideas

None — discussion stayed within phase scope
