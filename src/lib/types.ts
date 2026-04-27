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
}
