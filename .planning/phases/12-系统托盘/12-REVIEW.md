---
phase: 12-系统托盘
reviewed: 2026-04-28T16:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/App.tsx
  - src/components/SettingsDialog.tsx
  - src/components/TitleBar.tsx
  - src/components/ui/switch.tsx
  - src/hooks/__tests__/useRecentCommands.test.ts
  - src/hooks/__tests__/useVisibilityState.test.ts
  - src/hooks/useProject.ts
  - src/hooks/useRecentCommands.ts
  - src/hooks/useTray.ts
  - src/hooks/useVisibilityState.ts
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src-tauri/tauri.conf.json
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
status: issues_found
---

# Phase 12: Code Review Report (Re-Review)

**Reviewed:** 2026-04-28T16:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

对 Phase 12 系统托盘功能进行第二次审查，验证前次 9 个问题（1 critical, 5 warning, 3 info）的修复情况。

**修复验证结果：**
- CR-01 (onCloseRequested 双重隐藏逻辑冲突): **已修复** -- TitleBar 的 `handleClose` 现在统一调用 `appWindow.close()`，移除了 `onCloseBehavior` prop，`onCloseRequested` 拦截器成为唯一的关闭行为决策点。
- WR-01 (useTray 使用 getCurrentWindow): **已修复** -- `appWindow: Window` 作为参数传入 `useTray`，内部统一使用该引用。
- WR-02 (Effect 1 职责边界): **已修复** -- 添加了详细的注释说明 Effect 1 vs Effect 2 的职责分工。
- WR-03 (setState 中的副作用): **已修复** -- store 写入已移出 state updater，但引入了新的竞态条件问题（见下方 CR-01）。
- WR-04 (菜单 enabled 状态): **已跳过** -- 无变化，合理。
- WR-05 (assetProtocol scope): **已修复** -- 从 `["**"]` 收窄为 `["$APPDATA/**", "$HOME/**"]`。

**新发现问题：** 1 个关键问题（useRecentCommands 状态与持久化不同步）、1 个警告（测试文件与组件接口不匹配）、2 个信息级问题。

## Critical Issues

### CR-01: useRecentCommands addRecentCommand 中 React 状态与 store 持久化数据不一致（竞态条件）

**File:** `src/hooks/useRecentCommands.ts:44-53`
**Issue:** WR-03 的修复将 store 写入从 state updater 移到了外部，但 store 写入使用的 `recentCommands` 是 `useCallback` 闭包捕获的值（第 47 行），而非 state updater 中的 `prev` 参数。

当快速连续调用两次 `addRecentCommand` 时（例如用户连续点击两个不同指令），第二次调用闭包中的 `recentCommands` 仍然是第一次调用之前的旧值。结果：

1. 第一次调用：state updater 正确使用 `prev` 计算 `[cmd-A, ...old].slice(0, 8)`，但 store 写入使用闭包中的 `recentCommands`（旧值）计算 `[cmd-A]` 并写入 store。
2. 第二次调用：state updater 使用 `prev`（已包含 cmd-A）正确计算 `[cmd-B, cmd-A, ...old].slice(0, 8)`，但 store 写入使用的 `recentCommands` 仍然是旧值，计算 `[cmd-B]` 并覆盖 store。

最终结果：React state 包含 `[cmd-B, cmd-A]`（正确），但 store 中只有 `[cmd-B]`（cmd-A 丢失）。下次启动恢复数据时，cmd-A 不存在。

```
// 第 47-48 行：使用闭包的 recentCommands（可能是过时的）
const filtered = recentCommands.filter((c) => c.command !== command);
const updated = [newItem, ...filtered].slice(0, MAX_COMMANDS);
```

**Fix:** 使用 ref 追踪最新的 recentCommands 值（与 storeRef 同理），确保 store 写入始终基于最新状态：

```typescript
const recentCommandsRef = useRef(recentCommands);
recentCommandsRef.current = recentCommands;

// 在 addRecentCommand 内部：
const addRecentCommand = useCallback(
  async (name: string, command: string) => {
    const newItem: RecentCommand = { name, command };

    setRecentCommands((prev) => {
      const filtered = prev.filter((c) => c.command !== command);
      return [newItem, ...filtered].slice(0, MAX_COMMANDS);
    });

    const currentStore = storeRef.current;
    if (currentStore) {
      try {
        // 使用 ref 获取最新值，而非闭包中的 recentCommands
        const current = recentCommandsRef.current;
        const filtered = current.filter((c) => c.command !== command);
        const updated = [newItem, ...filtered].slice(0, MAX_COMMANDS);
        await currentStore.set(STORE_KEY, updated);
      } catch (err) {
        console.error("Failed to persist recent commands:", err);
      }
    }
  },
  [] // 依赖数组可简化，因为通过 ref 读取最新值
);
```

注意：即使使用 ref，在快速连续调用时仍可能存在 store 写入顺序问题（后一次覆盖前一次）。如果需要严格的写入顺序保证，可以使用队列或 `setRecentCommands` 的回调形式同步计算 store 值：

```typescript
const addRecentCommand = useCallback(
  async (name: string, command: string) => {
    const newItem: RecentCommand = { name, command };
    let toPersist: RecentCommand[] = [];

    setRecentCommands((prev) => {
      const filtered = prev.filter((c) => c.command !== command);
      const updated = [newItem, ...filtered].slice(0, MAX_COMMANDS);
      toPersist = updated; // 捕获更新后的值用于持久化
      return updated;
    });

    const currentStore = storeRef.current;
    if (currentStore && toPersist.length > 0) {
      try {
        await currentStore.set(STORE_KEY, toPersist);
      } catch (err) {
        console.error("Failed to persist recent commands:", err);
      }
    }
  },
  []
);
```

## Warnings

### WR-01: TitleBar 测试文件引用已删除的 onCloseBehavior prop，测试将编译失败

**File:** `src/components/__tests__/TitleBar.test.tsx:37,42,49,62,82,89,96,103,110,115,121,128`
**Issue:** CR-01 修复移除了 TitleBar 组件的 `onCloseBehavior` prop（TitleBar.tsx 现在只接受 `onSettingsOpen`），但测试文件仍然传入 `onCloseBehavior="close"` 和 `onCloseBehavior="hide"`。所有 13 个测试用例都在 render 调用中传入了该已删除的 prop。

在 TypeScript 编译时，如果测试文件未被类型检查覆盖，这些错误可能不会被捕获。在运行时，React 会忽略未知 prop，所以测试可能仍然通过。但这意味着：
1. 第 120-124 行的测试 "close button calls hide when onCloseBehavior is hide" 断言 `mockHide` 被调用 -- 但当前 TitleBar 的 `handleClose` 只调用 `appWindow.close()`，所以该测试应验证 `mockClose` 而非 `mockHide`。该测试将**错误通过**，因为 `mockHide` 从未被调用，断言会失败。
2. 第 127-131 行的测试 "close button calls close when onCloseBehavior is close" 仍然有效（因为 TitleBar 总是调用 close），但 prop 名称具有误导性。

**Fix:** 更新测试文件以移除所有 `onCloseBehavior` prop，移除 "hide" 测试用例（该行为已不存在），并保留 "close" 测试用例但去掉 prop：

```typescript
// 所有 render 调用移除 onCloseBehavior prop
render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);

// 移除第 120-125 行的 "hide" 测试用例
// 保留第 127-131 行的测试但更新描述和断言
it("close button calls appWindow.close", () => {
  render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
  fireEvent.click(screen.getByLabelText("关闭"));
  expect(mockClose).toHaveBeenCalledOnce();
  expect(mockHide).not.toHaveBeenCalled();
});
```

## Info

### IN-01: useRecentCommands 测试未覆盖 store 持久化竞态条件

**File:** `src/hooks/__tests__/useRecentCommands.test.ts`
**Issue:** 测试覆盖了基本功能（初始化、去重、上限、持久化 key），但没有测试快速连续调用 `addRecentCommand` 时的 store 持久化行为。结合上述 CR-01 的竞态条件，建议增加一个测试验证连续添加时 store 写入的数据完整性。

**Fix:** 增加测试用例：

```typescript
it("连续快速添加多条指令时 store 持久化数据完整", async () => {
  const store = createMockStore();
  const { result } = renderHook(() => useRecentCommands({ store }));

  await waitFor(() => {
    expect(result.current.recentCommands).toEqual([]);
  });

  await act(async () => {
    await result.current.addRecentCommand("build", "npm run build");
    await result.current.addRecentCommand("dev", "npm run dev");
  });

  // 验证最后一次 store.set 包含两条记录
  const lastCall = mockStoreSet.mock.calls[mockStoreSet.mock.calls.length - 1];
  expect(lastCall[1]).toHaveLength(2);
});
```

### IN-02: useTray 中托盘图标创建期间存在短暂的静态图标到动态图标的切换

**File:** `src/hooks/useTray.ts:146-149` 和 `src-tauri/tauri.conf.json:27-31`
**Issue:** `tauri.conf.json` 定义了静态 `trayIcon` 配置（id: "main-tray"），应用启动时 Tauri 自动创建该托盘图标。随后 `useTray` Effect 1 检测到同名 id 的现有图标并关闭它（第 146-149 行），然后创建新的带菜单的托盘图标。这会导致应用启动时短暂的"无托盘图标"间隙。对于用户体验影响较小，仅作记录。

**Fix:** 如果需要消除闪烁，可以移除 `tauri.conf.json` 中的 `trayIcon` 配置，完全由 JS 端管理托盘生命周期。或者在 `useTray` 中直接复用已有图标（通过 `TrayIcon.getById` + `setMenu`）而非关闭后重建。

---

_Reviewed: 2026-04-28T16:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
