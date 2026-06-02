---
phase: 16-版本管理
plan: 02
status: completed
requirements_completed:
  - VER-01
  - VER-03
  - VER-04
commit: 0a8573a
---

# Plan 02: 前端更新检查 UI

## 完成内容

- 新增 `src/hooks/useUpdateCheck.ts` — 更新检查 hook，store 就绪后自动触发检查
- `TitleBar.tsx` — 齿轮按钮右上角显示红色 6px 圆点（`updateAvailable` prop）
- `SettingsDialog.tsx` — 底部显示版本号文字 + 蓝色左边框更新提示条
- `App.tsx` — 调用 `useUpdateCheck(store)`，传递状态给 TitleBar 和 SettingsDialog

## 验证结果

- `npx tsc --noEmit` TypeScript 编译零错误
- 红点使用 `absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full` 样式
- 更新提示条蓝色左边框 + 半透明背景，点击调用 `open_release_page`
- 网络错误静默忽略，不影响 UX
