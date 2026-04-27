import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Package, Settings } from "lucide-react";

const appWindow = getCurrentWindow();

interface TitleBarProps {
  onSettingsOpen: () => void;
  onCloseBehavior: "hide" | "close";
}

function handleDragStart(e: React.MouseEvent<HTMLDivElement>) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest("button")) return;
  appWindow.startDragging();
}

export function TitleBar({ onSettingsOpen, onCloseBehavior }: TitleBarProps) {
  async function handleMinimize() {
    await appWindow.minimize();
  }

  async function handleMaximize() {
    await appWindow.toggleMaximize();
  }

  async function handleClose() {
    if (onCloseBehavior === "hide") {
      await appWindow.hide();
    } else {
      await appWindow.close();
    }
  }

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-[28px] select-none shrink-0"
      onMouseDown={handleDragStart}
      onDoubleClick={handleMaximize}
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-[6px] pl-[10px]"
      >
        <Package className="w-[14px] h-[14px] text-foreground/80" />
        <span className="text-[13px] font-medium text-foreground">
          EasyPack
        </span>
      </div>
      <div data-tauri-drag-region className="flex-1" />
      <div className="flex items-center h-full">
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
          aria-label="最大化"
        >
          <Square className="w-[12px] h-[12px]" />
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
