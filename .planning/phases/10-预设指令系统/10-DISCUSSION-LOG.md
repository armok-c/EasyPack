# Phase 10: 预设指令系统 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 10-预设指令系统
**Areas discussed:** 预设分类与命令清单, 双下拉框交互流程, 默认卡片精简策略, 全局/项目级选择交互

---

## 预设分类与命令清单

| Option | Description | Selected |
|--------|-------------|----------|
| 清单合理，继续 | 4 分类约 25 个命令覆盖主要场景 | ✓ |
| 增加分类 | 增加 Docker、Yarn、pnpm 等 | |
| 精简命令 | 每分类 3-5 个最常用 | |

**User's choice:** 清单合理，继续
**Notes:** Git/NPM/Python/Rust 四分类足够覆盖日常开发场景

| Option | Description | Selected |
|--------|-------------|----------|
| 放入 NPM 预设库（推荐） | 移除的默认卡片作为预设项保留 | ✓ |
| 直接删除，不保留 | 不出现在任何预设库中 | |

**User's choice:** 放入 NPM 预设库
**Notes:** "打包项目"（npm run build）和"启动项目"（npm run dev）保留在 NPM 预设库中

---

## 双下拉框交互流程

| Option | Description | Selected |
|--------|-------------|----------|
| 预设填充 + 可编辑（推荐） | 双下拉框选择后自动填充，用户可修改 | ✓ |
| 预设锁定，不可编辑 | 选择后锁定名称/命令 | |
| 双模式切换 | 两个 Tab 互斥切换 | |

**User's choice:** 预设填充 + 可编辑
**Notes:** 弹窗顶部双下拉框，选择后填充下方字段，用户可自由修改

| Option | Description | Selected |
|--------|-------------|----------|
| 按分类自动匹配（推荐） | Git→GitBranch, NPM→Package, Python→Terminal, Rust→CargoShip | ✓ |
| 手动选择 | 保持现有图标选择器 | |

**User's choice:** 按分类自动匹配
**Notes:** 图标按分类自动匹配，用户仍可手动更改

| Option | Description | Selected |
|--------|-------------|----------|
| Select 下拉框（推荐） | shadcn Select，简单下拉选择 | ✓ |
| Combobox 可搜索 | shadcn Command + Popover，支持搜索 | |

**User's choice:** Select 下拉框
**Notes:** 需新安装 shadcn Select 组件，简单够用

---

## 默认卡片精简策略

| Option | Description | Selected |
|--------|-------------|----------|
| 仅保留 2 个（推荐） | git pull + claude | ✓ |
| 保留 3 个 | git pull + claude + npm run build | |

**User's choice:** 仅保留 2 个
**Notes:** 符合 PRE-02 需求

| Option | Description | Selected |
|--------|-------------|----------|
| 无需额外引导（推荐） | 默认 2 卡片足够展示功能 | ✓ |
| 添加首次引导提示 | 首次使用时提示预设库 | |

**User's choice:** 无需额外引导
**Notes:** 用户点击"添加指令"时预设库自然可见

---

## 全局/项目级选择交互

| Option | Description | Selected |
|--------|-------------|----------|
| 自动跟随当前模式（推荐） | 全局模式添加到全局，项目模式添加到项目 | ✓ |
| 弹窗内增加选择器 | 弹窗内全局/项目切换器 | |

**User's choice:** 自动跟随当前模式
**Notes:** 复用现有 commandMode 状态，无需新增 UI 元素

---

## Claude's Discretion

- 预设命令的具体数据结构设计（存储方式、ID 格式）
- 双下拉框级联逻辑实现
- 预设 ID 迁移策略
- 手动输入时的表单行为

## Deferred Ideas

None — discussion stayed within phase scope
