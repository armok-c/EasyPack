---
phase: 23-env-tabs-management
plan: 02
type: execute
subsystem: useProject.ts
tags: [env-crud, lifecycle-integration, persistence]
dependency_graph:
  requires: [23-01]
  provides: [23-03, 23-04]
  affects: [MainArea]
tech-stack:
  added: []
  patterns: [immutable-state-updates, per-project-store-keys, rollback-on-failure]
key-files:
  modified:
    - src/hooks/useProject.ts (947 -> 1208 lines, +261)
    - src/lib/types.ts (added Environment, ManagedFile, ProfileExportData fields)
    - src-tauri/src/commands/shell.rs (added read_file_content, write_file_content)
    - src-tauri/src/lib.rs (registered new commands)
  created: []
decisions:
  - D-01: 环境数据存入 Profile Store
  - D-02: 存储键 projectEnvs:<projectId> 和 projectActiveEnv:<projectId>
  - D-03: Profile 导出/导入包含环境数据
  - D-04: 删除项目时清理环境数据
  - D-05: 环境数据启动时预加载
  - D-06: 向后兼容——无环境数据时静默过渡
  - D-14: 标签页选中态与已应用环境状态独立
  - D-20: 环境名称在同一项目内唯一
  - D-21: 删除已应用环境时同步清除 active 记录
  - D-26: 点击启用直接执行，toast 反馈结果
  - D-27: 启用成功更新 active env + toast
  - D-28: 文件写入原子操作——任一失败回滚已写入文件
  - D-30: 启用写入失败时 toast 提示具体原因
metrics:
  duration: pending
  completed_date: pending
  commits: 4
references:
  - PLAN: 23-02-PLAN.md
  - CONTEXT: 23-CONTEXT.md
  - PREREQ: 23-01-PLAN.md
---

# Phase 23 Plan 02: Environment State Management — Summary

在 useProject hook 中添加环境状态管理、CRUD 方法、持久化集成和生命周期整合。同时补充 Plan 01 未执行的类型定义和 Rust 后端命令作为前置依赖。

## Commit History

| Commit | Message |
|--------|---------|
| `0e58e1e` | feat(23-02): add Environment/ManagedFile types and file read/write Rust commands |
| `fd5bb30` | feat(23-02): add env state declarations and persistence key helpers to useProject |
| `b0bcef9` | feat(23-02): add env CRUD and apply methods to useProject |
| `b6f1603` | feat(23-02): integrate env state into lifecycle methods and return statement |

## Task Results

### Task 1: Add env state declarations and persistence key helpers

**Status:** Completed

**Changes:**
- Import `Environment` type from `@/lib/types`
- Added `projectEnvsKey()` and `projectActiveEnvKey()` helper functions
- Added `projectEnvsMap` and `projectActiveEnvMap` state declarations
- Follows exact same pattern as existing `projectCommandsKey` and `projectCommandsMap`

### Task 2: Add env CRUD and apply methods

**Status:** Completed

**7 new methods:**
1. **createEnv**(projectId, name): Creates env with unique name check (D-20). Returns env ID on success, null on failure.
2. **renameEnv**(projectId, envId, newName): Renames env with unique name check excluding self. Updates `updatedAt` timestamp.
3. **deleteEnv**(projectId, envId): Deletes env. If deleted env was active, clears `projectActiveEnvMap` entry. UI layer handles "cannot delete applied env" check (D-21).
4. **setActiveEnv**(projectId, envId|null): Sets or clears the active env ID. Persists via `profileStore.set/save`.
5. **applyEnv**(projectId, envId): Writes all managed files to project directory via `invoke("write_file_content", ...)`. Implements best-effort rollback on failure (D-28).
6. **getProjectEnvs**(projectId): Returns `projectEnvsMap[projectId] ?? []`.
7. **getProjectActiveEnv**(projectId): Returns `projectActiveEnvMap[projectId] ?? null`.

All methods follow the immutable state update pattern (spread operator + setState callback) and persist via `profileStore.set()` + `profileStore.save()`.

### Task 3: Integrate env state into lifecycle methods and return

**Status:** Completed

**5 integration points:**
1. **loadProfileDataIntoState**: Restores `projectEnvs:*` and `projectActiveEnv:*` keys from profile store on startup (same pattern as projectCommands loading).
2. **removeProject**: Cleans up both storage keys and in-memory state when a project is deleted.
3. **exportProfile**: Collects env data from all project env keys and includes `projectEnvs` and `projectActiveEnvs` in the export JSON.
4. **importProfile**: Validates env data format and restores `projectEnvs` and `projectActiveEnvs` during import.
5. **Return statement**: Exposes 7 new properties/methods: `projectEnvsMap`, `projectActiveEnvMap`, `createEnv`, `renameEnv`, `deleteEnv`, `setActiveEnv`, `applyEnv`, `getProjectEnvs`, `getProjectActiveEnv`.

## Deviations from Plan

### Rule 3 — Plan 01 prerequisites not executed in worktree

**Found during:** Task 1 execution
**Issue:** Plan 01 (types + Rust commands) had not been executed in this worktree. The `Environment`/`ManagedFile` types and `read_file_content`/`write_file_content` Rust commands were missing, causing blocking TypeScript and Rust compilation failures.
**Fix:** Added the Plan 01 prerequisites as the first commit:
1. `Environment` and `ManagedFile` interfaces to `types.ts` (per D-07, D-08)
2. `projectEnvs` and `projectActiveEnvs` fields to `ProfileExportData` (per D-03)
3. `read_file_content` and `write_file_content` Rust commands in `shell.rs`
4. Registered both commands in `lib.rs` invoke_handler
5. Added 5 unit tests for the new Rust commands
**Impact:** No functional impact. This is a worktree execution isolation issue — the types would exist if Plan 01 had been merged before Plan 02 started.
**Files modified:** `src/lib/types.ts`, `src-tauri/src/commands/shell.rs`, `src-tauri/src/lib.rs`

## Verification

- `npx tsc --noEmit` — 通过 (无错误)
- `cargo test` — 全部通过 (包含 5 个新 Rust 测试)
- 手动检查所有 5 个集成点：loadProfileDataIntoState、removeProject、exportProfile、importProfile、return 语句

## Files Modified

| File | Description |
|------|-------------|
| `src/lib/types.ts` | 新增 Environment、ManagedFile 接口；ProfileExportData 新增 projectEnvs/projectActiveEnvs |
| `src-tauri/src/commands/shell.rs` | 新增 read_file_content、write_file_content 命令 + 5 个单元测试 |
| `src-tauri/src/lib.rs` | 注册 read_file_content、write_file_content 到 invoke_handler |
| `src/hooks/useProject.ts` | 新增 env 状态、CRUD 方法、生命周期集成、返回对象暴露 (+261 行) |

## Threat Flags

无新威胁面引入 — 所有变更均为内部状态管理和持久化集成。applyEnv 的 rollback 使用 best-effort 策略（与 threat model T-23-04 一致）。

## Self-Check: PASSED

- [x] projectEnvsMap 和 projectActiveEnvMap state 定义正确
- [x] createEnv/renameEnv/deleteEnv CRUD 方法实现完整
- [x] setActiveEnv 和 applyEnv 方法实现完整（含 rollback）
- [x] loadProfileDataIntoState 恢复环境数据
- [x] removeProject 清理环境数据
- [x] exportProfile/importProfile 包含环境字段
- [x] 所有 env 方法从 useProject 返回对象中暴露
- [x] TypeScript 编译通过
- [x] 向后兼容：无 env 数据的旧用户数据不受影响
- [x] Rust 测试全部通过
