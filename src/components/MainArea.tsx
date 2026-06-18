import { useState, useCallback, useRef, useEffect } from "react";
import { FolderOpen, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandCard } from "@/components/CommandCard";
import { CommandDialog } from "@/components/CommandDialog";
import { EnvTabBar } from "@/components/EnvTabBar";
import { EnvSwitchBar } from "@/components/EnvSwitchBar";
import { ManageEnvDialog } from "@/components/ManageEnvDialog";
import { FileList } from "@/components/FileList";
import { EnvSelectDialog } from "@/components/EnvSelectDialog";
import { DiffViewDialog } from "@/components/DiffViewDialog";
import { computeMatchCounts } from "@/lib/diff-utils";
import { getIconByName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ProjectItem } from "@/hooks/useProject";
import type { CommandItem, Environment, ManagedFile } from "@/lib/types";

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
  enableProjectCommands: () => Promise<void>;
  // Phase 5 Plan 03: keyboard navigation zone management
  activeZone: "sidebar" | "main";
  onZoneSwitch: () => void;
  // Phase 8: project info display
  projectInfo: { size: string; branch: string | null } | null;
  projectInfoLoading: boolean;
  projectInfoError: boolean;
  // Phase 9: open folder
  onOpenFolder: () => void;
  // Phase 23: Environment management
  envs: Environment[];
  activeEnvId: string | null;
  onCreateEnv: (name: string) => Promise<string | null>;
  onRenameEnv: (envId: string, newName: string) => Promise<void>;
  onDeleteEnv: (envId: string) => Promise<void>;
  onApplyEnv: (envId: string) => Promise<boolean>;
  // Phase 24: File management
  onAddFiles: (projectId: string, envId: string, files: ManagedFile[]) => Promise<void>;
  onDeleteFiles: (projectId: string, envId: string, fileNames: string[]) => Promise<void>;
  onUpdateFile: (projectId: string, envId: string, fileName: string, content: string) => Promise<void>;
}

// Approximate grid column count for arrow key navigation.
// Uses a simplified approach: assume 4 columns as typical for the auto-fill grid.
const ESTIMATED_GRID_COLS = 4;

export function MainArea({
  currentProject,
  onExecute,
  commands,
  editMode,
  setEditMode,
  addCommand,
  updateCommand,
  deleteCommand,
  enableProjectCommands,
  activeZone,
  onZoneSwitch,
  projectInfo,
  projectInfoLoading,
  projectInfoError,
  onOpenFolder,
  // Phase 23: Environment management
  envs,
  activeEnvId,
  onCreateEnv,
  onRenameEnv,
  onDeleteEnv,
  onApplyEnv,
  // Phase 24: File management
  onAddFiles,
  onDeleteFiles,
  onUpdateFile,
}: MainAreaProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CommandItem | null>(null);
  // Phase 5 Plan 03: card focus state (-1 = no focus)
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Phase 23: Env UI state (D-14: selectedEnvId independent from activeEnvId)
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [manageEnvOpen, setManageEnvOpen] = useState(false);
  const [applyingEnv, setApplyingEnv] = useState(false);

  // Phase 25: Sync diff state
  const [syncDiffCheckedFiles, setSyncDiffCheckedFiles] = useState<string[]>([]);
  const [envSelectOpen, setEnvSelectOpen] = useState(false);
  const [diffViewOpen, setDiffViewOpen] = useState(false);
  const [selectedTargetEnvs, setSelectedTargetEnvs] = useState<Environment[]>([]);
  const [syncDiffSourceEnv, setSyncDiffSourceEnv] = useState<{ id: string; name: string; files: ManagedFile[] } | null>(null);

  // Reset dialog state on project switch to prevent stale data from other projects
  useEffect(() => {
    setEditingCommand(null);
    setDialogOpen(false);
  }, [currentProject?.id]);

  const handleEdit = useCallback((cmd: CommandItem) => {
    setEditingCommand(cmd);
    setDialogOpen(true);
  }, []);

  const handleDialogSubmit = useCallback(
    async (data: { name: string; command: string; icon: string; scriptLines?: string; executionMode?: "strict" | "lenient" | "batch" }) => {
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
    },
    [editingCommand, addCommand, updateCommand]
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingCommand(null);
    }
    setDialogOpen(open);
  }, []);

  // Phase 23: Delete env handler with auto-switch per D-18
  const handleDeleteEnv = useCallback(
    async (envId: string) => {
      await onDeleteEnv(envId);
      // D-18: auto-switch to nearest neighbor tab
      setSelectedEnvId((prev) => {
        if (prev !== envId) return prev; // wasn't selected, no change
        const remaining = envs.filter((e) => e.id !== envId);
        if (remaining.length === 0) return null;
        const deletedIdx = envs.findIndex((e) => e.id === envId);
        // right neighbor first, then left neighbor
        const nextIdx = Math.min(deletedIdx, remaining.length - 1);
        return remaining[nextIdx].id;
      });
    },
    [envs, onDeleteEnv]
  );

  // Phase 23: Apply env handler with loading state
  const handleApplyEnv = useCallback(
    async (envId: string) => {
      setApplyingEnv(true);
      try {
        await onApplyEnv(envId);
      } finally {
        setApplyingEnv(false);
      }
    },
    [onApplyEnv]
  );

  // Phase 25: Handle sync diff button click from FileList
  const handleSyncDiff = useCallback((checkedFiles: string[]) => {
    setSyncDiffCheckedFiles(checkedFiles);
    setEnvSelectOpen(true);
  }, []);

  // Phase 25: Handle env selection confirm
  const handleEnvSelectConfirm = useCallback(
    async (selectedEnvIds: string[]) => {
      const targetEnvs = envs.filter((e) => selectedEnvIds.includes(e.id));
      setSelectedTargetEnvs(targetEnvs);
      // Set source env for DiffViewDialog
      if (selectedEnvId) {
        const sourceEnv = envs.find((e) => e.id === selectedEnvId);
        if (sourceEnv) {
          setSyncDiffSourceEnv({
            id: sourceEnv.id,
            name: sourceEnv.name,
            files: sourceEnv.files,
          });
        }
      }
      setEnvSelectOpen(false);
      setDiffViewOpen(true);
    },
    [envs, selectedEnvId],
  );

  // Phase 23: Auto-select first env when envs change (per D-14)
  useEffect(() => {
    if (envs.length > 0 && selectedEnvId === null) {
      setSelectedEnvId(envs[0].id);
    }
    if (envs.length === 0) {
      setSelectedEnvId(null);
    }
  }, [envs, selectedEnvId]);

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
      buttons[focusedCardIndex + 1]?.focus();
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
        <p className="text-xs text-muted-foreground mt-1">
          {currentProject.path}
          {/* "打开文件夹" link moved from below to project info area */}
          <button
            onClick={onOpenFolder}
            className="inline-flex items-center gap-0.5 ml-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer align-baseline"
            aria-label="打开项目文件夹"
          >
            <FolderOpen className="size-3" />
            打开文件夹
          </button>
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
        {/* Phase 23: 环境切换栏（ENV-08）- 项目信息下方，标签页上方 */}
        {currentProject && (
          <EnvSwitchBar
            envs={envs}
            activeEnvId={activeEnvId}
            onApply={handleApplyEnv}
            applying={applyingEnv}
          />
        )}

        {/* Phase 23: 环境标签页 + 管理按钮（ENV-01/ENV-02） */}
        {currentProject && (
          <EnvTabBar
            envs={envs}
            selectedEnvId={selectedEnvId}
            activeEnvId={activeEnvId}
            onSelectEnv={setSelectedEnvId}
            onManageEnv={() => setManageEnvOpen(true)}
          />
        )}

        {/* Phase 24: 文件管理列表 */}
        {currentProject && selectedEnvId && (() => {
          const currentEnv = envs.find((e) => e.id === selectedEnvId);
          if (!currentEnv) return null;
          return (
            <FileList
              envId={currentEnv.id}
              files={currentEnv.files}
              projectPath={currentProject.path}
              onAddFiles={(envId, files) => onAddFiles(currentProject.id, envId, files)}
              onDeleteFiles={(envId, fileNames) => onDeleteFiles(currentProject.id, envId, fileNames)}
              onUpdateFile={(envId, fileName, content) => onUpdateFile(currentProject.id, envId, fileName, content)}
              onSyncDiff={handleSyncDiff}
            />
          );
        })()}
      </div>

      {/* Phase 23: 管理环境模态窗 */}
      {currentProject && (
        <ManageEnvDialog
          open={manageEnvOpen}
          onOpenChange={setManageEnvOpen}
          envs={envs}
          activeEnvId={activeEnvId}
          onCreateEnv={onCreateEnv}
          onRenameEnv={onRenameEnv}
          onDeleteEnv={handleDeleteEnv}
        />
      )}

      {/* Command cards grid (per UI-SPEC Grid: auto-fill adaptive) */}
      <div
        ref={gridRef}
        className="grid grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))] gap-3"
        onKeyDown={handleGridKeyDown}
      >
        {/* D-03/D-04/D-05: 内置终端卡片 — 始终显示，不对应 CommandItem 数据模型 */}
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
              scriptLines={cmd.scriptLines}
              isCustom={isCustom}
              editMode={canEdit}
              onEdit={() => handleEdit(cmd)}
              onDelete={() => deleteCommand(cmd.id)}
              commandId={cmd.id}
              onClick={() => onExecute(cmd.command, cmd)}
              tabIndex={isCardFocused ? 0 : -1}
              shortcut={cmd.shortcut}
              shortcutNumber={!cmd.shortcut && !isCustom && !canEdit && index < 9 ? index + 1 : undefined}
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

      {/* Phase 25: 环境选择弹窗 */}
      {currentProject && selectedEnvId && envs.length > 1 && (() => {
        const sourceEnv = envs.find((e) => e.id === selectedEnvId);
        if (!sourceEnv) return null;
        const otherEnvs = envs
          .filter((e) => e.id !== selectedEnvId)
          .map((e) => {
            const counts = computeMatchCounts(sourceEnv.files, e.files);
            return {
              id: e.id,
              name: e.name,
              matched: counts.matched,
              missing: counts.missing,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        return (
          <EnvSelectDialog
            open={envSelectOpen}
            onOpenChange={setEnvSelectOpen}
            sourceEnvName={sourceEnv.name}
            targetEnvs={otherEnvs}
            onConfirm={handleEnvSelectConfirm}
          />
        );
      })()}

      {/* Phase 25: 差异对比模态窗 */}
      {syncDiffSourceEnv && selectedTargetEnvs.length > 0 && (
        <DiffViewDialog
          open={diffViewOpen}
          onOpenChange={setDiffViewOpen}
          sourceEnv={syncDiffSourceEnv}
          targetEnvs={selectedTargetEnvs}
          fileNames={syncDiffCheckedFiles}
          projectId={currentProject.id}
          onUpdateFile={onUpdateFile}
          onAddFiles={onAddFiles}
          onDeleteFiles={onDeleteFiles}
        />
      )}

      {/* CommandDialog for add/edit — key forces remount so useState initializers re-run */}
      <CommandDialog
        key={editingCommand?.id ?? "add"}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleDialogSubmit}
        initialData={editingCommand}
      />
    </main>
  );
}
