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

  // Derived state: current project from projects + selectedId
  const currentProject = selectedId
    ? projects.find((p) => p.id === selectedId) ?? null
    : null;

  // Merged command list: presets + custom commands, sorted by addedAt
  const commands = useMemo(() => {
    return [...getPresetAsCommandItems(), ...customCommands].sort(
      (a, b) => a.addedAt - b.addedAt
    );
  }, [customCommands]);

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

  // Select project
  const selectProject = useCallback(
    async (id: string) => {
      setSelectedId(id);
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

  // Add custom command
  const addCommand = useCallback(
    async (name: string, command: string, icon?: string) => {
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
    },
    [customCommands, store]
  );

  // Update custom command
  const updateCommand = useCallback(
    async (id: string, data: { name: string; command: string; icon: string }) => {
      const idx = customCommands.findIndex((c) => c.id === id);
      if (idx === -1) return;
      const updatedItem: CommandItem = {
        ...customCommands[idx],
        ...data,
      };
      const updated = customCommands.map((c) =>
        c.id === id ? updatedItem : c
      );
      setCustomCommands(updated);
      await store?.set(CUSTOM_COMMANDS_KEY, updated);
      toast.success(`已保存指令: ${data.name}`);
    },
    [customCommands, store]
  );

  // Delete custom command
  const deleteCommand = useCallback(
    async (id: string) => {
      const target = customCommands.find((c) => c.id === id);
      if (!target) return;
      const updated = customCommands.filter((c) => c.id !== id);
      setCustomCommands(updated);
      await store?.set(CUSTOM_COMMANDS_KEY, updated);
      toast.success(`已删除指令: ${target.name}`);
    },
    [customCommands, store]
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
  };
}
