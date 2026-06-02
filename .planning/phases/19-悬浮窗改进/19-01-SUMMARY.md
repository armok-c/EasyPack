---
phase: 19-悬浮窗改进
plan: 01
status: complete
started: 2026-06-02
completed: 2026-06-02
---

# Plan 19-01: FloatApp 折叠/展开 UI + 紧凑布局

## What was built

悬浮窗从固定展开态升级为可折叠/展开的双态 UI：
- **折叠态**：130px 胶囊形（rounded-full），仅显示项目图标 + 名称 + 展开箭头（ChevronRight）
- **展开态**：紧凑化布局，header 24px、指令行 h-7、缩小内边距和图标尺寸
- **CSS 过渡**：transition-all duration-300 ease-in-out 平滑切换
- **拖拽**：两个状态均支持拖拽移动
- **项目图标**：支持 LucideIcon、file icon (img)、首字母圆圈三种渲染模式
- **窗口 resize**：折叠时 setTimeout(300ms) 后 setSize(130,32)，展开时先 resize 再 CSS 展开

## Key Files

- `src/components/FloatApp.tsx` — 折叠/展开状态机 + 胶囊折叠态 UI + CSS 过渡动画 + 紧凑布局

## Deviations

None — 所有 acceptance criteria 均满足。

## Self-Check: PASSED

- TypeScript 编译通过 (tsc --noEmit)
- Vite 构建成功
