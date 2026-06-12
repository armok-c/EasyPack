import { useMemo, useRef } from "react";
import type { CommandItem, ShortcutAction } from "@/lib/types";

export interface UseShortcutActionsOptions {
  commands: CommandItem[];
  onExecute: (cmd: CommandItem) => void;
  onToggleVisibility: () => void;
  onToggleFloat: () => void;
  onPrevProject: () => void;
  onNextProject: () => void;
  onOpenFolder: () => void;
}

/**
 * Builds the ShortcutAction registry from commands + fixed operations.
 * All handlers use ref pattern to avoid stale closures (RESEARCH Pitfall 4).
 */
export function useShortcutActions(options: UseShortcutActionsOptions): ShortcutAction[] {
  // Ref pattern: options callbacks are read from refs inside useMemo handlers
  const onExecuteRef = useRef(options.onExecute);
  onExecuteRef.current = options.onExecute;

  const onToggleVisibilityRef = useRef(options.onToggleVisibility);
  onToggleVisibilityRef.current = options.onToggleVisibility;

  const onToggleFloatRef = useRef(options.onToggleFloat);
  onToggleFloatRef.current = options.onToggleFloat;

  const onPrevProjectRef = useRef(options.onPrevProject);
  onPrevProjectRef.current = options.onPrevProject;

  const onNextProjectRef = useRef(options.onNextProject);
  onNextProjectRef.current = options.onNextProject;

  const onOpenFolderRef = useRef(options.onOpenFolder);
  onOpenFolderRef.current = options.onOpenFolder;

  return useMemo(() => {
    const actions: ShortcutAction[] = [];

    // Dynamic command actions
    for (const cmd of options.commands) {
      const capturedCmd = cmd;
      actions.push({
        id: `command.${capturedCmd.id}`,
        label: capturedCmd.name,
        category: "command",
        handler: () => onExecuteRef.current(capturedCmd),
      });
    }

    // Fixed window operations (D-08)
    actions.push(
      {
        id: "window.toggle-visibility",
        label: "显示/隐藏主窗口",
        category: "window",
        handler: () => onToggleVisibilityRef.current(),
      },
      {
        id: "window.toggle-float",
        label: "切换悬浮窗",
        category: "window",
        handler: () => onToggleFloatRef.current(),
      },
    );

    // Fixed project operations (D-09)
    actions.push(
      {
        id: "project.prev",
        label: "切换上一个项目",
        category: "project",
        handler: () => onPrevProjectRef.current(),
      },
      {
        id: "project.next",
        label: "切换下一个项目",
        category: "project",
        handler: () => onNextProjectRef.current(),
      },
      {
        id: "project.open-folder",
        label: "打开当前项目文件夹",
        category: "project",
        handler: () => onOpenFolderRef.current(),
      },
    );

    return actions;
    // Only rebuild when the command list identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.commands]);
}
