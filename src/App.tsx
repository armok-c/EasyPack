import { Toaster } from "@/components/ui/sonner";
import "./index.css";

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar: 240px fixed, per UI-SPEC + D-04 */}
      <aside className="w-[240px] flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
        {/* Sidebar content placeholder */}
        <div className="p-6">
          <h1 className="text-base font-semibold text-foreground">EasyPack</h1>
        </div>
      </aside>

      {/* Main area: flex-1, per D-05 */}
      <main className="flex-1 flex flex-col p-6 overflow-auto">
        {/* Main content placeholder */}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">选择一个项目开始</p>
        </div>
      </main>

      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
