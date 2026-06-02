import { useState, useCallback, useEffect, useRef } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import { primaryMonitor } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { toast } from "sonner";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { ProjectItem } from "./useProject";
import type { CommandItem } from "@/lib/types";

interface UseFloatWindowOptions {
  currentProject: ProjectItem | null;
  projects: ProjectItem[];
  commands: CommandItem[];
  onExecute: (command: string) => void;
  onSwitchProject: (projectId: string) => void;
}

interface UseFloatWindowReturn {
  floatVisible: boolean;
  toggleFloat: () => void;
  destroyFloat: () => Promise<void>;
  resizeFloat: (width: number, height: number) => Promise<void>;
}

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
    if (import.meta.env.DEV) {
      console.error("Failed to set float window position:", err);
    }
  }
}

export function useFloatWindow({
  currentProject,
  projects,
  commands,
  onExecute,
  onSwitchProject,
}: UseFloatWindowOptions): UseFloatWindowReturn {
  const [floatVisible, setFloatVisible] = useState(false);
  const floatWindowRef = useRef<WebviewWindow | null>(null);
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const isCreatingRef = useRef(false);
  const operationLock = useRef<Promise<void>>(Promise.resolve());

  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onSwitchProjectRef = useRef(onSwitchProject);
  onSwitchProjectRef.current = onSwitchProject;

  const cleanupListeners = useCallback(() => {
    const fns = unlistenersRef.current;
    unlistenersRef.current = [];
    for (const fn of fns) {
      fn();
    }
  }, []);

  const cleanupFloatState = useCallback(() => {
    floatWindowRef.current = null;
    setFloatVisible(false);
    cleanupListeners();
  }, [cleanupListeners]);

  const syncState = useCallback(async (target?: WebviewWindow) => {
    const win = target ?? floatWindowRef.current;
    if (!win) return;
    await emitTo("float", "float:state-update", {
      project: currentProjectRef.current,
      projects: projectsRef.current,
      commands: commandsRef.current,
    });
  }, []);

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

    const unlistenSwitchProject = await listen<{ projectId: string }>(
      "float:switch-project",
      (event) => {
        const { projectId } = event.payload;
        if (typeof projectId === "string" && projectId.length > 0) {
          onSwitchProjectRef.current(projectId);
        }
      }
    );
    unlistenersRef.current.push(unlistenSwitchProject);
  }

  const createFloat = useCallback(async (): Promise<WebviewWindow> => {
    const url = import.meta.env.DEV
      ? "http://localhost:1420/float.html"
      : "float.html";

    const floatWin = new WebviewWindow("float", {
      url,
      width: 220,
      minWidth: 130,
      maxWidth: 220,
      height: 300,
      minHeight: 32,
      decorations: false,
      shadow: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      visible: true,
      title: "EasyPack Floating",
    });

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

    await positionFloatTopRight(floatWin);

    try {
      await registerFloatListeners();
    } catch (err) {
      try { await floatWin.destroy(); } catch { /* ignore */ }
      throw err;
    }

    return floatWin;
  }, [cleanupFloatState]);

  async function adoptFloatWindow(win: WebviewWindow): Promise<void> {
    cleanupListeners();
    await registerFloatListeners();
    floatWindowRef.current = win;
  }

  const toggleFloat = useCallback(() => {
    operationLock.current = operationLock.current.then(async () => {
      const existing = await WebviewWindow.getByLabel("float");

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

      if (isCreatingRef.current) return;
      isCreatingRef.current = true;
      try {
        const floatWin = await createFloat();
        floatWindowRef.current = floatWin;
        setFloatVisible(true);
        await syncState(floatWin);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to create float window:", err);
        }
        toast.error("无法创建悬浮窗");
      } finally {
        isCreatingRef.current = false;
      }
    }).catch((err) => {
        if (import.meta.env.DEV) {
          console.error("useFloatWindow toggleFloat failed:", err);
        }
      });
  }, [createFloat, syncState]);

  const resizeFloat = useCallback(async (width: number, height: number) => {
    await operationLock.current;
    const win = floatWindowRef.current;
    if (!win) return;
    try {
      await win.setSize(new LogicalSize(width, height));
    } catch { /* ignore resize errors */ }
  }, []);

  useEffect(() => {
    if (!floatVisible) return;
    syncState();
  }, [currentProject, projects, commands, floatVisible, syncState]);

  const destroyFloat = useCallback((): Promise<void> => {
    return operationLock.current = operationLock.current.then(async () => {
      const existing = await WebviewWindow.getByLabel("float");
      if (existing) {
        try { await existing.destroy(); } catch { /* already destroyed */ }
      }
      floatWindowRef.current = null;
      setFloatVisible(false);
      cleanupListeners();
    }).catch((err) => {
      if (import.meta.env.DEV) {
        console.error("useFloatWindow destroyFloat failed:", err);
      }
    });
  }, [cleanupListeners]);

  useEffect(() => {
    return () => {
      cleanupListeners();
    };
  }, [cleanupListeners]);

  return { floatVisible, toggleFloat, destroyFloat, resizeFloat };
}
