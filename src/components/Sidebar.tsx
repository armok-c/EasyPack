import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, FolderOpen, X, GripVertical, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "@/lib/utils";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getIconByName, isFileIcon, getFilePath } from "@/lib/icons";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProjectItem } from "@/hooks/useProject";

interface SidebarProps {
  projects: ProjectItem[];
  selectedId: string | null;
  onAddProject: () => void;
  onSelectProject: (id: string) => void;
  onRemoveProject: (id: string) => Promise<boolean>;
  onOpenFolder: (path: string) => void;
  onUpdateStyle: (projectId: string, style: { icon: string; color: string }) => void;
  onRebindProject: (projectId: string) => Promise<boolean>;
  projectPathUnavailable?: boolean;
  onReorderProjects: (reordered: ProjectItem[]) => void;
  // Phase 5 Plan 03: keyboard navigation zone management
  activeZone: "sidebar" | "main";
  onZoneSwitch: () => void;
}

interface SortableSource {
  initialIndex: number;
  index: number;
}

function isSortableSource(source: unknown): source is SortableSource {
  if (typeof source !== "object" || source === null) return false;
  const candidate = source as Partial<SortableSource>;
  return (
    typeof candidate.initialIndex === "number" &&
    typeof candidate.index === "number"
  );
}

// Sortable project item extracted as independent component for @dnd-kit useSortable
function SortableProjectItem({
  project,
  index,
  isSelected,
  onSelect,
  onRemove,
  onOpenFolder,
  onOpenSettings,
  isFocused,
  onKeyDown,
  itemRef,
}: {
  project: ProjectItem;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onOpenSettings: (id: string) => void;
  isFocused: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  itemRef: (el: HTMLDivElement | null) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: project.id, index });

  return (
    <div ref={ref} className={isDragging ? "opacity-50" : ""}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={itemRef}
            tabIndex={isFocused ? 0 : -1}
            onClick={() => onSelect(project.id)}
            onKeyDown={onKeyDown}
            className={cn(
              "group relative flex items-center px-2 py-2 rounded-lg border cursor-pointer",
              "transition-all duration-150 overflow-hidden",
              "focus-visible:outline-none",
              isSelected
                ? "bg-white/10 border-white/20 focus-visible:bg-white/15"
                : "bg-white/5 border-white/10 hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/50"
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
            {project.icon && (isFileIcon(project.icon) ? (
              <img
                src={convertFileSrc(getFilePath(project.icon))}
                alt=""
                className="size-3.5 mr-1.5 flex-shrink-0 rounded-sm object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (() => {
              const ProjectIcon = getIconByName(project.icon);
              return <ProjectIcon className="size-3.5 mr-1.5 flex-shrink-0 text-muted-foreground" />;
            })())}

            {/* D-03: only show folder name, truncate if too long */}
            <span
              className="min-w-0 flex-1 text-xs text-foreground truncate"
              title={project.name}
            >
              {project.name}
            </span>

            {/* D-09: hover-reveal X delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(project.id);
              }}
              tabIndex={-1}
              className="ml-1 inline-flex size-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all duration-150 hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 group-hover:opacity-100"
              aria-label={`删除项目 ${project.name}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          collisionPadding={8}
          className="w-[11.5rem] min-w-0 rounded-lg p-1.5 shadow-xl"
        >
          <ContextMenuItem
            onSelect={() => onOpenFolder(project.path)}
            className="h-8 gap-2 px-2"
          >
            <FolderOpen className="size-4" />
            打开项目文件夹
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => onOpenSettings(project.id)}
            className="h-8 gap-2 px-2"
          >
            <Settings2 className="size-4" />
            项目设置
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={() => onRemove(project.id)}
            className="h-8 gap-2 px-2 !text-red-300 hover:!bg-red-500/10 hover:!text-red-200 focus:!bg-red-500/10 focus:!text-red-200 data-[variant=destructive]:*:[svg]:text-red-300!"
          >
            <Trash2 className="size-4 text-red-300!" />
            删除项目
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
  onOpenFolder,
  onUpdateStyle,
  onRebindProject,
  projectPathUnavailable = false,
  onReorderProjects,
  activeZone,
  onZoneSwitch,
}: SidebarProps) {
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  // Phase 5 Plan 03: roving tabindex keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset focusedIndex when projects change
  useEffect(() => {
    if (projects.length > 0 && focusedIndex >= projects.length) {
      setFocusedIndex(projects.length - 1);
    }
  }, [projects.length, focusedIndex]);

  // Auto-focus first item when sidebar becomes active zone (per D-16)
  useEffect(() => {
    if (
      activeZone === "sidebar" &&
      projects.length > 0 &&
      itemRefs.current[focusedIndex]
    ) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [activeZone, projects.length, focusedIndex]);

  // Handle keyboard navigation for project items
  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = (index + 1) % projects.length;
          setFocusedIndex(next);
          itemRefs.current[next]?.focus();
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = (index - 1 + projects.length) % projects.length;
          setFocusedIndex(prev);
          itemRefs.current[prev]?.focus();
          break;
        }
        case "Enter": {
          e.preventDefault();
          onSelectProject(projects[index].id);
          break;
        }
        case "Tab": {
          e.preventDefault();
          onZoneSwitch();
          break;
        }
      }
    },
    [projects, onSelectProject, onZoneSwitch]
  );

  // Ref callback to store element references
  const setItemRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      itemRefs.current[index] = el;
    },
    []
  );

  const deleteTarget = projects.find((project) => project.id === deleteProjectId) ?? null;

  const handleConfirmDelete = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!deleteTarget || deletingProject) return;

    setDeletingProject(true);
    try {
      const deleted = await onRemoveProject(deleteTarget.id);
      if (deleted) setDeleteProjectId(null);
    } catch {
      // The hook has already shown the error toast. Keep the confirmation open
      // so the user can retry after the failed rollback.
    } finally {
      setDeletingProject(false);
    }
  }, [deleteTarget, deletingProject, onRemoveProject]);

  // Handle drag end: splice array to new order (per D-10, D-11)
  const handleDragEnd = useCallback(
    (event: { canceled?: boolean; operation: { source: unknown } }) => {
      if (event.canceled) return;
      const { source } = event.operation;
      if (isSortableSource(source)) {
        const { initialIndex, index } = source;
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
      {/* Add project button (per D-15: sidebar top) */}
      <div className="px-4 pt-8 pb-4">
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
                {projects.map((project, index) => (
                  <SortableProjectItem
                    key={project.id}
                    project={project}
                    index={index}
                    isSelected={selectedId === project.id}
                    onSelect={onSelectProject}
                    onRemove={(id) => setDeleteProjectId(id)}
                    onOpenFolder={onOpenFolder}
                    onOpenSettings={setSettingsProjectId}
                    isFocused={activeZone === "sidebar" && index === focusedIndex}
                    onKeyDown={(e) => handleItemKeyDown(e, index)}
                    itemRef={setItemRef(index)}
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
        onRebind={onRebindProject}
        pathUnavailable={settingsProjectId === selectedId && projectPathUnavailable}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingProject) setDeleteProjectId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除项目？</AlertDialogTitle>
            <AlertDialogDescription>
              项目「{deleteTarget?.name}」的项目记录、环境快照和受管文件清单都会永久删除，不能恢复。项目文件夹本身不会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingProject}
              onClick={handleConfirmDelete}
            >
              {deletingProject ? "删除中..." : "永久删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
