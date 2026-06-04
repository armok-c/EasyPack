import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { CommandItem, ProfileMeta, ProfileExportData } from "@/lib/types";
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

// Phase 20: Profile store 架构常量
const PROFILE_STORE_PREFIX = "profile-";
const PROFILES_KEY = "profiles";
const ACTIVE_PROFILE_KEY = "activeProfileId";
const MIGRATION_DONE_KEY = "profileMigrationDone";

function projectCommandsKey(projectId: string): string {
  return `projectCommands:${projectId}`;
}

function profileStorePath(id: string): string {
  return `${PROFILE_STORE_PREFIX}${id}.json`;
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

  // Phase 20: 双 store 架构
  const [mainStore, setMainStore] = useState<Store | null>(null);
  const [profileStore, setProfileStore] = useState<Store | null>(null);
  const [profileMetas, setProfileMetas] = useState<ProfileMeta[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileSwitching, setProfileSwitching] = useState(false);
  const switchingProfileRef = useRef(false);

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

  // Phase 20: 从 profile store 加载数据到 React state
  const loadProfileDataIntoState = useCallback(async (s: Store) => {
    const savedProjects = await s.get<ProjectItem[]>(PROJECTS_KEY);
    const savedSelectedId = await s.get<string>(SELECTED_KEY);
    const savedCommands = await s.get<CommandItem[]>(CUSTOM_COMMANDS_KEY);
    if (savedProjects) setProjects(savedProjects);
    else setProjects([]);
    if (savedSelectedId) setSelectedId(savedSelectedId);
    else setSelectedId(null);
    if (savedCommands) setCustomCommands(savedCommands);
    else setCustomCommands([]);

    // Restore project-level command data
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
    setProjectCommandsMap(map);

    // Restore preset shortcut overrides
    const savedPresetShortcuts = await s.get<Record<string, string>>(PRESHORTCUTS_KEY);
    if (savedPresetShortcuts) setPresetShortcutsMap(savedPresetShortcuts);
    else setPresetShortcutsMap({});

    // Restore shortcut bindings
    const savedBindings = await s.get<Record<string, string>>(SHORTCUT_BINDINGS_KEY);
    if (savedBindings && Object.keys(savedBindings).length > 0) {
      setShortcutBindings(savedBindings);
    } else {
      setShortcutBindings({});
    }

    // Fetch project info for selected project
    if (savedSelectedId && savedProjects) {
      const savedProject = savedProjects.find((p: ProjectItem) => p.id === savedSelectedId);
      if (savedProject) {
        fetchProjectInfo(savedProject.path);
      }
    }
  }, [fetchProjectInfo]);

  // Phase 20: 迁移旧数据到 profile 架构（幂等）
  const migrateToProfiles = useCallback(async (ms: Store): Promise<{ metas: ProfileMeta[]; activeId: string }> => {
    const migrationDone = await ms.get<boolean>(MIGRATION_DONE_KEY);
    if (migrationDone) {
      // 已迁移，从主 store 读取 profile 信息
      const metas = await ms.get<ProfileMeta[]>(PROFILES_KEY) ?? [];
      const activeId = await ms.get<string>(ACTIVE_PROFILE_KEY) ?? metas[0]?.id ?? "";
      return { metas, activeId };
    }

    const id = crypto.randomUUID();
    const meta: ProfileMeta = { id, name: "默认", createdAt: Date.now() };
    const metas = [meta];

    // 检查是否有旧数据需要迁移
    const oldProjects = await ms.get<ProjectItem[]>(PROJECTS_KEY);

    if (oldProjects && oldProjects.length > 0) {
      // 有旧数据 → 迁移到新 profile store 文件
      const ps = await load(profileStorePath(id), { autoSave: 100, defaults: {} });

      // 迁移所有跟 profile 走的 key
      const keysToMigrate = [PROJECTS_KEY, SELECTED_KEY, CUSTOM_COMMANDS_KEY, PRESHORTCUTS_KEY, SHORTCUT_BINDINGS_KEY];
      const allKeys = await (ms as unknown as { keys: () => Promise<string[]> }).keys();

      for (const key of keysToMigrate) {
        const val = await ms.get(key);
        if (val !== undefined && val !== null) {
          await ps.set(key, val);
        }
      }

      // 迁移 projectCommands:* 条目
      for (const key of allKeys) {
        if (key.startsWith("projectCommands:")) {
          const val = await ms.get(key);
          if (val !== undefined && val !== null) {
            await ps.set(key, val);
          }
        }
      }

      await ps.save();

      // 迁移 shortcut bindings（如果旧格式存在）
      const oldBindings = await ms.get<Record<string, string>>(SHORTCUT_BINDINGS_KEY);
      if (!oldBindings || Object.keys(oldBindings).length === 0) {
        // 尝试从旧格式迁移
        const migrated: Record<string, string> = {};
        const savedCommands = await ms.get<CommandItem[]>(CUSTOM_COMMANDS_KEY);
        if (savedCommands) {
          for (const cmd of savedCommands) {
            if (cmd.shortcut) {
              migrated[`command.${cmd.id}`] = cmd.shortcut;
            }
          }
        }
        for (const key of allKeys) {
          if (!key.startsWith("projectCommands:")) continue;
          const projCmds = await ms.get<CommandItem[]>(key);
          if (projCmds) {
            for (const cmd of projCmds) {
              if (cmd.shortcut) {
                migrated[`command.${cmd.id}`] = cmd.shortcut;
              }
            }
          }
        }
        const savedPresetShortcuts = await ms.get<Record<string, string>>(PRESHORTCUTS_KEY);
        if (savedPresetShortcuts) {
          for (const [presetId, shortcut] of Object.entries(savedPresetShortcuts)) {
            migrated[`command.${presetId}`] = shortcut;
          }
        }
        if (Object.keys(migrated).length > 0) {
          await ps.set(SHORTCUT_BINDINGS_KEY, migrated);
          await ps.save();
        }
      }

      // 从主 store 删除旧数据
      for (const key of keysToMigrate) {
        await ms.delete(key);
      }
      for (const key of allKeys) {
        if (key.startsWith("projectCommands:")) {
          await ms.delete(key);
        }
      }
    } else {
      // 全新安装：创建空默认 profile
      const ps = await load(profileStorePath(id), { autoSave: 100, defaults: {} });
      await ps.save();
    }

    // 设置 profile 元信息和迁移标记
    await ms.set(PROFILES_KEY, metas);
    await ms.set(ACTIVE_PROFILE_KEY, id);
    await ms.set(MIGRATION_DONE_KEY, true);
    await ms.save();

    return { metas, activeId: id };
  }, []);

  // Initialize: load store and restore persisted data
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        // Phase 20: 先加载主 store，执行迁移，再加载 profile store
        const ms = await load(STORE_PATH, { autoSave: 100, defaults: {} });
        if (!mounted) return;

        const { metas, activeId } = await migrateToProfiles(ms);
        if (!mounted) return;

        setMainStore(ms);
        setProfileMetas(metas);
        setActiveProfileId(activeId);

        // 加载活跃 profile 数据
        const ps = await load(profileStorePath(activeId), { autoSave: 100, defaults: {} });
        if (!mounted) return;

        await loadProfileDataIntoState(ps);
        setProfileStore(ps);
        // 保持 store 引用指向 profileStore（供 useRecentCommands 等使用）
        setStore(ps);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      await profileStore?.set(PROJECTS_KEY, updated);
      await profileStore?.set(SELECTED_KEY, id);
    },
    [projects, profileStore]
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
      await profileStore?.set(PROJECTS_KEY, updated);
      await profileStore?.set(SELECTED_KEY, newSelectedId);
      // Clean up project-level command data (both store and in-memory)
      await profileStore?.delete(projectCommandsKey(id));
      setProjectCommandsMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await profileStore?.save();
    },
    [projects, selectedId, profileStore]
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
      await profileStore?.set(SELECTED_KEY, id);
      // Phase 8: fetch project info on project switch (per D-04)
      const project = projects.find((p) => p.id === id);
      if (project) {
        fetchProjectInfo(project.path);
      }
    },
    [profileStore, projects, fetchProjectInfo]
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
        await profileStore?.set(projectCommandsKey(selectedId), updated);
        await profileStore?.save();
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
        await profileStore?.set(CUSTOM_COMMANDS_KEY, updated);
        toast.success(`已添加指令: ${name}`);
      }
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, profileStore]
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
        await profileStore?.set(projectCommandsKey(selectedId), updated);
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
        await profileStore?.set(CUSTOM_COMMANDS_KEY, updated);
        toast.success(`已保存指令: ${data.name}`);
      }
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, profileStore]
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
          await profileStore?.delete(projectCommandsKey(selectedId));
          await profileStore?.save();
          setCommandMode("global");
        } else {
          setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
          await profileStore?.set(projectCommandsKey(selectedId), updated);
          await profileStore?.save();
        }
        toast.success(`已删除指令: ${target.name}`);
      } else {
        // Global mode
        const target = customCommands.find((c) => c.id === id);
        if (!target) return;
        const updated = customCommands.filter((c) => c.id !== id);
        setCustomCommands(updated);
        await profileStore?.set(CUSTOM_COMMANDS_KEY, updated);
        await profileStore?.save();
        toast.success(`已删除指令: ${target.name}`);
      }
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, profileStore]
  );

  // --- Phase 18: Unified shortcut binding management ---

  // Set a shortcut binding for an action, with full conflict detection
  const setShortcutBinding = useCallback(
    async (actionId: string, shortcut: string, skipConflictFor?: string[]) => {
      const conflictId = findConflict(shortcutBindings, actionId, shortcut, skipConflictFor);
      if (conflictId) {
        return conflictId;
      }
      const updated = { ...shortcutBindings, [actionId]: shortcut };
      setShortcutBindings(updated);
      await profileStore?.set(SHORTCUT_BINDINGS_KEY, updated);
      return null;
    },
    [shortcutBindings, profileStore],
  );

  // Clear a shortcut binding for an action
  const clearShortcutBinding = useCallback(
    async (actionId: string) => {
      const updated = { ...shortcutBindings };
      delete updated[actionId];
      setShortcutBindings(updated);
      await profileStore?.set(SHORTCUT_BINDINGS_KEY, updated);
    },
    [shortcutBindings, profileStore],
  );

  // Reset all shortcut bindings
  const resetAllShortcuts = useCallback(async () => {
    setShortcutBindings({});
    await profileStore?.set(SHORTCUT_BINDINGS_KEY, {});
  }, [profileStore]);

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
        await profileStore?.set(projectCommandsKey(selectedId), updated);
      } else if (customCommands.some((c) => c.id === commandId)) {
        const updated = customCommands.map((c) =>
          c.id === commandId ? { ...c, shortcut } : c
        );
        setCustomCommands(updated);
        await profileStore?.set(CUSTOM_COMMANDS_KEY, updated);
      } else {
        // Preset command: store in presetShortcutsMap
        const updatedMap = { ...presetShortcutsMap, [commandId]: shortcut };
        setPresetShortcutsMap(updatedMap);
        await profileStore?.set(PRESHORTCUTS_KEY, updatedMap);
      }
      toast.success(`已绑定快捷键: ${shortcutToDisplay(shortcut)}`);
      return true;
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, profileStore, commands, presetShortcutsMap]
  );

  // Clear a shortcut binding from a command
  const clearShortcut = useCallback(
    async (commandId: string) => {
      if (commandMode === "project" && selectedId) {
        const updated = (projectCommandsMap[selectedId] ?? []).map((c) =>
          c.id === commandId ? { ...c, shortcut: undefined } : c
        );
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await profileStore?.set(projectCommandsKey(selectedId), updated);
      } else if (customCommands.some((c) => c.id === commandId)) {
        const updated = customCommands.map((c) =>
          c.id === commandId ? { ...c, shortcut: undefined } : c
        );
        setCustomCommands(updated);
        await profileStore?.set(CUSTOM_COMMANDS_KEY, updated);
      } else if (presetShortcutsMap[commandId]) {
        const updatedMap = { ...presetShortcutsMap };
        delete updatedMap[commandId];
        setPresetShortcutsMap(updatedMap);
        await profileStore?.set(PRESHORTCUTS_KEY, updatedMap);
      }
      toast.success("已清除快捷键");
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, profileStore, presetShortcutsMap]
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
    await profileStore?.set(projectCommandsKey(selectedId), projectCmds);
    setCommandMode("project");
    setEditMode(true); // per D-22: auto-enter edit mode
    toast.success("已创建项目指令集，请配置指令");
  }, [selectedId, profileStore, projectCommandsMap]);

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
      await profileStore?.set(PROJECTS_KEY, updated);
      toast.success("已更新项目样式");
    },
    [projects, profileStore]
  );

  // Phase 5 Plan 02: reorder projects via drag-and-drop
  const reorderProjects = useCallback(
    async (reordered: ProjectItem[]) => {
      setProjects(reordered);
      await profileStore?.set(PROJECTS_KEY, reordered);
    },
    [profileStore]
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

    // Phase 20: Profile 管理
    mainStore,             // Store | null（全局设置读写）
    profileMetas,          // ProfileMeta[]
    activeProfileId,       // string | null
    profileSwitching,      // boolean
  };
}
