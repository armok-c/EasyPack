import { useEffect, useCallback } from "react";
import type { CommandItem } from "@/lib/types";
import type { ProjectItem } from "@/hooks/useProject";

interface UseKeyboardOptions {
  commands: CommandItem[];
  currentProject: ProjectItem | null;
  onExecute: (command: string) => void;
  editMode: boolean;
}

/**
 * Global keyboard hook for number key shortcuts (1-9).
 * Triggers command execution only when:
 * - Not focused in an input/textarea element
 * - Not in edit mode
 * - No Radix dialog or context menu is open
 * - A project is selected
 *
 * Per RESEARCH.md Pitfall 2 + 6: guard conditions prevent accidental triggers.
 * Per T-05-09: strict guard checks mitigate elevation risk.
 */
export function useKeyboard({
  commands,
  currentProject,
  onExecute,
  editMode,
}: UseKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Guard: skip if target is an input or textarea (per Pitfall 2)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Guard: skip if edit mode is active (per Pitfall 6)
      if (editMode) return;

      // Guard: skip if a Radix dialog or context menu is open
      const anyDialogOpen = !!document.querySelector(
        '[data-radix-dialog-content-open], [data-radix-context-menu-content-open]'
      );
      if (anyDialogOpen) return;

      // Guard: need a selected project to execute
      if (!currentProject) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= commands.length) {
        const cmd = commands[num - 1];
        if (cmd) {
          e.preventDefault();
          onExecute(cmd.command);
        }
      }
    },
    [commands, currentProject, onExecute, editMode]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
