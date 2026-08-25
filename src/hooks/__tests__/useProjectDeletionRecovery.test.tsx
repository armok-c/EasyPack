import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useProject } from "@/hooks/useProject";
import type { ProjectItem } from "@/hooks/useProject";

type ValueStore = {
  get: <T>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<void>;
  keys: () => Promise<string[]>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
};

type InvokeArgs = {
  request?: {
    profileId?: string;
    projectId?: string;
    operationId?: string;
    token?: string;
  };
};

const { values, stores, load, invoke, defaultInvoke, toastError } = vi.hoisted(() => {
  const values = new Map<string, Map<string, unknown>>();
  const stores = new Map<string, ValueStore>();
  const makeStore = (path: string): ValueStore => {
    const data = values.get(path) ?? new Map<string, unknown>();
    values.set(path, data);
    return {
      get: async <T,>(key: string) => data.get(key) as T | undefined,
      set: async (key, value) => { data.set(key, value); },
      delete: async (key) => { data.delete(key); },
      keys: async () => [...data.keys()],
      save: async () => undefined,
      clear: async () => { data.clear(); },
    };
  };
  const load = vi.fn(async (path: string) => {
    const existing = stores.get(path);
    if (existing) return existing;
    const store = makeStore(path);
    stores.set(path, store);
    return store;
  });
  const defaultInvoke = async (command: string, args?: InvokeArgs) => {
    if (command === "environment_get_project_path") return null;
    if (command === "environment_delete_status") {
      return args?.request?.token?.includes("profile")
        ? { status: "prepared", kind: "profile", profileId: "profile-b" }
        : { status: "prepared", kind: "project", profileId: "profile-a", projectId: "project-a" };
    }
    if (command === "environment_prepare_delete_project" || command === "environment_prepare_delete_profile") {
      return { token: args?.request?.operationId ?? "ignored", projectCount: 1 };
    }
    return undefined;
  };
  const invoke = vi.fn(defaultInvoke);
  const toastError = vi.fn();
  return { values, stores, load, invoke, defaultInvoke, toastError };
});

vi.mock("@tauri-apps/plugin-store", () => ({ load }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile: vi.fn(), writeTextFile: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: toastError, info: vi.fn() },
}));

const project: ProjectItem = {
  id: "project-a",
  name: "Project A",
  path: "C:\\Workspace\\ProjectA",
  addedAt: 1,
};

function store(path: string): ValueStore {
  const value = stores.get(path);
  if (!value) throw new Error(`store not loaded: ${path}`);
  return value;
}

async function seed(options: {
  projects?: ProjectItem[];
  profiles?: Array<{ id: string; name: string; createdAt: number }>;
  activeProfileId?: string;
  pending?: Record<string, unknown>;
}) {
  const main = await load("easypack-store.json");
  await main.set("profileMigrationDone", true);
  await main.set("profiles", options.profiles ?? [{ id: "profile-a", name: "A", createdAt: 1 }]);
  await main.set("activeProfileId", options.activeProfileId ?? "profile-a");
  if (options.pending) {
    for (const [key, value] of Object.entries(options.pending)) await main.set(key, value);
  }
  await main.save();
  const profileStore = await load(`profile-${options.activeProfileId ?? "profile-a"}.json`);
  await profileStore.set("projects", options.projects ?? [project]);
  await profileStore.set("selectedProjectId", (options.projects ?? [project])[0]?.id ?? null);
  await profileStore.save();
}

async function mount() {
  const hook = renderHook(() => useProject());
  await act(async () => undefined);
  return hook;
}

describe("useProject 持久删除恢复", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    values.clear();
    stores.clear();
    load.mockClear();
    invoke.mockReset();
    invoke.mockImplementation(defaultInvoke);
    toastError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finalize 失败后重挂载会继续删除并清日志", async () => {
    const token = "operation-project-finalize";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "finalizing",
        },
      },
    });
    const mounted = await mount();
    expect((await store("profile-profile-a.json").get<ProjectItem[]>("projects"))).toEqual([]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    expect(invoke.mock.calls.map(([command]) => command)).toContain("environment_delete_status");
    mounted.unmount();
  });

  it("profile 日志重挂载时清空 profile store 并从主 Store 移除 profile", async () => {
    const token = "operation-profile-finalizing";
    await seed({
      profiles: [
        { id: "profile-a", name: "A", createdAt: 1 },
        { id: "profile-b", name: "B", createdAt: 2 },
      ],
      activeProfileId: "profile-a",
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "profile",
          profileId: "profile-b",
          phase: "prepared",
        },
      },
    });
    const profileB = await load("profile-profile-b.json");
    await profileB.set("projects", [project]);
    await profileB.set("selectedProjectId", project.id);
    await profileB.save();

    const mounted = await mount();
    expect(await profileB.keys()).toEqual([]);
    expect(await store("easypack-store.json").get<Array<{ id: string }>>("profiles")).toEqual([
      { id: "profile-a", name: "A", createdAt: 1 },
    ]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    mounted.unmount();
  });

  it("intent + notFound 会用原 operationId 重做 prepare 并核对结果", async () => {
    const token = "operation-project-intent";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "intent",
        },
      },
    });
    let statusCalls = 0;
    invoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") {
        statusCalls += 1;
        return statusCalls === 1
          ? { status: "notFound", kind: "unknown", profileId: "" }
          : { status: "prepared", kind: "project", profileId: "profile-a", projectId: "project-a" };
      }
      if (command === "environment_prepare_delete_project") {
        return { token: args?.request?.operationId, projectCount: 1 };
      }
      return undefined;
    });

    const mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      "environment_delete_status",
      "environment_prepare_delete_project",
      "environment_delete_status",
      "environment_finalize_delete",
    ]);
    expect(invoke.mock.calls[1][1]).toEqual({
      request: { profileId: "profile-a", projectId: "project-a", operationId: token },
    });
    mounted.unmount();
  });

  it.each([
    ["intent + prepared", "intent", "prepared"],
    ["intent + finalizing", "intent", "finalizing"],
    ["prepared + finalizing", "prepared", "finalizing"],
    ["frontendDeleted + prepared", "frontendDeleted", "prepared"],
    ["frontendDeleted + finalizing", "frontendDeleted", "finalizing"],
  ] as const)("%s 只处理日志目标并最终清日志", async (_name, phase, statusPhase) => {
    const token = `operation-${phase}-${statusPhase}`;
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase,
        },
      },
    });
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") {
        return { status: statusPhase, kind: "project", profileId: "profile-a", projectId: "project-a" };
      }
      return undefined;
    });

    const mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    expect(invoke.mock.calls.map(([command]) => command)).not.toContain("environment_prepare_delete_project");
    expect(invoke.mock.calls.map(([command]) => command)).toContain("environment_finalize_delete");
    mounted.unmount();
  });

  it("prepared + notFound 会用原 operationId 重做 prepare 后删除前端", async () => {
    const token = "operation-project-prepared-not-found";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "prepared",
        },
      },
    });
    let statusCalls = 0;
    invoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") {
        statusCalls += 1;
        return statusCalls === 1
          ? { status: "notFound", kind: "unknown", profileId: "" }
          : { status: "prepared", kind: "project", profileId: "profile-a", projectId: "project-a" };
      }
      if (command === "environment_prepare_delete_project") {
        return { token: args?.request?.operationId, projectCount: 1 };
      }
      return undefined;
    });

    const mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      "environment_delete_status",
      "environment_prepare_delete_project",
      "environment_delete_status",
      "environment_finalize_delete",
    ]);
    expect(invoke.mock.calls[1][1]).toEqual({
      request: { profileId: "profile-a", projectId: "project-a", operationId: token },
    });
    mounted.unmount();
  });

  it("frontendDeleted + notFound 只幂等删除前端并清日志", async () => {
    const token = "operation-project-not-found";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "frontendDeleted",
        },
      },
    });
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") return { status: "notFound", kind: "unknown", profileId: "" };
      return undefined;
    });

    const mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    expect(invoke.mock.calls.map(([command]) => command)).not.toContain("environment_prepare_delete_project");
    expect(invoke.mock.calls.map(([command]) => command)).not.toContain("environment_finalize_delete");
    mounted.unmount();
  });

  it("prepared 目标不匹配时不改前端、不 prepare/finalize/restore，并保留日志", async () => {
    const token = "operation-project-mismatch";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "prepared",
        },
      },
    });
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") {
        return { status: "prepared", kind: "project", profileId: "profile-a", projectId: "project-b" };
      }
      return undefined;
    });

    const mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([project]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toMatchObject({
      projectId: "project-a",
      phase: "prepared",
    });
    const commands = invoke.mock.calls.map(([command]) => command);
    expect(commands).not.toContain("environment_prepare_delete_project");
    expect(commands).not.toContain("environment_finalize_delete");
    expect(commands).not.toContain("environment_restore_delete");
    expect(toastError).toHaveBeenCalledWith("删除恢复失败", {
      description: "删除事务目标不匹配，已停止恢复",
    });
    mounted.unmount();
  });

  it("损坏日志只隔离提示并保留，不查询或操作 Rust 事务", async () => {
    const token = "operation-corrupt";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          phase: "intent",
        },
      },
    });

    const mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([project]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toMatchObject({ token });
    expect(invoke.mock.calls.map(([command]) => command)).not.toContain("environment_delete_status");
    expect(toastError).toHaveBeenCalledWith("删除恢复失败", {
      description: "删除日志损坏，已保留并停止恢复。",
    });
    mounted.unmount();
  });

  it("prepare 失败保留日志和前端数据，finalize 失败保留前端删除结果", async () => {
    const prepareToken = "operation-prepare-failed";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${prepareToken}`]: {
          version: 1,
          token: prepareToken,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "intent",
        },
      },
    });
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") return { status: "notFound", kind: "unknown", profileId: "" };
      if (command === "environment_prepare_delete_project") throw new Error("prepare failed");
      return undefined;
    });
    let mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([project]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${prepareToken}`)).toMatchObject({ token: prepareToken });
    mounted.unmount();

    values.clear();
    stores.clear();
    load.mockClear();
    const finalizeToken = "operation-finalize-failed";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${finalizeToken}`]: {
          version: 1,
          token: finalizeToken,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "prepared",
        },
      },
    });
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") return { status: "prepared", kind: "project", profileId: "profile-a", projectId: "project-a" };
      if (command === "environment_finalize_delete") throw new Error("finalize failed");
      return undefined;
    });
    mounted = await mount();
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${finalizeToken}`)).toMatchObject({ phase: "finalizing" });
    expect(invoke.mock.calls.map(([command]) => command)).not.toContain("environment_restore_delete");
    mounted.unmount();
  });

  it("重挂载在 notFound 后确认前端删除并清除失败日志", async () => {
    const token = "operation-remount";
    await seed({
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "project",
          profileId: "profile-a",
          projectId: "project-a",
          phase: "finalizing",
        },
      },
    });
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") return { status: "finalizing", kind: "project", profileId: "profile-a", projectId: "project-a" };
      if (command === "environment_finalize_delete") throw new Error("finalize failed");
      return undefined;
    });
    let mounted = await mount();
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toMatchObject({ phase: "finalizing" });
    mounted.unmount();

    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") return { status: "notFound", kind: "unknown", profileId: "" };
      return undefined;
    });
    mounted = await mount();
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    expect(invoke.mock.calls.map(([command]) => command)).not.toContain("environment_prepare_delete_project");
    mounted.unmount();
  });

  it("profile frontendDeleted + notFound 只幂等清理前端并保留目标", async () => {
    const token = "operation-profile-not-found";
    await seed({
      profiles: [
        { id: "profile-a", name: "A", createdAt: 1 },
        { id: "profile-b", name: "B", createdAt: 2 },
      ],
      activeProfileId: "profile-a",
      pending: {
        [`pendingEnvironmentDeletion:${token}`]: {
          version: 1,
          token,
          kind: "profile",
          profileId: "profile-b",
          phase: "frontendDeleted",
        },
      },
    });
    const profileB = await load("profile-profile-b.json");
    await profileB.set("projects", [project]);
    await profileB.set("selectedProjectId", project.id);
    await profileB.save();
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") return null;
      if (command === "environment_delete_status") return { status: "notFound", kind: "unknown", profileId: "" };
      return undefined;
    });

    const mounted = await mount();
    expect(await profileB.keys()).toEqual([]);
    expect(await store("easypack-store.json").get<Array<{ id: string }>>("profiles")).toEqual([
      { id: "profile-a", name: "A", createdAt: 1 },
    ]);
    expect(await store("easypack-store.json").get(`pendingEnvironmentDeletion:${token}`)).toBeUndefined();
    const commands = invoke.mock.calls.map(([command]) => command);
    expect(commands).not.toContain("environment_prepare_delete_profile");
    expect(commands).not.toContain("environment_finalize_delete");
    mounted.unmount();
  });

  it.each([
    ["manifest path", "D:\\Rust\\ProjectA", "D:\\Rust\\ProjectA"],
    ["null path", null, project.path],
    ["error", new Error("path unavailable"), project.path],
  ])("加载时 path 自愈场景：%s", async (_name, manifestPath, expectedPath) => {
    await seed({});
    invoke.mockImplementation(async (command: string) => {
      if (command === "environment_get_project_path") {
        if (manifestPath instanceof Error) throw manifestPath;
        return manifestPath;
      }
      return undefined;
    });
    const mounted = await mount();
    expect(mounted.result.current.projects[0]?.path).toBe(expectedPath);
    expect(await store("profile-profile-a.json").get<ProjectItem[]>("projects")).toEqual([
      { ...project, path: expectedPath },
    ]);
    mounted.unmount();
  });
});
