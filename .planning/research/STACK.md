# Stack Research -- v2.0 Milestone Additions

**Domain:** Tauri 2.x Windows 桌面项目快捷指令启动器
**Milestone:** v2.0 能力跃升
**Researched:** 2026-05-13
**Confidence:** HIGH

---

## Existing Stack (Unchanged)

The v1.2 stack remains the foundation. No upgrades or removals needed.

| Technology | Version | Status |
|------------|---------|--------|
| Tauri | 2.10.x | Unchanged |
| React | 19.x | Unchanged |
| TypeScript | 5.7.x | Unchanged |
| Vite | 6.x | Unchanged |
| Tailwind CSS | 4.x | Unchanged |
| shadcn/ui | latest | Unchanged |
| Rust | 1.77.2+ | Unchanged |
| tauri-plugin-store | 2.4.2 | Unchanged (already installed) |
| tauri-plugin-dialog | 2.x | Unchanged (already installed) |
| tauri-plugin-global-shortcut | 2.x | Unchanged (already installed) |
| tauri-plugin-single-instance | 2.x | Unchanged (already installed) |
| image | 0.25 | Unchanged (already installed) |
| @dnd-kit/react | 0.4.0 | Unchanged (already installed) |
| lucide-react | ^1.8.0 | Unchanged (already installed) |

---

## New Dependencies Required

### 1. tauri-plugin-autostart (Rust + npm) -- Feature 5: Auto-Start

| Aspect | Detail |
|--------|--------|
| **Rust crate** | `tauri-plugin-autostart` |
| **npm package** | `@tauri-apps/plugin-autostart` |
| **Version** | 2.5.x (current latest in Tauri 2 ecosystem) |
| **Purpose** | Register/unregister the app as a Windows startup program |
| **Why this plugin** | Official Tauri 2 plugin. Manages the Windows Registry `Run` key (`HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`) so EasyPack launches on login. Provides `enable()`, `disable()`, `isEnabled()` JS API. |
| **Critical bug** | **Issue #771**: On Windows, the registry entry is removed after one boot cycle. Must implement a "registry self-heal" pattern: check and re-enable on every app startup. See PITFALLS.md for details. |
| **Confidence** | HIGH -- verified via crates.io (v2.5.1) and npm (v2.5.1) |

**Cargo.toml addition:**
```toml
tauri-plugin-autostart = "2"
```

**npm install:**
```bash
npm install @tauri-apps/plugin-autostart
```

**lib.rs plugin registration:**
```rust
.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    Some(vec!["--minimized"]), // launch arg to start minimized
))
```

**JS usage pattern:**
```typescript
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

// Toggle auto-start
const currentlyEnabled = await isEnabled();
if (!currentlyEnabled) {
  await enable();
} else {
  await disable();
}
```

**Required permissions:**
```json
"autostart:allow-enable",
"autostart:allow-disable",
"autostart:allow-is-enabled"
```

---

### 2. tauri-plugin-fs (Rust + npm) -- Feature 6: Import/Export

| Aspect | Detail |
|--------|--------|
| **Rust crate** | `tauri-plugin-fs` |
| **npm package** | `@tauri-apps/plugin-fs` |
| **Version** | 2.4.x (current latest in Tauri 2 ecosystem) |
| **Purpose** | Read and write config files for import/export functionality |
| **Why this plugin** | Official Tauri 2 filesystem plugin. Provides `readTextFile()`, `writeTextFile()` APIs. Combined with `tauri-plugin-dialog`'s `save()` and `open()`, enables full import/export of user configurations. |
| **Known issue** | **Issue #7973**: `writeTextFile()` may not fully overwrite if new content is shorter than old content. Mitigation: delete file before writing, or use `writeFile()` with explicit byte array. |
| **Confidence** | HIGH -- verified via crates.io (v2.4.2) and npm (v2.4.2) |

**Cargo.toml addition:**
```toml
tauri-plugin-fs = "2"
```

**npm install:**
```bash
npm install @tauri-apps/plugin-fs
```

**lib.rs plugin registration:**
```rust
.plugin(tauri_plugin_fs::init())
```

**JS usage pattern (export):**
```typescript
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

const configJson = JSON.stringify(allConfig, null, 2);
const filePath = await save({
  defaultPath: 'easypack-config.json',
  filters: [{ name: 'JSON', extensions: ['json'] }],
});
if (filePath) {
  await writeTextFile(filePath, configJson);
}
```

**JS usage pattern (import):**
```typescript
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

const filePath = await open({
  filters: [{ name: 'JSON', extensions: ['json'] }],
  multiple: false,
});
if (filePath) {
  const content = await readTextFile(filePath);
  const config = JSON.parse(content);
  // apply imported config...
}
```

**Required permissions:**
```json
"fs:allow-read-text-file",
"fs:allow-write-text-file",
"fs:allow-exists",
"fs:allow-remove"
```

---

### 3. @uiw/react-codemirror (npm only) -- Feature 1: Script Editor

| Aspect | Detail |
|--------|--------|
| **npm package** | `@uiw/react-codemirror` |
| **Version** | ^4.25.9 (current latest) |
| **Purpose** | Code editor component for multi-line script command editing |
| **Why this library** | The standard React wrapper for CodeMirror 6. Bundle size ~70-100KB gzipped (vs Monaco Editor's ~2-4MB). Supports line numbers, syntax highlighting, custom themes, and all CodeMirror 6 extensions. Well-maintained with frequent releases. |
| **Why NOT Monaco Editor** | Monaco Editor (@monaco-editor/react) bundles at ~2-4MB -- massive overkill for editing shell scripts. It is designed for full IDE experiences (VS Code's editor). CodeMirror 6 provides 95% of needed functionality at 3% of the size. |
| **Confidence** | HIGH -- verified via npm (v4.25.9) and GitHub (uiwjs/react-codemirror) |

**npm install:**
```bash
npm install @uiw/react-codemirror
```

**Supporting package:**
```bash
npm install @codemirror/lang-shell
```

| Package | Version | Purpose |
|---------|---------|---------|
| `@codemirror/lang-shell` | latest | Shell script syntax highlighting for CodeMirror 6 |

**JS usage pattern:**
```typescript
import CodeMirror from '@uiw/react-codemirror';
import { shell } from '@codemirror/lang-shell';

function ScriptEditor({ value, onChange }) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[shell()]}
      theme="dark"
      height="200px"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
      }}
    />
  );
}
```

---

### 4. reqwest (Rust crate only) -- Feature 2: Version Check

| Aspect | Detail |
|--------|--------|
| **Rust crate** | `reqwest` |
| **Version** | 0.13 (current latest) |
| **Purpose** | HTTP client to call GitHub Releases API for update checking |
| **Why reqwest** | The de-facto standard Rust HTTP client. v0.13 defaults to `rustls` (no OpenSSL dependency on Windows). Provides async API that integrates with Tauri's tokio runtime. JSON deserialization via serde integration. |
| **Why NOT tauri-plugin-updater** | tauri-plugin-updater provides full auto-update (download + install + restart). PROJECT.md explicitly lists "auto-update" as Out of Scope -- EasyPack only needs version checking and user notification. The full updater plugin adds unnecessary complexity (signing keys, update server, bundled update mechanism). |
| **Confidence** | HIGH -- verified via crates.io (v0.13.x) |

**Cargo.toml addition:**
```toml
reqwest = { version = "0.13", features = ["json"] }
```

**Note:** No OpenSSL needed on Windows -- reqwest 0.13 defaults to `rustls-tls` which is pure Rust.

---

### 5. semver (Rust crate only) -- Feature 2: Version Comparison

| Aspect | Detail |
|--------|--------|
| **Rust crate** | `semver` |
| **Version** | 1.x (current latest 1.0.26) |
| **Purpose** | Parse and compare semantic version strings |
| **Why semver** | The standard semver implementation in Rust. Parses version strings like "1.2.3" and supports comparison operators. Used to compare the latest GitHub release version against the current installed version. |
| **Confidence** | HIGH -- verified via crates.io (v1.0.26) |

**Cargo.toml addition:**
```toml
semver = "1"
```

**Rust usage pattern:**
```rust
use semver::Version;

let current = Version::parse("1.2.0")?;
let latest = Version::parse("1.3.0")?;
if latest > current {
    // notify user about update
}
```

---

## Features Requiring NO New Dependencies

### Feature 3: Keyboard Shortcut Customization Panel

| Aspect | Detail |
|--------|--------|
| **Type** | Pure React UI component |
| **Why no new deps** | The shortcut registration/unregistration is already handled by `tauri-plugin-global-shortcut` (installed in v1.2). The panel is a custom React component that displays shortcuts in a searchable table, lets users click to rebind, and shows conflict warnings. This is UI work only. |
| **Existing dependencies used** | `@tauri-apps/plugin-global-shortcut`, `@tauri-apps/plugin-store`, shadcn/ui components |
| **Confidence** | HIGH |

### Feature 4: Floating Window Improvements

| Aspect | Detail |
|--------|--------|
| **Type** | Pure UI/layout changes to existing floating window |
| **Why no new deps** | The floating window infrastructure was built in v1.2 (WebviewWindow, alwaysOnTop, skipTaskbar). v2.0 improvements (smaller size, collapsible state, project name/icon display) are CSS and React state changes. |
| **Existing dependencies used** | `@tauri-apps/api/webviewWindow`, existing Tauri event system |
| **Confidence** | HIGH |

### Multi-line Script Execution (Backend)

| Aspect | Detail |
|--------|--------|
| **Type** | Rust logic using existing `std::process::Command` |
| **Why no new deps** | Multi-line scripts are executed by writing a temporary `.bat` file to a temp directory, then executing that `.bat` file via the existing `cmd.exe` command infrastructure. No new Rust crates needed -- `std::fs` handles file I/O, `std::env::temp_dir()` provides temp path. |
| **Existing dependencies used** | `std::process::Command` with `raw_arg()` (already in shell.rs) |
| **Confidence** | HIGH |

### App Version Display

| Aspect | Detail |
|--------|--------|
| **Type** | Frontend API call |
| **Why no new deps** | `@tauri-apps/api` (already installed) provides `getVersion()` which reads the version from `tauri.conf.json`. |
| **Existing dependencies used** | `@tauri-apps/api/app` |
| **Confidence** | HIGH |

---

## Tauri Configuration Changes Summary

### Cargo.toml Additions

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri-plugin-autostart` | 2.x | Windows startup registration |
| `tauri-plugin-fs` | 2.x | Config file read/write for import/export |
| `reqwest` | 0.13 (features: json) | GitHub Releases API HTTP client |
| `semver` | 1.x | Version string comparison |

### npm Packages to Install

| Package | Version | Purpose |
|---------|---------|---------|
| `@tauri-apps/plugin-autostart` | ^2.5.1 | Auto-start JS API |
| `@tauri-apps/plugin-fs` | ^2.4.2 | Filesystem JS API |
| `@uiw/react-codemirror` | ^4.25.9 | Script editor component |
| `@codemirror/lang-shell` | latest | Shell syntax highlighting |

### lib.rs Plugin Registration

```rust
// Add to existing plugin chain:
.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    Some(vec!["--minimized"]),
))
.plugin(tauri_plugin_fs::init())
```

### New Tauri Commands (Rust invoke handlers)

```rust
// Add to invoke_handler:
commands::version::check_for_updates,  // calls GitHub API via reqwest
```

### capabilities/default.json Additions

```json
{
  "permissions": [
    "// ... existing permissions ...",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-remove"
  ]
}
```

---

## Installation

```bash
# 1. Frontend dependencies (project root)
npm install @tauri-apps/plugin-autostart @tauri-apps/plugin-fs @uiw/react-codemirror @codemirror/lang-shell

# 2. Rust dependencies (src-tauri/ directory)
cd src-tauri
cargo add tauri-plugin-autostart@2
cargo add tauri-plugin-fs@2
cargo add reqwest@0.13 --features json
cargo add semver@1

# 3. Add shadcn/ui components needed for v2.0
cd ..
npx shadcn@latest add input       # for shortcut search in keyboard panel
npx shadcn@latest add badge        # for version display badge
npx shadcn@latest add separator    # for panel section dividers
npx shadcn@latest add tooltip      # for hover hints in shortcut panel
```

---

## Alternatives Considered

| Recommended | Alternative | Why NOT the Alternative |
|-------------|-------------|------------------------|
| **tauri-plugin-autostart** | Manual Registry API via `winreg` crate | Manual registry management requires unsafe FFI, error-prone. Official plugin handles all edge cases (including the Windows Store path scenario). |
| **tauri-plugin-autostart** | Windows Task Scheduler via `winsqlite3` or COM | Task Scheduler is overkill for a simple "run on login" toggle. More complex API, harder to debug. |
| **tauri-plugin-fs** | Rust `std::fs` direct file operations | Could use `std::fs` in a custom Tauri command, but `tauri-plugin-fs` provides scoped access with proper permission checks and a cleaner JS API. Reduces custom Rust code. |
| **@uiw/react-codemirror** | Monaco Editor (@monaco-editor/react) | Monaco is ~2-4MB for shell script editing -- absurd overhead. CodeMirror 6 provides all needed features (line numbers, syntax highlighting, themes) at ~70-100KB. |
| **@uiw/react-codemirror** | Ace Editor (react-ace) | Ace is older, less actively maintained, and has poorer React integration. CodeMirror 6 is the modern standard. |
| **@uiw/react-codemirror** | Simple `<textarea>` | No syntax highlighting, no line numbers, no error indicators. For multi-line scripts with flow control, a proper code editor is essential. |
| **reqwest** | tauri-plugin-updater | Updater provides full auto-download-and-install. PROJECT.md explicitly marks "auto-update" as Out of Scope. We only need version check + notification. |
| **reqwest** | tauri-plugin-http | Could use the official HTTP plugin, but it adds an extra plugin dependency for a single API endpoint. reqwest is a direct Rust dependency with no plugin overhead. |
| **reqwest** | ureq (blocking HTTP) | ureq is simpler but blocking. Tauri commands run in an async context; reqwest's async API integrates cleanly. |
| **semver** | String comparison for versions | String comparison fails on "1.9.0" vs "1.10.0". semver crate handles all edge cases correctly. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **tauri-plugin-updater** | Full auto-update mechanism with signing keys and update server. PROJECT.md explicitly marks auto-update as Out of Scope. Adds significant complexity for no benefit. | `reqwest` + `semver` for simple version check + notification |
| **Monaco Editor** | ~2-4MB bundle size for editing shell scripts. Designed for full IDE experiences. Web Worker setup adds complexity with Tauri's CSP restrictions. | `@uiw/react-codemirror` (~70-100KB) |
| **Ace Editor** | Legacy codebase, declining maintenance. React wrapper (`react-ace`) has compatibility issues with React 19. | `@uiw/react-codemirror` |
| **Custom Win32 Registry API** | Manual registry management via `winreg` crate is error-prone, requires handling WOW64 redirection, and duplicates what the official plugin does. | `tauri-plugin-autostart` with self-heal workaround |
| **Windows Task Scheduler** | Overkill for a simple "run on login" toggle. Requires COM API or `schtasks.exe` subprocess calls. | `tauri-plugin-autostart` |
| **Any embedded scripting engine** (Lua, Deno, QuickJS) | Adding a scripting runtime for flow control in shell scripts is massive overkill. Shell scripts themselves support if/else, variables, error handling natively. The "flow control" in v2.0 is shell script syntax, not a custom DSL. | Temp `.bat` files with native shell syntax |
| **tauri-plugin-process** | Provides `restart()` and `exit()` which we already handle via `app.exit(0)` in lib.rs. No new process management needed. | Existing Rust code |
| **CSS-in-JS libraries** (styled-components, Emotion) | Already excluded in v1.0 stack decision. Conflicts with Tailwind CSS. | Tailwind CSS utility classes |

---

## Stack Patterns by Variant

### Multi-line Script Execution Architecture

The multi-line script feature does NOT need a new Rust crate for execution. The approach:

1. **Frontend**: User writes multi-line script in CodeMirror editor
2. **Rust backend**: Receives script text, writes to temp `.bat` file in `%TEMP%/easypack/`
3. **Rust backend**: Executes the `.bat` file using existing `std::process::Command` + `raw_arg()` pattern
4. **Cleanup**: Delete temp file after execution (or on app exit)

This reuses the proven v1.1 command execution pipeline. The only addition is a `write_temp_script()` helper in Rust.

### Version Check Flow

```
App Startup / Manual Check
  -> Rust command: check_for_updates()
  -> reqwest::get("https://api.github.com/repos/{owner}/{repo}/releases/latest")
  -> Parse response JSON: tag_name field
  -> semver::Version::parse() on both current and latest
  -> Compare: if latest > current, return Some(update_info)
  -> Frontend displays notification badge / dialog
```

No persistent polling needed. Check on startup + manual "check for updates" button.

### Config Import/Export Flow

```
Export:
  1. Read all stores (projects, commands, shortcuts, settings)
  2. Merge into single JSON object with metadata (version, export date)
  3. tauri-plugin-dialog save() -> pick file path
  4. tauri-plugin-fs writeTextFile() -> write JSON

Import:
  1. tauri-plugin-dialog open() -> pick file
  2. tauri-plugin-fs readTextFile() -> read JSON
  3. Validate structure (check version, required fields)
  4. Confirmation dialog (warn about overwrite)
  5. Write imported data to stores
```

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| tauri-plugin-autostart 2.5.x | Tauri 2.10.x | Official Tauri 2 ecosystem plugin, guaranteed compatible |
| tauri-plugin-fs 2.4.x | Tauri 2.10.x | Official Tauri 2 ecosystem plugin, guaranteed compatible |
| @uiw/react-codemirror 4.25.x | React 19.x | Verified compatible (no React 18-specific APIs used) |
| @uiw/react-codemirror 4.25.x | Tailwind CSS 4.x | No style conflicts -- CodeMirror manages its own styles |
| reqwest 0.13 | tokio (Tauri's runtime) | reqwest async uses tokio by default, same as Tauri |
| reqwest 0.13 | Windows | Uses rustls (pure Rust TLS), no OpenSSL dependency |
| semver 1.0.x | serde 1.x | semver implements Serialize/Deserialize behind `serde` feature |

---

## Sources

- [tauri-plugin-autostart on crates.io](https://crates.io/crates/tauri-plugin-autostart) -- version 2.5.1 -- HIGH confidence
- [tauri-plugin-autostart on npm](https://www.npmjs.com/package/@tauri-apps/plugin-autostart) -- version 2.5.1 -- HIGH confidence
- [tauri-plugin-autostart Issue #771](https://github.com/tauri-apps/plugins-workspace/issues/771) -- Windows registry bug -- HIGH confidence
- [tauri-plugin-fs on crates.io](https://crates.io/crates/tauri-plugin-fs) -- version 2.4.2 -- HIGH confidence
- [tauri-plugin-fs on npm](https://www.npmjs.com/package/@tauri-apps/plugin-fs) -- version 2.4.2 -- HIGH confidence
- [tauri-plugin-fs Issue #7973](https://github.com/tauri-apps/tauri/issues/7973) -- writeTextFile overwrite bug -- HIGH confidence
- [@uiw/react-codemirror on npm](https://www.npmjs.com/package/@uiw/react-codemirror) -- version 4.25.9 -- HIGH confidence
- [@codemirror/lang-shell on npm](https://www.npmjs.com/package/@codemirror/lang-shell) -- shell syntax support -- HIGH confidence
- [reqwest on crates.io](https://crates.io/crates/reqwest) -- version 0.13.x, rustls default -- HIGH confidence
- [semver on crates.io](https://crates.io/crates/semver) -- version 1.0.26 -- HIGH confidence
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases) -- `GET /repos/{owner}/{repo}/releases/latest` -- HIGH confidence
- [motrix-next autostart workaround](https://github.com/nicehash/motrix-next) -- registry self-heal pattern reference -- MEDIUM confidence
- [Tauri v2 Autostart Plugin Docs](https://v2.tauri.app/plugin/autostart/) -- official plugin documentation -- HIGH confidence
- [Tauri v2 FS Plugin Docs](https://v2.tauri.app/plugin/file-system/) -- official plugin documentation -- HIGH confidence

---
*Stack research for: EasyPack v2.0 milestone*
*Researched: 2026-05-13*
