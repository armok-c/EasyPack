# Phase 20: 多配置文件管理 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 20-多配置文件管理
**Areas discussed:** Profile 数据范围, Store 数据结构, Profile 管理 UI, 导入/导出体验, 切换并发安全, 迁移后旧数据清理, 导出 JSON 格式与校验

---

## Profile 数据范围

| Option | Description | Selected |
|--------|-------------|----------|
| 系统设置不跟（推荐） | 切换 profile 时，用户数据跟着切，系统设置（托盘/开机启动/抽屉）保持不变 | ✓ |
| 全部都跟 | 所有数据都跟着 profile 走，包括系统设置 | |
| 用户数据 + 快捷键跟 | 用户数据 + 快捷键绑定跟着切，快捷键以外的系统设置不跟 | |

**User's choice:** 系统设置不跟
**Notes:** 最直觉——工作 profile 有工作项目和指令，但系统行为不随 profile 变

| Option | Description | Selected |
|--------|-------------|----------|
| 记住选中项目（推荐） | 每个 profile 记住自己的 selectedProjectId，切回时恢复 | ✓ |
| 不记住，重新选择 | 切换 profile 后不选中任何项目 | |

**User's choice:** 记住选中项目

| Option | Description | Selected |
|--------|-------------|----------|
| 跟着 profile 走（推荐） | recentCommands 跟着 profile 走 | ✓ |
| 全局共享 | 最近指令是跨 profile 全局的 | |

**User's choice:** 跟着 profile 走

| Option | Description | Selected |
|--------|-------------|----------|
| 全局（推荐） | 悬浮窗折叠/展开状态属于窗口行为，不是配置数据 | ✓ |
| 跟着 profile 走 | 悬浮窗状态跟随 profile 保存 | |

**User's choice:** 全局

| Option | Description | Selected |
|--------|-------------|----------|
| 不跟，重置（推荐） | commandMode 和 editMode 是临时 UI 状态，切 profile 时重置 | ✓ |
| 跟着 profile 走 | 每个 profile 记住自己的 commandMode 和 editMode | |

**User's choice:** 不跟，重置

---

## Store 数据结构

| Option | Description | Selected |
|--------|-------------|----------|
| 独立文件（推荐） | 每个 profile 一个独立 JSON 文件（profile-{uuid}.json） | ✓ |
| 同一文件 + key 前缀 | 所有数据在同一个 store 里，用 key 前缀隔离 | |

**User's choice:** 独立文件

| Option | Description | Selected |
|--------|-------------|----------|
| 主 store 存元信息（推荐） | Profile 列表和当前活跃 profile ID 存在主 store | ✓ |
| 单独注册表文件 | Profile 列表存在单独的 profiles-registry.json | |

**User's choice:** 主 store 存元信息

| Option | Description | Selected |
|--------|-------------|----------|
| UUID 文件名（推荐） | 用 profile ID（UUID）作为文件名 | ✓ |
| 用 profile 名称 | 用用户可见名称做文件名 | |

**User's choice:** UUID 文件名

| Option | Description | Selected |
|--------|-------------|----------|
| AppData 目录同级（推荐） | Profile 文件与 easypack-store.json 同目录 | ✓ |
| profiles/ 子目录 | 创建 profiles/ 子目录存放 | |

**User's choice:** AppData 目录同级

| Option | Description | Selected |
|--------|-------------|----------|
| 自动迁移到"默认" profile（推荐） | 检测旧数据时自动创建默认 profile 并迁移 | ✓ |
| 弹窗提示创建 | 首次启动时弹窗提示用户创建第一个 profile | |

**User's choice:** 自动迁移到"默认" profile

---

## Profile 管理 UI

| Option | Description | Selected |
|--------|-------------|----------|
| SettingsDialog 内（推荐） | 在 SettingsDialog 里加 profile 管理区域 | ✓ |
| 独立 Dialog | 独立 ProfileManager Dialog，类似 ShortcutPanel | |
| 标题栏下拉切换 | 标题栏显示当前 profile 名称，点击下拉切换 | |

**User's choice:** SettingsDialog 内

| Option | Description | Selected |
|--------|-------------|----------|
| 下拉框 + 管理区域（推荐） | 顶部下拉框选择 profile + 齿轮图标打开管理区域 | ✓ |
| 卡片列表 | 所有 profile 的卡片式列表 | |

**User's choice:** 下拉框 + 管理区域

| Option | Description | Selected |
|--------|-------------|----------|
| 立即关闭并生效（推荐） | 切换 profile 后立即关闭 SettingsDialog | ✓ |
| 保持打开 | 切换后对话框保持打开 | |

**User's choice:** 立即关闭并生效

| Option | Description | Selected |
|--------|-------------|----------|
| 仅在 SettingsDialog（推荐） | 仅在 SettingsDialog 显示 profile 名称 | ✓ |
| 标题栏/侧边栏也显示 | 在标题栏或侧边栏也显示当前 profile 名称 | |

**User's choice:** 仅在 SettingsDialog

---

## 导入/导出体验

| Option | Description | Selected |
|--------|-------------|----------|
| 单 JSON 文件（推荐） | 导出为单个 JSON 文件 | ✓ |
| ZIP 包 | 导出为 .zip 包 | |

**User's choice:** 单 JSON 文件

| Option | Description | Selected |
|--------|-------------|----------|
| 覆盖当前 profile（推荐） | 导入直接覆盖当前 profile 的所有用户数据 | ✓ |
| 可选覆盖或新建 | 导入时可选择覆盖或创建新 profile | |

**User's choice:** 覆盖当前 profile

| Option | Description | Selected |
|--------|-------------|----------|
| SettingsDialog 内 profile 区域（推荐） | 导入/导出按钮在 SettingsDialog 的 profile 管理区域内 | ✓ |
| 单独"数据管理"区域 | 单独分区管理导入/导出 | |

**User's choice:** SettingsDialog 内 profile 区域

| Option | Description | Selected |
|--------|-------------|----------|
| 系统文件选择器（推荐） | 使用 tauri-plugin-dialog 的 save/open | ✓ |
| 自动保存到固定位置 | 固定保存到应用目录 | |

**User's choice:** 系统文件选择器

---

## 切换并发安全

| Option | Description | Selected |
|--------|-------------|----------|
| Loading 态禁用 UI（推荐） | 切换时显示 loading 状态，禁用所有交互 | ✓ |
| Mutex 排队执行 | Promise-chain mutex 序列化切换操作 | |

**User's choice:** Loading 态禁用 UI

---

## 迁移后旧数据清理

| Option | Description | Selected |
|--------|-------------|----------|
| 迁移后删除旧数据（推荐） | 迁移完成后删除主 store 里的旧数据，用标记 key 防止重复 | ✓ |
| 保留旧数据不删除 | 保留旧数据不动，profile 系统优先读取 profile 文件 | |

**User's choice:** 迁移后删除旧数据

---

## 导出 JSON 格式与校验

| Option | Description | Selected |
|--------|-------------|----------|
| 带元信息的完整格式（推荐） | JSON 带 formatVersion、profileName、exportedAt + data | ✓ |
| 纯数据格式 | 纯数据 JSON，不带元信息 | |

**User's choice:** 带元信息的完整格式

| Option | Description | Selected |
|--------|-------------|----------|
| 基本校验 + 错误提示（推荐） | 校验 formatVersion 和必需字段，失败时提示 | ✓ |
| 确认弹窗 + 校验 | 导入前确认弹窗 + 基本校验 | |

**User's choice:** 基本校验 + 错误提示

| Option | Description | Selected |
|--------|-------------|----------|
| 需要确认（推荐） | 导入前弹出确认弹窗"确定要覆盖当前配置吗？" | ✓ |
| 不需要确认 | 导入直接执行 | |

**User's choice:** 需要确认

**Notes:** 确认弹窗与校验是两个独立步骤——先确认、再校验、最后执行导入

---

## Claude's Discretion

- Profile 数据在独立 Store 文件中的具体 key 结构
- Profile 下拉框和管理区域的具体组件布局和样式
- 迁移检测和执行的时机
- Loading 态的具体 UI 实现
- Profile 文件的 JSON 内部结构
- 导出文件的默认文件名
- formatVersion 的初始值和未来升级策略

## Deferred Ideas

None — discussion stayed within phase scope
