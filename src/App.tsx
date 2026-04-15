import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MainArea } from "@/components/MainArea";
import { useProject } from "@/hooks/useProject";
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
  } = useProject();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        onAddProject={selectFolder}
        onSelectProject={selectProject}
        onRemoveProject={removeProject}
        onUpdateStyle={updateProjectStyle}
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
      />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
