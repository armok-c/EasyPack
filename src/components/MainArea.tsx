import { FolderOpen } from "lucide-react";
import { CommandCard } from "@/components/CommandCard";
import { PRESET_COMMANDS } from "@/lib/presets";
import type { Project } from "@/hooks/useProject";

interface MainAreaProps {
  currentProject: Project | null;
  onExecute: (command: string) => void;
}

export function MainArea({ currentProject, onExecute }: MainAreaProps) {
  if (!currentProject) {
    // per D-19: 首次启动引导页
    // per UI-SPEC Copywriting: "选择一个项目开始" + "从左侧添加或选择项目..."
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <FolderOpen className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">选择一个项目开始</h2>
        <p className="text-sm text-muted-foreground text-center">
          从左侧添加或选择项目，然后点击指令卡片执行
        </p>
      </main>
    );
  }

  // per D-05: 上方项目路径 + 下方按钮区域
  return (
    <main className="flex-1 flex flex-col p-8 overflow-auto">
      {/* 当前项目信息 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground">
          当前项目: {currentProject.name}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{currentProject.path}</p>
      </div>

      {/* per UI-SPEC Grid: 2 cols, 12px gap */}
      <div className="grid grid-cols-2 gap-3">
        {PRESET_COMMANDS.map((cmd) => (
          <CommandCard
            key={cmd.command}
            name={cmd.name}
            icon={cmd.icon}
            onClick={() => onExecute(cmd.command)}
          />
        ))}
      </div>
    </main>
  );
}
