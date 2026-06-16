---
phase: 11-全局快捷键
reviewed: 2026-04-27T11:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src-tauri/src/lib.rs
  - src/App.tsx
  - src/components/CommandCard.tsx
  - src/components/MainArea.tsx
  - src/components/__tests__/CommandCard.test.tsx
  - src/hooks/__tests__/useGlobalShortcuts.test.ts
  - src/hooks/useGlobalShortcuts.ts
  - src/hooks/useProject.ts
  - src/lib/__tests__/shortcutUtils.test.ts
  - src/lib/shortcutUtils.ts
  - src/lib/types.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 11: 代码审查报告

**审查时间:** 2026-04-27T11:00:00Z
**深度:** standard
**审查文件数:** 13
**状态:** issues_found

## 摘要

对 Phase 11（全局快捷键）相关的 13 个源文件进行了标准深度审查。Rust 后端（Cargo.toml、lib.rs、capabilities/default.json）配置正确，global-shortcut 插件已正确注册和授权。核心工具函数 `shortcutUtils.ts` 逻辑清晰，边界条件处理完善。

发现 3 个 Warning 和 4 个 Info 级别问题。主要关注点：`MainArea.tsx` 中的裸 `setTimeout` 未在 cleanup 中清除；`CommandCard.tsx` 的 recording effect 依赖回调函数引用，可能导致不必要的重新注册；`useProject.ts` 的 `clearShortcut` 在找不到命令时静默失败。测试文件覆盖合理，mock 配置正确。

## Warnings

### WR-01: MainArea 中 setTimeout 未在 effect cleanup 中清除

**File:** `src/components/MainArea.tsx:95`
**Issue:** `handleShortcutAssign` 内部使用 `setTimeout(() => setConflictCommandId(null), 2000)` 来自动清除冲突状态，但这个 timer 没有在任何 cleanup 逻辑中取消。如果 MainArea 组件在 2 秒内卸载（例如用户切换项目），React 会在已卸载组件上调用 state setter，虽然在 React 18+ 中不会抛出警告，但这仍然是一个不规范的副作用管理。
**Fix:**

```typescript
const handleShortcutAssign = useCallback(async (commandId: string, shortcut: string) => {
  const success = await assignShortcut(commandId, shortcut);
  if (!success) {
    setConflictCommandId(commandId);
    const timer = setTimeout(() => setConflictCommandId(null), 2000);
    // 需要在外部保存 timer 引用并在 cleanup 中清除
    return timer;
  } else {
    setRecordingCommandId(null);
  }
}, [assignShortcut]);
```

或者更简洁的方案——在 MainArea 中用 `useEffect` 管理 conflict 自动清除：

```typescript
const [conflictCommandId, setConflictCommandId] = useState<string | null>(null);
const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// 自动清除冲突状态
useEffect(() => {
  if (conflictCommandId) {
    conflictTimerRef.current = setTimeout(() => setConflictCommandId(null), 2000);
    return () => { if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current); };
  }
}, [conflictCommandId]);
```

### WR-02: CommandCard recording effect 依赖不稳定回调引用

**File:** `src/components/CommandCard.tsx:82-112`
**Issue:** `useEffect` 的依赖数组包含 `onRecordingStop` 和 `onShortcutAssign`，这两个回调来自父组件 MainArea。虽然 MainArea 用 `useCallback` 包裹了这些函数，但 `handleShortcutAssign` 依赖 `assignShortcut`，而 `assignShortcut` 的依赖列表包含 `commands`、`customCommands`、`projectCommandsMap` 等频繁变化的值。当这些值变化时，`handleShortcutAssign` 引用更新，导致 CommandCard 的 recording effect 重新执行（先移除再添加 keydown 监听器），这在用户正在录制快捷键的过程中可能丢失按键事件。
**Fix:** 在 CommandCard 内部使用 ref 稳定化回调引用：

```typescript
const onRecordingStopRef = useRef(onRecordingStop);
onRecordingStopRef.current = onRecordingStop;
const onShortcutAssignRef = useRef(onShortcutAssign);
onShortcutAssignRef.current = onShortcutAssign;

useEffect(() => {
  if (!isRecording) return;

  function handleRecordingKeydown(e: KeyboardEvent) {
    // ... 使用 ref 调用 ...
    if (e.key === "Escape") {
      onRecordingStopRef.current?.();
      return;
    }
    // ...
    onShortcutAssignRef.current?.(shortcutString);
  }

  window.addEventListener("keydown", handleRecordingKeydown);
  return () => window.removeEventListener("keydown", handleRecordingKeydown);
}, [isRecording]); // 仅依赖 isRecording
```

### WR-03: clearShortcut 对未知 commandId 静默失败

**File:** `src/hooks/useProject.ts:425-448`
**Issue:** `clearShortcut` 的三个分支（project commands、custom commands、preset shortcuts map）都使用条件匹配来定位目标命令。如果 `commandId` 不匹配任何已知来源（例如数据不一致或并发修改），函数会静默跳过所有分支，不会通知用户操作未生效，也不会记录任何日志。`assignShortcut` 中的冲突检测也有类似风险——`commands` 列表在闭包捕获和实际使用之间可能已变化。
**Fix:** 在三个分支之后添加 fallback 处理：

```typescript
const clearShortcut = useCallback(
  async (commandId: string) => {
    let cleared = false;
    if (commandMode === "project" && selectedId) {
      // ... 现有逻辑 ...
      cleared = true;
    } else if (customCommands.some((c) => c.id === commandId)) {
      // ... 现有逻辑 ...
      cleared = true;
    } else if (presetShortcutsMap[commandId]) {
      // ... 现有逻辑 ...
      cleared = true;
    }
    if (!cleared) {
      console.warn(`clearShortcut: commandId "${commandId}" not found in any source`);
      return; // 或者 toast 提示用户
    }
    toast.success("已清除快捷键");
  },
  [commandMode, selectedId, projectCommandsMap, customCommands, store, presetShortcutsMap]
);
```

## Info

### IN-01: useGlobalShortcuts 的 version counter 模式可读性较低

**File:** `src/hooks/useGlobalShortcuts.ts:39-45`
**Issue:** `let version = 0; const currentVersion = ++version;` 这个 pattern 在 effect 内部声明 `version` 为 0 再立即自增到 1 并赋值给 `currentVersion`。虽然逻辑正确（cleanup 中的 `version++` 会使旧闭包中的 `version` 不再等于 `currentVersion`，从而中止异步注册），但代码意图不够直观。每个 effect 实例内部的 `version` 变量只能被当前 effect 和其 cleanup 访问，实际上 `currentVersion` 永远是 1，`version` 在 cleanup 后变为 2。
**Fix:** 添加注释或简化命名使意图更清晰：

```typescript
// 每次effect运行时创建一个独立的version标记
// cleanup中将version自增，使进行中的异步注册检测到版本不匹配而中止
let version = 0;
const thisVersion = ++version; // thisVersion === 1
```

### IN-02: useProject.ts 中 Store keys() 方法的类型断言

**File:** `src/hooks/useProject.ts:127`
**Issue:** `const allKeys = await (s as unknown as { keys: () => Promise<string[]> }).keys();` 使用双重类型断言访问 Store 的 `keys()` 方法。这是因为 `@tauri-apps/plugin-store` 的类型定义没有暴露 `keys()` 方法。虽然 workaround 合理，但缺少注释说明原因。
**Fix:** 添加注释：

```typescript
// Store 类型定义未暴露 keys() 方法，但运行时存在该 API
const allKeys = await (s as unknown as { keys: () => Promise<string[]> }).keys();
```

### IN-03: useProject.ts 中 console.warn/error 用于生产代码

**File:** `src/hooks/useProject.ts:146,251`
**Issue:** Store 加载失败和文件夹选择失败时使用 `console.warn`/`console.error` 输出错误信息。在 Tauri 桌面应用中这些 console 输出用户不可见。Store 加载失败已有 graceful degradation（注释说明），但用户不会得到任何反馈。文件夹选择失败则已有 try-catch 但没有用户可见的错误提示。
**Fix:** 考虑在 Store 加载失败时通过 toast 通知用户（或至少在 dev 模式下提示），文件夹选择失败时添加 toast.error 提示。

### IN-04: CommandCard.test.tsx 中 mock shortcutToDisplay 的内联实现与真实实现可能不一致

**File:** `src/components/__tests__/CommandCard.test.tsx:10`
**Issue:** `shortcutToDisplay: vi.fn((s: string) => s.replace("CommandOrControl", "Ctrl"))` 在 mock 中手动实现了 `shortcutToDisplay` 的逻辑。如果真实 `shortcutToDisplay` 的实现发生变化（例如处理更多别名），测试不会检测到不一致。不过由于该函数非常简单，这个风险很低。
**Fix:** 可以考虑直接导入真实函数而非 mock，或在测试中添加断言验证 mock 行为与真实函数一致：

```typescript
// 方案 A: 不 mock shortcutToDisplay，使用真实实现
// vi.mock("@/lib/shortcutUtils", () => ({
//   keyboardEventToShortcut: vi.fn(),
//   // shortcutToDisplay 使用真实实现
// }));
```

---

_审查时间: 2026-04-27T11:00:00Z_
_审查者: Claude (gsd-code-reviewer)_
_深度: standard_
