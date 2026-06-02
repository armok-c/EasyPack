---
status: root_cause_found
trigger: 悬浮窗有许多bug排查一下
created: 2026-05-09
updated: 2026-05-09
---

## Symptoms

- **expected**: 点击 TitleBar PanelTop 按钮或托盘菜单，悬浮窗正常切换显示/隐藏；关闭后可重新打开
- **actual**: Toggle 开关失灵（TitleBar 按钮 + 托盘菜单都有问题），关闭/重开异常
- **errors**: 出现 toast "无法创建悬浮窗"
- **timeline**: Phase 13-03 已修复 CR-01（missing await）和 adopt 机制 + 缩小窗口，但问题仍存在
- **reproduction**: 通过 TitleBar 按钮或托盘菜单操作悬浮窗

## Code Analysis (Initial)

Key files:
- `src/hooks/useFloatWindow.ts` - 悬浮窗 hook（toggle/create/destroy/adopt）
- `src/hooks/useTray.ts` - 托盘菜单，调用 onToggleFloatRef
- `src/components/FloatApp.tsx` - 悬浮窗 UI 组件
- `src/components/TitleBar.tsx` - 标题栏，调用 onFloatToggle

Identified potential root causes:

1. **Race condition: create vs adopt** - toggleFloat rapidly: Call 1 enters create path (isCreatingRef=true, createFloat starts), Call 2 sees getByLabel return the new window but floatWindowRef.current=null -> enters adopt path -> BOTH run on same window, double listener registration
2. **No concurrency guard on toggle/adopt** - isCreatingRef only guards create path, toggle show/hide and adopt have no mutex
3. **Stale floatVisible in useCallback closure** - toggleFloat captures floatVisible via useCallback. Between setFloatVisible() and re-render, the old callback sees stale state
4. **adoptFloatWindow doesn't cleanupListeners() first** - may register duplicate listeners if called when old listeners exist
5. **Closing window may return from getByLabel during destruction** - window starts async close, getByLabel still finds it, triggers adopt on dying window

## Evidence

- 2026-05-09: Read useFloatWindow.ts — confirmed isCreatingRef only guards create path (L229-230), adopt path has no guard (L206-226)
- 2026-05-09: Read useFloatWindow.ts — confirmed adoptFloatWindow (L165-185) does NOT call cleanupListeners() before registering new listeners
- 2026-05-09: Read useFloatWindow.ts — confirmed toggleFloat is async (L188) with no mutex/serialization between concurrent calls
- 2026-05-09: Read FloatApp.tsx — confirmed handleClose calls floatWindow.close() (L55), triggers onCloseRequested in main window
- 2026-05-09: Read useFloatWindow.ts — confirmed onCloseRequested callback (L149-153) nullifies ref and cleans up BEFORE window is actually destroyed
- 2026-05-09: Read useTray.ts — confirmed tray uses ref pattern correctly (L59-62), tray menu always gets latest onToggleFloat
- 2026-05-09: Read TitleBar.tsx — confirmed TitleBar passes onFloatToggle directly to onClick (L69), no ref pattern but gets fresh prop on each render

## Current Focus

hypothesis: "确认根因：toggleFloat 缺乏并发互斥保护，create/adopt/toggle 三条路径可以互相干扰。核心问题是：(1) isCreatingRef 只保护 create，adopt 无守卫；(2) adopt 不清理旧监听器导致双重注册；(3) getByLabel 在窗口创建/关闭过渡期返回非 null 结果触发错误路径。"
test: "逻辑推演完成，所有三个症状均可由上述竞态解释"
expecting: "需要：(1) 添加全局 mutex 序列化 toggleFloat 调用；(2) adopt 前清理旧监听器；(3) 正确处理 getByLabel 在过渡期的不确定返回值"
next_action: "apply fix"

## Resolution

root_cause: |
  toggleFloat 函数缺乏并发互斥保护（mutex），导致三条路径（create/adopt/toggle show-hide）可以互相干扰。
  具体问题：
  1. isCreatingRef 只保护 create 路径（L229-230），adopt 路径完全无守卫（L206-226）
  2. adoptFloatWindow（L165-185）不先调用 cleanupListeners()，可能造成双重监听器注册
  3. getByLabel("float") 在窗口创建中/关闭中的过渡期仍返回非 null 结果，导致错误的路径选择
  4. toggleFloat 是 async 函数，两次快速调用之间没有序列化机制
  这四个缺陷叠加导致：toggle 失灵、关闭/重开异常、以及 toast "无法创建悬浮窗"

fix: |
  对 useFloatWindow.ts 进行以下修复：
  1. 添加 operationLock (Promise chain mutex) 序列化所有 toggleFloat 调用
  2. adoptFloatWindow 入口处先调用 cleanupListeners()
  3. 在 adopt 路径中先判断窗口是否有效（isVisible 或 try catch win.getProperties()）
  4. 在 create 失败时，尝试销毁可能存在的残留窗口后再重试一次

specialist_hint: typescript
