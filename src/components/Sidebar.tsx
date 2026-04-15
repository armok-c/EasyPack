import { useState } from "react";
import { Plus, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { getIconByName } from "@/lib/icons";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import type { ProjectItem } from "@/hooks/useProject";

interface SidebarProps {
  projects: ProjectItem[];
  selectedId: string | null;
  onAddProject: () => void;
  onSelectProject: (id: string) => void;
  onRemoveProject: (id: string) => void;
  onUpdateStyle: (projectId: string, style: { icon: string; color: string }) => void;
}

export function Sidebar({
  projects,
  selectedId,
  onAddProject,
  onSelectProject,
  onRemoveProject,
  onUpdateStyle,
}: SidebarProps) {
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
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
        {projects.length > 0 ? (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1">
              {projects.map((project) => (
                <ContextMenu key={project.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      onClick={() => onSelectProject(project.id)}
                      className={cn(
                        "group relative flex items-center px-2 py-2 rounded-lg border cursor-pointer",
                        "transition-all duration-150 overflow-hidden",
                        selectedId === project.id
                          ? "bg-white/10 border-white/20"
                          : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
                      )}
                    >
                      {/* Phase 5: colored left border (per D-02) */}
                      {project.color && (
                        <div
                          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-l-lg transition-colors duration-150"
                          style={{ backgroundColor: project.color }}
                        />
                      )}

                      {/* Phase 5: project icon (per D-03) */}
                      {project.icon && (() => {
                        const ProjectIcon = getIconByName(project.icon);
                        return <ProjectIcon className="size-3.5 mr-1.5 flex-shrink-0 text-muted-foreground" />;
                      })()}

                      {/* D-03: 只显示文件夹名，过长时 truncate */}
                      <span className="text-xs text-foreground truncate flex-1">
                        {project.name}
                      </span>

                      {/* D-09: 悬停时显示 X 删除按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveProject(project.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-white/10 transition-opacity duration-150"
                        aria-label={`删除项目 ${project.name}`}
                      >
                        <X className="size-3 text-muted-foreground" />
                      </button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => setSettingsProjectId(project.id)}>
                      设置图标和颜色
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="size-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">还没有项目</p>
            <p className="text-xs text-muted-foreground mt-1">
              点击上方按钮添加第一个项目
            </p>
          </div>
        )}
      </div>

      {/* Phase 5: project style settings dialog */}
      <ProjectSettingsDialog
        open={settingsProjectId !== null}
        onOpenChange={(open) => { if (!open) setSettingsProjectId(null); }}
        project={projects.find(p => p.id === settingsProjectId) ?? null}
        onSave={onUpdateStyle}
      />
    </aside>
  );
}
