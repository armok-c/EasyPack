import { useState, useEffect } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { X, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ProjectItem } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";
import { getIconByName, isFileIcon, getFilePath } from "@/lib/icons";

const floatWindow = getCurrentWindow();

function FloatApp() {
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unlistenPromise = listen<{
      project: ProjectItem | null;
      projects: ProjectItem[];
      commands: CommandItem[];
    }>("float:state-update", (event) => {
      if (cancelled) return;
      setProject(event.payload.project);
      setProjects(event.payload.projects);
      setCommands(event.payload.commands);
    });
    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  function handleDragStart(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    floatWindow.startDragging();
  }

  function handleRowClick(index: number, shellCommand: string) {
    if (!project || flashIndex !== null) return;
    setFlashIndex(index);
    emit("float:execute", { command: shellCommand });
    setTimeout(() => setFlashIndex(null), 200);
  }

  function handleClose() {
    emit("float:close-requested");
  }

  function handleSwitchProject() {
    if (!project || projects.length <= 1) return;
    const currentIndex = projects.findIndex((p) => p.id === project.id);
    const nextIndex = (currentIndex + 1) % projects.length;
    emit("float:switch-project", { projectId: projects[nextIndex].id });
  }

  async function handleCollapse() {
    setCollapsed(true);
    setTimeout(async () => {
      try {
        await floatWindow.setSize(new LogicalSize(130, 32));
      } catch { /* ignore resize errors */ }
    }, 300);
  }

  async function handleExpand() {
    try {
      const contentHeight = project
        ? Math.min(commands.length * 28 + 72, 400)
        : 200;
      await floatWindow.setSize(new LogicalSize(220, contentHeight));
    } catch { /* ignore resize errors */ }
    requestAnimationFrame(() => {
      setCollapsed(false);
    });
  }

  function renderProjectIcon(size: string = "size-3.5") {
    if (!project) return null;
    if (!project.icon) {
      return (
        <div className={`${size} rounded-full bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground shrink-0`}>
          {project.name.charAt(0).toUpperCase()}
        </div>
      );
    }
    if (isFileIcon(project.icon)) {
      return (
        <img
          src={convertFileSrc(getFilePath(project.icon))}
          alt=""
          className={`${size} rounded-sm object-cover shrink-0`}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      );
    }
    const IconComponent = getIconByName(project.icon);
    return <IconComponent className={`${size} text-muted-foreground shrink-0`} />;
  }

  if (collapsed) {
    return (
      <div
        role="dialog"
        aria-label="EasyPack 悬浮窗（折叠）"
        className="w-[130px] h-[32px] flex items-center gap-1 px-2 bg-background border border-white/10 rounded-full select-none transition-all duration-300 ease-in-out"
        onMouseDown={handleDragStart}
      >
        {project ? (
          <>
            {renderProjectIcon()}
            <span
              className="text-[11px] text-foreground truncate max-w-[60px] cursor-pointer"
              onClick={(e) => { e.stopPropagation(); handleSwitchProject(); }}
            >
              {project.name}
            </span>
          </>
        ) : (
          <>
            <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">EasyPack</span>
          </>
        )}
        <button
          className="flex items-center justify-center size-3 text-muted-foreground hover:text-foreground ml-auto shrink-0 transition-colors"
          onClick={(e) => { e.stopPropagation(); handleExpand(); }}
          aria-label="展开悬浮窗"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="EasyPack 悬浮窗"
      className="w-[220px] h-auto max-h-[400px] flex flex-col bg-background border border-white/10 rounded-lg overflow-hidden transition-all duration-300 ease-in-out"
    >
      <div
        className="h-[24px] flex items-center justify-between px-1.5 border-b border-white/5 shrink-0"
        onMouseDown={handleDragStart}
      >
        <span
          className="text-xs font-semibold text-foreground/80 truncate max-w-[140px]"
          aria-live="polite"
        >
          {project ? project.name : "EasyPack"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            className="flex items-center justify-center size-3.5 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
            onClick={handleCollapse}
            aria-label="折叠悬浮窗"
          >
            <ChevronDown className="size-2.5" />
          </button>
          <button
            className="flex items-center justify-center size-3.5 text-muted-foreground hover:bg-red-500/80 hover:text-white rounded-sm transition-colors"
            onClick={handleClose}
            aria-label="关闭悬浮窗"
          >
            <X className="size-2.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {!project ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <FolderOpen className="size-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">
              请先在主窗口选择一个项目
            </span>
          </div>
        ) : (
          commands.map((cmd, index) => {
            const IconComponent = getIconByName(cmd.icon);
            const isFlashing = flashIndex === index;
            return (
              <button
                key={cmd.id}
                className={`h-7 flex items-center gap-2 px-1.5 w-full rounded-md cursor-pointer select-none transition-all duration-150 ease-out ${
                  isFlashing
                    ? "bg-green-500/20 border border-green-500/40"
                    : "hover:bg-white/5 active:bg-white/10 border border-transparent"
                }`}
                title={cmd.command}
                aria-label={`${cmd.name}: ${cmd.command}`}
                onClick={() => handleRowClick(index, cmd.command)}
              >
                <IconComponent className="size-[12px] shrink-0" />
                <span className="text-xs font-normal text-card-foreground truncate">
                  {cmd.name}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default FloatApp;
