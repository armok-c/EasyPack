---
status: diagnosed
phase: 13-迷你悬浮窗
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md
started: 2026-04-29T19:00:00Z
updated: 2026-04-29T19:15:00Z
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
result: issue
reported: "没反应，显示无法创建悬浮窗"
severity: major

### 8. 悬浮窗独立关闭
expected: 点击悬浮窗右上角 X 按钮，悬浮窗关闭，主窗口正常运行不受影响；再次点击 PanelTop 按钮可重新创建悬浮窗
result: issue
reported: "有时会出现无法关闭的情况，主界面打开悬浮窗也会出现无法创建悬浮窗的情况"
severity: major

### 9. 悬浮窗拖拽移动
expected: 拖拽悬浮窗顶部项目名区域，可自由移动悬浮窗位置
result: issue
reported: "悬浮窗太宽太大了我看其他东西"
severity: cosmetic

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
passed: 9
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "托盘菜单点击可切换悬浮窗显示/隐藏"
  status: failed
  reason: "User reported: 没反应，显示无法创建悬浮窗"
  severity: major
  test: 7
  root_cause: "useFloatWindow.ts:163 条件 `if (existing && floatWindowRef.current)` 过于严格。当 Tauri 窗口管理器中 'float' 窗口存在但 ref 为 null（关闭过渡期、部分创建失败等），代码跳过 toggle 分支，落入创建路径，因 label 'float' 已被占用而失败。托盘菜单 action 回调不 await async toggleFloat 也加剧了竞态。"
  artifacts:
    - path: "src/hooks/useFloatWindow.ts"
      issue: "toggleFloat line 163: existing && floatWindowRef.current 双重条件导致窗口无法被复用"
  missing:
    - "当 getByLabel 找到窗口但 ref 为 null 时，应重新领养（adopt）该窗口而非创建新窗口"
    - "重新注册 onCloseRequested 监听器，恢复 ref 引用"

- truth: "悬浮窗可独立关闭，主窗口可重新创建悬浮窗"
  status: failed
  reason: "User reported: 有时会出现无法关闭的情况，主界面打开悬浮窗也会出现无法创建悬浮窗的情况"
  severity: major
  test: 8
  root_cause: "与 Test 7 同一根因。当 createFloat() 部分成功（窗口已创建但后续监听器注册失败）时，floatWindowRef.current 未被设置，onCloseRequested 监听器也未注册，导致关闭按钮行为不确定且无法重新创建。"
  artifacts:
    - path: "src/hooks/useFloatWindow.ts"
      issue: "createFloat 失败时已创建的窗口成为孤儿，ref 未设置，close 监听器未注册"
  missing:
    - "createFloat 应在失败时销毁已创建的窗口（rollback）"
    - "toggleFloat 应在 ref 失效时 adopt 现有窗口"

- truth: "悬浮窗尺寸合理不遮挡其他内容"
  status: failed
  reason: "User reported: 悬浮窗太宽太大了我看其他东西"
  severity: cosmetic
  test: 9
  root_cause: "默认尺寸 width:280px + height:400px 对于迷你悬浮窗偏大，用户觉得遮挡视线。"
  artifacts:
    - path: "src/hooks/useFloatWindow.ts"
      issue: "WebviewWindow 创建参数 height:400 偏大"
    - path: "src/components/FloatApp.tsx"
      issue: "max-h-[600px] 和 w-[280px] 尺寸偏大"
  missing:
    - "缩小悬浮窗默认尺寸（宽度 ~220px，高度自适应内容或默认 ~300px）"
