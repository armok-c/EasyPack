# Phase 19: 悬浮窗改进 - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

将 Phase 13 创建的悬浮窗从固定展开态升级为可折叠/展开的紧凑布局。折叠态为胶囊形状（130px 宽），仅显示项目图标+名称+展开箭头；展开态保持现有 220px 竖向指令列表。折叠态点击项目名称可循环切换项目（主窗口同步），点击其他区域展开。展开/折叠动画为 CSS 收缩过渡 + Tauri 窗口 resize 两步执行。

涉及需求: FLOAT-01, FLOAT-02, FLOAT-03, FLOAT-04, FLOAT-05

</domain>

<decisions>
## Implementation Decisions

### 折叠态外观与尺寸
- **D-01:** 折叠态仅显示项目图标 + 名称 + 右侧展开箭头（最紧凑方案，约 28-32px 高）
- **D-02:** 折叠态宽度收窄到约 130px（展开态保持 220px），需要 Tauri 窗口 resize 配合
- **D-03:** 折叠态圆角使用 rounded-full（胶囊形状），与展开态 rounded-lg 视觉区分
- **D-04:** 折叠态内部布局：左图标（14px）+ 中名称（text-[11px]）+ 右展开箭头（ChevronDown）
- **D-05:** 折叠态背景风格与展开态统一（bg-background），不做半透明磨砂
- **D-06:** 折叠态项目图标复用侧边栏的项目图标（同 getIconByName 逻辑），无图标时显示首字母圆圈
- **D-07:** 展开态布局保持现有样式不变，但内边距和字体可进一步紧凑化（FLOAT-01）

### 折叠/展开触发方式
- **D-08:** 折叠态：点击项目名称区域 → 循环切换到下一个项目；点击 header 其他空白区域/展开箭头 → 展开窗口
- **D-09:** 展开态：点击 header 空白区域 → 折叠；点击关闭按钮 → 关闭悬浮窗
- **D-10:** 折叠和展开的交互区域明确分离——项目名称区 = 切换项目，其余 header 区域 = 折叠/展开

### 折叠态项目切换交互
- **D-11:** 点击项目名称循环切换到下一个项目（按侧边栏顺序，循环到最后一个后回到第一个）
- **D-12:** 悬浮窗切换项目后主窗口同步切换（通过 Tauri 事件通知主窗口更新 currentProject）
- **D-13:** 悬浮窗需要主窗口推送完整项目列表（不仅是当前项目），才能实现循环切换
- **D-14:** 主窗口切换项目时也需同步更新悬浮窗显示的项目名和指令列表

### 动画与窗口缩放
- **D-15:** 动画分两步执行：① CSS 内容收缩过渡 → ② Tauri 窗口 resize 瞬间完成
- **D-16:** CSS 过渡使用 scaleY/max-height 收缩动画，展开时反向展开
- **D-17:** 动画时长各约 300ms（折叠 300ms + 展态 300ms），快速响应
- **D-18:** Tauri 窗口 resize 瞬间完成（一步 setSize），不模拟动画，仅依赖 CSS 过渡提供平滑感

### Claude's Discretion
- 展开态紧凑化的具体程度（FLOAT-01：减少内边距、缩小字体到什么程度）
- 折叠态首字母圆圈的具体样式（背景色、字号、尺寸）
- CSS 收缩动画的具体实现（scaleY vs max-height vs clip-path）
- 窗口 resize 的时机（CSS 过渡结束后立即 resize，还是用 transitionend 事件）
- 浮动窗口位置记忆（Phase 13 D-11 决定不记住位置，但折叠/展开时位置是否需要调整）
- 无项目时折叠态的空状态显示
- 折叠态展开箭头图标的最终选择（ChevronDown / ChevronRight / Maximize2 等）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/components/FloatApp.tsx` — 悬浮窗根组件，需添加折叠/展开状态、折叠态 UI、项目切换逻辑、动画
- `src/hooks/useFloatWindow.ts` — 悬浮窗创建/管理 hook，需添加窗口 resize、项目列表推送、项目切换事件监听
- `src/App.tsx` — 需处理来自悬浮窗的项目切换请求、推送完整项目列表

### 现有模式参考
- `src/components/FloatApp.tsx` — 当前展开态布局（220px、header 28px、指令行 h-8、startDragging 拖拽、事件通信）
- `src/hooks/useFloatWindow.ts` — 窗口创建/显示/隐藏/销毁生命周期、positionFloatTopRight、operationLock mutex
- `src/hooks/useProject.ts` — currentProject 和 commands 管理、项目切换逻辑
- `src/lib/icons.ts` — getIconByName 图标映射，折叠态复用
- `src/components/Sidebar.tsx` — 项目图标渲染模式（含首字母圆圈 fallback）

### Prior Phase Context
- `.planning/phases/13-迷你悬浮窗/13-CONTEXT.md` — 悬浮窗原始设计决策（所有 D-01 ~ D-17）
- `.planning/phases/18-快捷键设置面板/18-CONTEXT.md` — ShortcutPanel 窗口操作包含"切换悬浮窗"

### Requirements
- `.planning/REQUIREMENTS.md` — FLOAT-01 ~ FLOAT-05
- `.planning/ROADMAP.md` — Phase 19 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FloatApp.tsx` — 已有完整的事件监听（float:state-update）、拖拽（startDragging）、指令执行（emit float:execute）、关闭（emit float:close-requested）。折叠态可在此基础上添加折叠/展开状态机
- `useFloatWindow.ts` — 已有 createFloat（WebviewWindow 创建）、toggleFloat（show/hide）、destroyFloat、syncState（推送项目/指令）。需扩展：推送完整项目列表、监听项目切换事件、窗口 resize
- `getIconByName` — 图标映射函数，折叠态复用同一逻辑
- `Sidebar.tsx` — 已有项目图标渲染逻辑（含首字母圆圈 fallback），可参考

### Established Patterns
- 主窗口与悬浮窗通过 Tauri 事件系统通信（emitTo/listen）
- 状态同步：主窗口通过 emitTo("float", "float:state-update", {...}) 推送
- 悬浮窗通过 emit("float:execute") 和 emit("float:close-requested") 反向通知
- 窗口操作通过 operationLock Promise-chain mutex 序列化
- 窗口位置通过 primaryMonitor + LogicalPosition 计算
- 无边框窗口拖拽使用 startDragging()

### Integration Points
- `FloatApp.tsx` — 添加折叠/展开状态、折叠态 UI 渲染、项目切换逻辑、CSS 动画
- `useFloatWindow.ts` — 扩展 syncState 推送完整项目列表、添加 resize 能力、监听项目切换事件
- `App.tsx` — 监听 float:switch-project 事件、更新 currentProject、同步回推
- `tauri.conf.json` — 可能需要调整悬浮窗窗口配置（minWidth 等约束）
- `vite.config.ts` — 无需修改（float.html 入口已存在）

</code_context>

<specifics>
## Specific Ideas

- 折叠态像一个小胶囊浮动在屏幕上（rounded-full + 130px 宽），视觉上与展开态明显区分
- 展开箭头使用 ChevronDown 图标（折叠态指示可展开），展开态使用 ChevronUp（指示可折叠）
- 无项目时折叠态显示 "EasyPack" 文字 + FolderOpen 图标，点击无响应
- 动画分两步：CSS 收缩（300ms ease-in-out）→ Tauri setSize（瞬间），展开时反向
- 主窗口需要向悬浮窗推送 `{ project, projects, commands }` 而非当前的 `{ project, commands }`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-悬浮窗改进*
*Context gathered: 2026-06-02*
