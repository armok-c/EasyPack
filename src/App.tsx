import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MainArea } from "@/components/MainArea";
import { TitleBar } from "@/components/TitleBar";
import { useProject } from "@/hooks/useProject";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import "./index.css";

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

  useGlobalShortcuts({
    commands,
    onExecute: executeCommand,
    enabled: !!currentProject,
    recording: isRecording,
  });

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar />
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
          onExecute={executeCommand}
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
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
