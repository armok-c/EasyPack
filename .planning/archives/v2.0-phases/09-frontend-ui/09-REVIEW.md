---
phase: 09-frontend-ui
reviewed: 2026-04-25T21:35:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src-tauri/src/commands/shell.rs
  - src-tauri/src/lib.rs
  - src/hooks/useProject.ts
  - src/components/MainArea.tsx
  - src/App.tsx
  - src/components/__tests__/MainArea.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-04-25T21:35:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

审查了 Phase 09 涉及的 6 个源文件：Rust 后端命令（shell.rs、lib.rs）、React 前端核心 hook（useProject.ts）、主区域组件（MainArea.tsx）、应用入口（App.tsx）以及测试文件（MainArea.test.tsx）。

整体代码质量良好，无安全漏洞和关键缺陷。发现 3 个 Warning 级别问题：一个涉及项目切换时项目信息未刷新的逻辑缺陷、一个键盘导航的网格列数硬编码问题、以及一个 useEffect 依赖项的自引用问题。另有 3 个 Info 级别建议。

## Warnings

### WR-01: removeProject 删除当前选中项目后不刷新项目信息

**File:** `src/hooks/useProject.ts:161-181`
**Issue:** `removeProject` 回调的依赖数组 `[projects, selectedId, store]` 中缺少 `fetchProjectInfo`。当用户删除当前选中的项目时，代码会自动选择相邻项目（D-10 规则），但不会为这个新选中的项目调用 `fetchProjectInfo`，导致右侧面板中文件夹大小和 Git 分支信息仍显示旧项目数据，直到用户手动点击切换项目。
**Fix:**
```typescript
const removeProject = useCallback(
  async (id: string) => {
    // ...existing logic...
    setSelectedId(newSelectedId);
    await store?.set(PROJECTS_KEY, updated);
    await store?.set(SELECTED_KEY, newSelectedId);
    await store?.delete(projectCommandsKey(id));
    // Fetch project info for the newly selected project
    if (newSelectedId) {
      const newProject = updated.find((p) => p.id === newSelectedId);
      if (newProject) fetchProjectInfo(newProject.path);
    }
  },
  [projects, selectedId, store, fetchProjectInfo]  // add fetchProjectInfo
);
```

### WR-02: 键盘导航使用硬编码的网格列数

**File:** `src/components/MainArea.tsx:38`
**Issue:** `ESTIMATED_GRID_COLS = 4` 是一个硬编码的近似值。网格使用 `auto-fill, minmax(140px, 1fr)` 布局，实际列数取决于容器宽度。在窗口较宽时可能显示 5-6 列，较窄时可能只有 2-3 列。上下方向键导航会跳过错误数量的卡片位置，导致焦点跳到不预期的卡片上。
**Fix:** 在运行时通过 `gridRef.current` 计算实际列数。可以从按钮元素的 `offsetLeft` 差值推算列数，或使用 `getComputedStyle` 获取 `grid-template-columns` 的数量：
```typescript
function getGridColumns(): number {
  if (!gridRef.current) return ESTIMATED_GRID_COLS;
  const style = getComputedStyle(gridRef.current);
  const cols = style.gridTemplateColumns.split(" ").length;
  return cols > 0 ? cols : ESTIMATED_GRID_COLS;
}
// In handleGridKeyDown, replace ESTIMATED_GRID_COLS with getGridColumns()
```

### WR-03: focusedCardIndex useEffect 依赖项包含自身状态

**File:** `src/components/MainArea.tsx:92-99`
**Issue:** `useEffect` 的依赖数组包含 `focusedCardIndex`，而 effect 内部又调用 `setFocusedCardIndex`。虽然由于 `setFocusedCardIndex(0)` 只在 `focusedCardIndex === -1` 时触发、不会形成无限循环，但这种模式让依赖关系不清晰，容易在未来维护中引入 bug（例如如果条件判断逻辑变化）。
**Fix:** 移除 `focusedCardIndex` 依赖，改用 `useRef` 跟踪上一次的 `activeZone` 来判断是否需要重置：
```typescript
const prevZoneRef = useRef(activeZone);
useEffect(() => {
  if (activeZone === "main" && commands.length > 0 && prevZoneRef.current !== "main") {
    setFocusedCardIndex(0);
  }
  if (activeZone !== "main") {
    setFocusedCardIndex(-1);
  }
  prevZoneRef.current = activeZone;
}, [activeZone, commands.length]);
```

## Info

### IN-01: build_full_command 函数在非测试代码中未被调用

**File:** `src-tauri/src/commands/shell.rs:7-9`
**Issue:** `build_full_command` 函数仅在单元测试中使用，`execute_command` 已改用 `-d` 参数直接指定工作目录。该函数目前作为死代码存在（仅在 `#[cfg(test)]` 块中被引用）。如果未来不再需要 `cd /d &&` 模式，可以考虑将函数移到测试模块内部或标记 `#[cfg(test)]`。
**Fix:** 将 `build_full_command` 移入 `mod tests` 块中，或添加 `#[cfg(test)]` 标注。

### IN-02: Store 类型断言使用了 workaround

**File:** `src/hooks/useProject.ts:114`
**Issue:** `(s as unknown as { keys: () => Promise<string[]> }).keys()` 通过双重类型断言访问 `keys()` 方法。这表明 `@tauri-apps/plugin-store` 的类型定义可能不包含 `keys()` 方法，或者版本不匹配。虽然功能正确，但如果插件版本升级后类型定义更新，此处可能需要同步调整。
**Fix:** 可以在文件顶部定义一个扩展接口来替代内联断言：
```typescript
interface StoreWithKeys extends Store {
  keys: () => Promise<string[]>;
}
// 然后使用: (s as unknown as StoreWithKeys).keys()
```

### IN-03: execute_command 的 Windows Terminal spawn 未等待进程完成

**File:** `src-tauri/src/commands/shell.rs:19-25`
**Issue:** `StdCommand::new("wt").args(...).spawn()` 返回的 `Child` 进程对象被直接丢弃。虽然 Rust 的 `Drop` trait 会在 `Child` 离开作用域时关闭句柄（不会 kill 子进程），且对于终端启动场景这是预期行为，但如果需要跟踪终端进程状态（例如检测终端是否启动成功），则需要保留 `Child` 引用。
**Fix:** 当前行为对功能无影响，保持现状即可。如需跟踪进程状态，可将 `Child` 存储在 `Mutex<Option<Child>>` 中。

---

_Reviewed: 2026-04-25T21:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
