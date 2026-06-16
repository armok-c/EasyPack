# Phase 19: 悬浮窗改进 — Research

**Phase:** 19
**Date:** 2026-06-02
**Status:** Complete

---

## Research Summary

Phase 19 将 Phase 13 创建的悬浮窗从固定展开态升级为可折叠/展开的紧凑布局。核心改造集中在 3 个文件：`FloatApp.tsx`（UI + 交互）、`useFloatWindow.ts`（窗口管理 + 事件通信）、`App.tsx`（项目切换同步）。

---

## Current Codebase Analysis

### FloatApp.tsx (122 行)
- **结构**: 单一组件，无子组件拆分
- **尺寸**: 固定 220px 宽，max-h-[400px]
- **Header**: 28px 高，包含项目名（左）+ 关闭按钮（右），整体为拖拽区域
- **内容**: 指令行列表（h-8 每行），空状态用 FolderOpen 图标
- **事件**: 监听 `float:state-update`（接收 `{project, commands}`），emit `float:execute` 和 `float:close-requested`
- **拖拽**: 复用 TitleBar 的 `startDragging()` 模式
- **闪烁反馈**: 200ms 绿色闪烁确认指令已触发

### useFloatWindow.ts (292 行)
- **窗口创建**: `new WebviewWindow("float", {...})`，固定 220px 宽，300px 高
- **窗口约束**: minWidth/maxWidth 都是 220px，resizable: false
- **位置**: `positionFloatTopRight` 计算主显示器右上角位置（16px 偏移）
- **通信**: `emitTo("float", "float:state-update", {project, commands})`
- **同步**: currentProject/commands 变化时自动 syncState
- **生命周期**: createFloat → toggleFloat(show/hide) → destroyFloat
- **并发控制**: operationLock Promise-chain mutex 序列化所有窗口操作
- **监听**: `float:execute`（执行指令）+ `float:close-requested`（关闭请求）

### App.tsx 关联
- `useFloatWindow({ currentProject, commands, onExecute })` 初始化
- 切换项目时 useFloatWindow 自动同步状态到悬浮窗
- 悬浮窗切换项目需要 App 监听新事件 `float:switch-project`

### 关键约束
- 悬浮窗是独立 WebviewWindow（独立 React 树），不共享主窗口状态
- 通信完全通过 Tauri 事件系统（emitTo/listen）
- 窗口操作必须通过 operationLock 序列化

---

## Technical Approach

### 折叠/展开状态机

```
EXPANDED ↔ COLLAPSED
```

- **EXPANDED**: 当前 220px 宽度的完整指令列表
- **COLLAPSED**: 130px 宽胶囊形，仅显示图标+名称+展开箭头

状态存储在 FloatApp 内部 `useState<"expanded" | "collapsed">`。

### 窗口 Resize 策略

折叠/展开需要改变窗口物理尺寸。Tauri 的 `WebviewWindow.setSize()` 可直接调用：

```typescript
// 折叠
await win.setSize(new LogicalSize(130, 32));
// 展开
await win.setSize(new LogicalSize(220, desiredHeight));
```

**两步动画（D-15/D-16/D-17/D-18）:**
1. CSS 过渡动画（300ms ease-in-out）控制内容收缩/展开的视觉效果
2. 动画结束后 Tauri setSize 瞬间调整窗口物理尺寸

**实现方案**: 使用 `transitionend` 事件在 CSS 过渡完成后触发 resize。折叠时先播放 CSS 收缩动画 → resize 到小尺寸；展开时先 resize 到大尺寸 → CSS 展开动画。

实际上更好的方案是：
- 折叠：CSS 过渡开始 → transitionend 后 setSize
- 展开：先 setSize → CSS 过渡展开（需要 requestAnimationFrame 让浏览器先渲染新尺寸）

### 项目切换通信

折叠态需要完整项目列表才能循环切换。当前 `float:state-update` 只传 `{project, commands}`，需扩展为 `{project, projects, commands}`。

新增事件：
- `float:switch-project` — 悬浮窗 → 主窗口，携带目标 projectId
- 主窗口监听后更新 currentProject，触发 syncState 推送回悬浮窗

### 拖拽（FLOAT-05）

当前已有拖拽功能（`startDragging()`）。折叠态仍需保持拖拽能力——整个胶囊体为拖拽区域（项目名称区除外）。

### 展开态紧凑化（FLOAT-01）

- Header 高度从 28px → 24px
- 指令行从 h-8 → h-7
- 字体从 text-xs → 保持（已经是最小合理尺寸）
- 内边距从 p-2 → px-1.5 py-1

---

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|------|------|------|
| CSS 动画与 Tauri resize 时序不匹配 | 折叠/展开时可能出现短暂闪烁 | 使用 transitionend 事件确保时序正确 |
| 折叠态窗口太小影响拖拽体验 | 用户难以操作 | 胶囊体整体为拖拽区域，增大可操作面积 |
| 窗口 resize 后位置偏移 | 窗口可能超出屏幕边界 | resize 后重新计算位置确保在屏幕内 |
| 项目列表推送增加事件负载 | 轻微性能影响 | 项目列表通常 <20 个，JSON 体积可忽略 |

---

## Validation Architecture

本阶段为纯前端 UI 改造，无后端变更。验证重点：

1. **功能验证**: 折叠/展开切换、项目循环切换、动画流畅
2. **兼容验证**: 现有拖拽、指令执行、关闭功能不受影响
3. **边界验证**: 无项目时的空状态、快速连续操作

---

## RESEARCH COMPLETE

- 3 个核心改造文件已识别：FloatApp.tsx, useFloatWindow.ts, App.tsx
- 折叠/展开方案已明确：CSS 动画 + Tauri resize 两步执行
- 项目切换通信需新增事件：`float:switch-project`
- 无后端变更，无新依赖
