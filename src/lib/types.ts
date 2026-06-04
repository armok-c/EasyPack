/**
 * Unified command data structure for both preset and custom commands.
 *
 * Design decisions:
 * - `icon` stores a string name (not LucideIcon) for serialization safety (D-19)
 * - `id` uses crypto.randomUUID() for custom commands, `preset-{idx}` for presets
 * - `addedAt` is a timestamp for stable ordering
 */
export interface CommandItem {
  id: string;
  name: string;
  command: string;
  icon: string;
  type: "preset" | "custom";
  scope: "global" | "project";
  addedAt: number;
  shortcut?: string;  // Phase 11: OS-level global shortcut in Tauri Accelerator format, e.g. "CommandOrControl+G"
  scriptLines?: string;  // Phase 17: Multi-line script content, \n-separated string. Undefined = use command field (SCRIPT-05)
  executionMode?: "strict" | "lenient" | "batch";  // Phase 17: Execution mode. strict=stop on error (&&), lenient=continue (&), batch=verbatim. Default: strict (D-08)
}

/** Phase 18: Shortcut action category — command execution, window ops, project ops */
export type ShortcutCategory = "command" | "window" | "project";

/** Phase 18: Unified shortcut-bindable action (D-11) */
export interface ShortcutAction {
  id: string;           // Fixed ops use fixed id; commands use "command.{commandId}"
  label: string;        // Display name in shortcut panel
  category: ShortcutCategory;
  handler: () => void;  // Not persisted — rebuilt from App-layer callbacks each render
}

/** Phase 20: Profile 元信息，存储在主 store 中 */
export interface ProfileMeta {
  id: string;       // UUID
  name: string;     // 用户可见名称，如"工作"、"个人"
  createdAt: number; // Date.now() 时间戳
}

/** Phase 20: 导出 JSON 文件格式 (per D-20) */
export interface ProfileExportData {
  formatVersion: number;
  profileName: string;
  exportedAt: string;          // ISO 8601
  data: {
    projects: unknown;
    selectedProjectId: unknown;
    customCommands: unknown;
    projectCommands: Record<string, unknown>;
    shortcutBindings: unknown;
    presetShortcuts: unknown;
    recentCommands: unknown;
  };
}
