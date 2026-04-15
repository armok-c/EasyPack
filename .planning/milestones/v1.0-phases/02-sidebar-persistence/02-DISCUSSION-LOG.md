# Phase 2: 项目侧边栏与持久化 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 02-sidebar-persistence
**Areas discussed:** 删除交互, 选中状态视觉, 项目排列顺序, 重复项目处理

---

## 删除交互

| Option | Description | Selected |
|--------|-------------|----------|
| 悬停出现 X 按钮 | 鼠标悬停时项目右侧出现小的 X 图标按钮，点击直接删除。简洁高效 | ✓ |
| 主区域/右键菜单中删除 | 点击项目后主区域出现"删除项目"按钮，或右键菜单中提供删除 | |
| 删除前弹出确认弹窗 | 点击删除后弹出确认弹窗，防止误操作，但对个人工具可能偏重 | |

**User's choice:** 悬停出现 X 按钮（直接删除，无确认弹窗）
**Notes:** 符合个人工具定位，简洁高效

### 删除后行为

| Option | Description | Selected |
|--------|-------------|----------|
| 自动选中邻近项目 | 删除当前选中项目后自动选中列表中的下一个（或上一个）项目 | ✓ |
| 回到空状态 | 删除当前项目后指令卡片禁用，需手动选择 | |
| Claude 决定 | 自行决定最佳行为 | |

**User's choice:** 自动选中邻近项目（优先下一个，无下一个则选上一个）

---

## 选中状态视觉

| Option | Description | Selected |
|--------|-------------|----------|
| 背景高亮 + 边框加强 | 选中项目使用更亮的背景色 + 更明显的边框（bg-white/10 + border-white/20） | ✓ |
| 左侧彩色指示条 | 选中项目左侧加一条彩色指示条，类似 VS Code 活动标签 | |
| 文字颜色 + 粗细区分 | 选中项目文字使用 accent 颜色 + 稍微加粗 | |

**User's choice:** 背景高亮 + 边框加强（沿用 Phase 1 的透明度模式）

### 未选中项目悬停

| Option | Description | Selected |
|--------|-------------|----------|
| 轻微背景 + 显示 X 按钮 | 悬停时显示轻微背景变化 + 显示 X 删除按钮 | ✓ |
| 只显示 X 按钮 | 悬停时只显示 X 按钮，不改变背景 | |

**User's choice:** 轻微背景 + 显示 X 按钮

---

## 项目排列顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 按添加时间，新在后 | 新添加的项目出现在列表最后，最早添加的在顶部 | ✓ |
| 按添加时间，新在前 | 新添加的项目出现在列表最前，最新的在顶部 | |
| 按名称字母排序 | 项目按名称字母排序，稳定可预测 | |

**User's choice:** 按添加时间，新在后（Phase 5 加入拖拽排序可在此基础上调整）

---

## 重复项目处理

| Option | Description | Selected |
|--------|-------------|----------|
| 提示已存在，不添加 | 检测到已存在路径时显示 toast 提示"项目已存在" | ✓ |
| 自动切换选中到该项目 | 检测到已存在时自动切换选中，相当于"快速跳转" | |
| 允许重复添加 | 不做检查，允许重复添加同一路径 | |

**User's choice:** 提示已存在，不添加（toast 提示）

---

## Claude's Discretion

- Store 的 key 命名和数据 schema 设计
- useProject hook 的重构方式
- 项目 ID 生成策略
- X 按钮的具体位置和尺寸
- 持久化失败时的降级处理

## Deferred Ideas

None — discussion stayed within phase scope
