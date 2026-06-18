# Phase 23: 环境标签页与管理 - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

引入「环境」概念——环境是项目配置文件的命名集合。每个环境存储一组配置文件的文本副本。用户通过横向标签页浏览不同环境的文件，通过环境切换栏（下拉框 + 启用按钮）将指定环境的文件内容写入项目根目录。

**环境管理的是配置文件（如 .env），与指令系统无关。** 指令卡片不受环境切换影响。

Phase 23 范围：ENV-01（标签页）、ENV-02（管理模态窗）、ENV-08（切换栏）。文件列表和编辑器在 Phase 24。

</domain>

<decisions>
## Implementation Decisions

### 环境数据归属
- **D-01:** 环境数据存入 Profile Store，切换 profile 时环境也切换
- **D-02:** 存储键：`projectEnvs:<projectId>`（环境数组）和 `projectActiveEnv:<projectId>`（已应用环境 ID）
- **D-03:** Profile 导出/导入包含环境数据。ProfileExportData 新增 `projectEnvs: Record<string, Environment[]>` 和 `projectActiveEnvs: Record<string, string>` 字段
- **D-04:** 删除项目时同步清理对应的环境存储键和内存 state
- **D-05:** 环境数据在启动时预加载（`loadProfileDataIntoState` 中一次性读取），与 projectCommands 加载模式一致
- **D-06:** 向后兼容——现有用户无环境数据时静默过渡，不弹 toast，显示引导空状态

### 数据模型
- **D-07:** `Environment = { id: string, name: string, createdAt: number, updatedAt: number, files: ManagedFile[] }`
- **D-08:** `ManagedFile = { name: string, content: string, addedAt: number }`
  - `name` 存储相对路径（如 `.env`、`config/settings.json`），支持嵌套目录
  - `content` 存储文件完整文本内容
- **D-09:** 添加文件时自动读取项目目录中现有文件内容（通过 Rust 后端 `read_file_content` 命令）。若文件不存在，允许空文件（content = ""），启用时创建新文件
- **D-10:** 同一环境内禁止重名文件（按 name 去重）
- **D-11:** 新建项目时不自动创建默认环境——用户首次使用时看到引导空状态

### 文件读写
- **D-12:** 文件初始内容通过 Rust 后端 `read_file_content` 命令读取。启用时通过 `write_file_content` 写入，嵌套路径自动 `create_dir_all`
- **D-13:** 无硬性文件大小限制，依赖 profileStore JSON 自然限制

### 标签页交互
- **D-14:** 标签页选中态表示「正在浏览」，已应用环境显示绿色圆点标记。两个概念独立
- **D-15:** 标签页超出宽度使用 CSS `overflow-x: auto` 原生滚动
- **D-16:** 「管理环境」按钮固定在标签页行右侧（sticky），始终可见
- **D-17:** 零环境时显示引导空状态：「暂无环境」+ 管理环境按钮
- **D-18:** 删除当前浏览的环境后，自动切换到最近邻环境（右侧优先，无右侧则左侧）。无剩余环境则回到引导空状态
- **D-19:** Phase 23 标签页下方的文件区域为占位区域（提示「文件管理功能将在后续版本中提供」），Phase 24 实现完整文件列表

### 管理环境模态窗
- **D-20:** 环境名称在同一项目内必须唯一——创建和重命名时检测重名，toast 提示
- **D-21:** 删除环境使用 shadcn/ui AlertDialog 二次确认。**禁止删除已应用的环境**（需先切换到其他环境再删除）
- **D-22:** 删除确认弹窗中，若目标环境为已应用环境，额外警告并阻止操作

### 环境切换栏（ENV-08）
- **D-23:** 位置：标签页行上方、项目信息下方。布局自上而下为：项目信息 → 环境切换栏 → 标签页行+管理按钮 → 文件占位区 → 指令卡片
- **D-24:** 下拉框默认显示当前已应用的环境名称。若从未应用过，显示占位文字「选择环境」
- **D-25:** 选择的环境与已应用环境相同时，启用按钮禁用
- **D-26:** 点击启用直接执行，toast 反馈结果，无需弹窗确认
- **D-27:** 启用成功：绿色圆点从旧环境迁移到新环境 + 下拉框更新 + toast「已启用环境: [名称]」
- **D-28:** 文件写入采用原子操作——任一文件失败即回滚已写入的文件。若无法回滚，toast 报告具体失败文件

### 错误处理
- **D-29:** 读取文件失败（权限不足、文件被删除等）时 toast 提示具体错误，不阻塞添加流程
- **D-30:** 启用写入失败（磁盘满、权限不足等）时 toast 提示具体原因

### Claude's Discretion
- 标签页的 CSS overflow-x: auto 滚动条样式（可使用 scrollbar-none 隐藏滚动条）
- 管理环境模态窗的具体布局（shadcn/ui Dialog + 内嵌 Table）
- 绿色圆点的具体 CSS 实现（绝对定位小圆点或 ::after 伪元素）
- 引导空状态的具体文案和布局
- 占位区域的文案和样式
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — ENV-01（标签页）、ENV-02（管理环境）、ENV-08（切换栏）
- `.planning/ROADMAP.md` — Phase 23 成功标准与 v2.1 里程碑上下文

### 数据模型
- `src/lib/types.ts` — `CommandItem`、`ProfileMeta`、`ProfileExportData` 现有类型。新增 `Environment`、`ManagedFile` 类型

### 核心逻辑
- `src/hooks/useProject.ts` — 状态管理模式、profileStore 持久化模式、`loadProfileDataIntoState` 数据加载流程、`exportProfile`/`importProfile` 导出导入逻辑、`removeProject` 项目删除清理逻辑

### UI 组件
- `src/components/MainArea.tsx` — 当前 MainArea 布局，第 217 行「项目环境」标签区域是环境标签页的插入点，第 232 行指令卡片网格（环境不影响此区域）

### Rust 后端
- `src-tauri/src/` — 现有 `execute_command`/`execute_script` 命令模式。新增 `read_file_content`、`write_file_content` 命令

### 后续 Phase 参考
- `.planning/REQUIREMENTS.md` — ENV-03~ENV-07（Phase 24/25 文件管理、编辑器、差异对比）
- `.planning/phases/22-global-command-removal/22-CONTEXT.md` — Phase 22 已将"项目指令"改为"项目环境"标签
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui Dialog** — 已安装，用于「管理环境」模态窗（ENV-02）
- **shadcn/ui Tabs** — 可用作标签页基础（或自行实现横向滚动标签页）
- **shadcn/ui Select** — 已安装，用于 ENV-08 环境切换栏下拉框
- **shadcn/ui AlertDialog** — 已安装，用于删除环境二次确认
- **shadcn/ui Table** — 管理环境模态窗内的环境列表
- **profileStore 持久化模式** — 所有数据通过 `profileStore.set()` + `profileStore.save()` 持久化
- **sonner toast** — 已安装，用于操作反馈通知

### Established Patterns
- **不可变 state 更新** — useProject 全部使用展开运算符 + setState 回调模式
- **per-project key 模式** — `projectCommandsKey(projectId)` 为每项目创建独立存储键
- **启动时数据加载** — `loadProfileDataIntoState` 中从 store 恢复所有 state
- **删除项目清理** — `removeProject` 中清理对应的 projectCommands 键
- **导出导入** — `exportProfile`/`importProfile` 读写 JSON 文件
- **Rust 命令模式** — `#[tauri::command]` + `invoke()` 前后端通信

### Integration Points
- **MainArea.tsx:217** — 「项目环境」标签行，环境标签页应替换此处的 `span`
- **MainArea.tsx:232** — 指令卡片 grid，环境切换不影响此区域
- **useProject.ts** — 新增 env 相关 state（`projectEnvsMap`、`projectActiveEnvMap`）、CRUD 方法、持久化键
- **useProject.ts:133-174** — `loadProfileDataIntoState` 是环境数据预加载的插入点
- **useProject.ts:762-803** — `exportProfile`/`importProfile` 需新增环境数据字段
- **useProject.ts:372-400** — `removeProject` 需新增环境数据清理
- **types.ts** — 新增 `Environment`、`ManagedFile` 接口
- **Rust src-tauri/src/** — 新增 `read_file_content`、`write_file_content` Tauri 命令
</code_context>

<specifics>
## Specific Ideas

- 环境切换栏下拉框使用 shadcn/ui Select 组件，占位文字「选择环境」
- 启用按钮使用 shadcn/ui Button，未选择环境或与已应用环境相同时 disabled
- 标签页使用横向 flex + overflow-x: auto 布局，配合 scrollbar-none 隐藏滚动条
- 绿色圆点用 `size-2 rounded-full bg-green-500` 绝对定位在标签页右上角
- 「管理环境」按钮用 `shrink-0` 固定在标签页行右侧
- 管理环境模态窗：顶部「新增环境」按钮 + 下方四列表格（名称/创建时间/修改时间/操作）
- 操作列：重命名按钮（就地编辑或弹出输入框）+ 删除按钮（触发 AlertDialog）
- 引导空状态参考 MainArea 第 164-173 行空项目状态的居中布局风格
</specifics>

<deferred>
## Deferred Ideas

None — 讨论严格限制在 Phase 23 范围内。ENV-03~ENV-07 属于 Phase 24/25。

</deferred>

---

*Phase: 23-环境标签页与管理*
*Context gathered: 2026-06-18*
