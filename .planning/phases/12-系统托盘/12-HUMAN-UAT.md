---
status: partial
phase: 12-系统托盘
source: [12-VERIFICATION.md]
started: 2026-04-27T15:30:00Z
updated: 2026-04-27T15:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 托盘图标显示
expected: 应用运行后，Windows 系统托盘区域显示 EasyPack 图标，鼠标悬停显示 "EasyPack" Tooltip，右键弹出上下文菜单（显示窗口/隐藏窗口、项目名、最近指令、退出）
result: [pending]

### 2. 关闭到托盘行为
expected: 点击 TitleBar X 按钮或按 Alt+F4，窗口隐藏到托盘而不退出；单击托盘图标恢复窗口并聚焦
result: [pending]

### 3. 最小化到任务栏
expected: 点击最小化按钮，窗口正常最小化到 Windows 任务栏（不被拦截）
result: [pending]

### 4. 设置开关联动
expected: 点击齿轮按钮打开设置弹窗；关闭"启用系统托盘"开关时，托盘图标消失，"关闭时隐藏到托盘"变灰；关闭按钮恢复为退出行为
result: [pending]

### 5. 最近指令记录
expected: 执行一条指令后，右键托盘图标，菜单中显示"▸ 执行: {指令名}"；点击该菜单项可重新执行指令
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
