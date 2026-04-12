import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/hooks/useProject";

interface SidebarProps {
  currentProject: Project | null;
  onAddProject: () => void;
}

export function Sidebar({ currentProject, onAddProject }: SidebarProps) {
  return (
    <aside className="w-[240px] flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
      {/* App 标题 (per UI-SPEC: 16px semibold) */}
      <div className="p-6 border-b border-white/5">
        <h1 className="text-base font-semibold text-foreground">EasyPack</h1>
      </div>

      {/* 添加项目按钮 (per D-15: 侧边栏顶部) */}
      <div className="p-4">
        <Button
          onClick={onAddProject}
          variant="default"
          size="sm"
          className="w-full gap-1"
        >
          <Plus className="size-4" />
          添加项目
        </Button>
      </div>

      {/* 项目列表 / 空状态 (per D-21, UI-SPEC Copywriting) */}
      <div className="flex-1 px-4 py-2">
        {currentProject ? (
          <div className="px-2 py-2 rounded-lg bg-white/5 border border-white/10">
            <span className="text-xs text-foreground">{currentProject.name}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="size-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">还没有项目</p>
            <p className="text-xs text-muted-foreground mt-1">点击上方按钮添加第一个项目</p>
          </div>
        )}
      </div>
    </aside>
  );
}
