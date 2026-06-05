/**
 * Shortcut utility functions for Phase 11: Global Shortcuts.
 *
 * keyboardEventToShortcut: Converts browser KeyboardEvent data to Tauri Accelerator format.
 * shortcutToDisplay: Converts Tauri shortcut string to display-friendly format.
 */

interface KeyboardEventLike {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  key: string;
}

/**
 * Convert a browser KeyboardEvent to a Tauri Accelerator shortcut string.
 * Returns null if the combo is invalid (no modifier, modifier-only, or >3 keys).
 *
 * Rules per D-06: must include at least one modifier (Ctrl/Alt/Shift).
 * Rules per D-07: 2-3 key combo max.
 */
export function keyboardEventToShortcut(e: KeyboardEventLike): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const MODIFIER_KEYS = ["Control", "Alt", "Shift", "Meta"];
  if (MODIFIER_KEYS.includes(e.key)) return null; // modifier-only

  if (parts.length === 0) return null; // no modifier (D-06)

  const KEY_MAP: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    " ": "Space",
  };

  let mainKey: string;
  if (KEY_MAP[e.key]) {
    mainKey = KEY_MAP[e.key];
  } else if (e.key.length === 1) {
    mainKey = e.key.toUpperCase();
  } else {
    mainKey = e.key;
  }
  parts.push(mainKey);

  if (parts.length > 3) return null; // D-07: max 3 keys

  return parts.join("+");
}

/** Convert Tauri shortcut string to display-friendly format. "CommandOrControl+G" -> "Ctrl+G" */
export function shortcutToDisplay(shortcut: string): string {
  return shortcut.replace("CommandOrControl", "Ctrl");
}

/**
 * Phase 18: Check if a shortcut conflicts with existing bindings.
 * Returns the conflicting actionId, or null if no conflict.
 * Self-binding (excludeActionId matches) is NOT a conflict.
 */
export function normalizeShortcut(shortcut: string): string {
  return shortcut.replace(/\bCtrl\b/g, "CommandOrControl");
}

export function findConflict(
  bindings: Record<string, string>,
  excludeActionId: string,
  newShortcut: string,
  skipIds?: string[],
): string | null {
  const skip = new Set(skipIds);
  const normalizedNew = normalizeShortcut(newShortcut);
  for (const [actionId, shortcut] of Object.entries(bindings)) {
    if (actionId !== excludeActionId && !skip.has(actionId) && normalizeShortcut(shortcut) === normalizedNew) {
      return actionId;
    }
  }
  return null;
}
