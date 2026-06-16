---
phase: 18-快捷键设置面板
reviewed: 2026-06-05T12:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/hooks/useShortcutActions.ts
  - src/hooks/__tests__/useShortcutActions.test.ts
  - src/lib/__tests__/shortcutConflict.test.ts
  - src/lib/types.ts
  - src/lib/shortcutUtils.ts
  - src/hooks/useGlobalShortcuts.ts
  - src/hooks/useProject.ts
  - src/App.tsx
  - src/components/CommandCard.tsx
  - src/components/MainArea.tsx
  - src/hooks/__tests__/useGlobalShortcuts.test.ts
  - src/components/ShortcutPanel.tsx
  - src/components/SettingsDialog.tsx
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: fix_applied
fix_round: 1
fix_notes:
  CR-01: FIXED — useProject.ts commands useMemo 注入 shortcutBindings 到 cmd.shortcut
  CR-02: FIXED — ShortcutPanel.tsx onSetBinding 类型签名添加 skipConflictFor 参数
  WR-01: NO_CHANGE — 注释已足够清晰
  WR-02: NO_CHANGE — 两个 Dialog 不同时 open，Radix 焦点锁定不会冲突
  WR-03: FIXED — 录制模式下搜索输入框 disabled
  WR-04: FIXED — 旧快捷键系统标记 @deprecated
  WR-05: FIXED — findConflict 添加 normalizeShortcut 规范化比较
  IN-01: SKIPPED — 测试覆盖建议，非代码问题
  IN-02: SKIPPED — 性能优化建议，当前规模无影响
  IN-03: SKIPPED — 文件拆分建议，独立重构任务
---

# Phase 18: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 18 为 EasyPack 添加了统一的快捷键设置面板（ShortcutPanel），包含快捷键录制、冲突检测、分组显示、搜索过滤和重置功能。整体架构设计合理，hook 的 ref 模式防止了闭包过期问题，测试覆盖了核心逻辑。

审查发现 2 个 Critical 问题和 5 个 Warning。最严重的问题是：Phase 18 的统一快捷键绑定（`shortcutBindings`）与 Phase 11 的旧快捷键系统（`presetShortcutsMap` / `cmd.shortcut`）完全独立运行，导致用户在 ShortcutPanel 中设置的快捷键不会显示在 CommandCard 徽章上，形成数据不一致。第二个 Critical 是 ShortcutPanel 的 `onSetBinding` 类型声明省略了 `skipConflictFor` 参数，但在冲突覆盖流程中实际传入了该参数，属于运行时可能误传参数的类型安全漏洞。

## Critical Issues

### CR-01: 统一快捷键绑定与 CommandCard 徽章数据源脱节

**File:** `src/hooks/useProject.ts:97-114` + `src/components/MainArea.tsx:299`
**Issue:** Phase 18 引入的统一快捷键绑定 `shortcutBindings` 使用 `command.${cmd.id}` 作为 key 存储快捷键，但 CommandCard 上显示的快捷键徽章读取的是 `cmd.shortcut` 字段。`cmd.shortcut` 仅由 Phase 11 的旧系统 `presetShortcutsMap` 注入（第 109 行），与 Phase 18 的 `shortcutBindings` 完全无关。

这意味着：
1. 用户在 ShortcutPanel 中为某个指令设置了快捷键 → 该绑定保存在 `shortcutBindings["command.xxx"]`
2. 全局快捷键注册（`useGlobalShortcuts`）能正确读取并生效
3. 但 CommandCard 上的快捷键徽章（`MainArea.tsx:299` 传 `shortcut={cmd.shortcut}`）不会显示该绑定

用户在 ShortcutPanel 设置快捷键后回到主界面，看不到任何视觉反馈，以为设置没有生效。这是数据模型层面的不一致。

**Fix:** 在 `commands` 的 `useMemo`（`useProject.ts:97-115`）中，将 `shortcutBindings` 中以 `command.` 为前缀的绑定也注入到对应 cmd 的 `shortcut` 字段：

```typescript
// useProject.ts:97-115
const commands = useMemo(() => {
  if (!selectedId) return [];
  if (commandMode === "project") {
    const projectCmds = projectCommandsMap[selectedId];
    if (projectCmds && projectCmds.length > 0) {
      return [...projectCmds].map((cmd) => {
        // Phase 18: inject unified shortcut binding
        const bindingKey = `command.${cmd.id}`;
        if (shortcutBindings[bindingKey]) {
          return { ...cmd, shortcut: shortcutBindings[bindingKey] };
        }
        return cmd;
      }).sort((a, b) => a.addedAt - b.addedAt);
    }
    return [];
  }
  return [...getDefaultsAsCommandItems(), ...customCommands]
    .map((cmd) => {
      // Phase 18: unified binding takes priority
      const bindingKey = `command.${cmd.id}`;
      if (shortcutBindings[bindingKey]) {
        return { ...cmd, shortcut: shortcutBindings[bindingKey] };
      }
      if (presetShortcutsMap[cmd.id]) {
        return { ...cmd, shortcut: presetShortcutsMap[cmd.id] };
      }
      return cmd;
    })
    .sort((a, b) => a.addedAt - b.addedAt);
}, [selectedId, customCommands, projectCommandsMap, commandMode, presetShortcutsMap, shortcutBindings]);
```

### CR-02: ShortcutPanel 的 onSetBinding 类型签名与实际调用不匹配

**File:** `src/components/ShortcutPanel.tsx:30-33` + `src/components/ShortcutPanel.tsx:135`
**Issue:** `ShortcutPanelProps.onSetBinding` 的类型声明为 `(actionId: string, shortcut: string) => Promise<string | null>`（2 个参数），但在 `confirmConflict` 回调中（第 135 行）实际调用时传入了 3 个参数：

```typescript
await onSetBinding(recordingId!, conflictInfo.newShortcut, [conflictInfo.actionId]);
```

第三个参数 `skipConflictFor` 在类型声明中被省略了。由于 TypeScript 函数类型检查允许传入多余参数（多余参数会被忽略），这里不会产生编译错误，但 **第三个参数在运行时实际上会被 `setShortcutBinding` 接收**（因为 App.tsx 第 558 行直接传入了 `setShortcutBinding`，它接受可选的第三个参数 `skipConflictFor`）。

这导致冲突覆盖逻辑在运行时行为正确但类型不安全：如果未来有人根据 ShortcutPanel 的接口声明实现新的 `onSetBinding` 函数而忽略第三个参数，冲突覆盖将无限循环（清除旧绑定后设置新绑定时仍然检测到冲突）。

**Fix:** 更新 ShortcutPanel 的 `onSetBinding` 类型声明以匹配实际函数签名：

```typescript
// ShortcutPanel.tsx:30-33
onSetBinding: (
  actionId: string,
  shortcut: string,
  skipConflictFor?: string[],
) => Promise<string | null>;
```

## Warnings

### WR-01: useShortcutActions 的 useMemo 依赖列表不完整（lint 抑制）

**File:** `src/hooks/useShortcutActions.ts:92-93`
**Issue:** `useMemo` 依赖数组仅包含 `[options.commands]`，但回调内部还通过 `options.commands` 引用了命令列表的引用。更关键的是，`eslint-disable-next-line react-hooks/exhaustive-deps` 注释抑制了 lint 警告。虽然 ref 模式确保了 handler 内部不引用过期的 callback，但如果 `commands` 数组的引用相同但内容被修改（例如外部 mutate 了数组元素），`useMemo` 不会重新计算，导致 actions 列表与实际 commands 不同步。

**Fix:** 当前实现依赖 commands 引用变化来触发重建，这是合理的。但建议添加注释说明为何依赖列表是完整的，避免未来维护者误解：

```typescript
// useMemo 依赖仅 options.commands：ref 模式确保 handler 内的 callback 始终最新，
// 仅当 command 列表本身（数量/ID）变化时需要重建 action 注册表
```

### WR-02: ShortcutPanel 中 reset 确认弹窗的 Dialog 与主 Dialog 并列渲染可能导致焦点管理冲突

**File:** `src/components/ShortcutPanel.tsx:296-403`
**Issue:** 组件返回了两个并排的 `<Dialog>` 元素——主快捷键面板和重置确认弹窗。两个 Dialog 都始终渲染在 DOM 中（仅通过 `open` prop 控制可见性）。当用户在重置确认弹窗中操作时，两个 Dialog 的焦点锁定（focus trap）可能冲突，特别是在 Radix UI 的 Dialog 实现下，可能出现 Tab 键焦点跳转到隐藏的 Dialog 中的情况。

**Fix:** 方案一：将重置确认改为简单的内联确认区域（推荐，避免嵌套 Dialog 的无障碍问题）。方案二：使用 Portal 并确保只有一个 Dialog 的 `open` 为 true。

### WR-03: ShortcutPanel 录制模式下搜索框仍可输入，可能干扰录制

**File:** `src/components/ShortcutPanel.tsx:148-151`
**Issue:** 录制模式下（`recordingId !== null`），keydown 事件处理器会检查 `e.target` 是否为 INPUT/TEXTAREA（第 150-151 行），如果是则跳过。但如果用户在录制过程中点击搜索框并开始打字，搜索框会正常接收输入，而快捷键组合中的字符键会同时被搜索框捕获，导致用户困惑。录制状态下搜索框应被禁用或 readonly。

**Fix:** 在 `recordingId !== null` 时，给搜索 Input 添加 `disabled` 或 `readOnly` 属性：

```tsx
<Input
  placeholder="搜索操作..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="pl-8 h-8 text-sm"
  disabled={recordingId !== null}
/>
```

### WR-04: Phase 11 旧快捷键系统（assignShortcut/clearShortcut/presetShortcutsMap）与 Phase 18 并存未清理

**File:** `src/hooks/useProject.ts:700-765`
**Issue:** `assignShortcut`、`clearShortcut`、`presetShortcutsMap` 等 Phase 11 遗留代码仍然存在于 useProject 中且通过返回值暴露。它们操作的是旧的数据路径（修改 `cmd.shortcut` 字段和 `presetShortcutsMap`），与 Phase 18 的统一绑定系统 `shortcutBindings` 完全独立。两套系统并存会导致：
1. 用户数据分散在两个不同的 store key 中
2. 迁移逻辑（`migrateToProfiles`）试图从旧格式迁移到新格式，但旧系统的写入入口仍然开放
3. 未来维护者难以理解哪个是权威数据源

**Fix:** Phase 18 应该是 Phase 11 的完整替代。建议在 Phase 18 收尾时标记旧代码为 `@deprecated` 并在下一个 phase 中清理，或者直接移除 `assignShortcut`/`clearShortcut` 的公开暴露。

### WR-05: findConflict 函数不支持快捷键规范化比较

**File:** `src/lib/shortcutUtils.ts:67-80`
**Issue:** `findConflict` 使用简单的字符串相等比较（`shortcut === newShortcut`）来检测冲突。但 Tauri Accelerator 格式存在多种等价写法，例如 `Ctrl+G` 和 `CommandOrControl+G` 在 Windows 上是等价的。当前实现会将这两个视为不同的快捷键，导致不会检测到冲突，但 `useGlobalShortcuts` 在注册时会失败（因为 OS 级别的快捷键已经注册）。

此外，`keyboardEventToShortcut` 总是生成 `CommandOrControl` 前缀（第 25 行），所以通过录制产生的快捷键始终使用 `CommandOrControl`。但如果旧数据中存储了 `Ctrl+` 前缀（例如手动写入或迁移残留），冲突检测会遗漏。

**Fix:** 在 `findConflict` 中添加快捷键规范化步骤，将 `Ctrl+` 统一转换为 `CommandOrControl+` 后再比较。

## Info

### IN-01: ShortcutPanel 缺少单元测试

**File:** `src/components/ShortcutPanel.tsx`
**Issue:** ShortcutPanel 是 Phase 18 的核心 UI 组件（约 400 行），包含录制逻辑、冲突检测 UI、分组折叠、搜索过滤、重置确认等交互，但没有对应的测试文件。虽然 `useShortcutActions` 和 `useGlobalShortcuts` 的 hook 有测试覆盖，但 ShortcutPanel 的 UI 交互逻辑（录制状态管理、冲突覆盖流程）没有测试保护。

**Fix:** 创建 `src/components/__tests__/ShortcutPanel.test.tsx`，覆盖以下场景：
- 搜索过滤正常工作
- 分组展开/折叠
- 录制开始/停止
- 冲突检测和覆盖确认
- 重置确认弹窗

### IN-02: ShortcutPanel.renderActionRow 未使用 React.memo 或 useCallback

**File:** `src/components/ShortcutPanel.tsx:205-292`
**Issue:** `renderActionRow` 是一个普通函数（非 React 组件），每次 ShortcutPanel 重渲染时所有 action 行都会重新创建。在操作数量较多时可能产生不必要的 DOM diff。不过对于当前规模（几个固定操作 + 少量自定义指令），性能影响可以忽略。

**Fix:** 如果未来 action 数量增长显著，可以提取为独立的 `React.memo` 组件。

### IN-03: useProject.ts 文件长度过长

**File:** `src/hooks/useProject.ts` (1058 行)
**Issue:** `useProject.ts` 已超过 1000 行，包含项目管理、命令 CRUD、快捷键管理、Profile 管理等多个职责。按照项目编码规范（文件 < 800 行），建议拆分。

**Fix:** 考虑将快捷键管理（`shortcutBindings`、`setShortcutBinding`、`clearShortcutBinding`、`resetAllShortcuts`、旧 `assignShortcut`/`clearShortcut`）和 Profile 管理（`switchProfile`、`createProfile` 等）分别提取为独立的 hook，通过组合模式在 `useProject` 中整合。

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
