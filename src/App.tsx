import { useState, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MainArea } from "@/components/MainArea";
import { TitleBar } from "@/components/TitleBar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useProject } from "@/hooks/useProject";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useVisibilityState } from "@/hooks/useVisibilityState";
import { useRecentCommands } from "@/hooks/useRecentCommands";
import { useTray } from "@/hooks/useTray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./index.css";

const appWindow = getCurrentWindow();

function App() {
  const {
    projects,
    selectedId,
    currentProject,
    selectFolder,
    selectProject,
    removeProject,
    executeCommand,
    // Phase 4: command management
    commands,
    commandMode,
    editMode,
    setEditMode,
    addCommand,
    updateCommand,
    deleteCommand,
    enableProjectCommands,
    disableProjectCommands,
    // Phase 5: project icon & color
    updateProjectStyle,
    // Phase 5: drag-and-drop reorder
    reorderProjects,
    // Phase 8: project info
    projectInfo,
    projectInfoLoading,
    projectInfoError,
    // Phase 9: open folder
    openFolder,
    // Phase 11: shortcut assignment
    assignShortcut,
    clearShortcut,
    // Phase 12: store for tray settings
    store,
  } = useProject();

  // Phase 5 Plan 03: keyboard navigation zone management (per D-15, D-16)
  const [activeZone, setActiveZone] = useState<"sidebar" | "main">("sidebar");
  const handleZoneSwitch = useCallback(() => {
    setActiveZone((prev) => (prev === "sidebar" ? "main" : "sidebar"));
  }, []);

  // Phase 9: derive project toggle disabled state (per D-05)
  const isProjectToggleDisabled = !currentProject;

  // Phase 9: open folder handler with project path bound
  const handleOpenFolder = useCallback(() => {
    if (currentProject) {
      openFolder(currentProject.path);
    }
  }, [currentProject, openFolder]);

  // Phase 5 Plan 03: global number key shortcuts (per D-13)
  useKeyboard({
    commands,
    currentProject,
    onExecute: executeCommand,
    editMode,
  });

  // Phase 11: OS-level global shortcuts (per KB-02, KB-03)
  const [isRecording, setIsRecording] = useState(false);
  const handleRecordingChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
  }, []);

  // Phase 12: tray settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(true);
  const [closeToTray, setCloseToTray] = useState(true);

  // Phase 12: window visibility state machine
  const { visibility, hideToTray, showFromTray } = useVisibilityState();

  // Phase 12: recent commands tracking
  const { recentCommands, addRecentCommand } = useRecentCommands({ store });

  // Phase 12: execute with recent command tracking
  const handleExecuteWithRecent = useCallback(async (shellCommand: string) => {
    const success = await executeCommand(shellCommand);
    if (!success) return;
    const cmd = commands.find((c) => c.command === shellCommand);
    if (cmd) {
      await addRecentCommand(cmd.name, cmd.command);
    } else {
      await addRecentCommand(shellCommand, shellCommand);
    }
  }, [executeCommand, commands, addRecentCommand]);

  useGlobalShortcuts({
    commands,
    onExecute: handleExecuteWithRecent,
    enabled: !!currentProject,
    recording: isRecording,
  });

  // Phase 12: system tray
  useTray({
    currentProject,
    commands,
    recentCommands,
    visibility,
    onExecute: handleExecuteWithRecent,
    onShow: () => { showFromTray(); appWindow.show().catch(console.error); appWindow.setFocus().catch(console.error); },
    onHide: () => { hideToTray(); appWindow.hide().catch(console.error); },
    onQuit: async () => { await appWindow.destroy(); },
    enabled: trayEnabled,
  });

  // Phase 12: onCloseRequested interception (per D-07)
  useEffect(() => {
    if (!closeToTray) return;
    const unlisten = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      hideToTray();
      await appWindow.hide();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [closeToTray, hideToTray]);

  // Phase 12: load tray settings from store on mount
  useEffect(() => {
    let mounted = true;
    async function loadTraySettings() {
      if (!store) return;
      const saved = await store.get<boolean>("trayEnabled");
      const savedCTT = await store.get<boolean>("closeToTray");
      if (mounted) {
        if (saved !== undefined && saved !== null) setTrayEnabled(saved);
        if (savedCTT !== undefined && savedCTT !== null) setCloseToTray(savedCTT);
      }
    }
    loadTraySettings();
    return () => { mounted = false; };
  }, [store]);

  // Phase 12: persist tray settings on change
  const handleTrayEnabledChange = useCallback(async (enabled: boolean) => {
    setTrayEnabled(enabled);
    if (!enabled) {
      setCloseToTray(false);
      await store?.set("closeToTray", false);
    }
    await store?.set("trayEnabled", enabled);
  }, [store]);

  const handleCloseToTrayChange = useCallback(async (enabled: boolean) => {
    setCloseToTray(enabled);
    await store?.set("closeToTray", enabled);
  }, [store]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar
        onSettingsOpen={() => setSettingsOpen(true)}
        onCloseBehavior={closeToTray ? "hide" : "close"}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          projects={projects}
          selectedId={selectedId}
          onAddProject={selectFolder}
          onSelectProject={selectProject}
          onRemoveProject={removeProject}
          onUpdateStyle={updateProjectStyle}
          onReorderProjects={reorderProjects}
          activeZone={activeZone}
          onZoneSwitch={handleZoneSwitch}
        />
        <MainArea
          currentProject={currentProject}
          onExecute={handleExecuteWithRecent}
          commands={commands}
          commandMode={commandMode}
          editMode={editMode}
          setEditMode={setEditMode}
          addCommand={addCommand}
          updateCommand={updateCommand}
          deleteCommand={deleteCommand}
          enableProjectCommands={enableProjectCommands}
          disableProjectCommands={disableProjectCommands}
          activeZone={activeZone}
          onZoneSwitch={handleZoneSwitch}
          projectInfo={projectInfo}
          projectInfoLoading={projectInfoLoading}
          projectInfoError={projectInfoError}
          onOpenFolder={handleOpenFolder}
          isProjectToggleDisabled={isProjectToggleDisabled}
          assignShortcut={assignShortcut}
          clearShortcut={clearShortcut}
          onRecordingChange={handleRecordingChange}
        />
      </div>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        trayEnabled={trayEnabled}
        onTrayEnabledChange={handleTrayEnabledChange}
        closeToTray={closeToTray}
        onCloseToTrayChange={handleCloseToTrayChange}
      />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
