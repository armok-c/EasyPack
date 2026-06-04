# Phase 20: 多配置文件管理 - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

为 EasyPack 添加多套独立配置 profile 系统。用户可以创建、删除、重命名 profile（如"工作"、"个人"、"学习"），在不同 profile 之间切换后项目列表和指令立即更新。支持将当前 profile 导出为 JSON 文件和导入 JSON 文件覆盖当前 profile。首次启动时，现有单配置数据自动迁移到"默认" profile，无数据丢失。Profile 切换使用 loading 态禁用 UI 序列化执行，防止并发写入导致数据损坏。

涉及需求: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06

</domain>

<decisions>
## Implementation Decisions

### Profile 数据范围
- **D-01:** 跟着 profile 走的用户数据：projects、customCommands、projectCommands:*、shortcutBindings、presetShortcuts、recentCommands、selectedProjectId
- **D-02:** 不跟着 profile 走的全局数据：trayEnabled、closeToTray、drawerEnabled、autostartEnabled（系统设置）
- **D-03:** 窗口行为状态（悬浮窗折叠/展开、可见性）属于全局，不跟着 profile 走
- **D-04:** commandMode（global/project）和 editMode 是临时 UI 状态，切换 profile 时重置为默认值（global + 非 edit）
- **D-05:** 每个 profile 记住自己的 selectedProjectId，切回时恢复上次选中的项目

### Store 数据结构
- **D-06:** 每个 profile 一个独立 JSON 文件（如 profile-{uuid}.json），用 tauri-plugin-store 的独立 Store 实例管理
- **D-07:** 主 store（easypack-store.json）只存 profile 元信息：profile 列表（名称、ID）、当前活跃 profile ID
- **D-08:** Profile 文件使用 UUID 作为文件名（profile-{uuid}.json），不用用户可见名称
- **D-09:** Profile 文件存放在 tauri-plugin-store 默认的 AppData 目录下，与其他 store 文件同级
- **D-10:** 首次启动时自动检测旧数据（有 projects 等数据但无 profile 元信息），自动创建"默认" profile 并迁移数据，用户无感知
- **D-11:** 迁移完成后删除主 store 里的旧数据（projects、customCommands、projectCommands:* 等），用标记 key（如 `profileMigrationDone`）防止重复迁移

### Profile 管理 UI
- **D-12:** Profile 管理和切换都在 SettingsDialog 内完成，不增加独立 Dialog
- **D-13:** SettingsDialog 内布局：顶部加 profile 下拉框（Select）选择当前 profile + 齿轮图标打开管理区域（创建/删除/重命名）
- **D-14:** 切换 profile 后立即关闭 SettingsDialog 并生效，新 profile 数据加载后用户可看到主界面变化
- **D-15:** 当前 profile 名称仅在 SettingsDialog 内显示，不在标题栏或侧边栏显示

### 导入/导出体验
- **D-16:** 导出为单个 JSON 文件，包含当前 profile 的所有用户数据
- **D-17:** 导入时直接覆盖当前 profile 的所有用户数据（符合 CONFIG-04 要求）
- **D-18:** 导入/导出按钮放在 SettingsDialog 的 profile 管理区域内，与 profile 下拉框同级
- **D-19:** 使用 tauri-plugin-dialog 的系统文件选择器（save for 导出，open for 导入）

### 导出 JSON 格式与校验
- **D-20:** 导出 JSON 文件带元信息：formatVersion（版本号）、profileName（profile 名称）、exportedAt（导出时间戳）、data（用户数据）
- **D-21:** 导入时校验 formatVersion 是否支持、必需字段（data）是否存在
- **D-22:** 校验失败时提示"配置文件格式不兼容或已损坏"，不执行导入
- **D-23:** 导入前弹出确认弹窗"确定要覆盖当前配置吗？此操作不可撤销"，确认后再执行

### 切换并发安全
- **D-24:** 切换 profile 时显示 loading 状态，禁用所有交互，直到新 profile 数据加载完成后恢复
- **D-25:** Loading 态覆盖全屏或至少覆盖主内容区域，防止用户在切换过程中操作导致数据不一致

### Claude's Discretion
- Profile 数据在独立 Store 文件中的具体 key 结构（是否复用现有 key 名如 projects、customCommands）
- Profile 下拉框和管理区域的具体组件布局和样式
- 迁移检测和执行的时机（useProject init 时）
- Loading 态的具体 UI 实现（overlay、spinner 等）
- Profile 文件的 JSON 内部结构（与 store 内部格式一致还是自定义格式）
- 导出文件的默认文件名（建议 `easypack-{profileName}-{date}.json`）
- formatVersion 的初始值和未来升级策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心改造文件
- `src/hooks/useProject.ts` — 核心数据管理 hook，需重构支持多 store 实例、profile 切换、数据迁移
- `src/lib/types.ts` — 可能需新增 Profile 相关类型定义
- `src/components/SettingsDialog.tsx` — 需添加 profile 下拉框、管理区域、导入/导出按钮
- `src/App.tsx` — 需处理 profile 切换的 loading 态、传递 profile 相关回调

### 现有模式参考
- `src/hooks/useProject.ts` — 当前 store 初始化和持久化模式（load → get/set → save）
- `src/hooks/useFloatWindow.ts` — operationLock Promise-chain mutex 模式（Phase 12）
- `src/components/SettingsDialog.tsx` — Dialog 分区布局、Switch 组件、底部区域扩展模式
- `src/lib/presets.ts` — 预设指令初始化模式

### Prior Phase Context
- `.planning/phases/19-悬浮窗改进/19-CONTEXT.md` — 悬浮窗状态管理、事件通信模式
- `.planning/phases/18-快捷键设置面板/18-CONTEXT.md` — ShortcutPanel 入口模式、SettingsDialog 扩展
- `.planning/phases/15-开机启动/15-CONTEXT.md` — SettingsDialog Switch 添加模式、级联逻辑

### Requirements
- `.planning/REQUIREMENTS.md` — CONFIG-01 ~ CONFIG-06
- `.planning/ROADMAP.md` — Phase 20 详细描述
- `.planning/PROJECT.md` — Key Decisions（store 持久化、不可变更新模式）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useProject.ts` — 核心数据管理 hook（735 行），包含所有 store 操作。需要重构为 profile-aware，但现有的 CRUD 逻辑、store 操作模式可直接复用到 profile store 实例
- `SettingsDialog.tsx` — 已有完整的设置 UI 模式（分区、Switch、Label），profile 区域可在此基础上扩展
- `@tauri-apps/plugin-dialog` — 已安装，用于文件夹选择器。导出 save/open 文件选择器直接复用
- `@tauri-apps/plugin-store` — 已安装，load() 函数支持自定义 store 文件路径，天然支持多 store 实例

### Established Patterns
- Store 初始化：`const s = await load(STORE_PATH, { autoSave: 100, defaults: {} })`
- 数据读写：`s.get<Key>(KEY)` / `s.set(KEY, value)` / `s.delete(KEY)` / `s.save()`
- 不可变更新：spread + new object 模式
- SettingsDialog 扩展：添加新的分区区域（Label + 控件），参考 Phase 15/18 扩展模式

### Integration Points
- `src/hooks/useProject.ts` — 需重大重构：支持 profile store 切换、数据迁移、loading 态管理
- `src/components/SettingsDialog.tsx` — 添加 profile 下拉框、管理区域、导入/导出按钮
- `src/App.tsx` — 需传递 profile 切换回调、loading 态显示、profile 切换后的状态同步
- `src-tauri/tauri.conf.json` — 可能需要确认 tauri-plugin-store 的文件访问权限配置

</code_context>

<specifics>
## Specific Ideas

- SettingsDialog 顶部 profile 区域布局：左侧下拉框显示当前 profile 名称，右侧齿轮图标展开管理面板（创建/重命名/删除/导入/导出）
- 导出文件默认名：`easypack-{profileName}-{YYYY-MM-DD}.json`
- 导出 JSON 格式示例：
  ```json
  {
    "formatVersion": 1,
    "profileName": "工作",
    "exportedAt": "2026-06-04T12:00:00.000Z",
    "data": {
      "projects": [...],
      "customCommands": [...],
      "projectCommands": {...},
      "shortcutBindings": {...},
      "presetShortcuts": {...},
      "recentCommands": [...],
      "selectedProjectId": "..."
    }
  }
  ```
- 迁移策略：init 时检测 `profileMigrationDone` 标记，不存在则执行迁移（读取旧数据 → 创建默认 profile → 写入 profile 文件 → 清理旧数据 → 设置标记）
- Loading 态：切换 profile 时全屏 overlay + spinner，禁用所有交互

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-多配置文件管理*
*Context gathered: 2026-06-04*
