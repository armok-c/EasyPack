import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useProject } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";

// Mock @tauri-apps/plugin-store — use vi.hoisted so factory can reference it
const { mockStore, mockLoad, mockOpen, mockInvoke, mockReadTextFile, mockWriteTextFile, mockToastInfo, mockToastError } = vi.hoisted(() => ({
  mockStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    keys: vi.fn(),
    save: vi.fn(),
  },
  mockLoad: vi.fn(),
  mockOpen: vi.fn(),
  mockInvoke: vi.fn(),
  mockReadTextFile: vi.fn(),
  mockWriteTextFile: vi.fn(),
  mockToastInfo: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: mockLoad,
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mockOpen,
}));

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: mockReadTextFile,
  writeTextFile: mockWriteTextFile,
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: mockToastError,
    info: mockToastInfo,
  },
}));

mockLoad.mockResolvedValue(mockStore);

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

describe("useProject - missing project directory errors", () => {
  const testProject = {
    id: "test/missing-directory-project",
    name: "missing-directory-project",
    path: "C:\\test\\missing-directory-project",
    addedAt: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
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

  it("shows the exact missing-directory message for all execution paths", async () => {
    const result = await initHook();
    mockToastError.mockClear();
    mockInvoke.mockRejectedValue("项目目录不存在");

    await act(async () => {
      await result.current.openFolder(testProject.path);
      expect(await result.current.executeCommand("echo hello")).toBe(false);
      expect(await result.current.executeScriptCommand({
        id: "script-command",
        name: "Script",
        command: "echo hello",
        icon: "Terminal",
        type: "custom",
        scope: "project",
        addedAt: 1000,
        scriptLines: "echo hello\necho world",
        executionMode: "strict",
      })).toBe(false);
    });

    expect(mockToastError).toHaveBeenCalledTimes(3);
    expect(mockToastError.mock.calls).toEqual([
      ["项目目录不存在"],
      ["项目目录不存在"],
      ["项目目录不存在"],
    ]);
  });

  it("keeps the existing message for errors other than a missing directory", async () => {
    const result = await initHook();
    mockToastError.mockClear();
    mockInvoke.mockRejectedValue("backend failed");

    await act(async () => {
      await result.current.openFolder(testProject.path);
      await result.current.executeCommand("echo hello");
      await result.current.executeScriptCommand({
        id: "script-command",
        name: "Script",
        command: "echo hello",
        icon: "Terminal",
        type: "custom",
        scope: "project",
        addedAt: 1000,
        scriptLines: "echo hello",
        executionMode: "strict",
      });
    });

    expect(mockToastError.mock.calls).toEqual([
      ["无法打开文件夹", { description: "路径无效或文件夹不存在" }],
      ["命令执行失败：backend failed。请检查项目路径和命令是否正确。"],
      ["脚本执行失败：backend failed。请检查脚本内容是否正确。"],
    ]);
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
      mockInvoke.mockImplementation((command: string) =>
        command === "environment_prepare_delete_project"
          ? Promise.resolve({ token: "delete-project", projectCount: 1 })
          : Promise.resolve(undefined),
      );
      await result.current.removeProject("test/project");
    });

    expect(mockStore.delete).toHaveBeenCalledWith(
      "projectCommands:test/project"
    );
  });
});

describe("useProject - stable project identity and rebinding", () => {
  const legacyProject = {
    id: "legacy-project-id",
    name: "demo",
    path: "C:\\Workspace\\Demo",
    addedAt: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockLoad.mockResolvedValue(mockStore);
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
    mockStore.keys.mockResolvedValue([]);
    mockStore.save.mockResolvedValue(undefined);
    mockOpen.mockReset();
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

  it("creates a new project with an opaque UUID instead of deriving the ID from its path", async () => {
    const result = await initHook();

    await act(async () => {
      await result.current.addProject("C:\\Workspace\\Demo", "Demo");
    });

    const project = result.current.projects[0];
    expect(project).toBeDefined();
    expect(project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(project.id).not.toBe("c:/workspace/demo");
  });

  it("rejects duplicate project paths after Windows normalization", async () => {
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") {
        return Promise.resolve([
          { ...legacyProject, id: "first" },
          { ...legacyProject, id: "second", path: "D:\\Other\\Project" },
        ]);
      }
      if (key === "selectedProjectId") return Promise.resolve("first");
      return Promise.resolve(undefined);
    });
    const result = await initHook();

    await act(async () => {
      await result.current.addProject("c:/workspace/demo/", "another name");
    });

    expect(result.current.projects).toHaveLength(2);
    expect(mockStore.set).not.toHaveBeenCalledWith(
      "projects",
      expect.arrayContaining([expect.objectContaining({ name: "another name" })]),
    );
  });

  it("rebinds only the path and preserves the legacy project ID", async () => {
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([legacyProject]);
      if (key === "selectedProjectId") return Promise.resolve(legacyProject.id);
      return Promise.resolve(undefined);
    });
    mockOpen.mockResolvedValue("d:/Moved/Demo/");
    const result = await initHook();

    let rebound = false;
    await act(async () => {
      rebound = await result.current.rebindProject(legacyProject.id);
    });

    expect(rebound).toBe(true);
    expect(result.current.projects).toEqual([
      { ...legacyProject, path: "d:/Moved/Demo/" },
    ]);
    expect(mockStore.set).toHaveBeenCalledWith("projects", [
      { ...legacyProject, path: "d:/Moved/Demo/" },
    ]);
  });

  it("restores the Rust root when frontend rebinding persistence fails", async () => {
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([legacyProject]);
      if (key === "selectedProjectId") return Promise.resolve(legacyProject.id);
      return Promise.resolve(undefined);
    });
    mockOpen.mockResolvedValue("d:/Moved/Demo/");
    const result = await initHook();
    const rebindCalls: Array<{ projectPath: string; newProjectPath: string }> = [];
    mockInvoke.mockImplementation((command: string, args?: { request?: { project?: { projectPath: string }; newProjectPath?: string } }) => {
      if (command === "environment_rebind_project" && args?.request?.project) {
        rebindCalls.push({
          projectPath: args.request.project.projectPath,
          newProjectPath: args.request.newProjectPath ?? "",
        });
      }
      return Promise.resolve(undefined);
    });
    mockStore.save.mockRejectedValueOnce(new Error("frontend save failed"));

    await expect(act(async () => result.current.rebindProject(legacyProject.id))).resolves.toBe(false);

    expect(rebindCalls).toEqual([
      { projectPath: legacyProject.path, newProjectPath: "d:/Moved/Demo/" },
      { projectPath: legacyProject.path, newProjectPath: legacyProject.path },
    ]);
    expect(result.current.projects).toEqual([legacyProject]);
    expect(mockStore.set).toHaveBeenCalledWith("projects", [legacyProject]);
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

describe("useProject - profile environment boundary", () => {
  const project = {
    id: "project-a",
    name: "项目A",
    path: "C:\\Workspace\\ProjectA",
    addedAt: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockLoad.mockResolvedValue(mockStore);
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    mockStore.keys.mockResolvedValue([]);
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
    mockStore.save.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
    mockReadTextFile.mockReset();
    mockWriteTextFile.mockReset();
    mockToastInfo.mockReset();
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

  it("does not export legacy environment keys", async () => {
    mockStore.keys.mockResolvedValue([
      "projectCommands:project-a",
      "projectEnvs:project-a",
      "projectActiveEnv:project-a",
    ]);
    mockStore.get.mockImplementation((key: string) => {
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      if (key === "projectCommands:project-a") return Promise.resolve([]);
      if (key === "projectEnvs:project-a") return Promise.resolve([{ legacy: true }]);
      if (key === "projectActiveEnv:project-a") return Promise.resolve("legacy");
      return Promise.resolve(undefined);
    });
    const result = await initHook();

    await act(async () => {
      await result.current.exportProfile("profile.json");
    });

    expect(mockWriteTextFile).toHaveBeenCalledOnce();
    const payload = JSON.parse(mockWriteTextFile.mock.calls[0][1] as string) as {
      data: Record<string, unknown>;
    };
    expect(payload.data).not.toHaveProperty("projectEnvs");
    expect(payload.data).not.toHaveProperty("projectActiveEnvs");
  });

  it("ignores legacy environments on import and shows a hint", async () => {
    mockReadTextFile.mockResolvedValue(JSON.stringify({
      formatVersion: 1,
      profileName: "旧配置",
      data: {
        projects: [project],
        projectEnvs: "malformed legacy data",
        projectActiveEnvs: { [project.id]: "legacy" },
      },
    }));
    const result = await initHook();
    mockStore.set.mockClear();

    await act(async () => {
      await result.current.importProfile("profile.json");
    });

    expect(mockStore.set.mock.calls.some(([key]) =>
      key === "projectEnvs:project-a" || key === "projectActiveEnv:project-a",
    )).toBe(false);
    expect(mockToastInfo).toHaveBeenCalledWith(
      "已忽略导入文件中的旧环境数据，请在新配置中重新创建环境",
    );
  });

  it("keeps project metadata when Rust project deletion fails", async () => {
    const result = await initHook();
    mockInvoke.mockImplementation((command: string) =>
      command === "environment_prepare_delete_project"
        ? Promise.reject(new Error("rust cleanup failed"))
        : Promise.resolve(undefined),
    );

    await expect(act(async () => result.current.removeProject(project.id))).rejects.toThrow("删除项目失败");

    expect(result.current.projects).toEqual([project]);
    expect(mockStore.set).not.toHaveBeenCalledWith("projects", []);
  });

  it("keeps profile metadata when Rust profile deletion fails", async () => {
    const profiles = [
      { id: "profile-a", name: "A", createdAt: 1 },
      { id: "profile-b", name: "B", createdAt: 2 },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "profileMigrationDone") return Promise.resolve(true);
      if (key === "profiles") return Promise.resolve(profiles);
      if (key === "activeProfileId") return Promise.resolve("profile-a");
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    const result = await initHook();
    mockInvoke.mockImplementation((command: string) =>
      command === "environment_prepare_delete_profile"
        ? Promise.reject(new Error("rust cleanup failed"))
        : Promise.resolve(undefined),
    );

    await expect(act(async () => result.current.deleteProfile("profile-b"))).rejects.toThrow("删除配置失败");

    expect(result.current.profileMetas).toEqual(profiles);
    expect(mockStore.set).not.toHaveBeenCalledWith("profiles", [profiles[0]]);
  });

  it("restores a prepared project deletion when frontend save fails", async () => {
    const result = await initHook();
    const commands: string[] = [];
    mockInvoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "environment_prepare_delete_project") {
        return Promise.resolve({ token: "project-token", projectCount: 1 });
      }
      return Promise.resolve(undefined);
    });
    mockStore.save.mockReset();
    mockStore.save
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("project store save failed"))
      .mockResolvedValue(undefined);

    await expect(act(async () => result.current.removeProject(project.id))).rejects.toThrow("删除项目失败");

    expect(commands).toEqual([
      "environment_prepare_delete_project",
      "environment_restore_delete",
    ]);
    expect(result.current.projects).toEqual([project]);
    expect(mockStore.delete).toHaveBeenCalledWith("projectEnvs:project-a");
    expect(mockStore.delete).toHaveBeenCalledWith("projectActiveEnv:project-a");
  });

  it("restores a project deletion when finalize fails", async () => {
    const result = await initHook();
    const commands: string[] = [];
    mockInvoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "environment_prepare_delete_project") {
        return Promise.resolve({ token: "project-token", projectCount: 1 });
      }
      if (command === "environment_finalize_delete") {
        return Promise.reject(new Error("project finalize failed"));
      }
      return Promise.resolve(undefined);
    });

    await expect(act(async () => result.current.removeProject(project.id))).rejects.toThrow("删除项目失败");

    expect(commands).toEqual([
      "environment_prepare_delete_project",
      "environment_finalize_delete",
    ]);
    expect(mockStore.delete.mock.calls.some(([key]) =>
      typeof key === "string" && key.startsWith("pendingEnvironmentDeletion:"),
    )).toBe(false);
    expect(result.current.projects).toEqual([project]);
  });

  it("restores a prepared profile deletion when frontend save fails", async () => {
    const profiles = [
      { id: "profile-a", name: "A", createdAt: 1 },
      { id: "profile-b", name: "B", createdAt: 2 },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "profileMigrationDone") return Promise.resolve(true);
      if (key === "profiles") return Promise.resolve(profiles);
      if (key === "activeProfileId") return Promise.resolve("profile-a");
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    const result = await initHook();
    const commands: string[] = [];
    mockInvoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "environment_prepare_delete_profile") {
        return Promise.resolve({ token: "profile-token", projectCount: 1 });
      }
      return Promise.resolve(undefined);
    });
    mockStore.save.mockReset();
    mockStore.save
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("profile store save failed"))
      .mockResolvedValue(undefined);

    await expect(act(async () => result.current.deleteProfile("profile-b"))).rejects.toThrow("删除配置失败");

    expect(commands).toEqual([
      "environment_prepare_delete_profile",
      "environment_restore_delete",
    ]);
    expect(result.current.profileMetas).toEqual(profiles);
  });

  it("restores a profile deletion when finalize fails", async () => {
    const profiles = [
      { id: "profile-a", name: "A", createdAt: 1 },
      { id: "profile-b", name: "B", createdAt: 2 },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "profileMigrationDone") return Promise.resolve(true);
      if (key === "profiles") return Promise.resolve(profiles);
      if (key === "activeProfileId") return Promise.resolve("profile-a");
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    const result = await initHook();
    const commands: string[] = [];
    mockInvoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "environment_prepare_delete_profile") {
        return Promise.resolve({ token: "profile-token", projectCount: 1 });
      }
      if (command === "environment_finalize_delete") {
        return Promise.reject(new Error("profile finalize failed"));
      }
      return Promise.resolve(undefined);
    });

    await expect(act(async () => result.current.deleteProfile("profile-b"))).rejects.toThrow("删除配置失败");

    expect(commands).toEqual([
      "environment_prepare_delete_profile",
      "environment_finalize_delete",
    ]);
    expect(mockStore.delete.mock.calls.some(([key]) =>
      typeof key === "string" && key.startsWith("pendingEnvironmentDeletion:"),
    )).toBe(false);
    expect(result.current.profileMetas).toEqual(profiles);
  });

  it("restores a profile deletion when clearing the profile store fails", async () => {
    const profiles = [
      { id: "profile-a", name: "A", createdAt: 1 },
      { id: "profile-b", name: "B", createdAt: 2 },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "profileMigrationDone") return Promise.resolve(true);
      if (key === "profiles") return Promise.resolve(profiles);
      if (key === "activeProfileId") return Promise.resolve("profile-a");
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    const result = await initHook();
    const commands: string[] = [];
    mockInvoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "environment_prepare_delete_profile") {
        return Promise.resolve({ token: "profile-token", projectCount: 1 });
      }
      return Promise.resolve(undefined);
    });
    mockStore.save.mockReset();
    mockStore.save
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("profile store clear failed"))
      .mockResolvedValue(undefined);

    await expect(act(async () => result.current.deleteProfile("profile-b"))).rejects.toThrow("profile store clear failed");

    expect(commands).toEqual([
      "environment_prepare_delete_profile",
      "environment_restore_delete",
    ]);
    expect(mockToastError).toHaveBeenLastCalledWith("删除配置失败", {
      description: "已恢复，请重试。",
    });
  });

  it("restores a profile deletion when switching to the next profile fails", async () => {
    const profiles = [
      { id: "profile-a", name: "A", createdAt: 1 },
      { id: "profile-b", name: "B", createdAt: 2 },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "profileMigrationDone") return Promise.resolve(true);
      if (key === "profiles") return Promise.resolve(profiles);
      if (key === "activeProfileId") return Promise.resolve("profile-a");
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    const result = await initHook();
    mockLoad.mockImplementation((path: string) =>
      path === "profile-profile-b.json"
        ? Promise.reject(new Error("profile switch failed"))
        : Promise.resolve(mockStore),
    );
    const commands: string[] = [];
    mockInvoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "environment_prepare_delete_profile") {
        return Promise.resolve({ token: "profile-token", projectCount: 1 });
      }
      return Promise.resolve(undefined);
    });

    await expect(act(async () => result.current.deleteProfile("profile-a"))).rejects.toThrow("profile switch failed");

    expect(commands).toEqual([
      "environment_prepare_delete_profile",
      "environment_restore_delete",
    ]);
    expect(mockToastError).toHaveBeenLastCalledWith("删除配置失败", {
      description: "已恢复，请重试。",
    });
  });

  it("reports incomplete project recovery when frontend store restoration fails", async () => {
    const result = await initHook();
    mockInvoke.mockImplementation((command: string) => {
      if (command === "environment_prepare_delete_project") {
        return Promise.resolve({ token: "project-token", projectCount: 1 });
      }
      return Promise.resolve(undefined);
    });
    mockStore.save.mockReset();
    mockStore.save
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("project frontend save failed"))
      .mockRejectedValueOnce(new Error("project store restore failed"))
      .mockResolvedValue(undefined);

    await expect(act(async () => result.current.removeProject(project.id))).rejects.toThrow("project frontend save failed");

    expect(mockToastError).toHaveBeenLastCalledWith("删除项目失败", {
      description: "删除失败且恢复不完整，请检查数据后重试。",
    });
  });

  it("reports incomplete project recovery when Rust restore fails", async () => {
    const result = await initHook();
    mockInvoke.mockImplementation((command: string) => {
      if (command === "environment_prepare_delete_project") {
        return Promise.resolve({ token: "project-token", projectCount: 1 });
      }
      if (command === "environment_finalize_delete") {
        return Promise.reject(new Error("project finalize failed"));
      }
      if (command === "environment_restore_delete") {
        return Promise.reject(new Error("project restore failed"));
      }
      return Promise.resolve(undefined);
    });

    await expect(act(async () => result.current.removeProject(project.id))).rejects.toThrow("project finalize failed");

    expect(mockToastError).toHaveBeenLastCalledWith("删除项目失败", {
      description: "删除失败且恢复不完整，请检查数据后重试。",
    });
  });

  it("reports incomplete profile recovery when frontend store restoration fails", async () => {
    const profiles = [
      { id: "profile-a", name: "A", createdAt: 1 },
      { id: "profile-b", name: "B", createdAt: 2 },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "profileMigrationDone") return Promise.resolve(true);
      if (key === "profiles") return Promise.resolve(profiles);
      if (key === "activeProfileId") return Promise.resolve("profile-a");
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    const result = await initHook();
    mockInvoke.mockImplementation((command: string) => {
      if (command === "environment_prepare_delete_profile") {
        return Promise.resolve({ token: "profile-token", projectCount: 1 });
      }
      return Promise.resolve(undefined);
    });
    mockStore.save.mockReset();
    mockStore.save
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("profile frontend save failed"))
      .mockRejectedValueOnce(new Error("profile store restore failed"))
      .mockResolvedValue(undefined);

    await expect(act(async () => result.current.deleteProfile("profile-b"))).rejects.toThrow("profile frontend save failed");

    expect(mockToastError).toHaveBeenLastCalledWith("删除配置失败", {
      description: "删除失败且恢复不完整，请检查数据后重试。",
    });
  });

  it("reports incomplete profile recovery when Rust restore fails", async () => {
    const profiles = [
      { id: "profile-a", name: "A", createdAt: 1 },
      { id: "profile-b", name: "B", createdAt: 2 },
    ];
    mockStore.get.mockImplementation((key: string) => {
      if (key === "profileMigrationDone") return Promise.resolve(true);
      if (key === "profiles") return Promise.resolve(profiles);
      if (key === "activeProfileId") return Promise.resolve("profile-a");
      if (key === "projects") return Promise.resolve([project]);
      if (key === "selectedProjectId") return Promise.resolve(project.id);
      return Promise.resolve(undefined);
    });
    const result = await initHook();
    mockInvoke.mockImplementation((command: string) => {
      if (command === "environment_prepare_delete_profile") {
        return Promise.resolve({ token: "profile-token", projectCount: 1 });
      }
      if (command === "environment_finalize_delete") {
        return Promise.reject(new Error("profile finalize failed"));
      }
      if (command === "environment_restore_delete") {
        return Promise.reject(new Error("profile restore failed"));
      }
      return Promise.resolve(undefined);
    });

    await expect(act(async () => result.current.deleteProfile("profile-b"))).rejects.toThrow("profile finalize failed");

    expect(mockToastError).toHaveBeenLastCalledWith("删除配置失败", {
      description: "删除失败且恢复不完整，请检查数据后重试。",
    });
  });
});
