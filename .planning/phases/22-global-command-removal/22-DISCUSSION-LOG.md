# Phase 22: 全局指令移除与重构 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 22-全局指令移除与重构
**Areas discussed:** 现有全局指令处理, 无项目指令时的默认视图, 预设指令的去留, 悬浮窗/托盘中的全局指令

---

## 现有全局指令处理

| Option | Description | Selected |
|--------|-------------|----------|
| 直接丢弃 | 移除 CUSTOM_COMMANDS_KEY 存储，清空 customCommands state，toast 通知用户 | ✓ |
| 自动迁移到默认项目 | 将全局自定义指令迁移到当前选中项目的 projectCommandsMap | |
| 仅标记废弃不删除 | 保留数据在 store 但不展示，给用户手动导出机会 | |

**User's choice:** 直接丢弃
**Notes:** —

### 清理策略

| Option | Description | Selected |
|--------|-------------|----------|
| 应用启动时一次性删除 | 检测 CUSTOM_COMMANDS_KEY 旧数据 → toast 通知 → 删除 | ✓ |
| 仅代码层面移除 | 不再读写 CUSTOM_COMMANDS_KEY，旧数据留 store | |
| 永久保留只读 | 保留读取但不展示，不允许新增 | |

**User's choice:** 应用启动时一次性删除
**Notes:** 一次性显式迁移，后续不再处理

---

## 无项目指令时的默认视图

| Option | Description | Selected |
|--------|-------------|----------|
| 空状态引导页 | 无项目指令时显示引导提示，自动进入编辑模式 | |
| 自动初始化预设指令集 | 从预设复制一份到项目指令集 | |
| 显示预设只读列表 | 展示预设列表但不持久化 | |

**User's choice:** 用户自定义 — "不是有默认指令？默认指令改完只有一个：终端，点击启动终端"
**Notes:** 用户明确：内置一个"终端"默认指令，始终可用，不属于项目指令集也不可删除。这简化了空状态问题——始终至少有一个可点击的终端卡片。

---

## 预设指令的去留

| Option | Description | Selected |
|--------|-------------|----------|
| 仅保留终端 | 删除全部预设系统，新增内置终端卡片 | |
| 保留预设库但隐藏 | presets.ts 不动但 UI 不展示 | |
| 终端 + 预设库共存 | 默认显示终端卡片，CommandDialog 仍可浏览预设库添加 | ✓ |

**User's choice:** 终端 + 预设库共存
**Notes:** 预设 scope 从 "global" 改为 "project"

### 终端执行方式

| Option | Description | Selected |
|--------|-------------|----------|
| 打开系统终端 | start cmd 在项目目录打开 cmd.exe，特殊内置指令 | ✓ |
| 复用预设库条目 | 在 ALL_PRESETS 中添加终端预设 | |
| 硬编码特殊处理 | 终端卡片硬编码在 MainArea 中 | |

**User's choice:** 打开系统终端
**Notes:** 终端是特殊的内置 UI 元素，不对应 CommandItem 数据模型

---

## 悬浮窗/托盘中的全局指令

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随主窗口逻辑 | commands 派生逻辑自动包含终端默认 + 项目指令 | ✓ |
| 仅显示项目指令 | 不包含终端默认卡片 | |
| 悬浮窗仅终端 | 悬浮窗精简为项目名 + 终端按钮 | |

**User's choice:** 跟随主窗口逻辑
**Notes:** FloatApp/useTray 无需独立适配，commands 派生逻辑变更自动生效

---

## Claude's Discretion

无 —— 所有决策均由用户明确选择。

## Deferred Ideas

无 —— 讨论严格限制在 Phase 22 范围内。
