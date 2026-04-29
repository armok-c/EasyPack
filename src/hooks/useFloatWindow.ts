import { useState, useEffect, useCallback, useRef } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import { availableMonitors } from "@tauri-apps/api/window";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { toast } from "sonner";
import type { Window } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { ProjectItem } from "./useProject";
import type { CommandItem } from "@/lib/types";

interface UseFloatWindowOptions {
  currentProject: ProjectItem | null;
  commands: CommandItem[];
  onExecute: (command: string) => void;
  appWindow: Window;
}

interface UseFloatWindowReturn {
  floatVisible: boolean;
  toggleFloat: () => void;
  destroyFloat: () => void;
}

/**
 * 管理悬浮窗创建、显示、隐藏、销毁和状态同步的 hook。
 *
 * 创建时机：用户首次点击 TitleBar 悬浮窗按钮或托盘菜单选项。
 * 生命周期：创建一次后通过 show/hide 切换可见性，主窗口退出时销毁。
 * 通信方式：Tauri 事件系统（emitTo/listen）。
 */
export function useFloatWindow({
  currentProject,
  commands,
  onExecute,
  appWindow,
}: UseFloatWindowOptions): UseFloatWindowReturn {
  const [floatVisible, setFloatVisible] = useState(false);
  const floatWindowRef = useRef<WebviewWindow | null>(null);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  // Ref 模式防止闭包过时（遵循 useTray.ts 已验证模式）
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

  // 清理所有事件监听器
  const cleanupListeners = useCallback(() => {
    const fns = unlistenersRef.current;
    unlistenersRef.current = [];
    for (const fn of fns) {
      fn();
    }
  }, []);

  // 状态同步：向悬浮窗推送当前项目/指令
  const syncState = useCallback(async (target?: WebviewWindow) => {
    const win = target ?? floatWindowRef.current;
    if (!win) return;
    await emitTo("float", "float:state-update", {
      project: currentProjectRef.current,
      commands: commandsRef.current,
    });
  }, []);

  // 创建悬浮窗
  const createFloat = useCallback(async (): Promise<WebviewWindow> => {
    const url = import.meta.env.DEV
      ? "http://localhost:1420/float.html"
      : "float.html";

    const floatWin = new WebviewWindow("float", {
      url,
      width: 280,
      minWidth: 280,
      maxWidth: 280,
      height: 400,
      minHeight: 200,
      decorations: false,
      shadow: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      visible: true,
      title: "EasyPack Floating",
    });

    // 等待窗口创建完成
    await new Promise<void>((resolve, reject) => {
      floatWin.once("tauri://created", () => resolve());
      floatWin.once("tauri://error", (e) => reject(e));
    });

    // D-08: 设置初始位置为屏幕右上角（偏移 16px）
    try {
      const monitors = await availableMonitors();
      const primary = monitors[0];
      if (primary) {
        const { width } = primary.workArea.size;
        const { x, y } = primary.workArea.position;
        const scale = primary.scaleFactor;
        const logicalRight = (x + width) / scale;
        const posY = y / scale + 16;
        const posX = logicalRight - 280 - 16;
        await floatWin.setPosition(new LogicalPosition(posX, posY));
      }
    } catch (err) {
      console.error("Failed to set float window position:", err);
    }

    // 监听悬浮窗发来的执行请求
    const unlistenExecute = await listen<{ command: string }>(
      "float:execute",
      (event) => {
        onExecuteRef.current(event.payload.command);
      }
    );
    unlistenersRef.current.push(unlistenExecute);

    // 监听悬浮窗关闭事件（清理引用）
    const unlistenClose = await floatWin.onCloseRequested(() => {
      floatWindowRef.current = null;
      setFloatVisible(false);
      cleanupListeners();
    });
    unlistenersRef.current.push(unlistenClose);

    return floatWin;
  }, [cleanupListeners]);

  // toggle 显示/隐藏
  const toggleFloat = useCallback(async () => {
    // 检查窗口是否存活
    const existing = WebviewWindow.getByLabel("float");
    if (existing && floatWindowRef.current) {
      if (floatVisible) {
        await existing.hide();
        setFloatVisible(false);
      } else {
        await existing.show();
        await existing.setFocus();
        setFloatVisible(true);
        // 重新同步最新状态（窗口可能错过了 hide 期间的变化）
        await syncState(existing);
      }
      return;
    }

    // 窗口不存在（首次创建或已关闭后重新创建）
    try {
      const floatWin = await createFloat();
      floatWindowRef.current = floatWin;
      setFloatVisible(true);
      // 首次创建后同步当前状态
      await syncState(floatWin);
    } catch (err) {
      console.error("Failed to create float window:", err);
      toast.error("无法创建悬浮窗");
    }
  }, [floatVisible, createFloat, syncState]);

  // 自动同步：当项目/指令变化时推送
  useEffect(() => {
    if (!floatVisible) return;
    syncState();
  }, [currentProject, commands, floatVisible, syncState]);

  // D-12: 主窗口退出时销毁悬浮窗
  const destroyFloat = useCallback(async () => {
    const existing = WebviewWindow.getByLabel("float");
    if (existing) {
      try {
        await existing.destroy();
      } catch {
        // 窗口可能已关闭，忽略错误
      }
    }
    floatWindowRef.current = null;
    setFloatVisible(false);
    cleanupListeners();
  }, [cleanupListeners]);

  // 组件卸载时清理事件监听器
  useEffect(() => {
    return () => {
      cleanupListeners();
    };
  }, [cleanupListeners]);

  return { floatVisible, toggleFloat, destroyFloat };
}
