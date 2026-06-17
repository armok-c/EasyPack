---
phase: 21-build-version-sync
plan: 01
subsystem: build
tags: [version-sync, nodejs, build-automation, tauri]

# Dependency graph
requires: []
provides:
  - 构建时版本自动同步脚本 scripts/sync-version.js
  - tauri.conf.json beforeBuildCommand 更新
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "构建前置钩子：beforeBuildCommand 拦截实现构建前版本同步"

key-files:
  created:
    - scripts/sync-version.js
  modified:
    - src-tauri/tauri.conf.json

key-decisions:
  - "D-01~D-12: 所有 12 项决策均已实现 — 零依赖 Node.js 脚本，正则替换保留格式，package.json 作为单一版本源"

patterns-established:
  - "构建自动化：通过 beforeBuildCommand 前置注入脚本，打包前自动同步版本号"
  - "错误处理：缺失文件或格式错误时 process.exit(1) 阻止构建继续"

requirements-completed:
  - VER-05

# Metrics
duration: 4min
completed: 2026-06-17
---

# Phase 21 Build Version Sync: Plan 01 Summary

**零依赖 Node.js 脚本实现 package.json → tauri.conf.json + Cargo.toml 构建时版本自动同步，接入 beforeBuildCommand 确保每次打包前执行**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-17T08:45:00Z
- **Completed:** 2026-06-17T08:49:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 创建 `scripts/sync-version.js`：零依赖版本同步脚本，使用 Node.js 内置 `fs` + `path` 模块
- 正则替换 `"version": "X.X.X"`（JSON）和 `version = "X.X.X"`（TOML），保留文件原格式
- 目标文件版本已与源相同时跳过写入（D-08），避免无意义文件修改
- 所有错误路径（package.json 缺失、目标文件不可写、Cargo.toml 无 version 字段）均 exit(1) 终止构建
- 修改 `beforeBuildCommand` 为 `"node scripts/sync-version.js && npm run build"`，构建时前置执行同步

## Task Commits

Each task was committed atomically:

1. **Task 1: 创建版本同步脚本 scripts/sync-version.js** - `4e6e635` (feat)
2. **Task 2: 修改 tauri.conf.json 的 beforeBuildCommand** - `349b330` (feat)

**Plan metadata:** Pending (after SUMMARY.md commit)

## Files Created/Modified

- `scripts/sync-version.js` - 零依赖版本同步脚本，package.json 作为版本源，正则替换同步到 tauri.conf.json 和 Cargo.toml
- `src-tauri/tauri.conf.json` - `build.beforeBuildCommand` 从 `"npm run build"` 改为 `"node scripts/sync-version.js && npm run build"`

## Decisions Made

所有 12 项决策（D-01 ~ D-12）严格按计划实现：

| 决策 | 实现 |
|------|------|
| D-01: beforeBuildCommand 前置调用 | `tauri.conf.json` 中 `beforeBuildCommand` 值设为 `"node scripts/sync-version.js && npm run build"` |
| D-02: 同步后保留不还原 | `writeFileSync` 直接覆盖 |
| D-03: 零依赖 | 仅使用 `fs`、`path` 内置模块 |
| D-04: JSON 格式保留 | 正则匹配 `"version"\s*:\s*"[^"]*"` 替换值部分，缩进不变 |
| D-05: 三个文件同步 | 源 → `tauri.conf.json` + `Cargo.toml` |
| D-06: Cargo.toml 正则 | `/^version\s*=\s*"[^"]*"/m` 多行匹配 |
| D-07: 不校验 semver | 源版本原样复制 |
| D-08: 相同跳过 | `content.replace()` 无变化时跳过 |
| D-09: package.json 错误 | `process.exit(1)` + stderr 输出 |
| D-10: 目标文件不可读写 | `fs.accessSync` 预检 + `process.exit(1)` |
| D-11: Cargo.toml 无 version | `regex.test()` 未匹配 → `process.exit(1)` |
| D-12: 输出格式 | 有变更 → stdout `Version synced:`；错误 → stderr；无变更 → 静默 |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None

## Known Stubs

None — all logic fully implemented.

## Threat Surface Scan

No new security-relevant surface beyond what was in the plan's threat model (T-21-01 through T-21-03): file read/write with proper error guards.

## Next Phase Readiness

- Plan 21-01 完成：打包版本号同步机制就绪
- 后续可继续 Plan 21-02 及以上（移除全局指令、项目环境管理等功能）

---

*Phase: 21-build-version-sync*
*Completed: 2026-06-17*
