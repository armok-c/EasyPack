---
phase: 01-shell
plan: 03
type: execute
wave: 2
depends_on:
  - 01
  - 02
files_modified:
  - src/hooks/useProject.ts
  - src/lib/presets.ts
  - src/components/Sidebar.tsx
  - src/components/MainArea.tsx
  - src/components/CommandCard.tsx
  - src/App.tsx
autonomous: true
requirements:
  - PROJ-01
  - UI-04
  - UI-06

must_haves:
  truths:
    - "用户点击添加项目按钮后，系统文件夹选择器弹出"
    - "选择文件夹后，侧边栏显示文件夹名称（非完整路径）"
    - "选择后立即选中该项目，主区域显示 4 个命令按钮"
    - "点击命令按钮在系统终端中执行对应命令"
    - "未选择项目时，主区域显示引导页"
    - "未选择项目时，侧边栏显示还没有项目提示"
    - "命令执行后显示 toast 提示"
  artifacts:
    - path: "src/hooks/useProject.ts"
      provides: "项目状态管理 hook (selectFolder, executeCommand)"
      exports: ["useProject"]
    - path: "src/lib/presets.ts"
      provides: "4 个预设命令定义"
      exports: ["PRESET_COMMANDS"]
    - path: "src/components/Sidebar.tsx"
      provides: "侧边栏组件 (EasyPack 标题 + 添加项目按钮 + 项目名)"
      exports: ["Sidebar"]
    - path: "src/components/MainArea.tsx"
      provides: "主区域组件 (引导页 / 命令卡片网格)"
      exports: ["MainArea"]
    - path: "src/components/CommandCard.tsx"
      provides: "命令卡片组件 (图标 + 名称 + 点击执行)"
      exports: ["CommandCard"]
  key_links:
    - from: "src/App.tsx"
      to: "src/hooks/useProject.ts"
      via: "useProject() hook 调用"
      pattern: "useProject"
    - from: "src/App.tsx"
      to: "src/components/Sidebar.tsx"
      via: "Sidebar 组件渲染 + props 传递"
      pattern: "import.*Sidebar"
    - from: "src/App.tsx"
      to: "src/components/MainArea.tsx"
      via: "MainArea 组件渲染 + props 传递"
      pattern: "import.*MainArea"
    - from: "src/components/MainArea.tsx"
      to: "src/components/CommandCard.tsx"
      via: "CommandCard 组件渲染"
      pattern: "import.*CommandCard"
    - from: "src/components/MainArea.tsx"
      to: "src/lib/presets.ts"
      via: "PRESET_COMMANDS 导入"
      pattern: "PRESET_COMMANDS"
    - from: "src/hooks/useProject.ts"
      to: "@tauri-apps/plugin-dialog"
      via: "open() 文件夹选择"
      pattern: "@tauri-apps/plugin-dialog"
    - from: "src/hooks/useProject.ts"
      to: "@tauri-apps/api/core"
      via: "invoke('execute_command')"
      pattern: "invoke.*execute_command"
---

<objective>
文件夹选择器与 Shell 命令执行集成验证

Purpose: 将 Plan 01 的 UI 基础设施和 Plan 02 的 Rust 命令执行连接起来，实现完整的用户流程：选择项目 -> 显示命令按钮 -> 点击执行 -> 终端弹出。

Output: 完整可用的 EasyPack Phase 1 应用。用户可以启动应用，选择项目文件夹，看到命令卡片，点击卡片在系统终端中执行命令。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-shell/01-CONTEXT.md
@.planning/phases/01-shell/01-RESEARCH.md
@.planning/phases/01-shell/01-UI-SPEC.md
</context>

<interfaces>
<!-- Plan 01 创建的前端基础设施 -->

From src/App.tsx (Plan 01 创建的布局骨架):
```tsx
// 深色主题主布局，Sidebar (240px) + MainArea (flex-1) + Toaster
// 侧边栏有 EasyPack 标题，主区域有占位文字
```

From src/index.css (Plan 01 创建的 CSS 变量):
```css
/* OKLCH 色彩变量已定义: --color-background, --color-foreground, --color-card 等 */
/* 渐变背景: linear-gradient(180deg, oklch(0.145), oklch(0.11)) */
```

From src/components/ui/ (Plan 01 安装的 shadcn/ui):
- button.tsx: Button 组件，支持 variant 和 size props
- sonner.tsx: Toaster + toast 函数
- scroll-area.tsx: ScrollArea 组件

<!-- Plan 02 创建的 Rust 命令 -->

From src-tauri/src/commands/shell.rs (Plan 02 创建):
```rust
#[tauri::command]
pub async fn execute_command(project_path: String, shell_command: String) -> Result<(), String>
```

From src-tauri/src/lib.rs (Plan 02 注册):
```rust
.invoke_handler(tauri::generate_handler![commands::execute_command])
```

<!-- 前端调用方式 -->
```typescript
import { invoke } from '@tauri-apps/api/core';
await invoke('execute_command', { projectPath: string, shellCommand: string });

import { open } from '@tauri-apps/plugin-dialog';
const selected = await open({ directory: true, multiple: false, title: '选择项目文件夹' });
// 返回 string | string[] | null
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: 创建核心 hooks、预设命令数据和所有 UI 组件</name>
  <files>
    src/hooks/useProject.ts, src/lib/presets.ts,
    src/components/CommandCard.tsx, src/components/Sidebar.tsx, src/components/MainArea.tsx,
    src/App.tsx
  </files>
  <read_first>
    @src/App.tsx (Plan 01 创建的布局骨架，需要增强)
    @src/components/ui/button.tsx (确认 Button 组件接口)
    @src/components/ui/sonner.tsx (确认 Toaster 和 toast 接口)
    @.planning/phases/01-shell/01-UI-SPEC.md (Layout Specification + Component Inventory + Copywriting Contract + Animation Specification + Color Raycast Visual Treatment)
    @.planning/phases/01-shell/01-CONTEXT.md (所有 D-01 到 D-21 锁定决策)
  </read_first>
  <action>
## 步骤 1: 创建预设命令数据 (src/lib/presets.ts)

```typescript
// per D-12: 4 个内置命令
// per UI-SPEC Phase 1 Preset Commands 表
import { Package, Play, GitPullRequest, Sparkles, type LucideIcon } from "lucide-react";

export interface PresetCommand {
  name: string;
  command: string;
  icon: LucideIcon;
}

export const PRESET_COMMANDS: PresetCommand[] = [
  { name: "打包项目", command: "npm run build", icon: Package },
  { name: "启动项目", command: "npm run dev", icon: Play },
  { name: "Git Pull", command: "git pull", icon: GitPullRequest },
  { name: "启动 Claude", command: "claude", icon: Sparkles },
];
```

## 步骤 2: 创建项目状态管理 hook (src/hooks/useProject.ts)

```typescript
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export interface Project {
  name: string;   // 文件夹名称 (per D-14)
  path: string;   // 完整路径
}

export function useProject() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // per D-15, D-16: 选择文件夹后立即选中
  // per D-14: 只显示文件夹名
  // per D-17: 替换当前项目
  async function selectFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目文件夹",  // per UI-SPEC Copywriting
      });

      if (typeof selected === "string") {
        // 从路径中提取文件夹名称 (per D-14)
        const name = selected.split(/[\\/]/).filter(Boolean).pop() || selected;
        setCurrentProject({ name, path: selected });
      }
      // per UI-SPEC: 文件夹选择取消时不需要 toast
    } catch (error) {
      console.error("文件夹选择失败:", error);
    }
  }

  // per D-10: toast 提示 1-2 秒
  // per D-11: 自动 cd 到项目目录
  async function executeCommand(shellCommand: string) {
    if (!currentProject) return;

    try {
      await invoke("execute_command", {
        projectPath: currentProject.path,
        shellCommand,
      });
      // per UI-SPEC Copywriting: "已执行: {command}"
      toast.success(`已执行: ${shellCommand}`);
    } catch (error) {
      // per UI-SPEC Copywriting: "命令执行失败：{具体错误}。请检查项目路径和命令是否正确。"
      toast.error(`命令执行失败：${error}。请检查项目路径和命令是否正确。`);
    }
  }

  return { currentProject, selectFolder, executeCommand };
}
```

## 步骤 3: 创建 CommandCard 组件 (src/components/CommandCard.tsx)

per UI-SPEC Component Inventory (Command card 行) + Interaction States 表 + Animation Specification:

```typescript
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCardProps {
  name: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
}

export function CommandCard({ name, icon: Icon, disabled = false, onClick }: CommandCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // per UI-SPEC Grid Specification: p-4, rounded-xl (12px)
        "flex flex-col items-center justify-center gap-sm p-md rounded-xl",
        // per UI-SPEC Raycast Visual Treatment: bg-white/5, border-white/10
        "bg-white/5 border border-white/10",
        "cursor-pointer select-none",
        // per UI-SPEC Typography: Label 12px regular
        "text-xs text-card-foreground",
        // per UI-SPEC Animation: 150ms hover, 100ms active
        "transition-all duration-150 ease-out",
        // per UI-SPEC Interaction States - Default
        !disabled && [
          "hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]",
          "active:bg-white/15 active:scale-[0.98] active:duration-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        ],
        // per UI-SPEC Interaction States - Disabled
        disabled && "opacity-40 cursor-not-allowed"
      )}
      aria-label={name}
    >
      <Icon className="size-6" />
      <span>{name}</span>
    </button>
  );
}
```

## 步骤 4: 创建 Sidebar 组件 (src/components/Sidebar.tsx)

per D-04 (始终可见), D-15 (添加按钮在顶部), D-14 (只显示文件夹名), D-21 (空状态提示):
per UI-SPEC Sidebar Elements + Copywriting Contract:

```typescript
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/hooks/useProject";

interface SidebarProps {
  currentProject: Project | null;
  onAddProject: () => void;
}

export function Sidebar({ currentProject, onAddProject }: SidebarProps) {
  return (
    <aside className="w-[240px] flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
      {/* App 标题 (per UI-SPEC: 16px semibold) */}
      <div className="p-lg border-b border-white/5">
        <h1 className="text-base font-semibold text-foreground">EasyPack</h1>
      </div>

      {/* 添加项目按钮 (per D-15: 侧边栏顶部) */}
      <div className="p-md">
        <Button
          onClick={onAddProject}
          variant="default"
          size="sm"
          className="w-full gap-xs"
        >
          <Plus className="size-4" />
          添加项目
        </Button>
      </div>

      {/* 项目列表 / 空状态 (per D-21, UI-SPEC Copywriting) */}
      <div className="flex-1 px-md py-sm">
        {currentProject ? (
          <div className="px-sm py-sm rounded-lg bg-white/5 border border-white/10">
            <span className="text-xs text-foreground">{currentProject.name}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2xl text-center">
            <FolderOpen className="size-8 text-muted-foreground mb-sm" />
            <p className="text-xs text-muted-foreground">还没有项目</p>
            <p className="text-xs text-muted-foreground mt-xs">点击上方按钮添加第一个项目</p>
          </div>
        )}
      </div>
    </aside>
  );
}
```

## 步骤 5: 创建 MainArea 组件 (src/components/MainArea.tsx)

per D-05 (上方项目路径 + 下方按钮), D-19 (首次启动引导页), D-12 (4 个命令):
per UI-SPEC Layout Specification + Grid Specification:

```typescript
import { FolderOpen } from "lucide-react";
import { CommandCard } from "@/components/CommandCard";
import { PRESET_COMMANDS } from "@/lib/presets";
import type { Project } from "@/hooks/useProject";

interface MainAreaProps {
  currentProject: Project | null;
  onExecute: (command: string) => void;
}

export function MainArea({ currentProject, onExecute }: MainAreaProps) {
  if (!currentProject) {
    // per D-19: 首次启动引导页
    // per UI-SPEC Copywriting: "选择一个项目开始" + "从左侧添加或选择项目..."
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-xl">
        <FolderOpen className="size-12 text-muted-foreground mb-md" />
        <h2 className="text-lg font-semibold text-foreground mb-sm">选择一个项目开始</h2>
        <p className="text-sm text-muted-foreground text-center">
          从左侧添加或选择项目，然后点击指令卡片执行
        </p>
      </main>
    );
  }

  // per D-05: 上方项目路径 + 下方按钮区域
  return (
    <main className="flex-1 flex flex-col p-xl overflow-auto">
      {/* 当前项目信息 */}
      <div className="mb-lg">
        <h2 className="text-sm font-medium text-foreground">
          当前项目: {currentProject.name}
        </h2>
        <p className="text-xs text-muted-foreground mt-xs">{currentProject.path}</p>
      </div>

      {/* per UI-SPEC Grid: 2 cols, 12px gap */}
      <div className="grid grid-cols-2 gap-card-gap">
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

## 步骤 6: 更新 App.tsx 整合所有组件

```typescript
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MainArea } from "@/components/MainArea";
import { useProject } from "@/hooks/useProject";
import "./index.css";

function App() {
  const { currentProject, selectFolder, executeCommand } = useProject();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar currentProject={currentProject} onAddProject={selectFolder} />
      <MainArea currentProject={currentProject} onExecute={executeCommand} />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
```

## 步骤 7: 更新 index.css 添加 Tailwind 自定义间距

确认 src/index.css 中的 @theme inline 块包含间距变量（映射 UI-SPEC Spacing Scale）：

在 @theme inline 块中添加：
```css
  /* Spacing Scale (per UI-SPEC) */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-card-gap: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
```

或者使用 Tailwind 的 arbitrary values（如 `p-[24px]`、`gap-[12px]`）。如果 Tailwind v4 不支持自定义 spacing token 的方式，直接使用 arbitrary values：`p-6`(24px), `gap-3`(12px), `px-4`(16px) 等 Tailwind 标准间距。

选择使用 Tailwind 标准间距值替代自定义 token：
- xs (4px) -> `p-1`, `gap-1`
- sm (8px) -> `p-2`, `gap-2`
- card-gap (12px) -> `gap-3`
- md (16px) -> `p-4`, `gap-4`
- lg (24px) -> `p-6`, `gap-6`
- xl (32px) -> `p-8`, `gap-8`
- 2xl (48px) -> `p-12`

将组件中的自定义间距类名（如 `p-lg`, `gap-card-gap`, `mb-md`）替换为 Tailwind 标准值：
- `p-lg` -> `p-6`
- `p-md` -> `p-4`
- `p-xl` -> `p-8`
- `gap-xs` -> `gap-1`
- `gap-sm` -> `gap-2`
- `gap-card-gap` -> `gap-3`
- `mb-sm` -> `mb-2`
- `mb-md` -> `mb-4`
- `mb-lg` -> `mb-6`
- `mt-xs` -> `mt-1`
- `px-md` -> `px-4`
- `py-sm` -> `py-2`
- `py-2xl` -> `py-12`
- `px-sm` -> `px-2`

## 步骤 8: 验证构建

```bash
cd E:/GitLib/EasyPack
npx tauri dev
```

确认应用启动后：
- 左侧侧边栏显示 "EasyPack" 标题 + "添加项目" 按钮 + "还没有项目" 提示
- 右侧主区域显示引导页 "选择一个项目开始"
- 点击 "添加项目" 弹出系统文件夹选择器
- 选择文件夹后，侧边栏显示文件夹名称
- 主区域显示 4 个命令卡片（打包项目、启动项目、Git Pull、启动 Claude）
- 点击卡片弹出终端窗口执行命令
- 显示 toast 提示 "已执行: xxx"
  </action>
  <verify>
    <automated>cd E:/GitLib/EasyPack && grep -c "PRESET_COMMANDS" src/lib/presets.ts && grep -c "useProject" src/hooks/useProject.ts && grep -c "CommandCard" src/components/CommandCard.tsx && grep -c "Sidebar" src/components/Sidebar.tsx && grep -c "MainArea" src/components/MainArea.tsx && grep -c "useProject" src/App.tsx && grep -c "Sidebar" src/App.tsx && grep -c "MainArea" src/App.tsx && grep -c "@tauri-apps/plugin-dialog" src/hooks/useProject.ts && grep -c "invoke.*execute_command" src/hooks/useProject.ts && npx tauri build 2>&1 | tail -5 || echo "Build check done"</automated>
  </verify>
  <done>
    - src/lib/presets.ts 导出 4 个预设命令 (npm run build, npm run dev, git pull, claude)
    - src/hooks/useProject.ts 导出 useProject hook (currentProject, selectFolder, executeCommand)
    - useProject 使用 @tauri-apps/plugin-dialog 的 open() 选择文件夹
    - useProject 使用 invoke('execute_command') 执行命令
    - src/components/CommandCard.tsx 渲染圆角卡片（图标 + 名称），支持 hover/active/disabled 状态
    - src/components/Sidebar.tsx 渲染侧边栏（标题 + 添加按钮 + 项目名/空状态）
    - src/components/MainArea.tsx 渲染主区域（引导页 / 项目信息 + 命令卡片网格）
    - src/App.tsx 整合所有组件，通过 useProject hook 管理状态
    - `npx tauri dev` 启动成功，完整流程可用
  </done>
</task>

</tasks>

<verification>
1. `npx tauri dev` 启动应用无错误
2. 应用显示深色主题，侧边栏 + 主区域布局正确
3. 点击 "添加项目" 弹出系统文件夹选择器
4. 选择文件夹后侧边栏显示文件夹名
5. 主区域显示 4 个命令卡片
6. 点击命令卡片弹出终端窗口并执行命令
7. Toast 提示显示 "已执行: xxx"
8. `cd src-tauri && cargo test` 仍然通过
</verification>

<success_criteria>
- 完整用户流程可用：启动 -> 选择项目 -> 看到命令 -> 点击执行 -> 终端弹出
- 侧边栏显示文件夹名（非完整路径），per D-14
- 4 个预设命令卡片正确渲染，per D-12
- 命令在 Windows Terminal 或 cmd.exe 中执行，per D-07
- 终端保持打开，per D-09
- Toast 显示执行反馈，per D-10
- 空状态引导页显示正确，per D-19, D-21
</success_criteria>

<output>
After completion, create `.planning/phases/01-shell/01-03-SUMMARY.md`
</output>
