import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/types";

interface EnvTabBarProps {
  envs: Environment[];
  selectedEnvId: string | null;
  activeEnvId: string | null;
  onSelectEnv: (envId: string) => void;
  onManageEnv: () => void;
}

export function EnvTabBar({
  envs,
  selectedEnvId,
  activeEnvId,
  onSelectEnv,
  onManageEnv,
}: EnvTabBarProps) {
  // Zero env state per D-17
  if (envs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <p className="text-sm text-muted-foreground">暂无环境</p>
        <Button variant="outline" size="sm" onClick={onManageEnv}>
          <Settings className="size-3.5 mr-1.5" />
          管理环境
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {/* Tab bar row with horizontal scroll per D-15 */}
      <div className="relative flex items-center">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          {envs.map((env) => {
            const isSelected = env.id === selectedEnvId;
            const isActive = env.id === activeEnvId;

            return (
              <button
                key={env.id}
                onClick={() => onSelectEnv(env.id)}
                className={cn(
                  "shrink-0 relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <span>{env.name}</span>
                {/* Green dot for applied env per D-14 */}
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-500 ring-1 ring-background" />
                )}
              </button>
            );
          })}
        </div>

        {/* Manage env button - sticky right per D-16 */}
        <div className="shrink-0 sticky right-0 ml-1 bg-background pl-1">
          <Button variant="outline" size="sm" onClick={onManageEnv}>
            <Settings className="size-3.5 mr-1.5" />
            管理环境
          </Button>
        </div>
      </div>

      {/* File placeholder area per D-19 */}
      <div className="mt-2 flex items-center justify-center p-6 rounded-xl border-2 border-dashed border-white/20">
        <p className="text-xs text-muted-foreground">
          文件管理功能将在后续版本中提供
        </p>
      </div>
    </div>
  );
}
