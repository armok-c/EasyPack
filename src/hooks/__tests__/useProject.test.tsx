import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useProject } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";

// Mock @tauri-apps/plugin-store — use vi.hoisted so factory can reference it
const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockStore),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useProject - command CRUD", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: no persisted data
    mockStore.get.mockResolvedValue(undefined);
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function initHook() {
    const { result } = renderHook(() => useProject());
    // Wait for init useEffect to complete
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    return result;
  }

  it("addCommand updates customCommands state with new command", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("测试指令", "npm test");
    });

    // commands should now include the new command
    const cmds = result.current.commands;
    const added = cmds.find((c) => c.name === "测试指令");
    expect(added).toBeDefined();
    expect(added!.command).toBe("npm test");
  });

  it("addCommand creates command with type=custom, scope=global, default icon, UUID id", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("MyCmd", "echo hi");
    });

    const added = result.current.commands.find((c) => c.name === "MyCmd");
    expect(added).toBeDefined();
    expect(added!.type).toBe("custom");
    expect(added!.scope).toBe("global");
    expect(added!.icon).toBe("Terminal"); // DEFAULT_ICON
    // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(added!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("updateCommand updates name, command, and icon of existing command", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("Old", "old-cmd");
    });

    const added = result.current.commands.find((c) => c.name === "Old")!;
    expect(added).toBeDefined();

    await act(async () => {
      await result.current.updateCommand(added.id, {
        name: "New",
        command: "new-cmd",
        icon: "Rocket",
      });
    });

    const updated = result.current.commands.find((c) => c.id === added.id);
    expect(updated!.name).toBe("New");
    expect(updated!.command).toBe("new-cmd");
    expect(updated!.icon).toBe("Rocket");
  });

  it("deleteCommand removes the command from the list", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("ToDelete", "rm -rf");
    });

    const added = result.current.commands.find((c) => c.name === "ToDelete")!;

    await act(async () => {
      await result.current.deleteCommand(added.id);
    });

    const found = result.current.commands.find((c) => c.id === added.id);
    expect(found).toBeUndefined();
  });

  it("commands returns merged presets + custom sorted by addedAt", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("Custom1", "echo 1");
    });

    const cmds = result.current.commands;
    // Should include 4 presets + 1 custom = 5
    expect(cmds.length).toBe(5);
    // Presets should be present
    expect(cmds.some((c) => c.name === "打包项目")).toBe(true);
    // Custom should be present
    expect(cmds.some((c) => c.name === "Custom1")).toBe(true);
  });

  it("addCommand persists to store via store.set", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("Persist", "echo persist");
    });

    // store.set should have been called with the customCommands key
    expect(mockStore.set).toHaveBeenCalled();
    const lastCall = mockStore.set.mock.calls.at(-1);
    expect(lastCall![0]).toBe("customCommands");
    // The value should be an array with 1 item
    const savedValue = lastCall![1] as CommandItem[];
    expect(savedValue.length).toBe(1);
    expect(savedValue[0].name).toBe("Persist");
  });

  it("initializes customCommands from persisted store data", async () => {
    const persisted: CommandItem[] = [
      {
        id: "test-id-1",
        name: "Stored",
        command: "echo stored",
        icon: "Terminal",
        type: "custom",
        scope: "global",
        addedAt: 1000,
      },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "customCommands") return Promise.resolve(persisted);
      return Promise.resolve(undefined);
    });

    const result = await initHook();

    const cmds = result.current.commands;
    expect(cmds.some((c) => c.name === "Stored")).toBe(true);
  });

  it("removeProject cleans up project-level store key", async () => {
    // Set up a project first
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects")
        return Promise.resolve([
          {
            id: "test/project",
            name: "project",
            path: "C:\\test\\project",
            addedAt: 1000,
          },
        ]);
      if (key === "selectedProjectId")
        return Promise.resolve("test/project");
      return Promise.resolve(undefined);
    });

    const result = await initHook();

    await act(async () => {
      await result.current.removeProject("test/project");
    });

    expect(mockStore.delete).toHaveBeenCalledWith(
      "projectCommands:test/project"
    );
  });
});
