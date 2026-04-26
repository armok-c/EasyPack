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
    // Should include 2 defaults + 1 custom = 3
    expect(cmds.length).toBe(3);
    // Defaults should be present (git pull + claude per D-06)
    expect(cmds.some((c) => c.name === "Git Pull")).toBe(true);
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
      if (key === "projects") return Promise.resolve([testProjectForCrud]);
      if (key === "selectedProjectId") return Promise.resolve(testProjectForCrud.id);
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

  // Test 1: enableProjectCommands — commands completely replaced with project-level (2 default copies)
  it("enableProjectCommands replaces commands with 2 project-level default copies", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    const cmds = result.current.commands;
    // 2 default copies (git pull + claude per D-06), no global presets/custom
    expect(cmds.length).toBe(2);
    expect(cmds.every((c) => c.scope === "project")).toBe(true);
    expect(cmds.some((c) => c.name === "Git Pull")).toBe(true);
    expect(cmds.some((c) => c.name === "启动 Claude")).toBe(true);
  });

  // Test 2: enableProjectCommands — created commands have type='preset', scope='project'
  it("enableProjectCommands creates commands with type=preset scope=project", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    const cmds = result.current.commands;
    expect(cmds.every((c) => c.type === "preset")).toBe(true);
    expect(cmds.every((c) => c.scope === "project")).toBe(true);
  });

  // Test 3: enableProjectCommands — enterEditMode becomes true after creation (per D-22)
  it("enableProjectCommands sets editMode to true (per D-22)", async () => {
    const result = await initWithProject();

    expect(result.current.editMode).toBe(false);

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    expect(result.current.editMode).toBe(true);
  });

  // Test 4: disableProjectCommands — pure view toggle, preserves data, reverts to global mode
  it("disableProjectCommands switches to global mode without deleting data", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    expect(result.current.commandMode).toBe("project");

    await act(async () => {
      await result.current.disableProjectCommands();
    });

    expect(result.current.commandMode).toBe("global");
    // Commands should now show global defaults
    const cmds = result.current.commands;
    expect(cmds.some((c) => c.name === "Git Pull")).toBe(true);
    // Project command data should still exist in the map
    expect(result.current.projectCommandsMap[testProject.id]).toBeDefined();
    expect(result.current.projectCommandsMap[testProject.id].length).toBe(2);
  });

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
    expect(result.current.commandMode).toBe("project");
    expect(result.current.commands.length).toBe(1);
    expect(result.current.commands[0].name).toBe("项目专属");
  });

  // Test 6: commands switch — project without project-level set shows global presets + custom
  it("switching to project without project-level set shows global commands", async () => {
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

    expect(result.current.commandMode).toBe("global");
    // Should have 2 global defaults (git pull + claude per D-06)
    expect(result.current.commands.length).toBe(2);
    expect(result.current.commands.every((c) => c.scope === "global")).toBe(true);
  });

  // Test 7: auto-revert — deleting the last project-level command reverts to global (per D-10)
  it("deleting last project-level command auto-reverts to global mode (per D-10)", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    expect(result.current.commandMode).toBe("project");
    const cmds = result.current.commands;

    // Delete all 2 project-level commands one by one
    for (const cmd of [...cmds]) {
      await act(async () => {
        await result.current.deleteCommand(cmd.id);
      });
    }

    // Should have auto-reverted to global mode
    expect(result.current.commandMode).toBe("global");
    // Global defaults should now be showing (2 per D-06)
    expect(result.current.commands.length).toBe(2);
    expect(result.current.commands.every((c) => c.scope === "global")).toBe(true);
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
    expect(saved.length).toBe(2);
    expect(saved.every((c) => c.scope === "project")).toBe(true);
  });

  // Test 9: deleteCommand in project mode — operates on project-level Store key
  it("deleteCommand in project mode operates on project-level store key", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    const cmdToDelete = result.current.commands[0];

    // Clear mock history to isolate the delete call
    mockStore.set.mockClear();

    await act(async () => {
      await result.current.deleteCommand(cmdToDelete.id);
    });

    // store.set should update projectCommands key with 1 remaining
    const calls = mockStore.set.mock.calls;
    const projectCmdCall = calls.find(
      (c) => c[0] === "projectCommands:test/project-a"
    );
    expect(projectCmdCall).toBeDefined();
    const saved = projectCmdCall![1] as CommandItem[];
    expect(saved.length).toBe(1);
  });

  // Test 10: addCommand in project mode — appends to project-level Store key
  it("addCommand in project mode appends to project-level store key", async () => {
    const result = await initWithProject();

    await act(async () => {
      await result.current.enableProjectCommands();
    });

    // Clear mock history to isolate the add call
    mockStore.set.mockClear();

    await act(async () => {
      await result.current.addCommand("项目专属指令", "npm run special");
    });

    expect(result.current.commands.length).toBe(3);

    const calls = mockStore.set.mock.calls;
    const projectCmdCall = calls.find(
      (c) => c[0] === "projectCommands:test/project-a"
    );
    expect(projectCmdCall).toBeDefined();
    const saved = projectCmdCall![1] as CommandItem[];
    expect(saved.length).toBe(3);
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
    expect(result.current.commandMode).toBe("project");
    expect(result.current.commands[0].name).toBe("项目A指令");

    // Switch to project-b (no project-level commands)
    await act(async () => {
      await result.current.selectProject(testProject2.id);
    });

    expect(result.current.commandMode).toBe("global");
    expect(result.current.commands.length).toBe(2);
    expect(result.current.commands.every((c) => c.scope === "global")).toBe(true);
  });
});
