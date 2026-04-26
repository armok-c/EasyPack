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
  Sparkles,
  CargoShip,
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
  Sparkles,
  CargoShip,
};

export const DEFAULT_ICON = "Terminal";

/**
 * Returns the LucideIcon component for a given icon name string.
 * Falls back to Terminal if the name is not found.
 * File icon values ("file:" prefix) also fall back to Terminal.
 */
export function getIconByName(name: string): LucideIcon {
  if (isFileIcon(name)) return Terminal; // fallback for file icons
  return ICON_OPTIONS[name] ?? Terminal;
}

/**
 * Checks whether an icon value represents a file path type ("file:" prefix).
 * per UI-SPEC Icon Type Discrimination
 */
export function isFileIcon(icon: string): boolean {
  return icon.startsWith("file:");
}

/**
 * Extracts the file path from a file icon value (removes "file:" prefix).
 * per UI-SPEC Icon Type Discrimination
 */
export function getFilePath(icon: string): string {
  return icon.slice(5);
}
