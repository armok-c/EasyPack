# Phase 16: 版本管理 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 16-版本管理
**Areas discussed:** 版本号显示位置, 更新通知 UI, 版本号管理策略

---

## 版本号显示位置

| Option | Description | Selected |
|--------|-------------|----------|
| 设置弹窗底部 | 在设置弹窗底部加一行小字 "v0.1.0"，不占用 TitleBar 空间 | ✓ |
| TitleBar 标题文字旁 | 在 TitleBar 拖拽区域显示小字版本号，空间可能拥挤 | |
| 两者都显示 | 设置弹窗底部 + TitleBar 可点击版本号按钮 | |

**User's choice:** 设置弹窗底部（推荐）
**Notes:** TitleBar 空间已紧凑，版本号不需要常驻可见

## 更新通知 UI

| Option | Description | Selected |
|--------|-------------|----------|
| 齿轮图标红点 + 设置弹窗提示条 | 齿轮红点提示有更新，打开设置看到提示条 | ✓ |
| Toast 通知条 | 应用右下角弹出通知条 | |
| 两者组合 | 红点 + toast 双重提醒 | |

**User's choice:** 齿轮图标红点 + 设置弹窗提示条（推荐）

## 通知行为

| Option | Description | Selected |
|--------|-------------|----------|
| 持续显示直到处理 | 红点一直显示直到用户更新或忽略 | ✓ |
| 关闭设置后消失 | 关闭设置弹窗后红点消失 | |

**User's choice:** 持续显示直到处理（推荐）

## 跳转目标

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Releases 页 | 用浏览器打开 GitHub Releases latest 页面 | ✓ |
| 应用内显示更新日志 | 嵌入 WebView 显示 Release Notes | |

**User's choice:** GitHub Releases 页（推荐）

## 版本号管理策略

| Option | Description | Selected |
|--------|-------------|----------|
| 手动同步三文件 | 发布时手动改 Cargo.toml、package.json、tauri.conf.json | ✓ |
| 同步脚本 | 写 Node 脚本自动同步 | |
| Claude 决定 | 不关心，Claude 决定 | |

**User's choice:** 手动同步三文件（推荐）

## 版本号读取来源

| Option | Description | Selected |
|--------|-------------|----------|
| Rust 端读取 tauri.conf.json | Tauri 提供 API 读取 version，通过 command 返回前端 | ✓ |
| 前端读取 package.json | 前端直接读 package.json | |
| Claude 决定 | 不关心实现细节 | |

**User's choice:** Rust 端读取 tauri.conf.json（推荐）

---

## Claude's Discretion

- Rust 端获取 version 的具体 API
- GitHub Releases API 调用实现（Rust vs 前端）
- semver 版本比较逻辑实现
- 24h 缓存存储方式
- 红点组件实现
- 设置弹窗提示条样式
- 网络错误静默失败策略
- capabilities/default.json 权限

## Deferred Ideas

None — discussion stayed within phase scope
