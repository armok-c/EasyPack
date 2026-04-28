import { useState, useEffect, useCallback, useRef } from "react";
import type { Store } from "@tauri-apps/plugin-store";

export interface RecentCommand {
  name: string;
  command: string;
}

interface UseRecentCommandsOptions {
  store: Store | null;
}

const STORE_KEY = "recentCommands";
const MAX_COMMANDS = 8;

export function useRecentCommands({ store }: UseRecentCommandsOptions) {
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>([]);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (!store) return;
    store
      .get<RecentCommand[]>(STORE_KEY)
      .then((saved) => {
        if (saved) setRecentCommands(saved);
      })
      .catch(() => {
        // Store read failure: keep empty list
      });
  }, [store]);

  const addRecentCommand = useCallback(
    async (name: string, command: string) => {
      const newItem: RecentCommand = { name, command };

      // Pure state update — no side effects in the updater
      setRecentCommands((prev) => {
        const filtered = prev.filter((c) => c.command !== command);
        return [newItem, ...filtered].slice(0, MAX_COMMANDS);
      });

      // Store persistence is a side effect, done outside the updater
      const currentStore = storeRef.current;
      if (currentStore) {
        try {
          const filtered = recentCommands.filter((c) => c.command !== command);
          const updated = [newItem, ...filtered].slice(0, MAX_COMMANDS);
          await currentStore.set(STORE_KEY, updated);
        } catch (err) {
          console.error("Failed to persist recent commands:", err);
        }
      }
    },
    [recentCommands]
  );

  return {
    recentCommands,
    addRecentCommand,
  };
}
