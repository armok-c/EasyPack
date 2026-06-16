---
phase: 20-多配置文件管理
plan: 20-01
subsystem: data
tags: [tauri-plugin-store, profile, migration, import, export]

# Dependency graph
requires: []
provides:
  - "双 store 架构: mainStore (profile 元信息 + 全局设置) + profileStore (当前 profile 数据)"
  - "migrateToProfiles 幂等迁移: 检测旧数据 -> 创建默认 profile -> 迁移数据 -> 清理"
  - "Profile CRUD: createProfile/deleteProfile/renameProfile"
  - "switchProfile: 含 switchingProfileRef 并发安全 + loading 态管理"
  - "importProfile/exportProfile: 带格式校验的 JSON 导入导出"
  - "所有 CRUD 操作改用 profileStore 引用"
affects: [20-02-ui-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-store-architecture, profile-migration, switching-mutex]

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - src/hooks/useProject.ts

key-decisions:
  - "mainStore 存 profile 元信息 (profiles/activeProfileId/migrationDone)，profileStore 存当前 profile 的全部用户数据"
  - "原 store state 保留但指向 profileStore，useRecentCommands 等 hook 无需修改"
  - "迁移幂等设计：profileMigrationDone 标记防止重复执行"
  - "switchProfile 使用 useRef (switchingProfileRef) 而非 useState 作为并发锁，避免 re-render 干扰"
  - "importProfile 使用 dynamic import 读取文件，避免顶层导入循环依赖"

patterns-established:
  - "双 store 模式: mainStore + profileStore 分离关注点，profile 数据操作全部走 profileStore"
  - "Profile 文件命名: profile-{uuid}.json，UUID 文件名避免用户可见名称的特殊字符问题"
  - "迁移流程: 检测标记 -> 读取旧数据 -> 创建默认 profile -> 写入 profile store -> 清理旧 key -> 设置标记"

requirements-completed: [CONFIG-01, CONFIG-02, CONFIG-05, CONFIG-06]

# Metrics
duration: 12min
completed: 2026-06-04
---

# Phase 20 Plan 01: Store 层重构 + Profile 管理 + 数据迁移 Summary

**useProject 从单 store 重构为 mainStore + profileStore 双实例架构，实现幂等数据迁移、Profile CRUD、switchProfile 并发安全、import/export 格式校验**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-04T06:30:45Z
- **Completed:** 2026-06-04T06:42:45Z
- **Tasks:** 6
- **Files modified:** 2

## Accomplishments
- types.ts 新增 ProfileMeta 和 ProfileExportData 类型定义
- useProject 重构为双 store 架构，init 流程：mainStore -> migrateToProfiles -> loadProfileStore
- 所有 CRUD 操作（13 个 useCallback）从 store 改为 profileStore 引用
- switchProfile 实现并发安全（switchingProfileRef）和 loading 态管理
- Profile CRUD (create/delete/rename) 完整实现
- importProfile/exportProfile 实现带 formatVersion 校验的 JSON 导入导出

## Task Commits

Each task was committed atomically:

1. **Task 1: types.ts 添加 ProfileMeta 类型定义** - `50aa25f` (feat)
2. **Task 2: useProject.ts 重构为双 store 架构 + 迁移** - `c34c650` (feat)
3. **Task 3: 所有 CRUD 操作改用 profileStore** - `f645344` (feat)
4. **Task 4: switchProfile 方法含 loading 态管理** - `b84df22` (feat)
5. **Task 5: Profile CRUD 方法 (create/delete/rename)** - `95f49a8` (feat)
6. **Task 6: importProfile/exportProfile 方法** - `6b29df1` (feat)

## Files Created/Modified
- `src/lib/types.ts` - 新增 ProfileMeta (id/name/createdAt) 和 ProfileExportData (formatVersion/profileName/exportedAt/data) 类型
- `src/hooks/useProject.ts` - 核心 hook 重构：双 store 架构 + 迁移 + Profile CRUD + switch + import/export，所有 CRUD 改用 profileStore

## Decisions Made
- 原 `store` state 保留但指向 profileStore，最大程度减少对 useRecentCommands 和 App.tsx 的影响
- switchProfile 使用 useRef 作为并发锁（而非 useState），避免 state 更新触发不必要的 re-render
- importProfile 内部使用 dynamic import 读取文件（`await import("@tauri-apps/plugin-fs")`），与顶层 writeTextFile 导出导入共存
- 迁移逻辑将旧的 shortcut binding 格式迁移也纳入（检测 SHORTCUT_BINDINGS_KEY 为空时从 CommandItem.shortcut + presetShortcuts 迁移）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 20-02 可以直接消费 useProject 暴露的 Profile 管理接口：profileMetas/activeProfileId/switchProfile/createProfile/deleteProfile/renameProfile/exportProfile/importProfile/profileSwitching/mainStore
- SettingsDialog 需要添加 profile 下拉框、管理区域、导入导出按钮
- App.tsx 需要集成 profileSwitching loading 态 overlay
- useRecentCommands 不需要修改（store 引用已自动指向 profileStore）

## Self-Check: PASSED

- src/lib/types.ts: FOUND
- src/hooks/useProject.ts: FOUND
- 20-01-SUMMARY.md: FOUND
- 50aa25f (Task 1): FOUND
- c34c650 (Task 2): FOUND
- f645344 (Task 3): FOUND
- b84df22 (Task 4): FOUND
- 95f49a8 (Task 5): FOUND
- 6b29df1 (Task 6): FOUND

---
*Phase: 20-多配置文件管理*
*Completed: 2026-06-04*
