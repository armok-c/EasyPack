---
phase: 01-shell
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - vite.config.ts
  - tsconfig.json
  - components.json
  - src/main.tsx
  - src/App.tsx
  - src/index.css
  - src/lib/utils.ts
  - src/vite-env.d.ts
  - src-tauri/tauri.conf.json
  - src-tauri/Cargo.toml
autonomous: true
requirements:
  - UI-02
  - UI-04
  - UI-06

must_haves:
  truths:
    - "应用以深色主题启动，背景为渐变色，所有 UI 元素使用 OKLCH 色彩变量"
    - "窗口默认 720x480，可拖拽调整大小，最小 600x400"
    - "侧边栏 240px 固定宽度始终可见，主区域 flex-1 填充剩余空间"
    - "布局自适应窗口大小变化，侧边栏不压缩"
  artifacts:
    - path: "src/index.css"
      provides: "Tailwind CSS v4 入口 + OKLCH 深色主题变量 + Raycast 渐变背景"
      contains: "@theme inline"
    - path: "src/App.tsx"
      provides: "主布局组件 (Sidebar + MainArea 骨架)"
      exports: ["App"]
    - path: "src-tauri/tauri.conf.json"
      provides: "Tauri 窗口配置"
      contains: "width"
    - path: "vite.config.ts"
      provides: "Vite 配置 (React + Tailwind 插件)"
      contains: "@tailwindcss/vite"
  key_links:
    - from: "src/index.css"
      to: "Tailwind CSS v4 runtime"
      via: "@import 'tailwindcss' + @theme inline"
      pattern: "@import.*tailwindcss"
    - from: "src/App.tsx"
      to: "src/index.css"
      via: "import './index.css'"
      pattern: "import.*index\\.css"
    - from: "src-tauri/tauri.conf.json"
      to: "Tauri window runtime"
      via: "app.windows config"
      pattern: "\"width\".*720"
---

<objective>
Tauri + React + Tailwind CSS v4 + shadcn/ui 脚手架搭建与深色主题配置

Purpose: 建立项目完整技术栈基础设施，确保深色主题、紧凑布局、窗口自适应从第一天就位，为后续 Rust 命令执行和前端集成提供干净的构建环境。

Output: 可运行的 Tauri 桌面应用，深色主题渲染正确，布局为侧边栏(240px) + 主区域(flex-1)，窗口约束生效。
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

<tasks>

<task type="auto">
  <name>Task 1: 创建 Tauri + React + Vite 项目脚手架并配置深色主题</name>
  <files>
    package.json, vite.config.ts, tsconfig.json, tsconfig.app.json, tsconfig.node.json,
    components.json, src/main.tsx, src/App.tsx, src/index.css, src/lib/utils.ts,
    src/vite-env.d.ts, src/components/ui/button.tsx, src/components/ui/sonner.tsx,
    src/components/ui/scroll-area.tsx,
    src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/src/main.rs, src-tauri/src/lib.rs
  </files>
  <read_first>
    @.planning/phases/01-shell/01-RESEARCH.md (Standard Stack 版本表 + Installation 步骤 + Project Structure)
    @.planning/phases/01-shell/01-UI-SPEC.md (Color 表 + Layout Specification + Window Configuration + Component Inventory)
  </read_first>
  <action>
## 步骤 1: 创建 Tauri + React + TypeScript + Vite 项目

使用 create-tauri-app 创建项目。由于当前目录 E:\GitLib\EasyPack 已是 git 仓库，需要在临时目录创建后迁移文件。

```bash
# 在临时目录创建项目
cd /tmp
npm create tauri-app@latest easypack-temp -- --template react-ts
# 将生成的文件复制到项目根目录 (E:\GitLib\EasyPack)
cp -r /tmp/easypack-temp/* E:/GitLib/EasyPack/
cp -r /tmp/easypack-temp/.* E:/GitLib/EasyPack/ 2>/dev/null || true
```

如果 create-tauri-app 提供交互式选择，选择: React, TypeScript, Vite。

如果 create-tauri-app 不可用或失败，手动创建文件结构：
- package.json: 包含 react@19.2.5, react-dom@19.2.5, @tauri-apps/api@2.10.1, @vitejs/plugin-react@6.0.1, vite@6.4.2, typescript@5.7.3
- vite.config.ts: 使用 @vitejs/plugin-react 插件，配置 path alias "@" -> "./src"，配置 Tauri dev server (port 1420)
- tsconfig.json + tsconfig.app.json + tsconfig.node.json: 标准 React + TS 配置
- src-tauri/ 目录: Cargo.toml (tauri 2.10.x), main.rs, lib.rs, tauri.conf.json

## 步骤 2: 降级 Vite 到 6.x（如果 create-tauri-app 生成了 8.x）

```bash
cd E:/GitLib/EasyPack
# 检查 vite 版本
node -e "console.log(require('./package.json').dependencies?.vite || require('./package.json').devDependencies?.vite)"
# 如果是 8.x，降级：
npm install vite@6
```

## 步骤 3: 安装 Tailwind CSS v4 + shadcn/ui

```bash
cd E:/GitLib/EasyPack

# 安装 Tailwind CSS v4 (Vite 插件方式)
npm install -D @tailwindcss/vite tailwindcss

# 初始化 shadcn/ui (New York style, Zinc base, CSS variables: yes)
# 使用 --yes 跳过交互，然后手动调整 components.json
npx shadcn@latest init --defaults
# 如果 init 需要交互，选择: New York, Zinc, CSS variables: yes

# 安装 Phase 1 需要的 shadcn/ui 组件
npx shadcn@latest add button sonner scroll-area

# 安装图标库
npm install lucide-react

# 安装 Tauri Dialog 插件前端包
npm install @tauri-apps/plugin-dialog
```

## 步骤 4: 配置 vite.config.ts

编辑 vite.config.ts，确保包含：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
```

## 步骤 5: 配置深色主题 CSS (src/index.css)

替换 src/index.css 为以下内容（per D-20 Raycast 风格 + UI-SPEC Color 表）：

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* shadcn/ui OKLCH 色彩变量 (Zinc dark theme) */
  --color-background: oklch(0.145 0.014 285.823);
  --color-foreground: oklch(0.985 0.002 247.858);
  --color-card: oklch(0.178 0.020 285.823);
  --color-card-foreground: oklch(0.985 0.002 247.858);
  --color-primary: oklch(0.985 0.002 247.858);
  --color-primary-foreground: oklch(0.205 0.006 285.885);
  --color-secondary: oklch(0.269 0.008 285.877);
  --color-secondary-foreground: oklch(0.985 0.002 247.858);
  --color-muted: oklch(0.269 0.008 285.877);
  --color-muted-foreground: oklch(0.556 0.019 285.938);
  --color-accent: oklch(0.269 0.008 285.877);
  --color-accent-foreground: oklch(0.985 0.002 247.858);
  --color-border: oklch(0.269 0.008 285.877);
  --color-ring: oklch(0.556 0.019 285.938);
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Raycast 风格渐变背景 */
body {
  background: linear-gradient(180deg, oklch(0.145 0.014 285.823), oklch(0.11 0.015 285.823));
  color: var(--color-foreground);
  font-family: var(--font-sans);
}

/* 确保根元素继承深色 */
:root {
  color-scheme: dark;
}
```

注意：不要手动创建 tailwind.config.js（Tailwind v4 已废弃此文件）。

## 步骤 6: 配置 Tauri 窗口 (src-tauri/tauri.conf.json)

确保 tauri.conf.json 的 app.windows 配置如下（per D-01, D-02, D-03, D-20, UI-06）：

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "EasyPack",
        "width": 720,
        "height": 480,
        "minWidth": 600,
        "minHeight": 400,
        "resizable": true,
        "center": true,
        "theme": "dark"
      }
    ]
  }
}
```

保留 create-tauri-app 生成的其他必要配置项（identifier, productName 等）。

## 步骤 7: 安装 Rust 后端依赖

```bash
cd E:/GitLib/EasyPack/src-tauri
cargo add tauri-plugin-dialog serde --features serde/derive
cargo add serde_json
```

## 步骤 8: 配置 lib.rs 注册 Dialog Plugin

编辑 src-tauri/src/lib.rs：

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

注意：commands 模块在 Plan 02 中创建，这里先声明 `mod commands;` 但不注册 invoke_handler（Plan 02 会添加）。如果编译报错 commands 模块不存在，先创建空的 src-tauri/src/commands/mod.rs 文件。

## 步骤 9: 创建 App.tsx 主布局骨架

编辑 src/App.tsx，创建深色主题主布局（per D-04, D-05, UI-SPEC Layout Specification）：

```tsx
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar: 240px fixed, per UI-SPEC + D-04 */}
      <aside className="w-[240px] flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
        {/* Sidebar content placeholder */}
        <div className="p-lg">
          <h1 className="text-base font-semibold text-foreground">EasyPack</h1>
        </div>
      </aside>

      {/* Main area: flex-1, per D-05 */}
      <main className="flex-1 flex flex-col p-lg overflow-auto">
        {/* Main content placeholder */}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">选择一个项目开始</p>
        </div>
      </main>

      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
```

## 步骤 10: 创建 src-tauri/src/commands/mod.rs 空文件

```rust
// Shell commands module - will be implemented in Plan 02
```

## 步骤 11: 创建 capabilities/default.json (per RESEARCH.md Pattern 6)

创建 src-tauri/capabilities/default.json：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default"
  ]
}
```

## 步骤 12: 验证构建

```bash
cd E:/GitLib/EasyPack
npm run dev     # 验证 Vite 前端编译通过
cd src-tauri
cargo build     # 验证 Rust 后端编译通过
cd ..
npx tauri dev   # 验证完整 Tauri 应用启动
```

如果 `npx tauri dev` 启动成功且显示深色主题窗口（720x480，左侧 240px 侧边栏，右侧 "选择一个项目开始" 文字），则任务完成。

## 重要注意事项

1. 不要创建 tailwind.config.js -- Tailwind v4 使用 CSS-first 配置
2. 不要使用 tauri-plugin-shell -- 使用 std::process::Command（Plan 02 实现）
3. TypeScript 使用 5.7.x -- 如果 create-tauri-app 生成了 6.x，降级: `npm install typescript@5`
4. Vite 使用 6.x -- 如果生成了 8.x，降级: `npm install vite@6`
5. 不要使用 pnpm（未安装），全部使用 npm
6. 确保所有 UI 文案使用简体中文（per UI-SPEC Copywriting Contract）
  </action>
  <verify>
    <automated>cd E:/GitLib/EasyPack && node -e "const p=require('./package.json'); console.log('react:', p.dependencies?.react || p.devDependencies?.react); console.log('vite:', p.devDependencies?.vite || p.dependencies?.vite); console.log('tailwindcss:', p.devDependencies?.tailwindcss)" && grep -q "@tailwindcss/vite" vite.config.ts && grep -q "width.*720" src-tauri/tauri.conf.json && grep -q "@theme inline" src/index.css && grep -q "w-\[240px\]" src/App.tsx && grep -q "dialog:default" src-tauri/capabilities/default.json</automated>
  </verify>
  <done>
    - package.json 包含 react@19.x, vite@6.x, tailwindcss@4.x, @tauri-apps/api@2.x, lucide-react, @tauri-apps/plugin-dialog
    - vite.config.ts 包含 @tailwindcss/vite 插件和 "@" 路径别名
    - src/index.css 包含 @import "tailwindcss", @theme inline 块，所有 OKLCH 色彩变量
    - src/App.tsx 包含侧边栏(240px) + 主区域(flex-1) + Toaster 布局
    - src-tauri/tauri.conf.json 配置 width:720, height:480, minWidth:600, minHeight:400, theme:"dark"
    - src-tauri/capabilities/default.json 包含 core:default + dialog:default 权限
    - 不存在 tailwind.config.js 文件
    - `npx tauri dev` 可启动应用（深色主题窗口）
  </done>
</task>

<task type="auto">
  <name>Task 2: 验证深色主题渲染与窗口布局约束</name>
  <files>
    src/App.tsx (微调布局细节)
  </files>
  <read_first>
    @src/index.css (确认 OKLCH 变量和渐变背景)
    @src/App.tsx (确认布局结构)
    @src-tauri/tauri.conf.json (确认窗口配置)
    @.planning/phases/01-shell/01-UI-SPEC.md (Layout Specification + Color 表 + Animation Specification)
  </read_first>
  <action>
确认 Task 1 的构建结果，进行以下微调以确保 UI-SPEC 规格完全对齐：

1. **确认渐变背景**：检查 src/index.css 的 body background 是否为 Raycast 风格垂直渐变（oklch(0.145) -> oklch(0.11)）。

2. **确认侧边栏样式**：检查 src/App.tsx 中 aside 元素是否使用 `bg-black/40 backdrop-blur-sm`（per UI-SPEC Raycast Visual Treatment 表中 Sidebar 行）。

3. **确认布局间距**：确保使用 UI-SPEC Spacing Scale 中的值：
   - 侧边栏外边距：p-lg (24px)
   - EasyPack 标题：text-base (16px) font-semibold
   - 侧边栏与主区域分隔线：border-r border-white/10

4. **确认字体**：检查 CSS 变量 --font-sans 是否指向 system font stack（per UI-SPEC Typography Font Stack）。

5. **确认 Toaster 配置**：检查 Toaster 组件是否设置了 `richColors position="bottom-right" duration={1500}`（per D-10 toast 1-2秒消失，UI-SPEC Copywriting Toast success duration 1500ms）。

6. **运行 `npx tauri dev` 启动应用**，确认：
   - 窗口居中显示，尺寸约为 720x480
   - 背景为深色渐变
   - 左侧有 240px 侧边栏，显示 "EasyPack" 标题
   - 右侧主区域显示 "选择一个项目开始"
   - 尝试拖拽窗口边缘缩小，窗口不应小于 600x400

如果有任何视觉不一致，调整对应的 CSS 或组件代码。
  </action>
  <verify>
    <automated>cd E:/GitLib/EasyPack && grep -c "bg-black/40" src/App.tsx && grep -c "backdrop-blur-sm" src/App.tsx && grep -c "w-\[240px\]" src/App.tsx && grep -c "flex-1" src/App.tsx && grep -c "duration={1500}" src/App.tsx && grep -c "font-sans" src/index.css</automated>
  </verify>
  <done>
    - 应用启动后显示深色渐变背景
    - 侧边栏 240px 固定宽度，使用半透明背景 + 毛玻璃效果
    - 主区域 flex-1 填充剩余空间
    - Toaster 配置为 bottom-right 位置，1500ms 时长
    - 窗口拖拽缩小时不低于 600x400
    - 所有文字使用系统字体栈
  </done>
</task>

</tasks>

<verification>
1. `npx tauri dev` 启动成功，无编译错误
2. 应用以深色主题显示，背景渐变可见
3. 窗口默认 720x480，最小 600x400
4. 侧边栏 240px 固定，主区域自适应
5. 无 tailwind.config.js 文件存在
6. package.json 中 vite 版本为 6.x
</verification>

<success_criteria>
- Tauri 应用可启动并显示 Raycast 风格深色主题 UI
- 侧边栏 + 主区域布局符合 UI-SPEC 规格
- 窗口尺寸约束（720x480 默认，600x400 最小）生效
- 所有 CSS 变量使用 OKLCH 格式
- shadcn/ui 组件（button, sonner, scroll-area）已安装可用
</success_criteria>

<output>
After completion, create `.planning/phases/01-shell/01-01-SUMMARY.md`
</output>
