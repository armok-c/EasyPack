import { useState, useEffect } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X, FolderOpen } from "lucide-react";
import type { ProjectItem } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";
import { getIconByName } from "@/lib/icons";

const floatWindow = getCurrentWindow();

/**
 * 悬浮窗根组件 -- 独立运行在 "float" 窗口中（不在主窗口 React 树中）。
 * 通过 Tauri 事件系统接收主窗口推送的项目/指令状态。
 */
function FloatApp() {
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);

  // 监听主窗口推送的状态更新
  useEffect(() => {
    let cancelled = false;
    const unlistenPromise = listen<{
      project: ProjectItem | null;
      commands: CommandItem[];
    }>("float:state-update", (event) => {
      if (cancelled) return;
      setProject(event.payload.project);
      setCommands(event.payload.commands);
    });
    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  // 拖拽处理 -- 复用 TitleBar.tsx 的 startDragging 模式
  function handleDragStart(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    floatWindow.startDragging();
  }

  // 点击指令行 -- 触发 200ms 绿色闪烁 + 通知主窗口执行
  function handleRowClick(index: number, shellCommand: string) {
    if (!project || flashIndex !== null) return;
    setFlashIndex(index);
    emit("float:execute", { command: shellCommand });
    setTimeout(() => setFlashIndex(null), 200);
  }

  // 关闭悬浮窗 -- 使用 destroy() 而非 close()，
  // 因为 close() 需要主窗口的 onCloseRequested handler 执行 destroy()，
  // 而主窗口隐藏后 WebView 可能被节流导致回调不执行。
  // 改为：先发事件通知主窗口清理状态，再直接 destroy。
  async function handleClose() {
    emit("float:close-requested");
    await floatWindow.destroy();
  }

  return (
    <div
      role="dialog"
      aria-label="EasyPack 悬浮窗"
      className="w-[220px] h-auto max-h-[400px] flex flex-col bg-background border border-white/10 rounded-lg overflow-hidden"
    >
      {/* 拖拽区域 / Header */}
      <div
        className="h-[28px] flex items-center justify-between px-2 border-b border-white/5 shrink-0"
        onMouseDown={handleDragStart}
      >
        <span
          className="text-xs font-semibold text-foreground/80 truncate max-w-[160px]"
          aria-live="polite"
        >
          {project ? project.name : "EasyPack"}
        </span>
        <button
          className="flex items-center justify-center size-4 text-muted-foreground hover:bg-red-500/80 hover:text-white rounded-sm transition-colors"
          onClick={handleClose}
          aria-label="关闭悬浮窗"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-2">
        {!project ? (
          // 空状态 (D-13)
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <FolderOpen className="size-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">
              请先在主窗口选择一个项目
            </span>
          </div>
        ) : (
          // 指令行列表
          commands.map((cmd, index) => {
            const IconComponent = getIconByName(cmd.icon);
            const isFlashing = flashIndex === index;
            return (
              <button
                key={cmd.id}
                className={`h-8 flex items-center gap-2 px-2 w-full rounded-md cursor-pointer select-none transition-all duration-150 ease-out ${
                  isFlashing
                    ? "bg-green-500/20 border border-green-500/40"
                    : "hover:bg-white/5 active:bg-white/10 border border-transparent"
                }`}
                title={cmd.command}
                aria-label={`${cmd.name}: ${cmd.command}`}
                onClick={() => handleRowClick(index, cmd.command)}
              >
                <IconComponent className="size-[14px] shrink-0" />
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
