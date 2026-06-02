# Phase 13 Plan 02 -- SUMMARY

**Phase:** 13-迷你悬浮窗
**Plan:** 02
**Status:** Complete
**Commits:**
- `bf7b361` feat(13-02): add float window toggle to TitleBar and tray menu
- `1432b28` feat(13-02): integrate useFloatWindow hook in App.tsx

## What was done

### Task 1: TitleBar 新增悬浮窗 toggle 按钮 + useTray 新增悬浮窗菜单项

- **src/components/TitleBar.tsx** -- 扩展 TitleBarProps 添加 `onFloatToggle` 和 `floatVisible` 两个 prop。导入 `PanelTop` 图标。在 Settings 按钮之前插入 PanelTop 按钮：
  - 按钮使用 `titlebar-button` CSS 类，与现有按钮风格一致
  - `floatVisible=true` 时额外添加 `text-foreground` 类作为激活状态指示
  - `title="悬浮窗"`、`aria-label="切换悬浮窗"`、`aria-pressed={floatVisible}` 无障碍属性

- **src/hooks/useTray.ts** -- 扩展 UseTrayOptions 添加 `onToggleFloat` 和 `floatVisible` 参数：
  - 添加 `onToggleFloatRef` 和 `floatVisibleRef` 防闭包过时（遵循已有 ref 模式）
  - buildMenu 在 toggle-window 项之后生成 `"toggle-float"` MenuItem
  - 菜单文本根据 floatVisible 动态切换："打开悬浮窗"/"关闭悬浮窗"（D-15 toggle 行为）
  - Effect 2 依赖数组添加 `floatVisible`

### Task 2: App.tsx 集成 useFloatWindow hook + 生命周期管理

- **src/App.tsx** -- 完成悬浮窗与主窗口的集成：
  - 导入 `useFloatWindow` hook
  - 调用 `useFloatWindow({ currentProject, commands, onExecute, appWindow })` 解构 `floatVisible`, `toggleFloat`, `destroyFloat`
  - 传递 `onFloatToggle={toggleFloat}` 和 `floatVisible={floatVisible}` 给 TitleBar
  - 传递 `onToggleFloat: toggleFloat` 和 `floatVisible` 给 useTray
  - `onQuit` 回调中先调用 `await destroyFloat()` 再 `await appWindow.destroy()`（D-12：主窗口退出时悬浮窗一起关闭）
  - onCloseRequested 无需修改：closeToTray=true 时只是隐藏主窗口到托盘，悬浮窗独立存活（D-12）

## Verification

- TypeScript 编译无错误（`npx tsc --noEmit`）-- 两个 task 各自验证通过
- 所有 acceptance_criteria 检查通过

## Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/components/TitleBar.tsx` | modified | 新增 PanelTop 按钮 + 扩展 props |
| `src/hooks/useTray.ts` | modified | 新增悬浮窗菜单项 + 扩展接口 |
| `src/App.tsx` | modified | 集成 useFloatWindow hook |

## Requirements Coverage

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| FLOAT-01 (打开入口) | Done | TitleBar 按钮 + 托盘菜单两个入口 |
| FLOAT-06 (实时同步) | Done | useFloatWindow 自动同步 effect 在项目/指令变化时推送 |
| FLOAT-07 (独立关闭) | Done | 悬浮窗关闭不影响主窗口，主窗口关闭到托盘时悬浮窗独立存活 |

## Next Steps

Phase 13 Plan 01 + Plan 02 完成后，悬浮窗功能已全部实现。后续可进入 Phase 14（边缘抽屉）或进行人工验证。
