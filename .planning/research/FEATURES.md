# Feature Research

**Domain:** Windows desktop project launcher / shell command executor (Tauri + Web)
**Researched:** 2026-04-10
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these = product feels incomplete. Users assume a "project command launcher" has these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Project list with add/delete | Core identity: "manage local projects". No project list = no product. | LOW | Sidebar with folder picker dialog. Store paths in JSON. |
| One-click command execution | Core identity: "click card to run command". This IS the product. | MEDIUM | Tauri shell plugin spawn command in system terminal (Windows Terminal / cmd). Need `cmd.exe /C` or `start` wrapper. |
| Global default commands | Users expect built-in shortcuts for common dev tasks (build, start, git pull, git push). | LOW | Hardcoded default command set: `npm run build`, `npm run dev`, `git pull`, `git push`, `claude`. |
| Custom command creation | Without customization, the tool is a toy. Users have project-specific commands. | MEDIUM | Add/edit/delete commands with name, shell command string, optional icon. Persist in JSON. |
| Per-project command override | Different projects use different build tools (npm vs yarn vs pnpm, different scripts). | MEDIUM | Project can inherit global commands AND define its own. Per-project commands merge with/override globals. |
| Local data persistence | Losing project config between restarts = broken trust. | LOW | JSON file in AppData or next to executable. Serialize project paths + command sets. |
| Modern UI with card layout | The PROJECT.md specifies "card-style buttons". Modern look = basic expectation. | MEDIUM | Rounded cards with icon + label. Compact layout. CSS/Tailwind or similar. |
| System default terminal | Users already have terminal preferences. Don't reinvent. | LOW | Use `start` or `wt.exe` to open command in Windows Terminal / cmd. No embedded terminal. |

### Differentiators (Competitive Advantage)

Features that set EasyPack apart from generic launchers and developer toolbox apps.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-project + global command inheritance | Most tools are either global (PowerToys Run) or per-app (IDE task runners). EasyPack uniquely bridges "project-aware command launcher" with global defaults. | MEDIUM | Global commands as base layer; per-project commands overlay. UI shows which are inherited vs local. |
| Visual card-grid command layout | Most launchers use list/search UI. Card grid gives visual "dashboard" feel that's immediately scannable. | LOW | CSS Grid or Flexbox cards. Icon + command name + optional description. Hover states. |
| Project-aware context switching | Selecting a project in sidebar instantly changes the available commands in the card area. This "project as context" pattern is rare in desktop launchers. | MEDIUM | Selected project state drives command display. Smooth transition animation on switch. |
| Drag-and-drop command ordering | Users want frequently-used commands at top. Drag to reorder is more intuitive than up/down buttons. | MEDIUM | Requires drag library (dnd-kit or similar). Persist order in config. |
| Command grouping / categories | Group commands by type (Build, Git, Custom, AI Tools). Reduces visual clutter when many commands exist. | LOW | Simple tag/category per command. Collapsible sections in card grid. |
| Quick-add from package.json | Auto-detect `scripts` section from project's `package.json` and offer to import as commands. Saves manual entry. | HIGH | Parse package.json, present scripts as importable commands. Handle npm/yarn/pnpm. |
| Command execution history | Show last N executed commands per project. Helps recall "what did I run last". | LOW | Store timestamped log per project. Display as small list or tooltip. |
| Keyboard navigation | Power users expect keyboard-first interaction (arrow keys, Enter to execute, Escape to close). | MEDIUM | Focus management, arrow key card selection, Enter to execute, Ctrl+N for new command. |
| System tray quick access | Minimize to tray, right-click for recent projects and favorite commands. Stay out of the way. | MEDIUM | Tauri system tray plugin. Tray menu with project list + favorite commands. |
| Dark/light theme | Developer tools default to dark mode. Missing it = feels dated. | LOW | CSS variables toggle. Respect system preference via `prefers-color-scheme`. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but would undermine the product's core value or create outsized complexity.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Embedded terminal | "See output inside the app" | Enormous complexity (xterm.js, PTY management, ANSI parsing, scrollback, copy/paste). Turns a launcher into a terminal emulator. Conflicts with PROJECT.md scope. | Use system terminal. Users already have Windows Terminal with tabs, split panes, and profiles. |
| Cross-platform (macOS/Linux) | "More users" | Shell commands differ between platforms. Path separators, terminal emulators, command syntax all vary. Doubles testing surface for a personal tool. | Stay Windows-only per PROJECT.md constraints. |
| Plugin/extension system | "Community contributions" | Massive engineering effort. API surface design, sandboxing, versioning, marketplace. Overkill for a personal tool. Premature abstraction. | Allow custom commands (user-defined shell commands). That IS the extensibility model. |
| Cloud sync / remote projects | "Access from anywhere" | Adds auth, networking, encryption. Violates "local only, personal tool" identity. Sync conflicts, privacy concerns. | Local JSON files. Use Git/symlink/dropbox for manual sync if needed. |
| Real-time command output streaming | "Monitor build progress" | Requires capturing stdout/stderr, WebSocket communication, ANSI rendering. Approaches embedded terminal complexity. | Open in external terminal where user has full control. Command either succeeds or fails; tool is a launcher, not a monitor. |
| Multi-user / team features | "Share commands with team" | Requires server, auth, permissions. Completely different product category. | Export/import command config as JSON file. Share via Git repo. |
| Auto-update mechanism | "Always latest version" | Adds infrastructure (update server, code signing, delta updates). Complex for a personal tool. | Manual update. User downloads new release from GitHub. |
| Project health dashboard | "See build status, test results" | Requires CI integration, webhook parsing, status polling. Far beyond command launching. | Use dedicated CI tools (GitHub Actions dashboard, Jenkins). |

## Feature Dependencies

```
[Project List (add/delete)]
    |
    v
[Project Selection State] ──required by──> [Per-project Commands]
    |                                           |
    v                                           v
[Global Default Commands] ──merges with──> [Command Card Grid Display]
    |                                           |
    v                                           v
[Custom Command CRUD] ──feeds into──> [Command Card Grid Display]
                                                |
                                                v
                                        [Shell Command Execution]
                                                |
                                                v
                                        [Data Persistence (JSON)]
                                                |
                                    +-----------+-----------+
                                    |                       |
                                    v                       v
                            [Command History]        [System Tray]
                                    ^
                                    |
                            [Keyboard Navigation] ──enhances──> [Command Card Grid]

[Dark/Light Theme] ──independent──> [All UI Features]

[Quick-add from package.json] ──requires──> [Project List]
                                        └──requires──> [Custom Command CRUD]

[Drag-and-drop Ordering] ──requires──> [Command Card Grid Display]
                                └──requires──> [Data Persistence]

[Command Grouping] ──requires──> [Custom Command CRUD]
                        └──requires──> [Command Card Grid Display]
```

### Dependency Notes

- **Shell Command Execution requires Project Selection State:** Commands execute in the context of the selected project's directory (cwd). Without a project selected, commands have no working directory.
- **Per-project Commands requires Project List:** Cannot define per-project commands without the project entity existing first.
- **Command Card Grid Display requires both Global and Custom Commands:** The card grid renders from a merged set of global defaults + project-specific overrides.
- **Quick-add from package.json requires Project List AND Custom Command CRUD:** Must have a project selected to find its package.json, and must have the ability to create commands from parsed scripts.
- **Drag-and-drop Ordering requires Data Persistence:** Reorder state must survive app restart.
- **Keyboard Navigation enhances Command Card Grid:** Adds interaction layer but the grid must exist first. Can be added after core grid works.
- **Dark/Light Theme is independent:** Can be implemented at any point; affects only CSS variables. Low risk, low dependency.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the core concept: "select project, click card, run command."

- [ ] Project list sidebar (add/delete local project paths via folder picker) -- core identity
- [ ] Global default commands (build, start, git pull, git push, claude) -- immediate value on first use
- [ ] Custom command creation (name + shell command string, add/edit/delete) -- extensibility
- [ ] Card-style command grid that executes shell commands in system terminal -- THE product
- [ ] Per-project command override (project can define its own commands) -- project-awareness
- [ ] Local JSON persistence (projects + commands survive restart) -- basic reliability
- [ ] Modern rounded-card UI -- visual identity

### Add After Validation (v1.x)

Features to add once core loop works and is validated.

- [ ] Command execution history -- helps recall and debugging. Trigger: user asks "what did I run?"
- [ ] Keyboard navigation (arrow keys, Enter, Escape) -- power user demand. Trigger: user complaints about mouse-only workflow.
- [ ] Dark/light theme -- developer expectation. Trigger: first user feedback.
- [ ] Drag-and-drop command reordering -- personalization. Trigger: users have many commands and want control.
- [ ] Command grouping/categories -- organization at scale. Trigger: users with 10+ commands per project.
- [ ] System tray integration -- workflow integration. Trigger: user wants quick access without taskbar clutter.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Quick-add from package.json -- high value but high complexity. Requires file system watching and parsing.
- [ ] Import/export command configurations -- sharing presets across machines.
- [ ] Multiple terminal profile support (PowerShell, WSL, Git Bash) -- Windows terminal diversity.
- [ ] Global hotkey to show/hide window -- quick access pattern like PowerToys Run.
- [ ] Auto-detect project type (Node, Python, Rust) and suggest default commands -- smart defaults.
- [ ] Multi-select batch command execution -- run "git pull" across all projects.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Project list sidebar | HIGH | LOW | P1 |
| Card-style command grid | HIGH | MEDIUM | P1 |
| Shell command execution (system terminal) | HIGH | MEDIUM | P1 |
| Global default commands | HIGH | LOW | P1 |
| Local JSON persistence | HIGH | LOW | P1 |
| Custom command CRUD | HIGH | MEDIUM | P1 |
| Per-project command override | HIGH | MEDIUM | P1 |
| Modern rounded-card UI | HIGH | MEDIUM | P1 |
| Dark/light theme | MEDIUM | LOW | P2 |
| Keyboard navigation | MEDIUM | MEDIUM | P2 |
| Command execution history | MEDIUM | LOW | P2 |
| Command grouping/categories | MEDIUM | LOW | P2 |
| Drag-and-drop reordering | LOW | MEDIUM | P2 |
| System tray integration | LOW | MEDIUM | P2 |
| Quick-add from package.json | MEDIUM | HIGH | P3 |
| Import/export config | LOW | LOW | P3 |
| Multiple terminal profiles | LOW | MEDIUM | P3 |
| Global hotkey show/hide | LOW | MEDIUM | P3 |
| Auto-detect project type | LOW | HIGH | P3 |
| Batch command execution | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (8 features -- all from MVP definition)
- P2: Should have, add when possible after core works (6 features)
- P3: Nice to have, future consideration (5 features)

## Competitor Feature Analysis

| Feature | PowerToys Run / Command Palette | DevToys | Project Launcher (MS Store) | EasyPack (Our Approach) |
|---------|--------------------------------|---------|-----------------------------|-------------------------|
| Project management | No (file-level only) | No (utility toolkit) | Yes (IDE project discovery) | Yes (manual folder paths) |
| Custom shell commands | Via plugins (complex) | No (fixed tool set) | No (opens IDEs only) | Yes (user-defined command cards) |
| Visual card/button layout | No (search list) | Yes (tool grid) | No (search overlay) | Yes (card grid, core UI) |
| Per-project commands | No | No | No | Yes (project-aware context) |
| Global default commands | System-level only | 30+ built-in tools | IDE detection only | Yes (build, start, git, claude) |
| System tray | No (overlay UI) | No | Yes | Planned (v1.x) |
| Extensibility | Plugin API (C#) | Extension system | No | Custom commands (user-extensible) |
| Terminal integration | No | No | No (opens IDE) | External terminal execution |
| Data persistence | Windows settings | App state | Local cache | JSON file |
| Cross-platform | Windows only | Cross-platform | Windows only | Windows only (by design) |
| Keyboard-first | Yes (Alt+Space) | Partial | Yes (keyboard-first) | Planned (v1.x) |

### Competitive Position

EasyPack occupies a unique niche that no existing tool fills:

1. **PowerToys Run / Command Palette** -- general launcher, no project awareness, no custom command cards
2. **DevToys** -- utility toolbox (encoders, formatters), not a command executor
3. **Project Launcher (MS Store)** -- finds and opens projects in IDEs, but doesn't run shell commands
4. **RunJS** -- language-specific playground, not a general project command tool
5. **LocalCan** -- local dev environment manager (DNS, tunnels), not a command launcher
6. **He3** -- developer utilities toolbox (200+ tools), not project-aware

The gap EasyPack fills: **project-aware shell command launcher with visual card UI**. No tool combines project context, custom command management, and card-style visual layout into one focused experience.

## Sources

- [DevToys Official Site](https://devtoys.app/) -- developer utility toolbox, 30+ built-in tools
- [Project Launcher (Microsoft Store)](https://apps.microsoft.com/detail/9mz0lbgclw6c) -- tray-first project launcher, IDE detection
- [RunJS Official Site](https://runjs.app/) -- JavaScript playground with live feedback
- [LocalCan Official Site](https://www.localcan.com/) -- local dev environment manager
- [He3 on Microsoft Store](https://apps.microsoft.com/detail/xpfff89kr9c9vw) -- 200+ developer utilities
- [PowerToys Command Palette](https://learn.microsoft.com/en-us/windows/powertoys/command-palette/overview) -- extensible command palette for Windows
- [Tauri Shell Plugin v2](https://v2.tauri.app/plugin/shell/) -- shell command execution in Tauri
- [Tauri System Tray v2](https://v2.tauri.app/learn/system-tray/) -- system tray integration
- [Evil Martians: Tauri Sidecar](https://evilmartians.com/chronicles/making-desktop-apps-with-revved-up-potential-rust-tauri-sidecar) -- external binary execution patterns
- [npm-gui](https://www.npmjs.com/package/npm-gui) -- GUI for npm package management

---
*Feature research for: Windows desktop project launcher / shell command executor*
*Researched: 2026-04-10*
