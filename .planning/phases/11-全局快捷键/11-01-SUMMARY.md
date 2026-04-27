---
phase: 11-全局快捷键
plan: 01
subsystem: infra
tags: [tauri-plugin-global-shortcut, global-hotkey, accelerator, react-hooks, vitest]

# Dependency graph
requires: []
provides:
  - tauri-plugin-global-shortcut 三端配置 (Cargo.toml + lib.rs + capabilities)
  - CommandItem.shortcut 可选字段 (向后兼容)
  - keyboardEventToShortcut() 工具函数 (KeyboardEvent → Tauri Accelerator)
  - shortcutToDisplay() 工具函数 (Accelerator → 显示格式)
  - useGlobalShortcuts hook (OS 级全局快捷键注册生命周期管理)
affects: [11-02-ui-integration, 12-系统托盘]

# Tech tracking
tech-stack:
  added: [tauri-plugin-global-shortcut@2, @tauri-apps/plugin-global-shortcut]
  patterns: [useRef for stale closure prevention, version counter for async race prevention, TDD red-green cycle]

key-files:
  created:
    - src/lib/shortcutUtils.ts
    - src/lib/__tests__/shortcutUtils.test.ts
    - src/hooks/useGlobalShortcuts.ts
    - src/hooks/__tests__/useGlobalShortcuts.test.ts
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
    - src/lib/types.ts

key-decisions:
  - "KEY_MAP 查表优先于 length===1 判断，确保空格键正确映射为 Space"

patterns-established:
  - "shortcutUtils: keyboardEventToShortcut 使用 KEY_MAP 查表 → length 判断的优先级模式"
  - "useGlobalShortcuts: version counter 防止快速项目切换时的异步竞态条件"
  - "useGlobalShortcuts: useRef 保存 onExecute 回调避免 stale closure"

requirements-completed: [KB-01, KB-02, KB-03, KB-04, KB-06]

# Metrics
duration: 8min
completed: 2026-04-27
---

# Phase 11 Plan 01: 全局快捷键基础设施 Summary

**Tauri global-shortcut 插件三端配置 + keyboardEventToShortcut 工具函数 + useGlobalShortcuts hook 生命周期管理，共 14 个新增测试全部通过**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-27T02:28:36Z
- **Completed:** 2026-04-27T02:36:16Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 安装并配置 tauri-plugin-global-shortcut Rust 依赖、lib.rs 插件注册、capabilities 权限声明
- 安装 @tauri-apps/plugin-global-shortcut npm 前端包
- 扩展 CommandItem 接口添加 shortcut? 可选字段（向后兼容）
- 创建 keyboardEventToShortcut 工具函数：验证修饰键 (D-06)、键数限制 (D-07)、特殊键映射
- 创建 shortcutToDisplay 工具函数：CommandOrControl → Ctrl 显示转换
- 创建 useGlobalShortcuts hook：注册/注销/执行完整生命周期，防双触发、防竞态

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Tauri global-shortcut plugin + extend CommandItem type + create shortcut utilities** - `7b36b3f` (feat)
2. **Task 2: Create useGlobalShortcuts hook with registration lifecycle + tests** - `46fc548` (feat)

_Note: TDD tasks followed RED (test fails) -> GREEN (test passes) cycle within each task commit._

## Files Created/Modified
- `src-tauri/Cargo.toml` - 添加 tauri-plugin-global-shortcut = "2" 依赖
- `src-tauri/src/lib.rs` - 注册 tauri_plugin_global_shortcut 插件
- `src-tauri/capabilities/default.json` - 添加 global-shortcut:allow-* 权限
- `src/lib/types.ts` - CommandItem 接口新增 shortcut?: string 字段
- `src/lib/shortcutUtils.ts` - keyboardEventToShortcut + shortcutToDisplay 工具函数
- `src/lib/__tests__/shortcutUtils.test.ts` - 9 个单元测试（全部通过）
- `src/hooks/useGlobalShortcuts.ts` - useGlobalShortcuts hook
- `src/hooks/__tests__/useGlobalShortcuts.test.ts` - 5 个单元测试（全部通过）

## Decisions Made
- KEY_MAP 查表优先于 length===1 判断，确保空格键 " " 正确映射为 "Space" 而非被 toUpperCase() 处理

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] keyboardEventToShortcut 空格键映射错误**
- **Found during:** Task 1 (shortcutUtils GREEN 阶段)
- **Issue:** 空格键 `e.key = " "` 的 `length === 1` 导致走了 `toUpperCase()` 分支，返回 "CommandOrControl+ " 而非 "CommandOrControl+Space"
- **Fix:** 将 KEY_MAP 提取为常量，优先于 length 判断进行检查，确保特殊键（包括空格）正确映射
- **Files modified:** src/lib/shortcutUtils.ts
- **Verification:** npx vitest run shortcutUtils.test.ts 9/9 通过
- **Committed in:** 7b36b3f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 修复实现逻辑的边界条件 bug，无范围蔓延。

## Issues Encounted
- 空格键测试首次 GREEN 失败：`e.key = " "` 的 length 为 1 走了错误的分支。通过调整 KEY_MAP 查表优先级解决。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 全局快捷键基础设施完全就绪，Plan 02 可直接在 UI 中使用 useGlobalShortcuts hook 和 shortcutUtils 工具函数
- 全量测试 109 个全部通过，无回归
- 需注意：src/hooks/useGlobalShortcuts.ts 中的 console.error 用于插件注册失败日志，后续可接入统一日志系统

## Self-Check: PASSED

- All 4 created files verified on disk
- Both task commits (7b36b3f, 46fc548) verified in git log

---
*Phase: 11-全局快捷键*
*Completed: 2026-04-27*
