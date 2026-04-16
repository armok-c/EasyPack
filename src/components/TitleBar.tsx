import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Package } from "lucide-react";

const appWindow = getCurrentWindow();

async function handleMinimize() {
  await appWindow.minimize();
}

async function handleMaximize() {
  await appWindow.toggleMaximize();
}

async function handleClose() {
  await appWindow.close();
}

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-[28px] select-none shrink-0"
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
