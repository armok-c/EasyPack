---
status: partial
phase: 11-全局快捷键
source: [11-VERIFICATION.md]
started: "2026-04-27T12:00:00.000Z"
updated: "2026-04-27T12:00:00.000Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. 录制绑定 UI
expected: 编辑模式下点击卡片上的 "+" 号，按下 Ctrl+G，徽章应显示 "Ctrl+G"
result: [pending]

### 2. 全局快捷键触发执行
expected: 非编辑模式下按已绑定快捷键（如 Ctrl+G），系统终端打开并执行对应命令
result: [pending]

### 3. 冲突检测反馈
expected: 重复绑定同一快捷键到另一个指令，显示红色冲突徽章 + toast 错误提示
result: [pending]

### 4. 项目切换更新
expected: 切换到另一个项目后按快捷键，执行当前项目的对应命令（非上一个项目的）
result: [pending]

### 5. 跨重启持久化
expected: 关闭并重启应用，快捷键绑定仍然保留并可用
result: [pending]

### 6. 清除绑定
expected: 编辑模式下 hover 已绑定徽章，点击清除 X 按钮，快捷键不再触发该命令
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
