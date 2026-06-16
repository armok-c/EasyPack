---
status: passed
phase: 13-迷你悬浮窗
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md
started: 2026-04-29T19:00:00Z
updated: 2026-06-12T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. TitleBar 悬浮窗按钮打开
expected: 点击 TitleBar 的 PanelTop 图标按钮，悬浮窗出现在屏幕右上角，无标题栏装饰，约 280px 宽
result: pass

### 2. 悬浮窗内容 -- 有项目
expected: 在主窗口选中一个项目后，悬浮窗顶部显示项目名，下方竖向排列该项目的指令按钮（图标 + 指令名）
result: pass

### 3. 悬浮窗内容 -- 无项目
expected: 未选中任何项目时，悬浮窗显示空状态：FolderOpen 图标 + "请先在主窗口选择一个项目"
result: pass

### 4. 指令执行 + 闪烁反馈
expected: 在悬浮窗点击任意指令按钮，按钮出现约 200ms 绿色闪烁，系统终端打开并执行对应命令
result: pass

### 5. 项目切换实时同步
expected: 在主窗口切换到另一个项目，悬浮窗立即更新为新项目的名称和指令列表
result: pass

### 6. Toggle 显示/隐藏
expected: 悬浮窗显示时点击 PanelTop 按钮，悬浮窗隐藏（按钮变非激活态）；再次点击，悬浮窗重新显示（按钮变激活态）
result: pass

### 7. 托盘菜单控制
expected: 右键托盘图标，菜单中有"打开悬浮窗"/"关闭悬浮窗"选项，文本随悬浮窗状态动态切换；点击该菜单项可切换悬浮窗
result: pass

### 8. 悬浮窗独立关闭
expected: 点击悬浮窗右上角 X 按钮，悬浮窗关闭，主窗口正常运行不受影响；再次点击 PanelTop 按钮可重新创建悬浮窗
result: pass

### 9. 悬浮窗拖拽移动
expected: 拖拽悬浮窗顶部项目名区域，可自由移动悬浮窗位置
result: pass

### 10. 始终置顶
expected: 悬浮窗始终在其他窗口之上，点击其他应用窗口后悬浮窗仍可见
result: pass

### 11. 不在任务栏显示
expected: 悬浮窗不出现在 Windows 任务栏中，只有主窗口在任务栏显示
result: pass

### 12. 主窗口退出时悬浮窗清理
expected: 通过托盘"退出"关闭应用时，悬浮窗一起关闭；关闭主窗口到托盘（点 X）时，悬浮窗继续存活
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps
