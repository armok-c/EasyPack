# Phase 23: 环境标签页与管理 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 23-环境标签页与管理
**Areas discussed:** 环境数据与 Profile 的关系, ManagedFile.content 的含义, 标签页交互与空状态, 启用按钮的确认机制, 追加区域

---

## 环境数据与 Profile 的关系

| Option | Description | Selected |
|--------|-------------|----------|
| Profile Store 内 | 环境数据通过 profileStore 持久化，切换 profile 时也切换 | ✓ |
| Main Store | 环境数据独立于 profile，跨 profile 共享 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Per-project 键 | `projectEnvs:<projectId>` + `projectActiveEnv:<projectId>` | ✓ |
| 聚合键 | 单键存储全部数据 `Record<projectId, ...>` | |

| Option | Description | Selected |
|--------|-------------|----------|
| 包含 | 导出/导入时含环境数据 | ✓ |
| 不包含 | 环境数据不跟随 profile 导出 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 同步清理 | 删除项目时清理环境键和 state | ✓ |
| 保留数据 | 保留孤儿数据以备恢复 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 两个新字段 | projectEnvs + projectActiveEnvs 并列字段 | ✓ |
| 嵌套单字段 | envs: { envs, activeEnvs } 嵌套 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 启动时预加载 | loadProfileDataIntoState 中一次性读取 | ✓ |
| 按需加载 | 选中项目时才加载 | |

---

## ManagedFile.content 的含义

| Option | Description | Selected |
|--------|-------------|----------|
| 文件文本内容 | content 存储完整文件文本 | ✓ |
| 文件路径引用 | 仅存路径，不存内容 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 自动读取 + 无硬限制 | 添加时读取现有文件内容 | ✓ |
| 创建空白文件 | content 初始为空 | |
| 有大小限制 | 如 100KB 硬限制 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 允许空文件 | 文件不存在时 content = "" | ✓ |
| 仅已存在文件 | 不允许添加不存在的文件 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 相对路径 | 如 `config/.env`，支持嵌套 | ✓ |
| 纯文件名 | 如 `.env`，仅根目录 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 禁止重名 | 同一环境内文件名唯一 | ✓ |
| 允许覆盖 | 后添加覆盖先添加 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Rust 后端读写 | 新增 read/write 命令 | ✓ |
| 前端 plugin-fs | 直接用 tauri-plugin-fs | |

---

## 标签页交互与空状态

| Option | Description | Selected |
|--------|-------------|----------|
| 独立标记 | 选中态 + 绿色圆点区分浏览/应用 | ✓ |
| 点击即应用 | 浏览即自动应用 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 引导空状态 | 提示用户创建环境 | ✓ |
| 自动创建默认环境 | 降低初始门槛 | |
| 最小空状态 | 仅显示管理按钮 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 最近邻切换 | 右侧优先，无则左侧 | ✓ |
| 切换到第一个 | 始终跳到首环境 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 占位区域 | Phase 24 实现完整文件列表 | ✓ |
| 包含文件列表 | Phase 23 也实现 ENV-06 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 原生滚动 | CSS overflow-x: auto | ✓ |
| 自定义箭头按钮 | < > 控制滚动 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 右侧固定 | sticky 在标签行右侧 | ✓ |
| 末尾随滚动 | 作为标签页最后一个 item | |

---

## 启用按钮的确认机制

| Option | Description | Selected |
|--------|-------------|----------|
| Toast 即可 | 直接执行，toast 反馈 | ✓ |
| 弹窗确认 | 列出将被覆盖的文件 | |
| 有变化时确认 | 仅与环境已应用不同时弹窗 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 原子操作 | 失败回滚已写入文件 | ✓ |
| 尽力而为+报告 | 跳过失败，报告结果 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 已应用环境 | 显示当前活跃环境名 | ✓ |
| 始终占位文字 | 每次需要用户选择 | |
| 同步浏览标签 | 跟随标签页选择 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 相同时禁用 | 已应用的环境不可重复启用 | ✓ |
| 始终可启用 | 可用于修复被修改的文件 | |
| 重新应用变体 | 按钮文案变化 | |

---

## 追加区域

| Option | Description | Selected |
|--------|-------------|----------|
| 禁止重名 | 创建/重命名时检测 | ✓ |
| 允许重名 | 用户自行管理 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 全面更新 | 圆点迁移 + 下拉框更新 + Toast | ✓ |
| 仅 Toast | 不自动更新标签页/下拉框 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 禁止删除 | 需先切换到其他环境 | ✓ |
| 允许+警告 | 弹窗额外警告，删除后清除活跃记录 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 静默过渡 | 无环境数据即为空 | ✓ |
| 自动创建默认环境 | 降低学习门槛 | |

---

## Claude's Discretion

- 标签页 CSS overflow-x: auto 滚动条样式
- 管理环境模态窗 Dialog + Table 具体布局
- 绿色圆点的 CSS 实现方式
- 引导空状态的具体文案和布局
- 占位区域的文案和样式

## Deferred Ideas

None — 讨论严格限制在 Phase 23 范围内。
