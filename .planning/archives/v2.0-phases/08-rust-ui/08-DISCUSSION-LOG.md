# Phase 8: Rust 后端扩展与快速 UI 修复 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 08-Rust 后端扩展与快速 UI 修复
**Areas discussed:** 图标自动识别范围, 文件夹大小计算策略, Git 分支获取方式, 模态窗自适应方案

---

## 图标自动识别范围

### 扫描来源

| Option | Description | Selected |
|--------|-------------|----------|
| 智能扫描 | 扫描 package.json icon 字段、Cargo.toml icon metadata、favicon.ico、app-icon.png 等常见文件名，覆盖面广 | ✓ |
| 仅文件扫描 | 只查找 .ico/.png/.svg 文件，不做配置解析 | |
| 仅配置解析 | 只解析 package.json 和 Cargo.toml 中的图标配置字段 | |

**User's choice:** 智能扫描
**Notes:** 需要多种来源覆盖，Rust 后端一次性扫描返回候选列表

### 图标类型共存

| Option | Description | Selected |
|--------|-------------|----------|
| 混合模式 | lucide 预设图标和文件图标共存，侧边栏根据类型分别渲染 | ✓ |
| 纯文件图标 | 完全替换 lucide 图标为文件图标系统 | |

**User's choice:** 混合模式
**Notes:** 两种图标共存，渲染时判断类型

### 扫描触发时机

| Option | Description | Selected |
|--------|-------------|----------|
| 打开模态时自动扫描 | 每次打开 ProjectSettingsDialog 自动扫描 | |
| 手动触发扫描 | 模态中增加"从项目导入"按钮，点击后触发 | ✓ |

**User's choice:** 手动触发扫描
**Notes:** 避免每次打开模态都有 I/O 开销

---

## 文件夹大小计算策略

### 计算时机

| Option | Description | Selected |
|--------|-------------|----------|
| 选中时即时计算 | 用户选中项目时调用 Rust 命令即时计算 | ✓ |
| 启动时后台计算 | 项目列表加载时后台计算所有项目大小 | |
| 计算并缓存 | 选中时计算并缓存结果，下次用缓存 | |

**User's choice:** 选中时即时计算

### 排除目录策略

| Option | Description | Selected |
|--------|-------------|----------|
| 固定排除列表 | 硬编码排除 node_modules, .git, target 等常见大目录 | ✓ |
| 用户可配置排除列表 | 用户可在设置中配置排除目录 | |

**User's choice:** 固定排除列表

### 超时机制

| Option | Description | Selected |
|--------|-------------|----------|
| 设置超时 | 5-10 秒超时，超时后返回部分结果或提示"计算中" | ✓ |
| 无超时 | 始终等待完成 | |
| 不显示 | 不显示文件夹大小（不符合需求） | |

**User's choice:** 设置超时

---

## Git 分支获取方式

### 获取方式

| Option | Description | Selected |
|--------|-------------|----------|
| 读取 .git/HEAD 文件 | 直接解析 .git/HEAD 获取分支名，零依赖极快 | ✓ |
| 调用 git 命令 | `git rev-parse --abbrev-ref HEAD`，准确但需 spawn 进程 | |
| 使用 gix crate | 纯 Rust Git 实现，功能全但依赖重 | |

**User's choice:** 读取 .git/HEAD 文件
**Notes:** 零依赖、无外部进程、非 Git 仓库时文件不存在自然跳过

### 获取时机

| Option | Description | Selected |
|--------|-------------|----------|
| 与大小一起即时获取 | 同一 Rust 命令中返回所有项目信息 | ✓ |
| 分开调用 | 文件夹大小和分支信息独立获取 | |

**User's choice:** 与大小一起即时获取

---

## 模态窗自适应方案

### 基础策略

| Option | Description | Selected |
|--------|-------------|----------|
| 全局 max-height + 滚动 | DialogContent 加 max-height 和 overflow，适用所有模态窗 | ✓ |
| 每个模态单独处理 | 每个模态窗单独设置高度和滚动 | |

**User's choice:** 全局 max-height + 滚动

### 滚动区域划分

| Option | Description | Selected |
|--------|-------------|----------|
| Header/Footer 固定，内容滚动 | flex-col 布局，中间区域 overflow-y-auto | ✓ |
| 整体滚动 | 整个 DialogContent 统一滚动 | |

**User's choice:** Header/Footer 固定，内容滚动

---

## Claude's Discretion

- 智能扫描的具体文件名匹配规则和优先级
- 排除目录的完整列表
- 超时的具体秒数
- 文件图标渲染尺寸和 fallback
- max-height 的具体值
- 缓存策略细节

## Deferred Ideas

None — discussion stayed within phase scope
