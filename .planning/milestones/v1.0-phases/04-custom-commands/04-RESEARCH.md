# Phase 4: 自定义指令与项目级覆盖 - Research

**Researched:** 2026-04-13
**Domain:** 自定义指令 CRUD、项目级指令覆盖、模态弹窗交互、数据持久化
**Confidence:** HIGH

## Summary

Phase 4 将 EasyPack 从只读预设卡片升级为可自定义的指令系统。核心变更包括：(1) 在主区域添加编辑模式切换（类似 iOS 编辑体验），(2) 添加/编辑指令的模态弹窗（shadcn/ui Dialog），(3) 非编辑模式下的右键菜单（shadcn/ui ContextMenu），(4) 项目级指令集覆盖全局指令，(5) 所有自定义数据通过已建立的 tauri-plugin-store 机制持久化。

现有代码基础良好：`useProject.ts` 已建立 Store 持久化模式，`CommandCard.tsx` 已有完整的交互状态，`MainArea.tsx` 已有自适应网格布局。Phase 4 主要在现有架构上扩展，不需要引入新的架构模式。

**Primary recommendation:** 复用已建立的 Store 持久化模式和卡片组件模式，通过扩展 `useProject` hook 和 `CommandCard` 组件来实现自定义指令 CRUD 和项目级覆盖。安装 shadcn/ui Dialog + ContextMenu + Input + Label 四个组件。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 主区域有编辑模式切换。项目信息区域（"当前项目: xxx"旁）放置设置/编辑图标按钮，点击进入编辑模式，再次点击退出
- **D-02:** 编辑模式下，卡片网格底部出现半透明"添加指令"占位卡片（虚线边框），点击弹出添加弹窗
- **D-03:** 编辑模式下，自定义指令卡片右上角显示 X 删除按钮，点击直接删除无确认弹窗
- **D-04:** 编辑模式下，点击自定义指令卡片弹出编辑弹窗（复用添加弹窗，预填数据）。预设指令不可编辑/删除
- **D-05:** 非编辑模式下，右键自定义指令卡片显示上下文菜单（编辑、删除选项）
- **D-06:** 未选中项目时编辑按钮隐藏
- **D-07:** 项目级指令集完全替换全局指令
- **D-08:** 创建项目级指令集时，默认包含 4 个预设指令作为起点
- **D-09:** 项目信息区域显示当前模式标签（"全局指令"或"项目自定义指令"），旁边有切换入口
- **D-10:** 删除项目级指令集中所有指令后，自动回退到全局指令模式
- **D-11:** 全局模式下预设指令不可删除；项目级指令集中预设指令可删除
- **D-12:** 添加/编辑弹窗包含：名称（必填）+ Shell 命令（必填）+ 图标（可选，默认 Terminal 图标）
- **D-13:** 图标选择使用预设图标列表（8-10 个常用 lucide-react 图标）
- **D-14:** 弹窗底部显示实时预览卡片
- **D-15:** 表单即时验证——名称和命令都有内容时"保存"按钮自动可用
- **D-16:** 需要安装 shadcn/ui Dialog 组件
- **D-17:** 自定义指令和预设指令混合展示，自定义指令有轻微视觉标记
- **D-18:** 统一排序——所有指令按添加顺序排列
- **D-19:** 统一数据结构 `CommandItem`（id + name + command + icon + type: 'preset' | 'custom' + scope: 'global' | 'project'）
- **D-20:** 全局自定义指令存储在 tauri-plugin-store（key: `customCommands`），项目级指令按 projectId 存储（key: `projectCommands:{projectId}`）
- **D-21:** 项目级指令集编辑复用主区域编辑模式
- **D-22:** 首次为项目创建独立指令集时自动进入编辑模式

### Claude's Discretion
- 自定义指令卡片的视觉标记具体样式（边框颜色、小标签位置等）
- 预设图标列表的具体图标选择（8-10 个）
- 编辑模式的进入/退出动效
- "添加指令"占位卡片的具体样式（虚线边框、透明度等）
- 右键菜单的具体实现方案（shadcn DropdownMenu 或 ContextMenu）
- CommandItem 的 id 生成策略
- 持久化数据的具体 schema 设计
- 项目信息区域的模式标签和切换入口的 UI 布局

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMD-05 | 用户可添加自定义全局指令（名称 + Shell 命令） | D-01~D-04 编辑模式 + 添加弹窗（D-12~D-15 表单设计）+ Store key `customCommands`（D-20）|
| CMD-06 | 用户可编辑和删除自定义指令 | D-03 删除 + D-04 编辑弹窗 + D-05 右键菜单 + D-19 CommandItem 数据结构 |
| CMD-07 | 每个项目可拥有独立的指令集覆盖全局默认指令 | D-07 完全替换 + D-08 默认预设 + D-09 模式标签 + D-10 自动回退 + D-20 Store key `projectCommands:{projectId}` |
| DATA-02 | 自定义指令（全局 + 项目级）保存到本地，重启后恢复 | 已建立的 tauri-plugin-store 持久化模式，autoSave 100ms |
| UI-07 | 添加/编辑指令时使用模态弹窗，操作流畅不打断主流程 | shadcn/ui Dialog 组件，D-12~D-15 弹窗设计 |
</phase_requirements>

## Standard Stack

### Core (已安装，无需新增)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @tauri-apps/plugin-store | 2.4.2 | 键值对持久化 | 已安装，Store 类提供 `get/set/has/delete/keys` 完整 CRUD |
| lucide-react | 1.8.0 | SVG 图标库 | 已安装，提供 Terminal、Code、Server 等自定义指令图标 |
| sonner | 2.0.7 | Toast 通知 | 已安装，用于操作反馈 |
| clsx | 2.1.1 | 条件 className | 已安装 |
| tailwind-merge | 3.5.0 | Tailwind 类名合并 | 已安装，cn() 工具函数 |

### New Components (需安装)

| Component | Install Command | Purpose | Why |
|-----------|----------------|---------|-----|
| shadcn/ui Dialog | `npx shadcn@latest add dialog` | 添加/编辑指令弹窗 | D-16 锁定需求。基于 Radix UI Dialog，支持模态遮罩、焦点陷阱、ESC 关闭 |
| shadcn/ui ContextMenu | `npx shadcn@latest add context-menu` | 右键操作菜单 | D-05 非编辑模式右键菜单。基于 Radix UI ContextMenu，原生右键触发 |
| shadcn/ui Input | `npx shadcn@latest add input` | 弹窗表单输入框 | D-12 名称和命令输入。与 Dialog 配合使用 |
| shadcn/ui Label | `npx shadcn@latest add label` | 弹窗表单标签 | D-12 表单字段标签。与 Input 配合使用 |

**安装命令:**
```bash
npx shadcn@latest add dialog context-menu input label
```

**Note:** 项目使用 `npm` 而非 `pnpm`（Phase 2 决策：pnpm 未在 PATH 中可用）。

## Architecture Patterns

### 推荐的数据结构设计

```typescript
// src/lib/types.ts — 统一指令数据结构 (per D-19)
interface CommandItem {
  id: string;           // crypto.randomUUID() 或 Date.now().toString(36)
  name: string;         // 显示名称
  command: string;      // Shell 命令
  icon: string;         // lucide-react 图标名称字符串（如 "Terminal"）
  type: 'preset' | 'custom';
  scope: 'global' | 'project';
  addedAt: number;      // Date.now() 时间戳，用于排序
}
```

**关键设计决策：icon 使用字符串而非 LucideIcon 组件引用。** 原因：序列化到 JSON 时函数/组件引用会丢失，需要在渲染时通过字符串映射回组件。这是持久化 UI 数据的标准模式。

### Store 持久化 Schema (per D-20)

```typescript
// 已有的 keys (Phase 2)
const PROJECTS_KEY = "projects";           // ProjectItem[]
const SELECTED_KEY = "selectedProjectId";  // string | null

// Phase 4 新增 keys
const CUSTOM_COMMANDS_KEY = "customCommands";                              // CommandItem[] — 全局自定义指令
// 项目级指令使用动态 key
function projectCommandsKey(projectId: string): string {
  return `projectCommands:${projectId}`;   // CommandItem[] | undefined
}
```

### 指令合并逻辑

```
当选中项目时：
1. 检查 projectId 对应的 projectCommands:{id} key 是否存在
2. 存在 → 使用项目级指令集（完全替换全局，per D-07）
3. 不存在 → 合并预设指令 + 全局自定义指令（按 addedAt 排序，per D-18）
```

### 推荐的 Hook 扩展模式

现有 `useProject.ts` 返回 `projects, selectedId, executeCommand` 等。Phase 4 需要扩展为同时管理指令数据：

```typescript
// useProject.ts 扩展后的返回值（概念示意）
return {
  // ... 现有属性保持不变
  commands: CommandItem[],                    // 当前显示的指令列表（已合并）
  commandMode: 'global' | 'project',          // 当前模式 (per D-09)
  editMode: boolean,                          // 编辑模式状态
  toggleEditMode: () => void,
  addCommand: (name: string, command: string, icon: string) => Promise<void>,
  updateCommand: (id: string, name: string, command: string, icon: string) => Promise<void>,
  deleteCommand: (id: string) => Promise<void>,
  enableProjectCommands: () => Promise<void>,  // 首次创建项目级指令集 (per D-22)
  disableProjectCommands: () => Promise<void>, // 删除项目级指令集，回退到全局
};
```

### 推荐的组件结构

```
src/
├── components/
│   ├── MainArea.tsx           # [扩展] 编辑模式切换、模式标签、添加占位卡片
│   ├── CommandCard.tsx        # [扩展] 右键菜单包裹、编辑模式样式、自定义标记
│   ├── CommandDialog.tsx      # [新建] 添加/编辑指令弹窗（复用 Dialog）
│   └── ui/
│       ├── dialog.tsx         # [新安装] shadcn/ui Dialog
│       ├── context-menu.tsx   # [新安装] shadcn/ui ContextMenu
│       ├── input.tsx          # [新安装] shadcn/ui Input
│       └── label.tsx          # [新安装] shadcn/ui Label
├── hooks/
│   └── useProject.ts          # [扩展] 指令 CRUD + 项目级覆盖逻辑
├── lib/
│   ├── presets.ts             # [扩展] PresetCommand → CommandItem 转换
│   ├── types.ts               # [新建] CommandItem 接口
│   └── icons.ts               # [新建] 图标名称→组件映射表
└── App.tsx                    # [扩展] 传递新的 props
```

### Pattern 1: Dialog + ContextMenu 配合使用

**重要提示（来自 shadcn/ui 官方文档）：** 当 Dialog 需要从 ContextMenu 中打开时，必须将 ContextMenu 包裹在 Dialog 内部。

```typescript
// 来源: shadcn/ui Dialog 官方文档 Notes 部分
<Dialog>
  <ContextMenu>
    <ContextMenuTrigger>...</ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onClick={handleEdit}>编辑</ContextMenuItem>
      <ContextMenuItem onClick={handleDelete}>删除</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
  <DialogContent>...</DialogContent>
</Dialog>
```

### Pattern 2: 图标名称字符串映射

```typescript
// src/lib/icons.ts — 持久化友好的图标映射
import {
  Terminal, Code, Server, Zap, GitBranch, Package,
  Play, Sparkles, Globe, Wrench, Rocket, Database,
  type LucideIcon
} from "lucide-react";

// 预设图标列表 (D-13: 8-10 个常用图标)
export const ICON_OPTIONS: Record<string, LucideIcon> = {
  Terminal,
  Code,
  Server,
  Zap,
  GitBranch,
  Package,
  Play,
  Rocket,
  Globe,
  Wrench,
};

export const DEFAULT_ICON = "Terminal";

// 名称字符串 → 组件
export function getIconByName(name: string): LucideIcon {
  return ICON_OPTIONS[name] ?? Terminal;
}
```

### Anti-Patterns to Avoid

- **不要直接在 CommandItem 中存储 LucideIcon 组件引用。** JSON.stringify 无法序列化 React 组件。使用字符串名称 + 映射表。
- **不要为全局和项目级指令分别创建 UI 组件。** 统一使用 CommandCard，通过 props 控制 visual variants。
- **不要在 Store 中为每个指令创建独立的 key。** 使用数组存储（`customCommands: CommandItem[]`），避免 keys 爆炸。
- **不要使用 `window.confirm()` 或 `window.prompt()`。** 所有交互使用 shadcn/ui 组件。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 模态弹窗 | 自定义遮罩 + 居中定位 | shadcn/ui Dialog | 焦点陷阱、ESC 关闭、滚动锁定、ARIA 属性等无障碍特性开箱即用 |
| 右键菜单 | 自定义 onContextMenu + 定位 | shadcn/ui ContextMenu | 虚拟定位、子菜单、键盘导航、屏幕阅读器支持 |
| 表单验证 | 自定义验证逻辑 | 即时验证（D-15 简单规则：非空即可） | 需求只要求名称和命令非空，不需要引入 form validation 库 |
| ID 生成 | 自定义 hash | `crypto.randomUUID()` | 浏览器原生 API，Tauri WebView 支持，UUID v4 标准格式 |
| 图标选择 | 图标搜索/上传 | 预设图标列表 (D-13) | 8-10 个常用图标足够，避免复杂的图标搜索 UI |
| Toast 通知 | 自定义通知组件 | sonner (已安装) | 已集成，保持一致性 |

## Common Pitfalls

### Pitfall 1: Dialog 无法从 ContextMenu 中打开
**What goes wrong:** ContextMenu 是 Radix Portal，Dialog 也是 Portal，嵌套顺序错误会导致 Dialog 无法打开。
**Why it happens:** Radix UI 的 Portal 层级冲突。ContextMenu 必须包裹在 Dialog 内部。
**How to avoid:** 参照 shadcn/ui 官方文档的 Dialog Notes 章节，将 ContextMenu 放在 Dialog 的子级。
**Warning signs:** 点击右键菜单项后弹窗不出现，控制台无报错。

### Pitfall 2: icon 序列化丢失
**What goes wrong:** 自定义指令保存后重新加载，图标消失或显示为 [object Object]。
**Why it happens:** React 组件无法被 JSON.stringify 序列化。
**How to avoid:** CommandItem.icon 使用字符串（如 "Terminal"），渲染时通过映射表转换为 LucideIcon 组件。
**Warning signs:** 重启应用后自定义指令图标显示异常。

### Pitfall 3: 项目级指令集与全局指令的合并时机
**What goes wrong:** 添加了全局自定义指令后，切换到项目级模式时看不到新指令。
**Why it happens:** D-07 规定项目级指令集**完全替换**全局指令，不是合并。这是设计决策，不是 bug。
**How to avoid:** 在 UI 上清晰标注当前模式（D-09），让用户理解项目级指令集是独立管理的。
**Warning signs:** 用户困惑"为什么我在全局添加的指令在项目里看不到"。

### Pitfall 4: Store key 冲突
**What goes wrong:** 项目 ID 包含特殊字符导致 Store key 解析错误。
**Why it happens:** 项目 ID 使用路径规范化（lowercase + forward slashes），可能包含冒号（如 `c:/users/...`）。
**How to avoid:** 使用 `projectCommands:{projectId}` 格式，冒号作为分隔符。Store 的 key 是纯字符串，不会解析。但如果后续需要按前缀查询 keys，注意 `store.keys()` 返回所有 key，需要过滤。
**Warning signs:** `store.get(key)` 返回 undefined 但数据确实存在。

### Pitfall 5: 编辑模式下卡片点击与执行的冲突
**What goes wrong:** 编辑模式下点击卡片触发了命令执行而非编辑弹窗。
**Why it happens:** CommandCard 现有的 onClick 直接调用 onExecute。
**How to avoid:** 编辑模式下，自定义指令的 onClick 行为改变：弹出编辑弹窗而非执行命令。预设指令点击无反应（D-04）。
**Warning signs:** 编辑模式下点击卡片打开终端执行了命令。

### Pitfall 6: 删除项目后残留的 Store 数据
**What goes wrong:** 删除项目后，该项目的 `projectCommands:{id}` key 仍然留在 Store 中。
**Why it happens:** Phase 2 的 removeProject 只清理了 PROJECTS_KEY 和 SELECTED_KEY。
**How to avoid:** 在 Phase 4 的 removeProject 逻辑中，增加一步 `store.delete(projectCommandsKey(id))`。
**Warning signs:** 重新添加同名项目后，出现旧的自定义指令配置。

## Code Examples

### 1. CommandItem 接口与预设转换

```typescript
// src/lib/types.ts
export interface CommandItem {
  id: string;
  name: string;
  command: string;
  icon: string;          // lucide-react 图标名称字符串
  type: 'preset' | 'custom';
  scope: 'global' | 'project';
  addedAt: number;
}
```

```typescript
// src/lib/presets.ts — 扩展：将预设转换为 CommandItem
import { CommandItem } from './types';

export const PRESET_COMMAND_ITEMS: CommandItem[] = PRESET_COMMANDS.map((cmd, idx) => ({
  id: `preset-${idx}`,
  name: cmd.name,
  command: cmd.command,
  icon: cmd.icon.displayName ?? 'Package', // LucideIcon 的 displayName
  type: 'preset' as const,
  scope: 'global' as const,
  addedAt: idx,
}));
```

### 2. Dialog + Input 表单弹窗

```typescript
// 来源: shadcn/ui Dialog 官方文档示例模式
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function CommandDialog({ open, onOpenChange, onSubmit, initialData }) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [command, setCommand] = useState(initialData?.command ?? "");

  const isValid = name.trim().length > 0 && command.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "编辑指令" : "添加指令"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-3">
            <Label htmlFor="cmd-name">名称</Label>
            <Input id="cmd-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="cmd-command">Shell 命令</Label>
            <Input id="cmd-command" value={command} onChange={(e) => setCommand(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!isValid} onClick={() => { onSubmit(name, command); onOpenChange(false); }}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. ContextMenu 包裹 CommandCard

```typescript
// 来源: shadcn/ui 官方文档 Dialog Notes + ContextMenu 用法
// 注意嵌套顺序：Dialog > ContextMenu > Trigger
<Dialog>
  <ContextMenu>
    <ContextMenuTrigger asChild>
      <CommandCard
        name={cmd.name}
        icon={getIconByName(cmd.icon)}
        command={cmd.command}
        onClick={() => editMode ? onEdit(cmd) : onExecute(cmd.command)}
      />
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onClick={() => onEdit(cmd)}>编辑</ContextMenuItem>
      <ContextMenuItem variant="destructive" onClick={() => onDelete(cmd.id)}>
        删除
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
  <DialogContent>
    {/* 编辑弹窗内容 */}
  </DialogContent>
</Dialog>
```

### 4. Store CRUD 操作模式

```typescript
// 沿用 useProject.ts 已建立的模式
// 添加自定义指令
const addCustomCommand = useCallback(async (cmd: Omit<CommandItem, 'id' | 'addedAt'>) => {
  const newItem: CommandItem = {
    ...cmd,
    id: crypto.randomUUID(),
    addedAt: Date.now(),
  };
  const commands = scope === 'project'
    ? await store.get<CommandItem[]>(projectCommandsKey(projectId)) ?? []
    : await store.get<CommandItem[]>(CUSTOM_COMMANDS_KEY) ?? [];
  const updated = [...commands, newItem];
  const key = scope === 'project' ? projectCommandsKey(projectId) : CUSTOM_COMMANDS_KEY;
  await store.set(key, updated);
}, [store, scope, projectId]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn/ui 单独 Radix 包 | 统一 radix-ui 包 | 2026.02 | 新安装的组件使用统一导入，但已有的旧组件不受影响 |
| Dialog 需要手动 Portal 处理 | shadcn/ui Dialog 内置 Portal | 一直如此 | 无需关心 Portal 细节 |
| tauri-plugin-store 手动 save | autoSave debounce（100ms） | Phase 2 已采用 | 无需每次操作后手动 save |

**注意：** 现有已安装的 shadcn/ui 组件（button、scroll-area、sonner）使用旧的独立 `@radix-ui/*` 包导入方式。新安装的组件可能使用统一的 `radix-ui` 包。两种导入方式可以在同一项目中共存，不会产生冲突。

## Open Questions

1. **LucideIcon 的 displayName 可靠性**
   - What we know: Lucide React 图标组件通常有 `displayName` 属性（如 `"Package"`）
   - What's unclear: 是否所有 lucide-react 图标都有可靠的 displayName
   - Recommendation: 在 presets.ts 中硬编码图标名称字符串，不依赖 displayName。这是最安全的方案

2. **项目删除时清理 Store 数据的时机**
   - What we know: 需要在 removeProject 中增加 `store.delete(projectCommandsKey(id))`
   - What's unclear: 是否还有其他 Store key 需要清理
   - Recommendation: 在实现 removeProject 扩展时，使用 `store.keys()` 检查所有以 `projectCommands:` 开头的 key，确保完整性

## Environment Availability

Step 2.6: SKIPPED — Phase 4 是纯前端代码变更，无需外部工具或服务。所有依赖（tauri-plugin-store、lucide-react、shadcn/ui 组件）均为前端 npm 包或已安装的 Tauri 插件。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-05 | 添加自定义全局指令（弹窗表单提交 → Store 写入 → 卡片显示） | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx -t "添加"` | Wave 0 |
| CMD-05 | 编辑模式切换 + 添加占位卡片显示 | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx -t "编辑模式"` | 需扩展 |
| CMD-06 | 删除自定义指令（编辑模式 X 按钮 + 右键菜单） | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx -t "删除"` | 需扩展 |
| CMD-06 | 编辑自定义指令（弹窗预填数据 + 保存更新） | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx -t "编辑"` | Wave 0 |
| CMD-07 | 项目级指令集完全替换全局指令 | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx -t "项目级"` | Wave 0 |
| CMD-07 | 模式标签显示（全局/项目自定义） | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx -t "模式标签"` | 需扩展 |
| DATA-02 | 自定义指令 Store 持久化 | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx -t "持久化"` | Wave 0 |
| UI-07 | 模态弹窗打开/关闭/表单验证 | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/CommandDialog.test.tsx` — covers CMD-05, CMD-06, UI-07 弹窗交互
- [ ] `src/hooks/__tests__/useProject.test.tsx` — covers CMD-07 项目级覆盖, DATA-02 持久化
- [ ] `src/components/__tests__/MainArea.test.tsx` — 需扩展编辑模式、模式标签测试
- [ ] `src/components/__tests__/CommandCard.test.tsx` — 需扩展右键菜单、自定义标记测试

### Testing Notes for Mock Strategy
- Store 相关测试需要 mock `@tauri-apps/plugin-store` 的 `load` 函数
- Dialog/ContextMenu 组件需要 `@testing-library/react` 的 `render` + `screen` + `fireEvent`
- ContextMenu 的右键操作使用 `fireEvent.contextMenu`，而非 `fireEvent.click`
- 注意：现有测试模式使用 `vi.useFakeTimers()` + `act()` 处理异步状态，新测试应延续此模式

## Sources

### Primary (HIGH confidence)
- 项目源码 `src/hooks/useProject.ts` — Store 持久化模式（load/set/get + autoSave 100ms）
- 项目源码 `src/components/CommandCard.tsx` — 卡片组件结构、交互状态
- 项目源码 `src/components/MainArea.tsx` — 网格布局、项目信息区域
- 项目源码 `node_modules/@tauri-apps/plugin-store/dist-js/index.d.ts` — Store API 完整类型定义
- shadcn/ui Dialog 官方文档 (https://ui.shadcn.com/docs/components/dialog) — API 用法、Dialog+ContextMenu 嵌套规则
- shadcn/ui ContextMenu 官方文档 (https://ui.shadcn.com/docs/components/context-menu) — API 用法
- `.planning/phases/04-custom-commands/04-CONTEXT.md` — 22 项锁定决策

### Secondary (MEDIUM confidence)
- `.planning/phases/01-shell/01-UI-SPEC.md` — UI 设计规范（颜色、间距、动效）
- `.planning/phases/02-sidebar-persistence/02-CONTEXT.md` — Store 持久化决策背景
- `.planning/phases/03-command-cards/03-CONTEXT.md` — 卡片交互决策背景

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有库已在项目中安装使用，新组件（Dialog/ContextMenu/Input/Label）是 shadcn/ui 标准组件
- Architecture: HIGH — 沿用已建立的 useProject hook + Store 持久化模式，扩展而非重构
- Pitfalls: HIGH — 基于 shadcn/ui 官方文档和已有代码分析，陷阱识别充分
- Data design: HIGH — Store API 已验证（get/set/delete/keys 完整 CRUD），schema 简单明确

**Research date:** 2026-04-13
**Valid until:** 2026-05-13（稳定技术栈，30 天有效）
