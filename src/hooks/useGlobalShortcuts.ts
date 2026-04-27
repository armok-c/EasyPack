import { useEffect, useRef } from "react";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import type { ShortcutEvent } from "@tauri-apps/plugin-global-shortcut";
import type { CommandItem } from "@/lib/types";

interface UseGlobalShortcutsOptions {
  commands: CommandItem[];
  onExecute: (command: string) => void;
  enabled: boolean;
  recording?: boolean;
}

/**
 * Manages OS-level global shortcut registration lifecycle.
 * - Registers all commands with shortcut fields on mount/project change
 * - Unregisters all on unmount/switch
 * - Executes commands on shortcut Pressed events
 *
 * Per RESEARCH.md: must check event.state === 'Pressed' to prevent double-fire.
 * Per RESEARCH.md Pitfall 2: must unregisterAll before re-registration on project switch.
 * Per RESEARCH.md Pitfall 5: uses version counter to prevent race conditions on rapid switching.
 */
export function useGlobalShortcuts({
  commands,
  onExecute,
  enabled,
  recording = false,
}: UseGlobalShortcutsOptions) {
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

  useEffect(() => {
    if (!enabled || recording) {
      unregisterAll().catch(console.error);
      return;
    }

    const shortcuts = commands.filter((cmd) => cmd.shortcut);

    // Version counter to prevent race conditions (Pitfall 5)
    let version = 0;
    const currentVersion = ++version;

    async function registerAll() {
      try {
        await unregisterAll();
        if (version !== currentVersion) return;

        for (const cmd of shortcuts) {
          const handler = (event: ShortcutEvent) => {
            if (event.state === "Pressed") {
              onExecuteRef.current(cmd.command);
            }
          };
          await register(cmd.shortcut!, handler);
          if (version !== currentVersion) return;
        }
      } catch (err) {
        console.error("Failed to register shortcuts:", err);
      }
    }

    registerAll();

    return () => {
      version++;
      unregisterAll().catch(console.error);
    };
  }, [commands, enabled, recording]);
}
