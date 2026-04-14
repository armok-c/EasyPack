import { useState, useCallback } from "react";
import { FolderOpen, Settings, Plus } from "lucide-react";
import { CommandCard } from "@/components/CommandCard";
import { CommandDialog } from "@/components/CommandDialog";
import { getIconByName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ProjectItem } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";

interface MainAreaProps {
  currentProject: ProjectItem | null;
  onExecute: (command: string) => void;
  // Phase 4: command list + edit mode + mode management
  commands: CommandItem[];
  commandMode: "global" | "project";
  editMode: boolean;
  setEditMode: (editMode: boolean) => void;
  addCommand: (name: string, command: string, icon?: string) => Promise<void>;
  updateCommand: (id: string, data: { name: string; command: string; icon: string }) => Promise<void>;
  deleteCommand: (id: string) => Promise<void>;
  enableProjectCommands: () => Promise<void>;
  disableProjectCommands: () => Promise<void>;
}

export function MainArea({
  currentProject,
  onExecute,
  commands,
  commandMode,
  editMode,
  setEditMode,
  addCommand,
  updateCommand,
  deleteCommand,
  enableProjectCommands,
  disableProjectCommands,
}: MainAreaProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CommandItem | null>(null);

  const handleEdit = useCallback((cmd: CommandItem) => {
    setEditingCommand(cmd);
    setDialogOpen(true);
  }, []);

  const handleDialogSubmit = useCallback(
    async (data: { name: string; command: string; icon: string }) => {
      if (editingCommand) {
        await updateCommand(editingCommand.id, data);
      } else {
        await addCommand(data.name, data.command, data.icon);
      }
      setDialogOpen(false);
      setEditingCommand(null);
    },
    [editingCommand, addCommand, updateCommand]
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingCommand(null);
    }
    setDialogOpen(open);
  }, []);

  if (!currentProject) {
    // per D-19: first launch guide page
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

  return (
    <main className="flex-1 flex flex-col p-8 overflow-auto">
      {/* Project info area */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">
            当前项目: {currentProject.name}
          </h2>
          {/* Edit mode toggle button (per D-01, D-06) */}
          <button
            onClick={() => setEditMode(!editMode)}
            aria-label={editMode ? "完成编辑" : "编辑指令"}
            aria-pressed={editMode}
            className={cn(
              "p-1.5 rounded-md transition-all duration-150 ease-out",
              "text-muted-foreground hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              editMode && "text-foreground bg-white/10 ring-1 ring-white/20"
            )}
          >
            <Settings className="size-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{currentProject.path}</p>
        {/* Mode label + switch entry (per D-09) */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {commandMode === "global" ? "全局指令" : "项目自定义指令"}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          {commandMode === "global" ? (
            <button
              onClick={enableProjectCommands}
              className="text-xs text-primary/60 hover:text-primary cursor-pointer underline-offset-2 hover:underline transition-colors duration-150"
            >
              使用项目自定义指令
            </button>
          ) : (
            <button
              onClick={disableProjectCommands}
              className="text-xs text-primary/60 hover:text-primary cursor-pointer underline-offset-2 hover:underline transition-colors duration-150"
            >
              使用全局指令
            </button>
          )}
        </div>
      </div>

      {/* Command cards grid (per UI-SPEC Grid: auto-fill adaptive) */}
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))] gap-3">
        {commands.map((cmd) => {
          const isCustom = cmd.type === "custom";
          // canEdit: edit mode + (custom command OR project-scope command)
          // Per D-11: project-level presets can be deleted/edited
          const canEdit = editMode && (isCustom || cmd.scope === "project");

          return (
            <CommandCard
              key={cmd.id}
              name={cmd.name}
              icon={getIconByName(cmd.icon)}
              command={cmd.command}
              isCustom={isCustom}
              editMode={canEdit}
              onEdit={() => handleEdit(cmd)}
              onDelete={() => deleteCommand(cmd.id)}
              commandId={cmd.id}
              onClick={() => onExecute(cmd.command)}
            />
          );
        })}

        {/* Add command placeholder card (per D-02) */}
        {editMode && (
          <button
            onClick={() => {
              setEditingCommand(null);
              setDialogOpen(true);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
              "border-2 border-dashed border-white/20 bg-transparent",
              "cursor-pointer select-none text-xs text-muted-foreground",
              "transition-all duration-150 ease-out",
              "hover:border-white/30 hover:bg-white/5",
              "active:border-white/40 active:bg-white/10 active:scale-[0.98]"
            )}
          >
            <Plus className="size-5 text-muted-foreground" />
            <span>添加指令</span>
          </button>
        )}
      </div>

      {/* CommandDialog for add/edit */}
      <CommandDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleDialogSubmit}
        initialData={editingCommand}
      />
    </main>
  );
}
