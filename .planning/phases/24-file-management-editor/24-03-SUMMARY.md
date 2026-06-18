---
phase: "24-file-management-editor"
plan: "03"
subsystem: "file-management"
tags: ["file-list", "code-mirror", "file-dialog", "env-management"]
requires: ["24-01-PLAN.md", "24-02-PLAN.md"]
provides: ["ENV-03", "ENV-04", "ENV-06", "ENV-07"]
affects: ["MainArea.tsx", "App.tsx"]
tech-stack:
  added:
    - "@codemirror/lang-json"
    - "@codemirror/lang-xml"
    - "@codemirror/lang-yaml"
    - "@codemirror/legacy-modes"
  patterns:
    - "useCodeMirror generic hook for editor lifecycle"
    - "tauri-plugin-dialog open() for file selection"
    - "shadcn/ui Table + AlertDialog for file management"
key-files:
  created:
    - src/components/AddFileDialog.tsx
    - src/components/FileEditorDialog.tsx
    - src/components/FileList.tsx
  modified:
    - src/components/MainArea.tsx
    - src/App.tsx
decisions:
  - "AddFileDialog layout: filter dropdown > dialog button > manual input (top to bottom)"
  - "FileEditorDialog uses `sm:max-w-[80vw]` size class for 80% viewport"
  - "FileList wraps both AddFileDialog and FileEditorDialog, manages all state internally"
  - "onAddFiles/onDeleteFiles/onUpdateFile pass through envId + projectId in MainArea bridge"
metrics:
  duration: ~23 min
  completed: "2026-06-18"
  files_created: 3
  files_modified: 2
  commits: 4
  type_errors: 0
---

# Phase 24 File Management Plan 03 Summary

文件管理 UI 组件实现：FileList（文件列表）、AddFileDialog（添加对话框）、FileEditorDialog（编辑器模态窗），并集成到 MainArea。

## Key Results

- **AddFileDialog** 支持系统文件选择对话框（多选）、手动输入相对路径、文件类型下拉过滤八个选项
- **FileEditorDialog** 使用 CodeMirror 6 编辑器，通过 useCodeMirror hook 集成，支持 JSON/YAML/XML/TOML/INI 语法高亮和 lint 校验
- **FileList** 五列表格（勾选框/文件名/后缀/修改时间/查看），max-h-[300px] 滚动，按文件名排序，行点击切换勾选
- **MainArea** 集成：FileList 插入在 EnvTabBar 与指令卡片网格之间，"打开文件夹"按钮移至项目路径旁
- **App.tsx** 新增三个回调绑定 useProject 的 addFiles/deleteFiles/updateFileContent 方法

## Tasks

### Task 1: AddFileDialog

**Commit:** e114675 (squashed into 241963f for final combined history)

Created `src/components/AddFileDialog.tsx`:
- `AddFileDialogProps` 接口：open/onOpenChange/projectPath/existingFileNames/onConfirm
- 文件类型下拉 Select：8 种过滤选项（所有格式、JSON、YAML、TOML、XML、INI、.env、文本）
- "选择文件"按钮调用 tauri-plugin-dialog `open()` API，multiple: true
- "或手动输入"分隔线 + 手动输入框，支持 Enter 提交
- 绝对路径转相对路径（strip projectPath prefix）
- 重复文件跳过 + 部分读取失败继续处理

### Task 2: FileEditorDialog

**Commit:** 0c09239

Created `src/components/FileEditorDialog.tsx`:
- `FileEditorDialogProps` 接口：open/onOpenChange/file/onSave
- Dialog 使用 `sm:max-w-[80vw] max-h-[80vh] h-[80vh] flex flex-col`
- `useCodeMirror` hook 集成，传入 `getLanguageExtension()` + `getLinterExtensions()` 扩展
- 未保存修改橙色圆点指示器（D-19）
- 底部状态栏：文件名 + 修改时间（`formatRelativeTime`）+ 保存按钮
- Ctrl+S 快捷键保存（D-18）
- Escape 关闭时若有未保存修改弹出 AlertDialog（保存/放弃/取消）

### Task 3: FileList

**Commit:** 1f01495

Created `src/components/FileList.tsx`:
- `FileListProps` 接口：envId/files/projectPath/onAddFiles/onDeleteFiles/onUpdateFile
- 顶部工具栏：文件计数 + "添加文件"按钮（打开 AddFileDialog）+ "删除"按钮
- 五列 Table：原生 checkbox + 文件名（truncate + tooltip）+ 后缀 + 修改时间（相对时间 + tooltip 绝对时间）+ "查看"按钮
- 行点击切换勾选，"查看"点击不切换（stopPropagation）
- 按文件名 useMemo 排序
- max-h-[300px] overflow-y-auto
- 空状态居中引导文字
- 删除 AlertDialog：显示文件名列表，destructive 确认按钮
- 集成 AddFileDialog 和 FileEditorDialog

### Task 4: MainArea 集成 + App.tsx 回调

**Commit:** e114675

MainArea：
- 新增 `FileList` import 和 `ManagedFile` 类型
- 新增三个 props：`onAddFiles`/`onDeleteFiles`/`onUpdateFile`
- 替换第 319-333 行：`<FileList>` 组件插入 EnvTabBar 下方
- "打开文件夹"按钮从原位置移至项目路径 text 内联链接

App.tsx：
- useProject 新增 `addFiles`/`deleteFiles`/`updateFileContent` 解构
- 新增三个 useCallback 包装 handler（handleAddFiles/handleDeleteFiles/handleUpdateFile）
- 传递到 `<MainArea>` 组件的三个新 prop

## Verification

- [x] `tsc --noEmit` 通过（零类型错误）
- [x] AddFileDialog 文件存在，导出 AddFileDialog 和 AddFileDialogProps
- [x] AddFileDialog 有文件类型下拉过滤 Select
- [x] AddFileDialog 有"选择文件"按钮调用 open() API
- [x] AddFileDialog 有手动输入框 Input
- [x] AddFileDialog 确认时剥离 projectPath 前缀为相对路径
- [x] AddFileDialog 确认时通过 invoke("read_file_content") 读取内容
- [x] FileEditorDialog 文件存在，导出 FileEditorDialog 和 FileEditorDialogProps
- [x] FileEditorDialog 使用 `sm:max-w-[80vw]` 尺寸
- [x] FileEditorDialog 编辑器通过 useCodeMirror hook 实现
- [x] FileEditorDialog 扩展来自 getLanguageExtension() + getLinterExtensions()
- [x] FileEditorDialog Ctrl+S 触发保存
- [x] FileEditorDialog Escape + dirty 弹出保存/放弃/取消提示
- [x] FileEditorDialog 未保存指示圆点仅在 dirty 时显示
- [x] FileEditorDialog 底部状态栏含文件名 + 相对时间 + 保存按钮
- [x] FileList 文件存在，FileList 和 FileListProps 导出
- [x] FileList 工具栏含文件计数 + 添加文件 + 删除按钮
- [x] FileList 删除按钮在未勾选时 disabled
- [x] FileList Table 五列：勾选框/文件名/后缀/修改时间/查看
- [x] FileList 行点击切换勾选（查看除外）
- [x] FileList max-h-[300px] 滚动容器
- [x] FileList 空状态居中引导文字
- [x] FileList 删除使用 AlertDialog 确认
- [x] FileList 集成 AddFileDialog 和 FileEditorDialog
- [x] MainAreaProps 包含三个新 props
- [x] "打开文件夹"按钮已移至项目信息区域
- [x] FileList 在 EnvTabBar 和指令卡片网格之间
- [x] App.tsx 绑定三个新回调

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None identified.

## Threat Flags

None - no new security-relevant surface beyond what was planned.

## Self-Check: PASSED

All created files verified via `tsc --noEmit`. All done criteria confirmed per task checklist.
