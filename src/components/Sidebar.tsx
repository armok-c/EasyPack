import { useState, useCallback } from "react";
import { Plus, FolderOpen, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
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
  onReorderProjects: (reordered: ProjectItem[]) => void;
}

// Sortable project item extracted as independent component for @dnd-kit useSortable
function SortableProjectItem({
  project,
  isSelected,
  onSelect,
  onRemove,
  onContextMenu,
}: {
  project: ProjectItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onContextMenu: (id: string) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: project.id });

  return (
    <div ref={ref} className={isDragging ? "opacity-50" : ""}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={() => onSelect(project.id)}
            className={cn(
              "group relative flex items-center px-2 py-2 rounded-lg border cursor-pointer",
              "transition-all duration-150 overflow-hidden",
              isSelected
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

            {/* Drag handle (per D-07, D-09): GripVertical, hover-reveal */}
            <div
              ref={handleRef}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-opacity duration-150 cursor-grab"
              aria-label="拖拽排序"
            >
              <GripVertical className="size-3 text-muted-foreground" />
            </div>

            {/* Phase 5: project icon (per D-03) */}
            {project.icon && (() => {
              const ProjectIcon = getIconByName(project.icon);
              return <ProjectIcon className="size-3.5 mr-1.5 flex-shrink-0 text-muted-foreground" />;
            })()}

            {/* D-03: only show folder name, truncate if too long */}
            <span className="text-xs text-foreground truncate flex-1">
              {project.name}
            </span>

            {/* D-09: hover-reveal X delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(project.id);
              }}
              className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-white/10 transition-opacity duration-150"
              aria-label={`删除项目 ${project.name}`}
            >
              <X className="size-3 text-muted-foreground" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onContextMenu(project.id)}>
            设置图标和颜色
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

export function Sidebar({
  projects,
  selectedId,
  onAddProject,
  onSelectProject,
  onRemoveProject,
  onUpdateStyle,
  onReorderProjects,
}: SidebarProps) {
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);

  // Handle drag end: splice array to new order (per D-10, D-11)
  const handleDragEnd = useCallback(
    (event: { canceled?: boolean; operation: { source: unknown } }) => {
      if (event.canceled) return;
      const { source } = event.operation;
      if (isSortable(source)) {
        const sortableSource = source as { initialIndex: number; index: number };
        const { initialIndex, index } = sortableSource;
        if (initialIndex !== index) {
          const newProjects = [...projects];
          const [moved] = newProjects.splice(initialIndex, 1);
          newProjects.splice(index, 0, moved);
          onReorderProjects(newProjects);
        }
      }
    },
    [projects, onReorderProjects]
  );

  return (
    <aside className="w-[240px] flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
      {/* App title (per UI-SPEC: 16px semibold) */}
      <div className="p-6 border-b border-white/5">
        <h1 className="text-base font-semibold text-foreground">EasyPack</h1>
      </div>

      {/* Add project button (per D-15: sidebar top) */}
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

      {/* Project list / empty state (per D-21, UI-SPEC Copywriting) */}
      <div className="flex-1 px-4 py-2">
        {projects.length > 0 ? (
          <ScrollArea className="h-full">
            <DragDropProvider onDragEnd={handleDragEnd}>
              <div className="flex flex-col gap-1">
                {projects.map((project) => (
                  <SortableProjectItem
                    key={project.id}
                    project={project}
                    isSelected={selectedId === project.id}
                    onSelect={onSelectProject}
                    onRemove={onRemoveProject}
                    onContextMenu={setSettingsProjectId}
                  />
                ))}
              </div>
            </DragDropProvider>
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
