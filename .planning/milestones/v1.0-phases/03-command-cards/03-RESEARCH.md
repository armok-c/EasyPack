# Phase 3: 指令卡片与核心交互 - Research

**Researched:** 2026-04-13
**Domain:** React 交互组件 + CSS Grid 响应式 + CSS 动画（Tailwind CSS v4 生态）
**Confidence:** HIGH

## Summary

Phase 3 的核心工作是在现有骨架代码基础上完成指令卡片交互的"最后一公里"：将固定 2 列网格升级为自适应多列布局、为卡片点击添加执行反馈动效、确保未选中项目时的禁用体验符合需求。现有代码资产（CommandCard、MainArea、presets、useProject）已经建立了良好的基础模式——Raycast 风格透明度配色、CSS transition 动效、Toast 反馈——Phase 3 只需在此基础上增强，无需引入新依赖或大规模重构。

**Primary recommendation:** 利用 CSS Grid `auto-fill` + `minmax()` 实现纯 CSS 自适应网格，使用 Tailwind v4 的 `@theme` + `@keyframes` 自定义执行反馈动画，全部改动限于 CommandCard.tsx 和 MainArea.tsx 两个文件。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 未选中项目时保持空状态引导页（FolderOpen 图标 + "选择一个项目开始" + 提示文字），不改为灰显卡片布局
- **D-02:** 空状态引导页本身就是"禁用"状态的表现形式——用户看不到可点击的指令卡片，引导文字明确提示需要先选项目。满足 CMD-08 核心意图
- **D-03:** 保持图标 + 名称的紧凑布局，不显示命令文本（如 "npm run build"）。卡片简洁统一
- **D-04:** 卡片尺寸和样式保持当前 UI-SPEC 定义：`p-4 rounded-xl bg-white/5 border-white/10`
- **D-05:** 点击卡片执行命令后，卡片有快速视觉反馈（闪光/回弹/边框高亮），然后恢复正常状态
- **D-06:** 执行中卡片有短暂的动效反馈（如旋转图标/脉冲边框/闪光），与 toast 通知配合使用
- **D-07:** 具体动效实现方式由 Claude 决定，保持与 Raycast 视觉风格一致
- **D-08:** 指令卡片采用自适应列数网格。窗口变宽时自动增加列数，卡片保持固定最大宽度
- **D-09:** 最小窗口宽度（600px）时至少显示 2 列，确保基本布局不被破坏
- **D-10:** 具体的断点和卡片最大宽度由 Claude 决定

### Claude's Discretion
- 执行反馈动效的具体实现（CSS transition / keyframe / 其他方案）
- 卡片最大宽度和自适应断点
- 是否需要 Tooltip 补充信息（如悬停显示命令文本）
- 项目信息区域的展示方式（当前"当前项目: {name}" + 路径是否需要调整）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMD-01 | 内置全局默认指令卡片：打包项目、启动项目、启动 Claude、Git Pull | presets.ts 已定义 PRESET_COMMANDS 数组，4 个预设命令已就绪，无需新增数据 |
| CMD-02 | 指令以卡片网格形式排列在右侧主区域，紧凑美观 | CSS Grid `auto-fill` + `minmax()` 方案可实现纯 CSS 自适应网格，见"Architecture Patterns" |
| CMD-03 | 必须先选中左侧项目，右侧指令卡片才可点击执行 | useProject hook 已提供 currentProject 派生状态；D-01/D-02 决定未选中时显示空状态引导页 |
| CMD-08 | 未选中项目时指令卡片显示为禁用/灰显状态，给出提示 | D-01/D-02 已锁定空状态方案，当前 MainArea 未选中时不渲染卡片，满足需求 |
| UI-01 | 现代圆角矩形卡片设计，整体视觉美观紧凑 | CommandCard 已实现 UI-SPEC 定义的样式，Phase 3 保持一致 |
| UI-05 | 所有交互元素有 hover/active/selected 状态的微动效反馈 | CommandCard 已有 hover/active transition；需新增执行反馈动效（D-05/D-06），见"Architecture Patterns - 执行反馈动效" |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | UI 框架 | 项目已安装，Phase 3 无需变更 |
| Tailwind CSS | 4.2.2 | 原子化 CSS | 项目已安装，Phase 3 利用 `@theme` 自定义动画 |
| tw-animate-css | 1.4.0 | Tailwind v4 动画工具库 | 项目已安装，提供 `animate-in`/`animate-out` 进出动画基础 |
| lucide-react | 1.8.0 | 图标库 | 项目已安装，预设命令图标已定义 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.7 | Toast 通知 | 执行命令后的反馈提示，已集成 |
| clsx | 2.1.1 | 条件 className | 已用于 CommandCard 的动态样式 |
| tailwind-merge | 3.5.0 | 类名冲突合并 | 已用于 cn() 工具函数 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS @keyframes + @theme | Framer Motion | Framer Motion 功能强大但引入新依赖（~30KB），本项目只需简单闪动反馈，纯 CSS 方案足够 [ASSUMED] |
| Tailwind arbitrary value `grid-cols-[...]` | CSS `@theme` 自定义网格变量 | arbitrary value 内联语法可读性差；如需复用可提升到 @theme 变量 |

**Installation:**
Phase 3 不需要安装任何新依赖。所有工具已在项目中。

**Version verification:**
```
tailwindcss: 4.2.2 (npm verified)
tw-animate-css: 1.4.0 (npm verified)
react: 19.2.5 (npm verified)
lucide-react: 1.8.0 (npm verified)
vite: 8.0.8 (npm registry, project uses 6.4.2 via devDep)
@tailwindcss/vite: 4.2.2 (npm verified)
```

## Architecture Patterns

### Recommended Project Structure
Phase 3 不改变项目结构，仅修改两个文件：
```
src/
├── components/
│   ├── CommandCard.tsx    # [MODIFY] 新增执行反馈动效
│   ├── MainArea.tsx       # [MODIFY] 网格从固定 2 列改为自适应
│   └── Sidebar.tsx        # [UNCHANGED]
├── hooks/
│   └── useProject.ts      # [UNCHANGED]
├── lib/
│   └── presets.ts         # [UNCHANGED]
└── index.css              # [MODIFY] 新增 @theme 自定义动画 keyframes
```

### Pattern 1: CSS Grid auto-fill 自适应网格

**What:** 使用 CSS Grid 的 `repeat(auto-fill, minmax())` 实现无需媒体查询的自适应列数网格。
**When to use:** 任何需要卡片网格自适应容器宽度的场景。

**Example:**
```tsx
// MainArea.tsx — 替换当前的 grid-cols-2
<div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
  {PRESET_COMMANDS.map((cmd) => (
    <CommandCard ... />
  ))}
</div>
```

**关键参数计算：**
- 主区域最小宽度 = 窗口最小 600px - 侧边栏 240px - 主区域内边距 64px(p-8) = **296px**
- 296px / 2列 = 每列 148px，减去 12px gap = **~142px 最小卡片宽度**
- 设 `minmax(140px, 1fr)` 保证最小窗口时 2 列，标准窗口(720px)时约 3 列
- `auto-fill`（而非 `auto-fit`）：保留空列占位，布局更稳定 [VERIFIED: Tailwind CSS docs + CSS Grid spec]

**Tailwind v4 语法注意：**
- arbitrary value 中空格必须用下划线 `_` 替换
- 完整写法：`grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))]`
- [VERIFIED: Tailwind CSS v4 grid-template-columns docs]

### Pattern 2: 执行反馈动效（CSS @keyframes + React 状态驱动）

**What:** 点击卡片后触发一次性闪动动画，通过 React 状态切换 CSS class 实现。
**When to use:** 需要短促的一次性反馈动画（非持续性动画）。

**推荐方案：边框闪光 + 微弹缩放**

```css
/* index.css — 在 @theme inline 块中添加 */
@theme inline {
  /* ... existing variables ... */
  --animate-card-flash: card-flash 400ms ease-out;
}

@keyframes card-flash {
  0% {
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.1);
    transform: scale(0.97);
  }
  50% {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
  }
  100% {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: none;
    transform: scale(1);
  }
}
```

```tsx
// CommandCard.tsx — 状态驱动的动画触发
interface CommandCardProps {
  name: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
}

export function CommandCard({ name, icon: Icon, disabled = false, onClick }: CommandCardProps) {
  const [flashing, setFlashing] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setFlashing(true);
    onClick?.();
    // 动画持续 400ms 后清除
    setTimeout(() => setFlashing(false), 400);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
        "bg-white/5 border border-white/10",
        "cursor-pointer select-none",
        "text-xs text-card-foreground",
        "transition-all duration-150 ease-out",
        // 执行闪光动效
        flashing && "animate-card-flash",
        // hover/active 状态（非执行中才生效）
        !disabled && !flashing && [
          "hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]",
          "active:bg-white/15 active:scale-[0.98] active:duration-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        ],
        disabled && "opacity-40 cursor-not-allowed"
      )}
      aria-label={name}
    >
      <Icon className={cn("size-6", flashing && "animate-spin")} />
      <span>{name}</span>
    </button>
  );
}
```

**设计考量：**
- 动画使用 `@theme` + `@keyframes` 定义，符合 Tailwind v4 CSS-first 原则 [VERIFIED: Tailwind CSS animation docs]
- 400ms 持续时间足够感知但不拖沓，与 UI-SPEC 的 150ms hover / 100ms active 形成递进层次
- `animate-spin` 用于图标旋转，是 Tailwind 内置动画，零额外代码 [VERIFIED: Tailwind CSS docs]
- `setTimeout` 400ms 清除状态，避免动画 class 残留

### Pattern 3: Tooltip 补充信息（Claude's Discretion — 可选增强）

**What:** 鼠标悬停卡片时，以轻量 Tooltip 显示实际 Shell 命令。
**When to use:** 当卡片只显示名称不显示命令时，帮助用户确认将要执行的命令。

**实现方案：** 使用 HTML 原生 `title` 属性（最简单方案），或 shadcn/ui Tooltip 组件（更美观）。

```tsx
// 简单方案 — title 属性（零额外代码）
<button title={disabled ? undefined : command} ...>

// 美观方案 — shadcn/ui Tooltip
// 需要安装: npx shadcn@latest add tooltip
```

**建议：** Phase 3 使用简单 `title` 方案。Tooltip 组件可在后续 Phase 按需引入。

### Anti-Patterns to Avoid

- **JS 动画库（Framer Motion / react-spring）用于简单闪动：** 引入 30KB+ 依赖只做一次 400ms 闪光，过度设计。CSS @keyframes 完全胜任 [ASSUMED]
- **animationend 事件替代 setTimeout：** `animationend` 事件在动画被取消（如快速连点）时可能不触发，导致状态卡死。setTimeout 更可靠
- **CSS transition 模拟一次性动画：** transition 需要状态 A -> B -> A 的往返切换，不如 @keyframes 直观且容易出 bug（中间态闪烁）
- **全局 isExecuting 状态：** 每张卡片应该独立管理自己的 flashing 状态，避免一张卡片执行时所有卡片都闪动

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 自适应网格 | JS 计算列数 + ResizeObserver | CSS Grid `auto-fill` + `minmax()` | 纯 CSS 方案零 JS 开销，浏览器原生响应式 [VERIFIED: CSS Grid spec] |
| 进出动画 | 自定义 CSS animation class 切换 | tw-animate-css `animate-in`/`animate-out` | 项目已安装，提供标准进出动画工具类 |
| Toast 通知 | 自定义 toast 组件 | sonner (已集成) | 已通过 shadcn/ui 集成，无需重复实现 |
| 类名合并 | 手动字符串拼接 | `cn()` (clsx + tailwind-merge) | 已有工具函数，正确处理 Tailwind 类名优先级 |

**Key insight:** Phase 3 的所有需求都可以通过组合已有工具实现——CSS Grid 原生能力、Tailwind v4 @theme 自定义动画、React 状态驱动。不需要引入任何新依赖。

## Common Pitfalls

### Pitfall 1: auto-fill minmax 值过小导致最小窗口下只有 1 列
**What goes wrong:** 如果 `minmax(200px, 1fr)` 而主区域只有 296px，则只能放 1 列，违反 D-09。
**Why it happens:** 未精确计算主区域可用宽度（窗口宽度 - 侧边栏 - 内边距）。
**How to avoid:** `minmax()` 的最小值应 <= 142px（296px / 2 - gap/2），推荐使用 140px。
**Warning signs:** 窗口拖窄到 600px 时卡片变成单列。

### Pitfall 2: 快速连点导致动画状态混乱
**What goes wrong:** 用户快速连续点击同一卡片，第一次 flashing=true 的 setTimeout 还未触发，第二次点击又设置 flashing=true，导致动画不播放或闪烁异常。
**Why it happens:** React state batching + CSS animation 在同名 class 不变时不会重新触发。
**How to avoid:** 在 handleClick 中先清除再设置：先 setFlashing(false)，使用 requestAnimationFrame 或 useEffect 延迟设置 setFlashing(true)。或者更简单：在 flashing 为 true 时忽略后续点击（按钮已有 disabled 效果）。
**Warning signs:** 快速连点时动画不播放或卡片看起来"卡住"。

### Pitfall 3: animate-spin 在图标上与 scale transition 冲突
**What goes wrong:** hover 的 `scale(1.02)` 和执行中的 `animate-spin` 同时作用于同一元素，transform 属性冲突导致视觉跳动。
**Why it happens:** CSS transform 只有一个值，scale 和 rotate 会互相覆盖。
**How to avoid:** 闪动期间禁用 hover/active 的 scale 变化（在 className 条件中用 `!flashing` 控制），见 Pattern 2 的代码示例。
**Warning signs:** 点击卡片时图标出现位置跳动或缩放异常。

### Pitfall 4: Tailwind v4 arbitrary value 中的空格处理
**What goes wrong:** `grid-cols-[repeat(auto-fill, minmax(140px, 1fr))]` 无效，Tailwind 编译不报错但 class 不生成。
**Why it happens:** Tailwind arbitrary value 中空格必须用下划线替代。
**How to avoid:** 正确写法 `grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))]`。 [VERIFIED: Tailwind CSS docs]

### Pitfall 5: @keyframes 在 @theme inline 块内的位置
**What goes wrong:** 将 @keyframes 放在 `@theme inline { }` 块内部，导致编译错误。
**Why it happens:** @theme 块只接受 CSS 变量声明（`--animate-*`），不接受 @keyframes 规则。
**How to avoid:** `--animate-card-flash` 放在 `@theme inline { }` 内，`@keyframes card-flash` 放在 `@theme` 块外部（同一文件即可）。 [VERIFIED: Tailwind CSS animation docs - "Customizing your theme"]

## Code Examples

### 示例 1: 自适应网格实现

```tsx
// src/components/MainArea.tsx — 核心改动
// 当前: grid-cols-2 (固定 2 列)
// 改为: grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))] (自适应)
export function MainArea({ currentProject, onExecute }: MainAreaProps) {
  if (!currentProject) {
    // D-01: 空状态引导页（保持不变）
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <FolderOpen className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">选择一个项目开始</h2>
        <p className="text-sm text-muted-foreground text-center">
          从左侧添加或选择项目，然后点击指令卡片执行
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col p-8 overflow-auto">
      {/* 项目信息 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground">
          当前项目: {currentProject.name}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{currentProject.path}</p>
      </div>

      {/* 自适应网格 — D-08: auto-fill, D-09: 最小 2 列 */}
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))] gap-3">
        {PRESET_COMMANDS.map((cmd) => (
          <CommandCard
            key={cmd.command}
            name={cmd.name}
            icon={cmd.icon}
            onClick={() => onExecute(cmd.command)}
          />
        ))}
      </div>
    </main>
  );
}
```

### 示例 2: 执行反馈动效 CSS

```css
/* src/index.css — 在现有 @theme inline 块内添加 */
@theme inline {
  /* ... 现有变量保持不变 ... */

  /* 执行反馈闪光动画 (per D-05, D-06) */
  --animate-card-flash: card-flash 400ms ease-out;
}

/* 在 @theme 块外部添加 @keyframes */
@keyframes card-flash {
  0% {
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.1);
    transform: scale(0.97);
  }
  50% {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
  }
  100% {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: none;
    transform: scale(1);
  }
}
```

### 示例 3: CommandCard 执行反馈集成

```tsx
// src/components/CommandCard.tsx — 完整改动版本
import { useState, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCardProps {
  name: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
}

export function CommandCard({ name, icon: Icon, disabled = false, onClick }: CommandCardProps) {
  const [flashing, setFlashing] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled || flashing) return; // 防止快速连点
    setFlashing(true);
    onClick?.();
    setTimeout(() => setFlashing(false), 420); // 400ms 动画 + 20ms buffer
  }, [disabled, flashing, onClick]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
        "bg-white/5 border border-white/10",
        "cursor-pointer select-none",
        "text-xs text-card-foreground",
        // 基础 transition（非执行中时生效）
        !flashing && "transition-all duration-150 ease-out",
        // 执行闪光动效 (per D-05)
        flashing && "animate-card-flash",
        // hover/active（非禁用、非执行中时生效）
        !disabled && !flashing && [
          "hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]",
          "active:bg-white/15 active:scale-[0.98] active:duration-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        ],
        // 禁用状态 (per D-02)
        disabled && "opacity-40 cursor-not-allowed"
      )}
      aria-label={name}
    >
      <Icon className={cn("size-6", flashing && "animate-spin")} />
      <span>{name}</span>
    </button>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 JS config for animations | Tailwind v4 `@theme` + `@keyframes` CSS-first | 2025-01 (Tailwind v4.0) | 动画定义从 JS 迁移到 CSS，更直观 |
| `tailwindcss-animate` npm plugin | `tw-animate-css` (纯 CSS import) | 2025 (tw-animate-css 1.0) | 无需 JS 插件，CSS-first |
| Fixed grid columns + media queries | `auto-fill` + `minmax()` CSS-only | CSS Grid stable (2017) | 零 JS 自适应网格 |
| Framer Motion for simple feedback | CSS @keyframes + React state | Evergreen | 简单反馈不需要动画库 |

**Deprecated/outdated:**
- `tailwindcss-animate`: 不兼容 Tailwind v4，被 `tw-animate-css` 替代 [VERIFIED: tw-animate-css README]
- Tailwind v3 `tailwind.config.js` 中的 `extend.animation`: Tailwind v4 使用 `@theme` CSS 变量 [VERIFIED: Tailwind CSS v4 docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Framer Motion 对本项目来说过度设计，CSS @keyframes 足够 | Standard Stack / Anti-Patterns | 如果后续 Phase 需要复杂动画（如拖拽排序），可能需要引入动画库 |
| A2 | `minmax(140px, 1fr)` 在 600px 窗口下保证 2 列 | Architecture Patterns | 如果实际渲染中浏览器计算有偏差，可能需要微调到 130px |
| A3 | `setTimeout` 420ms 清除 flashing 状态足够可靠 | Architecture Patterns | 极端情况下浏览器 tab 被挂起可能导致 setTimeout 延迟，但对桌面应用影响极小 |

**注意：** 上述假设均为低风险项，核心方案（CSS Grid auto-fill、@keyframes 动画、React 状态驱动）均为业界成熟方案。

## Open Questions

1. **Tooltip 是否需要？**
   - What we know: D-03 决定卡片不显示命令文本，只显示名称
   - What's unclear: 用户是否需要在悬停时看到实际命令（如 "npm run build"）
   - Recommendation: 使用简单 `title` 属性作为 Phase 3 的最小可行方案，如果用户反馈需要更美观的 Tooltip 再在后续 Phase 引入 shadcn/ui Tooltip 组件

2. **项目信息区域是否调整？**
   - What we know: 当前显示"当前项目: {name}" + 路径
   - What's unclear: Claude's Discretion 范围，是否需要优化展示
   - Recommendation: Phase 3 保持现有样式不变，聚焦卡片交互

## Environment Availability

Step 2.6: 环境检查结果

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite 构建工具链 | ✓ | 22.17.0 | — |
| npm | 包管理 | ✓ | 11.7.0 | — |
| Rust | Tauri 后端 | ✓ | 1.93.1 | — |
| vitest | 单元测试 | ✓ (npx) | 4.1.4 | — |
| @testing-library/react | 组件测试 | ✗ | — | Wave 0 安装 |
| jsdom | vitest 环境 | ✗ | — | Wave 0 安装 |

**Missing dependencies with fallback:**
- vitest 可通过 `npx vitest` 运行（全局缓存），但建议安装为 devDependency 以确保稳定
- @testing-library/react 和 jsdom 需要在 Wave 0 安装

**Missing dependencies with no fallback:**
- None — 所有核心开发依赖已就绪

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (npx 可用，需安装为 devDep) |
| Config file | none — Wave 0 需创建 `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 | 预设命令卡片正确渲染（4个） | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx` | ❌ Wave 0 |
| CMD-02 | 网格使用 auto-fill minmax 自适应布局 | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx` | ❌ Wave 0 |
| CMD-03 | 未选中项目时卡片不可点击 | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx` | ❌ Wave 0 |
| CMD-08 | 未选中项目时显示空状态引导 | unit | `npx vitest run src/components/__tests__/MainArea.test.tsx` | ❌ Wave 0 |
| UI-01 | 卡片样式符合 UI-SPEC（圆角、间距、颜色） | visual/manual | — | — |
| UI-05 | 卡片有 hover/active/执行反馈动效 | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + 手动验证 UI 视觉效果

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest 配置文件（React + jsdom 环境）
- [ ] `src/components/__tests__/CommandCard.test.tsx` — 卡片渲染、点击、动效测试
- [ ] `src/components/__tests__/MainArea.test.tsx` — 主区域空状态、网格布局测试
- [ ] 安装测试依赖: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 桌面单用户应用，无认证需求 |
| V3 Session Management | no | 无用户会话 |
| V4 Access Control | no | 无权限控制 |
| V5 Input Validation | yes | 命令执行参数已有 Rust 后端验证（Phase 1 完成） |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for Tauri + React Desktop

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 命令注入 | Tampering | Rust 后端使用 std::process::Command 参数化执行（Phase 1 已实现） |
| XSS via WebView | Tampering | React 默认转义 + Tauri CSP 配置 |

Phase 3 不涉及新的安全面——所有数据流（卡片点击 -> onExecute -> invoke -> Rust 命令执行）已在 Phase 1 建立，Phase 3 只增强 UI 层交互。

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS animation docs](https://tailwindcss.com/docs/animation) — @theme + @keyframes 自定义动画语法
- [Tailwind CSS grid-template-columns docs](https://tailwindcss.com/docs/grid-template-columns) — grid-cols arbitrary value 语法
- [tw-animate-css GitHub](https://github.com/Wombosvideo/tw-animate-css) — 已安装的动画工具库使用方式
- 项目代码: `src/components/CommandCard.tsx` — 现有卡片组件实现
- 项目代码: `src/components/MainArea.tsx` — 现有主区域布局
- 项目代码: `src/hooks/useProject.ts` — executeCommand 接口
- 项目代码: `src/index.css` — 现有 Tailwind v4 配置

### Secondary (MEDIUM confidence)
- [Steve Kinney: Grid Auto-fill Patterns](https://stevekinney.com/courses/tailwind/grid-auto-fit-and-auto-fill-patterns) — auto-fill vs auto-fit 模式
- [Stack Overflow: @keyframes in Tailwind v4](https://stackoverflow.com/questions/79393540/how-to-use-keyframes-in-tailwind-css-version-4) — @theme 指令与 @keyframes 配合
- [UI-SPEC: Phase 1 Design Contract](../01-shell/01-UI-SPEC.md) — 设计规范（间距、颜色、动效时序）

### Tertiary (LOW confidence)
- None — 所有关键技术点已通过官方文档或项目代码验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 无新依赖，全部基于已安装工具
- Architecture: HIGH — CSS Grid auto-fill 和 @keyframes 均为成熟标准方案
- Pitfalls: HIGH — 基于项目代码分析和 Tailwind v4 文档验证

**Research date:** 2026-04-13
**Valid until:** 2026-05-13（Tailwind CSS v4 和 tw-animate-css 处于稳定期，30 天内无重大变更预期）
