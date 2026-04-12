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
  } = useProject();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        onAddProject={selectFolder}
        onSelectProject={selectProject}
        onRemoveProject={removeProject}
      />
      <MainArea currentProject={currentProject} onExecute={executeCommand} />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
