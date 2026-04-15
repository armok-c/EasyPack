# Architecture Patterns -- v1.1 Integration Research

**Domain:** EasyPack v1.1 -- Tauri 2 + React 19 Windows Desktop Project Launcher
**Researched:** 2026-04-15
**Focus:** Integration of 7 new features into existing v1.0 architecture

## Current Architecture Summary (v1.0 Baseline)

EasyPack 采用 Tauri 2.x 经典分层架构。Rust 后端 (`src-tauri/src/`) 负责系统级操作，React 前端 (`src/`) 负责 UI 渲染和状态管理，通过 `invoke()` / `#[tauri::command]` 桥接。

```
+----------------------------------------------------------+
|                    Tauri Application                       |
|                                                           |
|  +---------------------+     +-------------------------+  |
|  |   React Frontend    |     |   Rust Backend           |  |
|  |   (src/)            |     |   (src-tauri/src/)       |  |
|  |                     |     |                         |  |
|  |  App.tsx            |     |  lib.rs (builder)       |  |
|  |    |-- Sidebar      |     |  commands/mod.rs         |  |
|  |    |-- MainArea     |     |  commands/shell.rs       |  |
|  |         |-- CommandCard   |    - execute_command     |  |
|  |         |-- CommandDialog |    - build_full_command  |  |
|  |                     |     |                         |  |
|  |  hooks/useProject.ts|     |                         |  |
|  |    (state + store)  |     |                         |  |
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
| `App.tsx` | `src/App.tsx` | Root layout: flex row (Sidebar + MainArea), zone management |
| `Sidebar` | `src/components/Sidebar.tsx` | Project list, add/remove, drag reorder, context menu settings |
| `MainArea` | `src/components/MainArea.tsx` | Project info, command grid, mode switch, edit mode, keyboard nav |
| `CommandCard` | `src/components/CommandCard.tsx` | Single command button with flash feedback |
| `CommandDialog` | `src/components/CommandDialog.tsx` | Add/edit custom command modal |
| `ProjectSettingsDialog` | `src/components/ProjectSettingsDialog.tsx` | Icon + color picker modal |
| `useProject` hook | `src/hooks/useProject.ts` | All state: projects, commands, CRUD, store sync, execute |
| `useKeyboard` hook | `src/hooks/useKeyboard.ts` | Global number key shortcuts (1-9) |
| `execute_command` | `src-tauri/src/commands/shell.rs` | Build cmd string, spawn wt.exe/cmd.exe |
| `lib.rs` | `src-tauri/src/lib.rs` | Tauri builder, plugin registration, command handler registration |

### Existing Data Models

```typescript
// src/lib/types.ts
interface CommandItem {
  id: string;          // crypto.randomUUID() or "preset-{idx}"
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
```

### Store Structure (easypack-store.json)

```
projects: ProjectItem[]                     // All projects
selectedProjectId: string | null            // Currently selected
customCommands: CommandItem[]               // Global custom commands
projectCommands:{normalizedId}: CommandItem[] // Per-project overrides
```

## v1.1 Feature Integration Analysis

### Feature 1: Fix Command Execution (0x80070002)

**Problem:** Error `0x80070002` = `ERROR_FILE_NOT_FOUND`. Current `build_full_command` produces `cd /d "{path}" && {cmd}`, but when passed through `wt.exe` -> `cmd.exe` chain, the quoting gets mangled.

**Root cause analysis:**

The current flow is:
```rust
// 1. Build: cd /d "D:\Projects\EasyPack" && npm run build
let full_command = format!("cd /d \"{}\" && {}", project_path, shell_command);

// 2a. Windows Terminal path:
StdCommand::new("wt")
    .args(["new-tab", "cmd", "/K", &full_command])
    .spawn();

// 2b. cmd.exe fallback:
StdCommand::new("cmd")
    .args(["/C", "start", "cmd", "/K", &full_command])
    .spawn();
```

The `full_command` string contains double quotes. When `.args()` passes it to `wt.exe` or `cmd.exe`, the quote nesting breaks because `args()` on Windows does not escape inner quotes for shell-level passing. The path `"D:\Projects\EasyPack"` gets its quotes stripped or mangled by the argument parser.

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Rust | `commands/shell.rs` | **MODIFY** `execute_command` and `build_full_command` |
| No frontend changes | -- | -- |

**Architecture approach:** Instead of embedding the `cd /d` command as a string argument, use the process working directory directly:

```rust
// Fix: Use .current_dir() instead of cd /d command string
// This avoids all quoting issues entirely
let project_path_ref = std::path::Path::new(&project_path);
if !project_path_ref.exists() {
    return Err(format!("Project path does not exist: {}", project_path));
}

// Windows Terminal
let wt_result = StdCommand::new("wt")
    .args(["new-tab", "cmd", "/K", &shell_command])
    .current_dir(project_path_ref)
    .spawn();

// Fallback: cmd.exe
StdCommand::new("cmd")
    .args(["/C", "start", "cmd", "/K", &shell_command])
    .current_dir(project_path_ref)
    .spawn()
    .map_err(|e| format!("Failed to execute command: {}", e))?;
```

Key insight: `.current_dir()` sets the working directory at the OS process level, completely bypassing the `cd /d` quoting problem. The `shell_command` alone (e.g., `npm run build`) is passed as the argument, which never needs inner quoting.

**build_full_command** becomes unused for execution (kept for display/tooltip only).

### Feature 2: Frameless Window + Custom Title Bar

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Config | `src-tauri/tauri.conf.json` | **MODIFY** add `decorations: false` |
| Config | `src-tauri/capabilities/default.json` | **MODIFY** add window permissions |
| React | New: `src/components/TitleBar.tsx` | **NEW** component |
| React | `src/App.tsx` | **MODIFY** add TitleBar to layout |
| CSS | `src/index.css` | **MODIFY** add titlebar styles |

**Architecture approach:** Per [Tauri v2 Window Customization docs](https://v2.tauri.app/learn/window-customization/):

1. Set `decorations: false` in tauri.conf.json window config
2. Add permissions: `core:window:allow-start-dragging`, `core:window:allow-minimize`, `core:window:allow-close`, `core:window:allow-toggle-maximize`
3. Create a `TitleBar.tsx` React component with `data-tauri-drag-region` attribute
4. Use `getCurrentWindow()` from `@tauri-apps/api/window` for minimize/maximize/close

**Layout change in App.tsx:**
```
Before: <div class="flex h-screen"> [Sidebar | MainArea]
After:  <div class="flex flex-col h-screen">
          <TitleBar />           <-- NEW: fixed height ~30px
          <div class="flex flex-1"> [Sidebar | MainArea]
```

**TitleBar component design:**
- Left: App name "EasyPack" (draggable region)
- Right: Minimize, Maximize, Close buttons (using SVG icons, consistent with dark theme)
- Height: 30px fixed
- Background: matches app dark theme gradient
- Double-click on drag region = toggle maximize

**Edge case:** The existing Sidebar has its own title area (`<h1>EasyPack</h1>` in the `p-6 border-b` div). After adding the custom TitleBar, the sidebar title should be removed or merged into the TitleBar to avoid duplication.

### Feature 3: Project Icon Auto-Detection

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Rust | New: `src-tauri/src/commands/project.rs` | **NEW** command module |
| Rust | `src-tauri/src/commands/mod.rs` | **MODIFY** add `pub mod project` |
| Rust | `src-tauri/src/lib.rs` | **MODIFY** register new commands |
| Rust | `src-tauri/Cargo.toml` | **MODIFY** add `serde_json` (already present) |
| React | `src/hooks/useProject.ts` | **MODIFY** call detect on project add |
| React | `src/components/ProjectSettingsDialog.tsx` | **MODIFY** show detected icon + allow custom path |

**Architecture approach:** Add Rust commands that scan a project directory for marker files:

```rust
// New Tauri command
#[tauri::command]
pub async fn detect_project_info(path: String) -> Result<ProjectInfo, String> {
    // Returns: { detected_icon: Option<String>, project_type: Option<String> }
}

#[derive(Serialize)]
pub struct ProjectInfo {
    pub detected_icon: Option<String>,  // Lucide icon name
    pub project_type: Option<String>,   // "node", "rust", "python", etc.
}
```

**Detection strategy (no external crate needed):**
```
Priority scan in project directory:
1. package.json exists -> "node" project, icon = "Package"
   - If scripts.build contains "react" or "vite" -> icon = "Code"
   - If scripts.start contains "next" -> icon = "Globe"
2. Cargo.toml exists -> "rust" project, icon = "Terminal"
3. requirements.txt or pyproject.toml or setup.py -> "python", icon = "Server"
4. go.mod -> "go", icon = "Code"
5. .git directory exists -> at least a git repo, icon = "GitBranch"
6. No match -> no icon change (keep default)
```

This uses only `std::fs::metadata` and `std::fs::read_to_string` (already available via `serde_json`). No new crate dependency needed.

**Frontend integration:** In `useProject.ts`, after `addProject()` is called, invoke `detect_project_info` and auto-set the icon if a match is found. User can override via ProjectSettingsDialog.

**Data model change:** Add optional field to `ProjectItem`:
```typescript
interface ProjectItem {
  // ... existing fields ...
  detectedType?: string;  // "node" | "rust" | "python" | "go" | "git" | undefined
}
```

This field is informational only -- it does not affect behavior but helps the ProjectSettingsDialog show "Detected: Node.js project" context.

### Feature 4: Modal Auto-Sizing

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| React | `src/components/ui/dialog.tsx` | **MODIFY** DialogContent sizing |
| React | `src/components/CommandDialog.tsx` | **MODIFY** pass responsive size |
| React | `src/components/ProjectSettingsDialog.tsx` | **MODIFY** pass responsive size |

**Architecture approach:** The current `DialogContent` uses `sm:max-w-lg` which is static. The fix requires:

1. Add `max-h-[calc(100vh-4rem)]` and `overflow-y-auto` to DialogContent to prevent overflow
2. Use CSS `min-height` constraints per dialog type
3. Consider using a `useWindowSize` or `useResizeObserver` hook to adapt `max-height` dynamically

**Key CSS change in dialog.tsx:**
```typescript
// Add to DialogContent className:
"max-h-[calc(100vh-4rem)] overflow-y-auto"
```

This is a CSS-only fix. No Rust changes. No new data model.

### Feature 5: Command Tab Switch to Button Style + Open Folder Button

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| React | `src/components/MainArea.tsx` | **MODIFY** mode switch UI |

**Architecture approach:** Pure frontend UI change. Replace the text link ("使用项目自定义指令" / "使用全局指令") with styled button elements, and add an "Open Folder" button on the same row.

Current layout (text links):
```
当前项目: EasyPack                        [Settings gear]
D:\Projects\EasyPack
全局指令 · 使用项目自定义指令  <-- text links
```

New layout (button row):
```
当前项目: EasyPack                        [Settings gear]
D:\Projects\EasyPack
[全局指令] [项目指令]     [打开文件夹]    <-- buttons + open folder
```

The "Open Folder" button calls a new Rust command:
```rust
#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    // Use Windows explorer.exe to open the folder
    StdCommand::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

This needs to be registered in `lib.rs` invoke_handler.

### Feature 6: Folder Size + Git Branch Display

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| Rust | `src-tauri/src/commands/project.rs` | **ADD** two new commands |
| Rust | `src-tauri/src/lib.rs` | **MODIFY** register new commands |
| React | New: `src/hooks/useProjectInfo.ts` | **NEW** hook for fetching project metadata |
| React | `src/components/MainArea.tsx` | **MODIFY** display info bar above command grid |

**Architecture approach:**

Two new Rust commands:

```rust
#[tauri::command]
pub async fn get_folder_size(path: String) -> Result<u64, String> {
    // Walk directory, sum file sizes
    // Use std::fs (no external crate needed for basic walk)
    // Or add walkdir crate for robust directory traversal
}

#[tauri::command]
pub async fn get_git_branch(path: String) -> Result<Option<String>, String> {
    // Run: git rev-parse --abbrev-ref HEAD
    // If .git directory doesn't exist, return None
    let output = StdCommand::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(Some(branch))
    } else {
        Ok(None)  // Not a git repo
    }
}
```

**Folder size calculation options:**
- Option A: Add `walkdir` crate dependency -- robust, handles symlinks, permission errors
- Option B: Pure `std::fs` recursion -- no new dependency but fragile with deep trees / permission issues
- **Recommendation:** Use `walkdir` crate. It handles edge cases (symlinks, permission denied) that pure `std::fs` does not. Only ~50 lines of integration code.

**New frontend hook:** `useProjectInfo.ts`
```typescript
interface ProjectInfoData {
  folderSize: number | null;     // bytes
  gitBranch: string | null;      // branch name
  loading: boolean;
}

function useProjectInfo(projectPath: string | null): ProjectInfoData
```

This hook calls the Rust commands when `projectPath` changes. Uses `useEffect` with debouncing to avoid hammering the filesystem during rapid project switches.

**Display in MainArea:** Add an info bar between project header and command grid:
```
当前项目: EasyPack                        [Settings gear]
D:\Projects\EasyPack
文件夹: 234 MB | 分支: main              [全局] [项目] [打开文件夹]
[command grid...]
```

**Performance consideration:** Folder size calculation is expensive for large projects (node_modules etc). Consider:
- Run on project selection with a debounce (500ms)
- Cache results per project (invalidate on project re-select)
- Skip hidden directories (node_modules, .git, target) to speed up calculation
- Consider making folder size calculation optional or lazy (expand/collapse)

### Feature 7: Preset Command System

**What changes:**

| Layer | File | Change Type |
|-------|------|-------------|
| React | `src/lib/presets.ts` | **MAJOR REWRITE** expand to categorized library |
| React | `src/lib/types.ts` | **MODIFY** add preset category types |
| React | `src/components/MainArea.tsx` | **MODIFY** dual dropdown UI in edit mode |
| React | New: `src/components/PresetSelector.tsx` | **NEW** dual dropdown component |
| React | `src/hooks/useProject.ts` | **MODIFY** preset → command conversion logic |

**Architecture approach:**

Current preset system is hardcoded as 4 items in `PRESET_COMMANDS`. The new system requires:

1. **Categorized preset library** in `presets.ts`:
```typescript
interface PresetCategory {
  id: string;          // "python", "git", "rust", "npm"
  label: string;       // "Python / pip"
  icon: string;        // Lucide icon name
  commands: PresetCommand[];
}

interface PresetCommand {
  id: string;          // "pip-install", "cargo-build"
  name: string;        // "Install Dependencies"
  command: string;     // "pip install ."
  icon: string;        // Lucide icon name
}

// Default visible presets (v1.0 compat):
// Only "git pull" and "claude" remain as always-visible
// Everything else is in the categorized library
```

2. **Dual dropdown UI:** Two dropdowns in the command grid area (visible in edit mode):
   - Dropdown 1: Category selector (Python/pip, Git, Rust, npm, ...)
   - Dropdown 2: Command selector (filtered by selected category)
   - "Add" button to add selected preset to the current scope

3. **Scope selector:** Each added preset can be added to global or project-level scope.

4. **Data model change:** The `CommandItem` type stays the same -- presets added to a project are stored as `type: "preset"` with the appropriate `scope`.

**Default preset change:** Per CMD-11 requirement, the default grid only shows `git pull` and `claude`. Other presets (`npm run build`, `npm run dev`) move to the categorized library.

**PresetSelector component:**
```typescript
interface PresetSelectorProps {
  onAddPreset: (preset: PresetCommand, scope: "global" | "project") => void;
  scope: "global" | "project";
  categories: PresetCategory[];
}
```

This component renders as a compact row of two `<select>` elements (or shadcn Select components) plus an "Add" button, only visible in edit mode.

## New/Modified Files Summary

### New Files

| File | Purpose | Dependencies |
|------|---------|-------------|
| `src/components/TitleBar.tsx` | Custom frameless window title bar | `@tauri-apps/api/window` |
| `src/components/PresetSelector.tsx` | Dual dropdown for preset command selection | `src/lib/presets.ts` |
| `src/hooks/useProjectInfo.ts` | Fetch folder size + git branch from Rust | `@tauri-apps/api/core` |
| `src-tauri/src/commands/project.rs` | Project info commands (detect, size, git, open) | `walkdir` (new crate) |

### Modified Files

| File | Changes | Affected Features |
|------|---------|-------------------|
| `src-tauri/tauri.conf.json` | `decorations: false` | Frameless window |
| `src-tauri/capabilities/default.json` | Add window permissions | Frameless window |
| `src-tauri/Cargo.toml` | Add `walkdir` dependency | Folder size |
| `src-tauri/src/lib.rs` | Register new commands | All Rust-side features |
| `src-tauri/src/commands/mod.rs` | Add `pub mod project` | Project info |
| `src-tauri/src/commands/shell.rs` | Fix command execution (use `.current_dir()`) | Bug fix |
| `src/App.tsx` | Add TitleBar, adjust layout | Frameless window |
| `src/components/MainArea.tsx` | Info bar, button mode switch, open folder, preset selector | Features 5, 6, 7 |
| `src/components/Sidebar.tsx` | Remove duplicate title if merged to TitleBar | Frameless window |
| `src/components/ProjectSettingsDialog.tsx` | Show detected icon/type, custom icon path | Icon detection |
| `src/components/ui/dialog.tsx` | Add max-height, overflow | Modal auto-sizing |
| `src/hooks/useProject.ts` | Call detect on add, preset system changes | Icon detection, presets |
| `src/lib/presets.ts` | Expand to categorized library, change defaults | Preset system |
| `src/lib/types.ts` | Add PresetCategory, PresetCommand types | Preset system |
| `src/index.css` | TitleBar styles | Frameless window |

## Suggested Build Order

Based on dependency analysis -- features that other features depend on should be built first:

```
Phase 1: Bug Fix (BLOCKS EVERYTHING)
  Feature 1: Fix command execution error
  |-- WHY FIRST: Core functionality broken, all testing depends on it
  |-- Risk: LOW (isolated change in shell.rs)
  |-- No dependencies on other features

Phase 2: Window Shell (INDEPENDENT)
  Feature 2: Frameless window + custom title bar
  |-- WHY EARLY: Layout restructure affects all subsequent UI work
  |-- Risk: MEDIUM (layout changes touch App.tsx, Sidebar.tsx)
  |-- Must be done before other UI features that depend on layout

Phase 3: Rust Backend Expansion (PARALLEL SAFE)
  Feature 3: Project icon auto-detection (Rust command)
  Feature 6: Folder size + Git branch (Rust commands)
  Feature 5 (partial): Open folder command (Rust command)
  |-- WHY PARALLEL: All are new Rust commands with no frontend coupling
  |-- Risk: LOW (additive changes, no existing code modification)
  |-- New file: src-tauri/src/commands/project.rs

Phase 4: Frontend Integration (SEQUENTIAL)
  Feature 4: Modal auto-sizing
  |-- WHY FIRST in frontend: Fixes UX bug in dialogs used by later features
  |-- Risk: LOW (CSS change in dialog.tsx)

  Feature 3 (frontend): Icon detection UI integration
  Feature 5 (UI): Button mode switch + open folder button
  Feature 6 (frontend): Info bar display
  |-- Risk: MEDIUM (MainArea.tsx gets multiple changes)
  |-- NOTE: These all modify MainArea.tsx, so they should be sequential

Phase 5: Preset System (LAST)
  Feature 7: Preset command system
  |-- WHY LAST: Depends on stable MainArea layout + dialog behavior
  |-- Risk: MEDIUM (largest change surface: new types, new component, preset rewrite)
  |-- Changes presets.ts, types.ts, MainArea.tsx, new PresetSelector.tsx
```

**Dependency graph:**
```
Feature 1 (bug fix)
    |
    v
Feature 2 (frameless window)
    |
    +-------------------+
    |                   |
    v                   v
Feature 3 (Rust)    Feature 6 (Rust)    Feature 5 partial (Rust)
    |                   |                   |
    +-------------------+-------------------+
                        |
                        v
              Feature 4 (modal sizing)
                        |
                        v
              Feature 3 (UI) + Feature 5 (UI) + Feature 6 (UI)
                        |
                        v
              Feature 7 (preset system)
```

## Rust Command Registration Change

Current `lib.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    commands::shell::execute_command,
])
```

After all features:
```rust
.invoke_handler(tauri::generate_handler![
    commands::shell::execute_command,
    commands::project::detect_project_info,
    commands::project::get_folder_size,
    commands::project::get_git_branch,
    commands::project::open_folder,
])
```

New module `commands/project.rs` houses all project-related system commands. This follows the existing pattern of `commands/shell.rs` for shell-related commands.

## New Crate Dependency

| Crate | Version | Purpose | Why |
|-------|---------|---------|-----|
| `walkdir` | 2.x | Robust directory traversal for folder size | Handles symlinks, permission errors, deep recursion. Pure `std::fs` would be fragile for large project directories with `node_modules`, `target/`, etc. |

No other new dependencies needed. All other features use existing crates (`serde`, `serde_json`, `std::process::Command`) or frontend-only changes.

## Capabilities/Permissions Change

Current `capabilities/default.json`:
```json
{
  "permissions": ["core:default", "dialog:default", "store:default"]
}
```

After frameless window feature:
```json
{
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-start-dragging",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-close",
    "core:window:allow-toggle-maximize",
    "dialog:default",
    "store:default"
  ]
}
```

No additional shell or FS permissions needed because the new Rust commands use `std::process::Command` and `std::fs` directly (not through Tauri plugins), and the Tauri commands are registered via `invoke_handler` which bypasses the capability system.

## Patterns to Follow

### Pattern 1: Tauri Command Module Organization

**What:** Group related Rust commands into separate module files under `commands/`.

**When:** Adding new system-level operations.

**Example:**
```
src-tauri/src/commands/
  mod.rs          -- pub mod shell; pub mod project;
  shell.rs        -- execute_command, build_full_command
  project.rs      -- detect_project_info, get_folder_size, get_git_branch, open_folder
```

### Pattern 2: Frontend Data-Fetching Hook

**What:** Encapsulate Rust invoke calls in dedicated hooks that manage loading/error state.

**When:** Fetching data from Rust backend that is not part of the core store-managed state.

**Example:**
```typescript
// useProjectInfo.ts
function useProjectInfo(projectPath: string | null) {
  const [info, setInfo] = useState({ folderSize: null, gitBranch: null, loading: false });

  useEffect(() => {
    if (!projectPath) return;
    setInfo(prev => ({ ...prev, loading: true }));
    Promise.all([
      invoke<number>("get_folder_size", { path: projectPath }),
      invoke<string | null>("get_git_branch", { path: projectPath }),
    ]).then(([size, branch]) => {
      setInfo({ folderSize: size, gitBranch: branch, loading: false });
    });
  }, [projectPath]);

  return info;
}
```

### Pattern 3: current_dir() Over cd /d

**What:** Always use `std::process::Command::current_dir()` instead of embedding `cd /d` in command strings.

**When:** Spawning any process that needs to run in a specific directory.

**Why:** Avoids all Windows path quoting issues with spaces, CJK characters, and special characters. The OS sets the working directory before the process starts, so no shell escaping is needed.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calculating Folder Size Synchronously on UI Thread

**What:** Running folder size calculation in the main Tauri event loop.

**Why bad:** Large directories (node_modules) can take seconds to traverse, freezing the UI.

**Instead:** Use `#[tauri::command] async fn` which runs on a separate thread. Add a timeout to prevent hanging on network drives or broken symlinks.

### Anti-Pattern 2: Polling Folder Size / Git Branch

**What:** Using `setInterval` to periodically re-fetch folder size and git branch.

**Why bad:** Wastes filesystem I/O. These values change slowly (folder size) or only on git operations (branch).

**Instead:** Fetch once on project selection. Provide a manual refresh button if needed.

### Anti-Pattern 3: Adding Heavy Rust Crate Dependencies for Simple Detection

**What:** Using `project-detect` or similar crates for project type detection.

**Why bad:** Over-engineering. EasyPack only needs to check if a few files exist (package.json, Cargo.toml, etc.), which is trivially done with `std::fs::metadata`.

**Instead:** Direct `std::fs::metadata(path).is_ok()` checks for known marker files.

### Anti-Pattern 4: Mixing Preset Data with User Data in Store

**What:** Storing the full categorized preset library in the Store JSON file.

**Why bad:** Presets are static data defined in code. Storing them duplicates data and makes updates harder.

**Instead:** Only store user-added commands (custom + selected presets converted to CommandItem). The preset library is hardcoded in `presets.ts` and always reflects the latest version.

## Scalability Considerations

| Concern | Current (5-50 projects) | Growth (100+ projects) | Mitigation |
|---------|------------------------|------------------------|------------|
| Folder size calculation | Instant per project | Could be slow with many large projects | Cache results, lazy load, skip hidden dirs |
| Git branch detection | Fast (git rev-parse) | Fast (no scalability concern) | N/A |
| Preset library size | ~20 presets across 5 categories | Could grow to 50+ | Virtualize dropdown, search filter |
| Frameless window perf | No impact | No impact | N/A |
| Store JSON size | <100KB | Still manageable | If needed, split per-project data into separate keys (already done for projectCommands) |

## Sources

- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- Frameless window setup, data-tauri-drag-region, window permissions -- HIGH confidence
- [Tauri v2 Configuration Reference](https://v2.tauri.app/reference/config/) -- Window config options (decorations, shadow) -- HIGH confidence
- [GitHub microsoft/terminal #9313](https://github.com/microsoft/terminal/issues/9313) -- wt.exe quoting behavior with spaces -- HIGH confidence
- [StackOverflow: ExternalTerminal path spaces 0x80070002](https://github.com/microsoft/vscode-cpptools/issues/11970) -- cmd.exe path quoting causing ERROR_FILE_NOT_FOUND -- HIGH confidence
- [Rust walkdir crate](https://docs.rs/walkdir) -- Directory traversal for folder size -- HIGH confidence
- [fs_extra::dir::get_size](https://docs.rs/fs_extra/latest/fs_extra/dir/fn.get_size.html) -- Alternative to walkdir for folder size -- HIGH confidence
- [StackOverflow: Get current git branch](https://stackoverflow.com/questions/6245570/how-do-i-get-the-current-branch-name-in-git) -- `git rev-parse --abbrev-ref HEAD` -- HIGH confidence
- [Tauri v2 Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/) -- Command registration pattern -- HIGH confidence
- [project-detect crate](https://docs.rs/project-detect) -- Considered and rejected (anti-pattern 3) -- MEDIUM confidence
