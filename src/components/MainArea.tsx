import { useState, useCallback, useRef, useEffect } from "react";
import { FolderOpen, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  addCommand: (name: string, command: string, icon?: string, scope?: "global" | "project") => Promise<void>;
  updateCommand: (id: string, data: { name: string; command: string; icon: string }) => Promise<void>;
  deleteCommand: (id: string) => Promise<void>;
  enableProjectCommands: () => Promise<void>;
  disableProjectCommands: () => Promise<void>;
  // Phase 5 Plan 03: keyboard navigation zone management
  activeZone: "sidebar" | "main";
  onZoneSwitch: () => void;
  // Phase 8: project info display
  projectInfo: { size: string; branch: string | null } | null;
  projectInfoLoading: boolean;
  projectInfoError: boolean;
  // Phase 9: open folder + toggle disabled state
  onOpenFolder: () => void;
  isProjectToggleDisabled: boolean;
  // Phase 11: shortcut management
  assignShortcut: (commandId: string, shortcut: string) => Promise<boolean>;
  clearShortcut: (commandId: string) => Promise<void>;
}

// Approximate grid column count for arrow key navigation.
// Uses a simplified approach: assume 4 columns as typical for the auto-fill grid.
const ESTIMATED_GRID_COLS = 4;

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
  activeZone,
  onZoneSwitch,
  projectInfo,
  projectInfoLoading,
  projectInfoError,
  onOpenFolder,
  isProjectToggleDisabled,
  assignShortcut,
  clearShortcut,
}: MainAreaProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CommandItem | null>(null);
  // Phase 5 Plan 03: card focus state (-1 = no focus)
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Phase 11: shortcut recording state
  const [recordingCommandId, setRecordingCommandId] = useState<string | null>(null);
  const [conflictCommandId, setConflictCommandId] = useState<string | null>(null);

  const handleEdit = useCallback((cmd: CommandItem) => {
    setEditingCommand(cmd);
    setDialogOpen(true);
  }, []);

  // Phase 11: shortcut recording callbacks
  const handleRecordingStart = useCallback((commandId: string) => {
    setRecordingCommandId(commandId);
    setConflictCommandId(null);
  }, []);

  const handleRecordingStop = useCallback(() => {
    setRecordingCommandId(null);
    setConflictCommandId(null);
  }, []);

  const handleShortcutAssign = useCallback(async (commandId: string, shortcut: string) => {
    const success = await assignShortcut(commandId, shortcut);
    if (!success) {
      setConflictCommandId(commandId);
      setTimeout(() => setConflictCommandId(null), 2000);
    } else {
      setRecordingCommandId(null);
    }
  }, [assignShortcut]);

  const handleShortcutClear = useCallback(async (commandId: string) => {
    await clearShortcut(commandId);
  }, [clearShortcut]);

  // Cancel recording when edit mode is turned off
  useEffect(() => {
    if (!editMode) {
      setRecordingCommandId(null);
      setConflictCommandId(null);
    }
  }, [editMode]);

  const handleDialogSubmit = useCallback(
    async (data: { name: string; command: string; icon: string; scope?: "global" | "project" }) => {
      if (editingCommand) {
        await updateCommand(editingCommand.id, data);
      } else {
        await addCommand(data.name, data.command, data.icon, data.scope);
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

  // Auto-focus first card when main zone becomes active
  useEffect(() => {
    if (activeZone === "main" && commands.length > 0 && focusedCardIndex === -1) {
      setFocusedCardIndex(0);
    }
    if (activeZone !== "main") {
      setFocusedCardIndex(-1);
    }
  }, [activeZone, commands.length, focusedCardIndex]);

  // Focus the card element when focusedCardIndex changes (via DOM query)
  useEffect(() => {
    if (activeZone === "main" && focusedCardIndex >= 0 && gridRef.current) {
      const buttons = gridRef.current.querySelectorAll<HTMLButtonElement>(
        ':scope > button:not([class*="border-dashed"])'
      );
      buttons[focusedCardIndex]?.focus();
    }
  }, [activeZone, focusedCardIndex]);

  // Card keyboard navigation handler
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (focusedCardIndex < 0 || commands.length === 0) return;

      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          const next = Math.min(focusedCardIndex + 1, commands.length - 1);
          setFocusedCardIndex(next);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const prev = Math.max(focusedCardIndex - 1, 0);
          setFocusedCardIndex(prev);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const below = Math.min(focusedCardIndex + ESTIMATED_GRID_COLS, commands.length - 1);
          setFocusedCardIndex(below);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const above = Math.max(focusedCardIndex - ESTIMATED_GRID_COLS, 0);
          setFocusedCardIndex(above);
          break;
        }
        case "Enter": {
          e.preventDefault();
          const cmd = commands[focusedCardIndex];
          if (cmd) {
            onExecute(cmd.command);
          }
          break;
        }
        case "Tab": {
          e.preventDefault();
          onZoneSwitch();
          break;
        }
      }
    },
    [focusedCardIndex, commands, onExecute, onZoneSwitch]
  );

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
        {/* Phase 8: folder size + Git branch (per D-04, D-07, D-08) */}
        {(projectInfo || projectInfoLoading) && (
          <div className="flex items-center gap-1 mt-1" aria-live="polite">
            <span className="text-xs text-muted-foreground">
              {projectInfoLoading ? "计算中..." : projectInfoError ? "无法计算" : projectInfo?.size}
            </span>
            {projectInfo?.branch && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  分支: {projectInfo.branch}
                </span>
              </>
            )}
          </div>
        )}
        {/* Phase 9: Toggle Group + 打开文件夹 button row (per D-01, D-02, D-03, D-05, D-06) */}
        <div className="flex items-center justify-between mt-2">
          <div
            className="inline-flex rounded-md overflow-hidden border border-white/10"
            role="radiogroup"
            aria-label="指令模式切换"
          >
            <Button
              variant={commandMode === "global" ? "secondary" : "ghost"}
              size="sm"
              role="radio"
              aria-checked={commandMode === "global"}
              aria-label="全局指令"
              className={cn(
                "rounded-none border-r border-white/10",
                commandMode === "global" && "rounded-l-md"
              )}
              onClick={commandMode !== "global" ? disableProjectCommands : undefined}
            >
              全局指令
            </Button>
            <Button
              variant={commandMode === "project" ? "secondary" : "ghost"}
              size="sm"
              role="radio"
              aria-checked={commandMode === "project"}
              aria-label="项目指令"
              aria-disabled={isProjectToggleDisabled}
              className={cn(
                "rounded-none",
                commandMode === "project" && "rounded-r-md"
              )}
              disabled={isProjectToggleDisabled}
              onClick={commandMode !== "project" ? enableProjectCommands : undefined}
            >
              项目指令
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFolder}
            disabled={!currentProject}
            aria-label="打开项目文件夹"
          >
            <FolderOpen className="size-3.5" />
            打开文件夹
          </Button>
        </div>
      </div>

      {/* Command cards grid (per UI-SPEC Grid: auto-fill adaptive) */}
      <div
        ref={gridRef}
        className="grid grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))] gap-3"
        onKeyDown={handleGridKeyDown}
      >
        {commands.map((cmd, index) => {
          const isCustom = cmd.type === "custom";
          // canEdit: edit mode + (custom command OR project-scope command)
          // Per D-11: project-level presets can be deleted/edited
          const canEdit = editMode && (isCustom || cmd.scope === "project");
          const isCardFocused = activeZone === "main" && index === focusedCardIndex;

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
              tabIndex={isCardFocused ? 0 : -1}
              shortcut={cmd.shortcut}
              shortcutNumber={!cmd.shortcut && !isCustom && !canEdit && index < 9 ? index + 1 : undefined}
              isRecording={recordingCommandId === cmd.id}
              hasConflict={conflictCommandId === cmd.id}
              onRecordingStart={() => handleRecordingStart(cmd.id)}
              onRecordingStop={handleRecordingStop}
              onShortcutAssign={(s) => handleShortcutAssign(cmd.id, s)}
              onShortcutClear={() => handleShortcutClear(cmd.id)}
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
        commandMode={commandMode}
        hasProject={!!currentProject}
      />
    </main>
  );
}
