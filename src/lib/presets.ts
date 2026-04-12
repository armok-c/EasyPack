import { Package, Play, GitPullRequest, Sparkles, type LucideIcon } from "lucide-react";

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
