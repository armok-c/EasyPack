import { useState, useEffect, useCallback, useRef } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import { primaryMonitor } from "@tauri-apps/api/window";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { toast } from "sonner";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { ProjectItem } from "./useProject";
import type { CommandItem } from "@/lib/types";

interface UseFloatWindowOptions {
  currentProject: ProjectItem | null;
  commands: CommandItem[];
  onExecute: (command: string) => void;
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
}: UseFloatWindowOptions): UseFloatWindowReturn {
  const [floatVisible, setFloatVisible] = useState(false);
  const floatWindowRef = useRef<WebviewWindow | null>(null);
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const isCreatingRef = useRef(false);
  const operationLock = useRef<Promise<void>>(Promise.resolve());

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

  // 清理悬浮窗状态（ref + React state + listeners）
  const cleanupFloatState = useCallback(() => {
    floatWindowRef.current = null;
    setFloatVisible(false);
    cleanupListeners();
  }, [cleanupListeners]);

  // 状态同步：向悬浮窗推送当前项目/指令
  const syncState = useCallback(async (target?: WebviewWindow) => {
    const win = target ?? floatWindowRef.current;
    if (!win) return;
    await emitTo("float", "float:state-update", {
      project: currentProjectRef.current,
      commands: commandsRef.current,
    });
  }, []);

  // 注册悬浮窗事件监听器（执行请求 + 关闭请求）
  async function registerFloatListeners(): Promise<void> {
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

    // 监听悬浮窗主动发来的关闭请求（用户点击关闭按钮）
    // 主窗口负责销毁，避免与 FloatApp 端的 destroy 竞态 (CR-01)
    const unlistenClose = await listen(
      "float:close-requested",
      async () => {
        const win = floatWindowRef.current;
        cleanupFloatState();
        if (win) {
          try { await win.destroy(); } catch { /* already destroyed */ }
        }
      }
    );
    unlistenersRef.current.push(unlistenClose);
  }

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

    // 注册事件监听器
    try {
      await registerFloatListeners();
    } catch (err) {
      // 监听器注册失败 -- 回滚：销毁已创建的窗口
      try { await floatWin.destroy(); } catch { /* ignore */ }
      throw err;
    }

    return floatWin;
  }, [cleanupFloatState]);

  // 当窗口存在但 ref 失效时，重新领养该窗口
  async function adoptFloatWindow(win: WebviewWindow): Promise<void> {
    cleanupListeners();
    await registerFloatListeners();
    floatWindowRef.current = win;
  }

  // toggle 显示/隐藏（通过 mutex 序列化，防止并发竞态）
  const toggleFloat = useCallback(() => {
    operationLock.current = operationLock.current.then(async () => {
      const existing = await WebviewWindow.getByLabel("float");

      // Branch A: ref 有效 + 窗口存在 → 正常 toggle
      if (existing && floatWindowRef.current) {
        let visible = false;
        try { visible = await existing.isVisible(); } catch { /* window dying */ }

        if (visible) {
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

      // Branch B: 窗口存在但 ref 失效 → adopt
      if (existing && !floatWindowRef.current) {
        try {
          await existing.isVisible();
          await adoptFloatWindow(existing);

          let visible = false;
          try { visible = await existing.isVisible(); } catch { /* ignore */ }

          if (visible) {
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
        } catch {
          try { await existing.destroy(); } catch { /* ignore */ }
        }
      }

      // Branch C: 无窗口 → 创建
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
    }).catch(() => {});
  }, [createFloat, syncState]);

  // 自动同步：当项目/指令变化时推送
  useEffect(() => {
    if (!floatVisible) return;
    syncState();
  }, [currentProject, commands, floatVisible, syncState]);

  // D-12: 主窗口退出时销毁悬浮窗（通过 mutex 序列化）
  const destroyFloat = useCallback(() => {
    operationLock.current = operationLock.current.then(async () => {
      const existing = await WebviewWindow.getByLabel("float");
      if (existing) {
        try { await existing.destroy(); } catch { /* already destroyed */ }
      }
      floatWindowRef.current = null;
      setFloatVisible(false);
      cleanupListeners();
    }).catch(() => {});
  }, [cleanupListeners]);

  // 组件卸载时清理事件监听器
  useEffect(() => {
    return () => {
      cleanupListeners();
    };
  }, [cleanupListeners]);

  return { floatVisible, toggleFloat, destroyFloat };
}
