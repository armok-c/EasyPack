# Phase 20: 多配置文件管理 - Research

**Researched:** 2026-06-04

<findings>

## A. Store 重构方案

### A1. 当前 Store 架构

当前系统使用单个 `tauri-plugin-store` 实例，路径为 `easypack-store.json`。初始化在 `useProject()` 的 `useEffect([], [])` 中完成，调用 `load(STORE_PATH, { autoSave: 100, defaults: {} })`，然后逐个读取所有 key 恢复状态。

`tauri-plugin-store` 的 `load(path, options)` 接受相对 `app_data_dir` 的路径，天然支持创建多个独立 Store 文件。

### A2. 跟 profile 走的 key 清单

| Key | 变量 | 类型 |
|-----|------|------|
| `projects` | `projects` | `ProjectItem[]` |
| `selectedProjectId` | `selectedId` | `string \| null` |
| `customCommands` | `customCommands` | `CommandItem[]` |
| `projectCommands:{id}` | `projectCommandsMap[id]` | `CommandItem[]` |
| `presetShortcuts` | `presetShortcutsMap` | `Record<string, string>` |
| `shortcutBindings` | `shortcutBindings` | `Record<string, string>` |
| `recentCommands` | `recentCommands` | `RecentCommand[]` |

不跟 profile 走的：`trayEnabled`、`closeToTray`、`drawerEnabled`、`autostartEnabled`（App.tsx 管理）。

### A3. 重构后 Store 架构

**主 store (`easypack-store.json`)**：profile 元信息 + 全局设置 + 迁移标记
**Profile store (`profile-{uuid}.json`)**：所有跟 profile 走的数据，使用相同 key 名

### A4. useProject 重构要点

重构 init 流程：load 主 store → 检测迁移 → 读取 profile 元信息 → load 活跃 profile store → 恢复 state。

需要内部持有两个 store 引用（mainStore + profileStore），对外暴露必要接口。

### A5. 迁移策略

检测 `profileMigrationDone` 标记，不存在且主 store 有旧数据时执行迁移。采用"先写后删"模式确保数据安全。全新安装时直接创建空的默认 profile。

## B. Profile 切换流程

### B1. 需重置的 state

projects、selectedId、customCommands、projectCommandsMap、presetShortcutsMap、shortcutBindings → 从新 profile store 读取。commandMode → 重置为 "global"。editMode → 重置为 false。

### B2. 切换步骤

1. 进入 loading 态（全屏 overlay）
2. 保存当前 profile store
3. 更新主 store activeProfileId
4. 加载新 profile store
5. 批量更新所有 React state
6. 退出 loading 态

### B3. 响应式同步

切换 profile 后，下游组件（悬浮窗 syncState、全局快捷键、托盘）通过 React 依赖追踪自动同步，无需额外事件通知。

## C. 风险点

### C1. 并发写入

- Store autoSave 内部有序列化处理，风险低
- Loading overlay 消除切换期间的交互并发
- 悬浮窗 IPC 事件需检查 switchingProfile 标志

### C2. 容错

- Profile store 损坏：fallback 内存模式 + toast 提示
- 主 store 损坏：创建新默认 profile
- 导入格式损坏：校验 formatVersion + data 字段

### C3. 迁移回退

- 迁移幂等：基于 profileMigrationDone 标记，多次执行不重复
- 先写后删：数据写入 profile store 成功后才清理主 store
- 迁移中断：下次启动重新检测，已有数据的 profile store 视为迁移完成

### C4. useRecentCommands store 引用

切换 profile 时需传入新的 profileStore 引用。如果引用不变（getStore 缓存），需额外 profileId 依赖触发重新加载。

</findings>

<recommended_approach>

## 推荐实现路径

### Plan 拆分：2 个 Plan（与 ROADMAP.md 一致）

#### Plan 01: Store 层重构 + Profile 管理 + 迁移

核心文件：`src/hooks/useProject.ts`、`src/lib/types.ts`

1. 定义 ProfileMeta 类型
2. 重构 useProject 内部持有 mainStore + profileStore 双引用
3. 实现 loadProfileStore、switchProfile（含 loading 态）
4. 实现 migrateToProfiles（先写后删幂等迁移）
5. 实现 Profile CRUD：createProfile、deleteProfile、renameProfile
6. 实现 importProfile、exportProfile
7. 所有 CRUD 操作改用 profileStore
8. 对外暴露新增接口，store 改为 profileStore

#### Plan 02: UI 实现 — SettingsDialog + App.tsx 集成

核心文件：`src/components/SettingsDialog.tsx`、`src/App.tsx`

1. SettingsDialog 顶部添加 profile 管理区域（下拉框 + 齿轮展开管理面板）
2. 导入前确认弹窗 + 导出文件选择
3. 全屏 loading overlay 在 App.tsx 管理
4. Profile 相关 props 传递和集成
5. useRecentCommands store 引用适配

</recommended_approach>

---

*Phase: 20-多配置文件管理*
*Research completed: 2026-06-04*
