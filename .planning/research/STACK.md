# Stack Research -- v1.2 Milestone Additions

**Domain:** Tauri 2.x Windows 桌面项目快捷指令启动器
**Milestone:** v1.2 快捷键、托盘与窗口增强
**Researched:** 2026-04-26
**Confidence:** HIGH

---

## Existing Stack (v1.1, No Changes Needed)

| Technology | Version | Status |
|------------|---------|--------|
| Tauri | 2.10.x | Unchanged (core) |
| React | 19.x | Unchanged |
| TypeScript | 5.7.x | Unchanged |
| Vite | 6.x | Unchanged |
| Tailwind CSS | 4.x | Unchanged |
| shadcn/ui | latest | Unchanged |
| Rust | 1.77.2+ | Unchanged |
| tauri-plugin-store | 2.4.2 | Unchanged |
| tauri-plugin-dialog | 2.x | Unchanged |
| @dnd-kit/react | 0.4.0 | Unchanged |
| walkdir | 2.5.0 | Unchanged |

## New Dependencies Required

### 1. tauri-plugin-global-shortcut (Rust + npm)

| Aspect | Detail |
|--------|--------|
| **Rust crate** | `tauri-plugin-global-shortcut` |
| **npm package** | `@tauri-apps/plugin-global-shortcut` |
| **Version** | 2.x (matches Tauri 2 ecosystem) |
| **Purpose** | Register system-wide keyboard shortcuts that work even when the app is not focused |
| **Why this plugin** | Official Tauri 2 plugin. Handles OS-level hotkey registration/unregistration with proper key event handling. The JS API provides `register()`, `unregister()`, `isRegistered()` and event callbacks for key press/release. This is the ONLY way to implement per-command hotkeys that work when the app is in the background. |
| **Why NOT alternatives** | Rolling a custom solution via Win32 `RegisterHotKey` API requires `windows` crate + unsafe FFI + manual message loop integration. The official plugin abstracts all of this and is maintained by the Tauri team. |
| **Confidence** | HIGH -- verified via official Tauri v2 docs at v2.tauri.app/plugin/global-shortcut |

**Cargo.toml addition:**
```toml
tauri-plugin-global-shortcut = "2"
```

**npm install:**
```bash
npm install @tauri-apps/plugin-global-shortcut
```

**lib.rs plugin registration:**
```rust
.plugin(tauri_plugin_global_shortcut::init())
```

**JS usage pattern:**
```typescript
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

// Register a hotkey for a command
await register('CommandOrControl+Shift+G', (event) => {
  if (event.state === 'Pressed') {
    executeCommand(currentProject, command);
  }
});
```

**Required permissions:**
```json
"global-shortcut:allow-register",
"global-shortcut:allow-unregister",
"global-shortcut:allow-is-registered"
```

---

### 2. System Tray -- Built-in Tauri Feature (NO new dependency)

| Aspect | Detail |
|--------|--------|
| **Type** | Built-in Tauri 2 feature, NOT a separate plugin |
| **Cargo feature** | `"tray-icon"` added to `tauri` features in Cargo.toml |
| **npm package** | None -- `TrayIcon` API is included in `@tauri-apps/api` (already installed) |
| **Purpose** | System tray icon with right-click context menu; minimize to tray on window close |
| **Why built-in** | Tauri 2 ships tray support as a Cargo feature flag. The JS API (`TrayIcon`, `Menu`, `MenuItem`) comes from `@tauri-apps/api/tray` and `@tauri-apps/api/menu`. No external plugin needed. |
| **Confidence** | HIGH -- verified via official Tauri v2 docs at v2.tauri.app/learn/system-tray |

**Cargo.toml modification:**
```toml
# BEFORE:
tauri = { version = "2", features = ["protocol-asset"] }

# AFTER:
tauri = { version = "2", features = ["protocol-asset", "tray-icon"] }
```

**tauri.conf.json addition (under `app`):**
```json
"trayIcon": {
  "iconPath": "icons/icon.png",
  "iconAsTemplate": false,
  "id": "main-tray",
  "tooltip": "EasyPack"
}
```

**JS usage pattern (in lib.rs setup or frontend):**
```typescript
import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu, MenuItem } from '@tauri-apps/api/menu';

const menu = await Menu.new({
  items: [
    await MenuItem.new({ text: '显示主窗口', action: () => showWindow() }),
    await MenuItem.new({ text: '退出', action: () => exitApp() }),
  ]
});

const tray = await TrayIcon.new({ id: 'main-tray', menu });
```

---

### 3. Multi-Window (Floating Mini Window) -- Built-in Tauri Feature (NO new dependency)

| Aspect | Detail |
|--------|--------|
| **Type** | Built-in Tauri 2 feature |
| **npm package** | None -- `WebviewWindow` is in `@tauri-apps/api/webviewWindow` (already installed) |
| **Purpose** | Create a secondary small window for mini floating command launcher |
| **Why built-in** | Tauri 2 supports multi-window natively via `WebviewWindow` API. Can define windows in config or create dynamically from JS. Supports `alwaysOnTop`, `skipTaskbar`, `parent`, `transparent` properties. |
| **Confidence** | HIGH -- verified via official Tauri v2 docs |

**tauri.conf.json addition (second window in `app.windows` array):**
```json
{
  "label": "floating",
  "title": "EasyPack Mini",
  "url": "/floating",
  "width": 280,
  "height": 400,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "resizable": false,
  "decorations": false,
  "shadow": true,
  "visible": false,
  "create": false,
  "parent": "main"
}
```

Key properties:
- `create: false` -- window is defined in config but NOT created at startup; created on demand via JS
- `visible: false` -- hidden by default
- `parent: "main"` -- floating window is a child of the main window
- `alwaysOnTop: true` -- stays above other windows
- `skipTaskbar: true` -- does not appear in Windows taskbar

**JS usage pattern:**
```typescript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// Create the floating window on demand
const floating = new WebviewWindow('floating', {
  url: '/floating',
  width: 280,
  height: 400,
  alwaysOnTop: true,
  skipTaskbar: true,
  decorations: false,
  parent: 'main'
});
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

---

### 4. Edge Drawer -- Custom Implementation (NO additional packages)

| Aspect | Detail |
|--------|--------|
| **Type** | Custom logic using existing Tauri Window API |
| **Packages needed** | None -- uses `getCurrentWindow()` API from `@tauri-apps/api/window` |
| **Purpose** | Main window can snap to screen edges, auto-hide, slide out on mouse contact |
| **Why custom** | Tauri 2 has NO built-in edge-snapping or drawer behavior. Must be implemented from scratch using `window.setPosition()`, `window.setSize()`, `window.show()`, `window.hide()` in combination with screen edge detection. May need `windows` crate for low-level mouse hook at screen edges. |
| **Confidence** | MEDIUM -- no existing Tauri ecosystem solution; custom implementation required |

**Potential Rust addition (for mouse hook at screen edge):**
```toml
# May be needed for detecting mouse at screen edge when window is hidden
windows = { version = "0.58", features = ["Win32_UI_WindowsAndMessaging", "Win32_Foundation"] }
```

The `windows` crate is only needed if Tauri's event system cannot detect mouse position when the window is hidden (which is likely the case -- a hidden window receives no mouse events). A low-level Win32 mouse hook (`SetWindowsHookEx` with `WH_MOUSE_LL`) would be required to detect when the cursor touches a screen edge.

**Implementation approach:**
1. Track window position relative to screen edges
2. When window is dragged to an edge and released, animate it off-screen (set position to just outside the edge, leaving a 2-4px strip visible)
3. Use Win32 `WH_MOUSE_LL` hook to detect cursor at the edge
4. When cursor touches the edge strip, slide the window back in
5. When cursor leaves the window area, slide it back out

---

## Tauri Configuration Changes Summary

### tauri.conf.json

| Section | Change | Why |
|---------|--------|-----|
| `app.windows` | ADD second window config for floating mini | Pre-define floating window with `create: false` for lazy creation |
| `app.trayIcon` | ADD tray icon config block | System tray icon and tooltip |

### Cargo.toml

| Change | Detail |
|--------|--------|
| ADD `tauri-plugin-global-shortcut = "2"` | System-wide keyboard shortcut registration |
| MODIFY tauri features: ADD `"tray-icon"` | Enable built-in system tray support |
| POSSIBLY ADD `windows = "0.58"` (conditional) | Only if edge drawer needs low-level mouse hooks |

### capabilities/default.json

**Current state:**
```json
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

**Required additions:**
```json
{
  "windows": ["main", "floating"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-start-dragging",
    "core:window:allow-create",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-position",
    "core:window:allow-set-size",
    "core:window:allow-inner-position",
    "core:window:allow-inner-size",
    "core:window:allow-outer-position",
    "core:window:allow-outer-size",
    "core:window:allow-is-visible",
    "core:webview:allow-create-webview-window",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "dialog:default",
    "store:default"
  ]
}
```

| Permission | Purpose |
|-----------|---------|
| `core:window:allow-create` | Create floating window dynamically |
| `core:window:allow-show` / `allow-hide` | Show/hide floating window and edge drawer |
| `core:window:allow-set-focus` | Focus main window from tray |
| `core:window:allow-set-always-on-top` | Floating window always on top |
| `core:window:allow-set-position` | Edge drawer position animation |
| `core:window:allow-set-size` | Edge drawer resize during slide animation |
| `core:window:allow-inner-position` / `allow-inner-size` | Read current position/size for edge detection |
| `core:window:allow-outer-position` / `allow-outer-size` | Read outer dimensions including decorations |
| `core:window:allow-is-visible` | Check window visibility state |
| `core:webview:allow-create-webview-window` | Create the floating webview window |
| `global-shortcut:allow-register` | Register keyboard shortcuts |
| `global-shortcut:allow-unregister` | Unregister keyboard shortcuts |
| `global-shortcut:allow-is-registered` | Check if shortcut is already registered |

Note: `"windows": ["main"]` must change to `"windows": ["main", "floating"]` so capabilities apply to both windows.

---

## NOT Added

| Rejected | Why | Use Instead |
|----------|-----|-------------|
| `tauri-plugin-autostart` | Not requested for v1.2 -- auto-start is out of scope for a personal tool | Manual startup |
| `tauri-plugin-window-state` | Window state saving is handled by edge drawer logic custom; plugin saves position/size but does not handle edge-snapping behavior | Custom position persistence via store |
| `tauri-plugin-opener` | Already have `open_folder` command using `explorer.exe` with `raw_arg()` | Existing Rust command |
| `electron` | N/A | N/A |
| Any animation library (framer-motion, react-spring) | Edge drawer animations are handled via Rust-side `setPosition` calls, not CSS animations. Floating window show/hide is instant. | Tauri Window API calls |

---

## Installation

```bash
# 1. Add Rust dependencies (in src-tauri/ directory)
cd src-tauri
cargo add tauri-plugin-global-shortcut@2
# Modify tauri features in Cargo.toml: add "tray-icon"
# Optionally: cargo add windows@0.58 --features "Win32_UI_WindowsAndMessaging,Win32_Foundation"

# 2. Add frontend dependency (in project root)
cd ..
npm install @tauri-apps/plugin-global-shortcut

# 3. No shadcn components to scaffold -- all UI is custom-built
```

---

## Sources

- [Tauri v2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- official plugin docs, JS API, permissions -- HIGH confidence
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) -- built-in tray feature, `tray-icon` flag, Menu API -- HIGH confidence
- [Tauri v2 Window Configuration](https://v2.tauri.app/reference/config/) -- WindowConfig properties (alwaysOnTop, skipTaskbar, parent, create) -- HIGH confidence
- [Tauri v2 Multi-Window](https://v2.tauri.app/learn/window-customization/) -- WebviewWindow API, window creation -- HIGH confidence
- [Tauri v2 Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) -- setPosition, setSize, show, hide -- HIGH confidence
- [windows crate](https://crates.io/crates/windows) -- Win32 API bindings, WH_MOUSE_LL hook -- HIGH confidence
- [tauri-plugin-global-shortcut on crates.io](https://crates.io/crates/tauri-plugin-global-shortcut) -- version info -- HIGH confidence

---
*Stack research for: EasyPack v1.2 milestone*
*Researched: 2026-04-26*
