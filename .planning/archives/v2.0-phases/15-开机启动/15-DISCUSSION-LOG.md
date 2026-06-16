# Phase 15: 开机启动 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 15-开机启动
**Areas discussed:** 启动行为区分, 自愈机制策略, 托盘依赖关系

---

## 启动行为区分

### Q1: 如何区分"开机自启"和"用户手动启动"？

| Option | Description | Selected |
|--------|-------------|----------|
| 命令行参数 --autostart | 注册自启动时附带参数，启动时检查 args | ✓ |
| 环境变量检测 | 通过 Windows 启动环境变量差异判断 | |
| 你来决定 | 让 Claude 选择 | |

**User's choice:** 命令行参数 --autostart

### Q2: 托盘关闭但开机启动开启时如何处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 自动开启托盘 | 自启后自动开启托盘功能 | ✓ |
| 最小化到任务栏 | 自启后最小化到任务栏 | |
| 前置依赖强制 | 必须先开启托盘才能开启自启 | |

**User's choice:** 自动开启托盘

### Q3: 开机自启时窗口隐藏的时机？

| Option | Description | Selected |
|--------|-------------|----------|
| Rust 端 setup 立即隐藏 | WebView 加载前就隐藏，无闪现 | ✓ |
| 前端加载后隐藏 | 等前端就绪再隐藏，可能短暂闪现 | |

**User's choice:** Rust 端 setup 阶段立即隐藏

### Q4: Rust 端隐藏后如何通知前端？

| Option | Description | Selected |
|--------|-------------|----------|
| emit 事件通知前端 | Rust 端 emit 事件，前端 listen 同步状态 | ✓ |
| 前端不感知 | 仅 Rust 处理，前端状态可能不同步 | |

**User's choice:** emit 事件通知前端

---

## 自愈机制策略

### Q1: 自愈机制的触发时机和策略？

| Option | Description | Selected |
|--------|-------------|----------|
| 每次启动静默检查+修复 | 开关开启时每次启动都检查，丢失则静默修复 | ✓ |
| 仅开关操作时检查 | 用户切换开关时检查，异常提示用户 | |
| 你来决定 | Claude 自选策略 | |

**User's choice:** 每次启动静默检查+修复

### Q2: 检测注册表条目丢失的方式？

| Option | Description | Selected |
|--------|-------------|----------|
| 插件 API isEnabled() | 简单直接，依赖插件 API | ✓ |
| 直接读注册表 | Rust 端读取 HKCU 注册表，更底层可靠 | |

**User's choice:** 用插件 API isEnabled()

### Q3: 修复失败时的处理策略？

| Option | Description | Selected |
|--------|-------------|----------|
| 静默重注册，失败不提示 | 重注册失败忽略，下次启动再尝试 | ✓ |
| 失败时提示用户 | toast 提示修复失败 | |

**User's choice:** 静默重注册，失败不提示

### Q4: 自愈检查在哪里执行？

| Option | Description | Selected |
|--------|-------------|----------|
| 纯 Rust 端实现 | setup 阶段执行，前端不感知 | ✓ |
| 前端驱动 + Rust 执行 | 前端通过 invoke 调用检查/修复 | |

**User's choice:** 纯 Rust 端实现

---

## 托盘依赖关系

### Q1: 开机启动开关在 SettingsDialog 中的位置？

| Option | Description | Selected |
|--------|-------------|----------|
| 放在托盘设置分区内 | 作为第三个 Switch，逻辑清晰 | ✓ |
| 独立新分区 | 与托盘、边缘抽屉并列 | |
| 你来决定 | Claude 自选位置 | |

**User's choice:** 放在托盘设置分区内

### Q2: 用户关闭托盘时如何处理已开启的开机启动？

| Option | Description | Selected |
|--------|-------------|----------|
| 级联关闭 | 关闭托盘同时关闭开机启动 | ✓ |
| 提示确认后关闭 | 弹窗确认后同时关闭 | |
| 阻止关闭托盘 | 不允许在自启开启时关闭托盘 | |

**User's choice:** 级联关闭

### Q3: 开机启动开关的启用前提条件？

| Option | Description | Selected |
|--------|-------------|----------|
| 依赖 closeToTray=true | 只有"关闭时隐藏到托盘"开启才可启用 | ✓ |
| 仅依赖 trayEnabled | 只要托盘开启即可 | |
| 你来决定 | Claude 自选依赖逻辑 | |

**User's choice:** 依赖 closeToTray 开关

---

## Claude's Discretion

- tauri-plugin-autostart 的具体注册参数格式
- --autostart 参数在 Rust 端的读取方式
- emit 事件名称的具体命名
- SettingsDialog 中开机启动 Switch 的 UI 文案
- capabilities/default.json 需要追加的 autostart 权限
- Cargo.toml 中 tauri-plugin-autostart 的版本选择

## Deferred Ideas

None — discussion stayed within phase scope
