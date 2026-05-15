import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { CommandItem } from "@/lib/types";

// Mock useShortcutActions — we import after the mock setup
// Since useShortcutActions doesn't exist yet, we'll test it once created

function makeCommand(overrides: Partial<CommandItem> & { id: string; shortcut?: string }): CommandItem {
  return {
    name: "Test",
    command: "echo test",
    icon: "Terminal",
    type: "custom",
    scope: "global" as const,
    addedAt: Date.now(),
    ...overrides,
  };
}

describe("useShortcutActions", () => {
  const mockOnExecute = vi.fn();
  const mockOnToggleVisibility = vi.fn();
  const mockOnToggleFloat = vi.fn();
  const mockOnPrevProject = vi.fn();
  const mockOnNextProject = vi.fn();
  const mockOnOpenFolder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns actions list with command + window + project categories", async () => {
    const commands = [
      makeCommand({ id: "cmd-1", name: "Build" }),
      makeCommand({ id: "cmd-2", name: "Deploy" }),
    ];

    const { useShortcutActions } = await import("../useShortcutActions");

    const { result } = renderHook(() =>
      useShortcutActions({
        commands,
        onExecute: mockOnExecute,
        onToggleVisibility: mockOnToggleVisibility,
        onToggleFloat: mockOnToggleFloat,
        onPrevProject: mockOnPrevProject,
        onNextProject: mockOnNextProject,
        onOpenFolder: mockOnOpenFolder,
      })
    );

    const actions = result.current;

    // Should have 2 command actions + 2 window actions + 3 project actions = 7
    expect(actions).toHaveLength(7);

    // Check command actions
    const commandActions = actions.filter((a) => a.category === "command");
    expect(commandActions).toHaveLength(2);
    expect(commandActions[0].id).toBe("command.cmd-1");
    expect(commandActions[0].label).toBe("Build");
    expect(commandActions[1].id).toBe("command.cmd-2");
    expect(commandActions[1].label).toBe("Deploy");

    // Check window actions
    const windowActions = actions.filter((a) => a.category === "window");
    expect(windowActions).toHaveLength(2);
    expect(windowActions.map((a) => a.id)).toEqual(
      expect.arrayContaining(["window.toggle-visibility", "window.toggle-float"])
    );

    // Check project actions
    const projectActions = actions.filter((a) => a.category === "project");
    expect(projectActions).toHaveLength(3);
    expect(projectActions.map((a) => a.id)).toEqual(
      expect.arrayContaining(["project.prev", "project.next", "project.open-folder"])
    );
  });

  it("command action handler invokes onExecute with the correct command", async () => {
    const commands = [
      makeCommand({ id: "cmd-1", name: "Build", command: "npm run build" }),
    ];

    const { useShortcutActions } = await import("../useShortcutActions");

    const { result } = renderHook(() =>
      useShortcutActions({
        commands,
        onExecute: mockOnExecute,
        onToggleVisibility: mockOnToggleVisibility,
        onToggleFloat: mockOnToggleFloat,
        onPrevProject: mockOnPrevProject,
        onNextProject: mockOnNextProject,
        onOpenFolder: mockOnOpenFolder,
      })
    );

    const commandAction = result.current.find((a) => a.id === "command.cmd-1");
    expect(commandAction).toBeDefined();
    commandAction!.handler();
    expect(mockOnExecute).toHaveBeenCalledWith(commands[0]);
  });

  it("window action handlers invoke correct callbacks", async () => {
    const { useShortcutActions } = await import("../useShortcutActions");

    const { result } = renderHook(() =>
      useShortcutActions({
        commands: [],
        onExecute: mockOnExecute,
        onToggleVisibility: mockOnToggleVisibility,
        onToggleFloat: mockOnToggleFloat,
        onPrevProject: mockOnPrevProject,
        onNextProject: mockOnNextProject,
        onOpenFolder: mockOnOpenFolder,
      })
    );

    const toggleVis = result.current.find((a) => a.id === "window.toggle-visibility");
    toggleVis!.handler();
    expect(mockOnToggleVisibility).toHaveBeenCalledTimes(1);

    const toggleFloat = result.current.find((a) => a.id === "window.toggle-float");
    toggleFloat!.handler();
    expect(mockOnToggleFloat).toHaveBeenCalledTimes(1);
  });

  it("project action handlers invoke correct callbacks", async () => {
    const { useShortcutActions } = await import("../useShortcutActions");

    const { result } = renderHook(() =>
      useShortcutActions({
        commands: [],
        onExecute: mockOnExecute,
        onToggleVisibility: mockOnToggleVisibility,
        onToggleFloat: mockOnToggleFloat,
        onPrevProject: mockOnPrevProject,
        onNextProject: mockOnNextProject,
        onOpenFolder: mockOnOpenFolder,
      })
    );

    const prev = result.current.find((a) => a.id === "project.prev");
    prev!.handler();
    expect(mockOnPrevProject).toHaveBeenCalledTimes(1);

    const next = result.current.find((a) => a.id === "project.next");
    next!.handler();
    expect(mockOnNextProject).toHaveBeenCalledTimes(1);

    const openFolder = result.current.find((a) => a.id === "project.open-folder");
    openFolder!.handler();
    expect(mockOnOpenFolder).toHaveBeenCalledTimes(1);
  });

  it("returns empty command actions when commands is empty", async () => {
    const { useShortcutActions } = await import("../useShortcutActions");

    const { result } = renderHook(() =>
      useShortcutActions({
        commands: [],
        onExecute: mockOnExecute,
        onToggleVisibility: mockOnToggleVisibility,
        onToggleFloat: mockOnToggleFloat,
        onPrevProject: mockOnPrevProject,
        onNextProject: mockOnNextProject,
        onOpenFolder: mockOnOpenFolder,
      })
    );

    const commandActions = result.current.filter((a) => a.category === "command");
    expect(commandActions).toHaveLength(0);

    // Fixed actions still present
    expect(result.current).toHaveLength(5); // 0 command + 2 window + 3 project
  });
});
