# Stack Research -- v1.1 Milestone Additions

**Domain:** Tauri 2.x Windows 桌面项目快捷指令启动器
**Milestone:** v1.1 体验增强与预设指令
**Researched:** 2026-04-15
**Confidence:** HIGH

---

## Existing Stack (v1.0, No Changes Needed)

| Technology | Version | Status |
|------------|---------|--------|
| Tauri | 2.10.x | Unchanged |
| React | 19.x | Unchanged |
| TypeScript | 5.7.x | Unchanged |
| Vite | 6.x | Unchanged |
| Tailwind CSS | 4.x | Unchanged |
| shadcn/ui | latest | Unchanged |
| Rust | 1.77.2+ | Unchanged |
| tauri-plugin-store | 2.4.2 | Unchanged |
| tauri-plugin-dialog | 2.x | Unchanged |
| @dnd-kit/react | 0.4.0 | Unchanged |

## New Rust Crate Required

### walkdir 2.5.0

| Aspect | Detail |
|--------|--------|
| **Crate** | `walkdir` |
| **Version** | 2.5.0 (latest stable, published 2024-03-01) |
| **Purpose** | Recursive directory traversal for folder size calculation |
| **Why this crate** | Cross-platform, zero-config, by BurntSushi (same author as ripgrep). Iterates all files in a directory tree; sum `metadata().len()` for each file entry to compute total size. No unsafe code, minimal dependencies. |
| **Why NOT alternatives** | `jwalk` adds parallel traversal overhead unnecessary for typical project directories (hundreds of MB, not millions of files). Manual `std::fs::read_dir` recursion is error-prone for symlink loops and permission errors. |
| **Confidence** | HIGH -- verified via crates.io API, 393M+ downloads, well-maintained |

**Cargo.toml addition:**
```toml
walkdir = "2.5"
```

**Usage pattern for folder size:**
```rust
use walkdir::WalkDir;
use std::path::Path;

pub fn calculate_folder_size(path: &Path) -> Result<u64, String> {
    let mut total_size: u64 = 0;
    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            total_size += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    Ok(total_size)
}
```

### NOT Added: git2 crate

Reading the current Git branch does NOT require the `git2` crate. The `git2` crate (v0.20.4) pulls in libgit2 C library + openssl dependencies, significantly bloating the build for a feature that needs only to read one text file.

**Instead:** Parse `.git/HEAD` directly with `std::fs::read_to_string` (~10 lines of Rust, zero dependencies). See Architecture section for implementation.

### NOT Added: Any npm packages

No new frontend npm packages are needed for v1.1. The shadcn/ui Select component is already available via the existing `radix-ui` dependency -- just needs `npx shadcn@latest add select` to scaffold the component code.

## Tauri Configuration Changes

### tauri.conf.json Window Changes

**Current state:**
```json
{
  "label": "main",
  "title": "EasyPack",
  "width": 720,
  "height": 480,
  "minWidth": 600,
  "minHeight": 400,
  "resizable": true,
  "center": true
}
```

**Required changes for UI-08 (frameless window + custom titlebar):**
```json
{
  "label": "main",
  "title": "EasyPack",
  "width": 720,
  "height": 480,
  "minWidth": 600,
  "minHeight": 400,
  "resizable": true,
  "center": true,
  "decorations": false,
  "shadow": true
}
```

| Field | Value | Why |
|-------|-------|-----|
| `decorations` | `false` | Removes native Windows title bar (frameless window). Required for custom titlebar UI. |
| `shadow` | `true` | Adds Windows DWM drop shadow around the frameless window. Without this, the window has no visual boundary and looks like it floats on the desktop. Note: on Windows, `shadow: false` is ignored for decorated windows; `shadow: true` enables shadows specifically for undecorated windows. |

**Source:** Tauri v2 official window customization docs -- HIGH confidence

### Capabilities/Permissions Additions

**Current `src-tauri/capabilities/default.json`:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "store:default"
  ]
}
```

**Required additions for custom titlebar window controls:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "store:default",
    "core:window:allow-start-dragging",
    "core:window:allow-minimize",
    "core:window:allow-close",
    "core:window:allow-toggle-maximize"
  ]
}
```

| Permission | Purpose |
|-----------|---------|
| `core:window:allow-start-dragging` | Enable `data-tauri-drag-region` attribute for custom titlebar drag area |
| `core:window:allow-minimize` | Custom minimize button |
| `core:window:allow-close` | Custom close button |
| `core:window:allow-toggle-maximize` | Custom maximize/restore button + double-click titlebar to toggle |

Note: The Tauri docs explicitly state that `core:window:default` does NOT include `window:allow-start-dragging`, so it must be added separately.

**Source:** Tauri v2 window customization docs + permissions table -- HIGH confidence

## New Tauri Commands to Register

**Current `src-tauri/src/lib.rs` invoke_handler:**
```rust
.invoke_handler(tauri::generate_handler![
    commands::shell::execute_command,
])
```

**Required additions:**
```rust
.invoke_handler(tauri::generate_handler![
    commands::shell::execute_command,
    commands::project::get_folder_size,      // PROJ-08: folder size
    commands::project::get_git_branch,       // PROJ-08: git branch name
    commands::project::detect_project_icon,  // PROJ-07: auto-detect icon
    commands::shell::open_folder,            // CMD-10: open in explorer
])
```

Each new command should be in a new `src-tauri/src/commands/project.rs` module.

## New Frontend Components

### shadcn/ui Select Component

Needed for CMD-11 (preset command system -- dual dropdown selector).

**Installation:**
```bash
npx shadcn@latest add select
```

This scaffolds `src/components/ui/select.tsx` using the already-installed `radix-ui` package (currently at ^1.4.3 in package.json). No additional npm dependencies are added; the Select component is built on `@radix-ui/react-select` which is included in the `radix-ui` meta-package.

**Usage pattern for dual-dropdown preset selector:**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// First dropdown: category (python/pip/git/rust/npm)
<Select value={category} onValueChange={setCategory}>
  <SelectTrigger className="w-[140px]">
    <SelectValue placeholder="选择类别" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="python">Python</SelectItem>
    <SelectItem value="pip">pip</SelectItem>
    <SelectItem value="git">Git</SelectItem>
    <SelectItem value="rust">Rust</SelectItem>
    <SelectItem value="npm">npm</SelectItem>
  </SelectContent>
</Select>

// Second dropdown: specific command within selected category
<Select value={command} onValueChange={setCommand}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="选择指令" />
  </SelectTrigger>
  <SelectContent>
    {PRESET_MAP[category]?.map(cmd => (
      <SelectItem key={cmd.command} value={cmd.command}>
        {cmd.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Titlebar Component (New)

A new `src/components/Titlebar.tsx` component is needed for UI-08. This is a custom React component (not a shadcn component) that implements:
- Application name display area with `data-tauri-drag-region` for window dragging
- Minimize / Maximize / Close buttons using `@tauri-apps/api/window`

**Key APIs:**
```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();
await appWindow.minimize();
await appWindow.toggleMaximize();
await appWindow.close();
```

No new npm packages -- `@tauri-apps/api` is already installed (^2.10.1).

## Summary: What Changes vs What Stays

| Category | Change | Detail |
|----------|--------|--------|
| **Cargo.toml** | ADD `walkdir = "2.5"` | One new Rust crate for folder size calculation |
| **tauri.conf.json** | ADD `decorations: false`, `shadow: true` | Frameless window configuration |
| **capabilities/default.json** | ADD 4 window permissions | Drag, minimize, close, toggle-maximize |
| **lib.rs invoke_handler** | ADD 4 new commands | get_folder_size, get_git_branch, detect_project_icon, open_folder |
| **commands/project.rs** | NEW file | Rust implementations for folder size, git branch, icon detection, open folder |
| **src/components/Titlebar.tsx** | NEW file | Custom titlebar React component |
| **src/components/ui/select.tsx** | SCAFFOLD via shadcn | Dual-dropdown for preset commands |
| **npm packages** | NONE | No new frontend dependencies needed |

## Installation

```bash
# 1. Add Rust dependency (in src-tauri/ directory)
cd src-tauri
cargo add walkdir@2.5

# 2. Scaffold shadcn/ui Select component (in project root)
cd ..
npx shadcn@latest add select

# No npm install needed -- no new npm packages
```

## Sources

- [Tauri v2 Window Customization Docs](https://v2.tauri.app/learn/window-customization/) -- frameless window, data-tauri-drag-region, permissions table -- HIGH confidence
- [walkdir crate on crates.io](https://crates.io/crates/walkdir) -- version 2.5.0, 393M+ downloads -- HIGH confidence
- [walkdir GitHub (BurntSushi)](https://github.com/BurntSushi/walkdir) -- well-maintained, same author as ripgrep -- HIGH confidence
- [Tauri v2 Window API Reference](https://v2.tauri.app/reference/javascript/api/namespacewindow/) -- minimize, close, toggleMaximize -- HIGH confidence
- [shadcn/ui Select Component](https://ui.shadcn.com/docs/components/select) -- dual dropdown implementation -- HIGH confidence
- [Tauri issue #14859: decorations: false + shadow: false titlebar bug](https://github.com/tauri-apps/tauri/issues/14859) -- known Windows bug -- MEDIUM confidence
- [Tauri issue #10889: decorations: false border display issue](https://github.com/tauri-apps/tauri/issues/10889) -- black line at top border -- MEDIUM confidence
- [StackOverflow: How to check directory size in Rust](https://stackoverflow.com/questions/60041710/how-to-check-directory-size) -- walkdir pattern -- HIGH confidence
- [Microsoft Terminal issue #4228: 0x80070002 error](https://github.com/microsoft/terminal/issues/4228) -- wt.exe file not found diagnosis -- HIGH confidence

---
*Stack research for: EasyPack v1.1 milestone*
*Researched: 2026-04-15*
