import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MainArea } from "@/components/MainArea";
import { useProject } from "@/hooks/useProject";
import "./index.css";

function App() {
  const { currentProject, selectFolder, executeCommand } = useProject();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar currentProject={currentProject} onAddProject={selectFolder} />
      <MainArea currentProject={currentProject} onExecute={executeCommand} />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
