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
    keys: vi.fn(),
    save: vi.fn(),
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

describe("useProject - Phase 22 simplified contract", () => {
  const testProject = {
    id: "test/simple-project",
    name: "simple-project",
    path: "C:\\test\\simple-project",
    addedAt: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([testProject]);
      if (key === "selectedProjectId") return Promise.resolve(testProject.id);
      return Promise.resolve(undefined);
    });
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
    mockStore.keys.mockResolvedValue([]);
    mockStore.save.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function initHook() {
    const { result } = renderHook(() => useProject());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    return result;
  }

  it("REGRESSION: commandMode is NOT returned (removed per D-10)", async () => {
    const result = await initHook();
    expect((result.current as Record<string, unknown>).commandMode).toBeUndefined();
  });

  it("REGRESSION: customCommands is NOT returned (removed per D-11)", async () => {
    const result = await initHook();
    expect((result.current as Record<string, unknown>).customCommands).toBeUndefined();
  });

  it("REGRESSION: disableProjectCommands is NOT returned (removed per D-15)", async () => {
    const result = await initHook();
    expect((result.current as Record<string, unknown>).disableProjectCommands).toBeUndefined();
  });

  it("addCommand accepts (name, command, icon?, extra?) without scope parameter", async () => {
    const result = await initHook();
    await act(async () => {
      // Call with 3 args (no scope) — should not throw
      await result.current.addCommand("NoScope", "echo ok");
    });
    const cmds = result.current.commands;
    expect(cmds.some((c) => c.name === "NoScope")).toBe(true);
  });

  it("commands derived only from projectCommandsMap, not from customCommands", async () => {
    const result = await initHook();
    // When no project-level commands exist, commands should be empty
    // (no global presets/customCommands leaking in)
    expect(result.current.commands.length).toBe(0);
  });

  it("enableProjectCommands does NOT initialize with default presets", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    // Should initialize with empty array, not with getDefaultsAsCommandItems()
    const cmds = result.current.commands;
    expect(cmds.length).toBe(0);
    // Should enter edit mode
    expect(result.current.editMode).toBe(true);
  });
});

describe("useProject - command CRUD", () => {
  const testProjectForCrud = {
    id: "test/crud-project",
    name: "crud-project",
    path: "C:\\test\\crud-project",
    addedAt: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // Default: a selected project so commands are visible in global mode
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([testProjectForCrud]);
      if (key === "selectedProjectId") return Promise.resolve(testProjectForCrud.id);
      return Promise.resolve(undefined);
    });
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
    mockStore.keys.mockResolvedValue([]);
    mockStore.save.mockResolvedValue(undefined);
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

  it("addCommand adds command to commands list", async () => {
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

  it("addCommand creates command with type=custom, scope=project (default when project selected), default icon, UUID id", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("MyCmd", "echo hi");
    });

    const added = result.current.commands.find((c) => c.name === "MyCmd");
    expect(added).toBeDefined();
    expect(added!.type).toBe("custom");
    expect(added!.scope).toBe("project"); // default changed to project when a project is selected
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

  it("commands returns custom commands sorted by addedAt", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("Custom1", "echo 1");
    });

    const cmds = result.current.commands;
    // Only custom command (no auto-initialized presets in Phase 22)
    expect(cmds.length).toBe(1);
    expect(cmds.some((c) => c.name === "Custom1")).toBe(true);
  });

  it("addCommand persists to projectCommands store key (default scope=project)", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addCommand("Persist", "echo persist");
    });

    // store.set should have been called with the projectCommands key (not customCommands)
    expect(mockStore.set).toHaveBeenCalled();
    const lastCall = mockStore.set.mock.calls.at(-1);
    expect(lastCall![0]).toBe("projectCommands:test/crud-project");
    // The value should include only the custom command (no auto-initialized presets in Phase 22)
    const savedValue = lastCall![1] as CommandItem[];
    expect(savedValue.length).toBe(1);
    expect(savedValue.some((c) => c.name === "Persist")).toBe(true);
  });

  it("initializes commands from persisted projectCommands store data", async () => {
    const persisted: CommandItem[] = [
      {
        id: "test-id-1",
        name: "Stored",
        command: "echo stored",
        icon: "Terminal",
        type: "custom",
        scope: "project",
        addedAt: 1000,
      },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([testProjectForCrud]);
      if (key === "selectedProjectId") return Promise.resolve(testProjectForCrud.id);
      if (key === "projectCommands:test/crud-project") return Promise.resolve(persisted);
      return Promise.resolve(undefined);
    });
    mockStore.keys.mockResolvedValue(["projectCommands:test/crud-project"]);

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

describe("useProject - project-level command override", () => {
  const testProject = {
    id: "test/project-a",
    name: "project-a",
    path: "C:\\test\\project-a",
    addedAt: 1000,
  };
  const testProject2 = {
    id: "test/project-b",
    name: "project-b",
    path: "C:\\test\\project-b",
    addedAt: 2000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockStore.get.mockResolvedValue(undefined);
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
    mockStore.keys.mockResolvedValue([]);
    mockStore.save.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /** Initialize hook with a selected project so we can test project-level operations. */
  async function initWithProject(project = testProject) {
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useProject());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    return result;
  }

  // Test 1: enableProjectCommands — initializes empty array when no commands exist
  it("enableProjectCommands initializes with empty array when no commands exist", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    const cmds = result.current.commands;
    // Phase 22: no preset initialization, empty array
    expect(cmds.length).toBe(0);
    expect(result.current.editMode).toBe(true);
  });

  // Test 2: enableProjectCommands — when commands already exist, just enters edit mode
  it("enableProjectCommands enters edit mode when commands already exist", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.addCommand("Existing", "echo existing");
    });

    // Now call enableProjectCommands — should just enter edit mode
    await act(async () => {
      await result.current.enableProjectCommands();
    });

    const cmds = result.current.commands;
    expect(cmds.length).toBe(1);
    expect(cmds.some((c) => c.name === "Existing")).toBe(true);
    expect(result.current.editMode).toBe(true);
  });

  // Test 3: enableProjectCommands — editMode becomes true
  it("enableProjectCommands sets editMode to true", async () => {
    const result = await initWithProject();

    expect(result.current.editMode).toBe(false);

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    expect(result.current.editMode).toBe(true);
  });

  // Test 4: disableProjectCommands removed in Phase 22 (no commandMode)
  // Test 5: commands switch — project with project-level set shows only project commands
  it("switching to project with project-level set shows only project commands", async () => {
    // Set up: two projects, project-a has project-level commands
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects")
        return Promise.resolve([testProject, testProject2]);
      if (key === "selectedProjectId")
        return Promise.resolve(testProject.id);
      if (key === "projectCommands:test/project-a")
        return Promise.resolve([
          {
            id: "proj-cmd-1",
            name: "项目专属",
            command: "npm run custom",
            icon: "Terminal",
            type: "custom",
            scope: "project",
            addedAt: 5000,
          },
        ]);
      return Promise.resolve(undefined);
    });
    mockStore.keys.mockResolvedValue(["projectCommands:test/project-a"]);

    const { result } = renderHook(() => useProject());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // project-a is selected and has project-level commands
    expect(result.current.commands.length).toBe(1);
    expect(result.current.commands[0].name).toBe("项目专属");
  });

  // Test 6: commands switch — project without project-level set shows empty commands
  it("switching to project without project-level set shows empty commands", async () => {
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects")
        return Promise.resolve([testProject, testProject2]);
      if (key === "selectedProjectId")
        return Promise.resolve(testProject2.id);
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useProject());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // Phase 22: no global defaults — empty commands when no project-level data
    expect(result.current.commands.length).toBe(0);
  });

  // Test 7: deleting last project-level command removes entry, commands become empty
  it("deleting last project-level command removes project entry", async () => {
    const result = await initWithProject();

    // Add a command first
    await act(async () => {
      await result.current.addCommand("OnlyCmd", "echo only");
    });

    expect(result.current.commands.length).toBe(1);

    // Delete it
    const onlyCmd = result.current.commands[0];
    await act(async () => {
      await result.current.deleteCommand(onlyCmd.id);
    });

    // Commands should be empty (no auto-revert to global mode)
    expect(result.current.commands.length).toBe(0);
    // Project entry should be removed from map
    expect(result.current.projectCommandsMap[testProject.id]).toBeUndefined();
  });

  // Test 8: persistence — project-level commands saved via store.set(projectCommandsKey)
  it("enableProjectCommands persists to store via projectCommandsKey", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    // store.set should have been called with projectCommands:test/project-a
    const calls = mockStore.set.mock.calls;
    const projectCmdCall = calls.find(
      (c) => c[0] === "projectCommands:test/project-a"
    );
    expect(projectCmdCall).toBeDefined();
    const saved = projectCmdCall![1] as CommandItem[];
    // Phase 22: enableProjectCommands saves empty array
    expect(saved.length).toBe(0);
  });

  // Test 9: deleteCommand — operates on project-level Store key
  it("deleteCommand operates on project-level store key", async () => {
    const result = await initWithProject();

    // Add a command to delete
    await act(async () => {
      await result.current.addCommand("ToDelete", "echo del");
    });

    const cmdToDelete = result.current.commands[0];

    // Clear mock history to isolate the delete call
    mockStore.set.mockClear();

    await act(async () => {
      await result.current.deleteCommand(cmdToDelete.id);
    });

    // store.delete should have been called for the projectCommands key
    expect(mockStore.delete).toHaveBeenCalledWith(
      "projectCommands:test/project-a"
    );
  });

  // Test 10: addCommand — appends to project-level Store key
  it("addCommand appends to project-level store key", async () => {
    const result = await initWithProject();

    // Directly add command (no enableProjectCommands needed)
    mockStore.set.mockClear();

    await act(async () => {
      await result.current.addCommand("项目专属指令", "npm run special");
    });

    expect(result.current.commands.length).toBe(1);

    const calls = mockStore.set.mock.calls;
    const projectCmdCall = calls.find(
      (c) => c[0] === "projectCommands:test/project-a"
    );
    expect(projectCmdCall).toBeDefined();
    const saved = projectCmdCall![1] as CommandItem[];
    expect(saved.length).toBe(1);
    expect(saved.some((c) => c.name === "项目专属指令")).toBe(true);
    // New command should be custom type
    const added = saved.find((c) => c.name === "项目专属指令")!;
    expect(added.type).toBe("custom");
    expect(added.scope).toBe("project");
  });

  // Test 11: commands update when selected project changes
  it("commands update when selected project changes", async () => {
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects")
        return Promise.resolve([testProject, testProject2]);
      if (key === "selectedProjectId")
        return Promise.resolve(testProject.id);
      if (key === "projectCommands:test/project-a")
        return Promise.resolve([
          {
            id: "proj-cmd-1",
            name: "项目A指令",
            command: "npm run a",
            icon: "Terminal",
            type: "custom",
            scope: "project",
            addedAt: 5000,
          },
        ]);
      return Promise.resolve(undefined);
    });
    mockStore.keys.mockResolvedValue(["projectCommands:test/project-a"]);

    const { result } = renderHook(() => useProject());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // project-a selected: project-level commands
    expect(result.current.commands[0].name).toBe("项目A指令");

    // Switch to project-b (no project-level commands)
    await act(async () => {
      await result.current.selectProject(testProject2.id);
    });

    // Phase 22: no global mode — commands empty when no project-level data
    expect(result.current.commands.length).toBe(0);
  });
});
