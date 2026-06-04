---
status: partial
phase: 20-多配置文件管理
source: [20-VERIFICATION.md]
started: 2026-06-04T14:40:00.000Z
updated: 2026-06-04T14:40:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Profile 创建和数据隔离
expected: 创建新 profile 后项目列表为空，切回后数据恢复

### 2. Profile 切换 loading overlay
expected: 全屏半透明模糊 + spinner + "切换配置中..."文字

### 3. Profile 删除
expected: 自动切换到剩余 profile，最后一个禁用删除按钮

### 4. 导出 JSON
expected: 文件选择器弹出，默认文件名 `easypack-{profileName}-{YYYY-MM-DD}.json`，JSON 格式含 formatVersion=1

### 5. 导入 JSON
expected: 文件选择 → window.confirm 确认弹窗 → 数据覆盖并刷新 UI

### 6. 首次启动迁移
expected: 删除 profileMigrationDone 标记后重启，旧数据自动迁移到"默认" profile，项目列表完整保留

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
