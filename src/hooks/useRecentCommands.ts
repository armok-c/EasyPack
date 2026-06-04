import { useState, useEffect, useCallback, useRef } from "react";
import type { Store } from "@tauri-apps/plugin-store";

export interface RecentCommand {
  name: string;
  command: string;
}

interface UseRecentCommandsOptions {
  store: Store | null;
  activeProfileId: string | null;
}

const STORE_KEY = "recentCommands";
const MAX_COMMANDS = 8;

export function useRecentCommands({ store, activeProfileId }: UseRecentCommandsOptions) {
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>([]);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (!store) return;
    setRecentCommands([]); // 先清空，避免显示旧 profile 数据
    store
      .get<RecentCommand[]>(STORE_KEY)
      .then((saved) => {
        if (saved) setRecentCommands(saved);
      })
      .catch(() => {
        // Store read failure: keep empty list
      });
  }, [store, activeProfileId]);

  const addRecentCommand = useCallback(
    async (name: string, command: string) => {
      const newItem: RecentCommand = { name, command };
      let toPersist: RecentCommand[] = [];

      setRecentCommands((prev) => {
        const filtered = prev.filter((c) => c.command !== command);
        const updated = [newItem, ...filtered].slice(0, MAX_COMMANDS);
        toPersist = updated;
        return updated;
      });

      const currentStore = storeRef.current;
      if (currentStore && toPersist.length > 0) {
        try {
          await currentStore.set(STORE_KEY, toPersist);
        } catch (err) {
          console.error("Failed to persist recent commands:", err);
        }
      }
    },
    []
  );

  return {
    recentCommands,
    addRecentCommand,
  };
}
