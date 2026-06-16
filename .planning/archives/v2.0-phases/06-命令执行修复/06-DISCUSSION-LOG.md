# Phase 6: 命令执行修复 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 06-命令执行修复
**Areas discussed:** 命令构造与调用方式, 终端检测与回退策略, 错误反馈与诊断

---

## 命令构造与调用方式

| Option | Description | Selected |
|--------|-------------|----------|
| A. raw_arg | 用 raw_arg() 绕过 Rust 自动转义，保留 cd /d + && 结构，直接传原始命令行字符串给 WT/cmd | ✓ |
| B. 临时 .bat 文件 | 将完整命令写入临时 .bat 文件然后执行，彻底规避引号和转义问题 | |
| C. 你来决定 | Claude discretion | |

**User's choice:** A. raw_arg (推荐)
**Notes:** Rust 官方推荐的 cmd.exe 调用方式，精准控制命令行参数，无需管理临时文件

---

## 终端检测与回退策略

| Option | Description | Selected |
|--------|-------------|----------|
| 静默回退 | 保持现有逻辑：先试 wt spawn，失败则回退 cmd.exe | ✓ |
| 预先检测 | 先 where wt.exe 检测 WT 是否安装 | |
| 你来决定 | Claude discretion | |

**User's choice:** 静默回退 (推荐)
**Notes:** 简单直接，用户无感知

---

## 错误反馈与诊断

| Option | Description | Selected |
|--------|-------------|----------|
| 简单提示 | 保持现有的简单 toast 错误提示 | ✓ |
| 分类错误提示 | 区分终端未找到、路径不存在等错误类型 | |
| 你来决定 | Claude discretion | |

**User's choice:** 简单提示 (推荐)
**Notes:** 修复后错误概率极低，复杂错误分类投入产出比不高

---

## Claude's Discretion

- `build_full_command` 函数的具体引号转义细节
- WT 和 cmd 路径的 `raw_arg` 参数拼接格式
- 测试用例的更新（适配新的调用方式）
- 是否需要 `#[cfg(windows)]` 条件编译

## Deferred Ideas

None — discussion stayed within phase scope
