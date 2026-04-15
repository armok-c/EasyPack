# Phase 2: 项目侧边栏与持久化 - Research

**Researched:** 2026-04-12
**Domain:** Tauri plugin-store 持久化 + React 多项目状态管理 + 侧边栏 UI 重构
**Confidence:** HIGH

## Summary

Phase 2 的核心任务是将 Phase 1 的单项目模式重构为多项目列表模式，并引入 tauri-plugin-store 实现数据持久化。技术方案已经确定：使用 `@tauri-apps/plugin-store` 2.x（当前 2.4.2）配合 `autoSave` 选项实现自动持久化，React 侧通过重构 `useProject` hook 管理多项目状态。

tauri-plugin-store 2.x 提供两种前端 API：`load()` 函数（推荐）和 `LazyStore` 类。`load()` 返回 `Store` 实例，支持 `set/get/delete/keys/entries/save` 等操作，`autoSave` 默认启用（100ms 防抖），非常适合本项目"变更即保存"的需求。Rust 端只需注册插件 `.plugin(tauri_plugin_store::Builder::default().build())`，无需编写自定义命令。

React 状态管理模式推荐在 `useProject` hook 内部管理 `Project[]` + `selectedId`，所有变更操作（添加/删除/选中）先更新 React state 再同步到 store。项目 ID 推荐使用路径规范化后的字符串作为唯一标识，避免引入 UUID 依赖。

**Primary recommendation:** 使用 `load('easypack-store.json', { autoSave: 100 })` 创建单一 store 文件，存储项目列表和选中状态，React hook 负责内存状态管理并双向同步。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 侧边栏展示多个项目，使用 ScrollArea 组件（已安装）支持滚动
- **D-02:** 项目排列顺序为添加时间顺序，新添加的项目在列表底部（Phase 5 加入拖拽排序）
- **D-03:** 每个项目只显示文件夹名称（沿用 Phase 1 D-14），不显示完整路径
- **D-04:** 重复项目处理：检测到已存在路径时显示 toast 提示"项目已存在"，不重复添加
- **D-05:** 点击侧边栏项目即可选中，选中后主区域立即更新显示该项目
- **D-06:** 选中的项目有明显的视觉反馈：`bg-white/10` + `border-white/20`（在 Phase 1 的 `bg-white/5` + `border-white/10` 基础上加强）
- **D-07:** 未选中项目使用微弱背景（`bg-white/5` 或透明），与选中状态形成对比
- **D-08:** 未选中项目悬停时显示轻微背景变化（`bg-white/[0.08]`）+ 显示 X 删除按钮
- **D-09:** 悬停项目时右侧出现 X 图标按钮，点击直接删除（无确认弹窗）
- **D-10:** 删除当前选中项目后，自动选中列表中邻近的项目（优先下一个，无下一个则选上一个）
- **D-11:** 删除最后一个项目后回到空状态（沿用 Phase 1 D-21 空状态引导）
- **D-12:** 使用 tauri-plugin-store + autoSave 进行持久化（ROADMAP 已锁定）
- **D-13:** 持久化数据包括：项目列表（name + path + 添加时间）、选中项目 ID、项目排列顺序
- **D-14:** 应用启动时从 store 恢复项目列表和选中状态

### Claude's Discretion
- Store 的 key 命名和数据 schema 设计
- useProject hook 的重构方式（从 useState -> store-backed state）
- 项目 ID 生成策略（path 作为唯一标识 vs UUID）
- X 按钮的具体位置和尺寸
- 持久化失败时的降级处理

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-02 | 项目列表显示在左侧侧边栏，显示项目名称 | ScrollArea 组件 + 多项目 state 管理 + D-03 约定（仅显示文件夹名） |
| PROJ-03 | 点击侧边栏项目可选中，选中状态有清晰视觉反馈 | D-05/D-06/D-07/D-08 定义了具体 Tailwind 样式，通过 selectedId 状态驱动 className 切换 |
| PROJ-04 | 用户可删除已添加的项目 | D-09/D-10/D-11 定义了删除交互和边界行为，X 按钮悬停显示 |
| DATA-01 | 项目列表保存到本地，重启应用后恢复 | tauri-plugin-store 2.x `load()` + `autoSave` + React hook 初始化加载 |
| DATA-03 | 项目排序和图标/颜色设置持久化保存 | store 中保存项目数组（按添加时间排序），选中 ID 单独存储 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tauri-apps/plugin-store | 2.4.2 | 持久化 key-value 存储 | Tauri 官方插件，autoSave 自动持久化，API 简洁，支持 JSON 序列化 |
| tauri-plugin-store (Rust crate) | 2.4.2 | Rust 端 store 插件注册 | 与前端 npm 包版本对应，Builder 模式注册 |
| React useState | 19.x | 内存状态管理 | 项目已有，不需要引入额外状态管理库 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-scroll-area | 1.2.10 | 项目列表滚动容器 | 已安装，D-01 锁定使用 |
| lucide-react | 1.8.0 | X 图标 | 已安装，删除按钮图标 |
| sonner | 2.0.7 | Toast 提示 | 已安装，重复项目提示 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-plugin-store | tauri-plugin-fs + 手写 JSON | store 插件封装了文件读写和并发控制，不需要手动管理。FS 插件更适合大文件操作 |
| tauri-plugin-store | localStorage | localStorage 有 5MB 限制，且数据在 WebView 清理时可能丢失。store 插件数据持久到 app_data_dir |
| React useState | Zustand/Jotai | 本项目状态简单（一个 hook 管理全部），不需要外部状态管理库的复杂度 |

**Installation:**

```bash
# 前端 npm 包
npm install @tauri-apps/plugin-store

# Rust 端 crate（在 src-tauri/ 目录）
cd src-tauri && cargo add tauri-plugin-store
```

**Version verification:**
- `@tauri-apps/plugin-store`: 2.4.2 (npm registry, verified 2026-04-12)
- `tauri-plugin-store` crate: 2.4.2 (crates.io, verified 2026-04-12)

## Architecture Patterns

### Recommended Data Schema

```typescript
// Store 文件: easypack-store.json (保存在 app_data_dir)
// 使用单一 store，多个 key 分区存储

// Key: "projects" — 项目列表
interface ProjectItem {
  id: string;       // 路径规范化后的唯一标识（推荐策略）
  name: string;     // 文件夹名称
  path: string;     // 完整路径（原始路径，保留原始大小写）
  addedAt: number;  // 添加时间戳 (Date.now())
}

// Key: "selectedProjectId" — 当前选中项目 ID
type SelectedProjectId = string | null;

// Store 完整结构示例:
// {
//   "projects": [
//     { "id": "c:/users/dev/projects/easypack", "name": "EasyPack", "path": "C:\\Users\\Dev\\Projects\\EasyPack", "addedAt": 1712880000000 },
//     { "id": "d:/work/my-app", "name": "my-app", "path": "D:\\Work\\My App", "addedAt": 1712966400000 }
//   ],
//   "selectedProjectId": "c:/users/dev/projects/easypack"
// }
```

### Pattern 1: Store-Backed React Hook

**What:** useProject hook 内部维护 React state，所有变更同时写入 store
**When to use:** 所有需要持久化的状态管理场景

```typescript
// Source: 基于 tauri-plugin-store 2.x 官方 API 设计
import { load, type Store } from '@tauri-apps/plugin-store';
import { useState, useEffect, useCallback } from 'react';

const STORE_PATH = 'easypack-store.json';
const PROJECTS_KEY = 'projects';
const SELECTED_KEY = 'selectedProjectId';

export function useProject() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化：加载 store + 恢复数据
  useEffect(() => {
    async function init() {
      const s = await load(STORE_PATH, { autoSave: 100 });
      const savedProjects = await s.get<ProjectItem[]>(PROJECTS_KEY);
      const savedSelectedId = await s.get<string>(SELECTED_KEY);
      if (savedProjects) setProjects(savedProjects);
      if (savedSelectedId) setSelectedId(savedSelectedId);
      setStore(s);
      setLoading(false);
    }
    init();
  }, []);

  // 所有变更操作：先更新 state，再写入 store
  // store.set() + autoSave 会自动持久化到磁盘
  const addProject = useCallback(async (project: ProjectItem) => {
    const updated = [...projects, project];
    setProjects(updated);
    await store?.set(PROJECTS_KEY, updated);
    setSelectedId(project.id);
    await store?.set(SELECTED_KEY, project.id);
  }, [projects, store]);

  // ...其他操作类似
}
```

### Pattern 2: 项目 ID 生成策略（Claude's Discretion 推荐）

**What:** 使用路径规范化作为项目 ID
**When to use:** 项目标识符生成

```typescript
// 推荐：路径规范化作为 ID
// 优势：天然唯一（同一文件夹不可能添加两次），无需 UUID 依赖
// 关键：Windows 路径不区分大小写，需统一转小写
function generateProjectId(path: string): string {
  return path
    .split(/[\\/]/)          // 兼容 / 和 \
    .filter(Boolean)
    .join('/')
    .toLowerCase();          // Windows 路径不区分大小写
}

// 重复检测：用 id 做 Map key
function isDuplicate(projects: ProjectItem[], path: string): boolean {
  const id = generateProjectId(path);
  return projects.some(p => p.id === id);
}
```

### Pattern 3: 侧边栏项目列表项

**What:** 单个项目渲染组件，含选中/悬停/删除交互
**When to use:** Sidebar 中项目列表的每行渲染

```tsx
// 样式约定（来自 D-06/D-07/D-08）
// 选中态: bg-white/10 + border-white/20
// 未选中态: bg-white/5 或 transparent
// 悬停态: bg-white/[0.08] + 显示 X 按钮
// 删除按钮: 悬停时右侧出现，使用 lucide-react X 图标

<div className={cn(
  "group relative flex items-center px-2 py-2 rounded-lg border cursor-pointer",
  "transition-all duration-150",
  isSelected
    ? "bg-white/10 border-white/20"          // D-06
    : "bg-white/5 border-white/10 hover:bg-white/[0.08]", // D-07, D-08
)}>
  <span className="text-xs text-foreground truncate flex-1">
    {project.name}
  </span>
  {/* D-09: 悬停时显示 X 按钮 */}
  <button
    onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
    className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-white/10"
  >
    <X className="size-3 text-muted-foreground" />
  </button>
</div>
```

### Anti-Patterns to Avoid

- **直接将 path 作为 React key**: Windows 路径大小写不一致会导致 key 冲突。使用规范化后的 id 作为 key
- **store.set() 后不等待 Promise**: store 操作是异步的，忽略 await 可能导致状态不一致
- **在 useEffect 中无条件调用 store.get**: 初始化时应只在 store 加载完成后读取，避免竞态
- **删除操作使用 Array.filter 后忘记更新 selectedId**: D-10 要求自动选中邻近项目，需要额外逻辑处理

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 持久化文件读写 | 手写 fs 读写 + JSON parse/stringify | tauri-plugin-store autoSave | Store 处理并发写入、原子保存、错误恢复 |
| 防抖保存逻辑 | setTimeout 防抖保存 | store autoSave 选项 | 内置 100ms 防抖，自动管理 |
| Store 初始化竞态 | 手写加载状态管理 | useEffect + loading state | React 标准模式，简单可靠 |

**Key insight:** tauri-plugin-store 的 autoSave 选项（默认 100ms 防抖）完全满足本项目需求。每次 `store.set()` 调用后，store 会在 100ms 内自动保存到磁盘。不需要手动调用 `store.save()`，除非需要立即保存（如应用退出前）。

## Common Pitfalls

### Pitfall 1: Store 初始化时序问题

**What goes wrong:** 组件渲染时 store 尚未加载完成，导致读取到 undefined 数据
**Why it happens:** `load()` 是异步操作，React 首次渲染时 store 实例可能还未就绪
**How to avoid:** 在 hook 中维护 `loading` 状态，store 加载完成前显示空状态或 loading spinner
**Warning signs:** 项目列表闪烁、选中状态丢失、控制台报 "Cannot read property 'set' of null"

### Pitfall 2: Windows 路径大小写不一致

**What goes wrong:** 同一个路径 `C:\Projects\MyApp` 和 `c:\projects\myapp` 被视为两个不同项目
**Why it happens:** Windows 文件系统不区分大小写，但字符串比较区分
**How to avoid:** 生成 ID 时统一转小写：`path.toLowerCase()`，重复检测基于规范化后的 ID
**Warning signs:** 用户添加同一文件夹两次成功，出现重复项目

### Pitfall 3: Store 的 autoSave 与手动 save 混用

**What goes wrong:** 在 autoSave 开启时频繁手动调用 `store.save()`，导致不必要的磁盘写入
**Why it happens:** 不了解 autoSave 机制，以为需要手动保存
**How to avoid:** autoSave: 100 时只需调用 `store.set()`，让防抖机制处理持久化
**Warning signs:** 应用卡顿、控制台频繁出现保存日志

### Pitfall 4: 忘记注册 Rust 端插件

**What goes wrong:** 前端调用 `load()` 时报错 "Plugin not found" 或类似错误
**Why it happens:** 只安装了 npm 包，忘记在 Rust 端 `lib.rs` 中注册插件
**How to avoid:** 确保两步都完成：(1) Cargo.toml 添加 `tauri-plugin-store` 依赖 (2) `lib.rs` 添加 `.plugin(tauri_plugin_store::Builder::default().build())`
**Warning signs:** 前端报 `Unhandled Promise Rejection: store:load` 错误

### Pitfall 5: capabilities 权限缺失

**What goes wrong:** Store 操作被 Tauri 安全系统拒绝，前端报权限错误
**Why it happens:** Tauri 2 的权限系统要求在 capabilities 中显式声明插件权限
**How to avoid:** 在 `src-tauri/capabilities/default.json` 中添加 `"store:default"` 权限
**Warning signs:** 浏览器控制台报 "not allowed" 或 "denied" 错误

### Pitfall 6: 删除选中项目后 selectedId 指向已删除项

**What goes wrong:** 删除当前选中项目后，selectedId 仍指向已删除的项目 ID，导致主区域显示异常
**Why it happens:** 删除操作只更新了 projects 数组，没有同步处理 selectedId
**How to avoid:** D-10 要求的"自动选中邻近"逻辑必须在删除操作中一并处理
**Warning signs:** 主区域显示不存在的项目、或显示空状态但 selectedId 非空

## Code Examples

### Store 初始化与插件注册

```typescript
// Source: tauri-plugin-store 官方文档 https://v2.tauri.app/plugin/store/

// === Rust 端: src-tauri/src/lib.rs ===
// 添加插件注册
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())  // 新增
        .invoke_handler(tauri::generate_handler![
            commands::shell::execute_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```toml
# === Cargo.toml 新增依赖 ===
[dependencies]
# ... 现有依赖 ...
tauri-plugin-store = "2"
```

```json
// === capabilities/default.json 新增权限 ===
{
  "permissions": [
    "core:default",
    "dialog:default",
    "store:default"    // 新增：启用 store 所有默认操作
  ]
}
```

### 前端 Store 使用模式

```typescript
// Source: tauri-plugin-store 2.x API https://v2.tauri.app/reference/javascript/store/
import { load } from '@tauri-apps/plugin-store';

// 创建或加载 store（autoSave: 100ms 防抖自动保存）
const store = await load('easypack-store.json', { autoSave: 100 });

// 写入
await store.set('projects', [...]);
await store.set('selectedProjectId', 'some-id');

// 读取（泛型，返回 undefined 如果 key 不存在）
const projects = await store.get<ProjectItem[]>('projects');
const selectedId = await store.get<string>('selectedProjectId');

// 检查 key 是否存在
const has = await store.has('projects'); // true/false

// 删除 key
await store.delete('selectedProjectId');

// 获取所有 entries
const entries = await store.entries();

// 可选：手动立即保存（通常不需要，autoSave 会处理）
await store.save();
```

### useProject Hook 完整重构骨架

```typescript
// src/hooks/useProject.ts — Phase 2 重构版
import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export interface ProjectItem {
  id: string;       // 规范化路径作为 ID
  name: string;     // 文件夹名
  path: string;     // 原始完整路径
  addedAt: number;  // Date.now()
}

const STORE_PATH = 'easypack-store.json';
const PROJECTS_KEY = 'projects';
const SELECTED_KEY = 'selectedProjectId';

function generateProjectId(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).join('/').toLowerCase();
}

export function useProject() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  // 当前选中项目（派生状态）
  const currentProject = selectedId
    ? projects.find(p => p.id === selectedId) ?? null
    : null;

  // 初始化加载
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const s = await load(STORE_PATH, { autoSave: 100 });
        const savedProjects = await s.get<ProjectItem[]>(PROJECTS_KEY);
        const savedSelectedId = await s.get<string>(SELECTED_KEY);
        if (mounted) {
          if (savedProjects) setProjects(savedProjects);
          if (savedSelectedId) setSelectedId(savedSelectedId);
          setStore(s);
          setLoading(false);
        }
      } catch (error) {
        console.error("Store 加载失败:", error);
        if (mounted) setLoading(false);
        // 降级：即使 store 失败，应用仍可正常运行（数据不持久化）
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  // 添加项目（含重复检测）
  const addProject = useCallback(async (path: string, name: string) => {
    const id = generateProjectId(path);
    if (projects.some(p => p.id === id)) {
      toast.error("项目已存在"); // D-04
      return;
    }
    const newItem: ProjectItem = { id, name, path, addedAt: Date.now() };
    const updated = [...projects, newItem];
    setProjects(updated);
    setSelectedId(id);
    await store?.set(PROJECTS_KEY, updated);
    await store?.set(SELECTED_KEY, id);
  }, [projects, store]);

  // 删除项目（D-10: 自动选中邻近）
  const removeProject = useCallback(async (id: string) => {
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return;
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);

    // D-10: 自动选中邻近
    let newSelectedId: string | null = null;
    if (updated.length > 0) {
      if (id === selectedId) {
        newSelectedId = updated[Math.min(idx, updated.length - 1)].id;
      } else {
        newSelectedId = selectedId;
      }
    }
    setSelectedId(newSelectedId);
    await store?.set(PROJECTS_KEY, updated);
    await store?.set(SELECTED_KEY, newSelectedId);
  }, [projects, selectedId, store]);

  // 选中项目
  const selectProject = useCallback(async (id: string) => {
    setSelectedId(id);
    await store?.set(SELECTED_KEY, id);
  }, [store]);

  // 文件夹选择（沿用 Phase 1 selectFolder 逻辑）
  const selectFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "选择项目文件夹" });
      if (typeof selected === "string") {
        const name = selected.split(/[\\/]/).filter(Boolean).pop() || selected;
        await addProject(selected, name);
      }
    } catch (error) {
      console.error("文件夹选择失败:", error);
    }
  }, [addProject]);

  // 命令执行（沿用 Phase 1 逻辑）
  const executeCommand = useCallback(async (shellCommand: string) => {
    if (!currentProject) return;
    try {
      await invoke("execute_command", {
        projectPath: currentProject.path,
        shellCommand,
      });
      toast.success(`已执行: ${shellCommand}`);
    } catch (error) {
      toast.error(`命令执行失败：${error}。请检查项目路径和命令是否正确。`);
    }
  }, [currentProject]);

  return {
    projects, selectedId, currentProject, loading,
    addProject, removeProject, selectProject, selectFolder, executeCommand,
  };
}
```

### App.tsx Props 传递更新

```tsx
// App.tsx — Phase 2 更新
function App() {
  const {
    projects, selectedId, currentProject, loading,
    selectFolder, selectProject, removeProject, executeCommand,
  } = useProject();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        onAddProject={selectFolder}
        onSelectProject={selectProject}
        onRemoveProject={removeProject}
      />
      <MainArea currentProject={currentProject} onExecute={executeCommand} />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 store (同步 API) | Tauri v2 store (全异步 API) | Tauri 2.0 (2024) | 所有操作必须 await，需处理加载状态 |
| `new Store()` 构造函数 | `load()` 工厂函数或 `LazyStore` 类 | plugin-store 2.x | 推荐使用 `load()` 函数 |
| 手动 `store.save()` | `autoSave` 选项（默认 100ms 防抖） | plugin-store 2.x | 减少样板代码，自动持久化 |

**Deprecated/outdated:**
- `new Store('path.json')` 构造函数：v2 中应使用 `load()` 或 `Store.load()` 静态方法
- 同步 store API：v2 全部改为异步

## Open Questions

1. **Store 文件路径是否需要考虑多窗口场景**
   - What we know: 本项目只有一个主窗口（tauri.conf.json 中只有一个 window 配置）
   - Recommendation: 使用默认的 `app_data_dir` 下的相对路径即可，无需特殊处理

2. **Store 加载失败时的降级策略**
   - What we know: CONTEXT.md 将降级处理列为 Claude's Discretion
   - Recommendation: 降级为内存模式（仅 useState），不显示错误 toast，仅在 console.warn。下次正常启动时 store 会重新创建

3. **极大量项目时的性能**
   - What we know: 个人工具，项目数量通常 < 50
   - Recommendation: 不需要虚拟滚动，ScrollArea 足够。如果未来项目 > 100 再考虑优化

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @tauri-apps/plugin-store (npm) | 数据持久化 | 需安装 | 2.4.2 | 无 |
| tauri-plugin-store (crate) | Rust 端注册 | 需安装 | 2.4.2 | 无 |
| pnpm/npm | 包管理 | 已安装 | - | npm (package.json 已存在) |
| Rust toolchain | Tauri 后端 | 已安装 | 1.77.2+ | 无 |

**Missing dependencies with no fallback:**
- `@tauri-apps/plugin-store` npm 包 — 需在 Wave 0 安装
- `tauri-plugin-store` Rust crate — 需在 Wave 0 安装
- `store:default` capability 权限 — 需在 Wave 0 添加

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (前端) + Rust #[test] (后端) |
| Config file | 无 — Wave 0 需创建 `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && cd src-tauri && cargo test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-02 | 侧边栏显示多个项目名称 | unit | `npx vitest run src/components/__tests__/sidebar.test.tsx` | Wave 0 |
| PROJ-03 | 点击项目选中 + 视觉反馈 | unit | `npx vitest run src/components/__tests__/sidebar.test.tsx` | Wave 0 |
| PROJ-04 | 删除项目 + 自动选中邻近 | unit | `npx vitest run src/hooks/__tests__/useProject.test.ts` | Wave 0 |
| DATA-01 | 项目列表重启后恢复 | integration | `npx vitest run src/hooks/__tests__/useProject.test.ts` | Wave 0 |
| DATA-03 | 选中状态持久化 | integration | `npx vitest run src/hooks/__tests__/useProject.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && cd src-tauri && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest 配置文件
- [ ] `src/hooks/__tests__/useProject.test.ts` — useProject hook 多项目 + store 测试
- [ ] `src/components/__tests__/sidebar.test.tsx` — Sidebar 多项目渲染测试
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom` — 前端测试框架

## Sources

### Primary (HIGH confidence)
- [tauri-plugin-store 官方文档](https://v2.tauri.app/plugin/store/) — 安装、配置、API 用法、权限表
- [tauri-plugin-store JavaScript API 参考](https://v2.tauri.app/reference/javascript/store/) — Store/LazyStore 完整 API 文档
- [tauri-plugin-store GitHub 仓库](https://github.com/tauri-apps/tauri-plugin-store) — 源码和 issue
- npm registry — `@tauri-apps/plugin-store` 2.4.2 版本验证
- crates.io — `tauri-plugin-store` 2.4.2 版本验证

### Secondary (MEDIUM confidence)
- Phase 1 代码审查 — `useProject.ts`, `Sidebar.tsx`, `App.tsx`, `lib.rs`, `Cargo.toml`, `capabilities/default.json` 确认当前状态

### Tertiary (LOW confidence)
- 无低置信度来源

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tauri-plugin-store 官方文档详尽，版本已通过 npm/crates registry 验证
- Architecture: HIGH — 数据 schema 基于 store API 设计，React hook 模式为标准 React 实践
- Pitfalls: HIGH — 基于官方文档和 Tauri 2 已知特性（异步 API、capabilities 权限系统、Windows 路径问题）

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable — Tauri 2 生态成熟，预计 30 天内无重大变更)
