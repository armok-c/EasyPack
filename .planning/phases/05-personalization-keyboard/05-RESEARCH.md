# Phase 5: 项目个性化与键盘增强 - Research

**Researched:** 2026-04-14
**Domain:** React 拖拽排序、键盘导航、焦点管理、UI 个性化
**Confidence:** HIGH

## Summary

Phase 5 需要在现有 Tauri 2 + React 19 应用上实现三大功能：(1) 项目图标与颜色标记、(2) 侧边栏拖拽排序、(3) 双区域键盘导航。经过深入调研，拖拽库方面 dnd-kit 生态正处于新旧交替期 -- legacy `@dnd-kit/core` v6.3.1 已标记为 Legacy，新版 `@dnd-kit/react` v0.4.0 于 2026-04-13 刚发布（仍为 beta），但已正式声明 React 19 peerDependency 支持。对于本项目仅需要垂直列表拖拽排序的简单场景，推荐使用新版 `@dnd-kit/react`，因为它的 API 更简洁且原生支持 React 19。键盘导航方面采用自实现的焦点管理方案（roving tabindex 模式），不引入额外依赖。图标/颜色标记功能基于现有 `icons.ts` 和 `CommandDialog.tsx` 的模式扩展。

**Primary recommendation:** 使用 `@dnd-kit/react` 0.4.x（新版 API，支持 React 19）实现拖拽排序，自实现 roving tabindex + 全局 keydown 监听实现键盘导航，扩展现有 ProjectItem 接口和数据存储模式实现图标颜色标记。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 项目图标复用 lucide-react 预设图标体系（icons.ts 已有的 10 个图标：Terminal, Code, Server, Zap, GitBranch, Package, Globe, Wrench, Rocket, Play）
- **D-02:** 颜色标记以左侧彩色边框展示（3px 宽彩色竖条），叠加在现有 border 上
- **D-03:** 图标位于项目名称文字左侧（与文字同一行），紧凑不增加行高
- **D-04:** 右键菜单极简化——仅包含"设置图标和颜色"一个选项
- **D-05:** 颜色选项为 8 色预设盘（红、橙、黄、绿、蓝、紫、粉、青）
- **D-06:** 设置弹窗布局：上半部分 10 个图标网格 + 下半部分 8 色预设盘 + 预览区 + 保存/取消
- **D-07:** 拖拽方式为拖拽手柄（非整行拖拽），手柄图标 GripVertical
- **D-08:** 拖拽排序范围仅限侧边栏项目列表
- **D-09:** 拖拽手柄悬停时显示（opacity-0 group-hover:opacity-100），与 X 删除按钮行为一致
- **D-10:** 排序持久化：直接改变 store 中 projects 数组元素顺序，不新增字段
- **D-11:** 拖拽完成后立即保存到 store（onDragEnd 事件触发持久化）
- **D-12:** 键盘导航覆盖侧边栏 + 卡片双区域
- **D-13:** 数字键 1-9 直接触发对应位置的指令卡片
- **D-14:** 焦点指示复用现有 focus-visible:ring-2 样式
- **D-15:** 双区域 Tab 切换模型。Tab 在侧边栏和卡片区域间切换焦点
- **D-16:** 应用启动后焦点默认在侧边栏

### Claude's Discretion
- 拖拽库选择（推荐 @dnd-kit，React 生态标准选择）
- 8 色预设盘的具体色值选择
- 拖拽动效和占位符样式
- 卡片网格中方向键的移动方向
- 侧边栏无项目时的键盘行为
- 项目设置弹窗的具体布局细节
- ProjectItem 接口扩展（新增 icon?: string 和 color?: string 可选字段）
- 初始焦点的具体实现方式
- 编辑模式下数字键是否仍然触发指令
- 卡片焦点切换时是否自动滚动到可视区域

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-05 | 用户可为项目设置图标和颜色标记，在侧边栏中展示 | 扩展 ProjectItem 接口（icon?, color?），复用 ICON_OPTIONS + 8 色预设盘，ContextMenu 右键触发 Dialog 弹窗 |
| PROJ-06 | 用户可拖拽调整项目在侧边栏中的排序 | @dnd-kit/react DragDropProvider + useSortable，拖拽手柄 GripVertical，onDragEnd 更新 store 数组顺序 |
| UI-03 | 键盘导航支持（上下切换项目、Enter 选中、快捷键触发指令） | 自实现 roving tabindex + 全局 keydown 监听，数字键 1-9 映射指令卡片，Tab 双区域切换 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/react | 0.4.x | 拖拽排序 | dnd-kit 官方新版，原生 React 19 支持，API 比 legacy 更简洁。单包替代旧 @dnd-kit/core + @dnd-kit/sortable |

### Already Installed (No New Install Needed)
| Library | Version | Purpose | Phase 5 Usage |
|---------|---------|---------|---------------|
| lucide-react | 1.8.0 | 图标 | GripVertical（拖拽手柄）、Palette（设置菜单图标），已有 10 个 ICON_OPTIONS 复用 |
| radix-ui (ContextMenu) | 1.4.3 | 右键菜单 | 已安装 context-menu.tsx，用于项目右键"设置图标和颜色" |
| @radix-ui/react-dialog | via shadcn | 弹窗 | 已安装 dialog.tsx，用于图标颜色设置弹窗 |
| tailwindcss | 4.2.2 | 样式 | 彩色边框、焦点 ring、拖拽占位符等样式 |
| vitest | 4.1.4 | 测试 | 键盘事件模拟、拖拽逻辑测试 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/react 0.4.x | @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0 | Legacy 版已标记为 Legacy，不支持 React 19 peerDep，需要 --legacy-peer-deps workaround。新版 API 更简洁（单包），但 0.x 仍有 beta 风险。对仅垂直列表排序场景，新版完全够用 |
| @dnd-kit/react | @atlaskit/pragmatic-drag-and-drop | Atlassian 方案成熟但体积大、引入 Atlassian 生态依赖。本项目只需简单垂直排序，不需要跨框架支持 |
| 自实现键盘导航 | react-hotkeys / hotkeys-js | 引入额外依赖但无必要。本项目键盘逻辑简单（方向键 + 数字键 + Tab），useEffect + keydown 监听即可 |

**Installation:**
```bash
npm install @dnd-kit/react
```

**Version verification:**
```
@dnd-kit/react: 0.4.0 (published 2026-04-13)
peerDependencies: react ^18.0.0 || ^19.0.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── Sidebar.tsx          # 改动：拖拽、右键菜单、图标颜色显示、键盘导航
│   ├── CommandCard.tsx       # 改动：键盘焦点支持、tabindex 管理
│   ├── MainArea.tsx          # 改动：键盘导航事件处理、焦点区域管理
│   ├── ProjectSettingsDialog.tsx  # 新增：图标颜色设置弹窗
│   └── ui/
│       ├── context-menu.tsx  # 已有，用于右键菜单
│       └── dialog.tsx        # 已有，用于设置弹窗
├── hooks/
│   ├── useProject.ts         # 改动：扩展 ProjectItem、reorderProject、updateProjectStyle
│   └── useKeyboard.ts        # 新增：键盘导航逻辑 hook
├── lib/
│   ├── icons.ts              # 已有，复用 ICON_OPTIONS
│   ├── colors.ts             # 新增：8 色预设盘定义
│   └── types.ts              # 可能需扩展
└── App.tsx                   # 改动：传递新 props、全局键盘事件
```

### Pattern 1: @dnd-kit/react 垂直列表拖拽排序
**What:** 使用新版 @dnd-kit/react 的 DragDropProvider + useSortable 实现垂直列表拖拽
**When to use:** 侧边栏项目排序
**Example:**
```typescript
// 来源: dndkit.com/react/guides/sortable-state-management
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable, isSortable } from '@dnd-kit/react/sortable';

function SortableProjectItem({ id, index, children }) {
  const { ref, handleRef } = useSortable({ id, index });
  return (
    <div ref={ref}>
      <div ref={handleRef}>
        <GripVertical className="size-3" />
      </div>
      {children}
    </div>
  );
}

// App-level handler
function handleDragEnd(event) {
  if (event.canceled) return;
  const { source } = event.operation;
  if (isSortable(source)) {
    const { initialIndex, index } = source;
    if (initialIndex !== index) {
      const newItems = [...items];
      const [removed] = newItems.splice(initialIndex, 1);
      newItems.splice(index, 0, removed);
      setItems(newItems);
    }
  }
}
```

### Pattern 2: Roving Tabindex 双区域焦点管理
**What:** 侧边栏和主区域各自维护焦点位置，Tab 在区域间切换
**When to use:** 键盘导航焦点管理
**Example:**
```typescript
// 侧边栏 roving tabindex: 只有一个项目有 tabindex="0"，其余 tabindex="-1"
// 方向键移动焦点时更新 tabindex

function useRovingFocus(containerRef, itemIds, orientation = 'vertical') {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

    if (e.key === nextKey) {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, itemIds.length - 1);
      setActiveIndex(next);
      // Focus the element
      containerRef.current?.children[next]?.focus();
    } else if (e.key === prevKey) {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      containerRef.current?.children[prev]?.focus();
    }
  };

  return { activeIndex, handleKeyDown };
}
```

### Pattern 3: 全局数字键快捷触发
**What:** 在 App 层 useEffect 监听 keydown，数字键 1-9 映射到指令卡片
**When to use:** 快捷键触发指令执行
**Example:**
```typescript
// App.tsx or MainArea.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 不在输入框/弹窗中时才响应
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (dialogOpen) return; // 弹窗打开时不触发

    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && num <= commands.length) {
      const cmd = commands[num - 1];
      if (cmd && currentProject) {
        onExecute(cmd.command);
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [commands, currentProject, onExecute, dialogOpen]);
```

### Anti-Patterns to Avoid
- **不要用第三方快捷键库处理数字键**: 项目逻辑简单，useEffect + keydown 足够，react-hotkeys 引入不必要依赖
- **不要让所有项目行都 draggable**: D-07 明确要求拖拽手柄触发，不是整行拖拽。handleRef 只绑定到 GripVertical 图标上
- **不要新增 sortIndex 字段**: D-10 明确要求数组顺序即排序，直接 splice 重排
- **不要在编辑模式外监听数字键**: 编辑模式下用户可能在输入框中输入数字，必须检查 event.target 类型
- **不要忽略 Tauri WebView 的键盘事件传播**: Tauri WebView 使用系统 WebView2，keydown 事件行为与浏览器一致，无需特殊处理

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 拖拽排序 | 自实现 mousedown/mousemove 拖拽 | @dnd-kit/react | 触摸事件、无障碍访问、碰撞检测、动画过渡等边界情况极多 |
| 焦点环样式 | 自定义 focus CSS | 复用现有 focus-visible:ring-2 | 已在 button.tsx 中定义，全局一致 |
| 图标组件 | 自建图标映射 | 复用 icons.ts 的 ICON_OPTIONS + getIconByName | 已验证的模式，10 个图标已覆盖需求 |
| 弹窗模式 | 自建弹窗 | shadcn Dialog + 复用 CommandDialog 模式 | 已有成熟模式（表单 + 预览 + 验证 + 保存/取消） |

**Key insight:** 本阶段大量复用前序阶段的模式（icons.ts 的图标选择、CommandDialog 的弹窗模式、Sidebar 的 group-hover 显示模式）。新代码主要是 @dnd-kit/react 集成和键盘事件处理。

## Common Pitfalls

### Pitfall 1: @dnd-kit/react Beta API 不稳定
**What goes wrong:** 0.4.0 刚于 2026-04-13 发布，API 可能在后续版本变更
**Why it happens:** dnd-kit 新版尚未发布 1.0 稳定版
**How to avoid:** 锁定版本号（不使用 ^ 前缀），使用 `"@dnd-kit/react": "0.4.0"` 精确版本。本项目拖拽场景极简（单列垂直排序），受 API 变更影响小
**Warning signs:** 安装后 TypeScript 类型错误，或 import 路径不匹配

### Pitfall 2: 数字键与输入框冲突
**What goes wrong:** 用户在弹窗的输入框中输入数字时，触发了指令卡片执行
**Why it happens:** 全局 keydown 监听未检查 event.target
**How to avoid:** 检查 `e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement`，检查弹窗是否打开，检查是否在编辑模式
**Warning signs:** 弹窗中按数字键终端窗口弹出

### Pitfall 3: 拖拽手柄与右键菜单冲突
**What goes wrong:** 右键项目行时弹出 ContextMenu，但同时触发了拖拽
**Why it happens:** mousedown 事件同时被 ContextMenu 和 DragDropProvider 捕获
**How to avoid:** 拖拽仅在 GripVertical 手柄上触发（handleRef 绑定在手柄元素），ContextMenu 绑定在项目行容器。两个交互元素不同，不会冲突
**Warning signs:** 右键时出现拖拽拖影

### Pitfall 4: 拖拽排序后焦点丢失
**What goes wrong:** 拖拽完成后，焦点不在预期的项目上
**Why it happens:** DOM 重排导致焦点元素变化
**How to avoid:** onDragEnd 回调中，拖拽完成后将焦点移到被拖拽项目的新位置（通过 ref 或 querySelector）
**Warning signs:** 拖拽后 Tab 键行为异常

### Pitfall 5: 彩色左边框与现有 border 样式冲突
**What goes wrong:** D-02 要求"左 border 用颜色，其他三边保持 white/10"，但 Tailwind 的 border-l 和 border 不能在同一元素上独立控制颜色
**Why it happens:** Tailwind CSS v4 的 border-color 级联行为
**How to avoid:** 使用伪元素（`before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[color] before:rounded-l-lg`）实现左侧彩色条，不修改 border 属性。或者使用 Tailwind 的 `border-l-[color]` + `border-t-white/10 border-r-white/10 border-b-white/10` 分开设置
**Warning signs:** 彩色边框加粗了所有边框，或边框重叠效果异常

### Pitfall 6: 键盘导航时编辑模式的特殊处理
**What goes wrong:** 编辑模式下数字键仍然触发指令执行，导致意外行为
**Why it happens:** 全局 keydown 监听未检查编辑模式状态
**How to avoid:** 键盘事件处理中增加 `if (editMode) return` 检查。编辑模式下数字键不触发指令
**Warning signs:** 编辑模式中按数字键弹出终端窗口

## Code Examples

### ProjectItem 接口扩展
```typescript
// src/hooks/useProject.ts
export interface ProjectItem {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  icon?: string;    // Phase 5: lucide icon name, defaults to 'Terminal'
  color?: string;   // Phase 5: CSS color value, e.g. '#ef4444'
}
```

### 8 色预设盘定义
```typescript
// src/lib/colors.ts
export const COLOR_OPTIONS = [
  { name: '红', value: '#ef4444' },   // red-500
  { name: '橙', value: '#f97316' },   // orange-500
  { name: '黄', value: '#eab308' },   // yellow-500
  { name: '绿', value: '#22c55e' },   // green-500
  { name: '蓝', value: '#3b82f6' },   // blue-500
  { name: '紫', value: '#a855f7' },   // purple-500
  { name: '粉', value: '#ec4899' },   // pink-500
  { name: '青', value: '#06b6d4' },   // cyan-500
] as const;

export const DEFAULT_COLOR = '';  // 空字符串表示无颜色标记
```

### 彩色左边框实现
```tsx
// Sidebar.tsx 项目行中的彩色边框
<div
  className={cn(
    "group relative flex items-center px-2 py-2 rounded-lg border cursor-pointer",
    "transition-all duration-150",
    // 彩色左边框：用 before 伪元素叠加，不修改 border 属性
    project.color && "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-l-lg before:transition-colors before:duration-150",
    selectedId === project.id
      ? "bg-white/10 border-white/20"
      : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
  )}
  style={project.color ? { '--tw-before-bg': project.color } as React.CSSProperties : undefined}
>
```

### @dnd-kit/react 单列排序完整模式
```tsx
// 来源: dndkit.com/react/guides/sortable-state-management
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable, isSortable } from '@dnd-kit/react/sortable';

function Sidebar({ projects, onReorder }) {
  const handleDragEnd = useCallback((event) => {
    if (event.canceled) return;
    const { source } = event.operation;
    if (isSortable(source)) {
      const { initialIndex, index } = source;
      if (initialIndex !== index) {
        const newProjects = [...projects];
        const [moved] = newProjects.splice(initialIndex, 1);
        newProjects.splice(index, 0, moved);
        onReorder(newProjects);
      }
    }
  }, [projects, onReorder]);

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div>
        {projects.map((project, index) => (
          <SortableItem key={project.id} id={project.id} index={index}>
            {/* 项目内容 */}
          </SortableItem>
        ))}
      </div>
    </DragDropProvider>
  );
}

function SortableItem({ id, index, children }) {
  const { ref, handleRef, isDragging } = useSortable({ id, index });
  return (
    <div ref={ref} className={isDragging ? 'opacity-50' : ''}>
      {/* 拖拽手柄 */}
      <div ref={handleRef} className="opacity-0 group-hover:opacity-100 cursor-grab">
        <GripVertical className="size-3 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}
```

### 键盘事件处理 Hook 模式
```typescript
// src/hooks/useKeyboard.ts
import { useEffect, useCallback } from 'react';

interface UseKeyboardOptions {
  commands: CommandItem[];
  currentProject: ProjectItem | null;
  onExecute: (command: string) => void;
  editMode: boolean;
  dialogOpen: boolean;
}

export function useKeyboard({
  commands, currentProject, onExecute, editMode, dialogOpen
}: UseKeyboardOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 忽略输入框中的按键
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // 编辑模式或弹窗打开时不触发快捷键
    if (editMode || dialogOpen) return;

    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && num <= commands.length) {
      const cmd = commands[num - 1];
      if (cmd && currentProject) {
        e.preventDefault();
        onExecute(cmd.command);
      }
    }
  }, [commands, currentProject, onExecute, editMode, dialogOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @dnd-kit/core + @dnd-kit/sortable | @dnd-kit/react (单包) | 2025-2026 | 新版 API 更简洁（ref + handleRef 代替 attributes + listeners），原生 React 19 支持 |
| 旧 useSortable: setActivatorNodeRef + listeners | 新 useSortable: handleRef 回调 | 2025 | 更简单的拖拽手柄绑定，不再需要 spread listeners |
| 旧 DndContext | 新 DragDropProvider | 2025 | 组件名变更，API 更清晰 |

**Deprecated/outdated:**
- `@dnd-kit/core`: 已被官方标记为 Legacy，推荐迁移到 @dnd-kit/react
- `@dnd-kit/sortable`: 功能合并到 @dnd-kit/react/sortable

## Open Questions

1. **@dnd-kit/react 0.4.0 beta 稳定性**
   - What we know: 0.4.0 于 2026-04-13 发布，声明支持 React 19，API 文档已就位
   - What's unclear: 0.4.0 是否有未发现的 bug，特别是边缘交互场景
   - Recommendation: 锁定精确版本 0.4.0，本项目拖拽场景极简（单列垂直排序），风险可控。如遇问题可降级到 legacy @dnd-kit/core + --legacy-peer-deps

2. **彩色左边框的最佳实现方式**
   - What we know: D-02 要求 3px 左侧彩色条叠加在 border 上
   - What's unclear: Tailwind CSS v4 中 border-l-color 与 border-color 的级联行为是否允许独立控制
   - Recommendation: 优先尝试 `border-l-[color]` + 其他三边保持 white/10；如果不生效，回退到 before 伪元素方案

3. **卡片网格方向键导航的行进方向**
   - What we know: D-12 要求卡片区域用方向键移动焦点，卡片是 auto-fill 网格
   - What's unclear: 网格列数是动态的（auto-fill），方向键应该按视觉位置（上下左右）还是按 DOM 顺序移动
   - Recommendation: 上下左右都支持，按 DOM 顺序计算移动目标（左右移动 +/-1，上下移动 +/-列数），列数通过 getComputedStyle 获取 grid-template-columns 数量

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 构建/测试 | Yes | 22.22.0 | -- |
| npm | 包管理 | Yes | 10.9.4 | -- |
| vitest | 测试框架 | Yes | 4.1.4 | -- |
| @dnd-kit/react | 拖拽排序 | Needs install | 0.4.0 | -- |
| @testing-library/react | 组件测试 | Yes | 16.3.2 | -- |
| jsdom | 测试环境 | Yes | 29.0.2 | -- |

**Missing dependencies with no fallback:**
- `@dnd-kit/react`: 需要安装，npm install @dnd-kit/react

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-05 | 项目可设置图标，设置后在侧边栏显示 | unit | `npx vitest run src/components/__tests__/Sidebar.test.tsx` | No -- Wave 0 |
| PROJ-05 | 项目可设置颜色标记，左侧显示彩色边框 | unit | `npx vitest run src/components/__tests__/Sidebar.test.tsx` | No -- Wave 0 |
| PROJ-05 | 右键菜单显示"设置图标和颜色"选项 | unit | `npx vitest run src/components/__tests__/Sidebar.test.tsx` | No -- Wave 0 |
| PROJ-05 | 设置弹窗显示图标网格和颜色预设盘 | unit | `npx vitest run src/components/__tests__/ProjectSettingsDialog.test.tsx` | No -- Wave 0 |
| PROJ-06 | 拖拽手柄悬停时显示 | unit | `npx vitest run src/components/__tests__/Sidebar.test.tsx` | No -- Wave 0 |
| PROJ-06 | 拖拽排序后数组顺序更新 | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx` | Yes (需扩展) |
| UI-03 | 上下箭头切换侧边栏项目焦点 | unit | `npx vitest run src/components/__tests__/Sidebar.test.tsx` | No -- Wave 0 |
| UI-03 | Enter 选中项目 | unit | `npx vitest run src/components/__tests__/Sidebar.test.tsx` | No -- Wave 0 |
| UI-03 | 数字键 1-9 触发对应指令卡片 | unit | `npx vitest run src/hooks/__tests__/useKeyboard.test.ts` | No -- Wave 0 |
| UI-03 | Tab 在侧边栏和主区域间切换焦点 | unit | `npx vitest run src/components/__tests__/App.test.tsx` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `src/components/__tests__/Sidebar.test.tsx` -- covers PROJ-05 右键菜单/图标颜色显示、PROJ-06 拖拽手柄、UI-03 侧边栏键盘导航
- [ ] `src/components/__tests__/ProjectSettingsDialog.test.tsx` -- covers PROJ-05 弹窗图标/颜色选择
- [ ] `src/hooks/__tests__/useKeyboard.test.ts` -- covers UI-03 数字键快捷触发
- [ ] `src/hooks/__tests__/useProject.test.tsx` -- 需扩展 reorderProject/updateProjectStyle 测试

## Sources

### Primary (HIGH confidence)
- [dndkit.com/react/quickstart](https://dndkit.com/react/quickstart) -- @dnd-kit/react 快速入门，API 用法
- [dndkit.com/react/hooks/use-sortable](https://dndkit.com/react/hooks/use-sortable) -- useSortable hook 完整 API 参考（ref, handleRef, isDragging 等）
- [dndkit.com/react/guides/sortable-state-management](https://dndkit.com/react/guides/sortable-state-management) -- 排序状态管理，isSortable type guard，onDragEnd 处理模式
- npm registry @dnd-kit/react 0.4.0 -- 版本号、peerDependencies（react ^18.0.0 || ^19.0.0）
- 项目现有源码（icons.ts, Sidebar.tsx, CommandCard.tsx, MainArea.tsx, useProject.ts, CommandDialog.tsx）

### Secondary (MEDIUM confidence)
- [dndkit.com/react/guides/migration](https://dndkit.com/react/guides/migration) -- 从 legacy @dnd-kit/core 迁移指南
- [GitHub clauderic/dnd-kit #1842](https://github.com/clauderic/dnd-kit/discussions/1842) -- 新旧版本路线图讨论
- [Devtrium - How to add keyboard shortcuts](https://devtrium.com/posts/how-keyboard-shortcut) -- useEffect + addEventListener('keydown') 模式
- [web.dev - Control focus with tabindex](https://web.dev/articles/control-focus-with-tabindex) -- roving tabindex 原理

### Tertiary (LOW confidence)
- [Medium - Building a sidebar with React DnD Kit](https://medium.com/@math-krish/building-a-sidebar-with-react-dnd-kit-fac8171466a1) -- 社区实践参考

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @dnd-kit/react 版本和 API 已通过官方文档和 npm registry 确认
- Architecture: HIGH -- 基于现有代码模式扩展，复用前序阶段的成熟模式
- Pitfalls: HIGH -- 基于实际代码分析和 WebSearch 社区报告

**Research date:** 2026-04-14
**Valid until:** 2026-05-14（@dnd-kit/react 仍在 0.x 快速迭代，30 天后应重新确认版本）
