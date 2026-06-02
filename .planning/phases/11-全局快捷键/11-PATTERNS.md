# Phase 11: 全局快捷键 - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 8 (1 new, 7 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useGlobalShortcuts.ts` (NEW) | hook | event-driven | `src/hooks/useKeyboard.ts` | exact |
| `src/lib/types.ts` (MODIFY) | model | CRUD | `src/lib/types.ts` (self) | exact |
| `src/components/CommandCard.tsx` (MODIFY) | component | event-driven | `src/components/CommandCard.tsx` (self) | exact |
| `src/components/MainArea.tsx` (MODIFY) | component | request-response | `src/components/MainArea.tsx` (self) | exact |
| `src/hooks/useProject.ts` (MODIFY) | service | CRUD | `src/hooks/useProject.ts` (self) | exact |
| `src-tauri/Cargo.toml` (MODIFY) | config | N/A | `src-tauri/Cargo.toml` (self) | exact |
| `src-tauri/src/lib.rs` (MODIFY) | config | N/A | `src-tauri/src/lib.rs` (self) | exact |
| `src-tauri/capabilities/default.json` (MODIFY) | config | N/A | `src-tauri/capabilities/default.json` (self) | exact |

## Pattern Assignments

### `src/hooks/useGlobalShortcuts.ts` (NEW — hook, event-driven)

**Analog:** `src/hooks/useKeyboard.ts`

**Imports pattern** (lines 1-3):
```typescript
import { useEffect, useCallback } from "react";
import type { CommandItem } from "@/lib/types";
import type { ProjectItem } from "@/hooks/useProject";
```

**Core pattern — keydown hook with guard conditions and effect lifecycle** (lines 23-67):
```typescript
export function useKeyboard({
  commands,
  currentProject,
  onExecute,
  editMode,
}: UseKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Guard: skip if target is an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      // Guard: skip if edit mode is active
      if (editMode) return;
      // Guard: skip if a Radix dialog or context menu is open
      const anyDialogOpen = !!document.querySelector(
        '[data-radix-dialog-content-open], [data-radix-context-menu-content-open]'
      );
      if (anyDialogOpen) return;
      // Guard: need a selected project to execute
      if (!currentProject) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= commands.length) {
        const cmd = commands[num - 1];
        if (cmd) {
          e.preventDefault();
          onExecute(cmd.command);
        }
      }
    },
    [commands, currentProject, onExecute, editMode]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
```

**New hook should follow this structure:**
- Options interface with commands, currentProject, onExecute, enabled guard
- useCallback for the registration logic
- useEffect with cleanup (unregisterAll) on deps change
- Guard: skip registration if no project selected
- Use `@tauri-apps/plugin-global-shortcut` imports instead of window.addEventListener

**API imports for the new hook:**
```typescript
import { register, unregister, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
```

---

### `src/lib/types.ts` (MODIFY — model, CRUD)

**Analog:** `src/lib/types.ts` (self-modification)

**Current interface** (lines 9-17):
```typescript
export interface CommandItem {
  id: string;
  name: string;
  command: string;
  icon: string;
  type: "preset" | "custom";
  scope: "global" | "project";
  addedAt: number;
}
```

**Extension pattern** — add optional field at the end (backward-compatible, no migration):
```typescript
  shortcut?: string;  // Phase 11: OS-level global shortcut in Tauri Accelerator format, e.g. "CommandOrControl+G"
```

**Key convention:** Optional fields use `?` suffix. New optional fields do NOT require migration of existing persisted data (tauri-plugin-store will treat missing fields as undefined).

---

### `src/components/CommandCard.tsx` (MODIFY — component, event-driven)

**Analog:** `src/components/CommandCard.tsx` (self-modification)

**Current props interface** (lines 6-21):
```typescript
interface CommandCardProps {
  name: string;
  icon: LucideIcon;
  command?: string;
  disabled?: boolean;
  onClick?: () => void;
  isCustom?: boolean;
  editMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  commandId?: string;
  tabIndex?: number;
  shortcutNumber?: number;
}
```

**Current shortcut number badge rendering** (lines 112-120):
```typescript
{shortcutNumber != null && !disabled && !editMode && (
  <span
    className="absolute top-1 left-1 text-[10px] font-semibold text-muted-foreground/70 pointer-events-none"
    aria-hidden="true"
  >
    {shortcutNumber}
  </span>
)}
```

**Current delete button pattern — absolute positioned with stopPropagation** (lines 98-111):
```typescript
{showDeleteButton && (
  <div
    onClick={handleDelete}
    aria-label={`删除指令: ${name}`}
    className={cn(
      "absolute -top-1 -right-1",
      "bg-red-500/80 hover:bg-red-500 text-white rounded-full",
      "size-4 flex items-center justify-center",
      "transition-colors duration-100 cursor-pointer"
    )}
  >
    <X className="size-3" />
  </div>
)}
```

**Pattern to follow for new shortcut badge:**
- Replace the `shortcutNumber` badge section with a new shortcut badge that has 4 visual states (per UI-SPEC)
- Reuse the `absolute top-1 left-1` positioning
- Reuse the `cn()` utility for conditional class merging
- Follow the same `stopPropagation` pattern for badge click handlers to prevent card click
- Add new props: `shortcut?: string`, `isRecording?: boolean`, `onRecordingStart?`, `onRecordingStop?`, `onShortcutAssign?`, `onShortcutClear?`, `hasConflict?: boolean`
- Clear button on hover follows the same pattern as the delete button (absolute positioned, red, size-3)

**Tailwind badge class pattern from UI-SPEC:**
```typescript
// Base badge classes (shared by all states)
"absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold min-w-[24px] text-center"
```

---

### `src/components/MainArea.tsx` (MODIFY — component, request-response)

**Analog:** `src/components/MainArea.tsx` (self-modification)

**Current recording-related state pattern** (lines 60-64):
```typescript
const [dialogOpen, setDialogOpen] = useState(false);
const [editingCommand, setEditingCommand] = useState<CommandItem | null>(null);
const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
```

**Current CommandCard rendering with shortcutNumber** (lines 276-291):
```typescript
<CommandCard
  key={cmd.id}
  name={cmd.name}
  icon={getIconByName(cmd.icon)}
  command={cmd.command}
  isCustom={isCustom}
  editMode={canEdit}
  onEdit={() => handleEdit(cmd)}
  onDelete={() => deleteCommand(cmd.id)}
  commandId={cmd.id}
  onClick={() => onExecute(cmd.command)}
  tabIndex={isCardFocused ? 0 : -1}
  shortcutNumber={!isCustom && !canEdit && index < 9 ? index + 1 : undefined}
/>
```

**New state to add:**
```typescript
const [recordingCommandId, setRecordingCommandId] = useState<string | null>(null);
```

**Updated shortcut prop logic (from UI-SPEC Section 4):**
```typescript
shortcut={cmd.shortcut}
shortcutNumber={!cmd.shortcut && !isCustom && !canEdit && index < 9 ? index + 1 : undefined}
isRecording={recordingCommandId === cmd.id}
```

**Pattern for recording lifecycle:**
- `recordingCommandId` managed as state in MainArea (like `dialogOpen` pattern)
- New callbacks: `onRecordingStart`, `onRecordingStop`, `onShortcutAssign`, `onShortcutClear`
- Recording cancelled on editMode toggle off (effect guard, like `focusedCardIndex` reset pattern on line 97)

---

### `src/hooks/useProject.ts` (MODIFY — service, CRUD)

**Analog:** `src/hooks/useProject.ts` (self-modification)

**Current CRUD pattern for commands** (lines 263-368):
```typescript
// addCommand — creates CommandItem, updates state, persists to store
const addCommand = useCallback(
  async (name: string, command: string, icon?: string, scope?: "global" | "project") => {
    const effectiveScope = scope ?? (commandMode === "project" && selectedId ? "project" : "global");
    if (effectiveScope === "project" && selectedId) {
      const newItem: CommandItem = {
        id: crypto.randomUUID(),
        name, command,
        icon: icon ?? DEFAULT_ICON,
        type: "custom",
        scope: "project",
        addedAt: Date.now(),
      };
      const current = projectCommandsMap[selectedId] ?? [];
      const updated = [...current, newItem];
      setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
      await store?.set(projectCommandsKey(selectedId), updated);
      toast.success(`已添加指令: ${name}`);
    } else {
      // Global mode: similar pattern with customCommands state + store
    }
  },
  [commandMode, selectedId, projectCommandsMap, customCommands, store]
);
```

**Key patterns to follow for assignShortcut/clearShortcut:**
1. Same dual-mode pattern: check `commandMode` to determine if operating on `projectCommandsMap` or `customCommands`
2. Same state update + store persistence pattern: `setXxx(...)` then `await store?.set(key, ...)`
3. Same toast notification pattern: `toast.success(...)` or `toast.error(...)`
4. Use `useCallback` with correct dependency array
5. Return new functions from the hook's return object

**Store persistence pattern (lines 281-283):**
```typescript
setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
await store?.set(projectCommandsKey(selectedId), updated);
```

**executeCommand pattern to call from shortcut handler** (lines 242-258):
```typescript
const executeCommand = useCallback(
  async (shellCommand: string) => {
    if (!currentProject) return;
    try {
      await invoke("execute_command", {
        projectPath: currentProject.path,
        shellCommand,
      });
      toast.success(`已执行: ${shellCommand}`);
    } catch (error) {
      toast.error(`命令执行失败：${error}。请检查项目路径和命令是否正确。`);
    }
  },
  [currentProject]
);
```

---

### `src-tauri/Cargo.toml` (MODIFY — config)

**Analog:** `src-tauri/Cargo.toml` (self-modification)

**Current dependency section** (lines 15-20):
```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-store = "2.4.2"
```

**Pattern for adding Tauri plugin dependencies:**
- Follow the same `tauri-plugin-*` naming convention
- Version "2" for Tauri v2 ecosystem plugins
- Add after the existing plugin lines:
```toml
tauri-plugin-global-shortcut = "2"
```

---

### `src-tauri/src/lib.rs` (MODIFY — config)

**Analog:** `src-tauri/src/lib.rs` (self-modification)

**Current plugin registration chain** (lines 3-16):
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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

**Pattern for registering a Tauri plugin:**
- Add `.plugin(...)` call after existing plugins, before `.invoke_handler(...)`
- Global shortcut uses builder pattern (like store):
```rust
.plugin(tauri_plugin_global_shortcut::Builder::new().build())
```
- Insert between the `store` plugin and `invoke_handler` chain

---

### `src-tauri/capabilities/default.json` (MODIFY — config)

**Analog:** `src-tauri/capabilities/default.json` (self-modification)

**Current permissions array** (lines 6-15):
```json
{
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

**Pattern for adding permissions:**
- Plugin permissions use `plugin-name:allow-action` format
- Append after existing permissions:
```json
"global-shortcut:allow-register",
"global-shortcut:allow-unregister",
"global-shortcut:allow-is-registered",
"global-shortcut:allow-unregister-all"
```

---

## Shared Patterns

### Imports and Path Aliases
**Source:** All TypeScript files use `@/` path aliases
**Apply to:** All new and modified frontend files
```typescript
import { X } from "lucide-react";                    // icon imports
import { cn } from "@/lib/utils";                     // Tailwind class merge
import type { CommandItem } from "@/lib/types";        // type imports (use `type` keyword)
import { toast } from "sonner";                        // toast notifications
import { invoke } from "@tauri-apps/api/core";         // Tauri invoke
```

### State Management + Store Persistence
**Source:** `src/hooks/useProject.ts` (lines 263-368)
**Apply to:** `assignShortcut` and `clearShortcut` in useProject.ts
```typescript
// 1. Read current state
const current = projectCommandsMap[selectedId] ?? [];
// 2. Create updated array
const updated = current.map((c) => c.id === commandId ? { ...c, shortcut } : c);
// 3. Update React state
setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
// 4. Persist to store
await store?.set(projectCommandsKey(selectedId), updated);
// 5. Toast feedback
toast.success("已绑定快捷键: ...");
```

### Conditional Tailwind Classes
**Source:** `src/components/CommandCard.tsx` (lines 72-95)
**Apply to:** Shortcut badge states in CommandCard.tsx
```typescript
className={cn(
  "base-classes-here",
  condition && "conditional-classes",
  otherCondition && "other-classes"
)}
```

### Tauri Plugin Installation (Two-End)
**Source:** Existing plugins (dialog, store)
**Apply to:** global-shortcut plugin
```
Rust side: Cargo.toml dependency + lib.rs .plugin() registration
Frontend side: npm package + capabilities/default.json permissions
```

### Toast Notification Pattern
**Source:** `src/hooks/useProject.ts` (lines 283, 316, 356)
**Apply to:** All shortcut assignment, conflict, and clear feedback
```typescript
toast.success("已绑定快捷键: Ctrl+G");
toast.error("快捷键冲突", { description: "..." });
```

## No Analog Found

No files without analogs. All 8 files have exact matches (self-modification or direct sibling in same directory).

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have direct analogs in the existing codebase |

## Test File Patterns

### Test Pattern: Hook Testing
**Source:** `src/hooks/__tests__/useProject.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock Tauri plugins
const { mockStore } = vi.hoisted(() => ({
  mockStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), keys: vi.fn() },
}));
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn().mockResolvedValue(mockStore) }));

// Mock new global-shortcut plugin for Phase 11 tests
vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
  unregisterAll: vi.fn().mockResolvedValue(undefined),
  isRegistered: vi.fn().mockResolvedValue(false),
}));
```

### Test Pattern: Component Testing
**Source:** `src/components/__tests__/CommandCard.test.tsx`

```typescript
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Test badge visibility by state
it("shows shortcut badge when shortcut prop is provided", () => {
  render(<CommandCard name="测试" icon={Package} shortcut="Ctrl+G" />);
  expect(screen.getByText("Ctrl+G")).toBeInTheDocument();
});

// Test badge hidden in non-edit mode without shortcut
it("does not show shortcut badge when no shortcut in non-edit mode", () => {
  render(<CommandCard name="测试" icon={Package} />);
  expect(screen.queryByText(/Ctrl/)).not.toBeInTheDocument();
});
```

### New Test Files to Create

| File | Tests |
|------|-------|
| `src/hooks/__tests__/useGlobalShortcuts.test.ts` | Registration lifecycle, project switch re-registration, cleanup on unmount, double-fire prevention |
| `src/lib/__tests__/shortcutUtils.test.ts` | `keyboardEventToShortcut()` conversion, modifier validation, key count validation, special key mapping |

## Metadata

**Analog search scope:** `src/hooks/`, `src/components/`, `src/lib/`, `src-tauri/src/`, `src-tauri/`
**Files scanned:** 15+ TypeScript files, 4 Rust files, 1 JSON config
**Pattern extraction date:** 2026-04-26
