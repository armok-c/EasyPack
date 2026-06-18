import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import type { CommandItem, Environment, ProfileMeta, ProfileExportData } from "@/lib/types";
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

// Phase 23: environment storage keys (per D-02)
function projectEnvsKey(projectId: string): string {
  return `projectEnvs:${projectId}`;
}
function projectActiveEnvKey(projectId: string): string {
  return `projectActiveEnv:${projectId}`;
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

  // Phase 20: 双 store 架构
  const [mainStore, setMainStore] = useState<Store | null>(null);
  const [profileStore, setProfileStore] = useState<Store | null>(null);
  const [profileMetas, setProfileMetas] = useState<ProfileMeta[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileSwitching, setProfileSwitching] = useState(false);
  const switchingProfileRef = useRef(false);

  // Phase 4 Plan 03: project-level command override
  const [projectCommandsMap, setProjectCommandsMap] = useState<Record<string, CommandItem[]>>({});
  // Phase 23: environment state per project (per D-01, D-02)
  const [projectEnvsMap, setProjectEnvsMap] = useState<Record<string, Environment[]>>({});
  const [projectActiveEnvMap, setProjectActiveEnvMap] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);

  // Phase 11: preset shortcut overrides (persisted separately since presets are derived fresh)
  const [presetShortcutsMap, setPresetShortcutsMap] = useState<Record<string, string>>({});
  const PRESHORTCUTS_KEY = "presetShortcuts";

  // Phase 18: unified shortcut bindings (independent store key)
  const [shortcutBindings, setShortcutBindings] = useState<Record<string, string>>({});
  const shortcutBindingsRef = useRef(shortcutBindings);
  shortcutBindingsRef.current = shortcutBindings;

  // Phase 8: project info (folder size + Git branch)
  const [projectInfo, setProjectInfo] = useState<ProjectInfoResult | null>(null);
  const [projectInfoLoading, setProjectInfoLoading] = useState(false);
  const [projectInfoError, setProjectInfoError] = useState(false);

  // Derived state: current project from projects + selectedId
  const currentProject = useMemo(
    () => selectedId ? projects.find((p) => p.id === selectedId) ?? null : null,
    [selectedId, projects]
  );

  // Commands derived from projectCommandsMap only (Phase 22: no global mode)
  const commands = useMemo(() => {
    if (!selectedId) return [];
    const projectCmds = projectCommandsMap[selectedId];
    if (!projectCmds || projectCmds.length === 0) return [];
    const injectBinding = (cmd: CommandItem) => {
      const bindingKey = `command.${cmd.id}`;
      if (shortcutBindings[bindingKey]) {
        return { ...cmd, shortcut: shortcutBindings[bindingKey] };
      }
      return cmd;
    };
    return [...projectCmds].map(injectBinding).sort((a, b) => a.addedAt - b.addedAt);
  }, [selectedId, projectCommandsMap, shortcutBindings]);


  // Phase 8: fetch project info (folder size + Git branch) per D-04
  // Must be declared before loadProfileDataIntoState (dependency)
  const fetchProjectInfo = useCallback(async (projectPath: string) => {
    setProjectInfoLoading(true);
    setProjectInfoError(false);
    setProjectInfo(null);
    try {
      const result = await Promise.race([
        invoke<ProjectInfoResult>("get_project_info", { projectPath }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000)
        ),
      ]);
      setProjectInfo(result);
    } catch {
      setProjectInfoError(true);
    } finally {
      setProjectInfoLoading(false);
    }
  }, []);

  // Phase 20: 从 profile store 加载数据到 React state
  const loadProfileDataIntoState = useCallback(async (s: Store) => {
    const savedProjects = await s.get<ProjectItem[]>(PROJECTS_KEY);
    const savedSelectedId = await s.get<string>(SELECTED_KEY);
    if (savedProjects) setProjects(savedProjects);
    else setProjects([]);
    if (savedSelectedId) setSelectedId(savedSelectedId);
    else setSelectedId(null);

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
      const keysToMigrate = [PROJECTS_KEY, SELECTED_KEY, PRESHORTCUTS_KEY, SHORTCUT_BINDINGS_KEY];
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
        for (const key of allKeys) {
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

  // Phase 20: 切换 Profile（含并发安全 + loading 态管理 per D-24/D-25）
  const switchProfile = useCallback(async (id: string) => {
    if (!mainStore) return;
    if (switchingProfileRef.current) return; // 并发安全 per D-24
    if (id === activeProfileId) return;       // 跳过重复切换

    switchingProfileRef.current = true;
    setProfileSwitching(true);

    try {
      // 1. 更新主 store 的 activeProfileId
      await mainStore.set(ACTIVE_PROFILE_KEY, id);
      await mainStore.save();

      // 2. 加载新 profile store
      const ps = await load(profileStorePath(id), { autoSave: 100, defaults: {} });

      // 3. 批量重置所有 React state per D-04/D-05
      setEditMode(false);
      await loadProfileDataIntoState(ps);

      // 4. 更新 profileStore 引用
      setProfileStore(ps);
      // 5. 同步更新 store 引用（供 useRecentCommands 等）
      setStore(ps);
      // 6. 更新 activeProfileId
      setActiveProfileId(id);
      // 7. 重置 project info
      setProjectInfo(null);
    } finally {
      switchingProfileRef.current = false;
      setProfileSwitching(false);
    }
  }, [mainStore, activeProfileId, loadProfileDataIntoState]);

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

        // Phase 22: 检测并清理旧全局指令数据（CUSTOM_COMMANDS_KEY）
        // D-02: 启动时一次性检测并删除旧数据，toast 通知用户
        const oldCustomCmds = await ps.get<CommandItem[]>(CUSTOM_COMMANDS_KEY);
        if (oldCustomCmds && oldCustomCmds.length > 0) {
          await ps.delete(CUSTOM_COMMANDS_KEY);
          await ps.save();
          toast.info("全局指令已移除，请使用项目环境添加指令");
        }

        setProfileStore(ps);
        // 保持 store 引用指向 profileStore（供 useRecentCommands 等使用）
        setStore(ps);
      } catch (error) {
        if (import.meta.env.DEV) console.warn("Store 加载失败，使用内存模式:", error);
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
    [profileStore, projects, fetchProjectInfo, projectCommandsMap]
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
      if (import.meta.env.DEV) console.error("文件夹选择失败:", error);
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

  // Add command to project-level set (Phase 22: no scope parameter, no global branch)
  const addCommand = useCallback(
    async (
      name: string,
      command: string,
      icon?: string,
      extra?: { scriptLines?: string; executionMode?: "strict" | "lenient" | "batch" },
    ) => {
      if (!selectedId) {
        toast.error("请先选择一个项目");
        return;
      }
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
      const current = projectCommandsMap[selectedId] ?? [];
      const updated = [...current, newItem];
      setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
      await profileStore?.set(projectCommandsKey(selectedId), updated);
      await profileStore?.save();
      toast.success(`已添加指令: ${name}`);
    },
    [selectedId, projectCommandsMap, profileStore]
  );

  // Update command in projectCommandsMap (Phase 22: no global branch)
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
      if (!selectedId) return;
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
    },
    [selectedId, projectCommandsMap, profileStore]
  );

  // Delete command from projectCommandsMap (Phase 22: no global branch)
  const deleteCommand = useCallback(
    async (id: string) => {
      if (!selectedId) return;
      const projectCmds = projectCommandsMap[selectedId] ?? [];
      const target = projectCmds.find((c) => c.id === id);
      if (!target) return;
      const updated = projectCmds.filter((c) => c.id !== id);

      if (updated.length === 0) {
        // Remove empty project entry from map
        setProjectCommandsMap((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
        await profileStore?.delete(projectCommandsKey(selectedId));
        await profileStore?.save();
      } else {
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await profileStore?.set(projectCommandsKey(selectedId), updated);
        await profileStore?.save();
      }
      toast.success(`已删除指令: ${target.name}`);
    },
    [selectedId, projectCommandsMap, profileStore]
  );

  // --- Phase 23: Environment CRUD management ---

  // Create a new environment for a project (per D-20: unique name check)
  const createEnv = useCallback(
    async (projectId: string, name: string): Promise<string | null> => {
      const pid = projectId || selectedId;
      if (!pid) {
        toast.error("请先选择一个项目");
        return null;
      }
      if (!name.trim()) {
        toast.error("环境名称不能为空");
        return null;
      }
      const existing = projectEnvsMap[pid] ?? [];
      if (existing.some((e) => e.name === name)) {
        toast.error("环境名称已存在");
        return null;
      }
      const newEnv: Environment = {
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        files: [],
      };
      const updated = [...existing, newEnv];
      setProjectEnvsMap((prev) => ({ ...prev, [pid]: updated }));
      await profileStore?.set(projectEnvsKey(pid), updated);
      await profileStore?.save();
      toast.success(`已创建环境: ${name}`);
      return newEnv.id;
    },
    [selectedId, projectEnvsMap, profileStore]
  );

  // Rename an environment (per D-20: unique name check excluding self)
  const renameEnv = useCallback(
    async (projectId: string, envId: string, newName: string) => {
      if (!newName.trim()) {
        toast.error("环境名称不能为空");
        return;
      }
      const existing = projectEnvsMap[projectId] ?? [];
      const hasDuplicate = existing.some((e) => e.id !== envId && e.name === newName);
      if (hasDuplicate) {
        toast.error("环境名称已存在");
        return;
      }
      const updated = existing.map((e) =>
        e.id === envId ? { ...e, name: newName.trim(), updatedAt: Date.now() } : e
      );
      setProjectEnvsMap((prev) => ({ ...prev, [projectId]: updated }));
      await profileStore?.set(projectEnvsKey(projectId), updated);
      await profileStore?.save();
      toast.success(`已重命名环境: ${newName}`);
    },
    [projectEnvsMap, profileStore]
  );

  // Delete an environment (per D-21, D-18)
  const deleteEnv = useCallback(
    async (projectId: string, envId: string) => {
      const existing = projectEnvsMap[projectId] ?? [];
      const target = existing.find((e) => e.id === envId);
      if (!target) return;
      const updated = existing.filter((e) => e.id !== envId);

      if (updated.length === 0) {
        // Remove empty project entry from map
        setProjectEnvsMap((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
        await profileStore?.delete(projectEnvsKey(projectId));
      } else {
        setProjectEnvsMap((prev) => ({ ...prev, [projectId]: updated }));
        await profileStore?.set(projectEnvsKey(projectId), updated);
      }

      // If deleted env was the active env, clear active env
      if (projectActiveEnvMap[projectId] === envId) {
        await setActiveEnv(projectId, null);
      }

      await profileStore?.save();
      toast.success(`已删除环境: ${target.name}`);
    },
    [projectEnvsMap, projectActiveEnvMap, profileStore, setActiveEnv]
  );

  // Set or clear the active environment for a project (per D-14)
  const setActiveEnv = useCallback(
    async (projectId: string, envId: string | null) => {
      if (envId === null) {
        setProjectActiveEnvMap((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
        await profileStore?.delete(projectActiveEnvKey(projectId));
      } else {
        setProjectActiveEnvMap((prev) => ({ ...prev, [projectId]: envId }));
        await profileStore?.set(projectActiveEnvKey(projectId), envId);
      }
      await profileStore?.save();
    },
    [profileStore]
  );

  // Apply an environment: write all managed files to the project directory (per D-26, D-27, D-28, D-30)
  const applyEnv = useCallback(
    async (projectId: string, envId: string): Promise<boolean> => {
      const envs = projectEnvsMap[projectId] ?? [];
      const env = envs.find((e) => e.id === envId);
      if (!env) {
        toast.error("环境不存在");
        return false;
      }
      if (!currentProject) {
        toast.error("请先选择一个项目");
        return false;
      }

      const projectPath = currentProject.path;
      const writtenFiles: string[] = [];

      for (const file of env.files) {
        try {
          await invoke("write_file_content", {
            projectPath,
            fileName: file.name,
            content: file.content,
          });
          writtenFiles.push(file.name);
        } catch (error) {
          // Write failed — attempt rollback of previously written files (best-effort per D-28)
          let rollbackFailed = false;
          for (const writtenName of writtenFiles) {
            try {
              await invoke("write_file_content", {
                projectPath,
                fileName: writtenName,
                content: "",
              });
            } catch {
              rollbackFailed = true;
            }
          }
          if (rollbackFailed) {
            toast.error(`启用失败，部分文件已写入：${writtenFiles.join(", ")}`);
          } else {
            toast.error(`启用失败: ${error}`);
          }
          return false;
        }
      }

      // All files written successfully
      await setActiveEnv(projectId, envId);
      toast.success(`已启用环境: ${env.name}`);
      return true;
    },
    [projectEnvsMap, currentProject, setActiveEnv]
  );

  // Convenience getter: get all environments for a project
  const getProjectEnvs = useCallback(
    (projectId: string): Environment[] => {
      return projectEnvsMap[projectId] ?? [];
    },
    [projectEnvsMap]
  );

  // Convenience getter: get active environment ID for a project
  const getProjectActiveEnv = useCallback(
    (projectId: string): string | null => {
      return projectActiveEnvMap[projectId] ?? null;
    },
    [projectActiveEnvMap]
  );

  // --- Phase 18: Unified shortcut binding management ---

  // Set a shortcut binding for an action, with full conflict detection
  const setShortcutBinding = useCallback(
    async (actionId: string, shortcut: string, skipConflictFor?: string[]) => {
      const current = shortcutBindingsRef.current;
      const conflictId = findConflict(current, actionId, shortcut, skipConflictFor);
      if (conflictId) {
        return conflictId;
      }
      const updated = { ...current, [actionId]: shortcut };
      shortcutBindingsRef.current = updated;
      setShortcutBindings(updated);
      await profileStore?.set(SHORTCUT_BINDINGS_KEY, updated);
      return null;
    },
    [profileStore],
  );

  // Clear a shortcut binding for an action
  const clearShortcutBinding = useCallback(
    async (actionId: string) => {
      const current = shortcutBindingsRef.current;
      const updated = { ...current };
      delete updated[actionId];
      shortcutBindingsRef.current = updated;
      setShortcutBindings(updated);
      await profileStore?.set(SHORTCUT_BINDINGS_KEY, updated);
    },
    [profileStore],
  );

  // Reset all shortcut bindings
  const resetAllShortcuts = useCallback(async () => {
    shortcutBindingsRef.current = {};
    setShortcutBindings({});
    await profileStore?.set(SHORTCUT_BINDINGS_KEY, {});
  }, [profileStore]);

  // --- Phase 11: Shortcut assignment (@deprecated — use setShortcutBinding/clearShortcutBinding instead) ---

  // Assign a shortcut to a command (Phase 22: only projectCommandsMap)
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

      if (!selectedId) return false;
      const updated = (projectCommandsMap[selectedId] ?? []).map((c) =>
        c.id === commandId ? { ...c, shortcut } : c
      );
      setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
      await profileStore?.set(projectCommandsKey(selectedId), updated);
      toast.success(`已绑定快捷键: ${shortcutToDisplay(shortcut)}`);
      return true;
    },
    [selectedId, projectCommandsMap, profileStore, commands]
  );

  // Clear a shortcut binding from a command (Phase 22: only projectCommandsMap)
  const clearShortcut = useCallback(
    async (commandId: string) => {
      if (!selectedId) return;
      const updated = (projectCommandsMap[selectedId] ?? []).map((c) =>
        c.id === commandId ? { ...c, shortcut: undefined } : c
      );
      setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
      await profileStore?.set(projectCommandsKey(selectedId), updated);
      toast.success("已清除快捷键");
    },
    [selectedId, projectCommandsMap, profileStore]
  );

  // --- Project-level command set management ---

  // Enable project-level commands: init empty set and enter edit mode (Phase 22: no defaults)
  const enableProjectCommands = useCallback(async () => {
    if (!selectedId) return;
    const existing = projectCommandsMap[selectedId];
    if (existing && existing.length > 0) {
      setEditMode(true);
      return;
    }
    // Initialize empty project command set
    setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: [] }));
    await profileStore?.set(projectCommandsKey(selectedId), []);
    setEditMode(true);
    toast.success("请添加项目指令");
  }, [selectedId, profileStore, projectCommandsMap]);

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

  // --- Phase 20: Profile CRUD ---

  // 创建新 profile + 自动切换
  const createProfile = useCallback(async (name: string) => {
    if (!mainStore) return;
    const id = crypto.randomUUID();
    const meta: ProfileMeta = { id, name, createdAt: Date.now() };
    const updated = [...profileMetas, meta];
    // 创建空的 profile store 文件
    const ps = await load(profileStorePath(id), { autoSave: 100, defaults: {} });
    await ps.save();
    // 更新主 store
    await mainStore.set(PROFILES_KEY, updated);
    await mainStore.save();
    setProfileMetas(updated);
    // 自动切换到新 profile（回滚 on failure）
    try {
      await switchProfile(id);
    } catch (error) {
      toast.error("切换到新配置失败");
      if (import.meta.env.DEV) console.error("switchProfile failed after create:", error);
    }
  }, [mainStore, profileMetas, switchProfile]);

  // 删除 profile（不允许删除最后一个）
  const deleteProfile = useCallback(async (id: string) => {
    if (!mainStore) return;
    if (profileMetas.length <= 1) {
      toast.error("至少需要保留一个配置文件");
      return;
    }
    const updated = profileMetas.filter((p) => p.id !== id);
    await mainStore.set(PROFILES_KEY, updated);
    await mainStore.save();
    setProfileMetas(updated);
    // 如果删除的是当前活跃 profile，自动切换到第一个
    if (id === activeProfileId && updated.length > 0) {
      await switchProfile(updated[0].id);
    }
  }, [mainStore, profileMetas, activeProfileId, switchProfile]);

  // 重命名 profile（仅更新主 store 的 metas）
  const renameProfile = useCallback(async (id: string, newName: string) => {
    if (!mainStore) return;
    const updated = profileMetas.map((p) =>
      p.id === id ? { ...p, name: newName } : p
    );
    await mainStore.set(PROFILES_KEY, updated);
    await mainStore.save();
    setProfileMetas(updated);
  }, [mainStore, profileMetas]);

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

  // --- Phase 20: Profile import/export ---

  // 导出当前 profile 为 JSON 文件 (per D-16/D-20)
  const exportProfile = useCallback(async (filePath: string) => {
    if (!profileStore || !activeProfileId) return;
    try {
      const profileName = profileMetas.find((p) => p.id === activeProfileId)?.name ?? "unknown";

      // 收集 projectCommands:* 条目
      const allKeys = await (profileStore as unknown as { keys: () => Promise<string[]> }).keys();
      const projectCommands: Record<string, unknown> = {};
      for (const key of allKeys) {
        if (key.startsWith("projectCommands:")) {
          const val = await profileStore.get(key);
          projectCommands[key.replace("projectCommands:", "")] = val;
        }
      }

      const exportData: ProfileExportData = {
        formatVersion: 1,
        profileName,
        exportedAt: new Date().toISOString(),
        data: {
          projects: await profileStore.get(PROJECTS_KEY),
          selectedProjectId: await profileStore.get(SELECTED_KEY),
          customCommands: await profileStore.get(CUSTOM_COMMANDS_KEY),
          projectCommands,
          shortcutBindings: await profileStore.get(SHORTCUT_BINDINGS_KEY),
          presetShortcuts: await profileStore.get(PRESHORTCUTS_KEY),
          recentCommands: await profileStore.get("recentCommands"),
        },
      };

      await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
      toast.success(`已导出配置: ${profileName}`);
    } catch (error) {
      toast.error("导出失败", {
        description: String(error),
      });
    }
  }, [profileStore, activeProfileId, profileMetas]);

  // 导入 JSON 文件为新的 profile (per D-17/D-21/D-22)
  const importProfile = useCallback(async (filePath: string) => {
    if (!mainStore) return;
    try {
      const content = await readTextFile(filePath);
      const parsed = JSON.parse(content);

      // 校验 formatVersion per D-21/D-22
      if (parsed.formatVersion !== 1) {
        toast.error("配置文件格式不兼容或已损坏");
        return;
      }
      if (!parsed.data || typeof parsed.data !== "object") {
        toast.error("配置文件格式不兼容或已损坏");
        return;
      }

      const { data } = parsed;

      // 基本结构校验
      if (data.projects && !Array.isArray(data.projects)) {
        toast.error("配置文件损坏：projects 不是数组");
        return;
      }
      if (data.customCommands && !Array.isArray(data.customCommands)) {
        toast.error("配置文件损坏：customCommands 不是数组");
        return;
      }
      if (data.shortcutBindings && typeof data.shortcutBindings !== "object") {
        toast.error("配置文件损坏：shortcutBindings 格式错误");
        return;
      }
      if (data.projectCommands && typeof data.projectCommands !== "object") {
        toast.error("配置文件损坏：projectCommands 格式错误");
        return;
      }

      // 创建新 profile
      const id = crypto.randomUUID();
      const profileName = parsed.profileName ?? `导入配置`;
      const meta: ProfileMeta = { id, name: profileName, createdAt: Date.now() };
      const updatedMetas = [...profileMetas, meta];

      // 创建新 profile store 并写入数据
      const ps = await load(profileStorePath(id), { autoSave: 100, defaults: {} });
      if (data.projects) await ps.set(PROJECTS_KEY, data.projects);
      if (data.selectedProjectId !== undefined) await ps.set(SELECTED_KEY, data.selectedProjectId);
      if (data.customCommands) await ps.set(CUSTOM_COMMANDS_KEY, data.customCommands);
      if (data.shortcutBindings) await ps.set(SHORTCUT_BINDINGS_KEY, data.shortcutBindings);
      if (data.presetShortcuts) await ps.set(PRESHORTCUTS_KEY, data.presetShortcuts);
      if (data.recentCommands) await ps.set("recentCommands", data.recentCommands);

      if (data.projectCommands && typeof data.projectCommands === "object") {
        for (const [projectId, cmds] of Object.entries(data.projectCommands)) {
          await ps.set(projectCommandsKey(projectId), cmds);
        }
      }

      await ps.save();

      // 更新主 store 的 metas
      await mainStore.set(PROFILES_KEY, updatedMetas);
      await mainStore.save();
      setProfileMetas(updatedMetas);

      // 切换到新 profile
      await switchProfile(id);
      toast.success(`已导入配置: ${profileName}`);
    } catch (error) {
      toast.error("导入失败", {
        description: String(error),
      });
    }
  }, [mainStore, profileMetas, switchProfile]);

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
    addCommand, // (name, command, icon?, extra?) => Promise<void>
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

    // Phase 4 Plan 03: project-level command override (commandMode removed in Phase 22)
    editMode, // boolean
    setEditMode, // (editMode: boolean) => void
    enableProjectCommands, // () => Promise<void>

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
    switchProfile,         // (id: string) => Promise<void>
    createProfile,         // (name: string) => Promise<void>
    deleteProfile,         // (id: string) => Promise<void>
    renameProfile,         // (id: string, newName: string) => Promise<void>
    exportProfile,         // (filePath: string) => Promise<void>
    importProfile,         // (filePath: string) => Promise<void>
  };
}
