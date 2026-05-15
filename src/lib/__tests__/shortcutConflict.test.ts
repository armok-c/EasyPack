import { describe, it, expect } from "vitest";

// findConflict will be a standalone pure function in shortcutUtils.ts
// We import it once the implementation exists, but for the test skeleton
// we define the expected interface and test against the import.

describe("findConflict", () => {
  it("returns null when bindings are empty", async () => {
    const { findConflict } = await import("../shortcutUtils");
    const result = findConflict({}, "action-1", "CommandOrControl+G");
    expect(result).toBeNull();
  });

  it("returns null when no other action has the same shortcut", async () => {
    const { findConflict } = await import("../shortcutUtils");
    const bindings: Record<string, string> = {
      "action-1": "CommandOrControl+G",
      "action-2": "Alt+F5",
    };
    const result = findConflict(bindings, "action-1", "CommandOrControl+G");
    // action-1 itself is excluded, so no conflict
    expect(result).toBeNull();
  });

  it("returns conflicting actionId when another action has the same shortcut", async () => {
    const { findConflict } = await import("../shortcutUtils");
    const bindings: Record<string, string> = {
      "action-1": "CommandOrControl+G",
      "action-2": "Alt+F5",
    };
    const result = findConflict(bindings, "action-3", "Alt+F5");
    expect(result).toBe("action-2");
  });

  it("excludes the action being checked (self is not a conflict)", async () => {
    const { findConflict } = await import("../shortcutUtils");
    const bindings: Record<string, string> = {
      "action-1": "CommandOrControl+G",
    };
    const result = findConflict(bindings, "action-1", "CommandOrControl+G");
    expect(result).toBeNull();
  });

  it("returns the first conflicting actionId when multiple conflicts exist", async () => {
    const { findConflict } = await import("../shortcutUtils");
    const bindings: Record<string, string> = {
      "action-1": "CommandOrControl+G",
      "action-2": "CommandOrControl+G",
      "action-3": "Alt+T",
    };
    const result = findConflict(bindings, "action-4", "CommandOrControl+G");
    // Should return one of the conflicting actionIds (not action-4)
    expect(result).toMatch(/^action-[12]$/);
  });
});
