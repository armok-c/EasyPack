import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import type { CommandItem, ProfileMeta, ProfileExportData } from "@/lib/types";
import {
  environmentApi,
  isDeleteResponse,
  isDeleteStatusResponse,
  type DeleteStatusResponse,
} from "@/lib/environment-types";
import { DEFAULT_ICON } from "@/lib/icons";
import { findConflict } from "@/lib/shortcutUtils";

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
const PENDING_DELETION_PREFIX = "pendingEnvironmentDeletion:";
type PendingDeletionKind = "project" | "profile";
type PendingDeletionPhase = "intent" | "prepared" | "frontendDeleted" | "finalizing";

interface PendingEnvironmentDeletion {
  version: 1;
  token: string;
  kind: PendingDeletionKind;
  profileId: string;
  projectId?: string;
  phase: PendingDeletionPhase;
}

function projectCommandsKey(projectId: string): string {
  return `projectCommands:${projectId}`;
}

function profileStorePath(id: string): string {
  return `${PROFILE_STORE_PREFIX}${id}.json`;
}

function pendingDeletionKey(token: string): string {
  return `${PENDING_DELETION_PREFIX}${token}`;
}

function isPendingEnvironmentDeletion(value: unknown, key?: string): value is PendingEnvironmentDeletion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PendingEnvironmentDeletion>;
  return item.version === 1
    && typeof item.token === "string"
    && item.token.length > 0
    && (key === undefined || key === pendingDeletionKey(item.token))
    && (item.kind === "project" || item.kind === "profile")
    && typeof item.profileId === "string"
    && item.profileId.length > 0
    && (item.kind === "project"
      ? typeof item.projectId === "string" && item.projectId.length > 0
      : item.projectId === undefined)
    && (item.phase === "intent"
      || item.phase === "prepared"
      || item.phase === "frontendDeleted"
      || item.phase === "finalizing");
}

/** Normalize a local path for Windows case-insensitive duplicate checks. */
function normalizeWindowsPath(path: string): string {
  const replaced = path.trim().replace(/\//g, "\\");
  const isUnc = replaced.startsWith("\\\\");
  const drive = /^[A-Za-z]:/.exec(replaced)?.[0] ?? "";
  const prefix = isUnc ? "\\\\" : drive || (replaced.startsWith("\\") ? "\\" : "");
  const body = replaced.slice(prefix.length);
  const segments = body.split("\\");
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === ".." && normalized.length > 0) {
      normalized.pop();
      continue;
    }
    if (segment !== "..") normalized.push(segment);
  }

  const suffix = normalized.join("\\");
  if (isUnc) return `\\\\${suffix}`.toLowerCase();
  if (drive) return `${drive}${suffix ? `\\${suffix}` : "\\"}`.toLowerCase();
  if (prefix === "\\") return `\\${suffix}`.toLowerCase();
  return suffix.toLowerCase();
}

function hasProjectPath(projects: ProjectItem[], path: string, exceptId?: string): boolean {
  const normalizedPath = normalizeWindowsPath(path);
  return projects.some(
    (project) => project.id !== exceptId && normalizeWindowsPath(project.path) === normalizedPath,
  );
}

function isMissingEnvironmentManifest(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return message.includes("no such file")
    || message.includes("cannot find")
    || message.includes("找不到指定")
    || message.includes("环境清单不存在")
    || message.includes("manifest missing")
    || message.includes("manifest not found");
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "未知错误";
}

function errorWithRollback(cause: unknown, rollbackErrors: unknown[]): Error {
  const causeMessage = errorDetail(cause);
  if (rollbackErrors.length === 0) {
    return new Error(causeMessage);
  }
  const details = rollbackErrors.map(errorDetail).join("; ");
  return new Error(`${causeMessage}；回滚失败：${details}`);
}

async function clearStore(store: Store): Promise<void> {
  if (typeof store.clear === "function") await store.clear();
  else for (const key of await store.keys()) await store.delete(key);
  await store.save();
}

type StoreSnapshot = Array<[string, unknown]>;

async function snapshotStore(store: Store): Promise<StoreSnapshot> {
  const keys = await store.keys();
  return Promise.all(keys.map(async (key) => [key, await store.get(key)] as [string, unknown]));
}

async function restoreStore(store: Store, snapshot: StoreSnapshot): Promise<void> {
  const currentKeys = await store.keys();
  for (const key of currentKeys) await store.delete(key);
  for (const [key, value] of snapshot) await store.set(key, value);
  await store.save();
}

async function writePendingDeletion(store: Store, deletion: PendingEnvironmentDeletion): Promise<void> {
  await store.set(pendingDeletionKey(deletion.token), deletion);
  await store.save();
}

async function updatePendingDeletion(
  store: Store,
  deletion: PendingEnvironmentDeletion,
  phase: PendingDeletionPhase,
): Promise<PendingEnvironmentDeletion> {
  const updated = { ...deletion, phase };
  await writePendingDeletion(store, updated);
  return updated;
}

async function clearPendingDeletion(store: Store, token: string): Promise<void> {
  await store.delete(pendingDeletionKey(token));
  await store.save();
}

function nextSelectedProjectId(projects: ProjectItem[], removedId: string, selectedId: string | null): string | null {
  if (selectedId !== removedId) return selectedId;
  return projects[0]?.id ?? null;
}

async function removeProjectFromStore(store: Store, projectId: string): Promise<void> {
  const projects = await store.get<ProjectItem[]>(PROJECTS_KEY) ?? [];
  const selectedId = await store.get<string>(SELECTED_KEY) ?? null;
  const updated = projects.filter((project) => project.id !== projectId);
  await store.set(PROJECTS_KEY, updated);
  await store.set(SELECTED_KEY, nextSelectedProjectId(updated, projectId, selectedId));
  await store.delete(projectCommandsKey(projectId));
  await store.delete(`projectEnvs:${projectId}`);
  await store.delete(`projectActiveEnv:${projectId}`);
  await store.save();
}

async function removeProfileFromMainStore(store: Store, profileId: string): Promise<void> {
  const profiles = await store.get<ProfileMeta[]>(PROFILES_KEY) ?? [];
  const activeId = await store.get<string>(ACTIVE_PROFILE_KEY) ?? null;
  const updated = profiles.filter((profile) => profile.id !== profileId);
  await store.set(PROFILES_KEY, updated);
  if (activeId === profileId) {
    await store.set(ACTIVE_PROFILE_KEY, updated[0]?.id ?? null);
  }
  await store.save();
}

function assertDeleteStatusMatches(
  deletion: PendingEnvironmentDeletion,
  status: unknown,
): asserts status is DeleteStatusResponse {
  if (!isDeleteStatusResponse(status)) {
    throw new Error("删除事务状态无效，已停止恢复");
  }
  if (status.status !== "prepared" && status.status !== "finalizing") return;

  const matches = status.kind === deletion.kind
    && status.profileId === deletion.profileId
    && (deletion.kind === "project"
      ? status.projectId === deletion.projectId
      : status.projectId === undefined);
  if (!matches) throw new Error("删除事务目标不匹配，已停止恢复");
}

/** Prepare using the journal token, then verify that Rust owns the same target. */
async function preparePendingDeletion(deletion: PendingEnvironmentDeletion): Promise<boolean> {
  const response = deletion.kind === "project"
    ? await environmentApi.prepareDeleteProject({
      profileId: deletion.profileId,
      projectId: deletion.projectId!,
      operationId: deletion.token,
    })
    : await environmentApi.prepareDeleteProfile({
      profileId: deletion.profileId,
      operationId: deletion.token,
    });

  if (!isDeleteResponse(response)) throw new Error("删除准备响应无效，已停止恢复");
  // An empty profile has no Rust deletion transaction. Its frontend record is
  // still removed, but there is no token to finalize.
  if (response.projectCount === 0) {
    if (deletion.kind === "profile" && response.token === "") return false;
    throw new Error("删除准备目标无效，已停止恢复");
  }
  if (response.token !== deletion.token) throw new Error("删除准备事务标识不匹配，已停止恢复");

  const status = await environmentApi.deleteStatus({ token: deletion.token });
  assertDeleteStatusMatches(deletion, status);
  if (status.status !== "prepared" && status.status !== "finalizing") {
    throw new Error("删除准备后事务不存在，已停止恢复");
  }
  return true;
}

async function deleteFrontendTarget(
  mainStore: Store,
  deletion: PendingEnvironmentDeletion,
): Promise<void> {
  const profileStore = await load(profileStorePath(deletion.profileId), { autoSave: 100, defaults: {} });
  if (deletion.kind === "project") {
    await removeProjectFromStore(profileStore, deletion.projectId!);
  } else {
    await clearStore(profileStore);
    await removeProfileFromMainStore(mainStore, deletion.profileId);
  }
}

async function recoverPendingDeletions(mainStore: Store): Promise<void> {
  const keys = await mainStore.keys();
  const pendingKeys = keys.filter((key) => key.startsWith(PENDING_DELETION_PREFIX));
  for (const key of pendingKeys) {
    const raw = await mainStore.get<unknown>(key);
    if (!isPendingEnvironmentDeletion(raw, key)) {
      toast.error("删除恢复失败", { description: "删除日志损坏，已保留并停止恢复。" });
      continue;
    }
    const deletion = raw;
    try {
      const status = await environmentApi.deleteStatus({ token: deletion.token });
      assertDeleteStatusMatches(deletion, status);

      // Once the frontend deletion was persisted, notFound means Rust may
      // already have finalized. Do not prepare a new transaction for it.
      if ((deletion.phase === "frontendDeleted" || deletion.phase === "finalizing")
        && status.status === "notFound") {
        await deleteFrontendTarget(mainStore, deletion);
        await clearPendingDeletion(mainStore, deletion.token);
        continue;
      }

      let hasRustTransaction = status.status !== "notFound";
      if (status.status === "notFound") {
        hasRustTransaction = await preparePendingDeletion(deletion);
      }

      await deleteFrontendTarget(mainStore, deletion);
      await updatePendingDeletion(mainStore, deletion, "prepared");
      await updatePendingDeletion(mainStore, deletion, "frontendDeleted");
      if (!hasRustTransaction) {
        await clearPendingDeletion(mainStore, deletion.token);
        continue;
      }
      await updatePendingDeletion(mainStore, deletion, "finalizing");
      await environmentApi.finalizeDelete({ token: deletion.token });
      await clearPendingDeletion(mainStore, deletion.token);
    } catch (error) {
      toast.error("删除恢复失败", { description: errorDetail(error) });
    }
  }
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
  const [editMode, setEditMode] = useState(false);

  // Phase 11/WR-04 (Phase 22 review): preset shortcut overrides persist at
  // PRESHORTCUTS_KEY. The store value is read directly on export, so there
  // is no React state mirror — the former presetShortcutsMap state was
  // write-only dead code (set on load, never read) and was removed.
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
  const loadProfileDataIntoState = useCallback(async (s: Store, profileId: string) => {
    let savedProjects = await s.get<ProjectItem[]>(PROJECTS_KEY);
    const savedSelectedId = await s.get<string>(SELECTED_KEY);

    if (savedProjects && profileId) {
      const reconciledProjects = await Promise.all(savedProjects.map(async (project) => {
        try {
          const manifestPath = await environmentApi.getProjectPath({
            profileId,
            projectId: project.id,
          });
          return manifestPath && manifestPath !== project.path
            ? { ...project, path: manifestPath }
            : project;
        } catch {
          return project;
        }
      }));
      if (reconciledProjects.some((project, index) => project.path !== savedProjects![index].path)) {
        savedProjects = reconciledProjects;
        await s.set(PROJECTS_KEY, savedProjects);
        await s.save();
      }
    }

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

    // Phase 22 (WR-05): clean legacy CUSTOM_COMMANDS_KEY on every profile
    // activation, not just initial boot. Running this here covers init,
    // switchProfile, and importProfile — so a freshly imported/switched
    // profile carrying the deprecated key (e.g. from an old export file)
    // is migrated immediately rather than waiting for the next cold start.
    const oldCustomCmds = await s.get<CommandItem[]>(CUSTOM_COMMANDS_KEY);
    if (oldCustomCmds && oldCustomCmds.length > 0) {
      await s.delete(CUSTOM_COMMANDS_KEY);
      await s.save();
      toast.info("全局指令已移除，请使用项目环境添加指令");
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

      // Phase 22 (WR-03): purge legacy CUSTOM_COMMANDS_KEY from the MAIN
      // store. Pre-Phase-22 installs wrote global commands here (the profile
      // store did not exist yet) and CUSTOM_COMMANDS_KEY was never in
      // keysToMigrate, so without this the cleanup advertised by the boot
      // toast never fires for the legacy users who need it most. Relies on
      // the ms.save() at the end of this function to persist the delete.
      const legacyCustomCmds = await ms.get<CommandItem[]>(CUSTOM_COMMANDS_KEY);
      if (legacyCustomCmds && legacyCustomCmds.length > 0) {
        await ms.delete(CUSTOM_COMMANDS_KEY);
        toast.info("全局指令已移除，请使用项目环境添加指令");
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
      await loadProfileDataIntoState(ps, id);

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

        await recoverPendingDeletions(ms);
        if (!mounted) return;

        const { metas, activeId } = await migrateToProfiles(ms);
        if (!mounted) return;

        setMainStore(ms);
        setProfileMetas(metas);
        setActiveProfileId(activeId);

        // 加载活跃 profile 数据
        const ps = await load(profileStorePath(activeId), { autoSave: 100, defaults: {} });
        if (!mounted) return;

        // Phase 22 (WR-05): legacy CUSTOM_COMMANDS_KEY cleanup now runs inside
        // loadProfileDataIntoState so it covers init, switchProfile, and
        // importProfile uniformly. No duplicate cleanup needed here.
        await loadProfileDataIntoState(ps, activeId);

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
      if (hasProjectPath(projects, path)) {
        toast.error("项目已存在");
        return;
      }
      const id = crypto.randomUUID();
      const newItem: ProjectItem = { id, name, path, addedAt: Date.now() };
      const updated = [...projects, newItem];
      setProjects(updated);
      setSelectedId(id);
      await profileStore?.set(PROJECTS_KEY, updated);
      await profileStore?.set(SELECTED_KEY, id);
      await profileStore?.save();
    },
    [projects, profileStore]
  );

  // Rebind a project after its directory moved. The stable project ID is
  // intentionally retained so commands, environments, and selection remain
  // attached to the same project record.
  const rebindProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const target = projects.find((project) => project.id === projectId);
      if (!target) return false;
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: "重新绑定项目文件夹",
        });
        if (typeof selected !== "string") return false;
        if (hasProjectPath(projects, selected, projectId)) {
          toast.error("项目已存在");
          return false;
        }

        const updated = projects.map((project) =>
          project.id === projectId ? { ...project, path: selected } : project,
        );
        const projectRef = {
          profileId: activeProfileId ?? "",
          projectId,
          projectPath: target.path,
        };
        let rustRebound = false;
        if (activeProfileId) {
          try {
            await environmentApi.rebindProject({ project: projectRef, newProjectPath: selected });
            rustRebound = true;
          } catch (error) {
            // Rust requires an existing manifest. A project that has never
            // entered the environment workflow still needs normal rebinding.
            if (!isMissingEnvironmentManifest(error)) throw error;
          }
        }

        try {
          await profileStore?.set(PROJECTS_KEY, updated);
          await profileStore?.save();
        } catch (error) {
          const rollbackErrors: unknown[] = [];
          try {
            await profileStore?.set(PROJECTS_KEY, projects);
            await profileStore?.save();
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
          if (rustRebound) {
            try {
              await environmentApi.rebindProject({ project: projectRef, newProjectPath: target.path });
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
          }
          setProjects(projects);
          throw errorWithRollback(error, rollbackErrors);
        }

        setProjects(updated);
        if (selectedId === projectId) fetchProjectInfo(selected);
        toast.success(`已重新绑定项目目录: ${target.name}`);
        return true;
      } catch (error) {
        if (import.meta.env.DEV) console.error("重新绑定项目目录失败:", error);
        toast.error("重新绑定失败", {
          description: "无法保存新的项目目录，请重试。",
        });
        return false;
      }
    },
    [activeProfileId, projects, profileStore, selectedId, fetchProjectInfo],
  );

  // Remove project (per D-10 auto-select nearest, D-11 empty state for last item)
  const removeProject = useCallback(
    async (id: string): Promise<boolean> => {
      const idx = projects.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      if (!activeProfileId || !mainStore || !profileStore) {
        toast.error("没有活动配置，无法删除项目环境数据");
        return false;
      }
      const commandKey = projectCommandsKey(id);
      const updated = projects.filter((p) => p.id !== id);

      // D-10: auto-select nearest neighbor
      let newSelectedId: string | null = null;
      if (updated.length > 0 && id === selectedId) {
        newSelectedId = updated[Math.min(idx, updated.length - 1)].id;
      } else if (id !== selectedId) {
        newSelectedId = selectedId;
      }

      const token = crypto.randomUUID();
      const deletion: PendingEnvironmentDeletion = {
        version: 1,
        token,
        kind: "project",
        profileId: activeProfileId,
        projectId: id,
        phase: "intent",
      };
      let prepared = false;
      let frontendCommitted = false;
      let profileStoreSnapshot: StoreSnapshot | null = null;
      try {
        await writePendingDeletion(mainStore, deletion);
        await environmentApi.prepareDeleteProject({
          profileId: activeProfileId,
          projectId: id,
          operationId: token,
        });
        prepared = true;
        profileStoreSnapshot = await snapshotStore(profileStore);
        await updatePendingDeletion(mainStore, deletion, "prepared");

        await profileStore.set(PROJECTS_KEY, updated);
        await profileStore.set(SELECTED_KEY, newSelectedId);
        await profileStore.delete(commandKey);
        await profileStore.delete(`projectEnvs:${id}`);
        await profileStore.delete(`projectActiveEnv:${id}`);
        await profileStore.save();
        frontendCommitted = true;
        await updatePendingDeletion(mainStore, deletion, "frontendDeleted");

        setProjects(updated);
        setSelectedId(newSelectedId);
        setProjectCommandsMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        await updatePendingDeletion(mainStore, deletion, "finalizing");
        await environmentApi.finalizeDelete({ token });
        await clearPendingDeletion(mainStore, token);
        return true;
      } catch (error) {
        const rollbackErrors: unknown[] = [];
        let frontendStoreRestored = true;
        let restoreDeleteSucceeded = true;

        if (prepared && !frontendCommitted) {
          if (profileStoreSnapshot) {
            try {
              await restoreStore(profileStore, profileStoreSnapshot);
            } catch (rollbackError) {
              frontendStoreRestored = false;
              rollbackErrors.push(rollbackError);
            }
          }
          try {
            await environmentApi.restoreDelete({ token });
          } catch (rollbackError) {
            restoreDeleteSucceeded = false;
            rollbackErrors.push(rollbackError);
          }
          if (frontendStoreRestored && restoreDeleteSucceeded) {
            try {
              await clearPendingDeletion(mainStore, token);
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
          }
        } else if (!prepared && !frontendCommitted) {
          // Prepare may have failed before Rust created a transaction. Querying
          // status distinguishes that case from a lost prepare response.
          try {
            const status = await environmentApi.deleteStatus({ token });
            assertDeleteStatusMatches(deletion, status);
            if (status.status === "prepared") {
              prepared = true;
              await environmentApi.restoreDelete({ token });
              await clearPendingDeletion(mainStore, token);
            } else if (status.status === "notFound") {
              await clearPendingDeletion(mainStore, token);
            }
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        }

        const failure = new Error(`删除项目失败：${errorDetail(error)}`);
        toast.error("删除项目失败", {
          description: !frontendCommitted && frontendStoreRestored && restoreDeleteSucceeded && rollbackErrors.length === 0
            ? "已恢复，请重试。"
            : "删除失败且恢复不完整，请检查数据后重试。",
        });
        throw errorWithRollback(failure, rollbackErrors);
      }
    },
    [activeProfileId, mainStore, projects, selectedId, profileStore]
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
    // projectCommandsMap intentionally omitted — the body above does not read it
    // (WR-04): including it widened the callback's invalidation scope on every
    // command mutation, busting memoized consumers without affecting behavior.
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
  const deleteProfile = useCallback(async (id: string): Promise<boolean> => {
    if (!mainStore || !profileStore) return false;
    if (profileMetas.length <= 1) {
      toast.error("至少需要保留一个配置文件");
      return false;
    }
    if (!profileMetas.some((profile) => profile.id === id)) return false;

    const deletingActive = id === activeProfileId;
    const updated = profileMetas.filter((profile) => profile.id !== id);
    const nextActiveId = deletingActive ? updated[0]?.id ?? null : activeProfileId;
    const token = crypto.randomUUID();
    const deletion: PendingEnvironmentDeletion = {
      version: 1,
      token,
      kind: "profile",
      profileId: id,
      phase: "intent",
    };
    let prepared = false;
    let frontendCommitted = false;
    let mainStoreSnapshot: StoreSnapshot | null = null;
    let deletedProfileStore: Store | null = null;
    let deletedProfileStoreSnapshot: StoreSnapshot | null = null;
    try {
      await writePendingDeletion(mainStore, deletion);
      await environmentApi.prepareDeleteProfile({ profileId: id, operationId: token });
      prepared = true;
      mainStoreSnapshot = await snapshotStore(mainStore);
      deletedProfileStore = await load(profileStorePath(id), { autoSave: 100, defaults: {} });
      deletedProfileStoreSnapshot = await snapshotStore(deletedProfileStore);
      await updatePendingDeletion(mainStore, deletion, "prepared");

      await mainStore.set(PROFILES_KEY, updated);
      if (deletingActive && nextActiveId) {
        await mainStore.set(ACTIVE_PROFILE_KEY, nextActiveId);
      }
      await mainStore.save();

      // The deleted profile must be cleared before Rust finalizes the delete.
      await clearStore(deletedProfileStore);

      await updatePendingDeletion(mainStore, deletion, "frontendDeleted");

      if (deletingActive && nextActiveId) {
        await switchProfile(nextActiveId);
      }
      frontendCommitted = true;
      await updatePendingDeletion(mainStore, deletion, "finalizing");
      await environmentApi.finalizeDelete({ token });
      await clearPendingDeletion(mainStore, token);
      setProfileMetas(updated);
      return true;
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      let frontendStoreRestored = true;
      let restoreDeleteSucceeded = true;

      if (prepared && !frontendCommitted) {
        if (mainStoreSnapshot) {
          try {
            await restoreStore(mainStore, mainStoreSnapshot);
          } catch (rollbackError) {
            frontendStoreRestored = false;
            rollbackErrors.push(rollbackError);
          }
        }
        if (deletedProfileStore && deletedProfileStoreSnapshot) {
          try {
            await restoreStore(deletedProfileStore, deletedProfileStoreSnapshot);
          } catch (rollbackError) {
            frontendStoreRestored = false;
            rollbackErrors.push(rollbackError);
          }
        }
        try {
          await environmentApi.restoreDelete({ token });
        } catch (rollbackError) {
          restoreDeleteSucceeded = false;
          rollbackErrors.push(rollbackError);
        }
        if (frontendStoreRestored && restoreDeleteSucceeded) {
          try {
            await clearPendingDeletion(mainStore, token);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        }
      } else if (!prepared && !frontendCommitted) {
        try {
          const status = await environmentApi.deleteStatus({ token });
          assertDeleteStatusMatches(deletion, status);
          if (status.status === "prepared") {
            await environmentApi.restoreDelete({ token });
            await clearPendingDeletion(mainStore, token);
          } else if (status.status === "notFound") {
            await clearPendingDeletion(mainStore, token);
          }
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      const failure = new Error(`删除配置失败：${errorDetail(error)}`);
      toast.error("删除配置失败", {
        description: !frontendCommitted && frontendStoreRestored && restoreDeleteSucceeded && rollbackErrors.length === 0
          ? "已恢复，请重试。"
          : "删除失败且恢复不完整，请检查数据后重试。",
      });
      throw errorWithRollback(failure, rollbackErrors);
    }
  }, [
    mainStore,
    profileMetas,
    activeProfileId,
    profileStore,
    switchProfile,
  ]);

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
      if (data.shortcutBindings && typeof data.shortcutBindings !== "object") {
        toast.error("配置文件损坏：shortcutBindings 格式错误");
        return;
      }
      if (data.projectCommands && typeof data.projectCommands !== "object") {
        toast.error("配置文件损坏：projectCommands 格式错误");
        return;
      }
      const hasLegacyEnvironmentData =
        data.projectEnvs !== undefined || data.projectActiveEnvs !== undefined;

      // 创建新 profile
      const id = crypto.randomUUID();
      const profileName = parsed.profileName ?? `导入配置`;
      const meta: ProfileMeta = { id, name: profileName, createdAt: Date.now() };
      const updatedMetas = [...profileMetas, meta];

      // 创建新 profile store 并写入数据
      const ps = await load(profileStorePath(id), { autoSave: 100, defaults: {} });
      if (data.projects) await ps.set(PROJECTS_KEY, data.projects);
      if (data.selectedProjectId !== undefined) await ps.set(SELECTED_KEY, data.selectedProjectId);
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
      if (hasLegacyEnvironmentData) {
        toast.info("已忽略导入文件中的旧环境数据，请在新配置中重新创建环境");
      }
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
    rebindProject, // (projectId: string) => Promise<boolean>
    removeProject, // (id: string) => Promise<void>
    selectProject, // (id: string) => Promise<void>

    // Command CRUD interface
    commands, // CommandItem[]
    addCommand, // (name, command, icon?, extra?) => Promise<void>
    updateCommand, // (id, data: { name, command, icon, scriptLines?, executionMode? }) => Promise<void>
    deleteCommand, // (id: string) => Promise<void>

    // Phase 17: script command execution (dispatches single-line or multi-line)
    executeScriptCommand, // (cmd: CommandItem) => Promise<boolean>

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
