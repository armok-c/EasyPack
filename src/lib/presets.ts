import { Package, Play, GitPullRequest, Sparkles, type LucideIcon } from "lucide-react";
import type { CommandItem } from "./types";

export interface PresetCommand {
  name: string;
  command: string;
  icon: LucideIcon;
}

export const PRESET_COMMANDS: PresetCommand[] = [
  { name: "打包项目", command: "npm run build", icon: Package },
  { name: "启动项目", command: "npm run dev", icon: Play },
  { name: "Git Pull", command: "git pull", icon: GitPullRequest },
  { name: "启动 Claude", command: "claude", icon: Sparkles },
];

/** Hardcoded icon names matching PRESET_COMMANDS order (LucideIcon.displayName is unreliable). */
const PRESET_ICON_NAMES = ["Package", "Play", "GitBranch", "Sparkles"] as const;

/**
 * Converts preset commands to the unified CommandItem format.
 * Used for displaying global commands in the command grid.
 */
export function getPresetAsCommandItems(): CommandItem[] {
  return PRESET_COMMANDS.map((cmd, idx) => ({
    id: `preset-${idx}`,
    name: cmd.name,
    command: cmd.command,
    icon: PRESET_ICON_NAMES[idx],
    type: "preset" as const,
    scope: "global" as const,
    addedAt: idx,
  }));
}
