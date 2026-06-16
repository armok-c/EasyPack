# Phase 18: 快捷键设置面板 - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

将 v1.2 的单指令快捷键绑定升级为 VS Code 风格的完整快捷键管理面板。用户可以在独立 Dialog 中查看所有可绑定操作（指令执行 + 窗口操作 + 项目操作），点击后按键录制新快捷键，支持搜索、按分类筛选、全部重置。移除 CommandDialog 中的快捷键绑定 UI，统一到面板管理。

涉及需求: KBD-01, KBD-02, KBD-03, KBD-04, KBD-05, KBD-06

</domain>

<decisions>
## Implementation Decisions

### 面板入口与位置
- **D-01:** 独立 ShortcutPanel Dialog — 与 SettingsDialog 分离，避免设置弹窗过长
- **D-02:** 入口为 SettingsDialog 底部的"快捷键设置..."按钮 — 点击后关闭设置弹窗并打开快捷键面板
- **D-03:** 面板布局为分组列表 + 搜索框 — 顶部搜索框，下方按分类（指令执行/窗口操作/项目操作）折叠显示，每个操作占一行（左侧操作名，右侧快捷键标签），点击快捷键标签进入录制
- **D-04:** 面板尺寸为紧凑弹窗 — 与 SettingsDialog 类似宽度（约 380-450px），内容区域滚动
- **D-05:** 快捷键统一在面板管理 — 移除 CommandDialog 中的快捷键绑定 UI，指令的快捷键绑定和窗口/项目操作绑定集中在同一个面板
- **D-06:** 移除 CommandDialog 中现有的快捷键录制按钮和相关 UI — CommandDialog 专注于指令内容编辑

### 可绑定操作的分类体系
- **D-07:** 3 个分类：① 指令执行 ② 窗口操作 ③ 项目操作
- **D-08:** 窗口操作包含 2 个固定操作：显示/隐藏主窗口、切换悬浮窗
- **D-09:** 项目操作包含 3 个固定操作：切换上一个项目、切换下一个项目、打开当前项目文件夹
- **D-10:** 指令执行为动态列表 — 显示用户已添加的所有指令（全局 + 当前项目级），项目切换时自动更新项目级指令
- **D-11:** 统一 ShortcutAction 类型 — 定义 `{ id: string, label: string, category: 'command'|'window'|'project', handler: () => void }`，窗口/项目操作用固定 id（如 `window.toggle-visibility`），指令操作用动态 id（如 `command.{commandId}`）

### 快捷键录制与冲突处理
- **D-12:** 单次按键确认 — 点击快捷键区域后进入录制状态，按下有效组合键立即确认绑定，Esc 取消录制
- **D-13:** 录制中视觉反馈 — 快捷键区域显示"按下快捷键..."文字 + 虚线边框闪烁动画
- **D-14:** 冲突处理为警告 + 用户选择 — 检测到冲突时在快捷键区域下方显示黄色警告条"此快捷键已分配给 [操作名]，继续将覆盖"，用户点击"确认覆盖"或"取消"
- **D-15:** 沿用 v1.2 按键限制 — 必须有至少一个修饰键（Ctrl/Alt/Shift），最多 3 键组合，单键不可绑定

### 默认快捷键与重置策略
- **D-16:** 不预设任何默认快捷键 — 所有操作初始状态为"未绑定"，用户完全自定义
- **D-17:** 重置功能为"全部重置" — 面板底部一个"重置所有快捷键"按钮，清除所有绑定恢复到未绑定状态
- **D-18:** 重置需要确认弹窗 — 点击后弹出确认 Dialog"确定要清除所有快捷键绑定吗？此操作不可撤销"

### Claude's Discretion
- ShortcutPanel Dialog 的具体实现方式（组件文件结构、状态管理方式）
- ShortcutAction 注册表的初始化和更新时机
- 搜索/筛选的具体实现（实时搜索 vs 防抖、搜索范围包括操作名和分类名）
- 分组列表的折叠/展开状态管理
- 面板打开时的初始滚动位置
- 录制状态下对全局快捷键的临时禁用策略
- 快捷键数据的持久化结构（独立的 store key 还是合并到现有 store）
- 窗口操作和项目操作 handler 的具体实现（如何调用 App 层的回调函数）
- CommandDialog 中移除快捷键 UI 后的布局调整

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/components/SettingsDialog.tsx` — 底部添加"快捷键设置..."按钮入口
- `src/components/CommandDialog.tsx` — 移除快捷键绑定 UI（录制按钮等）
- `src/hooks/useGlobalShortcuts.ts` — 需扩展支持窗口/项目操作的快捷键注册
- `src/lib/shortcutUtils.ts` — 已有 keyboardEventToShortcut / shortcutToDisplay 转换函数，直接复用
- `src/lib/types.ts` — 需新增 ShortcutAction 类型定义
- `src/App.tsx` — 需传递窗口/项目操作回调给 ShortcutPanel

### 新增文件（预期）
- `src/components/ShortcutPanel.tsx` — 快捷键设置面板主组件（独立 Dialog）
- `src/hooks/useShortcutActions.ts` — ShortcutAction 注册表 hook（构建操作列表、管理绑定状态）

### 现有模式参考
- `src/hooks/useGlobalShortcuts.ts` — OS 级快捷键注册/反注册生命周期管理
- `src/lib/shortcutUtils.ts` — 快捷键格式转换工具（keyboardEventToShortcut、shortcutToDisplay）
- `src/lib/types.ts` — CommandItem 接口（已有 shortcut?: string 字段模式）
- `src/components/SettingsDialog.tsx` — Dialog 分区布局模式、Switch 组件用法
- `src/hooks/useKeyboard.ts` — 应用级键盘事件处理（数字键 1-9 快捷指令）

### Prior Phase Context
- `.planning/phases/17-多行脚本指令/17-CONTEXT.md` — CommandDialog 改造模式
- `.planning/phases/16-版本管理/16-CONTEXT.md` — SettingsDialog 底部区域扩展模式
- `.planning/phases/15-开机启动/15-CONTEXT.md` — SettingsDialog Switch 添加模式

### Requirements
- `.planning/REQUIREMENTS.md` — KBD-01 ~ KBD-06
- `.planning/ROADMAP.md` — Phase 18 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGlobalShortcuts.ts` — 已有完整的 OS 级快捷键注册/反注册生命周期，需扩展支持窗口/项目操作
- `shortcutUtils.ts` — 已有 keyboardEventToShortcut（KeyboardEvent → Tauri Accelerator）和 shortcutToDisplay（Tauri → 显示格式），直接复用
- `types.ts` — CommandItem 接口已有 `shortcut?: string` 字段，可复用同一 Tauri Accelerator 格式
- `SettingsDialog.tsx` — 已有 Dialog 分区布局模式、底部区域扩展模式（版本号区域）
- `useKeyboard.ts` — 应用级数字键 1-9 快捷指令（Phase 5 实现），需注意与面板的交互

### Established Patterns
- Rust 后端 `#[tauri::command]` + 前端 `invoke()` 调用模式
- 状态通过 `@tauri-apps/plugin-store` 持久化到 JSON
- Dialog 使用 shadcn/ui Dialog + Switch + Label 组件
- 快捷键格式为 Tauri Accelerator（如 `CommandOrControl+G`）

### Integration Points
- `src/components/SettingsDialog.tsx` — 底部添加"快捷键设置..."按钮
- `src/components/CommandDialog.tsx` — 移除快捷键绑定相关 UI
- `src/hooks/useGlobalShortcuts.ts` — 扩展支持 ShortcutAction（不仅是 CommandItem）
- `src/lib/types.ts` — 新增 ShortcutAction 类型
- `src/App.tsx` — 状态管理（面板打开/关闭、窗口/项目操作回调传递）
- `src-tauri/capabilities/default.json` — 可能需要确认 global-shortcut 权限配置
- `package.json` — 可能不需要新依赖（tauri-plugin-global-shortcut 已安装）

</code_context>

<specifics>
## Specific Ideas

- 面板布局参考 VS Code 快捷键面板：分组列表 + 搜索框 + 每行操作名 + 快捷键标签
- 紧凑弹窗尺寸与 SettingsDialog 保持一致（约 380-450px 宽）
- 录制状态反馈：虚线边框闪烁 + "按下快捷键..." 文字提示
- 冲突警告条样式：黄色/琥珀色背景条，显示冲突操作名
- SettingsDialog 底部按钮文案建议："快捷键设置..."（带省略号表示打开新窗口）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-快捷键设置面板*
*Context gathered: 2026-05-15
