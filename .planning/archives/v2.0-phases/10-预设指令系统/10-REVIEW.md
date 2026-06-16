---
phase: 10-预设指令系统
reviewed: 2026-04-26T12:00:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - src/components/CommandDialog.tsx
  - src/components/MainArea.tsx
  - src/components/__tests__/MainArea.test.tsx
  - src/components/ui/select.tsx
  - src/hooks/__tests__/useProject.test.tsx
  - src/hooks/useProject.ts
  - src/lib/icons.ts
  - src/lib/presets.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-26
**Depth:** quick
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 10 (预设指令系统) 实现了包含 25 个命令、4 个分类的预设库、双 Select UI（分类+命令）、以及 scope 选择器（全局/项目指令）。gap closure 10-03 已将 CargoShip 替换为 Ship 图标，并添加了 PRE-04 scope 选择 UI。

整体代码质量良好。快速模式扫描未发现硬编码密钥、危险函数、调试残留、空 catch 块、`as any` 类型断言、`==` 松散比较等常见反模式。

发现 2 个 Warning 级别问题和 1 个 Info 级别建议。

## Warnings

### WR-01: handleOpenChange 闭包中 commandMode 依赖缺失

**File:** `src/components/CommandDialog.tsx:116-132`
**Issue:** `handleOpenChange` 的 `useCallback` 依赖数组为 `[initialData, onOpenChange]`，但函数体内第 127 行使用了 `commandMode`（`setSelectedScope(commandMode)`）。当 Dialog 打开后 `commandMode` prop 发生变化时，关闭 Dialog 的重置操作会使用过时的 `commandMode` 值，导致 scope 被重置为错误的模式。

**Fix:**
```typescript
const handleOpenChange = useCallback(
  (newOpen: boolean) => {
    if (!newOpen) {
      setName(initialData?.name ?? "");
      setCommand(initialData?.command ?? "");
      setSelectedIcon(initialData?.icon ?? DEFAULT_ICON);
      setNameDirty(false);
      setCommandDirty(false);
      setSelectedCategory("");
      setSelectedPresetId("");
      setSelectedScope(commandMode);
    }
    onOpenChange(newOpen);
  },
  [initialData, onOpenChange, commandMode] // <-- 添加 commandMode
);
```

### WR-02: updateCommand 未传递 scope 字段，编辑后 scope 丢失

**File:** `src/hooks/useProject.ts:305-331`
**Issue:** `updateCommand` 的签名仅接受 `{ name, command, icon }`，不包含 `scope` 字段。当用户在项目模式下编辑指令时，更新操作使用 `{ ...projectCmds[idx], ...data }` 保留了原有 scope。但 `CommandDialog` 的 `handleDialogSubmit`（MainArea.tsx:71-82）在编辑模式下调用 `updateCommand(editingCommand.id, data)` 时，`data` 来自 `onSubmit` 回调，其中包含 `scope` 字段但 `updateCommand` 的类型签名直接丢弃了它。

当前行为恰好是正确的（因为 `...data` 展开后 `scope` 不在 `data` 参数类型中，所以原有 scope 被保留），但这属于偶然正确——类型系统没有强制保证这一点。如果未来有人在 `updateCommand` 签名中添加 `scope`，可能意外改变行为。

**Fix:** 在 `updateCommand` 的参数类型中明确排除或显式处理 `scope`，使意图清晰：
```typescript
// 方案 A：在 JSDoc 中明确说明 scope 不变
async (id: string, data: { name: string; command: string; icon: string }) => {
  // scope is intentionally preserved from existing item, not overwritten
```
或方案 B（更安全）：在 `updateCommand` 内部显式 pick 需要的字段：
```typescript
const updatedItem: CommandItem = {
  ...projectCmds[idx],
  name: data.name,
  command: data.command,
  icon: data.icon,
  // scope intentionally preserved
};
```

## Info

### IN-01: preset-claude ID 存在于 defaults 但不在 ALL_PRESETS 中

**File:** `src/lib/presets.ts:76-83`
**Issue:** `getDefaultsAsCommandItems()` 返回的 `preset-claude` 条目仅存在于默认列表，不在 `ALL_PRESETS` 数组中。这是有意设计（claude 不是标准预设库命令），但如果未来代码尝试通过 `ALL_PRESETS.find(p => p.id === "preset-claude")` 查找，将返回 `undefined`。建议在代码注释或类型层面明确此约定。

**Fix:** 在 `getDefaultsAsCommandItems()` 的 JSDoc 中补充说明 `preset-claude` 是特殊默认指令、不属于预设库。

---

_Reviewed: 2026-04-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
