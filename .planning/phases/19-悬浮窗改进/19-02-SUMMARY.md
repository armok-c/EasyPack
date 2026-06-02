---
phase: 19-悬浮窗改进
plan: 02
status: complete
started: 2026-06-02
completed: 2026-06-02
---

# Plan 19-02: 项目切换通信 + useFloatWindow 扩展

## What was built

实现折叠态项目循环切换 + 主窗口/悬浮窗项目双向同步 + 窗口物理 resize 配合：
- **useFloatWindow 扩展**：新增 projects + onSwitchProject 参数，syncState 推送完整项目列表
- **float:switch-project 事件**：悬浮窗 → 主窗口，携带 projectId 实现项目切换
- **resizeFloat 方法**：通过 operationLock mutex 序列化，调用 Tauri setSize
- **项目循环切换**：折叠态点击项目名称 → (index+1)%length 循环到下一个项目
- **窗口约束**：minWidth 130, minHeight 32，支持折叠态物理尺寸

## Key Files

- `src/hooks/useFloatWindow.ts` — 扩展 syncState 推送 projects + resize + float:switch-project 监听
- `src/components/FloatApp.tsx` — projects state + 项目切换逻辑 + resize 通信
- `src/App.tsx` — 传入 projects + onSwitchProject (selectProject) 到 useFloatWindow

## Deviations

None — 所有 acceptance criteria 均满足。

## Self-Check: PASSED

- TypeScript 编译通过 (tsc --noEmit)
- Vite 构建成功
