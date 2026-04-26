---
status: resolved
trigger: "创建自定义指令有问题无法保存，切换全局和项目就消失了，创建的自定义指令样式有问题"
created: 2026-04-25
updated: 2026-04-26
---

## Symptoms

### Expected Behavior
- Phase 9 计划中定义：用户通过 Toggle Group 切换"全局指令"和"项目指令"模式
- 创建自定义指令后应持久保存到对应 scope（全局或项目）
- 切换 Toggle Group 时，已创建的指令应在列表中正确显示

### Actual Behavior
1. **保存失败**：创建自定义指令后，切换全局/项目范围时指令消失
2. **样式问题**：创建的自定义指令卡片样式异常（需对比 UI-SPEC 检查）

### Error Messages
- 未提供具体错误信息

### Timeline
- 不确定是否曾经正常工作

### Reproduction
- 用户建议直接查看代码排查

## Current Focus

hypothesis: "已确认根因"
next_action: "应用修复"

## Evidence

- timestamp: 2026-04-25T10:00 — 读取 useProject.ts, MainArea.tsx, App.tsx, CommandCard.tsx, types.ts, presets.ts, 09-UI-SPEC.md

## Root Cause Analysis

### Bug 1: 自定义指令切换后消失

**根因：`disableProjectCommands` 与 `enableProjectCommands` 的设计导致数据丢失。**

调用链分析：

1. 用户在"全局指令"模式下，点击"项目指令"按钮 → 调用 `enableProjectCommands()` (useProject.ts:366-380)
2. `enableProjectCommands` 从预设生成全新的 `CommandItem[]`（带新 UUID），写入 `projectCommandsMap[selectedId]`
3. 用户在项目模式下添加自定义指令 → `addCommand` 追加到 `projectCommandsMap[selectedId]`
4. 用户点击"全局指令"按钮 → 调用 `disableProjectCommands()` (useProject.ts:383-393)
5. **`disableProjectCommands` 执行 `delete next[selectedId]`，彻底删除项目指令集**
6. 用户再次点击"项目指令"按钮 → `enableProjectCommands` 再次从预设重建
7. **步骤 3 中添加的自定义指令已永久丢失**

**核心问题**：`disableProjectCommands` 的语义是"删除项目指令集并切换回全局"，但 Toggle Group 的 UI 模式切换应该只是**视图切换**，不应该删除数据。

正确行为应该是：
- 切换到"全局指令" = 仅切换视图，不删除项目指令数据
- 项目指令数据只在用户显式删除（如 disable 操作）时才清除

**修复方案**：

`disableProjectCommands` 不应删除 `projectCommandsMap` 中的数据。它应该只切换 `commandMode` 为 "global"。只有当用户通过某种"删除项目指令集"的显式操作时才删除数据。

但这里有个设计权衡：当前 UI 中，"全局指令"按钮的行为到底是什么？

- **方案 A**（推荐）：Toggle Group 纯视图切换。点击"全局指令"只改 commandMode，不删数据。`enableProjectCommands` 只在项目指令集不存在时创建。
- **方案 B**：保持删除语义，但在 MainArea 中加一个"删除项目指令集"的独立操作。

推荐方案 A，修改如下：

**useProject.ts 修改：**

1. `disableProjectCommands` → 改名为 `switchToGlobalMode`，只执行 `setCommandMode("global")`，不删除数据
2. `enableProjectCommands` → 改为：如果项目指令集已存在，只执行 `setCommandMode("project")`；不存在时才创建
3. 在项目指令集为空时，通过一个新函数 `removeProjectCommandSet` 来显式删除（可在删除最后一条指令时自动触发，已有此逻辑在 deleteCommand 第 337-344 行）

### Bug 2: 项目指令 Toggle 按钮禁用逻辑不正确

**App.tsx 第 48 行：**
```typescript
const isProjectToggleDisabled = !currentProject;
```

这只在没有选中项目时禁用。但根据 enableProjectCommands 的语义，当项目已有项目指令集时，按钮不应该被禁用（需要允许切换回去查看）。

当前逻辑的问题：
- 当 commandMode === "project" 时，"项目指令"按钮是激活状态（secondary variant），此时 disabled 属性不应生效
- 当 commandMode === "global" 且项目已有项目指令集时，"项目指令"按钮应该可点击（切换回项目模式）
- 当 commandMode === "global" 且项目没有项目指令集时，"项目指令"按钮应该可点击（首次创建）

所以实际上 `isProjectToggleDisabled` 只需要 `!currentProject`（当前逻辑几乎正确，只是变量名有点误导）。

如果采用方案 A（纯视图切换），这个逻辑可以保持不变。`isProjectToggleDisabled` 仅在无项目选中时为 true。

### Bug 2b: CommandCard 样式问题

对比 CommandCard.tsx 和 UI-SPEC：

CommandCard 当前样式：
- `bg-white/5 border border-white/10` — 背景和边框
- `rounded-xl` — 圆角
- `gap-2 p-4` — 内间距
- 自定义指令标记：`border-l-2 border-l-blue-400/50` — 左侧蓝色边框

检查 UI-SPEC 中的 CommandCard 规范... UI-SPEC 中主要关注的是 Toggle Group 和"打开文件夹"按钮，没有单独定义 CommandCard 样式。

但 MainArea.tsx 中的 `canEdit` 逻辑（第 271-273 行）有潜在问题：
```typescript
const canEdit = editMode && (isCustom || cmd.scope === "project");
```

这意味着项目指令集下的**所有指令**（包括从预设复制过来的）都可以编辑和删除。但 `showDeleteButton`（CommandCard.tsx:64）只检查 `isCustom`：
```typescript
const showDeleteButton = editMode && isCustom;
```

预设复制到项目级后，`type` 仍然是 `"preset"`（从 enableProjectCommands 代码看，它从 `getPresetAsCommandItems()` 复制，type 为 "preset"）。所以项目级的预设指令**有编辑能力但没有删除按钮**。这可能导致样式不一致。

但主要样式问题可能是用户看到的是 CommandCard 在不同 scope 下显示不一致（比如自定义指令有蓝色左边框，但预设指令没有）。

**对于样式问题，需要更多信息**：用户说的"样式有问题"具体指什么。但根据代码分析，最可能的问题是 `isCustom` 标记 — 当在项目模式下添加自定义指令时，`addCommand` 设置 `type: "custom"`，这会让卡片获得蓝色左边框标记，这是正常行为。

## Resolution

root_cause: "disableProjectCommands 在切换到全局模式时删除了项目指令集数据（projectCommandsMap[selectedId]），导致后续切换回项目模式时 enableProjectCommands 从预设重建，之前添加的自定义指令全部丢失。Toggle Group 的模式切换不应删除数据。"

fix: "将 disableProjectCommands 改为纯视图切换（仅 setCommandMode('global')），不删除 projectCommandsMap 数据。将 enableProjectCommands 改为：已存在项目指令集时只切换 commandMode，不存在时才创建。样式问题需要用户进一步确认具体表现。"
