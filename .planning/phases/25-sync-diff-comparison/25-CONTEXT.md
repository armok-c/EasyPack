# Phase 25: 同步差异对比 - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

在 Phase 23（环境管理）和 Phase 24（文件管理）基础上，实现跨环境配置文件差异对比与同步（ENV-05）。用户在 FileList 中勾选文件 → 点击「同步差异」按钮 → 弹出环境选择弹窗（展示所有其他环境，多选）→ 使用 `@git-diff-view/react` 展示 Git 冲突风格的差异对比视图。支持逐块双向复制（源↔目标）、缺失文件创建、撤销操作，对比结果立即持久化到 profileStore。

Phase 25 范围：仅 ENV-05（同步差异对比）。

</domain>

<decisions>
## Implementation Decisions

### 环境选择弹窗
- **D-01:** 纯多选列表 Dialog。每行：复选框 + 环境名 + 匹配/缺失文件数（如「staging · 3 个匹配, 2 个缺失」）
- **D-02:** 顶部全选复选框 + 底部确认/取消按钮
- **D-03:** 未选任何目标环境时确认按钮禁用，提示文字「请至少选择一个目标环境」
- **D-04:** 中等尺寸（~480px 宽），适合 2-8 个环境的列表
- **D-05:** 弹窗标题「同步差异」，展示源环境名称（当前正在浏览的环境）
- **D-06:** 即使只有 1 个其他环境，也保留弹窗确认步骤（不自动跳过）
- **D-07:** 环境列表按名称字母排序；长环境名 ellipsis 截断 + hover tooltip
- **D-08:** 每次打开弹窗默认全部未选（不记住上次选择）

### 差异触发按钮
- **D-09:** 按钮位置：FileList 工具栏左侧，「N 个文件」文字右边。即「N个文件 | 同步差异 | 添加文件 | 删除」
- **D-10:** 视觉风格：Primary 变体 + GitCompare 图标 + 文字「同步差异」
- **D-11:** 未勾选任何文件时按钮禁用（灰色，tooltip「请先勾选要对比的文件」），状态不隐藏

### 差异视图布局（Tab 页面导航）
- **D-12:** 双层 Tab 布局：差异模态窗顶部横向文件 Tabs（一级），内容区顶部环境子 Tabs（二级）。按文件分组。
- **D-13:** 打开时自动显示第一个文件 + 第一个目标环境的对比
- **D-14:** 仅 1 个文件时也显示文件 Tab 行（结构一致性）
- **D-15:** 文件 Tab 按用户勾选顺序排列；水平可滚动（overflow-x: auto）
- **D-16:** 文件 Tab 无未解决徽标；环境子 Tab 无进度徽标
- **D-17:** 差异模态窗 80% 视口大小（与 FileEditorDialog 一致）
- **D-18:** 动态标题：「差异对比 — 文件名 (源环境 → 目标环境)」
- **D-19:** 标题栏下方小字显示当前对比的源/目标环境名

### 双向选择复制（差异块操作）
- **D-20:** 逐块（hunk）粒度。每个差异块旁有「← 使用源」和「使用目标 →」按钮，类似 Git merge conflict 界面
- **D-21:** 仅目标环境可变，源环境只读参考
- **D-22:** 选择后立即写入目标环境的 profileStore（`updateFileContent`），toast 反馈
- **D-23:** 无二次确认
- **D-24:** 支持撤销操作（通过状态追踪，撤销已应用的 hunk 变更）
- **D-25:** 已解决差异块：绿色背景；未解决差异块：默认/灰色背景
- **D-26:** 关闭差异视图时有未解决差异块 → 静默关闭，已应用的变更保留
- **D-27:** 底部状态栏显示已解决/未解决计数。全部解决后显示「全部已解决」状态
- **D-28:** 每个文件/环境组合独立追踪已解决状态

### 缺失文件处理
- **D-29:** 目标环境缺失文件时，差异视图右侧显示「此文件在目标环境中不存在」+「创建此文件」按钮
- **D-30:** 点击创建以源环境内容填充新文件（ManagedFile: name 相同, content 来自源, addedAt 更新）
- **D-31:** 创建无需二次确认，toast 反馈「已在 [环境名] 中创建 [文件名]」
- **D-32:** 创建后差异视图更新，显示空对比（源 vs 空白），与普通对比体验一致
- **D-33:** 创建操作支持撤销（从目标环境删除该文件）
- **D-34:** 创建后立即持久化到 profileStore
- **D-35:** 每个目标环境独立创建（不提供批量创建按钮）
- **D-36:** 环境选择弹窗中缺失文件用图标+计数标记；差异视图文件 Tab 缺失文件用 FileX 图标标记

### 数据流
- **D-37:** 对比数据来源：源环境 `Environment.files` + 目标环境 `Environment.files`，按 `ManagedFile.name` 匹配
- **D-38:** diff 输入：`@git-diff-view/react` 接收源文件 content 和目标文件 content 两个字符串
- **D-39:** 内容同步使用现有 `onUpdateFile(projectId, envId, fileName, content)` 方法

### Claude's Discretion
- `@git-diff-view/react` 的具体配置（split/unified 默认模式、diff 算法参数）
- 差异块「使用源/使用目标」按钮的具体位置和样式
- 已解决/未解决块的颜色方案（在现有暗色主题下的具体色值）
- 双层 Tab 的具体实现（使用 shadcn/ui Tabs 还是自定义组件）
- 环境选择弹窗内匹配/缺失文件数的具体 UI 排列
- 底部状态栏的具体布局（已解决计数 + 全部已解决状态）
- 缺失文件创建按钮在差异视图中的具体位置
- Tab 关闭按钮行为（关闭单个文件 Tab 还是整个模态窗）
- 撤销实现的具体状态管理方案
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — ENV-05（同步差异对比）
- `.planning/ROADMAP.md` — Phase 25 成功标准与 v2.1 里程碑上下文

### 数据模型
- `src/lib/types.ts` — `Environment`、`ManagedFile` 接口定义（Phase 23 已建立）

### 核心逻辑
- `src/hooks/useProject.ts` — 环境 CRUD（`createEnv`、`renameEnv`、`deleteEnv`、`setActiveEnv`、`applyEnv`、`getProjectEnvs`、`getProjectActiveEnv`）+ 文件 CRUD（`addFiles`、`deleteFiles`、`updateFileContent`）
- `src/hooks/useProject.ts:46-50` — 持久化键模式：`projectEnvs:${projectId}` / `projectActiveEnv:${projectId}`

### UI 组件
- `src/components/FileList.tsx` — 文件列表（勾选、工具栏），「同步差异」按钮集成点
- `src/components/MainArea.tsx:319-333` — FileList 在 MainArea 中的集成位置
- `src/components/FileEditorDialog.tsx` — 编辑器模态窗参考（80% 视口、标题栏、CodeMirror）
- `src/components/ManageEnvDialog.tsx` — 管理环境模态窗参考（Dialog + Table）

### Rust 后端
- `src-tauri/src/commands/shell.rs:183-197` — `read_file_content` 命令
- `src-tauri/src/commands/shell.rs:203-230` — `write_file_content` 命令

### 外部库
- `@git-diff-view/react` — Git 冲突风格差异对比 React 组件（GitHub: wayjam/git-diff-view）。未安装，需在 Phase 25 中添加依赖。

### Phase 23/24 决策
- `.planning/phases/23-env-tabs-management/23-CONTEXT.md` — 环境数据模型（D-07~D-11）、文件读写（D-12~D-13）
- `.planning/phases/24-file-management-editor/24-CONTEXT.md` — 文件 CRUD 方法、FileList 组件设计
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FileList 工具栏** — 已有文件计数、添加文件、删除按钮。「同步差异」按钮插入左侧
- **shadcn/ui Dialog** — 已安装，用于环境选择弹窗和差异对比模态窗
- **shadcn/ui Checkbox** — 已在 FileList 中使用，用于环境选择弹窗的多选列表
- **shadcn/ui Tabs** — 已安装，可作为双层 Tab 导航的基础
- **shadcn/ui Button** — 已安装，用于「同步差异」按钮
- **lucide-react `GitCompare`** — 用于「同步差异」按钮图标
- **profileStore 持久化模式** — 所有数据通过 `profileStore.set()` + `profileStore.save()` 持久化
- **sonner toast** — 已安装，用于操作反馈

### `@git-diff-view/react` 集成
- 该库提供 `<DiffView>` 组件，接受 `data` prop（包含 hunks 的 diff 数据）
- 支持 split/unified 两种视图模式
- 内置语法高亮和暗色主题支持
- 需安装 `@git-diff-view/react` 和 `@git-diff-view/shared`（或等效依赖）
- 差异计算可能需要 `diff` 库（如 `diff` npm 包）预处理文本

### Established Patterns
- **不可变 state 更新** — useProject 全部使用展开运算符 + setState 回调模式
- **per-project key 模式** — `projectEnvsKey(projectId)` 每项目独立存储
- **Modal 组件模式** — 使用 shadcn/ui Dialog + 受控 open/onOpenChange
- **Rust 命令模式** — `#[tauri::command]` + `invoke()` 前后端通信（Phase 25 不需要新 Rust 命令）

### Integration Points
- **FileList.tsx 工具栏** — 「同步差异」按钮插入点。需新增 `checkedFiles` 状态感知和 `onSyncDiff` 回调 prop
- **MainArea.tsx** — 传递 SyncDiffDialog 所需的 envs 数据和 onUpdateFile 回调
- **useProject.ts** — 差异视图使用现有 `updateFileContent` 方法写入解析后的内容
- **types.ts** — 无需修改现有类型。新增 DiffView 相关组件 Props 类型
</code_context>

<specifics>
## Specific Ideas

- 环境选择弹窗布局参考 ManageEnvDialog 的 Dialog + 列表模式
- 差异模态窗布局参考 FileEditorDialog（80% 视口、动态标题、暗色主题）
- 「使用源/使用目标」按钮放置在每个差异块（hunk）的左右两侧或顶部
- 已解决块使用 `bg-green-500/10` 或类似半透明绿色背景
- 底部状态栏参考 FileEditorDialog 的错误计数模式
- 缺失文件标记使用 lucide-react `FileX` 图标
- 「同步差异」按钮 icon 使用 lucide-react `GitCompare`
- 差异数据预处理：使用 `diff` npm 包（或手写 Myers diff）将两个文件内容转为 `@git-diff-view/react` 所需的 hunks 格式
</specifics>

<deferred>
## Deferred Ideas

None — 讨论严格限制在 Phase 25 范围内。

</deferred>

---

*Phase: 25-同步差异对比*
*Context gathered: 2026-06-18*
