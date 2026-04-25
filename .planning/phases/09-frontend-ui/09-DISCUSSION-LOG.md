# Phase 9: 前端 UI 集成 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 09-frontend-ui
**Areas discussed:** 按钮行视觉风格, 打开文件夹实现方式, 切换交互细节

---

## 按钮行视觉风格

### 切换按钮形式

| Option | Description | Selected |
|--------|-------------|----------|
| 两个独立 Button | "全局指令"/"项目指令"各一个 Button，secondary/ghost variant 区分 | |
| Toggle Group 样式 | 两个按钮紧邻拼合，形成 Tab 视觉分组，中间无间隔 | ✓ |

**User's choice:** Toggle Group 样式
**Notes:** 用户偏好更紧凑的拼合样式，视觉上更像"切换"

### "打开文件夹"按钮样式

| Option | Description | Selected |
|--------|-------------|----------|
| outline + FolderOpen 图标 | 带边框按钮，左侧图标 + 文字，视觉层次明确 | ✓ |
| ghost + FolderOpen 图标 | 无边框透明按钮，更低调 | |
| 纯图标按钮 (icon size) | 只显示图标，最紧凑，需 tooltip | |

**User's choice:** outline + FolderOpen 图标
**Notes:** 用户选择视觉层次更明确的方案

### 按钮大小

| Option | Description | Selected |
|--------|-------------|----------|
| sm (小尺寸) | h-8 px-3 text-xs，与信息栏一致紧凑 | ✓ |
| default (标准尺寸) | h-9 px-4，更明显点击目标 | |

**User's choice:** sm (小尺寸)
**Notes:** 保持与信息栏其他元素的视觉一致性

---

## 打开文件夹实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| explorer.exe + raw_arg() | 零新依赖，复用 Phase 6 raw_arg 模式 | ✓ |
| tauri-plugin-opener | 官方插件，API 简洁，但新增依赖 | |

**User's choice:** explorer.exe + raw_arg()
**Notes:** 用户选择零依赖方案，对于仅 Windows 的应用无需跨平台封装

---

## 切换交互细节

### 空状态处理

| Option | Description | Selected |
|--------|-------------|----------|
| 禁用灰显 | "项目指令"按钮灰显不可点击 | ✓ |
| 可点击但提示 | 点击后自动进入编辑模式并提示 | |

**User's choice:** 禁用灰显
**Notes:** 防止用户进入空白状态

### 切换确认

| Option | Description | Selected |
|--------|-------------|----------|
| 直接切换 | 点击即切换，无弹窗 | ✓ |
| 切回全局时确认 | 从项目指令切回全局时弹确认 | |

**User's choice:** 直接切换
**Notes:** 沿用现有 enableProjectCommands/disableProjectCommands 逻辑

---

## Claude's Discretion

- Toggle Group 的 CSS 实现细节（圆角、分隔线、过渡效果）
- secondary/ghost 在深色主题下的具体颜色
- 是否新增 shadcn ToggleGroup 组件或手写样式
- open_folder 命令放在 shell.rs 还是新建文件

## Deferred Ideas

None
