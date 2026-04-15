import { useState, useEffect, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { CommandItem } from "@/lib/types";
import { getPresetAsCommandItems } from "@/lib/presets";
import { DEFAULT_ICON } from "@/lib/icons";

export interface ProjectItem {
  id: string;       // normalized path as ID (lowercase, forward slashes)
  name: string;     // folder name (per D-03)
  path: string;     // original full path (preserves original casing)
  addedAt: number;  // Date.now() timestamp
  icon?: string;    // Phase 5: lucide icon name from ICON_OPTIONS keys, undefined means default
  color?: string;   // Phase 5: CSS hex color value from COLOR_OPTIONS, empty/undefined means no color
}

// Backward-compatible type alias (remove after Plan 02 migration)
export type Project = ProjectItem;

const STORE_PATH = "easypack-store.json";
const PROJECTS_KEY = "projects";
const SELECTED_KEY = "selectedProjectId";
const CUSTOM_COMMANDS_KEY = "customCommands";

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

  // Derived state: current project from projects + selectedId
  const currentProject = selectedId
    ? projects.find((p) => p.id === selectedId) ?? null
    : null;

  // Merged command list: project-level override or global presets + custom, sorted by addedAt
  const commands = useMemo(() => {
    if (!selectedId) return [];
    const projectCmds = projectCommandsMap[selectedId];
    if (projectCmds && projectCmds.length > 0) {
      // Project-level mode (per D-07: complete replacement)
      return [...projectCmds].sort((a, b) => a.addedAt - b.addedAt);
    }
    // Global mode: presets + global custom commands
    return [...getPresetAsCommandItems(), ...customCommands].sort(
      (a, b) => a.addedAt - b.addedAt
    );
  }, [selectedId, customCommands, projectCommandsMap]);

  // Auto-update commandMode when selectedId or projectCommandsMap changes
  useEffect(() => {
    if (!selectedId) {
      setCommandMode("global");
      return;
    }
    const projectCmds = projectCommandsMap[selectedId];
    setCommandMode(projectCmds && projectCmds.length > 0 ? "project" : "global");
  }, [selectedId, projectCommandsMap]);

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
      // Clean up project-level command data
      await store?.delete(projectCommandsKey(id));
    },
    [projects, selectedId, store]
  );

  // Select project (also exits edit mode on project switch)
  const selectProject = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setEditMode(false);
      await store?.set(SELECTED_KEY, id);
    },
    [store]
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
    async (shellCommand: string) => {
      if (!currentProject) return;
      try {
        await invoke("execute_command", {
          projectPath: currentProject.path,
          shellCommand,
        });
        toast.success(`已执行: ${shellCommand}`);
      } catch (error) {
        toast.error(
          `命令执行失败：${error}。请检查项目路径和命令是否正确。`
        );
      }
    },
    [currentProject]
  );

  // --- Command CRUD operations ---

  // Add custom command (supports both global and project-level modes)
  const addCommand = useCallback(
    async (name: string, command: string, icon?: string) => {
      if (commandMode === "project" && selectedId) {
        // Project-level mode: add to projectCommandsMap
        const newItem: CommandItem = {
          id: crypto.randomUUID(),
          name,
          command,
          icon: icon ?? DEFAULT_ICON,
          type: "custom",
          scope: "project",
          addedAt: Date.now(),
        };
        const current = projectCommandsMap[selectedId] ?? [];
        const updated = [...current, newItem];
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await store?.set(projectCommandsKey(selectedId), updated);
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
    async (id: string, data: { name: string; command: string; icon: string }) => {
      if (commandMode === "project" && selectedId) {
        // Project-level mode
        const projectCmds = projectCommandsMap[selectedId] ?? [];
        const idx = projectCmds.findIndex((c) => c.id === id);
        if (idx === -1) return;
        const updatedItem: CommandItem = { ...projectCmds[idx], ...data };
        const updated = projectCmds.map((c) => (c.id === id ? updatedItem : c));
        setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
        await store?.set(projectCommandsKey(selectedId), updated);
        toast.success(`已保存指令: ${data.name}`);
      } else {
        // Global mode
        const idx = customCommands.findIndex((c) => c.id === id);
        if (idx === -1) return;
        const updatedItem: CommandItem = { ...customCommands[idx], ...data };
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
        } else {
          setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: updated }));
          await store?.set(projectCommandsKey(selectedId), updated);
        }
        toast.success(`已删除指令: ${target.name}`);
      } else {
        // Global mode
        const target = customCommands.find((c) => c.id === id);
        if (!target) return;
        const updated = customCommands.filter((c) => c.id !== id);
        setCustomCommands(updated);
        await store?.set(CUSTOM_COMMANDS_KEY, updated);
        toast.success(`已删除指令: ${target.name}`);
      }
    },
    [commandMode, selectedId, projectCommandsMap, customCommands, store]
  );

  // --- Project-level command set management ---

  // Enable project-level commands: create set with 4 preset copies (per D-08, D-22)
  const enableProjectCommands = useCallback(async () => {
    if (!selectedId) return;
    const presets = getPresetAsCommandItems();
    // Copy presets as project-level with new IDs and scope='project'
    const projectCmds: CommandItem[] = presets.map((p, idx) => ({
      ...p,
      id: crypto.randomUUID(),
      scope: "project" as const,
      addedAt: idx,
    }));
    setProjectCommandsMap((prev) => ({ ...prev, [selectedId]: projectCmds }));
    await store?.set(projectCommandsKey(selectedId), projectCmds);
    setEditMode(true); // per D-22: auto-enter edit mode
    toast.success("已创建项目指令集，请配置指令");
  }, [selectedId, store]);

  // Disable project-level commands: remove set and revert to global
  const disableProjectCommands = useCallback(async () => {
    if (!selectedId) return;
    setProjectCommandsMap((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    await store?.delete(projectCommandsKey(selectedId));
    setCommandMode("global");
    toast.success("已切换到全局指令");
  }, [selectedId, store]);

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

  return {
    // Legacy interface (backward compatible until Plan 02 migration)
    currentProject, // ProjectItem | null (compatible with old Project | null)
    selectFolder, // () => Promise<void>
    executeCommand, // (shellCommand: string) => Promise<void>

    // New multi-project interface
    projects, // ProjectItem[]
    selectedId, // string | null
    loading, // boolean
    addProject, // (path: string, name: string) => Promise<void>
    removeProject, // (id: string) => Promise<void>
    selectProject, // (id: string) => Promise<void>

    // Command CRUD interface
    commands, // CommandItem[]
    addCommand, // (name: string, command: string, icon?: string) => Promise<void>
    updateCommand, // (id: string, data: { name: string; command: string; icon: string }) => Promise<void>
    deleteCommand, // (id: string) => Promise<void>

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
  };
}
