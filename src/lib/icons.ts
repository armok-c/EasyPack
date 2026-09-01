import {
  Bell,
  Braces,
  Bug,
  Cable,
  CircleCheck,
  CircleX,
  Cloud,
  CloudCog,
  CloudDownload,
  CloudUpload,
  Container,
  Cpu,
  Database,
  DatabaseBackup,
  File,
  FileCode,
  FileDiff,
  FileJson,
  FileText,
  Fingerprint,
  FlaskConical,
  Folder,
  FolderGit2,
  FolderOpen,
  GitCommit,
  GitCompare,
  GitMerge,
  GitPullRequest,
  Hammer,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  MessageCircle,
  Monitor,
  Network,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Table,
  TestTube,
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
  Ship,
  Wifi,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * Predefined icon options for command configuration.
 * 60 icons covering common development, file, data, network, cloud, build,
 * testing, security, device, messaging, and operation scenarios.
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
  Ship,
  Braces,
  Bug,
  GitCommit,
  GitCompare,
  GitMerge,
  GitPullRequest,
  File,
  FileCode,
  FileDiff,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FolderGit2,
  Database,
  DatabaseBackup,
  Table,
  HardDrive,
  Network,
  Cable,
  Wifi,
  Cloud,
  CloudCog,
  CloudDownload,
  CloudUpload,
  Container,
  Settings,
  Hammer,
  TestTube,
  FlaskConical,
  CircleCheck,
  CircleX,
  Shield,
  ShieldCheck,
  Lock,
  KeyRound,
  Fingerprint,
  Monitor,
  Laptop,
  Smartphone,
  Cpu,
  Bell,
  MessageCircle,
  Mail,
  RefreshCw,
  Search,
  Save,
  Workflow,
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
