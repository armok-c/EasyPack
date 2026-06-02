# Phase 19: 悬浮窗改进 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 19-悬浮窗改进
**Areas discussed:** 折叠态外观与尺寸, 折叠/展开触发方式, 折叠态项目切换交互, 动画与窗口缩放

---

## 折叠态外观与尺寸

| Option | Description | Selected |
|--------|-------------|----------|
| 仅图标 + 名称 | 最紧凑方案，折叠态约 28-32px 高，右展开箭头 | ✓ |
| 图标 + 名称 + 3个指令快按钮 | 中等尺寸约 80px 高，部分功能不需展开 | |
| 图标 + 名称 + 折叠指示条 | 约 40-48px 高，底部有 chevron 展开 | |

**User's choice:** 仅图标 + 名称
**Notes:** 最紧凑方案

| Option | Description | Selected |
|--------|-------------|----------|
| 保持 220px 宽 | 动画只涉及高度变化，技术简单 | |
| 收窄到约 130px | 更紧凑但需要 Tauri 窗口 resize | ✓ |

**User's choice:** 收窄到约 130px

| Option | Description | Selected |
|--------|-------------|----------|
| 更小的圆角 (rounded-md) | 状态区分明显 | |
| 保持 rounded-lg | 视觉统一 | |
| 胶囊形状 (rounded-full) | 有辨识度，像浮动胶囊 | ✓ |

**User's choice:** 胶囊形状 (rounded-full)

| Option | Description | Selected |
|--------|-------------|----------|
| 左图标 + 中名称 + 右箭头 | 展开箭头单独显示 | ✓ |
| 图标 + 名称，无独立展开按钮 | 点击任意非按钮区域展开 | |

**User's choice:** 左图标 + 中名称 + 右箭头

| Option | Description | Selected |
|--------|-------------|----------|
| 与展开态风格统一 | 保持 bg-background | ✓ |
| 半透明磨砂效果 | bg-background/80 + backdrop-blur | |

**User's choice:** 与展开态风格统一

| Option | Description | Selected |
|--------|-------------|----------|
| 复用项目图标（同侧边栏） | 与侧边栏视觉关联，无图标首字母 | ✓ |
| 统一 FolderOpen 图标 | 不区分项目 | |

**User's choice:** 复用项目图标（同侧边栏）

| Option | Description | Selected |
|--------|-------------|----------|
| 图标 14px + text-[11px] | 最紧凑 | ✓ |
| 图标 16px + text-xs | 稍微清晰 | |

**User's choice:** 图标 14px + text-[11px]

---

## 折叠/展开触发方式

| Option | Description | Selected |
|--------|-------------|----------|
| 点击展开箭头展开，点击 header 折叠 | 图标清晰，区域明确 | |
| 点击 header 任意位置 toggle | 简单但与项目名切换冲突 | ✓ (初始选择) |
| hover 自动展开/折叠 | 无需点击但误触频繁 | |

**User's choice:** 点击 header 任意位置 toggle（初始选择）

随后发现与 FLOAT-03 冲突（点击项目名应切换项目而非展开），重新讨论：

| Option | Description | Selected |
|--------|-------------|----------|
| 点击名称→切换项目，其他区域→展开 | 交互区域分开 | ✓ |
| 单击切换项目，双击展开 | 通过 300ms 超时区分 | |
| 名称旁加切换箭头，其他区域展开 | 增加按钮数 | |

**User's choice:** 点击名称→切换项目，点击其他区域→展开

| Option | Description | Selected |
|--------|-------------|----------|
| 点击 header 空白区域折叠 | 现有 header 风格一致 | ✓ |
| 点击折叠按钮折叠 | 交互区域更明确 | |
| 点击任意位置折叠 | 可能与指令按钮冲突 | |

**User's choice:** 点击 header 空白区域折叠

---

## 折叠态项目切换交互

| Option | Description | Selected |
|--------|-------------|----------|
| 循环下一个 | 点击一次切换一次，简单直观 | ✓ |
| 点击弹出下拉列表选择 | 可直接跳到任意项目 | |
| 左右箭头切换 | 视觉上更明确 | |

**User's choice:** 循环下一个（点击一次切换一次）

| Option | Description | Selected |
|--------|-------------|----------|
| 主窗口同步切换 | 两窗口状态一致 | ✓ |
| 独立切换，仅执行时同步 | 主窗口和悬浮窗项目可不同 | |

**User's choice:** 主窗口同步切换

| Option | Description | Selected |
|--------|-------------|----------|
| 与侧边栏顺序一致 | 用户可预期的循环方向 | ✓ |
| 按最近使用顺序 (MRU) | 更智能但顺序不固定 | |

**User's choice:** 与侧边栏顺序一致

---

## 动画与窗口缩放

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri 窗口 resize + CSS 同时进行 | 窗口真正变形，但可能不平滑 | |
| CSS 先过渡，然后窗口 resize | 动画分两步但每步稳定 | ✓ |
| 纯 CSS 过渡，不 resize 窗口 | 折叠态不会收窄 | |

**User's choice:** CSS 先过渡，然后窗口 resize

| Option | Description | Selected |
|--------|-------------|----------|
| 淡入淡出（opacity） | 每步约 150ms | |
| 收缩动画（scaleY/max-height） | 更直观的"折叠"视觉 | ✓ |
| 无内容动画，仅窗口平滑 resize | 最简单 | |

**User's choice:** 收缩动画（scaleY/max-height）

| Option | Description | Selected |
|--------|-------------|----------|
| 快速（各 300ms） | 响应迅速 | ✓ |
| 适中（各 500ms） | 更有"展开"感 | |

**User's choice:** 快速（各 300ms）

| Option | Description | Selected |
|--------|-------------|----------|
| 窗口 resize 也加动画 | 技术复杂度高 | |
| 窗口 resize 瞬间完成，仅 CSS 动画 | 简单可靠 | ✓ |

**User's choice:** 窗口 resize 瞬间完成，仅 CSS 动画

---

## Claude's Discretion

- 展开态紧凑化的具体程度（FLOAT-01）
- 折叠态首字母圆圈的具体样式
- CSS 收缩动画的具体实现方式
- 窗口 resize 的时机控制
- 浮动窗口位置记忆策略
- 无项目时折叠态空状态显示
- 展开箭头图标的最终选择

## Deferred Ideas

None — discussion stayed within phase scope
