# Feature Research: v1.2 Milestone

**Domain:** Windows desktop project launcher -- v1.2 keyboard-driven + tray + floating window + edge drawer
**Researched:** 2026-04-26
**Confidence:** HIGH
**Scope:** Only the 4 new features for v1.2. Existing v1.0/v1.1 features are documented in PROJECT.md.

## Executive Summary

v1.2 的核心目标是将 EasyPack 从"点击执行"进化为"键盘驱动 + 随手可用"的桌面工具。四个特性形成一个渐进增强链：快捷键绑定让用户无需鼠标即可执行指令；系统托盘让应用"常驻"而不占用任务栏；迷你悬浮窗提供轻量级的快速访问入口；边缘抽屉则实现主窗口的"呼之即来、挥之即去"。

四个特性的技术实现难度差异显著。快捷键和系统托盘有成熟的 Tauri 官方支持（global-shortcut 插件 + 内置 tray-icon feature），属于标准集成模式。迷你悬浮窗使用 Tauri 多窗口 API（WebviewWindowBuilder），也是官方支持的功能，但涉及窗口间通信和状态同步的设计决策。边缘抽屉是唯一没有现成方案的特性，需要从零实现屏幕边缘检测、窗口动画和鼠标钩子，技术风险最高。

**Tauri 2 API 验证结论（基于官方文档）：**
- `tauri-plugin-global-shortcut`：JS API 提供 `register(shortcut, callback)` / `unregister(shortcut)`，需要 capability permissions。Windows 完全支持。-- HIGH confidence
- System Tray：需要 `tauri = { features = ["tray-icon"] }`，JS API 提供 `TrayIcon.new(options)` + `Menu.new({items})`，支持 click/DoubleClick/Enter/Leave 事件。内置功能，不是插件。-- HIGH confidence
- Multi-window：`WebviewWindowBuilder` 提供 `always_on_top()`、`skip_taskbar()`、`parent()`、`transparent()`、`decorations(false)`。**Windows 上创建窗口必须用 async 命令，同步命令会死锁。** -- HIGH confidence
- Edge drawer：无官方支持，需自定义实现。-- MEDIUM confidence（技术方案基于 Tauri Window API + Win32 鼠标钩子）

---

## Table Stakes (Users Expect These)

Features users assume exist in a "keyboard-driven" desktop launcher. Missing = product does not deliver on the milestone promise.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| KB-01: Per-command keyboard shortcuts | The milestone title says "keyboard-driven." Without per-command hotkeys, the keyboard claim is empty. Users expect to press a key combo and have a command execute, like VS Code's keyboard shortcuts. | MEDIUM | Requires: `tauri-plugin-global-shortcut` (Rust crate + npm package), shortcut configuration UI in CommandDialog or CommandCard, shortcut storage in tauri-plugin-store, conflict detection logic | System-wide shortcuts work even when app is not focused. This is the defining feature of v1.2. The JS API provides `register(shortcut, callback)` and `unregister(shortcut)`. Key format: "CommandOrControl+Shift+G", "Alt+1", etc. Must handle: (1) shortcut assignment per command, (2) shortcut display on command card, (3) shortcut conflict warning, (4) unregister on command delete, (5) unregister on project switch (project-scoped shortcuts). **Permission required:** `global-shortcut:allow-register`, `global-shortcut:allow-unregister`, `global-shortcut:allow-is-registered` in capabilities. |
| TRAY-01: System tray icon with context menu | Every desktop tool that runs in the background has a tray icon. Users expect closing the window to minimize to tray, not quit. Right-click tray should show common actions. | LOW-MEDIUM | Requires: `"tray-icon"` feature flag in Cargo.toml, `TrayIcon` + `Menu` API from `@tauri-apps/api` (already installed), window close event interception | Built-in Tauri 2 feature (NOT a plugin). Add `"tray-icon"` to tauri features in Cargo.toml: `tauri = { version = "2", features = ["tray-icon"] }`. JS API: `TrayIcon.new(options)` with `menu`, `menuOnLeftClick`, `action` (event handler), `icon`, `tooltip`. Tray events: Click, DoubleClick, Enter, Leave, Move. Menu items support `id`, `text`, `action` (per-item click handler). Must intercept window close event (`onCloseRequested` + `event.preventDefault()` + `window.hide()`) and hide instead of quit. |

## Differentiators (Competitive Advantage)

Features that set EasyPack apart from basic command launchers and bring it closer to a power-user tool.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| FLOAT-01: Mini floating window | A compact always-on-top window showing only the most-used command buttons. Like a "remote control" for the selected project. Users who work in a terminal/editor full-screen can trigger commands without switching to EasyPack's main window. | HIGH | Requires: Tauri multi-window (WebviewWindow), inter-window communication via Tauri event system, floating window React app (separate route or component tree), shared state management | Uses `WebviewWindowBuilder` from Rust or `WebviewWindow` from `@tauri-apps/api/webviewWindow`. Window properties: `.always_on_top(true)`, `.skip_taskbar(true)`, `.parent(&main_window)`, `.decorations(false)`, `.inner_size(280.0, 200.0)`. **Critical: On Windows, window creation must happen in async commands or separate threads; synchronous creation causes deadlock.** Communication: main window emits events with current project + commands; floating window listens and renders buttons. Click on floating window button -> emit event back to main -> main executes command via Rust backend. Key design decisions: (1) Which commands appear in floating window? (2) Is the floating window always visible or toggleable? (3) How to handle project switching sync? |
| DRAWER-01: Edge drawer (snap to screen edges) | The main window can be dragged to any screen edge where it snaps and hides, showing only a thin strip. Mouse contact at the edge slides it out; mouse leaves and it slides back. Like a macOS Dock auto-hide but for the app window itself. This makes EasyPack "disappear" when not needed but be instantly accessible. | VERY HIGH | Requires: Custom implementation using Tauri Window API (setPosition, setSize, show, hide), likely Win32 mouse hook for edge detection when window is hidden, animation logic for slide in/out, screen edge detection, multi-monitor support | No built-in Tauri support. Must implement from scratch. Components: (1) Edge detection on window drag end -- detect which edge the window is closest to. (2) Snap animation -- move window to edge position. (3) Hide animation -- slide window off-screen, leaving 2-4px strip. (4) Mouse hook -- detect cursor at screen edge when window is hidden. (5) Show animation -- slide window back in. (6) Auto-hide timer -- hide after cursor leaves window for N seconds. (7) Multi-monitor -- handle edges per monitor. This is the highest-risk feature in v1.2. **Tauri Window API provides `setPosition`, `setSize`, `show`, `hide`, `setFocus` but NOT edge-snapping or mouse hooks. The `tauri-plugin-positioner` only supports preset positions (TopLeft, Center, etc.), not edge-relative positioning.** |

## Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Global shortcuts that conflict with system shortcuts | "Use Ctrl+C, Ctrl+V for commands" | System shortcuts (Ctrl+C copy, Alt+Tab switch, Win+E explorer) cannot be overridden without breaking OS behavior. Some combinations are reserved by Windows and cannot be registered at all. The Win32 `RegisterHotKey` API has a limited number of hotkey slots; registration can silently fail. | Require modifiers for custom shortcuts: recommend `Alt+<key>` or `Ctrl+Alt+<key>` patterns. Show clear warnings for conflicts. |
| Floating window with full command editing | "Let me manage everything from the mini window" | A mini window is meant for quick execution, not management. Adding CRUD UI to a 280px-wide window creates terrible UX. Keep the floating window as a read-only execution surface. | Floating window shows command buttons only. All management (add/edit/delete) stays in the main window. |
| Edge drawer on all four edges simultaneously | "Let it snap to any edge" | Managing snap state for 4 edges adds exponential complexity. Users typically use one or two edges (top or left). Multi-edge support also conflicts with Windows taskbar positioning. | Support all four edges but only one active snap at a time. Detect taskbar position and avoid overlapping edges. |
| Transparent/frosted glass floating window | "Looks cool with acrylic blur" | `transparent: true` + `decorations: false` on Tauri 2 has known rendering issues on Windows. WebView2 transparency support is inconsistent across Windows versions. Performance overhead for a utility tool. Per docs.rs: on Windows 7, alpha channel ignored for webview layer; on Windows 8+, non-zero alpha is ignored. | Solid background with opacity. Dark theme matching the main window. Functional over flashy. |
| Auto-show floating window on project switch | "Automatically keep floating window in sync" | Auto-updating the floating window on every project switch creates flicker and potential state races. The floating window should be deliberately opened/closed. | Floating window shows commands for the currently selected project. If project changes while floating window is open, it updates via event. But it does not auto-open. |
| Per-project different shortcut keybindings | "Each project has its own shortcut layout" | Managing different shortcut schemes per project creates massive complexity: conflict detection across schemes, re-registration on project switch, user confusion about which scheme is active. | Shortcuts are global across all projects. A shortcut triggers the command on the currently selected project. One scheme to learn. |
| Using Electron-style window animations | "Smooth CSS animations for slide-in/out" | Tauri windows are native OS windows, not DOM elements. CSS animations cannot move a window. Window position changes require calling the Tauri Window API from JS or Rust. Animations must be frame-by-frame position updates. | Use Rust-side timer loop (tokio::time::interval) to animate `setPosition` calls, or JS-side requestAnimationFrame with `setPosition` calls. Rust-side is smoother. |

## Feature Dependencies

```
TRAY-01 (system tray)
    |
    +-- BLOCKS: FLOAT-01, DRAWER-01 -- tray must exist before window can "hide to tray"
    |
    +--requires--> tauri Cargo.toml: features = ["tray-icon"]
    +--requires--> capabilities: core:window:allow-hide, core:window:allow-show, core:window:allow-set-focus
    +--requires--> Window close event interception (onCloseRequested)
    +--requires--> Menu/MenuItem from @tauri-apps/api (already installed)

KB-01 (keyboard shortcuts)
    |
    +--standalone--> Can be built independently of tray
    +--requires--> tauri-plugin-global-shortcut (Rust + npm)
    +--requires--> capabilities: global-shortcut:allow-register, global-shortcut:allow-unregister, global-shortcut:allow-is-registered
    +--requires--> Shortcut config UI in CommandDialog
    +--requires--> Shortcut storage in store (CommandItem.shortcut?: string)
    +--requires--> Shortcut registration manager (new hook or service)
    +--integrates--> CommandCard must display shortcut hint
    +--integrates--> MainArea must show shortcuts in edit mode

FLOAT-01 (mini floating window)
    |
    +--depends on--> TRAY-01 (window needs to exist while main is hidden)
    +--depends on--> KB-01 (optional: hotkey to toggle floating window)
    +--requires--> Tauri multi-window: WebviewWindowBuilder API
    +--requires--> Inter-window communication: Tauri event system (emit/listen from @tauri-apps/api/event)
    +--requires--> capabilities: core:window:allow-create, core:window:allow-show/hide/focus for "floating" window
    +--requires--> Floating window React entry point (new route or component)
    +--requires--> Shared state strategy (events or store subscription)
    +--requires--> async window creation (Windows deadlock warning!)
    +--integrates--> Main window project selection syncs to floating window

DRAWER-01 (edge drawer)
    |
    +--depends on--> TRAY-01 (drawer hides window, tray provides access)
    +--requires--> Custom edge detection logic
    +--requires--> Tauri Window API: setPosition, setSize, show, hide (already available)
    +--may require--> windows crate for low-level mouse hook (WH_MOUSE_LL)
    +--requires--> Screen bounds detection (multi-monitor)
    +--requires--> Animation timing logic (Rust-side tokio timer preferred)
    +--requires--> Window position persistence in store
    +--integrates--> Taskbar position detection (avoid overlap)
```

### Dependency Notes

- **TRAY-01 is the foundation**: Without tray, "closing" the window (for edge drawer) or "hiding" the main window (while floating window is active) leaves the user with no way to bring EasyPack back. Tray must be implemented first.
- **KB-01 is standalone but enhances everything**: Shortcuts work independently but pair naturally with tray (tray + hotkey = instant command execution from anywhere) and floating window (hotkey to toggle floating window visibility).
- **FLOAT-01 requires inter-window communication**: The main window and floating window are separate WebView instances sharing the same Tauri app process. They communicate via Tauri's event system (`emit`/`listen` from `@tauri-apps/api/event`). State must be explicitly synchronized, not shared. Each window has its own JS runtime.
- **DRAWER-01 is the riskiest**: No existing Tauri solution. Requires Win32 API knowledge for mouse hooks. Edge cases include multi-monitor setups, DPI scaling, taskbar overlap, and Windows Snap behavior conflicts.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority | Phase Suggestion |
|---------|------------|---------------------|------|----------|------------------|
| TRAY-01: System tray | HIGH (app feels "always available") | LOW-MEDIUM | LOW | P0 | Phase 1 -- foundation for everything |
| KB-01: Per-command shortcuts | HIGH (keyboard-driven promise) | MEDIUM | LOW | P0 | Phase 1 -- core milestone deliverable |
| FLOAT-01: Mini floating window | MEDIUM (power-user convenience) | HIGH | MEDIUM | P1 | Phase 2 -- after tray and shortcuts are stable |
| DRAWER-01: Edge drawer | MEDIUM-HIGH (unique UX) | VERY HIGH | HIGH | P2 | Phase 3 -- highest risk, do last |

## Competitor Feature Analysis (v1.2 Scope)

| Feature | VS Code | Raycast | PowerToys Run | EasyPack v1.2 |
|---------|---------|---------|---------------|---------------|
| System-wide hotkeys | Yes (keybindings.json) | Yes (built-in) | Yes (Alt+Space) | Yes (global-shortcut plugin) |
| System tray | Yes (always in tray) | Yes (menu bar) | No | Yes (tray-icon feature) |
| Mini/floating window | No (has Zen mode) | Yes (compact mode) | Yes (popup) | Yes (WebviewWindow) |
| Edge drawer / auto-hide | No (editor paradigm) | No | No | Yes (custom implementation -- unique) |
| Per-command hotkey assignment | Yes | Yes | No | Yes (configurable per command) |

### Competitive Position for v1.2

v1.2 moves EasyPack from a "click to launch" tool toward a "keyboard-first, always-available" power tool. The edge drawer feature is genuinely unique -- no mainstream desktop tool implements edge-snapping with auto-hide for its own window. If implemented well, it becomes a signature differentiator. The per-command shortcut system matches the power-user expectations set by VS Code and Raycast. The system tray brings baseline parity with any "background-running" desktop tool.

## UX Patterns and User Expectations

### Keyboard Shortcuts (KB-01)

**Desktop app convention (HIGH confidence, based on VS Code / PowerToys / industry patterns):**

1. **Shortcut format**: Modifiers + single key. `Ctrl+Alt+<key>` and `Alt+<key>` are the safest patterns on Windows. Avoid `Ctrl+<key>` (conflicts with copy/paste/etc) and `Win+<key>` (reserved by OS).

2. **Shortcut assignment UX**: User clicks a "Record Shortcut" button, presses a key combination, the UI shows the captured shortcut. Pattern from VS Code: click the shortcut column, press keys, shortcut is captured. PowerToys Keyboard Manager uses the same pattern.

3. **Conflict resolution**: When a shortcut conflicts with an existing assignment, show a warning: "This shortcut is already assigned to [Command X]. Replace?" Two options: Replace or Cancel.

4. **Display on cards**: Show the shortcut as a keyboard badge on the command card, e.g., a small pill/badge showing "Alt+1" in the corner. This is the universal pattern (Slack, Discord, VS Code all do this).

5. **Current state**: EasyPack already has `useKeyboard.ts` with number key (1-9) shortcuts for in-app use. The new global shortcuts system extends this with system-wide registration that works even when the app is not focused. The existing `useKeyboard` hook should remain as the in-app fallback; the global shortcuts are the "from anywhere" enhancement.

6. **Limitation to communicate**: Global shortcuts have a practical limit (around 20-30 simultaneous registrations on Windows before reliability drops). Recommend limiting to 10-15 user-defined shortcuts.

### System Tray (TRAY-01)

**Desktop app convention (HIGH confidence, based on official Tauri docs + industry patterns):**

1. **Close behavior**: Clicking the X button hides to tray, does not quit. This is the universal expectation for "always-available" tools (Discord, Slack, Spotify all do this).

2. **Tray icon**: Use the app icon (already have icons in bundle config). Tooltip shows "EasyPack" or "EasyPack - [current project name]".

3. **Left-click behavior**: Show the main window and bring it to focus. This is the most common convention.

4. **Right-click menu**: Context menu with items:
   - "Show EasyPack" (show main window)
   - "---" (separator)
   - "[Current Project Name]" (disabled, informational)
   - "Execute: [command name]" (2-3 quick commands) -- optional, advanced
   - "---" (separator)
   - "Quit" (actually exits the app)

5. **Window show/hide**: When showing from tray, use `window.show()` then `window.setFocus()` to bring to front. When hiding, just `window.hide()`.

6. **Minimize behavior**: Minimizing (clicking the minimize button) should minimize to taskbar as normal. Only the close button triggers hide-to-tray. This matches the Discord/Slack pattern.

### Mini Floating Window (FLOAT-01)

**Desktop app convention (MEDIUM confidence, based on PowerToys Run / Raycast Mini / clipboard managers):**

1. **Size**: Compact, approximately 280-320px wide, 200-300px tall. Just enough for a column of command buttons with icons.

2. **Position**: Always-on-top, positioned near the top-right or wherever the user last placed it. Position should be remembered across sessions.

3. **Content**: Show only command name + icon buttons for the currently selected project. No sidebar, no project selector, no edit controls. This is a "remote control", not a management interface.

4. **Toggle**: A global hotkey (e.g., `Alt+Shift+E`) to show/hide the floating window. Also accessible from tray menu.

5. **Auto-close**: Optional: close the floating window after a command is executed. Some users prefer it stays open; make this configurable.

6. **Parent relationship**: Set `.parent(&main_window)` so the floating window is always above the main window and minimizes when the main window minimizes.

### Edge Drawer (DRAWER-01)

**Desktop app convention (LOW-MEDIUM confidence, very few reference implementations):**

1. **Trigger**: Window dragged to within 20px of a screen edge snaps to that edge. After snapping, the window slides off-screen leaving a 2-4px visible strip (the "tab").

2. **Show**: Mouse cursor touches the visible strip or the screen edge -> window slides in from that edge with a smooth animation (200-300ms).

3. **Hide**: Mouse cursor leaves the window area for >500ms -> window slides back off-screen. A small delay prevents accidental hides when moving between UI elements.

4. **Unsnap**: Dragging the window away from the edge disables edge-drawer mode and returns to normal window behavior.

5. **Multi-monitor**: Each monitor edge is independent. The drawer works on whichever monitor the window is on.

6. **Known UX challenges**:
   - Windows taskbar auto-hide uses the same edge-detection mechanism and can conflict
   - Full-screen apps (games, presentations) should suppress the drawer
   - High-DPI displays need pixel-accurate edge detection
   - The 2-4px "tab" strip must be clickable even though it's tiny

## Technical Implementation Notes

### KB-01: Shortcut Registration Architecture

```typescript
// Proposed hook: useShortcuts.ts
interface ShortcutManager {
  registerShortcut: (shortcut: string, commandId: string) => Promise<void>;
  unregisterShortcut: (shortcut: string) => Promise<void>;
  unregisterAll: () => Promise<void>;
  getConflicts: (shortcut: string) => string[];  // command IDs using this shortcut
}

// Data model extension (CommandItem):
interface CommandItem {
  // ... existing fields ...
  shortcut?: string;  // e.g., "Alt+1", "Ctrl+Alt+B"
}

// Registration flow:
// 1. User assigns shortcut in CommandDialog
// 2. Save shortcut string to CommandItem in store
// 3. Call register() from global-shortcut plugin
// 4. On project switch, re-register project-scoped shortcuts
// 5. On app startup, register all shortcuts from store
```

### TRAY-01: Window Close Interception

```typescript
// In App.tsx or main entry point
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

appWindow.onCloseRequested(async (event) => {
  // Prevent default close -- hide to tray instead
  event.preventDefault();
  await appWindow.hide();
});
```

This is critical: without `event.preventDefault()`, the window closes and the app exits. With it, the window hides and the app continues running in the tray.

### TRAY-01: Tray Icon Setup (JS API)

```typescript
import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';

const menu = await Menu.new({
  items: [
    { id: 'show', text: 'Show EasyPack' },
    { id: 'quit', text: 'Quit' },
  ],
});

const tray = await TrayIcon.new({
  icon: await defaultWindowIcon(),
  menu,
  menuOnLeftClick: false,
  tooltip: 'EasyPack',
  action: (event) => {
    if (event.type === 'Click' && event.button === 'Left') {
      // Left click: show window
      getCurrentWindow().show();
      getCurrentWindow().setFocus();
    }
  },
});
```

### FLOAT-01: Inter-Window Communication

```typescript
// Main window emits current state
import { emit } from '@tauri-apps/api/event';

emit('project-selected', { project, commands });
emit('command-executed', { commandId, project });

// Floating window listens
import { listen } from '@tauri-apps/api/event';

listen('project-selected', (event) => {
  setProject(event.payload.project);
  setCommands(event.payload.commands);
});

// Floating window emits execution request
emit('execute-command', { commandId });

// Main window listens
listen('execute-command', async (event) => {
  await invoke('execute_command', { ... });
});
```

### FLOAT-01: Window Creation (Rust async command)

```rust
// MUST be async to avoid Windows deadlock (per docs.rs WebviewWindowBuilder docs)
#[tauri::command]
async fn create_floating_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let main_window = app.get_webview_window("main").unwrap();

    let _floating = tauri::WebviewWindowBuilder::new(
        &app,
        "floating",
        tauri::WebviewUrl::App("/floating".into()),
    )
    .title("EasyPack Mini")
    .inner_size(280.0, 300.0)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .parent(&main_window)
    .shadow(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

### DRAWER-01: Edge Detection Logic

```typescript
// Conceptual edge detection (simplified)
async function detectEdge(
  windowPosition: { x: number; y: number },
  windowSize: { width: number; height: number }
) {
  const screen = await getPrimaryMonitor(); // via Tauri API
  const threshold = 20; // pixels from edge to trigger snap

  if (windowPosition.y <= threshold) return 'top';
  if (windowPosition.y + windowSize.height >= screen.height - threshold) return 'bottom';
  if (windowPosition.x <= threshold) return 'left';
  if (windowPosition.x + windowSize.width >= screen.width - threshold) return 'right';
  return null;
}
```

### DRAWER-01: Animation Approach

Window animation in Tauri must use explicit `setPosition` calls in a loop. Two options:

**Option A: Rust-side animation (recommended, smoother)**
```rust
async fn slide_window_in(app: AppHandle, window_label: &str, edge: Edge, duration_ms: u64) {
    let win = app.get_webview_window(window_label).unwrap();
    let steps = 20;
    let delay = duration_ms / steps;
    // Calculate positions and call win.set_position() in a loop with tokio::time::sleep
}
```

**Option B: JS-side animation (simpler, may stutter)**
```typescript
async function slideIn(window: Window, from: Position, to: Position, durationMs: number) {
  const steps = 20;
  const delay = durationMs / steps;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    await window.setPosition(new LogicalPosition(x, y));
    await new Promise(r => setTimeout(r, delay));
  }
}
```

## MVP Recommendation

**Phase 1 (P0):** TRAY-01 + KB-01 together. Tray provides the "always available" foundation, shortcuts provide the "keyboard driven" core promise. Both are well-supported by Tauri with LOW risk.

**Phase 2 (P1):** FLOAT-01. After tray and shortcuts are stable, add the floating window as a power-user convenience. This requires careful inter-window communication design.

**Phase 3 (P2):** DRAWER-01. Highest risk, save for last. Start with a simplified version (snap to edges only, no auto-hide) and iterate. Full auto-hide with mouse hooks is the most complex feature in the entire v1.2 milestone.

**Defer for future:** Edge drawer mouse hooks for global detection (start with Tauri-level detection only), tray menu command execution (just show/quit is sufficient for v1.2).

## Sources

- [Tauri v2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- official API, permissions, platform support -- HIGH confidence
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) -- built-in feature, tray-icon flag, TrayIcon + Menu JS API, event types -- HIGH confidence
- [Tauri v2 Splashscreen Lab](https://v2.tauri.app/learn/splashscreen/) -- multi-window pattern, WebviewWindowBuilder usage, inter-window control -- HIGH confidence
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- decorations, transparent, always_on_top, skip_taskbar -- HIGH confidence
- [Tauri WebviewWindowBuilder API (docs.rs)](https://docs.rs/tauri/2.10.1/tauri/webview/struct.WebviewWindowBuilder.html) -- all window builder methods, Windows deadlock warning -- HIGH confidence
- [Tauri v2 Positioner Plugin](https://v2.tauri.app/plugin/positioner/) -- window positioning presets, tray-icon integration -- HIGH confidence
- [VS Code Keybindings](https://code.visualstudio.com/docs/getstarted/keybindings) -- competitor UX pattern for shortcut assignment -- HIGH confidence
- [PowerToys Run](https://learn.microsoft.com/en-us/windows/powertoys/run) -- competitor hotkey + popup pattern -- HIGH confidence
- [Win32 Mouse Hooks (WH_MOUSE_LL)](https://learn.microsoft.com/en-us/windows/win32/winmsg/about-hooks) -- low-level mouse hook for edge detection -- HIGH confidence

---
*Feature research for: EasyPack v1.2 milestone*
*Researched: 2026-04-26*
