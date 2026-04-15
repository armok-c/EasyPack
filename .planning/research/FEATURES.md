# Feature Research: v1.1 Milestone

**Domain:** Windows desktop project launcher -- v1.1 experience enhancement & preset commands
**Researched:** 2026-04-15
**Confidence:** HIGH
**Scope:** Only the 7 new features for v1.1. Existing v1.0 features are documented in the previous FEATURES.md (archived in git history).

## Executive Summary

The v1.1 milestone focuses on three themes: (1) fixing the critical command execution bug that blocks all users, (2) improving window chrome and visual polish (frameless window, modal sizing, button-style toggles), and (3) adding intelligence features (icon auto-detection, folder info, preset command system). The bug fix is a hard blocker -- nothing else matters if commands don't execute. The frameless window and preset system are the highest-value additions. Folder info (size + git branch) is a nice-to-have that rounds out the project context display.

---

## Table Stakes (Users Expect These)

Features users assume work or exist. Missing/broken = product feels broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| CMD-09: Command execution fix (0x80070002) | Core product is broken without this. Every user hits it. | LOW | None (standalone fix) | Root cause: `wt.exe new-tab cmd /K "cd /d path && command"` fails because `wt.exe` passes the argument string as a single literal argument to `cmd`. The `cd /d path && command` is not parsed by the intermediate `cmd` instance correctly, OR the path format is incompatible. Fix approach: use `wt.exe new-tab -d "path" cmd /K "command"` instead of embedding `cd /d` into the command string. This uses Windows Terminal's native `-d` flag to set the starting directory. Fallback: `cmd /C start cmd /K "cd /d \"path\" && command"` needs correct quoting -- current quoting may be losing the inner quotes. |
| UI-08: Frameless window + custom title bar | Modern desktop apps (VS Code, Discord, Figma, Notion) all use custom title bars. Native Windows chrome looks dated. | MEDIUM | Requires: `decorations: false` in tauri.conf.json, `core:window:allow-start-dragging` permission in capabilities, `data-tauri-drag-region` attribute on title bar div, JS calls to `appWindow.minimize()`, `appWindow.toggleMaximize()`, `appWindow.close()` | Tauri 2 has first-class support: set `decorations: false` in config, add `data-tauri-drag-region` to the drag area div, wire up min/max/close buttons via `@tauri-apps/api/window`. Need to offset all content by the title bar height (typically 30-36px). Existing sidebar title "EasyPack" naturally becomes the title bar content. Windows Snap Layouts are NOT supported for frameless windows (Tauri issue #4531) -- this is an acceptable trade-off for a personal tool. |
| UI-09: Modal auto-sizing for small windows | User reports modals clipping at current min-width (600px). Modals must be usable at all valid window sizes. | LOW | Existing: CommandDialog, ProjectSettingsDialog | shadcn/ui Dialog's `DialogContent` currently has `sm:max-w-[480px]`. At 600px window width, the dialog occupies 80% of viewport -- acceptable. The real issue is `max-height` not being constrained. Fix: add `max-h-[calc(100vh-4rem)] overflow-y-auto` to DialogContent. For the icon picker grid inside CommandDialog, ensure it scrolls within the constrained area. No new components needed -- just CSS adjustments. |

## Differentiators (Competitive Advantage)

Features that elevate EasyPack beyond basic functionality into a polished developer tool.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| CMD-11: Preset command system with dual dropdown | Most command launchers force users to type every command. A curated preset library (git, npm, python, pip, rust) with category-first browsing dramatically lowers configuration cost. | HIGH | Requires: new preset data structure (category > command list), two shadcn/ui Select components, integration with existing addCommand flow, decision on how presets interact with global/project scopes | Implementation plan: (1) Define PRESET_CATEGORIES map: `{ "Git": [{name: "git pull", command: "git pull", icon: "GitBranch"}, ...], "NPM": [...], "Python": [...], "Rust": [...] }`. (2) UI: first Select for category, second Select populates with that category's commands. (3) "Add" button inserts the selected preset as a custom CommandItem. (4) Presets are templates -- once added, they become editable custom commands. (5) Default display: only "git pull" and "claude" as before; other presets accessible via the dual dropdown. The dual-dropdown pattern is common in IDEs (VS Code task runner, JetBrains run configurations) and developer tools. |
| PROJ-07: Project icon auto-detection from directory | Manual icon selection is tedious. Auto-detecting the project type from directory contents (package.json -> npm/Node, Cargo.toml -> Rust, pyproject.toml -> Python, .git -> Git repo) and assigning a matching icon saves setup time. | MEDIUM | Requires: Rust backend command to scan directory for known config files, mapping from detected files to icon names, fallback to current Lucide icon system | Detection strategy (in priority order): (1) `package.json` present -> Node.js/npm icon. (2) `Cargo.toml` present -> Rust icon. (3) `pyproject.toml` or `requirements.txt` or `setup.py` present -> Python icon. (4) `.git` present -> Git icon. (5) No match -> default Terminal icon. Can detect multiple indicators (e.g., both package.json and .git). Implementation: new Rust command `detect_project_type(path: String) -> Vec<String>` that checks for file existence using `std::path::Path::exists()`. Frontend maps returned type strings to icon names. Auto-detection runs once on project add, user can override via settings. |
| PROJ-08: Folder size + Git branch display | Context-rich project info above the command cards helps users verify they're in the right project and understand its state without switching to a file explorer or terminal. | MEDIUM | Requires: Rust commands for folder size calculation and git branch detection, new info bar component above command grid | Folder size: `std::fs::read_dir()` recursive walk, sum file sizes. Cache result -- don't recalculate on every render. Trigger on project select + manual refresh. Git branch: two approaches -- (A) Shell out to `git rev-parse --abbrev-ref HEAD` with `std::process::Command` (simpler, requires git on PATH), or (B) use `git2` crate (no external dependency, but adds ~2MB to binary). For this personal tool, approach A is recommended -- `git` is always on PATH for the target audience (developers). Display format: `main` branch tag (green dot + branch name) + `245 MB` folder size, on a single line above the command card grid. |
| CMD-10: Global/project command switch to button style + open folder button | Current text-link switch ("use project commands" / "use global commands") is visually weak and easy to miss. A segmented button control is standard UI for mutually-exclusive toggles (like iOS segmented control, Material Design toggle buttons). | LOW | Existing: commandMode state, enableProjectCommands/disableProjectCommands callbacks | Replace the current text link pair with a shadcn/ui-style segmented button group: `[Global | Project]`. Add a third button or icon button for "Open in Explorer" next to it. Open folder uses `tauri-plugin-opener` (`open_path` or `reveal_item_in_dir`) or Rust `std::process::Command::new("explorer").arg(path)`. The `tauri-plugin-opener` is the cleaner approach but requires adding a new dependency. `explorer.exe` approach has zero dependencies. Recommend `explorer.exe` for simplicity -- one line of Rust code. |

## Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Recursive real-time folder size monitoring | "Always show current size" | Continuous disk I/O on every file change. Performance killer for large node_modules directories. Requires file system watcher (notify crate) running constantly. | Calculate once on project select, cache result. Add manual refresh button. Update only on user action. |
| git2 crate for all Git operations | "Native library, no external dependency" | Adds ~2MB to binary. Complex API for simple use case. Overkill when we only need current branch name. The `git` CLI is universally available for our developer audience. | Use `std::process::Command` to call `git rev-parse --abbrev-ref HEAD`. One line, zero dependencies, works everywhere git is installed. |
| Snap Layouts for frameless window | "Windows 11 native snap behavior" | Tauri does not support Windows Snap Layouts for frameless windows (issue #4531, open since 2023). Implementing this requires Win32 API interop that Tauri doesn't expose. It is a platform limitation. | Accept the limitation for this personal tool. Users can still use Win+Arrow keys for basic snap. Maximize button works correctly. |
| Preset commands as immutable system objects | "Keep presets separate from custom commands" | Dual-type command system adds complexity to every CRUD operation. Users expect to edit anything they see. Two different UI behaviors for "preset" vs "custom" cards is confusing. | Treat presets as templates. Once a user adds a preset via the dual dropdown, it becomes a regular custom CommandItem. No special treatment after insertion. The existing `type: "preset" | "custom"` distinction already exists and handles this -- just extend preset population. |
| Icon auto-detection using file content parsing | "Read package.json name field, detect framework from dependencies" | Parsing arbitrary package.json files introduces security surface (arbitrary file read) and complexity (JSON parsing in Rust for many project types). The simple file-existence check is sufficient for icon assignment. | Check only for file existence (`package.json`, `Cargo.toml`, etc.). Map file presence to icon. No content parsing needed. |

## Feature Dependencies

```
CMD-09 (execution fix)
    |
    v
    └── BLOCKS everything -- must fix first

UI-08 (frameless window)
    ├──requires──> tauri.conf.json: decorations=false
    ├──requires──> capabilities: core:window:allow-start-dragging, allow-minimize, allow-maximize, allow-close, allow-toggle-maximize
    ├──requires──> New TitleBar component (replaces current sidebar title area)
    └──impacts──> All layout: content must shift down by title bar height (30-36px)
                  Sidebar and MainArea both need top padding/margin adjustment
                  Window minimum height may need increase (currently 400px)

UI-09 (modal auto-sizing)
    └──standalone──> CSS-only fix to DialogContent max-height + overflow

CMD-10 (button-style toggle + open folder)
    ├──standalone──> Replaces text links in MainArea with button group
    ├──requires──> Rust command: open_folder_in_explorer(path: String)
    └──enhances──> Works better with frameless window (visual consistency)

PROJ-07 (icon auto-detection)
    ├──requires──> New Rust command: detect_project_type(path) -> Vec<String>
    ├──integrates──> useProject.addProject() must call detection on folder add
    └──integrates──> ProjectSettingsDialog can show detected type + allow override

PROJ-08 (folder size + git branch)
    ├──requires──> New Rust command: get_folder_size(path) -> u64
    ├──requires──> New Rust command: get_git_branch(path) -> Option<String>
    ├──requires──> New React component: ProjectInfoBar (above command grid)
    └──integrates──> useProject must expose folder info state for selected project

CMD-11 (preset command system)
    ├──requires──> New data: PRESET_CATEGORIES map (typescript)
    ├──requires──> New UI: dual Select dropdowns (shadcn Select component)
    ├──integrates──> Feeds into existing addCommand flow
    ├──integrates──> Must work in both global and project command modes
    └──depends on──> CMD-09 fixed (users need working execution to test presets)
```

### Dependency Notes

- **CMD-09 blocks everything:** If command execution is broken, no feature can be meaningfully tested or validated. This must be the first fix.
- **UI-08 impacts all layout:** Frameless window shifts the entire content area down. Both Sidebar and MainArea need top-offset adjustments. The current `<div className="p-6 border-b border-white/5">` that contains the "EasyPack" title in Sidebar naturally becomes part of the title bar.
- **UI-09 is standalone CSS:** No component restructuring needed. Just add responsive max-height constraints to DialogContent.
- **CMD-10 is low-risk UI change:** Replacing text links with segmented buttons is a localized change in MainArea. The "open folder" button needs one new Rust command.
- **PROJ-07 integrates into project add flow:** Auto-detection runs when a folder is added. The result populates the `icon` field of ProjectItem. Existing manual override in ProjectSettingsDialog remains unchanged.
- **PROJ-08 needs two new Rust commands:** Both are simple. `get_folder_size` uses `std::fs::read_dir` recursive walk. `get_git_branch` shells out to `git rev-parse --abbrev-ref HEAD`. Results should be cached per session (not persisted).
- **CMD-11 requires new data model:** The PRESET_CATEGORIES map is a new data structure, separate from the existing PRESET_COMMANDS array. The existing 4 presets (build, start, git pull, claude) remain as default cards. The preset dropdown provides additional commands beyond those 4.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase Suggestion |
|---------|------------|---------------------|----------|------------------|
| CMD-09: Execution fix | CRITICAL (blocks all usage) | LOW | P0 | Phase 1 -- must land first |
| UI-08: Frameless window | HIGH (visual identity) | MEDIUM | P1 | Phase 2 -- high visual impact |
| CMD-10: Button toggle + open folder | MEDIUM (usability) | LOW | P1 | Phase 2 -- pairs well with frameless |
| UI-09: Modal auto-sizing | MEDIUM (usability) | LOW | P1 | Phase 2 -- small fix, batch with others |
| PROJ-07: Icon auto-detection | MEDIUM (intelligence) | MEDIUM | P2 | Phase 3 -- needs new Rust command |
| CMD-11: Preset command system | HIGH (efficiency) | HIGH | P2 | Phase 3 -- largest new feature |
| PROJ-08: Folder size + git branch | LOW (nice-to-have) | MEDIUM | P3 | Phase 4 -- polish feature |

## Competitor Feature Analysis (v1.1 Scope)

| Feature | VS Code | DevToys | Cherry Studio | EasyPack v1.1 |
|---------|---------|---------|---------------|---------------|
| Frameless window | Yes (custom title bar) | Yes | Yes (Tauri-based) | Yes (Tauri data-tauri-drag-region) |
| Preset command library | Tasks: npm scripts auto-detect | Fixed tool set | AI prompt templates | Curated dev command presets (git/npm/python/rust) |
| Project type detection | Workspace trust, package.json parsing | No | No | File-existence check (package.json, Cargo.toml, etc.) |
| Folder size display | Status bar shows file count | No | No | Info bar above command cards |
| Git branch display | Status bar (always visible) | No | No | Info bar above command cards |
| Open in Explorer | "Reveal in File Explorer" | No | No | Button next to command mode toggle |

### Competitive Position for v1.1

The v1.1 features bring EasyPack closer to the polish level of established desktop tools while maintaining its unique niche as a project-aware command launcher. The frameless window brings visual parity with VS Code and Cherry Studio. The preset system differentiates from DevToys (which has fixed tools) by offering curated but customizable command templates. Folder info display mirrors the "status bar at a glance" pattern from VS Code but in a lightweight, non-IDE context.

## Technical Implementation Notes

### CMD-09: Command Execution Fix -- Detailed Analysis

**Current code** (`shell.rs`):
```rust
// Windows Terminal path (fails with 0x80070002)
StdCommand::new("wt")
    .args(["new-tab", "cmd", "/K", &full_command])
    .spawn()
```
where `full_command = format!("cd /d \"{}\" && {}", project_path, shell_command)`.

**Problem:** `wt.exe` receives `["new-tab", "cmd", "/K", "cd /d \"path\" && command"]` as argv. Windows Terminal interprets the 4th argument as the entire command to pass to `cmd`, but the quoting/escaping of the inner `cd /d` with quoted path and `&&` chain may not survive the argv parsing. The `0x80070002` error (ERROR_FILE_NOT_FOUND) suggests `cmd.exe` is trying to execute `"cd /d \"path\" && command"` as a single literal string rather than parsing it as separate commands.

**Recommended fix:** Use `wt.exe`'s native `-d` flag for starting directory, and pass only the actual command:
```rust
// Windows Terminal with native directory flag
StdCommand::new("wt")
    .args(["new-tab", "-d", project_path, "cmd", "/K", &shell_command])
    .spawn()
```
This separates the directory change (handled by `-d`) from the command execution (`/K`), eliminating the quoting ambiguity.

**Fallback fix (cmd.exe path):**
```rust
StdCommand::new("cmd")
    .args(["/C", "start", "cmd", "/K", &format!("cd /d \"{}\" && {}", project_path, shell_command)])
    .spawn()
```
The `start` command opens a new cmd window. The `/K` flag keeps it open. The quoting should work because `cmd /C` receives the entire rest as a single string.

### UI-08: Frameless Window -- Tauri 2 API Reference

From official Tauri v2 docs (https://v2.tauri.app/learn/window-customization/):

1. **Config:** `"decorations": false` in `tauri.conf.json` window config
2. **Permissions:** Add to `capabilities/default.json`:
   - `core:window:allow-start-dragging` (for data-tauri-drag-region)
   - `core:window:allow-minimize`
   - `core:window:allow-maximize`
   - `core:window:allow-close`
   - `core:window:allow-toggle-maximize`
3. **Drag region:** Add `data-tauri-drag-region` attribute to title bar div. Child elements (buttons, text) will NOT be draggable -- only the attribute-bearing element itself.
4. **JS API:** `getCurrentWindow()` from `@tauri-apps/api/window`, then `.minimize()`, `.toggleMaximize()`, `.close()`
5. **Layout:** Title bar must be `position: fixed; top: 0; left: 0; right: 0; height: 30px`. Content below needs matching top margin/padding.

### PROJ-08: Git Branch Detection -- Approach Comparison

| Criterion | `git` CLI (std::process::Command) | `git2` crate |
|-----------|-----------------------------------|---------------|
| Binary size impact | 0 KB | ~2 MB |
| External dependency | Requires `git` on PATH | None |
| Code complexity | 3 lines | 5 lines + error handling |
| Speed | ~5ms (process spawn overhead) | <1ms (in-process) |
| Edge cases | Git not installed, not a git repo | Not a git repo, corrupt .git |
| Recommendation | **Yes** -- target users are developers who always have git | No -- overkill for branch name only |

### CMD-11: Preset Command Data Structure

```typescript
// Proposed structure (extends existing presets.ts)
interface PresetCategory {
  id: string;           // "git", "npm", "python", "pip", "rust"
  label: string;        // Display name
  icon: string;         // Lucide icon name
  commands: PresetCommand[];
}

interface PresetCommand {
  name: string;         // "git pull", "pip install -r requirements.txt"
  command: string;      // Shell command string
  icon: string;         // Lucide icon name
  description?: string; // Optional tooltip
}

// Categories to include:
// Git: pull, push, status, log, fetch, stash, checkout, branch
// NPM: install, run build, run dev, run test, run lint, outdated, audit
// Python: python main.py, python -m venv, python -m pytest
// Pip: install -r requirements.txt, install --upgrade, freeze, list
// Rust: cargo build, cargo run, cargo test, cargo clippy, cargo fmt, cargo update
```

## Sources

- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- official frameless window + custom titlebar guide -- HIGH confidence
- [Tauri v2 Window Permissions](https://v2.tauri.app/learn/window-customization/#permissions) -- required capabilities for drag/minimize/maximize/close -- HIGH confidence
- [Tauri Snap Layouts Issue #4531](https://github.com/tauri-apps/tauri/issues/4531) -- snap layouts not supported for frameless windows -- HIGH confidence
- [Windows Terminal 0x80070002 Error](https://learn.microsoft.com/en-us/answers/questions/524832/windows-terminal-is-throwing-me-an-error-0x8007000) -- Microsoft Q&A on this specific error -- MEDIUM confidence
- [Cherry Studio 0x80070002](https://github.com/CherryHQ/cherry-studio/issues/13550) -- similar Tauri-based app hitting same error -- MEDIUM confidence
- [Tauri Opener Plugin](https://v2.tauri.app/plugin/opener/) -- official plugin for opening files/folders in system apps -- HIGH confidence
- [Stack Overflow: Rust directory size](https://stackoverflow.com/questions/60041710/how-to-check-directory-size) -- recursive directory size calculation in Rust -- HIGH confidence
- [git symbolic-ref as fastest branch method](https://unix.stackexchange.com/questions/40367/whats-the-fastest-cpu-time-way-to-get-my-current-git-branch) -- `git symbolic-ref HEAD` or `git rev-parse --abbrev-ref HEAD` -- HIGH confidence
- [Julia Evans: The "current branch" in Git](https://jvns.ca/blog/2024/03/22/the-current-branch-in-git/) -- explains .git/HEAD structure -- HIGH confidence
- [NN/g: Listboxes vs. Dropdown Lists](https://www.nngroup.com/articles/listbox-dropdown/) -- UX guidance for dual dropdown pattern -- HIGH confidence
- [shadcn/ui Dialog sizing](https://github.com/shadcn-ui/ui/issues/1870) -- community discussion on responsive dialog width -- MEDIUM confidence

---
*Feature research for: EasyPack v1.1 milestone*
*Researched: 2026-04-15*
