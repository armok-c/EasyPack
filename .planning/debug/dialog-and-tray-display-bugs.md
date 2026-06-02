---
slug: dialog-and-tray-display-bugs
date: 2026-06-01
status: resolved
bugs:
  - "编辑指令第一次打开没有数据，关闭重开才有"
  - "系统托盘右键指令有时显示命令而不是名称"
---

# Bug 1: 编辑指令第一次打开没有数据

## 症状
点击编辑按钮打开 CommandDialog，表单字段为空。关闭后重新打开才显示正确数据。

## 根因
`CommandDialog` 始终挂载在 DOM 中（非条件渲染）。`useState(() => initialData?.name ?? "")` 等初始化函数只在首次挂载时执行。当 `initialData` 从 `null` 变为 `CommandItem` 时，state 不会重新初始化。

## 修复
在 `MainArea.tsx` 中为 `CommandDialog` 添加 `key={editingCommand?.id ?? "add"}`，当编辑目标改变时强制 React 重新挂载组件，使 `useState` 初始化函数重新执行。

**文件:** `src/components/MainArea.tsx:330`

---

# Bug 2: 系统托盘右键指令有时显示命令而不是名称

## 症状
系统托盘右键菜单中的最近命令项，有时显示的是原始命令字符串（如 `npm run build`）而不是名称（如 `Build`）。

## 根因
从托盘/悬浮窗执行命令时，`handleExecuteWithRecent` 只收到命令字符串（无 `cmdItem`）。当用户切换项目后，`commands.find()` 在当前项目的命令列表中找不到该命令（因为该命令属于另一个项目），于是 fallback 到 `addRecentCommand(shellCommand, shellCommand)`，将命令字符串同时作为名称存储到 `recentCommands` 中。

## 修复
在 `handleExecuteWithRecent` 的 fallback 路径中，先从 `recentCommands` 中查找该命令的名称，只有在 `recentCommands` 中也找不到时才使用命令字符串作为名称。

**文件:** `src/App.tsx:133-144`
