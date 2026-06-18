# Phase 24: 文件管理与编辑器 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 24-文件管理与编辑器
**Areas discussed:** 文件添加方式, 编辑器能力, 列表交互, 组件复用

---

## 文件添加方式

### Round 1: 核心添加机制

| Option | Description | Selected |
|--------|-------------|----------|
| 文件选择对话框 | tauri-plugin-dialog 弹出文件浏览器，从项目目录选择文件 | ✓ |
| 手动输入路径 | 输入框手动键入相对路径 | |
| 两者结合 | 同时提供文件选择按钮和手动输入框 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 逐文件选择 | 一次弹窗选一个文件 | |
| 多文件批量添加 | 一次弹出支持多选文件（Ctrl+点击） | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| 配置文件过滤器 | 仅列出常见配置文件扩展名（.env .json .yaml .yml .toml .xml .conf .ini .cfg .txt .md） | ✓ |
| 显示全部文件 | 不过滤，可看到全部文件 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 对话框中内嵌输入框 | 对话框中还有一个输入框可手动输入路径 | ✓ |
| 独立入口分开处理 | 添加不存在的文件用独立入口 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 直接添加 | 选中文件后立即读取内容加入环境，toast 反馈 | ✓ |
| 预览后确认添加 | 选中文件后先展示内容预览再确认 | |

### Round 2: 路径、重复、失败处理

| Option | Description | Selected |
|--------|-------------|----------|
| 相对路径 | ManagedFile.name 存储相对于项目根目录的完整路径（如 config/settings.json） | ✓ |
| 仅文件名 | 仅存储文件名 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过并提示 | 已存在的同名文件被跳过，toast 提示 | ✓ |
| 静默覆盖 | 静默覆盖已存在文件的内容 | |
| 禁止并报错 | 禁止添加同名文件，整个批量操作失败 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 部分成功 | 跳过失bai文件，其余文件正常添加 | ✓ |
| 全部回滚 | 任一失败则全部回滚 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 下拉过滤切换 | 对话框显示过滤器下拉，用户可选择具体类型过滤 | ✓ |
| 输入框+浏览按钮 | 弹窗内输入框 + 浏览按钮 | |

**User's choices:** 文件选择对话框 + 多文件批量 + 过滤器(.env .json .yaml .yml .toml .xml .conf .ini .cfg .txt .md) + 对话框内嵌输入框 + 直接添加 + 相对路径 + 跳过重复 + 部分成功 + 下拉过滤切换

---

## 编辑器能力

### Round 1: 语言检测、校验、UI

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展名自动检测 | 根据文件扩展名自动选择语法高亮模式 | ✓ |
| 自动检测+手动切换 | 提供下拉框允许手动选择 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 各格式专用校验 | JSON→JSON.parse, XML→DOMParser, YAML→缩进/冒号检查, TOML→key=value检查 | ✓ |
| 统一 JSON 校验 | 对所有格式用 JSON.parse() | |

| Option | Description | Selected |
|--------|-------------|----------|
| 行标记+底部提示 | 错误行红色圆点 + 背景高亮 + 底部状态栏错误信息 | ✓ |
| 仅 Toast 提示 | 仅 toast 弹出错误信息 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 底部状态栏 | 文件名 + 修改时间 + 错误计数 + 保存按钮 | ✓ |
| 仅保存按钮 | 仅右下角保存按钮 | |

### Round 2: 编辑模式、尺寸、保存、主题

| Option | Description | Selected |
|--------|-------------|----------|
| 直接可编辑 | 查看按钮打开编辑器，文件内容可编辑 | ✓ |
| 先只读预览 | 查看按钮打开只读预览，需点击编辑才可修改 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 大尺寸 Dialog | shadcn/ui Dialog 大尺寸变体，占屏幕 80% 宽高 | ✓ |
| 全屏模态窗 | 全屏覆盖整个窗口 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 直接保存 | 直接保存到环境副本 + toast 反馈 | ✓ |
| 保存前确认 | 保存前弹出确认对话框 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随应用主题 | 编辑器跟随应用暗色主题（oneDark） | ✓ |
| 始终亮色 | 编辑器始终使用亮色背景 | |

### Round 3: 快捷键、指示器、多实例、编码

| Option | Description | Selected |
|--------|-------------|----------|
| 标准快捷键 | ESC 关闭, Ctrl+S 保存, 内置 undo/redo | ✓ |
| 无快捷键 | 仅通过按钮操作 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 修改指示器 | 内容变更后标题栏文件名旁显示圆点标记 | ✓ |
| 无需指示 | 无修改指示 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 单实例 | 始终只有一个编辑器，打开新文件提示保存 | ✓ |
| 多实例 | 允许多个 Dialog 同时打开 | |

| Option | Description | Selected |
|--------|-------------|----------|
| UTF-8 | 默认 UTF-8 编码 | ✓ |
| 多编码支持 | 支持切换编码 | |

**User's choices:** 扩展名自动检测 + 各格式专用校验 + 行标记+底部提示 + 底部状态栏 + 直接可编辑 + 大尺寸Dialog + 直接保存 + 跟随应用主题 + 标准快捷键 + 修改指示器 + 单实例 + UTF-8

---

## 列表交互

### Round 1: 布局、空状态、文件名、删除位置

| Option | Description | Selected |
|--------|-------------|----------|
| Table 组件 | 使用 shadcn/ui Table | ✓ |
| 卡片 Grid | 使用类似指令卡片的 grid 布局 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 引导空状态 | 居中引导文字「暂无文件，点击添加按钮添加配置文件」 | ✓ |
| 空白表格 | 零行表头 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 名称与后缀分列 | 文件名和扩展名分两列显示 | ✓ |
| 完整路径+后缀高亮 | 文件名显示完整相对路径，后缀高亮 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 工具栏按钮 | 删除按钮位于文件列表上方/下方工具栏区域 | ✓ |
| 行内按钮 | 每行操作列含删除图标按钮 | |

### Round 2: 列数、确认、时间、高度

| Option | Description | Selected |
|--------|-------------|----------|
| 五列布局 | 勾选框 + 文件名 + 后缀 + 修改时间 + 操作 | ✓ |
| 四列布局 | 严格按成功标准四列 | |

| Option | Description | Selected |
|--------|-------------|----------|
| AlertDialog 确认 | 二次确认弹窗，显示待删除文件列表 | ✓ |
| 直接删除 | 直接执行，toast 反馈 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 相对时间 | 如「3分钟前」「2天前」 | ✓ |
| 绝对时间 | 如 2026-06-18 14:30 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 固定高度+滚动 | 最大高度约 300px，超出滚动 | ✓ |
| 自适应高度 | 高度自适应文件数量 | |

### Round 3: 排序、工具栏、截断、行交互

| Option | Description | Selected |
|--------|-------------|----------|
| 固定排序 | 默认按文件名排序 | ✓ |
| 可点击排序 | 列头可点击切换排序 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 顶部工具栏 | 文件计数 + 添加按钮 + 删除按钮 | ✓ |
| 分开放置/底部 | 分散布局或底部 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 截断+Tooltip | CSS text-overflow:ellipsis + tooltip | ✓ |
| 自动换行 | 长文件名自动换行 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 点击行切换勾选 | 点击行切换勾选状态 | ✓ |
| 仅勾选框可选 | hover 高亮 + 仅点击勾选框切换 | |

**User's choices:** Table + 引导空状态 + 名称与后缀分列 + 工具栏按钮 + 五列布局 + AlertDialog确认 + 相对时间 + 固定高度滚动 + 固定排序 + 顶部工具栏 + 截断Tooltip + 点击行切换勾选

---

## 组件复用

### Round 1: 位置、重构、API、语言包

| Option | Description | Selected |
|--------|-------------|----------|
| src/hooks/ | 提取到 src/hooks/useCodeMirror.ts | ✓ |
| src/lib/ | 提取到 src/lib/ | |

| Option | Description | Selected |
|--------|-------------|----------|
| 同步重构 | ScriptEditor 一并重构使用新 hook | ✓ |
| 仅新组件使用 | ScriptEditor 保持不动 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展数组注入 | 通过 extensions: Extension[] 参数注入 | ✓ |
| Preset 模式 | 预设字符串 switch 切换 | |

| Option | Description | Selected |
|--------|-------------|----------|
| CodeMirror 语言包 | @codemirror/lang-json + @codemirror/lang-xml + @codemirror/legacy-modes | ✓ |
| 手动规则 | 手动编写 StreamLanguage | |

### Round 2: 返回值、扩展方式、同步、参数

| Option | Description | Selected |
|--------|-------------|----------|
| Ref 模式 | 返回 { parentRef, viewRef } | ✓ |
| 声明式元素 | 返回 { editorElement } | |

| Option | Description | Selected |
|--------|-------------|----------|
| extensions 数组 | hook 接受 extensions: Extension[]，内部合并 | ✓ |
| 内部组装 | hook 内部集中管理扩展逻辑 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 外部同步 | 外部 useEffect 监听 value 变化 | ✓ |
| 内部自动同步 | hook 内部自动同步 value prop | |

| Option | Description | Selected |
|--------|-------------|----------|
| 独立参数 | value, onChange, darkMode, height | ✓ |
| Options 对象 | 单一 options 对象 | |

**User's choices:** src/hooks/ + 同步重构ScriptEditor + 扩展数组注入 + CodeMirror语言包 + Ref模式 + extensions数组 + 外部同步 + 独立参数

---

## Claude's Discretion

以下实现细节由执行者自行决定：
- 添加文件对话框的具体 UI 布局
- 删除确认 AlertDialog 中文件列表的具体展示样式
- 编辑器模态窗标题栏布局
- 各格式校验的具体实现深度
- 文件列表在 MainArea 中的具体位置
- useCodeMirror hook 提取后的具体接口签名

## Deferred Ideas

None — 讨论严格限制在 Phase 24 范围内。ENV-05（同步差异对比）属于 Phase 25。
