# Project Research Summary

**Project:** EasyPack v2.0
**Domain:** Tauri 2 + React Windows desktop project launcher -- v2.0 milestone
**Researched:** 2026-05-13
**Confidence:** HIGH

## Executive Summary

EasyPack v2.0 aims to upgrade the app from a single-line command executor to a professional developer desktop tool with multi-line scripting, full keyboard shortcut management, and multi-config profiles. All 6 new features fit into the existing v1.x architecture (Rust invoke + tauri-plugin-store + Tauri event system) without new architectural paradigms. Key challenges are multi-line script command injection prevention and multi-config store layer restructuring.

Research identifies 4 new dependencies: tauri-plugin-autostart (boot start), tauri-plugin-fs (config import/export), @uiw/react-codemirror (script editor), reqwest + semver (version check). Two features (shortcut panel, floating window improvements) are pure UI changes needing no new dependencies. Two features (boot start, version check) have mature official solutions for quick delivery. Multi-line scripting is the v2.0 core value proposition. Multi-config profiles have the highest complexity and should come last.

Three critical risks: command injection in multi-line scripts (must use temp .bat files, never concatenate into command args), race conditions during config profile switching (need Promise-chain mutex), and tauri-plugin-autostart Windows registry entry loss bug (need startup self-repair).

## Key Findings

### Recommended Stack Additions

v1.2 stack fully retained. v2.0 adds 4 Rust crates and 4 npm packages:

**Core technologies (new):**
- tauri-plugin-autostart 2.x: Windows registry boot start, official plugin
- tauri-plugin-fs 2.x: config file read/write, official plugin
- @uiw/react-codemirror ^4.25.9 + @codemirror/lang-shell: lightweight code editor (~70-100KB)
- reqwest 0.13 (features: json) + semver 1.x: Rust HTTP client + version comparison

**No new dependencies needed for:**
- Shortcut panel: pure React UI, reuses v1.2 tauri-plugin-global-shortcut
- Floating window collapse: pure CSS + WebviewWindow.setSize(), reuses v1.2 infrastructure
- Multi-line script backend: std::process::Command + temp .bat files

**shadcn/ui components to add:** input, badge, separator, tooltip

### Expected Features

**Must have (table stakes):**
- F1: Multi-line script commands -- v2.0 core value upgrade
- F2: Version display + update check -- basic desktop app expectation
- F5: Auto-start on boot -- standard for persistent desktop tools
- F6: Multi-config profiles -- power user necessity with backward-compatible migration

**Should have (competitive):**
- F3: VS Code-style shortcut panel -- significant UX polish
- F4: Collapsible floating window -- power-user refinement
- Built-in script templates -- lower user barrier
- Import preview + security audit -- prevent malicious config propagation

**Defer (v2.1+):**
- Multi-profile hot switching -- can start with import/export only
- PowerShell script support -- cmd.exe first
- Script template marketplace -- community feature
- Real-time output stream -- requires embedded terminal

### Architecture Approach

All v2.0 features integrate into existing architecture: Rust backend exposes commands via invoke(), frontend manages state via React hooks, tauri-plugin-store persists data, Tauri event system handles cross-window communication.

**Major components (new/modified):**
1. shell.rs (Modified) -- add execute_script command, multi-line scripts via temp .bat files
2. version.rs (New) -- GitHub Releases API version check with reqwest + semver
3. useProfiles.ts (New) -- multi-config CRUD, switching, import/export
4. ShortcutPanel.tsx (New) -- VS Code-style shortcut management panel
5. useAutoStart.ts (New) -- boot start toggle control
6. useVersion.ts (New) -- version check state + caching
7. FloatApp.tsx (Modified) -- collapse/expand UI + project switching
8. useProject.ts (Modified) -- profile-prefixed store keys, data migration
9. CommandDialog.tsx (Modified) -- single-line/multi-line mode toggle

### Critical Pitfalls

1. **Multi-line script command injection (CRITICAL)** -- Never concatenate script content into command args. Must write to temp .bat file with chcp 65001 >/dev/null prefix, clean up after execution.
2. **Temp file encoding corruption (CRITICAL)** -- Windows cmd.exe defaults to GBK, Rust defaults to UTF-8. Without chcp 65001, Chinese path projects break completely.
3. **Malicious script injection via config import (HIGH)** -- Imported JSON may contain dangerous commands. Must scan for dangerous patterns + confirmation dialog.
4. **Config switching race condition (HIGH)** -- Rapid profile switching corrupts store data. Use Promise-chain mutex to serialize all switch operations.
5. **Boot start registry entry loss (HIGH)** -- tauri-plugin-autostart known bug (Issue #771). Startup verification + self-repair required.

## Implications for Roadmap

### Phase 1: Boot Start
**Rationale:** Simplest, most independent, lowest risk. Quick win to validate v2.0 pipeline.
**Delivers:** SettingsDialog boot start toggle + startup self-repair verification
**Addresses:** F5 (Auto-start)
**Uses:** tauri-plugin-autostart
**Avoids:** Registry loss pitfall (built-in self-repair)

### Phase 2: Version Management
**Rationale:** Independent, simple. GitHub API + semver is standard.
**Delivers:** TitleBar version number + update check + notification dialog
**Addresses:** F2 (Version check)
**Uses:** reqwest 0.13, semver 1.x
**Avoids:** API rate limit pitfall (24h cache + silent failure)

### Phase 3: Multi-line Script Commands
**Rationale:** v2.0 core value, highest user impact. Temp .bat approach is safe and practical. Must precede shortcut panel.
**Delivers:** CommandDialog single/multi-line toggle + CodeMirror editor + Rust execute_script + temp file execution + error strategy
**Addresses:** F1 (Multi-line scripts)
**Uses:** @uiw/react-codemirror, @codemirror/lang-shell, std::process::Command
**Avoids:** Command injection (temp file), encoding corruption (chcp 65001)
**Research needed:** YES -- CodeMirror 6 + Tauri WebView CSP, .bat encoding on Chinese Windows

### Phase 4: Shortcut Panel
**Rationale:** Pure frontend, reuses v1.2 logic. Depends on Phase 3.
**Delivers:** VS Code-style shortcut management + search/filter + recording + conflict detection
**Addresses:** F3 (Shortcut panel)
**Uses:** Existing useGlobalShortcuts, assignShortcut, clearShortcut

### Phase 5: Floating Window Improvements
**Rationale:** Independent, modifies existing components. Medium complexity.
**Delivers:** Collapsible floating window + collapsed project switching + state persistence
**Addresses:** F4 (Collapsible float window)
**Uses:** WebviewWindow.setSize(), CSS transition
**Avoids:** DWM hiding tiny windows (min height >= 48px)
**Research needed:** YES -- Tauri v2 setWindowSize + DWM behavior

### Phase 6: Multi-config Profile System
**Rationale:** Most complex, full store restructuring. Must come last. Can start with import/export only, defer hot switching to v2.1.
**Delivers:** Profile CRUD + import/export + data migration (optional: hot switching)
**Addresses:** F6 (Multi-config profiles)
**Uses:** tauri-plugin-fs, tauri-plugin-dialog, profile-prefixed store keys
**Avoids:** Switching race condition (mutex), import security (pattern scan), migration failure (backward compat)
**Research needed:** YES -- store migration strategy, React state consistency during switch

### Phase Ordering Rationale

- Phase 1-2 independent and simple, can parallelize, validate v2.0 pipeline
- Phase 3 is core value, precedes Phase 4 (multi-line commands need shortcuts)
- Phase 5 independent, can follow or parallel with Phase 3-4
- Phase 6 touches global data layer, must come after all other features stabilize
- Security pitfalls handled within each phase, never deferred

### Research Flags

**Needs deeper research:**
- Phase 3 (multi-line scripts): CodeMirror 6 integration, temp .bat encoding
- Phase 5 (floating window): Tauri v2 resize + DWM behavior
- Phase 6 (multi-config): store migration, profile switch consistency

**Standard patterns (skip research-phase):**
- Phase 1 (boot start): official plugin, mature docs
- Phase 2 (version management): standard HTTP + semver
- Phase 4 (shortcut panel): pure frontend, VS Code reference

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new deps verified on crates.io/npm with official docs |
| Features | HIGH | 6 features with detailed tech approaches and complexity estimates |
| Architecture | HIGH | Based on full codebase review, mapped to existing components |
| Pitfalls | HIGH | 7 critical/high pitfalls with specific prevention code |

**Overall confidence:** HIGH

### Gaps to Address

- **CodeMirror 6 + Tauri WebView CSP:** Verify Worker scripts pass Tauri CSP. May need inline Worker mode.
- **Temp .bat file cleanup:** Delete immediately vs batch on exit. Terminal still open requires delayed cleanup.
- **tauri-plugin-fs writeTextFile bug (Issue #7973):** Use delete-before-write workaround.
- **Hot switching vs import/export only:** Architecture suggests start with import/export, defer hot switching to v2.1.
- **Autostart --autostarted param detection:** Tauri 2 CLI args API needs confirmation.

## Sources

### Primary (HIGH confidence)
- Tauri v2 Official Docs -- plugin docs, window API, event system
- tauri-plugin-autostart (crates.io v2.5.1) -- boot start plugin
- tauri-plugin-fs (crates.io v2.4.2) -- filesystem plugin
- @uiw/react-codemirror (npm v4.25.9) -- code editor component
- reqwest (crates.io v0.13) -- Rust HTTP client
- semver (crates.io v1.0.26) -- version comparison
- GitHub REST API: Releases -- version check endpoint
- VS Code Keybindings -- shortcut panel UX reference

### Secondary (MEDIUM confidence)
- Bishop Fox: Tauri Security Audit -- XSS -> Shell -> RCE attack path
- tauri-plugin-autostart Issue #771 -- Windows registry loss bug
- tauri-plugin-fs Issue #7973 -- writeTextFile overwrite bug
- cmd.exe CHCP 65001 for UTF-8 -- encoding solution

### Tertiary (needs validation)
- Cal.com AI Desktop Tauri Notes -- resizable: false may affect programmatic resize
- motrix-next autostart workaround -- registry self-repair pattern reference

---
*Research completed: 2026-05-13*
*Ready for roadmap: yes*
