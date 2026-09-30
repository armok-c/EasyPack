import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X, Settings, PanelTop } from "lucide-react";

const appWindow = getCurrentWindow();

interface TitleBarProps {
  onSettingsOpen: () => void;
  onFloatToggle: () => void;
  floatVisible: boolean;
  onMaximizedChange?: (maximized: boolean) => void;
  // Phase 14: 边缘抽屉
  onDragWhileSnapped?: ((deltaX: number, deltaY: number) => void) | null;
  drawerSnapEdge?: string | null;
}

export function TitleBar({
  onSettingsOpen,
  onFloatToggle,
  floatVisible,
  onMaximizedChange,
  onDragWhileSnapped,
  drawerSnapEdge,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    const refreshMaximized = async () => {
      const currentRequest = ++requestId;
      try {
        const maximized = await appWindow.isMaximized();
        if (!mounted || currentRequest !== requestId) return;
        setIsMaximized(maximized);
        onMaximizedChange?.(maximized);
      } catch (error) {
        if (import.meta.env.DEV) console.error("读取窗口状态失败：", error);
      }
    };
    const unlisten = appWindow.onResized(refreshMaximized);
    void refreshMaximized();
    return () => {
      mounted = false;
      unlisten.then((fn) => fn()).catch((error) => {
        if (import.meta.env.DEV) console.error("清理窗口监听失败：", error);
      });
    };
  }, [onMaximizedChange]);

  const handleMinimize = useCallback(async () => {
    await appWindow.minimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
  }, []);

  // Phase 14: 拖拽开始，记录起始位置用于吸附检测
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;

      // Phase 14: 如果已处于吸附状态，记录拖拽起始位置
      if (drawerSnapEdge) {
        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      } else {
        dragStartPosRef.current = null;
      }

      appWindow.startDragging();
    },
    [drawerSnapEdge]
  );

  // Phase 14: 吸附状态下拖拽时检测位移
  useEffect(() => {
    if (!drawerSnapEdge || !onDragWhileSnapped) return;
    const handleSnappedDrag: NonNullable<typeof onDragWhileSnapped> =
      onDragWhileSnapped;

    function handleMouseMove(e: MouseEvent) {
      if (!dragStartPosRef.current) return;
      const deltaX = e.clientX - dragStartPosRef.current.x;
      const deltaY = e.clientY - dragStartPosRef.current.y;
      const totalDelta = Math.abs(deltaX) + Math.abs(deltaY);
      if (totalDelta > 5) {
        handleSnappedDrag(deltaX, deltaY);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [drawerSnapEdge, onDragWhileSnapped]);

  async function handleClose() {
    await appWindow.close();
  }

  return (
    <div
      data-tauri-drag-region
      className="mbe-titlebar flex items-center h-10 pr-1 select-none shrink-0"
      onMouseDown={handleDragStart}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        void handleMaximize();
      }}
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-[6px] pl-[10px]"
      >
        <img src="/icon.svg" alt="" className="size-6" />
        <span className="text-[13px] font-bold text-foreground">
          EasyPack
        </span>
      </div>
      <div data-tauri-drag-region className="flex-1" />
      <div className="flex items-center h-full">
        <button
          className={`titlebar-button ${floatVisible ? 'text-foreground' : ''}`}
          onClick={onFloatToggle}
          aria-label="切换悬浮窗"
          aria-pressed={floatVisible}
        >
          <PanelTop className="w-[14px] h-[14px]" />
        </button>
        <button
          className="titlebar-button"
          onClick={onSettingsOpen}
          aria-label="设置"
        >
          <Settings className="w-[14px] h-[14px]" />
        </button>
        <button
          className="titlebar-button"
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <Minus className="w-[12px] h-[12px]" />
        </button>
        <button
          className="titlebar-button"
          onClick={handleMaximize}
          aria-label={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? (
            <Copy className="w-[12px] h-[12px]" />
          ) : (
            <Square className="w-[12px] h-[12px]" />
          )}
        </button>
        <button
          className="titlebar-button close-button"
          onClick={handleClose}
          aria-label="关闭"
        >
          <X className="w-[12px] h-[12px]" />
        </button>
      </div>
    </div>
  );
}
