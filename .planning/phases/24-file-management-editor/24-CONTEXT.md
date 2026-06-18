# Phase 24: 文件管理与编辑器 - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

在 Phase 23 环境管理基础上，实现文件的添加、删除、列表查看和语法高亮编辑功能。用户可向当前环境添加配置文件、多选删除、通过五列表格浏览文件，并通过 CodeMirror 6 编辑器查看和编辑文件内容。编辑结果保存到环境副本（不直接写磁盘——需通过 ENV-08「启用」才应用到项目目录）。

Phase 24 范围：ENV-03（添加文件）、ENV-04（删除文件）、ENV-06（文件列表）、ENV-07（文件查看编辑）。

</domain>

<decisions>
## Implementation Decisions

### 文件添加方式 (ENV-03)
- **D-01:** 使用 tauri-plugin-dialog 文件选择对话框（需安装 dialog 插件）
- **D-02:** 支持多文件批量添加（Ctrl+点击多选）
- **D-03:** 文件类型过滤：`.env .json .yaml .yml .toml .xml .conf .ini .cfg .txt .md`
- **D-04:** 对话框内嵌手动输入框——处理文件尚不存在的场景（Phase 23 D-09：空文件允许），用户可直接输入相对路径
- **D-05:** 选中文件后立即读取内容加入环境（toast 反馈），不展示预览
- **D-06:** `ManagedFile.name` 存储相对路径（如 `config/settings.json`）
- **D-07:** 重复文件跳过并 toast 提示「N 个文件已存在」，其余正常添加
- **D-08:** 部分文件读取失败（权限不足/被删除等）时继续添加成功文件，toast 报告失败数量及原因
- **D-09:** 对话框提供下拉过滤切换——用户可选择具体文件类型过滤

### 编辑器能力 (ENV-07)
- **D-10:** 根据文件扩展名自动检测语言模式：`.json`→JSON、`.yaml/.yml`→YAML、`.toml`→TOML、`.xml`→XML、`.conf/.ini`→INI、`.md`→Markdown、`.txt`→纯文本，未知扩展名→纯文本
- **D-11:** 各格式专用校验（编辑停止 500ms 后触发）：JSON→`JSON.parse()`、XML→`DOMParser`、YAML→基础缩进/冒号格式检查、TOML→基础 `key=value` 格式检查
- **D-12:** 错误行左侧红色圆点标记 + 行背景淡红高亮 + 底部状态栏显示错误信息
- **D-13:** 编辑器底部状态栏：文件名 + 最后修改时间 + 错误计数（如「3 个错误」）
- **D-14:** 「查看」按钮打开编辑器后文件直接可编辑（非只读预览模式）
- **D-15:** 使用大尺寸 Dialog（约 80% 视口宽高）
- **D-16:** 保存按钮直接保存到环境副本 + toast「已保存」，无需二次确认
- **D-17:** 编辑器跟随应用暗色主题（oneDark 主题）
- **D-18:** 键盘快捷键：`Escape` 关闭（有未保存修改时提示保存）、`Ctrl+S` 保存；CodeMirror 内置 undo/redo
- **D-19:** 未保存修改指示器：标题栏文件名旁显示圆点标记，保存后消失
- **D-20:** 单实例编辑器——打开新文件时若当前文件有未保存修改，提示保存后关闭
- **D-21:** UTF-8 编码（CodeMirror 6 和 Rust `std::fs` 默认行为）

### 文件列表交互 (ENV-04, ENV-06)
- **D-22:** 使用 shadcn/ui Table 组件
- **D-23:** 五列布局：勾选框 / 文件名 / 后缀 / 修改时间 / 操作（查看按钮）。文件名存相对路径但列表仅显示基本名称，后缀独立列显示
- **D-24:** 空文件列表居中引导文字「暂无文件，点击添加按钮添加配置文件」
- **D-25:** 顶部工具栏：文件计数（如「3 个文件」）+ 添加按钮 + 删除按钮（删除按钮在勾选文件后点亮）
- **D-26:** 删除使用 shadcn/ui AlertDialog 二次确认，弹窗显示待删除文件列表
- **D-27:** 修改时间显示为相对时间（如「3 分钟前」「2 天前」），tooltip 显示绝对时间
- **D-28:** 文件列表固定最大高度约 300px，超出垂直滚动；指令卡片在其下方不受挤压
- **D-29:** 默认按文件名排序（固定排序），不提供列头点击排序功能
- **D-30:** 长文件名 `text-overflow: ellipsis` 截断 + tooltip 显示完整路径
- **D-31:** 点击行切换勾选状态（不打开编辑器）；hover 高亮

### 编辑器组件复用
- **D-33:** 通用 `useCodeMirror` hook 提取到 `src/hooks/useCodeMirror.ts`
- **D-34:** ScriptEditor 同步重构使用新 hook（验证现有多行脚本编辑行为不回归）
- **D-35:** 安装 CodeMirror 语言包：`@codemirror/lang-json`、`@codemirror/lang-xml`、`@codemirror/legacy-modes`（含 YAML/TOML 支持）
- **D-36:** hook 返回值：`{ parentRef, viewRef }`（Ref 模式，与 ScriptEditor 当前模式一致）
- **D-37:** 通过 `extensions: Extension[]` 参数注入扩展，hook 内部合并 `basicSetup` + theme + 用户自定义扩展
- **D-38:** 内容同步由外部 `useEffect` 处理（监听 value prop 变化，调用 `view.dispatch()`）
- **D-39:** hook 参数风格：独立参数 `value, onChange, darkMode, height`（与 ScriptEditor 当前接口对齐）

### Claude's Discretion
- 添加文件对话框的具体 UI 布局（下拉过滤 + 文件选择按钮 + 手动输入框的排列方式）
- 删除确认 AlertDialog 中文件列表的具体展示样式
- 编辑器模态窗标题栏布局（文件名 + 修改指示圆点 + 关闭按钮）
- 各格式校验的具体实现深度（YAML/TOML 的检查规则细节）
- 文件列表占位区域在 MainArea 中的具体位置和与上下元素（环境切换栏/标签页/指令卡片）的间距
- useCodeMirror hook 提取后的具体接口签名和 JSDoc
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — ENV-03（添加文件）、ENV-04（删除文件）、ENV-06（文件列表）、ENV-07（文件查看编辑）
- `.planning/ROADMAP.md` — Phase 24 成功标准与 v2.1 里程碑上下文

### 数据模型
- `src/lib/types.ts` — `Environment`、`ManagedFile` 接口定义（Phase 23 已建立）
- `src/lib/types.ts` — `ProfileExportData` 含 `projectEnvs`/`projectActiveEnvs` 字段

### 核心逻辑
- `src/hooks/useProject.ts` — 现有 ENV CRUD：`createEnv`、`renameEnv`、`deleteEnv`、`setActiveEnv`、`applyEnv`、`getProjectEnvs`、`getProjectActiveEnv`。需新增 `addFiles`、`deleteFiles`、`updateFileContent` 方法
- `src/hooks/useProject.ts:46-50` — 持久化键模式：`projectEnvs:${projectId}` / `projectActiveEnv:${projectId}`
- `src/hooks/useProject.ts:629-738` — Phase 23 ENV CRUD 方法实现（参考模式）
- `src/hooks/useProject.ts:740-793` — `applyEnv` 方法（通过 `invoke("write_file_content")` 写入磁盘）

### UI 组件
- `src/components/MainArea.tsx:279-312` — 环境切换栏 + 标签页当前位置。文件列表插入点在此区域与指令卡片（:329）之间
- `src/components/ScriptEditor.tsx` — 现有 CodeMirror 6 集成 + useCodeMirror 内联 hook（将被提取重构）
- `src/components/ManageEnvDialog.tsx` — 管理环境模态窗参考模式（Dialog + Table）

### Rust 后端
- `src-tauri/src/commands/shell.rs:183-197` — `read_file_content` 命令（读取项目目录文件内容）
- `src-tauri/src/commands/shell.rs:203-230` — `write_file_content` 命令（写入文件到项目目录，自动 create_dir_all）
- `src-tauri/src/lib.rs:30-31` — 命令注册

### Phase 23 决策
- `.planning/phases/23-env-tabs-management/23-CONTEXT.md` — 环境数据模型（D-07~D-11）、文件读写（D-12~D-13）、标签页交互（D-14~D-19）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ScriptEditor.tsx** — CodeMirror 6 编辑器组件（useCodeMirror hook + oneDark 主题 + batchSupport）。将被提取为通用 hook
- **shadcn/ui Dialog** — 已安装，用于编辑器模态窗（大尺寸变体）和添加文件对话框
- **shadcn/ui Table** — 已安装，用于文件列表五列布局
- **shadcn/ui AlertDialog** — 已安装，用于删除文件二次确认
- **shadcn/ui Checkbox** — 已安装，用于文件列表勾选框
- **shadcn/ui Select** — 已安装，用于文件类型过滤下拉
- **shadcn/ui Button** — 已安装，用于添加/删除/查看/保存按钮
- **sonner toast** — 已安装，用于操作反馈通知
- **profileStore 持久化模式** — 所有数据通过 `profileStore.set()` + `profileStore.save()` 持久化
- **tauri-plugin-dialog** — 需安装，用于文件选择对话框

### CodeMirror 6 已有依赖
| 包 | 用途 |
|---|---|
| `@codemirror/state` v6.6.0 | 编辑器状态管理 |
| `@codemirror/view` v6.43.0 | 编辑器视图 |
| `@codemirror/language` v6.12.3 | 语言模式基础 |
| `@codemirror/commands` v6.10.3 | 键盘命令 |
| `@codemirror/theme-one-dark` v6.1.3 | 暗色主题 |
| `codemirror` v6.0.2 | 基础设置（basicSetup） |

### 需新增 CodeMirror 依赖
| 包 | 用途 |
|---|---|
| `@codemirror/lang-json` | JSON 语法高亮 + 校验 |
| `@codemirror/lang-xml` | XML 语法高亮 + 校验 |
| `@codemirror/legacy-modes` | YAML / TOML 语法高亮 |

### Established Patterns
- **不可变 state 更新** — useProject 全部使用展开运算符 + setState 回调模式
- **per-project key 模式** — `projectEnvsKey(projectId)` 为每项目创建独立存储键
- **启动时数据加载** — `loadProfileDataIntoState` 中从 store 恢复所有 state
- **删除项目清理** — `removeProject` 中清理对应的环境存储键
- **导出导入** — `exportProfile`/`importProfile` 读写 JSON 文件
- **Rust 命令模式** — `#[tauri::command]` + `invoke()` 前后端通信

### Integration Points
- **MainArea.tsx:279-312** — 环境切换栏 + 标签页区域。文件列表应插入在标签页下方（替换当前「项目环境」标签+打开文件夹按钮行）
- **MainArea.tsx:329** — 指令卡片 grid，文件列表不影响此区域
- **useProject.ts** — 新增 `addFiles(projectId, fileNames)`、`deleteFiles(projectId, fileIds)`、`updateFileContent(projectId, envId, fileName, content)` 方法
- **useProject.ts:133-174** — `loadProfileDataIntoState` 环境数据已预加载（Phase 23），无需修改
- **useProject.ts:762-803** — `exportProfile`/`importProfile` 环境数据字段已添加（Phase 23），无需修改
- **types.ts** — `Environment`、`ManagedFile` 接口已定义（Phase 23），无需修改。新增组件 Props 类型
- **Rust shell.rs** — `read_file_content`/`write_file_content` 命令已实现，无需修改
</code_context>

<specifics>
## Specific Ideas

- 添加文件对话框使用 tauri-plugin-dialog 的 `open()` API，`multiple: true` + `filters` 参数
- 文件列表在 MainArea 中替换当前「项目环境」标签行（:299-312），作为 EnvTabBar 和指令卡片之间的独立区块
- 顶部工具栏布局参考：左侧文件计数文字，右侧添加按钮 + 删除按钮
- 删除确认 AlertDialog 参考 ManageEnvDialog 中删除环境的确认弹窗模式
- 编辑器模态窗参考 ScriptEditor 的 CodeMirror 配置，增加语言扩展和 lint 逻辑
- 语言自动检测使用简单的扩展名→语言映射函数（如 `getLanguageExtension(fileName: string): Extension`）
</specifics>

<deferred>
## Deferred Ideas

None — 讨论严格限制在 Phase 24 范围内。ENV-05（同步差异对比）属于 Phase 25。

</deferred>

---

*Phase: 24-文件管理与编辑器*
*Context gathered: 2026-06-18*
