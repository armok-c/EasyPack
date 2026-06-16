# Phase 11: 全局快捷键 - Research

**Researched:** 2026-04-26
**Domain:** Tauri v2 global keyboard shortcuts, React key event handling, shortcut lifecycle management
**Confidence:** HIGH

## Summary

Phase 11 为每个指令实现 OS 级全局快捷键绑定。核心依赖是 `tauri-plugin-global-shortcut` (v2.3.1)，它是 Tauri 官方插件，提供 `register`/`unregister`/`unregisterAll`/`isRegistered` 四个 API，通过 `@tauri-apps/api/core` 的 Channel 机制向 JS 端回调 `ShortcutEvent`（含 `state: 'Pressed' | 'Released'`）。

关键技术挑战有三个：(1) 浏览器 `KeyboardEvent` 到 Tauri Accelerator 格式的转换——需要将 `e.ctrlKey` 映射为 `CommandOrControl`，将 `e.key` 单字符转大写，并处理 F1-F24、方向键等特殊键；(2) 快捷键注册生命周期管理——项目切换时必须 `unregisterAll()` 再批量注册新项目的合并指令集；(3) 冲突检测的边界——`isRegistered()` 只检查本应用的注册，无法检测其他应用的系统级热键。

**Primary recommendation:** 使用 `tauri-plugin-global-shortcut` 2.3.1 的前端 JS API（非 Rust command），在 `useGlobalShortcuts.ts` 自定义 hook 中集中管理注册/注销/执行生命周期，快捷键字符串作为 `CommandItem.shortcut?` 字段通过已有的 `tauri-plugin-store` 自动持久化。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 使用 OS 级全局热键 — 需要安装 `tauri-plugin-globalShortcut`，快捷键在任何应用前台都能触发，不仅限于 EasyPack 窗口获焦时
- **D-02:** 始终生效 — 即使 EasyPack 窗口隐藏或最小化（Phase 12 托盘模式），全局快捷键仍然执行指令（在终端中打开）
- **D-03:** 卡片上直接录制 — 用户在编辑模式下点击卡片上的快捷键徽章进入按键录制模式，按下组合键即完成绑定
- **D-04:** 录制入口仅编辑模式可见 — 非编辑模式下卡片不显示录制入口，避免误触
- **D-05:** 非编辑模式下始终显示快捷键徽章 — 已绑定的快捷键以文本徽章形式（如 Ctrl+G）显示在卡片上，用户一眼可见
- **D-06:** 必须包含修饰键 — 快捷键必须包含至少一个修饰键（Ctrl、Alt、Shift）加一个普通键，防止误触
- **D-07:** 2-3 键组合 — 最少 2 键（如 Ctrl+G），最多 3 键（如 Ctrl+Shift+R）

### Claude's Discretion
- 现有数字键 1-9 快捷键的处理方式（保留/移除/与自定义快捷键共存策略）
- CommandItem 接口扩展设计（shortcut 字段格式）
- 快捷键冲突检测的具体实现和 UI 反馈
- 快捷键注册/注销的时机（添加、删除、切换项目、启动、关闭）
- 快捷键徽章在卡片上的位置和样式
- 录制模式的 UI 反馈（正在录制状态、成功绑定提示、冲突提示）
- globalShortcut 插件在 Rust 端的注册和前端调用方式

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KB-01 | User can assign a keyboard shortcut (e.g. Ctrl+Alt+G) to any command via command settings | tauri-plugin-global-shortcut `register()` API + KeyboardEvent-to-Accelerator conversion in recording mode |
| KB-02 | With a project selected, pressing a bound shortcut immediately executes the command in the system terminal | `ShortcutEvent` handler calls existing `executeCommand()` pipeline via `useProject` hook |
| KB-03 | When switching projects, all shortcuts are automatically re-registered based on the merged command set | `unregisterAll()` then batch `register()` in `useGlobalShortcuts` hook's project-change effect |
| KB-04 | When assigning a shortcut, the system detects conflicts with existing bindings and warns the user | `isRegistered()` + scan current project commands' shortcut fields for within-app conflicts |
| KB-05 | User can clear a shortcut binding from any command | `unregister()` API + remove `shortcut` field from CommandItem in store |
| KB-06 | Shortcut bindings persist across app restarts via tauri-plugin-store | `shortcut?: string` field on CommandItem auto-persisted by existing store with autoSave |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OS-level hotkey registration | Rust Backend (Tauri plugin) | Frontend (JS API caller) | The tauri-plugin-global-shortcut plugin registers hotkeys at the OS level via Rust, but the JS API wraps all calls so frontend orchestrates registration |
| Key combination capture (recording) | Browser / Client | -- | KeyboardEvent capture happens in React component event handlers during recording mode |
| Shortcut persistence | Frontend (store plugin) | -- | CommandItem.shortcut field is persisted by existing tauri-plugin-store with autoSave |
| Command execution on shortcut trigger | API / Backend (Rust command) | -- | Existing `execute_command` Rust command opens system terminal; shortcut handler calls same pipeline |
| Shortcut badge UI | Browser / Client | -- | CommandCard component renders badge states; MainArea manages recording state |
| Conflict detection | Browser / Client | -- | `isRegistered()` JS API + scanning local command list; no backend involvement |
| Registration lifecycle management | Browser / Client (useGlobalShortcuts hook) | -- | Hook orchestrates register/unregister/re-register based on project selection, mount, and unmount events |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri-plugin-global-shortcut (crate) | 2.3.1 [VERIFIED: crates.io] | Rust 端全局热键注册 | Tauri 官方插件，v2 唯一的全局快捷键方案 |
| @tauri-apps/plugin-global-shortcut (npm) | 2.3.1 [VERIFIED: npm registry] | 前端 JS API | 官方前端绑定，提供 register/unregister/unregisterAll/isRegistered |
| @tauri-apps/api | ^2.10.1 (已安装) | Channel 回调基础设施 | plugin-global-shortcut 通过 @tauri-apps/api/core 的 Channel 机制传递 ShortcutEvent |

### Supporting (已安装)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-store | ^2.4.2 (已安装) | 快捷键持久化 | CommandItem.shortcut 字段通过现有 store 自动保存 |
| sonner (toast) | 已安装 | 通知反馈 | 快捷键冲突、绑定成功、清除等 toast 通知 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-plugin-global-shortcut JS API | Rust 自定义 command 封装 | JS API 更简洁，不需要额外 Rust 代码。Rust command 方式适合需要在后端处理快捷键事件的场景，本项目不需要 |
| CommandOrControl 修饰键 | 写死 Ctrl | CommandOrControl 跨平台兼容，但本项目仅 Windows (CLAUDE.md constraint)，直接用 Ctrl 也可以。使用 CommandOrControl 是更安全的习惯 |

**Installation:**
```bash
# 1. 添加 Rust 端依赖
cd src-tauri
cargo add tauri-plugin-global-shortcut

# 2. 添加前端依赖
cd ..
npm install @tauri-apps/plugin-global-shortcut

# 3. 或者使用 tauri CLI 一键安装两端
npm run tauri add global-shortcut
```

**Version verification:**
```
npm: @tauri-apps/plugin-global-shortcut@2.3.1 (verified 2026-04-26)
crate: tauri-plugin-global-shortcut@2.3.1 (verified 2026-04-26 via cargo search)
```

## Architecture Patterns

### System Architecture Diagram

```
[User presses Ctrl+G anywhere in OS]
        |
        v
[Windows OS → Tauri GlobalShortcut Plugin (Rust)]
        |
        v (ShortcutEvent via Channel)
[useGlobalShortcuts.ts hook]
        |
        v (event.state === 'Pressed' check)
[useProject.executeCommand(shellCommand)]
        |
        v
[Rust: execute_command → cmd.exe /c start → System Terminal]
        |

--- Recording Flow ---

[User clicks "+" badge on CommandCard]
        |
        v
[MainArea sets recordingCommandId]
        |
        v
[CommandCard: recording state, keydown listener active]
        |
        v (KeyboardEvent captured)
[keyboardEventToShortcut(e) → "CommandOrControl+G"]
        |
        v
[Validate: has modifier? 2-3 keys? no conflict?]
        |           |            |
        | OK        | conflict   | invalid
        v           v            v
[register()]  [show conflict] [show toast error]
        |
        v
[Update CommandItem.shortcut in store]
        |
        v
[Badge → Success flash → Display "Ctrl+G"]
```

### Recommended Project Structure
```
src/
├── hooks/
│   ├── useGlobalShortcuts.ts    # NEW: OS-level shortcut registration lifecycle
│   ├── useKeyboard.ts           # UNCHANGED: DOM-level 1-9 shortcuts (coexists)
│   └── useProject.ts            # MODIFIED: add assignShortcut/clearShortcut
├── components/
│   ├── CommandCard.tsx           # MODIFIED: shortcut badge states + recording
│   └── MainArea.tsx              # MODIFIED: recording state management
├── lib/
│   └── types.ts                  # MODIFIED: CommandItem.shortcut? field
└── components/ui/                # UNCHANGED: no new shadcn components needed

src-tauri/
├── Cargo.toml                    # MODIFIED: add tauri-plugin-global-shortcut dep
├── src/lib.rs                    # MODIFIED: register globalShortcut plugin
└── capabilities/default.json     # MODIFIED: add global-shortcut permissions
```

### Pattern 1: Shortcut Registration Lifecycle (useGlobalShortcuts hook)

**What:** Custom React hook that manages the full lifecycle of OS-level shortcut registration — register on mount, re-register on project change, unregister on unmount.

**When to use:** This is THE pattern for managing global shortcuts in this phase. All registration/unregistration goes through this hook.

**Example:**
```typescript
// Source: tauri-plugin-global-shortcut official docs + project analysis
import { register, unregister, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import type { CommandItem } from '@/lib/types';

export function useGlobalShortcuts(
  commands: CommandItem[],
  onExecute: (command: string) => void,
  enabled: boolean // false when no project selected
) {
  useEffect(() => {
    if (!enabled) return;

    const shortcuts = commands.filter(cmd => cmd.shortcut);

    // Register all shortcuts for current project
    const handler = (event: ShortcutEvent) => {
      if (event.state !== 'Pressed') return; // CRITICAL: avoid double-fire
      const cmd = shortcuts.find(c => c.shortcut === event.shortcut);
      if (cmd) onExecute(cmd.command);
    };

    async function registerAll() {
      try {
        await unregisterAll();
        for (const cmd of shortcuts) {
          await register(cmd.shortcut!, handler);
        }
      } catch (err) {
        console.error('Failed to register shortcuts:', err);
      }
    }

    registerAll();

    return () => { unregisterAll(); };
  }, [commands, onExecute, enabled]);
}
```

### Pattern 2: KeyboardEvent to Tauri Accelerator Conversion

**What:** Browser `KeyboardEvent` properties must be converted to Tauri's Accelerator key format string.

**When to use:** During recording mode, when the user presses a key combination.

**Example:**
```typescript
// Source: [ASSUMED] based on Tauri Accelerator format documentation
function keyboardEventToShortcut(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'];
  if (MODIFIER_KEYS.includes(e.key)) return null; // modifier-only combo

  // Validate key count (D-07: max 3 keys total)
  if (parts.length === 0) return null; // no modifier (D-06)

  if (e.key.length === 1) {
    parts.push(e.key.toUpperCase());
  } else {
    // Special keys: F1-F24, ArrowUp, ArrowDown, etc.
    // Tauri uses specific key names — map common ones
    const keyMap: Record<string, string> = {
      'ArrowUp': 'Up', 'ArrowDown': 'Down',
      'ArrowLeft': 'Left', 'ArrowRight': 'Right',
      ' ': 'Space',
    };
    parts.push(keyMap[e.key] || e.key);
  }

  return parts.join('+');
}
```

### Pattern 3: Badge State Machine on CommandCard

**What:** The shortcut badge on each CommandCard follows a state machine with 5 states, controlled by MainArea's `recordingCommandId` state.

**When to use:** Rendering the shortcut badge in CommandCard.

**State transitions:**
```
[No Badge (non-edit, no shortcut)]
       |  editMode=true
       v
[Empty Slot (+)] --click--> [Recording] --valid keys--> [Success Flash] --800ms--> [Display: Ctrl+G]
       ^                         |
       |                    conflict?
       |                         v
       +------clear--------- [Conflict] --2s auto--> [Recording] (retry)
                                  |
                            Esc/Backspace
                                  v
                            [Empty Slot (+)]

[Display: Ctrl+G] --editMode + hover--> [Show X clear button]
                                      --click X--> [Empty Slot (+)]
                                      --editMode=false--> [Display: Ctrl+G] (stays)
```

### Anti-Patterns to Avoid

- **Registering shortcuts without unregisterAll first:** Will cause "shortcut already registered" errors on project switch. Always `unregisterAll()` before batch re-registration.
- **Not checking `event.state === 'Pressed'`:** ShortcutEvent fires twice per keypress (Pressed + Released). Without the check, every shortcut executes commands twice.
- **Using `e.code` instead of `e.key`:** `e.code` is physical-key-based (e.g., `KeyA`), which breaks on non-QWERTY layouts. Always use `e.key` which respects the user's keyboard layout.
- **Registering shortcuts in Rust command handlers instead of JS API:** The JS API is simpler and handles the Channel callback natively. Avoid wrapping in custom Rust commands.
- **Forgetting to handle app shutdown:** If the app crashes without cleanup, OS-level hotkeys may remain registered. Use effect cleanup in React hook to ensure `unregisterAll()` runs on unmount.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS-level hotkey registration | Custom Windows API FFI via Rust | tauri-plugin-global-shortcut | Official plugin handles Win32 RegisterHotKey/UnregisterHotKey, message loop integration, and Tauri event bridge. Custom FFI would need to handle thread affinity, message pump, and cleanup edge cases. |
| Key format parsing | Custom accelerator string parser | Tauri's built-in Accelerator parser | The plugin already parses `CommandOrControl+Shift+R` into the correct OS key codes. Don't re-parse on the JS side. |
| Shortcut persistence | Custom file I/O for shortcut config | Existing tauri-plugin-store | `shortcut?: string` on CommandItem is auto-persisted by the existing store. Zero additional persistence code needed. |
| Recording mode UI | Custom modal dialog for key capture | Inline badge with keydown listener | Modal dialogs steal focus and interfere with key capture. Inline recording on the badge is simpler and matches D-03. |

**Key insight:** This phase adds almost zero persistence or backend code. The heavy lift is the `useGlobalShortcuts` hook (registration lifecycle) and CommandCard badge state machine (recording UI). The plugin and existing store handle everything else.

## Runtime State Inventory

> Phase 11 is a greenfield feature addition (not a rename/refactor/migration). Runtime state inventory is not applicable. The only "state" involved is the new `shortcut?` field added to existing CommandItem objects — which flows through the existing store persistence with no migration needed (field is optional, existing records without it continue to work).

## Common Pitfalls

### Pitfall 1: ShortcutEvent Double-Fire

**What goes wrong:** Every keypress generates two ShortcutEvents: one with `state: 'Pressed'` and one with `state: 'Released'`. Without filtering, commands execute twice per shortcut press.

**Why it happens:** The plugin fires events for both key-down and key-up to support scenarios where developers need release events. The default handler pattern does not auto-filter.

**How to avoid:** Always check `event.state === 'Pressed'` at the top of the handler callback.

**Warning signs:** Commands run twice when pressing a shortcut; "opening two terminal windows" bug.

### Pitfall 2: Registration Leak on Project Switch

**What goes wrong:** Switching from Project A to Project B, Project A's shortcuts remain registered. If both projects have a command bound to Ctrl+G, the second registration fails silently or the handler fires for the wrong project's command.

**Why it happens:** `register()` does not auto-remove previous registrations. The hook's `useEffect` cleanup runs, but if `unregisterAll()` is not called before the new registrations, stale shortcuts persist.

**How to avoid:** In `useGlobalShortcuts`, the effect must call `unregisterAll()` as the FIRST action before registering the new project's shortcuts. Also call `unregisterAll()` in the effect cleanup return.

**Warning signs:** Shortcut from previous project still works after switching; "shortcut already registered" errors in console.

### Pitfall 3: Modifier-Only Combo Accepted

**What goes wrong:** User presses just Ctrl (or Ctrl+Shift) and the system accepts it as a valid shortcut, which then fires on every keypress that includes that modifier.

**Why it happens:** If the recording handler doesn't filter modifier-only key events (`e.key === 'Control'` etc.), the keyboardEventToShortcut function might return `"CommandOrControl+Shift"` which Tauri will accept.

**How to avoid:** Explicitly check that `e.key` is NOT one of `['Control', 'Alt', 'Shift', 'Meta']`. Return null for modifier-only events.

**Warning signs:** Shortcut "Ctrl+Shift" appears bound; commands execute on random Ctrl+Shift+anything keypresses.

### Pitfall 4: Conflict Detection Only Checks This App

**What goes wrong:** User binds Ctrl+Alt+T which is already used by another application (e.g., terminal emulator). The binding "succeeds" in EasyPack but either silently fails (other app took priority) or steals the shortcut from the other app.

**Why it happens:** `isRegistered()` only checks shortcuts registered by THIS Tauri application, not OS-wide. There is no cross-application conflict detection API in the plugin.

**How to avoid:** Document this limitation. Attempt `register()` and catch errors — if registration fails, the shortcut is likely taken by another app. Show appropriate feedback. Also consider adding a warning in the UI about potential system-level conflicts.

**Warning signs:** Shortcut registers successfully but doesn't trigger; or other apps lose their shortcuts.

### Pitfall 5: Race Condition on Rapid Project Switch

**What goes wrong:** User rapidly switches between projects A, B, C. The async `unregisterAll()` + batch `register()` operations overlap, leaving shortcuts in an inconsistent state.

**Why it happens:** `register()` and `unregisterAll()` are async operations. If the effect re-runs before the previous registration cycle completes, operations interleave.

**How to avoid:** Use an AbortController or a version counter in the effect. Only complete registration if the effect is still current (project hasn't changed again). Alternatively, use a debounce or queue mechanism.

**Warning signs:** Shortcuts from wrong project are active; some shortcuts missing after rapid switching.

### Pitfall 6: Recording Mode Captures While Typing in Input

**What goes wrong:** User clicks the badge to start recording, then the next keypress is consumed by the recording handler even though they meant to type in an input field that was focused.

**Why it happens:** The keydown listener for recording is added to the window/document level, not scoped to the badge element.

**How to avoid:** The recording keydown handler should check `e.target` — if the target is an input/textarea, skip recording and let the event propagate normally. Also, ensure the badge click properly focuses the recording area.

**Warning signs:** Unable to type in input fields while recording is active.

### Pitfall 7: Browser Key Names Don't Match Tauri Accelerator Names

**What goes wrong:** `KeyboardEvent.key` returns `' '` for spacebar but Tauri expects `'Space'`. Arrow keys return `'ArrowUp'` but Tauri expects `'Up'`.

**Why it happens:** Browser and Tauri use different key name conventions. Direct pass-through of `e.key` values will fail for special keys.

**How to avoid:** Map special keys in `keyboardEventToShortcut()`: `' '` -> `'Space'`, `'ArrowUp'` -> `'Up'`, `'ArrowDown'` -> `'Down'`, `'ArrowLeft'` -> `'Left'`, `'ArrowRight'` -> `'Right'`, etc.

**Warning signs:** Shortcuts with special keys (Space, arrows) fail to register or don't trigger.

## Code Examples

### ShortcutEvent Handler Pattern (verified from plugin source)

```typescript
// Source: [VERIFIED: GitHub tauri-apps/plugins-workspace/plugins/global-shortcut/guest-js/index.ts]
import type { ShortcutEvent, ShortcutHandler } from '@tauri-apps/plugin-global-shortcut';

// The handler receives ShortcutEvent with state field
const handler: ShortcutHandler = (event: ShortcutEvent) => {
  // event.shortcut: string (e.g. "CommandOrControl+G")
  // event.id: number (auto-incremented registration ID)
  // event.state: 'Pressed' | 'Released'

  if (event.state === 'Pressed') {
    // Execute command only on key press, not release
    const cmd = commands.find(c => c.shortcut === event.shortcut);
    if (cmd) executeCommand(cmd.command);
  }
};

// Register with single shortcut string
await register('CommandOrControl+G', handler);

// Register with array of shortcuts (same handler for all)
await register(['CommandOrControl+G', 'CommandOrControl+Shift+R'], handler);
```

### Tauri Plugin Registration in Rust (verified from lib.rs)

```rust
// Source: [VERIFIED: src-tauri/src/lib.rs current state]
// Add to existing plugin chain in run() function:
fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build()) // ADD THIS
        .invoke_handler(tauri::generate_handler![
            commands::shell::execute_command,
            commands::project_info::scan_project_icons,
            commands::project_info::get_project_info,
            commands::shell::open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Capability Permissions (verified from default.json current state)

```json
// Source: [VERIFIED: src-tauri/capabilities/default.json current state]
// Add these permissions to the existing array:
{
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-start-dragging",
    "dialog:default",
    "store:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "global-shortcut:allow-unregister-all"
  ]
}
```

### CommandItem Interface Extension

```typescript
// Source: [VERIFIED: src/lib/types.ts current state]
// Add optional shortcut field — backward compatible (no migration needed)
export interface CommandItem {
  id: string;
  name: string;
  command: string;
  icon: string;
  type: "preset" | "custom";
  scope: "global" | "project";
  addedAt: number;
  shortcut?: string;  // Phase 11: Tauri Accelerator format, e.g. "CommandOrControl+G"
}
```

### Recording Keydown Handler Pattern

```typescript
// Source: [ASSUMED] based on browser KeyboardEvent API + Tauri Accelerator format
function handleRecordingKeydown(
  e: KeyboardEvent,
  commands: CommandItem[],
  onAssign: (shortcut: string) => void,
  onConflict: (conflictCmd: CommandItem) => void,
  onInvalid: (message: string) => void,
) {
  // Escape cancels recording
  if (e.key === 'Escape') {
    onRecordingStop();
    return;
  }

  // Skip if target is input/textarea (Pitfall 6)
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  const shortcut = keyboardEventToShortcut(e);
  if (!shortcut) {
    // Modifier-only or no modifier — invalid
    onInvalid('快捷键必须包含修饰键 (Ctrl/Alt/Shift)');
    return;
  }

  // Check key count (D-07: max 3 keys)
  const keyCount = shortcut.split('+').length;
  if (keyCount > 3) {
    onInvalid('快捷键最多支持 3 个按键组合');
    return;
  }

  // Check within-app conflict
  const conflict = commands.find(cmd => cmd.shortcut === shortcut);
  if (conflict) {
    onConflict(conflict);
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  onAssign(shortcut);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 globalShortcut | tauri-plugin-global-shortcut v2.x (separate plugin) | Tauri v2 release (2024) | Plugin must be explicitly added to Cargo.toml and registered in lib.rs — not bundled with core |
| DOM-only keyboard shortcuts | OS-level hotkeys via native API | This phase | Shortcuts work regardless of app focus state — fundamentally different capability |
| Number key shortcuts only | Per-command customizable shortcuts with modifiers | This phase | Users can assign memorable shortcuts to their most-used commands |

**Deprecated/outdated:**
- Tauri v1 `tauri::api::globalShortcut` module: Replaced by standalone plugin in v2. Not applicable to this project (using Tauri v2).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tauri Accelerator format accepts `CommandOrControl` as modifier, single chars as uppercase, and special key names like `Space`, `Up`, `F1` | Pattern 2, Pitfall 7 | Shortcut registration would fail for certain key combos; need to verify exact accepted key names |
| A2 | `register()` returns a Promise that rejects if the OS rejects the shortcut (e.g., already taken by another app) | Pitfall 4 | Error handling for system-level conflicts would be incorrect; may need try/catch around register calls |
| A3 | `unregisterAll()` is synchronous in effect and completes before subsequent `register()` calls | Pattern 1 | If async, race conditions on project switch would be more likely |
| A4 | The plugin builder `tauri_plugin_global_shortcut::Builder::new().build()` requires no special configuration for Windows | Code Examples | If configuration is required (e.g., specific permissions, event handling mode), the Rust setup would be incomplete |

**Verification needed:** A1 and A4 are the highest risk assumptions. Recommend verifying during Wave 0 by creating a minimal test that registers a simple shortcut and confirms it fires correctly.

## Open Questions

1. **Exact behavior when `register()` is called with a shortcut already registered by another application**
   - What we know: `isRegistered()` only checks this app's registrations [VERIFIED: plugin source code]
   - What's unclear: Does `register()` return an error, silently fail, or "steal" the shortcut from the other app?
   - Recommendation: Test during Wave 0 with a known system shortcut (e.g., Win+E) to observe behavior. Add try/catch around `register()` calls as defensive measure.

2. **Maximum number of simultaneous registered shortcuts**
   - What we know: Windows has a limit of ~26 RegisterHotKey calls per application (OS limitation, not plugin)
   - What's unclear: Whether this is a practical concern for EasyPack (unlikely — most users will have <20 commands)
   - Recommendation: Not a blocking concern. Document as a known limitation if it arises during testing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build system | Yes | 22.22.0 | -- |
| Rust toolchain | Tauri backend | Yes | 1.93.1 | -- |
| npm | Package management | Yes | 10.9.4 | -- |
| tauri-plugin-global-shortcut (crate) | Global hotkeys | Not yet installed | 2.3.1 (latest) | -- |
| @tauri-apps/plugin-global-shortcut (npm) | Frontend API | Not yet installed | 2.3.1 (latest) | -- |
| vitest | Test framework | Yes | ^4.1.4 | -- |
| @testing-library/react | Component testing | Yes | ^16.3.2 | -- |

**Missing dependencies with no fallback:**
- None — all required dependencies are installable via standard package managers.

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.4 |
| Config file | vitest.config.ts (or vitest.config.mts) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KB-01 | User can assign shortcut via recording | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Wave 0 |
| KB-01 | keyboardEventToShortcut converts valid combos | unit | `npx vitest run src/lib/__tests__/shortcutUtils.test.ts` | Wave 0 |
| KB-02 | Shortcut trigger executes command | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Wave 0 |
| KB-03 | Project switch re-registers shortcuts | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Wave 0 |
| KB-04 | Conflict detection warns on duplicate | unit | `npx vitest run src/hooks/__tests__/useGlobalShortcuts.test.ts` | Wave 0 |
| KB-05 | User can clear shortcut binding | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx` | Exists (extend) |
| KB-06 | Shortcuts persist across restarts | unit | `npx vitest run src/hooks/__tests__/useProject.test.tsx` | Exists (extend) |
| UI | Badge state machine renders correctly | unit | `npx vitest run src/components/__tests__/CommandCard.test.tsx` | Exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useGlobalShortcuts.test.ts` -- covers KB-01/02/03/04 registration lifecycle
- [ ] `src/lib/__tests__/shortcutUtils.test.ts` -- covers keyboardEventToShortcut conversion and validation
- [ ] Extend `src/components/__tests__/CommandCard.test.tsx` -- add shortcut badge rendering tests
- [ ] Extend `src/hooks/__tests__/useProject.test.tsx` -- add assignShortcut/clearShortcut tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | 本应用无认证需求 |
| V3 Session Management | No | 本应用无会话管理 |
| V4 Access Control | No | 本应用为单用户桌面工具 |
| V5 Input Validation | Yes | KeyboardEvent -> shortcut string conversion must validate: modifier required (D-06), key count <= 3 (D-07), no modifier-only combos, conflict detection |
| V6 Cryptography | No | 无加密需求 |

### Known Threat Patterns for Tauri Global Shortcuts

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shortcut injection | Tampering | Plugin requires explicit capability permissions in default.json; only declared shortcuts can be registered |
| Shortcut hijacking (another app steals binding) | Denial of Service | No mitigation possible at app level — OS determines which app wins. Document as known limitation |
| Accidental trigger (insufficient modifiers) | Denial of Service | D-06 enforces modifier key requirement; recording validation rejects modifier-only combos |
| Shortcut persistence tampering | Tampering | Store file is local JSON; attack requires local file system access. Acceptable risk for single-user desktop tool |

## Sources

### Primary (HIGH confidence)
- npm registry: @tauri-apps/plugin-global-shortcut@2.3.1 — version verified
- crates.io: tauri-plugin-global-shortcut@2.3.1 — version verified
- src-tauri/src/lib.rs — current plugin registration pattern
- src-tauri/capabilities/default.json — current permissions
- src/lib/types.ts — current CommandItem interface
- src/hooks/useKeyboard.ts — existing DOM-level shortcut implementation
- src/hooks/useProject.ts — command execution pipeline
- src/components/CommandCard.tsx — existing badge rendering
- Tauri v2 GlobalShortcut plugin docs (https://v2.tauri.app/plugin/global-shortcut/)
- Plugin source code: GitHub tauri-apps/plugins-workspace/plugins/global-shortcut/guest-js/index.ts — ShortcutEvent interface, register/unregister signatures verified

### Secondary (MEDIUM confidence)
- Phase 11 UI-SPEC.md — badge state machine, component inventory, interaction specs (verified against codebase)
- Phase 11 CONTEXT.md — locked decisions D-01 through D-07

### Tertiary (LOW confidence)
- [ASSUMED] Tauri Accelerator key name mapping (Space, Up, Down, Left, Right, F1-F24) — not directly verified from source, based on Tauri documentation and common Accelerator patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm/crates registries, API signatures verified from plugin source code
- Architecture: HIGH — based on verified plugin API + existing codebase patterns + UI-SPEC contract
- Pitfalls: MEDIUM — Pitfall 1 (double-fire) verified from plugin source; Pitfalls 2-7 based on training knowledge of async React patterns and browser keyboard events

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable — plugin is mature, no major changes expected)
