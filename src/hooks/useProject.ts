import { useState, useEffect, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { CommandItem } from "@/lib/types";
import { getDefaultsAsCommandItems } from "@/lib/presets";
import { DEFAULT_ICON } from "@/lib/icons";
import { shortcutToDisplay, findConflict } from "@/lib/shortcutUtils";

export interface ProjectItem {
  id: string;       // normalized path as ID (lowercase, forward slashes)
  name: string;     // folder name (per D-03)
  path: string;     // original full path (preserves original casing)
  addedAt: number;  // Date.now() timestamp
  icon?: string;    // Phase 5: lucide icon name from ICON_OPTIONS keys, undefined means default
  color?: string;   // Phase 5: CSS hex color value from COLOR_OPTIONS, empty/undefined means no color
}

/** 项目信息（文件夹大小 + Git 分支），来自 Rust get_project_info 命令 */
export interface ProjectInfoResult {
  size: string;         // 人类可读格式，如 "12.3 MB"
  branch: string | null; // null = 非 Git 仓库或 detached HEAD
}

// Backward-compatible type alias (remove after Plan 02 migration)
export type Project = ProjectItem;

const STORE_PATH = "easypack-store.json";
const PROJECTS_KEY = "projects";
const SELECTED_KEY = "selectedProjectId";
const CUSTOM_COMMANDS_KEY = "customCommands";
const SHORTCUT_BINDINGS_KEY = "shortcutBindings";

function projectCommandsKey(projectId: string): string {
  return `projectCommands:${projectId}`;
}

function generateProjectId(path: string): string {
  return path
    .split(/[\\/]/)
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

export function useProject() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [customCommands, setCustomCommands] = useState<CommandItem[]>([]);

  // Phase 4 Plan 03: project-level command override
  const [commandMode, setCommandMode] = useState<"global" | "project">("global");
  const [projectCommandsMap, setProjectCommandsMap] = useState<Record<string, CommandItem[]>>({});
  const [editMode, setEditMode] = useState(false);

  // Phase 11: preset shortcut overrides (persisted separately since presets are derived fresh)
  const [presetShortcutsMap, setPresetShortcutsMap] = useState<Record<string, string>>({});
  const PRESHORTCUTS_KEY = "presetShortcuts";

  // Phase 18: unified shortcut bindings (independent store key)
  const [shortcutBindings, setShortcutBindings] = useState<Record<string, string>>({});

  // Phase 8: project info (folder size + Git branch)
  const [projectInfo, setProjectInfo] = useState<ProjectInfoResult | null>(null);
  const [projectInfoLoading, setProjectInfoLoading] = useState(false);
  const [projectInfoError, setProjectInfoError] = useState(false);

  // Derived state: current project from projects + selectedId
  const currentProject = useMemo(
    () => selectedId ? projects.find((p) => p.id === selectedId) ?? null : null,
    [selectedId, projects]
  );

  // Merged command list: use commandMode to decide, sorted by addedAt
  const commands = useMemo(() => {
    if (!selectedId) return [];
    if (commandMode === "project") {
      const projectCmds = projectCommandsMap[selectedId];
      if (projectCmds && projectCmds.length > 0) {
        return [...projectCmds].sort((a, b) => a.addedAt - b.addedAt);
      }
      return [];
    }
    // Global mode: presets + global custom commands, inject preset shortcuts
    return [...getDefaultsAsCommandItems(), ...customCommands]
      .map((cmd) => {
        if (presetShortcutsMap[cmd.id]) {
          return { ...cmd, shortcut: presetShortcutsMap[cmd.id] };
        }
        return cmd;
      })
      .sort((a, b) => a.addedAt - b.addedAt);
  }, [selectedId, customCommands, projectCommandsMap, commandMode, presetShortcutsMap]);

  // Auto-detect commandMode only when switching projects (not on every projectCommandsMap change)
  useEffect(() => {
    if (!selectedId) {
      setCommandMode("global");
      return;
    }
    const projectCmds = projectCommandsMap[selectedId];
    setCommandMode(projectCmds && projectCmds.length > 0 ? "project" : "global");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Initialize: load store and restore persisted data
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const s = await load(STORE_PATH, { autoSave: 100, defaults: {} });
        if (!mounted) return;
        const savedProjects = await s.get<ProjectItem[]>(PROJECTS_KEY);
        const savedSelectedId = await s.get<string>(SELECTED_KEY);
        const savedCommands = await s.get<CommandItem[]>(CUSTOM_COMMANDS_KEY);
        if (savedProjects) setProjects(savedProjects);
        if (savedSelectedId) setSelectedId(savedSelectedId);
        if (savedCommands) setCustomCommands(savedCommands);

        // Phase 8: fetch project info for already-selected project on startup
        if (savedSelectedId && savedProjects) {
          const savedProject = savedProjects.find((p: ProjectItem) => p.id === savedSelectedId);
          if (savedProject) {
            fetchProjectInfo(savedProject.path);
          }
        }

        // Restore project-level command data from store
        const allKeys = await (s as unknown as { keys: () => Promise<string[]> }).keys();
        const projectCmdEntries = await Promise.all(
          allKeys
            .filter((k) => k.startsWith("projectCommands:"))
            .map(async (k) => {
              const projectId = k.replace("projectCommands:", "");
              const cmds = await s.get<CommandItem[]>(k);
              return [projectId, cmds ?? []] as const;
            })
        );
        const map = Object.fromEntries(projectCmdEntries);
        if (Object.keys(map).length > 0) setProjectCommandsMap(map);

        // Phase 11: restore preset shortcut overrides
        const savedPresetShortcuts = await s.get<Record<string, string>>(PRESHORTCUTS_KEY);
        if (savedPresetShortcuts) setPresetShortcutsMap(savedPresetShortcuts);

        // Phase 18: restore unified shortcut bindings, migrate from old format if needed
        const savedBindings = await s.get<Record<string, string>>(SHORTCUT_BINDINGS_KEY);
        if (savedBindings && Object.keys(savedBindings).length > 0) {
          setShortcutBindings(savedBindings);
        } else {
          // Migration: convert old CommandItem.shortcut + presetShortcutsMap to new format
          const migrated: Record<string, string> = {};
          // Migrate from custom commands' shortcut fields
          if (savedCommands) {
            for (const cmd of savedCommands) {
              if (cmd.shortcut) {
                migrated[`command.${cmd.id}`] = cmd.shortcut;
              }
            }
          }
          // Migrate from project commands' shortcut fields
          for (const k of allKeys) {
            if (!k.startsWith("projectCommands:")) continue;
            const projCmds = await s.get<CommandItem[]>(k);
            if (projCmds) {
              for (const cmd of projCmds) {
                if (cmd.shortcut) {
                  migrated[`command.${cmd.id}`] = cmd.shortcut;
                }
              }
            }
          }
          // Migrate from preset shortcut overrides
          if (savedPresetShortcuts) {
            for (const [presetId, shortcut] of Object.entries(savedPresetShortcuts)) {
              migrated[`command.${presetId}`] = shortcut;
            }
          }
          if (Object.keys(migrated).length > 0) {
            setShortcutBindings(migrated);
            await s.set(SHORTCUT_BINDINGS_KEY, migrated);
          }
        }

        setStore(s);
      } catch (error) {
        console.warn("Store 加载失败，使用内存模式:", error);
        // Graceful degradation: app works without persistence
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Add project (per D-02 append to bottom, D-04 duplicate check, D-05 auto-select)
  const addProject = useCallback(
    async (path: string, name: string) => {
      const id = generateProjectId(path);
      if (projects.some((p) => p.id === id)) {
        toast.error("项目已存在");
        return;
      }
      const newItem: ProjectItem = { id, name, path, addedAt: Date.now() };
      const updated = [...projects, newItem];
      setProjects(updated);
      setSelectedId(id);
      await store?.set(PROJECTS_KEY, updated);
      await store?.set(SELECTED_KEY, id);
    },
    [projects, store]
  );

  // Remove project (per D-10 auto-select nearest, D-11 empty state for last item)
  const removeProject = useCallback(
    async (id: string) => {
      const idx = projects.findIndex((p) => p.id === id);
      if (idx === -1) return;
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);

      // D-10: auto-select nearest neighbor
      let newSelectedId: string | null = null;
      if (updated.length > 0 && id === selectedId) {
        newSelectedId = updated[Math.min(idx, updated.length - 1)].id;
      } else if (id !== selectedId) {
        newSelectedId = selectedId;
      }
      setSelectedId(newSelectedId);
      await store?.set(PROJECTS_KEY, updated);
      await store?.set(SELECTED_KEY, newSelectedId);
      // Clean up project-level command data (both store and in-memory)
      await store?.delete(projectCommandsKey(id));
      setProjectCommandsMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await store?.save();
    },
    [projects, selectedId, store]
  );

  // Phase 8: fetch project info (folder size + Git branch) per D-04
  const fetchProjectInfo = useCallback(async (projectPath: string) => {
    setProjectInfoLoading(true);
    setProjectInfoError(false);
    setProjectInfo(null);
    try {
      // D-06: 8 second timeout (between 5-10s)
      // 使用 reject 而非 resolve，确保超时状态可通过 catch 区分
      const result = await Promise.race([
        invoke<ProjectInfoResult>("get_project_info", { projectPath }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000)
        ),
      ]);
      setProjectInfo(result);
    } catch {
      // 超时或 invoke 错误：设置错误标志
      setProjectInfoError(true);
    } finally {
      setProjectInfoLoading(false);
    }
  }, []);

  // Select project (also exits edit mode on project switch)
  const selectProject = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setEditMode(false);
      await store?.set(SELECTED_KEY, id);
      // Phase 8: fetch project info on project switch (per D-04)
      const project = projects.find((p) => p.id === id);
      if (project) {
        fetchProjectInfo(project.path);
      }
    },
    [store, projects, fetchProjectInfo]
  );

  // Folder picker (inherits Phase 1 logic, calls addProject internally)
  const selectFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目文件夹",
      });
      if (typeof selected === "string") {
        const name = selected.split(/[\\/]/).filter(Boolean).pop() || selected;
        await addProject(selected, name);
      }
    } catch (error) {
      console.error("文件夹选择失败:", error);
    }
  }, [addProject]);

  // Execute command (inherits Phase 1 logic, uses derived currentProject)
  const executeCommand = useCallback(
    async (shellCommand: string): Promise<boolean> => {
      if (!currentProject) return false;
      try {
        await invoke("execute_command", {
          projectPath: currentProject.path,
          shellCommand,
        });
        toast.success(`已执行: ${shellCommand}`);
        return true;
      } catch (error) {
        toast.error(
          `命令执行失败：${error}。请检查项目路径和命令是否正确。`
        );
        return false;
      }
    },
    [currentProject]
  );

  // Phase 17: Execute a CommandItem, dispatching to single-line or multi-line path
  const executeScriptCommand = useCallback(
    async (cmd: CommandItem): Promise<boolean> => {
      if (!currentProject) return false;

      if (cmd.scriptLines) {
        // Multi-line script path: call execute_script on Rust backend
        try {
          await invoke("execute_script", {
            projectPath: currentProject.path,
            scriptContent: cmd.scriptLines,
            isBatchScript: cmd.executionMode === "batch",
            strict: cmd.executionMode !== "lenient",
          });
          toast.success(`已执行脚本: ${cmd.name}`);
          return true;
        } catch (error) {
          toast.error(
            `脚本执行失败：${error}。请检查脚本内容是否正确。`
          );
          return false;
        }
      }

      // Single-line path: delegate to existing executeCommand
      return executeCommand(cmd.command);
    },
    [currentProject, executeCommand]
  );

  // --- Command CRUD operations ---

  // Add custom command (supports both global and project-level modes)
  const addCommand = useCallback(
    async (
      name: string,
      command: string,
      icon?: string,
      scope?: "global" | "project",
      extra?: { scriptLines?: string; executionMode?: "strict" | "lenient" | "batch" },
    ) => {
      // Default to project scope when a project is selected, so custom commands follow projects
      const effectiveScope = scope ?? (selectedId ? "project" : "global");

      if (effectiveScope === "project" && selectedId) {
        // Project-level: add to projectCommandsMap
        const newItem: CommandItem = {
          id: crypto.randomUUID(),
          name,
          command,
          icon: icon ?? DEFAULT_ICON,
          type: "custom",
          scope: "project",
          addedAt: Date.now(),
          scriptLines: extra?.scriptLines,
          executionMode: extra?.executionMode,
        };
        let current = projectCommandsMap[selectedId] ?? [];
        // When adding the first project command, initialize from presets
        // so the user still sees default commands alongside their custom one
        if (current.length === 0) {
          const presets = getDefaultsAsCommandItems();
          current = presets.map((p, idx) => ({
            ...p,
            id: crypto.randomUUID(),
            scope: "project" as const,
            addedAt: idx,
          }));
        }
        const updated = [...current, newItem];
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await store?.set(projectCommandsKey(selectedId), updated);
        await store?.save();
        setCommandMode("project");
        toast.success(`已添加指令: ${name}`);
      } else {
        // Global mode: add to customCommands
        const newItem: CommandItem = {
          id: crypto.randomUUID(),
          name,
          command,
          icon: icon ?? DEFAULT_ICON,
          type: "custom",
          scope: "global",
          addedAt: Date.now(),
          scriptLines: extra?.scriptLines,
          executionMode: extra?.executionMode,
        };
        const updated = [...customCommands, newItem];
        setCustomCommands(updated);
        await store?.set(CUSTOM_COMMANDS_KEY, updated);
        toast.success(`已添加指令: ${name}`);
      }
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, store]
  );

  // Update command (supports both global and project-level modes)
  const updateCommand = useCallback(
    async (
      id: string,
      data: {
        name: string;
        command: string;
        icon: string;
        scriptLines?: string;
        executionMode?: "strict" | "lenient" | "batch";
      },
    ) => {
      if (commandMode === "project" && selectedId) {
        // Project-level mode
        const projectCmds = projectCommandsMap[selectedId] ?? [];
        const idx = projectCmds.findIndex((c) => c.id === id);
        if (idx === -1) return;
        const updatedItem: CommandItem = {
          ...projectCmds[idx],
          name: data.name,
          command: data.command,
          icon: data.icon,
          scriptLines: data.scriptLines,
          executionMode: data.executionMode,
        };
        const updated = projectCmds.map((c) => (c.id === id ? updatedItem : c));
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await store?.set(projectCommandsKey(selectedId), updated);
        toast.success(`已保存指令: ${data.name}`);
      } else {
        // Global mode
        const idx = customCommands.findIndex((c) => c.id === id);
        if (idx === -1) return;
        const updatedItem: CommandItem = {
          ...customCommands[idx],
          name: data.name,
          command: data.command,
          icon: data.icon,
          scriptLines: data.scriptLines,
          executionMode: data.executionMode,
        };
        const updated = customCommands.map((c) =>
          c.id === id ? updatedItem : c
        );
        setCustomCommands(updated);
        await store?.set(CUSTOM_COMMANDS_KEY, updated);
        toast.success(`已保存指令: ${data.name}`);
      }
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, store]
  );

  // Delete command (supports both modes + auto-revert per D-10)
  const deleteCommand = useCallback(
    async (id: string) => {
      if (commandMode === "project" && selectedId) {
        // Project-level mode
        const projectCmds = projectCommandsMap[selectedId] ?? [];
        const target = projectCmds.find((c) => c.id === id);
        if (!target) return;
        const updated = projectCmds.filter((c) => c.id !== id);

        if (updated.length === 0) {
          // D-10: auto-revert to global mode when last command deleted
          setProjectCommandsMap((prev) => {
            const next = { ...prev };
            delete next[selectedId];
            return next;
          });
          await store?.delete(projectCommandsKey(selectedId));
          await store?.save();
          setCommandMode("global");
        } else {
          setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
          await store?.set(projectCommandsKey(selectedId), updated);
          await store?.save();
        }
        toast.success(`已删除指令: ${target.name}`);
      } else {
        // Global mode
        const target = customCommands.find((c) => c.id === id);
        if (!target) return;
        const updated = customCommands.filter((c) => c.id !== id);
        setCustomCommands(updated);
        await store?.set(CUSTOM_COMMANDS_KEY, updated);
        await store?.save();
        toast.success(`已删除指令: ${target.name}`);
      }
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, store]
  );

  // --- Phase 18: Unified shortcut binding management ---

  // Set a shortcut binding for an action, with full conflict detection
  const setShortcutBinding = useCallback(
    async (actionId: string, shortcut: string) => {
      const conflictId = findConflict(shortcutBindings, actionId, shortcut);
      if (conflictId) {
        return conflictId; // Return conflicting actionId for UI to show warning
      }
      const updated = { ...shortcutBindings, [actionId]: shortcut };
      setShortcutBindings(updated);
      await store?.set(SHORTCUT_BINDINGS_KEY, updated);
      return null; // No conflict
    },
    [shortcutBindings, store],
  );

  // Clear a shortcut binding for an action
  const clearShortcutBinding = useCallback(
    async (actionId: string) => {
      const updated = { ...shortcutBindings };
      delete updated[actionId];
      setShortcutBindings(updated);
      await store?.set(SHORTCUT_BINDINGS_KEY, updated);
    },
    [shortcutBindings, store],
  );

  // Reset all shortcut bindings
  const resetAllShortcuts = useCallback(async () => {
    setShortcutBindings({});
    await store?.set(SHORTCUT_BINDINGS_KEY, {});
  }, [store]);

  // --- Phase 11: Shortcut assignment (legacy, preserved for transition) ---

  // Assign a global shortcut to a command (project, custom, or preset)
  const assignShortcut = useCallback(
    async (commandId: string, shortcut: string) => {
      // Check for within-app conflict across current project's commands
      const conflict = commands.find(
        (c) => c.shortcut === shortcut && c.id !== commandId
      );
      if (conflict) {
        toast.error("快捷键冲突", {
          description: `快捷键 ${shortcutToDisplay(shortcut)} 已被指令 "${conflict.name}" 使用`,
        });
        return false;
      }

      if (commandMode === "project" && selectedId) {
        const updated = (projectCommandsMap[selectedId] ?? []).map((c) =>
          c.id === commandId ? { ...c, shortcut } : c
        );
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await store?.set(projectCommandsKey(selectedId), updated);
      } else if (customCommands.some((c) => c.id === commandId)) {
        const updated = customCommands.map((c) =>
          c.id === commandId ? { ...c, shortcut } : c
        );
        setCustomCommands(updated);
        await store?.set(CUSTOM_COMMANDS_KEY, updated);
      } else {
        // Preset command: store in presetShortcutsMap
        const updatedMap = { ...presetShortcutsMap, [commandId]: shortcut };
        setPresetShortcutsMap(updatedMap);
        await store?.set(PRESHORTCUTS_KEY, updatedMap);
      }
      toast.success(`已绑定快捷键: ${shortcutToDisplay(shortcut)}`);
      return true;
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, store, commands, presetShortcutsMap]
  );

  // Clear a shortcut binding from a command
  const clearShortcut = useCallback(
    async (commandId: string) => {
      if (commandMode === "project" && selectedId) {
        const updated = (projectCommandsMap[selectedId] ?? []).map((c) =>
          c.id === commandId ? { ...c, shortcut: undefined } : c
        );
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await store?.set(projectCommandsKey(selectedId), updated);
      } else if (customCommands.some((c) => c.id === commandId)) {
        const updated = customCommands.map((c) =>
          c.id === commandId ? { ...c, shortcut: undefined } : c
        );
        setCustomCommands(updated);
        await store?.set(CUSTOM_COMMANDS_KEY, updated);
      } else if (presetShortcutsMap[commandId]) {
        const updatedMap = { ...presetShortcutsMap };
        delete updatedMap[commandId];
        setPresetShortcutsMap(updatedMap);
        await store?.set(PRESHORTCUTS_KEY, updatedMap);
      }
      toast.success("已清除快捷键");
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, store, presetShortcutsMap]
  );

  // --- Project-level command set management ---

  // Enable project-level commands: reuse existing set or create from presets (per D-08, D-22)
  const enableProjectCommands = useCallback(async () => {
    if (!selectedId) return;
    const existing = projectCommandsMap[selectedId];
    if (existing && existing.length > 0) {
      setCommandMode("project");
      return;
    }
    const presets = getDefaultsAsCommandItems();
    const projectCmds: CommandItem[] = presets.map((p, idx) => ({
      ...p,
      id: crypto.randomUUID(),
      scope: "project" as const,
      addedAt: idx,
    }));
    setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: projectCmds }));
    await store?.set(projectCommandsKey(selectedId), projectCmds);
    setCommandMode("project");
    setEditMode(true); // per D-22: auto-enter edit mode
    toast.success("已创建项目指令集，请配置指令");
  }, [selectedId, store, projectCommandsMap]);

  // Switch to global mode: pure view toggle, preserve project command data
  const disableProjectCommands = useCallback(async () => {
    setCommandMode("global");
  }, []);

  // Phase 5 Plan 01: update project icon and color
  const updateProjectStyle = useCallback(
    async (projectId: string, style: { icon?: string; color?: string }) => {
      const updated = projects.map((p) =>
        p.id === projectId ? { ...p, ...style } : p
      );
      setProjects(updated);
      await store?.set(PROJECTS_KEY, updated);
      toast.success("已更新项目样式");
    },
    [projects, store]
  );

  // Phase 5 Plan 02: reorder projects via drag-and-drop
  const reorderProjects = useCallback(
    async (reordered: ProjectItem[]) => {
      setProjects(reordered);
      await store?.set(PROJECTS_KEY, reordered);
    },
    [store]
  );

  // Phase 9: open project folder in Windows Explorer (per D-04)
  const openFolder = useCallback(async (path: string) => {
    try {
      await invoke("open_folder", { path });
    } catch (error) {
      toast.error("无法打开文件夹", {
        description: "路径无效或文件夹不存在",
      });
    }
  }, []);

  return {
    // Legacy interface (backward compatible until Plan 02 migration)
    currentProject, // ProjectItem | null (compatible with old Project | null)
    selectFolder, // () => Promise<void>
    executeCommand, // (shellCommand: string) => Promise<boolean>

    // New multi-project interface
    projects, // ProjectItem[]
    selectedId, // string | null
    loading, // boolean
    addProject, // (path: string, name: string) => Promise<void>
    removeProject, // (id: string) => Promise<void>
    selectProject, // (id: string) => Promise<void>

    // Command CRUD interface
    commands, // CommandItem[]
    addCommand, // (name, command, icon?, scope?, extra?) => Promise<void>
    updateCommand, // (id, data: { name, command, icon, scriptLines?, executionMode? }) => Promise<void>
    deleteCommand, // (id: string) => Promise<void>

    // Phase 17: script command execution (dispatches single-line or multi-line)
    executeScriptCommand, // (cmd: CommandItem) => Promise<boolean>

    // Phase 11: shortcut assignment (legacy, preserved for transition)
    assignShortcut, // (commandId: string, shortcut: string) => Promise<boolean>
    clearShortcut, // (commandId: string) => Promise<void>

    // Phase 18: unified shortcut bindings
    shortcutBindings,    // Record<string, string>
    setShortcutBinding,  // (actionId: string, shortcut: string) => Promise<string | null>
    clearShortcutBinding, // (actionId: string) => Promise<void>
    resetAllShortcuts,   // () => Promise<void>

    // Phase 4 Plan 03: project-level command override
    commandMode, // 'global' | 'project'
    editMode, // boolean
    setEditMode, // (editMode: boolean) => void
    enableProjectCommands, // () => Promise<void>
    disableProjectCommands, // () => Promise<void>

    // Phase 5 Plan 01: project icon & color
    updateProjectStyle, // (projectId: string, style: { icon?: string; color?: string }) => Promise<void>

    // Phase 5 Plan 02: drag-and-drop reorder
    reorderProjects, // (reordered: ProjectItem[]) => Promise<void>

    // Phase 8: project info
    projectInfo,           // ProjectInfoResult | null
    projectInfoLoading,    // boolean
    projectInfoError,      // boolean

    // Phase 9: project-level command map + open folder
    projectCommandsMap,    // Record<string, CommandItem[]>
    openFolder,            // (path: string) => Promise<void>

    // Phase 12: expose store for tray settings persistence
    store,                 // Store | null
  };
}
