# Phase 18: 快捷键设置面板 - Research

**Researched:** 2026-05-15
**Domain:** Tauri 全局快捷键系统扩展 + VS Code 风格设置面板 UI
**Confidence:** HIGH

## Summary

Phase 18 将 v1.2 的单指令快捷键绑定系统（Phase 11 实现）升级为统一的 VS Code 风格快捷键管理面板。核心工作包括：(1) 将 `useGlobalShortcuts` 从仅支持 CommandItem 快捷键扩展为支持 ShortcutAction 统一类型（指令执行 + 窗口操作 + 项目操作）；(2) 新建 ShortcutPanel Dialog 组件，提供分组列表 + 搜索 + 按键录制 + 冲突检测的一站式管理；(3) 移除 CommandDialog 和 CommandCard 中的快捷键绑定 UI，将快捷键管理统一收归面板。

现有基础设施非常完备：`shortcutUtils.ts` 提供了完整的键盘事件转换函数，`useGlobalShortcuts.ts` 有成熟的 OS 级注册/反注册生命周期管理（含 version counter 防竞态），`useProject.ts` 中 `assignShortcut`/`clearShortcut` 已实现冲突检测和 store 持久化。本次扩展的核心挑战在于设计 ShortcutAction 抽象层，使窗口/项目操作可以与指令操作共享同一套注册、持久化、冲突检测机制。

**Primary recommendation:** 新建 `ShortcutAction` 类型统一所有可绑定操作，通过独立的 store key `shortcutBindings` 持久化，`useGlobalShortcuts` 从 ShortcutAction 注册表驱动而非仅从 CommandItem 驱动。面板组件独立于 SettingsDialog，通过 props 回调机制获取窗口/项目操作 handler。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 独立 ShortcutPanel Dialog — 与 SettingsDialog 分离
- **D-02:** 入口为 SettingsDialog 底部的"快捷键设置..."按钮 — 点击后关闭设置弹窗并打开快捷键面板
- **D-03:** 面板布局为分组列表 + 搜索框 — 顶部搜索框，下方按分类折叠显示
- **D-04:** 面板尺寸为紧凑弹窗 — 约 380-450px 宽度，内容区域滚动
- **D-05:** 快捷键统一在面板管理 — 移除 CommandDialog 中的快捷键绑定 UI
- **D-06:** 移除 CommandDialog 中现有的快捷键录制按钮和相关 UI
- **D-07:** 3 个分类：指令执行 / 窗口操作 / 项目操作
- **D-08:** 窗口操作包含 2 个固定操作：显示/隐藏主窗口、切换悬浮窗
- **D-09:** 项目操作包含 3 个固定操作：切换上一个项目、切换下一个项目、打开当前项目文件夹
- **D-10:** 指令执行为动态列表 — 显示用户已添加的所有指令（全局 + 当前项目级）
- **D-11:** 统一 ShortcutAction 类型 — `{ id, label, category, handler }`，固定操作用固定 id，指令操作用动态 id
- **D-12:** 单次按键确认 — 点击后进入录制，按下有效组合键立即确认，Esc 取消
- **D-13:** 录制中视觉反馈 — "按下快捷键..."文字 + 虚线边框闪烁动画
- **D-14:** 冲突处理为警告 + 用户选择 — 黄色警告条显示冲突操作名，用户确认覆盖或取消
- **D-15:** 沿用 v1.2 按键限制 — 至少一个修饰键，最多 3 键组合
- **D-16:** 不预设任何默认快捷键 — 所有操作初始状态为"未绑定"
- **D-17:** 重置功能为"全部重置" — 面板底部按钮，清除所有绑定
- **D-18:** 重置需要确认弹窗

### Claude's Discretion
- ShortcutPanel Dialog 的具体实现方式（组件文件结构、状态管理方式）
- ShortcutAction 注册表的初始化和更新时机
- 搜索/筛选的具体实现（实时搜索 vs 防抖、搜索范围包括操作名和分类名）
- 分组列表的折叠/展开状态管理
- 面板打开时的初始滚动位置
- 录制状态下对全局快捷键的临时禁用策略
- 快捷键数据的持久化结构（独立的 store key 还是合并到现有 store）
- 窗口操作和项目操作 handler 的具体实现（如何调用 App 层的回调函数）
- CommandDialog 中移除快捷键 UI 后的布局调整

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KBD-01 | 提供类似 VS Code 的快捷键设置面板，列出所有可绑定的操作 | ShortcutPanel Dialog + ShortcutAction 注册表 + 分组列表布局 |
| KBD-02 | 用户可在面板中点击操作后按键录制新快捷键组合 | 复用 shortcutUtils.ts keyboardEventToShortcut + 录制状态机 |
| KBD-03 | 快捷键冲突检测和警告提示 | 扩展 assignShortcut 冲突检测为全操作类型 + D-14 警告条 UI |
| KBD-04 | 快捷键搜索、按分类筛选、重置为默认值功能 | 搜索框 + 分类折叠 + D-17 重置按钮 |
| KBD-05 | 除指令执行外，增加窗口操作和项目操作的可绑定操作 | ShortcutAction 统一类型 + useGlobalShortcuts 扩展 |
| KBD-06 | 快捷键绑定持久化保存，重启后恢复 | tauri-plugin-store + 独立 shortcutBindings key |
</phase_requirements>
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 快捷键 OS 级注册/反注册 | Browser/Client | — | tauri-plugin-global-shortcut 在前端 JS 层调用 `register()`/`unregister()` |
| 按键录制 (keyboard capture) | Browser/Client | — | 浏览器 KeyboardEvent 在渲染进程捕获 |
| 冲突检测逻辑 | Browser/Client | — | 遍历当前所有 ShortcutAction 的绑定，纯内存计算 |
| 快捷键持久化 | API/Tauri Store | — | tauri-plugin-store 写 JSON 文件 |
| 指令执行 handler | Browser/Client → Rust | — | 前端触发 → invoke() 调 Rust 命令 |
| 窗口操作 handler | Browser/Client → Tauri API | — | 前端调用 appWindow.show()/hide()/setFocus() |
| 项目操作 handler | Browser/Client → React State | — | selectProject()/openFolder() 修改 React 状态 |
| 面板 UI 渲染 | Browser/Client | — | React Dialog 组件 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tauri-apps/plugin-global-shortcut | 2.3.1 | OS 级快捷键注册/反注册 | Phase 11 已安装，已验证 Windows 兼容性 |
| @tauri-apps/plugin-store | 2.4.3 | 快捷键绑定数据持久化 | 项目已有，存储 shortcutBindings 数据 |
| React | 19.x | UI 组件 | 项目标准 UI 框架 |
| shadcn/ui Dialog | (installed) | 面板容器 | 项目已有 Dialog/ScrollArea/Input/Button 组件 |
| lucide-react | latest | 图标 | 分类图标、操作图标 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shortcutUtils.ts | (existing) | keyboardEventToShortcut + shortcutToDisplay | 录制和显示快捷键的核心工具 |
| sonner | (installed) | Toast 通知 | 冲突警告、绑定成功提示 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 独立 ShortcutPanel Dialog | 在 SettingsDialog 内嵌 Tab | 内嵌会导致设置弹窗过长，D-01 已决定独立 |
| 独立 shortcutBindings store key | 合并到 CommandItem.shortcut | 合并会导致非指令操作（窗口/项目）无处存储，独立 key 更干净 |

**Installation:**
```bash
# 无需安装新依赖 — 所有依赖已存在于项目中
```

## Architecture Patterns

### System Architecture Diagram

```
用户操作
  │
  ▼
ShortcutPanel Dialog (新增)
  │  ┌──────────────────────────────────────┐
  │  │ 搜索框 → 过滤 ShortcutAction[]       │
  │  │ 分组列表 → 按分类渲染操作行           │
  │  │   ├─ 指令执行 (动态 CommandItem[])    │
  │  │   ├─ 窗口操作 (固定 2 项)            │
  │  │   └─ 项目操作 (固定 3 项)            │
  │  │ 每行: [操作名] [快捷键标签/录制区]    │
  │  └──────────────────────────────────────┘
  │
  ├─ 点击快捷键标签 → 进入录制状态
  │   ├─ keyboardEventToShortcut(e) → Tauri Accelerator string
  │   ├─ 冲突检测: 遍历所有 ShortcutAction.bindings
  │   │   ├─ 无冲突 → 绑定 → 持久化 → 通知 useGlobalShortcuts 重注册
  │   │   └─ 有冲突 → 显示警告条 → 用户确认覆盖/取消
  │   └─ Esc → 取消录制
  │
  └─ "重置所有快捷键" → 确认弹窗 → 清除所有绑定 → 重新注册

数据流:
  ShortcutAction Registry (useShortcutActions hook)
    ├─ 指令列表: commands[] → 映射为 ShortcutAction[]
    ├─ 窗口操作: 固定 2 项 handler
    └─ 项目操作: 固定 3 项 handler
  │
  ▼
  shortcutBindings: Record<actionId, acceleratorString>
    ├─ 内存状态 (useState)
    └─ 持久化到 tauri-plugin-store (key: "shortcutBindings")
  │
  ▼
  useGlobalShortcuts (扩展)
    ├─ 读取 shortcutBindings
    ├─ 遍历 ShortcutAction[] → 找到有绑定的操作
    ├─ register(shortcut, handler) 到 OS
    └─ shortcut 触发 → 执行对应 action.handler()
```

### Recommended Project Structure
```
src/
├── components/
│   ├── ShortcutPanel.tsx          # 快捷键设置面板主组件 (新增)
│   ├── ShortcutPanelRow.tsx       # 面板中单行操作 (新增，可选提取)
│   ├── SettingsDialog.tsx         # 底部添加"快捷键设置..."按钮 (修改)
│   ├── CommandCard.tsx            # 移除快捷键录制/冲突 UI (修改)
│   └── CommandDialog.tsx          # 无需修改（已无快捷键 UI）
├── hooks/
│   ├── useGlobalShortcuts.ts      # 扩展支持 ShortcutAction (修改)
│   ├── useShortcutActions.ts      # ShortcutAction 注册表 hook (新增)
│   └── useKeyboard.ts             # 可能需调整与面板的交互 (微调)
├── lib/
│   ├── types.ts                   # 新增 ShortcutAction 类型 (修改)
│   └── shortcutUtils.ts           # 复用，不修改
└── App.tsx                        # 集成 ShortcutPanel + 传递 handlers (修改)
```

### Pattern 1: ShortcutAction 统一抽象

**What:** 将所有可绑定快捷键的操作统一为一个 `ShortcutAction` 类型，无论是指令执行、窗口操作还是项目操作。
**When to use:** 全局快捷键注册、冲突检测、面板显示。

```typescript
// src/lib/types.ts — 新增

export type ShortcutCategory = "command" | "window" | "project";

export interface ShortcutAction {
  id: string;           // 固定操作用固定 id，指令用 command.{commandId}
  label: string;        // 显示名称
  category: ShortcutCategory;
  handler: () => void;  // 触发时执行的回调
}

// 持久化结构 — 独立于 CommandItem.shortcut
// Record<actionId, acceleratorString>
// 例如: { "command.abc123": "CommandOrControl+G", "window.toggle-visibility": "Alt+V" }
```

**设计要点:**
- 指令操作的 id 格式为 `command.{commandId}`，避免与窗口/项目操作 id 冲突
- 窗口操作固定 id: `window.toggle-visibility`, `window.toggle-float`
- 项目操作固定 id: `project.prev`, `project.next`, `project.open-folder`
- `handler` 不持久化，每次从 App 层动态构建

### Pattern 2: useShortcutActions Hook

**What:** 构建和管理 ShortcutAction 注册表，整合指令列表 + 固定操作。
**When to use:** ShortcutPanel 和 useGlobalShortcuts 共享操作列表。

```typescript
// src/hooks/useShortcutActions.ts — 新增

interface UseShortcutActionsOptions {
  commands: CommandItem[];
  onExecute: (cmd: CommandItem) => void;
  onToggleVisibility: () => void;
  onToggleFloat: () => void;
  onPrevProject: () => void;
  onNextProject: () => void;
  onOpenFolder: () => void;
}

function useShortcutActions(options: UseShortcutActionsOptions): ShortcutAction[] {
  return useMemo(() => {
    const actions: ShortcutAction[] = [];

    // 动态指令操作
    for (const cmd of options.commands) {
      actions.push({
        id: `command.${cmd.id}`,
        label: cmd.name,
        category: "command",
        handler: () => options.onExecute(cmd),
      });
    }

    // 固定窗口操作
    actions.push(
      { id: "window.toggle-visibility", label: "显示/隐藏主窗口", category: "window", handler: options.onToggleVisibility },
      { id: "window.toggle-float", label: "切换悬浮窗", category: "window", handler: options.onToggleFloat },
    );

    // 固定项目操作
    actions.push(
      { id: "project.prev", label: "切换上一个项目", category: "project", handler: options.onPrevProject },
      { id: "project.next", label: "切换下一个项目", category: "project", handler: options.onNextProject },
      { id: "project.open-folder", label: "打开当前项目文件夹", category: "project", handler: options.onOpenFolder },
    );

    return actions;
  }, [/* deps */]);
}
```

### Pattern 3: 快捷键绑定持久化（独立 store key）

**What:** 所有快捷键绑定存储在独立的 `shortcutBindings` key 中，替代分散在 CommandItem.shortcut 和 presetShortcutsMap 中的绑定。
**When to use:** 面板绑定/解绑、应用启动恢复。

```typescript
// 存储 key: "shortcutBindings"
// 类型: Record<string, string>
// 示例:
{
  "command.abc-123": "CommandOrControl+G",
  "window.toggle-visibility": "Alt+V",
  "project.open-folder": "CommandOrControl+Shift+O"
}
```

**迁移策略 (D-16 兼容):** 由于 D-16 规定"不预设任何默认快捷键"，且现有用户的快捷键存储在 CommandItem.shortcut 和 presetShortcutsMap 中，需要：
1. 应用启动时检测 `shortcutBindings` key 是否存在
2. 如不存在，从旧的 CommandItem.shortcut 和 presetShortcutsMap 迁移
3. 迁移后将旧字段清除（可选，或保留但不再读取）

### Pattern 4: 录制状态机（面板内）

**What:** 面板内的按键录制，复用现有 keyboardEventToShortcut 逻辑。
**When to use:** 用户在面板中点击某操作的快捷键标签。

```typescript
// 面板内录制状态
const [recordingId, setRecordingId] = useState<string | null>(null);
const [conflictActionId, setConflictActionId] = useState<string | null>(null);

// 录制中: recordingId !== null
// 正常: recordingId === null
// 冲突: conflictActionId !== null (显示警告条，等待用户确认)
```

### Anti-Patterns to Avoid
- **不要在 ShortcutAction 中存储 handler 到 store**: handler 是函数，无法序列化。只持久化 actionId → shortcut 映射。
- **不要保留 CommandCard 中的录制逻辑**: D-05/D-06 明确移除，统一到面板。CommandCard 只保留显示（badge）。
- **不要忘记录制时禁用全局快捷键**: 现有 useGlobalShortcuts 已有 `recording` prop 支持，面板需要同步此状态。
- **不要在 assignShortcut 中只检查指令冲突**: 扩展后需要检查所有 ShortcutAction 的绑定，包括窗口/项目操作。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 键盘事件 → Tauri 格式转换 | 自写键盘映射 | shortcutUtils.ts keyboardEventToShortcut() | 已验证 Windows 兼容性，处理了 modifier-only、>3 键等边界 |
| Tauri 格式 → 显示格式 | 自写显示逻辑 | shortcutUtils.ts shortcutToDisplay() | 已有 CommandOrControl → Ctrl 映射 |
| OS 级快捷键注册生命周期 | 自管理 register/unregister | useGlobalShortcuts hook | 已有 version counter 防竞态、recording 时自动 unregisterAll |
| 快捷键持久化 | 自写文件 I/O | tauri-plugin-store | 项目已集成，JSON 持久化 |
| Toast 通知 | 自写通知组件 | sonner | 项目已集成 |

**Key insight:** 核心工具函数（shortcutUtils.ts）和基础设施（useGlobalShortcuts.ts、tauri-plugin-store）全部就绪。本次阶段的工程量主要在 UI 组件和类型抽象层，不在底层机制。

## Common Pitfalls

### Pitfall 1: 录制状态与全局快捷键冲突
**What goes wrong:** 用户在面板中录制快捷键时，按下的组合键同时触发了已注册的全局快捷键。
**Why it happens:** 录制窗口是应用内 Dialog，键盘事件同时被 OS 级全局快捷键拦截。
**How to avoid:** 面板打开录制时，设置 `recording=true`，useGlobalShortcuts 在 `recording` 为 true 时自动 `unregisterAll()`。现有 hook 已支持此机制。
**Warning signs:** 录制按键时触发了指令执行或窗口操作。

### Pitfall 2: 项目切换后指令列表变化导致绑定残留
**What goes wrong:** 用户给项目 A 的指令 X 绑定快捷键，切换到项目 B 后，指令 X 不在列表中，但 OS 级快捷键仍注册着。
**Why it happens:** 指令列表随项目切换变化，但 shortcutBindings 中的 command.xxx 绑定可能指向已不在当前列表的指令。
**How to avoid:** useGlobalShortcuts 在重新注册时，只注册当前 ShortcutAction 列表中存在的 actionId。不在列表中的绑定忽略（但不清除持久化数据，下次切回可恢复）。
**Warning signs:** 切换项目后，某些全局快捷键无响应。

### Pitfall 3: 面板搜索过滤后录制操作不可见
**What goes wrong:** 用户搜索过滤后点击录制，但面板内容更新（如冲突警告出现）导致操作行滚出视野。
**Why it happens:** 搜索状态与录制状态互相影响。
**How to avoid:** 录制中的操作行保持固定在视口内，冲突警告条出现在操作行内部而非外部。
**Warning signs:** 录制时面板滚动位置跳动。

### Pitfall 4: 窗口/项目操作 handler 闭包过期
**What goes wrong:** 绑定窗口操作的快捷键后，切换项目，handler 中引用的 currentProject 是旧值。
**Why it happens:** useGlobalShortcuts 使用 ref 模式（onExecuteRef）避免过期闭包，但新增的窗口/项目操作 handler 也需要同样的 ref 保护。
**How to avoid:** useShortcutActions 的所有 handler 使用 useCallback + ref 模式，或 useGlobalShortcuts 为每个 action 的 handler 使用 ref。
**Warning signs:** 快捷键触发后操作了错误的项目或窗口状态。

### Pitfall 5: Escape 键录制取消与 Dialog 关闭冲突
**What goes wrong:** 用户在录制中按 Esc 想取消录制，但 Esc 同时触发了 shadcn/ui Dialog 的关闭行为。
**Why it happens:** Radix Dialog 默认监听 Escape 键关闭弹窗。
**How to avoid:** 录制状态下通过 `onEscapeKeyDown` 或 `onKeyDown` 事件阻止 Dialog 关闭。shadcn/ui DialogContent 支持 `onEscapeKeyDown` prop。
**Warning signs:** 按 Esc 后面板意外关闭。

### Pitfall 6: 遗忘迁移旧格式快捷键数据
**What goes wrong:** 已在 Phase 11 绑定快捷键的用户升级后，旧绑定丢失。
**Why it happens:** 旧格式存储在 CommandItem.shortcut 和 presetShortcutsMap 中，新系统读取 shortcutBindings。
**How to avoid:** 应用启动时检测 shortcutBindings 是否存在，如不存在则从旧格式迁移。迁移逻辑：遍历 commands 中有 shortcut 字段的 → 写入 shortcutBindings[`command.${cmd.id}`] = cmd.shortcut，遍历 presetShortcutsMap → 写入 shortcutBindings[`command.${presetId}`] = value。迁移后清除旧字段。
**Warning signs:** 升级后用户之前绑定的快捷键全部消失。

## Code Examples

### 现有冲突检测逻辑 (useProject.ts, 可复用模式)

```typescript
// 来源: src/hooks/useProject.ts L475-509 [VERIFIED: codebase]
const assignShortcut = useCallback(
  async (commandId: string, shortcut: string) => {
    const conflict = commands.find(
      (c) => c.shortcut === shortcut && c.id !== commandId
    );
    if (conflict) {
      toast.error("快捷键冲突", {
        description: `快捷键 ${shortcutToDisplay(shortcut)} 已被指令 "${conflict.name}" 使用`,
      });
      return false;
    }
    // ... bind logic
  },
  [commandMode, selectedId, projectCommandsMap, customCommands, store, commands, presetShortcutsMap]
);
```

**扩展要点:** 面板中的冲突检测需覆盖所有 ShortcutAction（指令+窗口+项目），不仅限于当前 commands 列表。检测函数签名应变为：

```typescript
function findConflict(
  bindings: Record<string, string>,
  excludeActionId: string,
  newShortcut: string
): { actionId: string; label: string } | null {
  for (const [actionId, shortcut] of Object.entries(bindings)) {
    if (actionId !== excludeActionId && shortcut === newShortcut) {
      const action = allActions.find((a) => a.id === actionId);
      return { actionId, label: action?.label ?? actionId };
    }
  }
  return null;
}
```

### 现有 useGlobalShortcuts 录制保护 (可复用)

```typescript
// 来源: src/hooks/useGlobalShortcuts.ts L32-35 [VERIFIED: codebase]
if (!enabled || recording) {
  unregisterAll().catch(console.error);
  return;
}
```

### 面板 Dialog Escape 键保护

```typescript
// shadcn/ui DialogContent 支持 onEscapeKeyDown
// 录制状态下阻止 Dialog 关闭
<DialogContent onEscapeKeyDown={(e) => {
  if (recordingId !== null) {
    e.preventDefault();  // 阻止 Dialog 关闭
    setRecordingId(null); // 改为取消录制
  }
}}>
```

### ShortcutPanel 搜索过滤

```typescript
// 实时搜索，无防抖（列表项少，性能无影响）
const filteredActions = useMemo(() => {
  if (!searchQuery.trim()) return actions;
  const q = searchQuery.toLowerCase();
  return actions.filter((a) =>
    a.label.toLowerCase().includes(q) ||
    a.category.includes(q)  // 支持按分类名搜索
  );
}, [actions, searchQuery]);

// 按分类分组
const grouped = useMemo(() => {
  const groups: Record<ShortcutCategory, ShortcutAction[]> = {
    command: [],
    window: [],
    project: [],
  };
  for (const action of filteredActions) {
    groups[action.category].push(action);
  }
  return groups;
}, [filteredActions]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CommandCard 内嵌录制 UI | 统一到 ShortcutPanel 管理 | Phase 18 (D-05) | CommandCard 简化，录制逻辑集中化 |
| CommandItem.shortcut 单字段存储 | 独立 shortcutBindings store key | Phase 18 | 支持非指令操作绑定，数据模型更清晰 |
| assignShortcut 仅检查 commands 列表 | 全 ShortcutAction 冲突检测 | Phase 18 | 窗口/项目操作的冲突也能被检测 |

**Deprecated/outdated:**
- `presetShortcutsMap` (useProject.ts): 将被 shortcutBindings 替代，迁移后废弃
- CommandCard 中的 `isRecording`/`onRecordingStart`/`onRecordingStop`/`onShortcutAssign`/`onShortcutClear`/`hasConflict` props: 将被移除 (D-05/D-06)
- MainArea 中的 `recordingCommandId`/`conflictCommandId` 状态: 将被移除

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | shadcn/ui Dialog 的 `onEscapeKeyDown` prop 可以阻止录制状态下关闭弹窗 | Architecture Patterns | 录制中按 Esc 会同时关闭面板 |
| A2 | 旧 presetShortcutsMap 的 key 就是 preset 的 id（如 "preset-0"） | Pattern 3 | 迁移时 key 格式不匹配导致绑定丢失 |
| A3 | tauri-plugin-store 的 `store.keys()` 方法可靠返回所有存储的 key | Pattern 3 | 迁移检测可能失败 |

**注意:** A1 需验证 shadcn/ui Dialog（基于 Radix Dialog）的 Escape 键行为。A2 已在代码中确认 presetShortcutsMap 的 key 来自 cmd.id（preset 格式为 "preset-{idx}"）。

## Open Questions

1. **旧数据迁移时机**
   - What we know: D-16 规定不预设默认快捷键，现有用户可能有自定义绑定
   - What's unclear: 是否需要在 Phase 18 实现自动迁移，还是在新安装时直接从空绑定开始
   - Recommendation: 实现一次性迁移，首次加载时检测 shortcutBindings key 是否存在

2. **项目切换时非当前项目指令的快捷键是否应保持注册**
   - What we know: 现有 useGlobalShortcuts 在项目切换时 unregisterAll + 重新注册
   - What's unclear: 如果用户给项目 A 的指令绑了快捷键，切到项目 B 后该快捷键是否仍应工作
   - Recommendation: 不保持（现有行为），只注册当前项目可见的指令。面板显示的指令列表随项目变化。

3. **面板中指令操作是否区分全局指令和项目级指令**
   - What we know: D-10 说"显示用户已添加的所有指令（全局 + 当前项目级）"
   - What's unclear: 在面板中是否需要视觉区分指令来源（全局 vs 项目）
   - Recommendation: 不区分（按 D-10 描述，统称"指令执行"分类），操作名即指令名，足够区分。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (已安装) |
| Config file | vitest.config.ts (项目根目录) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KBD-01 | ShortcutAction 注册表构建正确（指令+窗口+项目） | unit | `npx vitest run src/hooks/__tests__/useShortcutActions.test.ts` | Wave 0 |
| KBD-02 | keyboardEventToShortcut 在面板录制中正确工作 | unit | `npx vitest run src/lib/__tests__/shortcutUtils.test.ts` | Existing |
| KBD-03 | 冲突检测覆盖所有 action 类型 | unit | `npx vitest run src/lib/__tests__/shortcutConflict.test.ts` | Wave 0 |
| KBD-04 | 搜索过滤和分类筛选逻辑 | unit | `npx vitest run src/hooks/__tests__/useShortcutActions.test.ts` | Wave 0 |
| KBD-05 | useGlobalShortcuts 扩展后正确注册非指令操作 | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Existing (extend) |
| KBD-06 | shortcutBindings 持久化和恢复 | unit | `npx vitest run src/hooks/__tests__/useShortcutActions.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useShortcutActions.test.ts` — covers KBD-01, KBD-04, KBD-06
- [ ] `src/lib/__tests__/shortcutConflict.test.ts` — covers KBD-03 (扩展冲突检测)
- [ ] 扩展 `src/hooks/__tests__/useGlobalShortcuts.test.ts` — covers KBD-05

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 桌面单用户应用，无认证 |
| V3 Session Management | no | 无会话 |
| V4 Access Control | no | 无多用户权限 |
| V5 Input Validation | yes | keyboardEventToShortcut 已有输入验证（modifier 检查、3 键上限） |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for Tauri + Global Shortcut

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 快捷键注入 | Tampering | tauri-plugin-global-shortcut 在 OS 层注册，仅当前进程接收回调 |
| 恶意快捷键覆盖 | Tampering | 冲突检测 + 用户确认覆盖（D-14） |

## Sources

### Primary (HIGH confidence)
- `src/hooks/useGlobalShortcuts.ts` — 现有 OS 级快捷键生命周期管理 [VERIFIED: codebase]
- `src/lib/shortcutUtils.ts` — 键盘事件转换工具 [VERIFIED: codebase]
- `src/hooks/useProject.ts` — assignShortcut/clearShortcut 实现 [VERIFIED: codebase]
- `src/components/CommandCard.tsx` — 现有录制 UI 状态机 [VERIFIED: codebase]
- `src/components/MainArea.tsx` — 现有快捷键录制状态管理 [VERIFIED: codebase]
- `src/components/SettingsDialog.tsx` — Dialog 布局模式 [VERIFIED: codebase]
- `src-tauri/capabilities/default.json` — global-shortcut 权限配置 [VERIFIED: codebase]
- `.planning/phases/18-快捷键设置面板/18-CONTEXT.md` — 用户锁定决策 [VERIFIED: planning artifact]

### Secondary (MEDIUM confidence)
- npm registry: @tauri-apps/plugin-global-shortcut@2.3.1 [VERIFIED: npm registry]
- npm registry: @tauri-apps/plugin-store@2.4.3 [VERIFIED: npm registry]

### Tertiary (LOW confidence)
- shadcn/ui Dialog onEscapeKeyDown prop 行为 — 基于 Radix Dialog API，未在本项目中验证过 [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有依赖已安装且验证过
- Architecture: HIGH — 类型设计和数据流基于现有代码模式推导
- Pitfalls: HIGH — 来自实际代码审查和现有 bug 修复经验

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable — 纯前端改动，无外部依赖变化风险)
