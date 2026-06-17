# Phase 21: 打包版本号更新 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 21-打包版本号更新
**Areas discussed:** 实现机制, 同步范围, 错误处理

---

## 实现机制

| Option | Description | Selected |
|--------|-------------|----------|
| 修改 beforeBuildCommand | 在 tauri.conf.json 的 beforeBuildCommand 中添加版本同步脚本 | ✓ |
| Rust build.rs | 在 build.rs 中解析 package.json 并修改 tauri.conf.json | |
| npm prebuild hook | 添加 "prebuild" script 自动触发 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 保留更新 | 同步后保留更新后的版本号并提交 | ✓ |
| 构建后还原 | 构建前写、构建后还原，避免未预期修改 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 零依赖 Node.js 脚本 | fs + JSON.parse/stringify，~30 行 | ✓ |
| 使用 semver 包校验 | 引入 semver npm 包验证版本号格式 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 只替换 version 字段 | 保留所有其他字段和格式 | ✓ |
| 全文重写 | 完全重新序列化写入 | |

---

## 同步范围

| Option | Description | Selected |
|--------|-------------|----------|
| 只同步 tauri.conf.json | 满足 VER-05 即可 | |
| 同时同步 Cargo.toml | 三个文件版本保持一致 | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| 正则替换 | `/^version\s*=\s*"[^"]*"/m` 匹配替换 | ✓ |
| 引入 toml 解析库 | smol-toml 或 @iarna/toml | |

| Option | Description | Selected |
|--------|-------------|----------|
| 不做校验 | 原样复制 package.json version | ✓ |
| 严格 semver 校验 | 正则验证 x.y.z 格式 | |
| 宽松校验 | 只检查非空 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过相同 | 版本相同时不写入 | ✓ |
| 始终写入 | 每次都覆盖 | |

---

## 错误处理

| Option | Description | Selected |
|--------|-------------|----------|
| 构建失败并报错 | process.exit(1) + 明确错误信息 | ✓ |
| 警告但继续构建 | 打印警告但 exit(0) | |

| Option | Description | Selected |
|--------|-------------|----------|
| 构建失败并报错 | tauri.conf.json/Cargo.toml 不存在/不可写时终止 | ✓ |
| 跳过失败的文件 | 警告并跳过 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 构建失败并报错 | Cargo.toml 缺少 version 字段时终止 | ✓ |
| 跳过 Cargo.toml | 只更新 tauri.conf.json | |

| Option | Description | Selected |
|--------|-------------|----------|
| 成功静默，失败报错 | Unix 哲学 | |
| 成功也输出变更摘要 | 方便确认实际变更 | ✓ |

## Claude's Discretion

无 —— 所有决策均由用户明确选择。

## Deferred Ideas

无 —— 讨论严格限制在 Phase 21 范围内。
