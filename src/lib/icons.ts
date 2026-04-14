import {
  Terminal,
  Code,
  Server,
  Zap,
  GitBranch,
  Package,
  Globe,
  Wrench,
  Rocket,
  Play,
  type LucideIcon,
} from "lucide-react";

/**
 * Predefined icon options for command configuration.
 * 10 icons per UI-SPEC Icon Picker Specification (D-13).
 */
export const ICON_OPTIONS: Record<string, LucideIcon> = {
  Terminal,
  Code,
  Server,
  Zap,
  GitBranch,
  Package,
  Globe,
  Wrench,
  Rocket,
  Play,
};

export const DEFAULT_ICON = "Terminal";

/**
 * Returns the LucideIcon component for a given icon name string.
 * Falls back to Terminal if the name is not found.
 */
export function getIconByName(name: string): LucideIcon {
  return ICON_OPTIONS[name] ?? Terminal;
}
