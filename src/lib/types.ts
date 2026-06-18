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
  scope: "project";
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

/**
 * Phase 23: 环境数据模型 (per D-07)
 * 环境是项目配置文件的命名集合。
 */
export interface Environment {
  id: string;        // UUID
  name: string;      // 环境名称，在同一项目内唯一
  createdAt: number; // Date.now() 时间戳
  updatedAt: number; // Date.now() 时间戳
  files: ManagedFile[]; // 此环境管理的配置文件列表
}

/**
 * Phase 23: 受管理的配置文件 (per D-08)
 * name 存储相对路径（如 ".env"、"config/settings.json"），支持嵌套目录
 */
export interface ManagedFile {
  name: string;    // 相对路径
  content: string; // 文件完整文本内容
  addedAt: number; // Date.now() 时间戳
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
    // Phase 23: environment data (per D-03)
    projectEnvs: Record<string, Environment[]>;
    projectActiveEnvs: Record<string, string>;
  };
}
