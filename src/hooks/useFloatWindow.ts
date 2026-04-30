import { useState, useEffect, useCallback, useRef } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import { primaryMonitor } from "@tauri-apps/api/window";
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
 * 将悬浮窗定位到主显示器右上角（偏移 16px）。
 */
async function positionFloatTopRight(win: WebviewWindow) {
  try {
    const primary = await primaryMonitor();
    if (primary) {
      const { width } = primary.workArea.size;
      const { x, y } = primary.workArea.position;
      const scale = primary.scaleFactor;
      const logicalRight = (x + width) / scale;
      const posY = y / scale + 16;
      const posX = logicalRight - 220 - 16;
      await win.setPosition(new LogicalPosition(posX, posY));
    }
  } catch (err) {
    console.error("Failed to set float window position:", err);
  }
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
  const isCreatingRef = useRef(false);

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
      width: 220,
      minWidth: 220,
      maxWidth: 220,
      height: 300,
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
      let createdUnlisten: UnlistenFn | null = null;
      let errorUnlisten: UnlistenFn | null = null;

      const cleanup = () => {
        createdUnlisten?.();
        errorUnlisten?.();
      };

      floatWin.listen("tauri://created", () => {
        cleanup();
        resolve();
      }).then((unlisten) => { createdUnlisten = unlisten; });

      floatWin.listen("tauri://error", (e) => {
        cleanup();
        reject(e);
      }).then((unlisten) => { errorUnlisten = unlisten; });
    });

    // 设置初始位置
    await positionFloatTopRight(floatWin);

    // 监听悬浮窗发来的执行请求 + 关闭事件
    try {
      const unlistenExecute = await listen<{ command: string }>(
        "float:execute",
        (event) => {
          const { command } = event.payload;
          if (typeof command === "string" && command.length > 0) {
            onExecuteRef.current(command);
          }
        }
      );
      unlistenersRef.current.push(unlistenExecute);

      const unlistenClose = await floatWin.onCloseRequested(() => {
        floatWindowRef.current = null;
        setFloatVisible(false);
        cleanupListeners();
      });
      unlistenersRef.current.push(unlistenClose);
    } catch (err) {
      // 监听器注册失败 -- 回滚：销毁已创建的窗口
      try { await floatWin.destroy(); } catch { /* ignore */ }
      throw err;
    }

    return floatWin;
  }, [cleanupListeners]);

  // 当窗口存在但 ref 失效时，重新领养该窗口
  async function adoptFloatWindow(win: WebviewWindow): Promise<void> {
    const unlistenClose = await win.onCloseRequested(() => {
      floatWindowRef.current = null;
      setFloatVisible(false);
      cleanupListeners();
    });
    unlistenersRef.current.push(unlistenClose);

    const unlistenExecute = await listen<{ command: string }>(
      "float:execute",
      (event) => {
        const { command } = event.payload;
        if (typeof command === "string" && command.length > 0) {
          onExecuteRef.current(command);
        }
      }
    );
    unlistenersRef.current.push(unlistenExecute);

    floatWindowRef.current = win;
  }

  // toggle 显示/隐藏
  const toggleFloat = useCallback(async () => {
    const existing = await WebviewWindow.getByLabel("float");

    if (existing && floatWindowRef.current) {
      // 正常 toggle：ref 有效，窗口存在
      if (floatVisible) {
        await existing.hide();
        setFloatVisible(false);
      } else {
        await existing.show();
        await positionFloatTopRight(existing);
        await existing.setFocus();
        setFloatVisible(true);
        await syncState(existing);
      }
      return;
    }

    if (existing && !floatWindowRef.current) {
      // Adopt：窗口存在但 ref 失效
      try {
        await adoptFloatWindow(existing);
        if (floatVisible) {
          await existing.hide();
          setFloatVisible(false);
        } else {
          await existing.show();
          await positionFloatTopRight(existing);
          await existing.setFocus();
          setFloatVisible(true);
          await syncState(existing);
        }
        return;
      } catch (err) {
        // adopt 失败，销毁残留窗口后走创建路径
        console.warn("Adopt float window failed, destroying and recreating:", err);
        try { await existing.destroy(); } catch { /* ignore */ }
      }
    }

    // 窗口不存在，首次创建
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    try {
      const floatWin = await createFloat();
      floatWindowRef.current = floatWin;
      setFloatVisible(true);
      await syncState(floatWin);
    } catch (err) {
      console.error("Failed to create float window:", err);
      toast.error("无法创建悬浮窗");
    } finally {
      isCreatingRef.current = false;
    }
  }, [floatVisible, createFloat, syncState]);

  // 自动同步：当项目/指令变化时推送
  useEffect(() => {
    if (!floatVisible) return;
    syncState();
  }, [currentProject, commands, floatVisible, syncState]);

  // D-12: 主窗口退出时销毁悬浮窗
  const destroyFloat = useCallback(async () => {
    const existing = await WebviewWindow.getByLabel("float");
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
