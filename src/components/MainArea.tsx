import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { FolderOpen, Settings, Plus } from "lucide-react";
import { CommandCard } from "@/components/CommandCard";
import { CommandDialog } from "@/components/CommandDialog";
import { EnvironmentWorkspace, type EnvironmentWorkspaceProps } from "@/components/EnvironmentWorkspace";
import { getIconByName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { CommandDialogHandle } from "@/components/CommandDialog";
import type { ProjectItem } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface MainAreaProps {
  currentProject: ProjectItem | null;
  onExecute: (command: string, cmd?: CommandItem) => void;
  // Phase 4: command list + edit mode
  commands: CommandItem[];
  editMode: boolean;
  setEditMode: (editMode: boolean) => void;
  addCommand: (name: string, command: string, icon?: string, extra?: { scriptLines?: string; executionMode?: "strict" | "lenient" | "batch" }) => Promise<void>;
  updateCommand: (id: string, data: { name: string; command: string; icon: string; scriptLines?: string; executionMode?: "strict" | "lenient" | "batch" }) => Promise<void>;
  deleteCommand: (id: string) => Promise<void>;
  // Phase 5 Plan 03: keyboard navigation zone management
  activeZone: "sidebar" | "main";
  onZoneSwitch: () => void;
  // Phase 8: project info display
  projectInfo: { size: string; branch: string | null } | null;
  projectInfoLoading: boolean;
  projectInfoError: boolean;
  // Phase 9: open folder
  onOpenFolder: () => void;
  /** New environment workflow, scoped to the active profile and project. */
  environment: EnvironmentWorkspaceProps;
}

export interface ProjectLeaveOptions {
  onInteractionNeeded?: () => void | Promise<void>;
}

export interface MainAreaHandle {
  requestProjectLeave: (options?: ProjectLeaveOptions) => Promise<boolean>;
}

// Approximate grid column count for arrow key navigation.
// Uses a simplified approach: assume 4 columns as typical for the auto-fill grid.
const ESTIMATED_GRID_COLS = 4;

export const MainArea = forwardRef<MainAreaHandle, MainAreaProps>(function MainArea({
  currentProject,
  onExecute,
  commands,
  editMode,
  setEditMode,
  addCommand,
  updateCommand,
  deleteCommand,
  activeZone,
  onZoneSwitch,
  projectInfo,
  projectInfoLoading,
  projectInfoError,
  onOpenFolder,
  environment,
}: MainAreaProps, ref) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CommandItem | null>(null);
  // Phase 5 Plan 03: card focus state (-1 = no focus)
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const [activePanel, setActivePanel] = useState<"commands" | "environment">("commands");
  const [busyCount, setBusyCount] = useState(0);
  const busyCountRef = useRef(0);
  const commandDialogRef = useRef<CommandDialogHandle | null>(null);
  const leaveRequestRef = useRef<Promise<boolean> | null>(null);

  const beginBusy = useCallback(() => {
    busyCountRef.current += 1;
    setBusyCount(busyCountRef.current);
  }, []);
  const endBusy = useCallback(() => {
    busyCountRef.current = Math.max(0, busyCountRef.current - 1);
    setBusyCount(busyCountRef.current);
  }, []);
  const runBusy = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    beginBusy();
    try {
      return await operation();
    } finally {
      endBusy();
    }
  }, [beginBusy, endBusy]);

  const resetCommandUi = useCallback(() => {
    setDialogOpen(false);
    setEditingCommand(null);
    setEditMode(false);
    setFocusedCardIndex(-1);
  }, [setEditMode]);

  const requestProjectLeave = useCallback(async (options?: ProjectLeaveOptions): Promise<boolean> => {
    if (leaveRequestRef.current) return leaveRequestRef.current;
    const request = (async () => {
      if (busyCountRef.current > 0) return false;
      if (environment.busy) {
        toast.info("环境操作还没完成，暂时不能切换项目");
        return false;
      }
      if (activePanel === "environment") {
        return true;
      }
      return commandDialogRef.current?.requestLeave(options) ?? true;
    })();
    leaveRequestRef.current = request;
    try {
      return await request;
    } finally {
      leaveRequestRef.current = null;
    }
  }, [activePanel, busyCount, environment.busy]);

  useImperativeHandle(ref, () => ({ requestProjectLeave }), [requestProjectLeave]);

  const handlePanelChange = useCallback(async (nextPanel: "commands" | "environment") => {
    if (nextPanel === activePanel || busyCountRef.current > 0) return;
    const allowed = await requestProjectLeave();
    if (!allowed) return;
    if (nextPanel === "environment") {
      resetCommandUi();
    }
    setActivePanel(nextPanel);
  }, [activePanel, busyCount, requestProjectLeave, resetCommandUi]);

  const handlePanelTriggerKeyDown = useCallback((panel: "commands" | "environment", event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void handlePanelChange(panel);
    }
  }, [handlePanelChange]);

  // Reset dialog state on project switch to prevent stale data from other projects
  useEffect(() => {
    setEditingCommand(null);
    setDialogOpen(false);
    setEditMode(false);
    setActivePanel("commands");
    setFocusedCardIndex(-1);
  }, [currentProject?.id, setEditMode]);

  const handleEdit = useCallback((cmd: CommandItem) => {
    setEditingCommand(cmd);
    setDialogOpen(true);
  }, []);

  const handleDialogSubmit = useCallback(
    async (data: { name: string; command: string; icon: string; scriptLines?: string; executionMode?: "strict" | "lenient" | "batch" }) => {
      await runBusy(async () => {
        if (editingCommand) {
          await updateCommand(editingCommand.id, data);
        } else {
          await addCommand(data.name, data.command, data.icon, {
            scriptLines: data.scriptLines,
            executionMode: data.executionMode,
          });
        }
        setDialogOpen(false);
        setEditingCommand(null);
      });
    },
    [editingCommand, addCommand, updateCommand, runBusy]
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingCommand(null);
    }
    setDialogOpen(open);
  }, []);

  // Auto-focus first card when main zone becomes active
  useEffect(() => {
    if (activePanel === "commands" && activeZone === "main" && commands.length > 0 && focusedCardIndex === -1) {
      setFocusedCardIndex(0);
    }
    if (activePanel !== "commands" || activeZone !== "main") {
      setFocusedCardIndex(-1);
    }
  }, [activePanel, activeZone, commands.length, focusedCardIndex]);

  // Focus the card element when focusedCardIndex changes (via DOM query)
  useEffect(() => {
    if (activePanel === "commands" && activeZone === "main" && focusedCardIndex >= 0 && gridRef.current) {
      const buttons = gridRef.current.querySelectorAll<HTMLButtonElement>(
        ':scope > button:not([class*="border-dashed"])'
      );
      buttons[focusedCardIndex + 1]?.focus();
    }
  }, [activePanel, activeZone, focusedCardIndex]);

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
            onExecute(cmd.command, cmd);
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
      <div className="mb-4">
        <h2 className="min-w-0 truncate text-sm font-medium text-foreground" title={currentProject.name}>
          当前项目: {currentProject.name}
        </h2>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate" title={currentProject.path}>
              {currentProject.path}
            </p>
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
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-white text-black hover:bg-white/90 hover:text-black"
            onClick={onOpenFolder}
            aria-label="打开项目文件夹"
          >
            <FolderOpen className="size-3.5" />
            打开文件夹
          </Button>
        </div>
      </div>

      <Tabs
        value={activePanel}
        activationMode="manual"
        className="flex-1"
      >
        <div className="flex w-full items-center">
          <TabsList className="shrink-0">
            <TabsTrigger
              value="commands"
              onClick={() => { void handlePanelChange("commands"); }}
              onKeyDown={(event) => handlePanelTriggerKeyDown("commands", event)}
            >项目指令</TabsTrigger>
            <TabsTrigger
              value="environment"
              onClick={() => { void handlePanelChange("environment"); }}
              onKeyDown={(event) => handlePanelTriggerKeyDown("environment", event)}
            >项目环境</TabsTrigger>
          </TabsList>

          {activePanel === "commands" && (
            <button
              onClick={() => setEditMode(!editMode)}
              aria-label={editMode ? "完成编辑" : "编辑指令"}
              aria-pressed={editMode}
              className={cn(
                "ml-auto p-1.5 rounded-md transition-all duration-150 ease-out",
                "text-muted-foreground hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                editMode && "text-foreground bg-white/10 ring-1 ring-white/20"
              )}
            >
              <Settings className="size-4" />
            </button>
          )}
        </div>

        <TabsContent value="commands" className="mt-4">
          <div
            ref={gridRef}
            className="grid grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))] gap-3"
            onKeyDown={handleGridKeyDown}
          >
            <CommandCard
              name="终端"
              icon={getIconByName("Terminal")}
              command="cmd.exe"
              isCustom={false}
              editMode={false}
              onClick={() => onExecute("cmd.exe")}
            />
            {commands.map((cmd, index) => {
              const isCustom = cmd.type === "custom";
              const canEdit = editMode && (isCustom || cmd.scope === "project");
              const isCardFocused = activeZone === "main" && index === focusedCardIndex;

              return (
                <CommandCard
                  key={cmd.id}
                  name={cmd.name}
                  icon={getIconByName(cmd.icon)}
                  command={cmd.command}
                  scriptLines={cmd.scriptLines}
                  isCustom={isCustom}
                  editMode={canEdit}
                  onEdit={() => handleEdit(cmd)}
                  onDelete={() => { void runBusy(() => deleteCommand(cmd.id)); }}
                  commandId={cmd.id}
                  onClick={() => onExecute(cmd.command, cmd)}
                  tabIndex={isCardFocused ? 0 : -1}
                  shortcut={cmd.shortcut}
                  shortcutNumber={!cmd.shortcut && !isCustom && !canEdit && index < 9 ? index + 1 : undefined}
                />
              );
            })}

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

          <CommandDialog
            ref={commandDialogRef}
            key={editingCommand?.id ?? "add"}
            open={dialogOpen}
            onOpenChange={handleDialogOpenChange}
            onSubmit={handleDialogSubmit}
            initialData={editingCommand}
          />
        </TabsContent>

        <TabsContent value="environment" className="mt-4">
          <EnvironmentWorkspace key={environment.scopeKey} {...environment} />
        </TabsContent>
      </Tabs>
    </main>
  );
});
