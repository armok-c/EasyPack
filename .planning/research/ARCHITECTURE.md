# Architecture Patterns -- v1.2 Integration Research

**Domain:** EasyPack v1.2 -- Tauri 2 + React 19 Windows Desktop Project Launcher
**Researched:** 2026-04-26
**Focus:** Integration of keyboard shortcuts, system tray, floating mini window, and edge drawer into existing v1.1 architecture
**Overall Confidence:** HIGH

## Current Architecture (v1.1 Baseline)

EasyPack v1.1 采用 Tauri 2.x 经典分层架构。Rust 后端负责系统级操作，React 前端负责 UI 渲染和状态管理，通过 `invoke()` / `#[tauri::command]` 桥接。

```
+----------------------------------------------------------+
|                    Tauri Application                       |
|                                                           |
|  +---------------------+     +-------------------------+  |
|  |   React Frontend    |     |   Rust Backend           |  |
|  |   (src/)            |     |   (src-tauri/src/)       |  |
|  |                     |     |                         |  |
|  |  App.tsx            |     |  lib.rs (builder)       |  |
|  |    |-- TitleBar     |     |  commands/mod.rs        |  |
|  |    |-- Sidebar      |     |  commands/shell.rs      |  |
|  |    |-- MainArea     |     |    - execute_command    |  |
|  |         |-- CommandCard   |    - open_folder        |  |
|  |         |-- CommandDialog |  commands/project_info.rs|  |
|  |         |-- PresetSelector|    - scan_project_icons  |  |
|  |                     |     |    - get_project_info    |  |
|  |  hooks/useProject.ts|     |                         |  |
|  |  hooks/useKeyboard.ts|    |                         |  |
|  |  lib/types.ts       |     |                         |  |
|  |  lib/presets.ts     |     |                         |  |
|  |  lib/icons.ts       |     |                         |  |
|  +---------------------+     +-------------------------+  |
|          |          ^                  |                   |
|          | invoke() |                  | spawn()           |
|          v          |                  v                   |
|  +---------------------+     +-------------------------+  |
|  |  tauri-plugin-store  |     |  Windows System Shell    |  |
|  |  (JSON persistence)  |     |  cmd.exe / wt.exe        |  |
|  +---------------------+     +-------------------------+  |
+----------------------------------------------------------+
```

### Existing Component Boundaries

| Component | File(s) | Responsibility |
|-----------|---------|---------------|
| `App.tsx` | `src/App.tsx` | Root layout: TitleBar + flex row (Sidebar + MainArea), zone management |
| `TitleBar` | `src/components/TitleBar.tsx` | Custom frameless window title bar with drag, min/max/close |
| `Sidebar` | `src/components/Sidebar.tsx` | Project list, add/remove, drag reorder, context menu settings |
| `MainArea` | `src/components/MainArea.tsx` | Project info, command grid, mode switch, edit mode, keyboard nav |
| `CommandCard` | `src/components/CommandCard.tsx` | Single command button with flash feedback |
| `CommandDialog` | `src/components/CommandDialog.tsx` | Add/edit custom command modal |
| `PresetSelector` | in `MainArea.tsx` | Dual dropdown for preset command selection |
| `ProjectSettingsDialog` | `src/components/ProjectSettingsDialog.tsx` | Icon + color picker modal |
| `useProject` hook | `src/hooks/useProject.ts` | All state: projects, commands, CRUD, store sync, execute |
| `useKeyboard` hook | `src/hooks/useKeyboard.ts` | Browser-level number key shortcuts (1-9) |
| `execute_command` | `src-tauri/src/commands/shell.rs` | Build cmd string, spawn wt.exe/cmd.exe with `.current_dir()` |
| `lib.rs` | `src-tauri/src/lib.rs` | Tauri builder, plugin registration (dialog, store), command handlers |

### Existing Data Models

```typescript
// src/lib/types.ts
interface CommandItem {
  id: string;          // crypto.randomUUID() or "preset-{name}"
  name: string;        // Display name
  command: string;     // Shell command string
  icon: string;        // Lucide icon name string
  type: "preset" | "custom";
  scope: "global" | "project";
  addedAt: number;     // Timestamp for ordering
}

// src/hooks/useProject.ts
interface ProjectItem {
  id: string;          // Normalized path (lowercase, forward slashes)
  name: string;        // Folder name
  path: string;        // Original full path (preserves casing)
  addedAt: number;     // Date.now()
  icon?: string;       // Lucide icon name
  color?: string;      // CSS hex color
}

interface ProjectInfoResult {
  size: string;         // Human-readable, e.g. "12.3 MB"
  branch: string | null; // null = not a Git repo
}
```

### Store Structure (easypack-store.json)

```
projects: ProjectItem[]                     // All projects
selectedProjectId: string | null            // Currently selected
customCommands: CommandItem[]               // Global custom commands
projectCommands:{normalizedId}: CommandItem[] // Per-project overrides
```

### Key Tauri Configuration (v1.1)

```json
// tauri.conf.json -- single window, frameless, shadow
{
  "app": {
    "windows": [{
      "label": "main",
      "width": 720, "height": 480,
      "minWidth": 600, "minHeight": 400,
      "decorations": false,
      "shadow": true
    }]
  }
}
```

```json
// capabilities/default.json -- minimal permissions
{
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-start-dragging",
    "dialog:default",
    "store:default"
  ]
}
```

## v1.2 Target Architecture

v1.2 将 EasyPack 从"点击执行"进化为"键盘驱动 + 随手可用"的桌面工具。四个新功能引入了多窗口、系统级快捷键、托盘驻留和边缘抽屉行为。架构变更的核心是：

1. **单窗口 -> 多窗口** -- 新增迷你悬浮窗 (floating window)
2. **应用内键盘 -> 系统级全局快捷键** -- 从 `window.addEventListener("keydown")` 升级到 `tauri-plugin-global-shortcut`
3. **单次关闭 -> 托盘驻留** -- 关闭窗口最小化到系统托盘
4. **固定窗口 -> 边缘吸附隐藏** -- 窗口可吸附到屏幕四边

```
+----------------------------------------------------------+
|                    Tauri Application                       |
|                                                           |
|  +--------------------+  +-----------------------------+  |
|  |  Main Window       |  |  Floating Mini Window       |  |
|  |  (label: "main")   |  |  (label: "floating")        |  |
|  |                    |  |                             |  |
|  |  TitleBar          |  |  MiniCommandGrid            |  |
|  |  Sidebar           |  |    (shows top 4-6 commands) |  |
|  |  MainArea          |  |                             |  |
|  |                    |  |                             |  |
|  +--------------------+  +-----------------------------+  |
|     |         ^                   |         ^              |
|     | emit()  | listen()          | emit()  | listen()     |
|     v         |                   v         |              |
|  +-------------------------------------------------------+|
|  |              Tauri Event Bus                           ||
|  |  "execute-command" | "project-changed" | "show-main"  ||
|  +-------------------------------------------------------+|
|                          |                                |
|  +-----------------------+-------------------------------+|
|  |  Rust Backend (src-tauri/src/)                        ||
|  |  lib.rs -- builder + setup closure                    ||
|  |    plugins: dialog, store, global-shortcut            ||
|  |    tray-icon feature + tray setup in .setup()         ||
|  |  commands/shell.rs -- execute_command, open_folder    ||
|  |  commands/project_info.rs -- scan, get_project_info   ||
|  +-------------------------------------------------------+|
|                          |                                |
|  +-----------+  +------------------+  +----------------+||
|  | System    |  | System Tray      |  | Win32 API      |||
|  | Terminal  |  | (tray-icon feat) |  | (edge drawer)  |||
|  +-----------+  +------------------+  +----------------+||
+----------------------------------------------------------+
         |
         v
  +------------------+
  | Global Shortcuts  |  (tauri-plugin-global-shortcut)
  | Register: Cmd+1..9|
  | Register: Cmd+M   |  (show/hide mini window)
  +------------------+
```

## Feature Integration Analysis

### Feature 1: Global Keyboard Shortcuts for Commands

**Current state:** `useKeyboard.ts` 使用浏览器 `window.addEventListener("keydown")` 监听数字键 1-9，仅在应用窗口聚焦时有效。有多层防护（输入框焦点、编辑模式、Radix 弹窗打开时不触发）。

**Problem:** 用户需求是"选中项目后按快捷键直接在终端执行命令"。这要求快捷键在应用不聚焦时也能工作。当前方案无法满足。

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Config | `src-tauri/Cargo.toml` | **ADD** `tauri-plugin-global-shortcut = "2"` |
| Config | `src-tauri/src/lib.rs` | **MODIFY** register plugin, add setup for shortcuts |
| Config | `src-tauri/capabilities/default.json` | **ADD** global-shortcut permissions |
| npm | `package.json` | **ADD** `@tauri-apps/plugin-global-shortcut` |
| React | `src/lib/types.ts` | **MODIFY** add `shortcut` field to CommandItem |
| React | New: `src/hooks/useGlobalShortcut.ts` | **NEW** hook for global shortcut registration |
| React | `src/hooks/useProject.ts` | **MODIFY** persist shortcut bindings in store |
| React | `src/components/CommandDialog.tsx` | **MODIFY** add shortcut recording UI |
| React | `src/components/CommandCard.tsx` | **MODIFY** show shortcut badge on card |
| React | `src/hooks/useKeyboard.ts` | **DEPRECATE** replaced by global shortcut system |

**Architecture approach:**

The global shortcut system replaces the browser-level keyboard hook. Each command can be assigned a shortcut (e.g., `Ctrl+Alt+G`, `Ctrl+Shift+1`). When pressed, the shortcut triggers `executeCommand` with the currently selected project and the bound command.

Data model extension:
```typescript
// types.ts -- add optional shortcut field
interface CommandItem {
  // ... existing fields ...
  shortcut?: string;  // Tauri shortcut string, e.g. "CommandOrControl+Alt+G"
}
```

The `useGlobalShortcut` hook manages the lifecycle:
```typescript
function useGlobalShortcut(
  commands: CommandItem[],
  currentProject: ProjectItem | null,
  onExecute: (command: string) => void
) {
  // On commands/project change:
  // 1. Unregister all previous shortcuts
  // 2. Filter commands with shortcut bindings
  // 3. Register each shortcut with the plugin
  // 4. On key press: call onExecute(cmd.command)
}
```

**Critical design decision:** Keep `useKeyboard.ts` for number-key shortcuts (1-9) as a fallback for when the app is focused. The global shortcut plugin handles user-defined shortcuts that work even when the app is not focused. Both systems coexist -- `useKeyboard` for quick in-app number keys, `useGlobalShortcut` for system-wide custom hotkeys.

Actually, reconsidering: maintaining two keyboard systems adds complexity. The cleaner approach is to register the number keys (1-9) as global shortcuts too, so they work regardless of focus. This simplifies the code by removing `useKeyboard.ts` entirely. However, this would mean number keys 1-9 are ALWAYS captured globally, which is too aggressive for a personal tool. **Recommendation: keep `useKeyboard.ts` for in-app number keys, use global shortcuts only for user-assigned hotkeys.**

**Shortcut conflict resolution:** When registering a global shortcut that conflicts with a system shortcut or another app's shortcut, the `register()` call will fail. The hook must handle this gracefully with a toast notification: "快捷键 Ctrl+Alt+G 已被其他程序占用".

**Required permissions:**
```json
"global-shortcut:allow-register",
"global-shortcut:allow-unregister",
"global-shortcut:allow-is-registered"
```

**Integration points:**
- `useProject` hook: `addCommand` / `updateCommand` must persist the `shortcut` field
- Store: new shortcut bindings saved alongside command data
- `execute_command` Rust command: unchanged -- the shortcut hook calls the same `executeCommand` flow

---

### Feature 2: System Tray

**Current state:** Window close button (`TitleBar.tsx` `handleClose`) calls `appWindow.close()`, which destroys the window and exits the app. No tray icon exists.

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Config | `src-tauri/Cargo.toml` | **MODIFY** add `"tray-icon"` to tauri features |
| Config | `src-tauri/src/lib.rs` | **MODIFY** add tray setup in `.setup()` closure |
| Config | `src-tauri/tauri.conf.json` | **ADD** `trayIcon` config block |
| Config | `src-tauri/capabilities/default.json` | **ADD** tray permissions |
| React | `src/components/TitleBar.tsx` | **MODIFY** close button -> hide to tray |
| React | `src/App.tsx` | **MODIFY** init tray on mount |

**Architecture approach:**

System tray is a built-in Tauri 2 feature (not a separate plugin). Requires the `tray-icon` feature flag on the `tauri` crate.

The tray has two integration points:

1. **Close -> Tray:** Instead of calling `appWindow.close()`, the close button should call `appWindow.hide()`. The window persists in memory, visible via the tray icon.

2. **Tray menu actions:** Right-click tray shows a context menu with:
   - "显示主窗口" -- shows and focuses the main window
   - "显示悬浮窗" -- toggles the mini floating window
   - separator
   - "退出" -- actually exits the app (`app.exit()`)

**Tray creation (in Rust `.setup()`):**

```rust
.use(|app| {
    // Tray setup goes here -- created once at app start
    // The tray icon persists for the entire app lifecycle
    Ok(())
})
```

However, Tauri 2's tray API is available from both Rust and JavaScript. Given that the tray menu actions need to interact with React state (show/hide windows, know which project is selected), creating the tray from **JavaScript** is more practical:

```typescript
// src/hooks/useTray.ts or in App.tsx
import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';

async function setupTray() {
  const showMain = await MenuItem.new({
    text: '显示主窗口',
    action: async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().show();
      await getCurrentWindow().setFocus();
    }
  });

  const quit = await MenuItem.new({
    text: '退出',
    action: async () => {
      const { exit } = await import('@tauri-apps/api/process');
      await exit(0);
    }
  });

  const menu = await Menu.new({ items: [showMain, quit] });

  const tray = await TrayIcon.new({
    id: 'main-tray',
    icon: 'icons/icon.png',  // Uses app icon
    tooltip: 'EasyPack',
    menu,
    menuOnLeftClick: false,
    action: async (event) => {
      if (event.type === 'click' && event.button === 'Left') {
        // Left-click tray -> show main window
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().show();
        await getCurrentWindow().setFocus();
      }
    }
  });
}
```

**Close behavior change:**

```typescript
// TitleBar.tsx -- change close handler
async function handleClose() {
  await appWindow.hide();  // Was: appWindow.close()
}
```

**Prevent actual close on window X:** Use `onCloseRequested` event to intercept the system close (Alt+F4):

```typescript
// App.tsx -- intercept window close
useEffect(() => {
  const unlisten = appWindow.onCloseRequested(async (event) => {
    event.preventDefault();  // Prevent actual close
    await appWindow.hide();  // Minimize to tray instead
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

**Required permissions:**
```json
"core:window:allow-show",
"core:window:allow-hide",
"core:window:allow-set-focus",
"core:window:allow-close",
"core:window:allow-on-close-requested"
```

**Required Cargo.toml change:**
```toml
# Before:
tauri = { version = "2", features = ["protocol-asset"] }
# After:
tauri = { version = "2", features = ["protocol-asset", "tray-icon"] }
```

**Required tauri.conf.json addition:**
```json
"trayIcon": {
  "iconPath": "icons/icon.png",
  "iconAsTemplate": false,
  "id": "main-tray",
  "tooltip": "EasyPack"
}
```

---

### Feature 3: Mini Floating Window

**Current state:** Single window application. No multi-window support.

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Config | `src-tauri/tauri.conf.json` | **ADD** floating window config |
| Config | `src-tauri/capabilities/default.json` | **ADD** window labels + permissions |
| React | New: `src/floating.tsx` | **NEW** floating window entry point |
| React | New: `src/components/FloatingCommandGrid.tsx` | **NEW** mini window content |
| React | New: `src/hooks/useFloatingWindow.ts` | **NEW** window management |
| React | `src/App.tsx` | **MODIFY** add floating window toggle |
| Vite | `index.html` | **ADD** floating window HTML entry |
| Vite | `vite.config.ts` | **MODIFY** multi-page build config |

**Architecture approach:**

The floating mini window is an independent Tauri webview window. It shows a compact grid of the most-used commands (top 4-6 from the current command list). Clicking a command in the floating window executes it against the currently selected project.

**Window configuration (tauri.conf.json):**
```json
{
  "label": "floating",
  "title": "EasyPack Mini",
  "url": "/floating.html",
  "width": 280,
  "height": 360,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "resizable": false,
  "decorations": false,
  "shadow": true,
  "visible": false,
  "parent": "main"
}
```

Key properties explained:
- `create: false` (not set) -- window is defined but can be created on demand via JS
- `visible: false` -- hidden by default, shown on user action
- `parent: "main"` -- floating window is a child of main, closes when main closes
- `alwaysOnTop: true` -- stays above other windows (essential for quick access)
- `skipTaskbar: true` -- does not appear in Windows taskbar

**Multi-page Vite config:**

The floating window needs its own HTML entry point and React root. This requires Vite's multi-page build:

```typescript
// vite.config.ts -- add floating entry
build: {
  rollupOptions: {
    input: {
      main: path.resolve(__dirname, 'index.html'),
      floating: path.resolve(__dirname, 'floating.html'),
    }
  }
}
```

```
// floating.html
<div id="floating-root"></div>
<script type="module" src="/src/floating.tsx"></script>
```

```typescript
// src/floating.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingCommandGrid } from '@/components/FloatingCommandGrid';
import './index.css';

createRoot(document.getElementById('floating-root')!).render(
  <React.StrictMode>
    <FloatingCommandGrid />
  </React.StrictMode>
);
```

**Inter-window communication:**

The floating window needs to know:
1. Which project is currently selected (to show project name)
2. What commands are available (to render command buttons)
3. How to execute a command (to call `execute_command`)

Three approaches:

**Approach A (Recommended): Shared Rust state via Tauri events.**
The main window emits state changes. The floating window listens.

```
Main Window                           Floating Window
    |                                      |
    |--- emit("project-changed", {id,name,path}) --->|
    |--- emit("commands-updated", [...commands]) --->|
    |                                      |
    |<--- emit("execute-command", {cmd}) ------------|
```

```typescript
// Main window (App.tsx or useProject.ts)
import { emit } from '@tauri-apps/api/event';

// On project change:
emit('project-changed', { id, name, path });

// On commands change:
emit('commands-updated', commands);

// Listen for execution requests from floating window:
listen('execute-command', (event) => {
  executeCommand(event.payload.command);
});
```

```typescript
// Floating window (FloatingCommandGrid.tsx)
import { listen, emit } from '@tauri-apps/api/event';

// Listen for state updates:
listen('project-changed', (event) => {
  setCurrentProject(event.payload);
});
listen('commands-updated', (event) => {
  setCommands(event.payload);
});

// Execute command via main window:
emit('execute-command', { command: cmd.command });
```

**Why events over direct invoke():** The floating window CAN call `invoke("execute_command", ...)` directly since the Rust command is registered globally. However, using events allows the main window to:
- Show the success toast
- Update any state that depends on execution
- Maintain a single point of control for execution logic

Actually, the simpler approach is: **the floating window calls `invoke("execute_command", ...)` directly**. It has access to the project path (received via event) and the shell command. The toast notification is less important for the floating window since the user can see the terminal window open.

**Recommended hybrid:** Floating window calls `invoke` directly for command execution, but listens to events for state synchronization (project selection, command list).

**Window lifecycle management (`useFloatingWindow.ts`):**

```typescript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export function useFloatingWindow() {
  const [isOpen, setIsOpen] = useState(false);
  const floatingRef = useRef<WebviewWindow | null>(null);

  const toggle = useCallback(async () => {
    if (isOpen && floatingRef.current) {
      await floatingRef.current.hide();
      setIsOpen(false);
    } else {
      // Create or show
      if (!floatingRef.current) {
        floatingRef.current = new WebviewWindow('floating', {
          url: '/floating.html',
          width: 280,
          height: 360,
          alwaysOnTop: true,
          skipTaskbar: true,
          decorations: false,
          shadow: true,
          parent: 'main',
        });
        // Wait for window to be ready
        await floatingRef.current.once('tauri://created', () => {});
      }
      await floatingRef.current.show();
      await floatingRef.current.setFocus();
      setIsOpen(true);
    }
  }, [isOpen]);

  return { isOpen, toggle };
}
```

**Required permissions:**
```json
"core:window:allow-create",
"core:window:allow-show",
"core:window:allow-hide",
"core:window:allow-set-focus",
"core:window:allow-set-always-on-top",
"core:window:allow-close",
"core:webview:allow-create-webview-window"
```

**Capabilities scope:** The `"windows"` array in `capabilities/default.json` must include `"floating"`:
```json
{
  "windows": ["main", "floating"],
  "permissions": [ /* ... all permissions ... */ ]
}
```

---

### Feature 4: Edge Drawer

**Current state:** Window is a standard free-floating desktop window with no edge behavior.

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Rust | `src-tauri/Cargo.toml` | **POSSIBLY ADD** `windows` crate for mouse hook |
| Rust | New: `src-tauri/src/commands/drawer.rs` | **NEW** edge detection and mouse hook commands |
| Rust | `src-tauri/src/lib.rs` | **MODIFY** register drawer commands |
| React | New: `src/hooks/useEdgeDrawer.ts` | **NEW** edge snap + auto-hide logic |
| React | `src/App.tsx` | **MODIFY** integrate drawer hook |

**Architecture approach:**

Edge drawer has NO native Tauri support. It must be implemented from scratch using the Tauri Window API for position/size manipulation and Win32 API for mouse position detection when the window is hidden.

**Core mechanism:**

1. **Snap detection:** When the window is dragged near a screen edge (< 20px), snap it to the edge
2. **Auto-hide:** After snapping, animate the window off-screen, leaving a 2-4px sliver visible
3. **Auto-reveal:** When the mouse cursor touches the edge sliver, slide the window back in
4. **Auto-hide again:** When the mouse leaves the window area (with a 300ms delay), slide it back out

**The fundamental problem:** When a window is hidden (moved off-screen), it receives NO mouse events. The WebView cannot detect the mouse cursor approaching the edge. This requires either:

**Option A: Win32 `WH_MOUSE_LL` low-level mouse hook** (via `windows` crate)
- Pros: Detects mouse position anywhere on screen, works when window is hidden
- Cons: Requires unsafe FFI, `windows` crate adds ~2MB to binary, needs a background thread running the hook
- Implementation: Rust command starts a background thread that runs `SetWindowsHookEx(WH_MOUSE_LL, callback, ...)`. When mouse position is within 4px of the drawer edge, emit a Tauri event to show the window.

**Option B: Thin sliver window always visible**
- Keep the main window at its full size but shift it off-screen so only a 2-4px strip is visible
- The visible strip still receives mouse enter/leave events
- Pros: No Win32 API needed, pure Tauri Window API
- Cons: The "hidden" window is still technically visible (2px strip), may trigger taskbar thumbnail, some Windows versions may behave differently with near-off-screen windows

**Option C: Timer-based polling** (not recommended)
- Use `setInterval` to check mouse position via Tauri API
- Cons: Polling is wasteful, may have latency, Tauri doesn't expose global mouse position

**Recommendation: Option B (thin sliver window)** for v1.2 MVP. This avoids the complexity of the `windows` crate and Win32 FFI. The 2-4px strip is barely visible on modern high-DPI displays.

**Edge detection algorithm:**

```typescript
// src/hooks/useEdgeDrawer.ts
function useEdgeDrawer() {
  const appWindow = getCurrentWindow();
  const [drawerState, setDrawerState] = useState<'free' | 'docked' | 'hidden'>('free');
  const [edge, setEdge] = useState<'left' | 'right' | 'top' | null>(null);

  // Monitor window position for edge proximity
  useEffect(() => {
    const unlisten = appWindow.onMoved(async ({ payload: position }) => {
      const monitor = await appWindow.currentMonitor();
      if (!monitor) return;

      const { size } = monitor;
      const threshold = 20; // px from edge to trigger snap

      // Check proximity to each edge
      if (position.x <= threshold) setEdge('left');
      else if (position.x + window.outerWidth >= size.width - threshold) setEdge('right');
      else if (position.y <= threshold) setEdge('top');
      else setEdge(null);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // When edge is detected and user releases drag -> dock and hide
  const dockAndHide = useCallback(async () => {
    if (!edge) return;
    setDrawerState('docked');

    const monitor = await appWindow.currentMonitor();
    if (!monitor) return;

    // Move window off-screen, leaving 2px strip
    switch (edge) {
      case 'left':
        await appWindow.setPosition(new LogicalPosition(-window.outerWidth + 2, 0));
        break;
      case 'right':
        await appWindow.setPosition(new LogicalPosition(monitor.size.width - 2, 0));
        break;
      case 'top':
        await appWindow.setPosition(new LogicalPosition(0, -window.outerHeight + 2));
        break;
    }

    setDrawerState('hidden');
  }, [edge]);

  // When mouse enters the 2px strip -> reveal
  const reveal = useCallback(async () => {
    if (drawerState !== 'hidden') return;
    // Slide window back to edge
    switch (edge) {
      case 'left':
        await appWindow.setPosition(new LogicalPosition(0, 0));
        break;
      case 'right':
        await appWindow.setPosition(new LogicalPosition(
          monitor.size.width - window.outerWidth, 0
        ));
        break;
      case 'top':
        await appWindow.setPosition(new LogicalPosition(0, 0));
        break;
    }
  }, [drawerState, edge]);

  return { drawerState, edge, dockAndHide, reveal };
}
```

**Required permissions:**
```json
"core:window:allow-set-position",
"core:window:allow-set-size",
"core:window:allow-inner-position",
"core:window:allow-inner-size",
"core:window:allow-outer-position",
"core:window:allow-outer-size",
"core:window:allow-is-visible",
"core:window:allow-current-monitor",
"core:window:allow-available-monitors",
"core:window:allow-on-moved"
```

**State persistence:** The drawer state (docked edge, hidden/revealed) should be persisted via `tauri-plugin-store` so it survives app restart. Store keys:
```
drawerEdge: "left" | "right" | "top" | null
drawerState: "free" | "docked" | "hidden"
drawerPosition: { x: number, y: number }
```

---

## Component Boundaries After v1.2

| Component | File(s) | Responsibility | Communicates With |
|-----------|---------|---------------|-------------------|
| `App.tsx` | `src/App.tsx` | Root layout, tray init, floating window toggle, edge drawer integration | TitleBar, Sidebar, MainArea, useTray, useFloatingWindow, useEdgeDrawer |
| `TitleBar` | `src/components/TitleBar.tsx` | Custom title bar, close -> hide to tray | useTray (indirect), appWindow.hide() |
| `FloatingCommandGrid` | `src/components/FloatingCommandGrid.tsx` | Mini floating window content -- compact command buttons | Tauri events (listen for state, emit for execution) |
| `useTray` | `src/hooks/useTray.ts` | System tray setup, menu actions, left-click show | TrayIcon API, Menu API |
| `useGlobalShortcut` | `src/hooks/useGlobalShortcut.ts` | Register/unregister system-wide shortcuts | global-shortcut plugin, useProject.executeCommand |
| `useFloatingWindow` | `src/hooks/useFloatingWindow.ts` | Create/show/hide floating window | WebviewWindow API, Tauri events |
| `useEdgeDrawer` | `src/hooks/useEdgeDrawer.ts` | Edge snap detection, auto-hide, auto-reveal | Window position API, monitor info API |
| `useKeyboard` | `src/hooks/useKeyboard.ts` | In-app number key shortcuts (1-9) -- unchanged | commands, currentProject, executeCommand |
| `useProject` | `src/hooks/useProject.ts` | All state management -- add shortcut persistence | Store, Tauri events (emit state changes) |

## Data Flow Changes

### Current Data Flow (v1.1)

```
User click on CommandCard
  -> MainArea.onExecute(cmd.command)
    -> useProject.executeCommand(shellCommand)
      -> invoke("execute_command", { projectPath, shellCommand })
        -> Rust: std::process::Command spawn wt.exe/cmd.exe
```

### New Data Flow (v1.2) -- Three Execution Paths

**Path A: Main Window Click (unchanged)**
```
User click CommandCard
  -> MainArea.onExecute(cmd.command)
    -> useProject.executeCommand(shellCommand)
      -> invoke("execute_command", { projectPath, shellCommand })
```

**Path B: Global Shortcut**
```
User presses Ctrl+Alt+G (registered shortcut)
  -> useGlobalShortcut.onKeyPress
    -> find command by shortcut binding
    -> useProject.executeCommand(cmd.command)
      -> invoke("execute_command", { projectPath, shellCommand })
```

**Path C: Floating Mini Window**
```
User clicks command button in floating window
  -> FloatingCommandGrid.onExecute(cmd.command)
    -> invoke("execute_command", { projectPath, shellCommand })
  OR
    -> emit("execute-command", { command })
      -> Main window listens -> useProject.executeCommand(cmd.command)
```

### State Synchronization Flow

```
Main Window                             Floating Window
    |                                        |
    |-- emit("project-changed") ----------->|  update displayed project
    |-- emit("commands-updated") ---------->|  update command grid
    |-- emit("shortcuts-changed") --------->|  update shortcut display
    |                                        |
    |<-- invoke("execute_command") ---------|  direct Rust call (recommended)
    |                                        |
    |-- emit("drawer-state-changed") ------>|  (floating window may need to
    |                                        |   know if main is in drawer mode)
```

## File Change Summary

### New Files

| File | Purpose | Feature |
|------|---------|---------|
| `src/hooks/useGlobalShortcut.ts` | System-wide shortcut registration | Shortcuts |
| `src/hooks/useTray.ts` | System tray setup and menu | Tray |
| `src/hooks/useFloatingWindow.ts` | Floating window lifecycle | Floating |
| `src/hooks/useEdgeDrawer.ts` | Edge snap + auto-hide logic | Drawer |
| `src/floating.tsx` | Floating window React entry point | Floating |
| `src/floating.html` | Floating window HTML entry | Floating |
| `src/components/FloatingCommandGrid.tsx` | Mini window command buttons | Floating |

### Modified Files

| File | Changes | Feature(s) |
|------|---------|------------|
| `src-tauri/Cargo.toml` | Add `tauri-plugin-global-shortcut`, add `tray-icon` feature | Shortcuts, Tray |
| `src-tauri/src/lib.rs` | Register global-shortcut plugin, add `.setup()` for tray | Shortcuts, Tray |
| `src-tauri/tauri.conf.json` | Add `trayIcon` config, add floating window config | Tray, Floating |
| `src-tauri/capabilities/default.json` | Add all new permissions, add "floating" to windows array | All |
| `src/App.tsx` | Add tray init, floating window toggle, edge drawer integration, state event emission | All |
| `src/components/TitleBar.tsx` | Close button -> hide to tray | Tray |
| `src/components/CommandDialog.tsx` | Add shortcut recording UI field | Shortcuts |
| `src/components/CommandCard.tsx` | Show shortcut key badge | Shortcuts |
| `src/hooks/useProject.ts` | Persist shortcut bindings, emit state change events | Shortcuts, Floating |
| `src/hooks/useKeyboard.ts` | Keep as-is (in-app number keys) or remove if global shortcuts absorb | Shortcuts |
| `src/lib/types.ts` | Add `shortcut?: string` to CommandItem | Shortcuts |
| `vite.config.ts` | Add multi-page build config for floating window | Floating |

## Suggested Build Order

Based on dependency analysis -- features that others depend on should be built first:

```
Phase 1: Global Shortcuts (FOUNDATION)
  Feature 1: Keyboard shortcut registration
  |-- WHY FIRST: Replaces core interaction model, needs to be stable before
  |   floating window or tray menu can trigger command execution
  |-- Risk: MEDIUM (new plugin, capabilities config, data model change)
  |-- No dependency on other v1.2 features
  |-- Provides the execution trigger that tray and floating window will use

Phase 2: System Tray (INDEPENDENT)
  Feature 2: Tray icon + close-to-tray behavior
  |-- WHY SECOND: Independent of floating window, changes close behavior
  |   which affects edge drawer (hidden window vs tray-hidden window)
  |-- Risk: LOW (built-in Tauri feature, well-documented)
  |-- Depends on: Phase 1 (for tray menu "execute last command" option)
  |-- NOTE: Must resolve the close behavior BEFORE edge drawer
  |   because both features interact with window visibility

Phase 3: Floating Mini Window (DEPENDS ON TRAY)
  Feature 3: Independent mini window with command buttons
  |-- WHY THIRD: Depends on tray (floating window toggle in tray menu),
  |   depends on event system for state sync
  |-- Risk: MEDIUM (multi-window, multi-page Vite build, inter-window events)
  |-- Depends on: Phase 1 (shortcut system for floating window commands),
  |   Phase 2 (tray menu entry for floating window)

Phase 4: Edge Drawer (DEPENDS ON ALL ABOVE, MOST COMPLEX)
  Feature 4: Edge snap, auto-hide, auto-reveal
  |-- WHY LAST: Most complex, depends on all window management features
  |   being stable. Interacts with tray (tray also hides window) and
  |   floating window (main window hidden state affects floating)
  |-- Risk: HIGH (custom implementation, no Tauri native support,
  |   thin sliver approach may have edge cases on different Windows versions)
  |-- Depends on: Phase 2 (tray close behavior must be stable),
  |   Phase 3 (floating window must work when main is hidden)
```

**Dependency graph:**

```
Phase 1: Global Shortcuts
    |
    v
Phase 2: System Tray
    |         \
    v          \
Phase 3: Floating Window
    |          |
    v          v
Phase 4: Edge Drawer
```

## Patterns to Follow

### Pattern 1: Tauri Event-Based State Synchronization

**What:** Use Tauri's event system (`emit` / `listen`) to synchronize state between windows.

**When:** Multi-window applications where secondary windows need access to primary window state.

**Example:**
```typescript
// Main window -- emit state changes
import { emit } from '@tauri-apps/api/event';

// Whenever selected project changes:
useEffect(() => {
  if (currentProject) {
    emit('project-changed', { id: currentProject.id, name: currentProject.name, path: currentProject.path });
  }
}, [currentProject]);

// Whenever commands change:
useEffect(() => {
  emit('commands-updated', commands);
}, [commands]);
```

```typescript
// Floating window -- listen for state
import { listen } from '@tauri-apps/api/event';

const unlistenProject = await listen('project-changed', (event) => {
  setCurrentProject(event.payload);
});
const unlistenCommands = await listen('commands-updated', (event) => {
  setCommands(event.payload);
});
```

### Pattern 2: Window Lifecycle Management via Ref

**What:** Maintain a ref to created windows to avoid re-creating them on each show/hide toggle.

**When:** Managing secondary windows that are shown/hidden repeatedly.

**Example:**
```typescript
const windowRef = useRef<WebviewWindow | null>(null);

async function showFloating() {
  if (!windowRef.current) {
    windowRef.current = new WebviewWindow('floating', { /* config */ });
    windowRef.current.once('tauri://destroyed', () => {
      windowRef.current = null;
    });
  }
  await windowRef.current.show();
  await windowRef.current.setFocus();
}
```

### Pattern 3: Global Shortcut Registration Lifecycle

**What:** Register shortcuts when commands change, unregister on cleanup.

**When:** Using `tauri-plugin-global-shortcut` for dynamic shortcut bindings.

**Example:**
```typescript
useEffect(() => {
  const shortcuts = commands.filter(c => c.shortcut);

  // Unregister all, then register current set
  async function syncShortcuts() {
    await unregisterAll();
    for (const cmd of shortcuts) {
      if (cmd.shortcut) {
        await register(cmd.shortcut, (event) => {
          if (event.state === 'Pressed') {
            executeCommand(cmd.command);
          }
        });
      }
    }
  }

  syncShortcuts();
  return () => { unregisterAll(); };
}, [commands, executeCommand]);
```

### Pattern 4: Close-to-Tray Interception

**What:** Intercept window close events to hide instead of destroy.

**When:** System tray applications that should persist in the background.

**Example:**
```typescript
useEffect(() => {
  const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
    event.preventDefault();
    await getCurrentWindow().hide();
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct DOM Communication Between Windows

**What:** Trying to share React state between main and floating windows via localStorage or DOM APIs.

**Why bad:** Tauri windows have separate JavaScript contexts. localStorage writes from one window may not trigger storage events in another. The state gets out of sync.

**Instead:** Use Tauri's event system (`emit` / `listen`) which is designed for inter-window communication.

### Anti-Pattern 2: Registering Global Shortcuts That Conflict with System Keys

**What:** Registering shortcuts like `Ctrl+C`, `Alt+Tab`, `Win+D` as command hotkeys.

**Why bad:** These are system-reserved shortcuts. Registration may fail silently or override critical OS behavior.

**Instead:** Enforce a modifier combination policy. All user shortcuts must include at least two modifiers (e.g., `Ctrl+Alt+`, `Ctrl+Shift+`, `Win+Alt+`). Reject single-modifier shortcuts during assignment.

### Anti-Pattern 3: Creating Floating Window on Every Toggle

**What:** Calling `new WebviewWindow('floating', ...)` every time the user toggles the floating window.

**Why bad:** Creating a webview window is expensive (~100-200ms). Toggling should be near-instant.

**Instead:** Create the window once, then show/hide it. Store the reference in a ref or module-level variable.

### Anti-Pattern 4: Edge Drawer Using Tauri Window.hide()

**What:** Calling `appWindow.hide()` to "hide" the window in edge drawer mode.

**Why bad:** `hide()` removes the window from the screen entirely. The window receives no mouse events, so auto-reveal via mouse hover is impossible without a Win32 mouse hook.

**Instead:** Use `setPosition()` to move the window off-screen, leaving a 2-4px strip visible. The visible strip receives `onMouseEnter` events for auto-reveal.

### Anti-Pattern 5: Blocking the Main Thread with Edge Position Calculations

**What:** Running continuous `requestAnimationFrame` loops to check window position for edge detection.

**Why bad:** Wastes CPU cycles when the window is stationary.

**Instead:** Use Tauri's `onMoved` event listener to detect position changes only when the window is actually being moved.

## Scalability Considerations

| Concern | Current (10-50 shortcuts) | Growth (100+ shortcuts) | Mitigation |
|---------|--------------------------|------------------------|------------|
| Global shortcut registration | Instant | Registration is O(n) but fast | Cap max shortcuts at ~50 |
| Tray menu items | 3-5 items | Still manageable | Tray menus should stay concise |
| Floating window commands | 4-6 shown | Grid may need scrolling | Limit to 6-8 visible, add "more" link |
| Event bus messages | Low volume | Low volume | Events are lightweight, no concern |
| Edge drawer position tracking | On event only | No concern | Already event-driven |
| Multi-window memory | ~20MB for floating | ~20MB | Single floating window, no concern |
| Store JSON size (with shortcuts) | <200KB | Still manageable | Shortcuts are short strings |

## Critical Integration Risks

### Risk 1: Close-to-Tray Conflicts with Edge Drawer

Both the tray and edge drawer modify window visibility. The tray wants to hide the window entirely; the edge drawer wants to move it off-screen but keep it partially visible. These two features must coordinate:

**Resolution:** Edge drawer takes priority. If the window is in drawer-hidden state, the tray "show" action should first restore the window from the drawer, then show it. Add a state machine:

```
Window visibility states:
  VISIBLE -> (close button) -> TRAY_HIDDEN
  VISIBLE -> (edge snap) -> DRAWER_HIDDEN
  TRAY_HIDDEN -> (tray show) -> VISIBLE
  DRAWER_HIDDEN -> (mouse hover) -> VISIBLE
  DRAWER_HIDDEN -> (tray show) -> VISIBLE (force reveal from drawer)
  TRAY_HIDDEN -> (tray exit) -> APP_EXIT
```

### Risk 2: Floating Window Behavior When Main Window Is Hidden

When the main window is in tray-hidden or drawer-hidden state, the floating window should still be functional. The floating window calls `invoke("execute_command", ...)` directly, which works regardless of main window visibility. However, state synchronization events from the main window may stop if the main window's React tree is not processing events.

**Resolution:** Tauri events are processed by the Rust backend, not by the React frontend. Even if the main window is hidden, the event system continues to work. Verify this assumption during Phase 3 testing.

### Risk 3: Shortcut Conflicts with Windows Terminal

Users may have global shortcuts configured in Windows Terminal or other tools. When EasyPack registers a shortcut, it may conflict.

**Resolution:** The `register()` function returns an error on conflict. Display a clear message: "快捷键 {key} 注册失败，可能被其他程序占用". Allow the user to choose a different shortcut.

## Sources

- [Tauri v2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- official plugin docs, JS API, permissions -- HIGH confidence
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) -- built-in tray feature, `tray-icon` flag, Menu API -- HIGH confidence
- [Tauri v2 Window Configuration](https://v2.tauri.app/reference/config/) -- WindowConfig properties (alwaysOnTop, skipTaskbar, parent, create) -- HIGH confidence
- [Tauri v2 WebviewWindow API](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/) -- multi-window creation and management -- HIGH confidence
- [Tauri v2 Event System](https://v2.tauri.app/develop/calling-frontend/) -- emit, listen, emitTo for inter-window communication -- HIGH confidence
- [Tauri v2 Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) -- setPosition, setSize, show, hide, onCloseRequested -- HIGH confidence
- [Tauri v2 Window State Plugin](https://v2.tauri.app/plugin/window-state/) -- considered but rejected for edge drawer (custom position logic needed) -- HIGH confidence
- [Windows crate](https://crates.io/crates/windows) -- Win32 API bindings, considered for WH_MOUSE_LL hook -- HIGH confidence
- [Tauri v2 Multi-Window Pattern](https://v2.tauri.app/develop/calling-frontend/) -- inter-window communication patterns -- HIGH confidence

---
*Architecture research for: EasyPack v1.2 milestone -- keyboard shortcuts, system tray, floating mini window, edge drawer*
*Researched: 2026-04-26*
