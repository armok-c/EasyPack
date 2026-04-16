# Phase 7: 无边框窗口与自定义标题栏 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 07-无边框窗口与自定义标题栏
**Areas discussed:** 标题栏视觉风格, 标题栏显示内容, 拖拽区域与 Resize

---

## 标题栏视觉风格

### 标题栏高度

| Option | Description | Selected |
|--------|-------------|----------|
| 28px（紧凑） | 非常紧凑，类似 VS Code 标题栏高度 | ✓ |
| 32px（标准） | 标准高度，文字和按钮有足够空间 | |
| 40px（宽松） | 更宽松，类似 macOS 标题栏高度 | |

**User's choice:** 28px（紧凑）
**Notes:** 用户选择最紧凑选项，适配当前窗口最小高度 400px

### 视觉风格

| Option | Description | Selected |
|--------|-------------|----------|
| 无边界融合风格 | 标题栏与内容区域同一背景，无分割线，按钮半透明 | ✓ |
| 微分割风格 | 标题栏背景稍浅/深，底部有细分割线 | |
| 明显分区风格 | 标题栏明显不同背景色，独立条状区域 | |

**User's choice:** 无边界融合风格
**Notes:** 匹配 Raycast 风格暗色渐变背景，追求现代一体化视觉

### 窗口控制按钮样式

| Option | Description | Selected |
|--------|-------------|----------|
| 半透明图标 + hover 背景 | 默认几乎看不到，hover 时显示背景，最紧凑 | ✓ |
| 始终可见的柔和按钮 | 按钮始终可见但颜色柔和，hover 时高亮 | |

**User's choice:** 半透明图标 + hover 背景
**Notes:** 视觉干扰最小化，与融合风格一致

---

## 标题栏显示内容

| Option | Description | Selected |
|--------|-------------|----------|
| 仅应用名称 | 最简洁，标题栏只做拖拽和控制 | |
| 应用名 + 选中项目名 | 显示 'EasyPack - ProjectName' | |
| 应用图标 + 名称 | 小圆角方形图标 + 文字，更有品牌感 | ✓ |

**User's choice:** 应用图标 + 名称
**Notes:** 28px 高度空间有限，图标需小尺寸适配

---

## 拖拽区域与 Resize

### 拖拽范围

| Option | Description | Selected |
|--------|-------------|----------|
| 仅标题栏可拖拽 | data-tauri-drag-region 标记标题栏，简单可靠 | ✓ |
| 标题栏 + 侧边栏顶部 | 两个区域都可拖拽，拖拽区域更大 | |

**User's choice:** 仅标题栏可拖拽
**Notes:** 简单可靠，避免与侧边栏交互冲突

### Resize 实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri 内置 resize | 利用 Windows 原生 WM_NCHITTEST，行为一致 | ✓ |
| 自定义 CSS/JS resize | CSS 不可见边框 + 鼠标事件，更灵活但复杂 | |

**User's choice:** Tauri 内置 resize
**Notes:** STATE.md 提到 Win10 vs Win11 resize 行为差异为已知风险，Tauri 内置方案更可靠

### 窗口阴影

| Option | Description | Selected |
|--------|-------------|----------|
| 系统默认阴影 | Windows 11 DWM 自动添加，Win10 可能无阴影 | ✓ |
| 强制确保阴影 | 通过 API 显式设置，Win10/11 都有阴影 | |

**User's choice:** 系统默认阴影
**Notes:** 不额外处理，自然效果。Win10 无阴影属可接受行为

---

## Claude's Discretion

- 标题栏组件的具体 HTML 结构和 Tailwind CSS 类名
- 窗口控制按钮图标选择（lucide-react 图标库）
- 应用图标的具体来源和尺寸
- 高 DPI 配置细节
- 双击标题栏最大化行为

## Deferred Ideas

None — discussion stayed within phase scope
