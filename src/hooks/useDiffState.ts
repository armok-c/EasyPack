/**
 * useDiffState - Per-file/environment diff resolution and undo state management.
 *
 * Tracks which hunks are resolved/unresolved for each (fileName, envId) pair
 * and stores undo snapshots for reverting applied hunk changes.
 *
 * All state updates are immutable (new Set / new object per mutation).
 */
import { useState, useCallback } from "react";

/**
 * Resolved hunks map: key = `${fileName}::${envId}` → Set of resolved hunk indices.
 */
type ResolvedMap = Record<string, Set<number>>;

/**
 * Undo stack: key = `${fileName}::${envId}::${hunkIndex}` → previous file content.
 */
type UndoStack = Record<string, string>;

export interface UseDiffStateReturn {
  /** All resolved hunk sets, keyed by fileEnvKey. */
  resolvedHunks: ResolvedMap;
  /** All undo snapshots, keyed by fileEnvKey::hunkIndex. */
  undoStack: UndoStack;
  /** Mark a hunk as resolved for a given file/env pair. */
  markResolved: (fileEnvKey: string, hunkIndex: number) => void;
  /** Mark a hunk as unresolved for a given file/env pair. */
  markUnresolved: (fileEnvKey: string, hunkIndex: number) => void;
  /** Check whether a specific hunk is resolved. */
  isHunkResolved: (fileEnvKey: string, hunkIndex: number) => boolean;
  /** Save a content snapshot for undo before applying a hunk change. */
  pushUndo: (fileEnvKey: string, hunkIndex: number, previousContent: string) => void;
  /** Retrieve and remove an undo snapshot. Returns undefined if none exists. */
  popUndo: (fileEnvKey: string, hunkIndex: number) => string | undefined;
  /** Remove all undo snapshots for a given file/env pair. */
  clearUndo: (fileEnvKey: string) => void;
  /** Whether a file/env pair has any unresolved hunks (or no hunks at all). */
  hasUnresolved: (fileEnvKey: string) => boolean;
  /** Number of resolved hunks for a file/env pair. */
  getResolvedCount: (fileEnvKey: string) => number;
  /** Number of unresolved hunks for a file/env pair. Requires totalHunks as second argument. */
  getUnresolvedCount: (fileEnvKey: string, totalHunks: number) => number;
  /** Whether ALL hunks are resolved (true when hunks exist and all resolved). Requires totalHunks. */
  isAllResolved: (fileEnvKey: string, totalHunks: number) => boolean;
  /** Build the undo key for a file/env pair + hunk index. */
  undoKey: (fileEnvKey: string, hunkIndex: number) => string;
}

/**
 * Create the per-hunk undo key used internally by the undo stack.
 */
function makeUndoKey(fileEnvKey: string, hunkIndex: number): string {
  return `${fileEnvKey}::${hunkIndex}`;
}

/**
 * React hook managing diff resolution state and undo snapshots.
 *
 * All state is isolated per file/environment pair using `fileEnvKey`
 * (typically `"${fileName}::${envId}"`), so multiple comparisons can
 * coexist without interference.
 */
export function useDiffState(): UseDiffStateReturn {
  const [resolvedHunks, setResolvedHunks] = useState<ResolvedMap>({});
  const [undoStack, setUndoStack] = useState<UndoStack>({});

  const markResolved = useCallback(
    (fileEnvKey: string, hunkIndex: number) => {
      setResolvedHunks((prev) => {
        const existing = prev[fileEnvKey] ?? new Set<number>();
        const updated = new Set(existing);
        updated.add(hunkIndex);
        return { ...prev, [fileEnvKey]: updated };
      });
    },
    [],
  );

  const markUnresolved = useCallback(
    (fileEnvKey: string, hunkIndex: number) => {
      setResolvedHunks((prev) => {
        const existing = prev[fileEnvKey];
        if (!existing || !existing.has(hunkIndex)) return prev;
        const updated = new Set(existing);
        updated.delete(hunkIndex);
        if (updated.size === 0) {
          const rest = { ...prev };
          delete rest[fileEnvKey];
          return rest;
        }
        return { ...prev, [fileEnvKey]: updated };
      });
    },
    [],
  );

  const isHunkResolved = useCallback(
    (fileEnvKey: string, hunkIndex: number): boolean => {
      return resolvedHunks[fileEnvKey]?.has(hunkIndex) ?? false;
    },
    [resolvedHunks],
  );

  const pushUndo = useCallback(
    (fileEnvKey: string, hunkIndex: number, previousContent: string) => {
      const key = makeUndoKey(fileEnvKey, hunkIndex);
      setUndoStack((prev) => ({ ...prev, [key]: previousContent }));
    },
    [],
  );

  const popUndo = useCallback(
    (fileEnvKey: string, hunkIndex: number): string | undefined => {
      const key = makeUndoKey(fileEnvKey, hunkIndex);
      const snapshot = undoStack[key];
      if (snapshot === undefined) return undefined;
      setUndoStack((prev) => {
        if (!(key in prev)) return prev;
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      return snapshot;
    },
    [undoStack],
  );

  const clearUndo = useCallback((fileEnvKey: string) => {
    setUndoStack((prev) => {
      const prefix = `${fileEnvKey}::`;
      const hasMatch = Object.keys(prev).some((k) => k.startsWith(prefix));
      if (!hasMatch) return prev;
      const updated: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(prefix)) {
          updated[k] = v;
        }
      }
      return updated;
    });
  }, []);

  const hasUnresolved = useCallback(
    (fileEnvKey: string): boolean => {
      const set = resolvedHunks[fileEnvKey];
      return !set || set.size === 0;
    },
    [resolvedHunks],
  );

  const getResolvedCount = useCallback(
    (fileEnvKey: string): number => {
      return resolvedHunks[fileEnvKey]?.size ?? 0;
    },
    [resolvedHunks],
  );

  const getUnresolvedCount = useCallback(
    (fileEnvKey: string, totalHunks: number): number => {
      return totalHunks - getResolvedCount(fileEnvKey);
    },
    [getResolvedCount],
  );

  const isAllResolved = useCallback(
    (fileEnvKey: string, totalHunks: number): boolean => {
      return totalHunks > 0 && getResolvedCount(fileEnvKey) === totalHunks;
    },
    [getResolvedCount],
  );

  const undoKey = useCallback(
    (fileEnvKey: string, hunkIndex: number): string => {
      return makeUndoKey(fileEnvKey, hunkIndex);
    },
    [],
  );

  return {
    resolvedHunks,
    undoStack,
    markResolved,
    markUnresolved,
    isHunkResolved,
    pushUndo,
    popUndo,
    clearUndo,
    hasUnresolved,
    getResolvedCount,
    getUnresolvedCount,
    isAllResolved,
    undoKey,
  };
}
