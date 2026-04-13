# Phase 3: 指令卡片与核心交互 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 03-command-cards
**Areas discussed:** 未选中状态, 卡片内容, 执行反馈, 网格列数, 执行 Loading

---

## 未选中时的主区域表现

| Option | Description | Selected |
|--------|-------------|----------|
| 空状态引导页（当前实现） | 保持 FolderOpen 图标 + "选择一个项目开始"。简洁明了，用户一看就知道需要先选项目 | ✓ |
| 灰显卡片 + 提示 | 始终显示卡片网格，未选中时灰显，上方显示提示"请先选择项目" | |
| 两者结合 | 未选中时先显示引导文字，下方额外展示灰显小卡片预览 | |

**User's choice:** 空状态引导页（当前实现）
**Notes:** 空状态本身就是"禁用"状态，满足 CMD-08 核心意图。用户明确不需要灰显卡片方案。

---

## 卡片信息密度与内容

| Option | Description | Selected |
|--------|-------------|----------|
| 图标 + 名称（当前） | 保持紧凑布局。自定义指令时用户自己命名，名称足够理解用途 | ✓ |
| 图标 + 名称 + 命令 | 显示 Shell 命令文本（如 "npm run build"）。信息更丰富但卡片变高 | |
| 你决定 | Claude 混合方案或 tooltip 方式 | |

**User's choice:** 图标 + 名称（当前）
**Notes:** 保持统一简洁风格。预设和自定义指令用同样的展示方式。

---

## 执行反馈动效

| Option | Description | Selected |
|--------|-------------|----------|
| 卡片闪光/回弹反馈 | 点击后卡片有快速视觉反馈（闪光/回弹/边框高亮），然后恢复正常 | ✓ |
| 当前行为就够用 | 保持 active scale(0.98) + toast，不增加额外动效 | |
| 你决定 | Claude 选择最适合 Raycast 风格的反馈方式 | |

**User's choice:** 卡片闪光/回弹反馈
**Notes:** 让用户明确感受到"已触发执行"。具体动效实现留给 Claude discretion。

---

## 网格列数策略

| Option | Description | Selected |
|--------|-------------|----------|
| 固定 2 列 | 始终 2 列，卡片随窗口变宽而变宽。简单统一 | |
| 自适应列数 | 窗口较宽时自动增加列数，卡片保持固定宽度。空间利用更好 | ✓ |
| 你决定 | Claude 综合考虑窗口尺寸和卡片数量 | |

**User's choice:** 自适应列数
**Notes:** 卡片保持固定最大宽度，窗口变宽时自动增加列数。最小窗口宽度 600px 时至少 2 列。

---

## 执行中 Loading 状态

| Option | Description | Selected |
|--------|-------------|----------|
| 执行中动效反馈 | 卡片短暂显示执行中状态（旋转图标/脉冲边框/闪光），然后恢复正常 | ✓ |
| 不需要 loading | 命令执行极快（< 100ms），加 loading 反而闪烁。当前方案足够 | |
| 你决定 | Claude 决定 | |

**User's choice:** 执行中动效反馈
**Notes:** 即使执行很快，视觉上明确告知用户"已触发"。与前面的执行反馈动效决策配合。

---

## Claude's Discretion

- 执行反馈动效的具体实现（CSS transition / keyframe / 其他方案）
- 卡片最大宽度和自适应断点
- 是否需要 Tooltip 补充信息
- 项目信息区域的展示方式

## Deferred Ideas

None — discussion stayed within phase scope
