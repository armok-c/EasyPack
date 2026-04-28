---
status: diagnosed
phase: 12-系统托盘
source: [12-VERIFICATION.md]
started: 2026-04-27T15:30:00Z
updated: 2026-04-28T10:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 托盘图标显示
expected: 应用运行后，Windows 系统托盘区域显示 EasyPack 图标，鼠标悬停显示 "EasyPack" Tooltip，右键弹出上下文菜单（显示窗口/隐藏窗口、项目名、最近指令、退出）
result: issue
reported: "右键托盘没有项目名、最近指令、没有显示窗口"
severity: major

### 2. 关闭到托盘行为
expected: 点击 TitleBar X 按钮或按 Alt+F4，窗口隐藏到托盘而不退出；单击托盘图标恢复窗口并聚焦
result: issue
reported: "直接退出了"
severity: blocker

### 3. 最小化到任务栏
expected: 点击最小化按钮，窗口正常最小化到 Windows 任务栏（不被拦截）
result: pass

### 4. 设置开关联动
expected: 点击齿轮按钮打开设置弹窗；关闭"启用系统托盘"开关时，托盘图标消失，"关闭时隐藏到托盘"变灰；关闭按钮恢复为退出行为
result: issue
reported: "开关按钮关闭时不明显；关闭托盘开关后，系统图标还能操作有图标"
severity: major

### 5. 最近指令记录
expected: 执行一条指令后，右键托盘图标，菜单中显示"▸ 执行: {指令名}"；点击该菜单项可重新执行指令
result: issue
reported: "没有显示"
severity: major

## Summary

total: 5
passed: 1
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "右键托盘图标弹出上下文菜单包含显示窗口/隐藏窗口、项目名、最近指令、退出选项"
  status: failed
  reason: "User reported: 右键托盘没有项目名、最近指令、没有显示窗口"
  severity: major
  test: 1
  root_cause: "useTray Effect 2 存在竞态条件：依赖 [currentProject, recentCommands] 变化时更新菜单，但 Effect 1 的异步 createTray() 完成前 trayRef.current 为 null，Effect 2 的 if (!trayRef.current) return 跳过更新。另外，当窗口可见时菜单文字为'隐藏窗口'而非'显示窗口'，可能造成用户困惑。"
  artifacts:
    - path: "src/hooks/useTray.ts"
      issue: "Effect 2 在 trayRef.current 为 null 时跳过菜单更新"
  missing:
    - "Effect 2 需要在 trayRef 可用后重试更新，或 Effect 1 完成后触发菜单重建"

- truth: "点击关闭按钮或 Alt+F4 时窗口隐藏到托盘而非退出，单击托盘图标恢复窗口"
  status: failed
  reason: "User reported: 直接退出了"
  severity: blocker
  test: 2
  root_cause: "最可能原因：store 中保存了 closeToTray=false（之前测试会话遗留），导致 TitleBar handleClose 走 appWindow.close() 而非 appWindow.hide()。同时 onCloseRequested 监听器因 closeToTray=false 而不注册，Alt+F4 也直接退出。需排查：1) store 文件中 closeToTray 实际值；2) 初始状态在 store 加载前的时序窗口问题。"
  artifacts:
    - path: "src/App.tsx"
      issue: "closeToTray 从 store 加载可能为 false，导致关闭行为变成退出"
    - path: "src/components/TitleBar.tsx"
      issue: "handleClose 根据 onCloseBehavior 决定 hide/close，store 加载影响此值"
  missing:
    - "确认 store 文件中 closeToTray 保存值"
    - "考虑在 closeToTray 加载前禁用关闭按钮，或提供安全默认值"

- truth: "关闭启用系统托盘开关后，托盘图标消失，子开关变灰"
  status: failed
  reason: "User reported: 开关按钮关闭时不明显；关闭托盘开关后，系统图标还能操作有图标"
  severity: major
  test: 4
  root_cause: "两个问题：1) Switch 组件未选中状态 bg-input 与背景色对比度不足，关闭状态视觉不清晰；2) useTray Effect 1 的清理函数中 trayRef.current.close() 是异步的，可能未及时完成导致图标残留。"
  artifacts:
    - path: "src/components/ui/switch.tsx"
      issue: "unchecked 状态 bg-input 对比度不足"
    - path: "src/hooks/useTray.ts"
      issue: "Effect 1 cleanup 中异步 close 可能未完成"
  missing:
    - "增强 Switch 未选中状态视觉区分"
    - "确保 tray icon 清理完成后再返回"

- truth: "执行指令后右键托盘菜单显示最近执行的指令条目"
  status: failed
  reason: "User reported: 没有显示"
  severity: major
  test: 5
  root_cause: "与 Issue 1 同根因：useTray 菜单更新机制未正常工作。另外 handleExecuteWithRecent 中 executeCommand 返回 false 时不会调用 addRecentCommand，需确认命令执行是否成功。"
  artifacts:
    - path: "src/hooks/useTray.ts"
      issue: "Effect 2 菜单更新竞态"
    - path: "src/App.tsx"
      issue: "handleExecuteWithRecent 中 executeCommand 失败时跳过 addRecentCommand"
  missing:
    - "修复菜单更新机制后验证"
    - "确认命令执行路径是否成功"
