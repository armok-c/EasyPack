import { useEffect, useRef } from "react";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import type { ShortcutEvent } from "@tauri-apps/plugin-global-shortcut";
import type { ShortcutAction } from "@/lib/types";

interface UseGlobalShortcutsOptions {
  actions: ShortcutAction[];
  bindings: Record<string, string>;
  enabled: boolean;
  recording?: boolean;
}

/**
 * Manages OS-level global shortcut registration lifecycle.
 * - Registers all actions that have a matching binding
 * - Unregisters all on unmount/switch
 * - Executes action handlers on shortcut Pressed events
 *
 * Per RESEARCH.md: must check event.state === 'Pressed' to prevent double-fire.
 * Per RESEARCH.md Pitfall 2: must unregisterAll before re-registration on change.
 * Per RESEARCH.md Pitfall 5: uses version counter to prevent race conditions.
 */
export function useGlobalShortcuts({
  actions,
  bindings,
  enabled,
  recording = false,
}: UseGlobalShortcutsOptions) {
  // Ref pattern: action handlers are read from ref to avoid stale closures
  const actionsMapRef = useRef<Map<string, ShortcutAction>>(new Map());
  actionsMapRef.current = new Map(actions.map((a) => [a.id, a]));

  useEffect(() => {
    if (!enabled || recording) {
      unregisterAll().catch(console.error);
      return;
    }

    // Filter actions that have a binding
    const boundActions = actions.filter((a) => bindings[a.id]);

    // Version counter to prevent race conditions (Pitfall 5)
    let version = 0;
    const currentVersion = ++version;

    async function registerAll() {
      try {
        await unregisterAll();
        if (version !== currentVersion) return;

        for (const action of boundActions) {
          const shortcut = bindings[action.id]!;
          // Capture action.id for the handler closure
          const actionId = action.id;
          const handler = (event: ShortcutEvent) => {
            if (event.state === "Pressed") {
              const resolved = actionsMapRef.current.get(actionId);
              resolved?.handler();
            }
          };
          await register(shortcut, handler);
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
  }, [actions, bindings, enabled, recording]);
}
