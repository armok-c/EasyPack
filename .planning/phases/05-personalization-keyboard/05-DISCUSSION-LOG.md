# Phase 5: 项目个性化与键盘增强 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 05-personalization-keyboard
**Areas discussed:** 项目图标与颜色标记, 拖拽排序, 键盘导航

---

## 项目图标与颜色标记

### 图标来源

| Option | Description | Selected |
|--------|-------------|----------|
| lucide 预设图标 | 复用 icons.ts 已有 10 个图标，与指令图标体系一致 | ✓ |
| 自动扫描项目图标 | 从项目文件夹提取 icon.ico，复杂度高 | |
| 自定义图片上传 | 用户上传任意图片，复杂度最高 | |

**User's choice:** lucide 预设图标
**Notes:** 与 Phase 4 指令图标选择体验统一，复用已有代码

### 颜色展示方式

| Option | Description | Selected |
|--------|-------------|----------|
| 左侧彩色边框 | 3px 宽彩色竖条，类似 VS Code 标记 | ✓ |
| 图标旁色块 | 小圆点或色块，占用水平空间多 | |
| 背景色渲染 | 整行淡色背景，可能干扰选中高亮 | |

**User's choice:** 左侧彩色边框
**Notes:** 不影响现有布局，视觉清晰轻量

### 设置入口

| Option | Description | Selected |
|--------|-------------|----------|
| 右键菜单 + 弹窗 | 右键弹出菜单含"设置图标和颜色"，不增加视觉噪音 | ✓ |
| 悬停编辑图标 | 悬停显示铅笔图标，增加 UI 元素数量 | |
| 双击打开设置 | 简单但可能与双击选中冲突 | |

**User's choice:** 右键菜单 + 弹窗
**Notes:** 与 Phase 4 右键菜单模式一致

### 颜色选项数量

| Option | Description | Selected |
|--------|-------------|----------|
| 8 色预设盘 | 红橙黄绿蓝紫粉青，覆盖常见区分需求 | ✓ |
| 12+ 色 | 更丰富但可能过度选择 | |
| 4-6 色 | 极简但区分度不够 | |

**User's choice:** 8 色预设盘

---

## 拖拽排序

### 拖拽方式

| Option | Description | Selected |
|--------|-------------|----------|
| 拖拽手柄 | 左侧手柄图标按住拖动，不影响其他交互 | ✓ |
| 整行拖拽 | 按住任意位置拖动，可能与其他交互冲突 | |
| 上下箭头按钮 | 最简单但不直观，效率低 | |

**User's choice:** 拖拽手柄

### 拖拽范围

| Option | Description | Selected |
|--------|-------------|----------|
| 仅侧边栏项目 | 范围清晰，复杂度低 | ✓ |
| 项目 + 指令卡片 | 额外功能，与 PROJ-06 无直接关联 | |

**User's choice:** 仅侧边栏项目

### 手柄显示时机

| Option | Description | Selected |
|--------|-------------|----------|
| 悬停时显示 | 与 X 删除按钮行为一致，保持简洁 | ✓ |
| 始终显示 | 操作直观但增加视觉噪音 | |
| 编辑模式显示 | 需额外模式切换 | |

**User's choice:** 悬停时显示

---

## 键盘导航

### 导航范围

| Option | Description | Selected |
|--------|-------------|----------|
| 侧边栏 + 卡片双区域 | 两个区域分离清晰，完整覆盖 UI-03 | ✓ |
| 仅侧边栏 | 不满足 UI-03 快捷键触发指令要求 | |

**User's choice:** 侧边栏 + 卡片双区域

### 指令触发键位

| Option | Description | Selected |
|--------|-------------|----------|
| 数字键 1-9 | 直接触发对应位置卡片，高效直觉 | ✓ |
| Ctrl + 数字键 | 需按组合键，效率较低 | |
| Alt + 数字键 | Alt 可能触发 Windows 菜单栏 | |

**User's choice:** 数字键 1-9

### 焦点指示

| Option | Description | Selected |
|--------|-------------|----------|
| 复用现有 focus 样式 | focus-visible:ring-2，零额外代码 | ✓ |
| 高亮背景色 | 更显眼但可能与选中状态混淆 | |

**User's choice:** 复用现有 focus 样式

### Tab 键行为

| Option | Description | Selected |
|--------|-------------|----------|
| Tab 切换区域 | 清晰的两层焦点模型 | ✓ |
| Tab 顺序遍历 | 元素多时效率极低 | |

**User's choice:** Tab 切换区域

---

## Claude's Discretion

- 拖拽库选择（推荐 @dnd-kit）
- 右键菜单实现方案
- 8 色预设盘具体色值
- 拖拽动效和占位符样式
- 卡片网格方向键移动方向
- 侧边栏无项目时键盘行为
- 项目设置弹窗布局
- 排序持久化数据格式
- ProjectItem 接口扩展

## Deferred Ideas

None — discussion stayed within phase scope
