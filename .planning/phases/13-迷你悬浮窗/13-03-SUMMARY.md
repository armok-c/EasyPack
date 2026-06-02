---
phase: 13-迷你悬浮窗
plan: 03
type: execute
status: complete
gap_closure: true
completed: 2026-04-30T10:00:00Z
key-files:
  modified:
    - src/hooks/useFloatWindow.ts
    - src/components/FloatApp.tsx
---

# Plan 13-03: 修复悬浮窗 toggle/close/reopen 逻辑 + 缩小窗口尺寸

## What was built

修复 Phase 13 UAT 中发现的 3 个问题：
1. **托盘菜单切换悬浮窗失败** — `toggleFloat` 中条件 `existing && floatWindowRef.current` 过于严格，ref 失效时无法复用已存在的窗口
2. **悬浮窗关闭/重建不稳定** — 缺少窗口 adopt 机制，关闭过渡期残留窗口无法被回收
3. **悬浮窗尺寸过大** — 280x400 → 220x300

## Changes

### src/hooks/useFloatWindow.ts

- **新增 `adoptFloatWindow` 函数** — 当 `WebviewWindow.getByLabel("float")` 返回窗口但 `floatWindowRef.current` 为 null 时，重新注册 onCloseRequested 和 float:execute 监听器，恢复 ref 引用
- **修改 `toggleFloat` 为三段逻辑** — 正常 toggle (ref+窗口均有效) → adopt (窗口存在但 ref 失效) → 首次创建
- **createFloat 添加失败回滚** — 事件监听器注册包裹在 try-catch 中，失败时调用 `floatWin.destroy()` 销毁已创建的窗口
- **窗口尺寸缩小** — width/minWidth/maxWidth: 280→220, height: 400→300
- **positionFloatTopRight 偏移更新** — posX 计算从 280 改为 220

### src/components/FloatApp.tsx

- **根容器尺寸** — `w-[280px]` → `w-[220px]`, `max-h-[600px]` → `max-h-[400px]`
- **项目名截断宽度** — `max-w-[200px]` → `max-w-[160px]`

## Verification

- TypeScript 编译零错误
- Vite 构建成功，输出 `dist/float.html`
- `adoptFloatWindow` 函数存在于 useFloatWindow.ts
- `width: 220` 存在于 createFloat 窗口参数
- `w-[220px]` 存在于 FloatApp.tsx 根容器
- 旧值 `280` 在 useFloatWindow.ts 中零残留
- `w-[280px]` 在 FloatApp.tsx 中零残留

## Deviations

None. All changes match the plan exactly.
