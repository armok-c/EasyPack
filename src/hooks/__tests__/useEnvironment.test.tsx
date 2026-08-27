import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironment } from "@/hooks/useEnvironment";
import type { EnvironmentApi, EnvironmentProjectState } from "@/lib/environment-types";

const { mockListen } = vi.hoisted(() => ({ mockListen: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mockListen }));

const project = { id: "project-a", path: "C:\\Workspace\\Project" };
const state: EnvironmentProjectState = {
  profileId: "profile-a",
  projectId: project.id,
  projectPath: project.path,
  managedPaths: [".env"],
  environments: [{ id: "dev", name: "dev", fileCount: 1 }],
  undoAvailable: false,
  blocked: false,
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (cause?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function api(overrides: Partial<EnvironmentApi> = {}): EnvironmentApi {
  return {
    openProject: vi.fn(async () => state),
    getProjectPath: vi.fn(async () => null),
    create: vi.fn(async () => state),
    capture: vi.fn(async () => state),
    detail: vi.fn(async () => ({
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      path: ".env",
      snapshot: { state: "text", content: "A=1" },
      current: { state: "text", content: "A=2" },
    })),
    copy: vi.fn(async () => state),
    deleteEnvironment: vi.fn(async () => state),
    migrateManifest: vi.fn(async () => state),
    bootstrapImport: vi.fn(async () => state),
    rebindProject: vi.fn(async () => state),
    plan: vi.fn(async () => ({
      token: "token",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 1,
      changes: [],
    })),
    apply: vi.fn(async () => ({
      applied: true,
      stale: false,
      plan: {
        token: "token",
        profileId: state.profileId,
        projectId: state.projectId,
        environmentId: "dev",
        generation: 1,
        changes: [],
      },
      undoAvailable: true,
    })),
    planUndo: vi.fn(async () => ({
      token: "undo-token",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 1,
      changes: [],
    })),
    undo: vi.fn(async () => ({
      applied: true,
      stale: false,
      plan: {
        token: "token",
        profileId: state.profileId,
        projectId: state.projectId,
        environmentId: "dev",
        generation: 1,
        changes: [],
      },
      undoAvailable: false,
    })),
    prepareDeleteProject: vi.fn(async () => ({ token: "delete-project", projectCount: 1 })),
    prepareDeleteProfile: vi.fn(async () => ({ token: "delete-profile", projectCount: 1 })),
    finalizeDelete: vi.fn(async () => undefined),
    restoreDelete: vi.fn(async () => undefined),
    deleteStatus: vi.fn(async () => ({
      status: "notFound" as const,
      kind: "unknown" as const,
      profileId: "",
    })),
    deleteProject: vi.fn(async () => undefined),
    deleteProfile: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  mockListen.mockReset();
  mockListen.mockResolvedValue(vi.fn());
});

describe("useEnvironment", () => {
  it("loads by active profile and project, then plans and applies undo by token", async () => {
    const environmentApi = api();
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await act(async () => undefined);
    expect(environmentApi.openProject).toHaveBeenCalledWith({
      profileId: "profile-a",
      projectId: project.id,
      projectPath: project.path,
    });

    await act(async () => {
      await result.current.apply("dev", "token");
    });
    expect(environmentApi.apply).toHaveBeenCalledWith(expect.objectContaining({
      project: expect.objectContaining({ projectId: project.id }),
      environmentId: "dev",
      planToken: "token",
      operationId: expect.stringMatching(/^apply-/),
    }));
    expect(result.current.state?.undoAvailable).toBe(true);
    await act(async () => {
      await result.current.planUndo();
      await result.current.undo("dev", "undo-token");
    });
    expect(environmentApi.planUndo).toHaveBeenCalledWith({
      profileId: "profile-a",
      projectId: project.id,
      projectPath: project.path,
    });
    expect(environmentApi.undo).toHaveBeenCalledWith({
      profileId: "profile-a",
      projectId: project.id,
      projectPath: project.path,
    }, "undo-token", expect.stringMatching(/^undo-/));
    expect(result.current.state?.undoAvailable).toBe(false);
    expect(result.current.recoveryBlocked).toBe(false);
  });

  it("loads one environment file detail through the scoped API", async () => {
    const environmentApi = api();
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await act(async () => {
      await result.current.detail("dev", ".env");
    });

    expect(environmentApi.detail).toHaveBeenCalledWith({
      project: {
        profileId: "profile-a",
        projectId: project.id,
        projectPath: project.path,
      },
      environmentId: "dev",
      path: ".env",
    });
  });

  it("runs batch capture in order, keeps partial failures, and filters progress by operation", async () => {
    let progressHandler: ((event: unknown) => void) | undefined;
    mockListen.mockImplementationOnce(async (_name: string, handler: (event: unknown) => void) => {
      progressHandler = handler;
      return vi.fn();
    });
    const batchState: EnvironmentProjectState = {
      ...state,
      environments: [
        ...state.environments,
        { id: "test", name: "test", fileCount: 2 },
        { id: "prod", name: "prod", fileCount: 2 },
      ],
    };
    const capturedOrder: string[] = [];
    const environmentApi = api({
      openProject: vi.fn(async () => batchState),
      capture: vi.fn(async (request) => {
        capturedOrder.push(request.environmentId);
        progressHandler?.({ payload: {
          operationId: request.operationId,
          profileId: state.profileId,
          projectId: state.projectId,
          environmentId: request.environmentId,
          kind: "capture",
          completedFiles: 0,
          totalFiles: 0,
        } });
        progressHandler?.({ payload: {
          operationId: "old-operation",
          profileId: state.profileId,
          projectId: state.projectId,
          environmentId: request.environmentId,
          kind: "capture",
          completedFiles: 2,
          totalFiles: 2,
        } });
        progressHandler?.({ payload: {
          operationId: request.operationId,
          profileId: state.profileId,
          projectId: state.projectId,
          environmentId: request.environmentId,
          kind: "capture",
          completedFiles: 1,
          totalFiles: 2,
        } });
        if (request.environmentId === "test") throw new Error("test capture failed");
        return batchState;
      }),
    });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await waitFor(() => expect(mockListen).toHaveBeenCalledWith("environment-progress", expect.any(Function)));
    let batch!: Awaited<ReturnType<typeof result.current.captureMany>>;
    await act(async () => {
      batch = await result.current.captureMany(["dev", "test", "prod"]);
    });

    expect(capturedOrder).toEqual(["dev", "test", "prod"]);
    expect(batch.results.map((item) => item.success)).toEqual([true, false, true]);
    expect(batch.results[1].error).toBeInstanceOf(Error);
    expect(result.current.progress.dev).toMatchObject({ status: "success", percent: 100, totalFiles: 2 });
    expect(result.current.progress.test).toMatchObject({ status: "failed", percent: 50, totalFiles: 2 });
    expect(result.current.progress.prod).toMatchObject({ status: "success", percent: 100, totalFiles: 2 });
    expect(Object.values(result.current.progress).every((item) => !Number.isNaN(item.percent))).toBe(true);
  });

  it("refreshes state after a capture failure and stops when rollback blocks the project", async () => {
    const recoveryState: EnvironmentProjectState = {
      ...state,
      blocked: true,
      recoveryError: "rollback failed",
    };
    let reloadForRecovery = false;
    const environmentApi = api({
      openProject: vi.fn(async () => reloadForRecovery ? recoveryState : state),
      capture: vi.fn(async () => { throw new Error("capture failed"); }),
    });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await waitFor(() => expect(result.current.state).not.toBeNull());
    reloadForRecovery = true;
    let batch!: Awaited<ReturnType<typeof result.current.captureMany>>;
    await act(async () => {
      batch = await result.current.captureMany(["dev", "test"]);
    });

    expect(environmentApi.capture).toHaveBeenCalledTimes(1);
    expect(environmentApi.openProject.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(batch.results).toHaveLength(1);
    expect(batch.results[0]).toMatchObject({ environmentId: "dev", success: false });
    expect(result.current.state).toMatchObject({ blocked: true, recoveryError: "rollback failed" });
    expect(result.current.recoveryBlocked).toBe(true);
  });

  it("refreshes state after an apply failure so rollback recovery is visible", async () => {
    const recoveryState: EnvironmentProjectState = {
      ...state,
      blocked: true,
      recoveryError: "apply rollback failed",
    };
    let reloadForRecovery = false;
    const openedStates: EnvironmentProjectState[] = [];
    const environmentApi = api({
      openProject: vi.fn(async () => {
        const opened = reloadForRecovery ? recoveryState : state;
        openedStates.push(opened);
        return opened;
      }),
      apply: vi.fn(async () => { throw new Error("apply failed"); }),
    });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await waitFor(() => expect(result.current.state).not.toBeNull());
    reloadForRecovery = true;
    await act(async () => {
      await expect(result.current.apply("dev", "token")).rejects.toThrow("apply failed");
    });

    expect(environmentApi.openProject.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(environmentApi.apply).toHaveBeenCalledTimes(1);
    expect(openedStates).toContain(recoveryState);
    await waitFor(() => expect(result.current.state).toMatchObject({ blocked: true, recoveryError: "apply rollback failed" }));
    expect(result.current.recoveryBlocked).toBe(true);
    expect(result.current.progress.dev).toMatchObject({ status: "failed" });
  });

  it("clears stale apply progress and starts a new operation after re-confirmation", async () => {
    const stalePlan = {
      token: "fresh-token",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 2,
      changes: [],
    };
    const environmentApi = api({
      apply: vi.fn()
        .mockResolvedValueOnce({ applied: false, stale: true, plan: stalePlan, undoAvailable: false })
        .mockResolvedValueOnce({ applied: true, stale: false, plan: stalePlan, undoAvailable: true }),
    });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await waitFor(() => expect(environmentApi.openProject).toHaveBeenCalledOnce());
    await act(async () => {
      const response = await result.current.apply("dev", "old-token");
      expect(response.stale).toBe(true);
    });
    expect(result.current.progress.dev).toBeUndefined();

    await act(async () => {
      await result.current.apply("dev", "fresh-token");
    });
    const firstOperationId = (environmentApi.apply as ReturnType<typeof vi.fn>).mock.calls[0][0].operationId;
    const secondOperationId = (environmentApi.apply as ReturnType<typeof vi.fn>).mock.calls[1][0].operationId;
    expect(firstOperationId).not.toBe(secondOperationId);
    expect(result.current.progress.dev).toMatchObject({
      operationId: secondOperationId,
      status: "success",
      percent: 100,
    });
  });

  it("tracks undo progress and clears it when the plan is stale", async () => {
    let progressHandler: ((event: unknown) => void) | undefined;
    mockListen.mockImplementationOnce(async (_name: string, handler: (event: unknown) => void) => {
      progressHandler = handler;
      return vi.fn();
    });
    const stalePlan = {
      token: "fresh-undo-token",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 2,
      changes: [],
    };
    const environmentApi = api({
      undo: vi.fn(async (_project, _planToken, operationId) => {
        progressHandler?.({ payload: {
          operationId,
          profileId: state.profileId,
          projectId: state.projectId,
          environmentId: "dev",
          kind: "undo",
          completedFiles: 1,
          totalFiles: 2,
        } });
        return { applied: false, stale: true, plan: stalePlan, undoAvailable: true };
      }),
    });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await waitFor(() => expect(mockListen).toHaveBeenCalledWith("environment-progress", expect.any(Function)));
    await act(async () => {
      await result.current.undo("dev", "undo-token");
    });

    expect(environmentApi.undo).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: project.id }),
      "undo-token",
      expect.stringMatching(/^undo-/),
    );
    expect(result.current.progress.dev).toBeUndefined();
  });

  it("continues a capture when progress listener setup fails", async () => {
    mockListen.mockRejectedValueOnce(new Error("listener unavailable"));
    const environmentApi = api();
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await act(async () => {
      await result.current.capture("dev");
    });

    expect(environmentApi.capture).toHaveBeenCalledWith(expect.objectContaining({
      environmentId: "dev",
      operationId: expect.stringMatching(/^capture-/),
    }));
    expect(result.current.progress.dev).toMatchObject({ status: "success", percent: 100 });
  });

  it("runs batch delete in order and keeps failed targets in the result", async () => {
    const batchState: EnvironmentProjectState = {
      ...state,
      environments: [
        ...state.environments,
        { id: "test", name: "test", fileCount: 2 },
      ],
    };
    const deletedState = { ...batchState, environments: [{ id: "test", name: "test", fileCount: 2 }] };
    const deletedOrder: string[] = [];
    const environmentApi = api({
      openProject: vi.fn(async () => batchState),
      deleteEnvironment: vi.fn(async (request) => {
        deletedOrder.push(request.environmentId);
        if (request.environmentId === "test") throw new Error("test delete failed");
        return deletedState;
      }),
    });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    let batch!: Awaited<ReturnType<typeof result.current.deleteMany>>;
    await act(async () => {
      batch = await result.current.deleteMany(["dev", "test"]);
    });

    expect(deletedOrder).toEqual(["dev", "test"]);
    expect(batch.results.map((item) => item.success)).toEqual([true, false]);
    expect(batch.results[1].environmentId).toBe("test");
    expect(environmentApi.deleteEnvironment).toHaveBeenNthCalledWith(1, expect.objectContaining({
      environmentId: "dev",
      operationId: expect.stringMatching(/^delete-/),
    }));
    expect(environmentApi.deleteEnvironment).toHaveBeenNthCalledWith(2, expect.objectContaining({
      environmentId: "test",
      operationId: expect.stringMatching(/^delete-/),
    }));
    expect(result.current.state?.environments).toEqual(deletedState.environments);
  });

  it("deletes an environment through the scoped API and stores the returned state", async () => {
    const nextState = { ...state, environments: [] };
    const environmentApi = api({ deleteEnvironment: vi.fn(async () => nextState) });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await act(async () => {
      await result.current.deleteEnvironment("dev");
    });

    expect(environmentApi.deleteEnvironment).toHaveBeenCalledWith({
      project: {
        profileId: "profile-a",
        projectId: project.id,
        projectPath: project.path,
      },
      environmentId: "dev",
      operationId: expect.stringMatching(/^delete-/),
    });
    expect(result.current.state?.environments).toEqual([]);
  });

  it("can plan undo from persisted undo state after mounting", async () => {
    const environmentApi = api({
      openProject: vi.fn(async () => ({ ...state, undoAvailable: true })),
    });
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
    }));

    await act(async () => undefined);
    expect(result.current.state?.undoAvailable).toBe(true);
    await act(async () => {
      await result.current.planUndo();
    });
    expect(environmentApi.planUndo).toHaveBeenCalledOnce();
  });

  it("clears the previous scope before loading another profile/project", async () => {
    let resolveNext: ((value: EnvironmentProjectState) => void) | undefined;
    const environmentApi = api({
      openProject: vi.fn()
        .mockResolvedValueOnce(state)
        .mockImplementationOnce(() => new Promise<EnvironmentProjectState>((resolve) => {
          resolveNext = resolve;
        })),
    });
    const first = renderHook(
      ({ profileId, selectedProject }: { profileId: string; selectedProject: typeof project }) =>
        useEnvironment({ profileId, project: selectedProject, api: environmentApi }),
      { initialProps: { profileId: "profile-a", selectedProject: project } },
    );

    await act(async () => undefined);
    expect(first.result.current.state?.projectId).toBe(project.id);

    const nextProject = { id: "project-b", path: "C:\\Workspace\\Other" };
    await act(async () => {
      first.rerender({ profileId: "profile-b", selectedProject: nextProject });
    });
    expect(first.result.current.state).toBeNull();

    const nextProjectState = {
      ...state,
      profileId: "profile-b",
      projectId: nextProject.id,
      projectPath: nextProject.path,
    };
    await act(async () => {
      resolveNext?.(nextProjectState);
    });
    expect(environmentApi.openProject).toHaveBeenLastCalledWith({
      profileId: "profile-b",
      projectId: nextProject.id,
      projectPath: nextProject.path,
    });
  });

  it("blocks apply while a migration draft requires user completion", async () => {
    const environmentApi = api();
    const legacyValues = new Map<string, unknown>([
      ["projectEnvs:project-a", [
        { id: "dev", name: "dev", createdAt: 1, updatedAt: 2, files: [{ name: ".env", content: "A=1", addedAt: 1 }] },
        { id: "test", name: "test", createdAt: 1, updatedAt: 2, files: [{ name: "extra.env", content: "B=2", addedAt: 1 }] },
      ]],
      ["projectActiveEnv:project-a", "dev"],
    ]);
    const legacyStore = {
      get: vi.fn(async <T,>(key: string) => legacyValues.get(key) as T | undefined),
      delete: vi.fn(async (key: string) => { legacyValues.delete(key); }),
      save: vi.fn(async () => undefined),
    };
    const { result } = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
      legacyStore,
    }));

    await act(async () => undefined);
    expect(result.current.migrationRequired).toBe(true);
    await expect(result.current.apply("dev", "token")).rejects.toThrow("迁移未完成");
    expect(environmentApi.apply).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.migrateManifest({
        managedPaths: [".env", "extra.env"],
        environments: [],
      });
    });
    expect(environmentApi.bootstrapImport).toHaveBeenCalledWith({
      project: {
        profileId: "profile-a",
        projectId: project.id,
        projectPath: project.path,
      },
      managedPaths: [".env", "extra.env"],
      environments: [],
    });
    expect(result.current.migrationRequired).toBe(false);
    expect(legacyStore.delete).toHaveBeenCalledWith("projectEnvs:project-a");
    expect(legacyStore.delete).toHaveBeenCalledWith("projectActiveEnv:project-a");
    expect(legacyStore.save).toHaveBeenCalledOnce();

    const remounted = renderHook(() => useEnvironment({
      profileId: "profile-a",
      project,
      api: environmentApi,
      legacyStore,
    }));
    await act(async () => undefined);
    expect(remounted.result.current.migrationRequired).toBe(false);
    expect(environmentApi.bootstrapImport).toHaveBeenCalledOnce();
  });

  it("keeps legacy keys and migration gate when manual migration fails", async () => {
    const environmentApi = api({
      bootstrapImport: vi.fn(async () => { throw new Error("migration failed"); }),
    });
    const legacyValues = new Map<string, unknown>([
      ["projectEnvs:project-a", [{ id: "dev", name: "dev", createdAt: 1, updatedAt: 2, files: [{ name: ".env", content: "A=1", addedAt: 1 }] }, { id: "test", name: "test", createdAt: 1, updatedAt: 2, files: [{ name: "extra.env", content: "B=2", addedAt: 1 }] }]],
      ["projectActiveEnv:project-a", "dev"],
    ]);
    const legacyStore = {
      get: vi.fn(async <T,>(key: string) => legacyValues.get(key) as T | undefined),
      delete: vi.fn(async (key: string) => { legacyValues.delete(key); }),
      save: vi.fn(async () => undefined),
    };
    const { result } = renderHook(() => useEnvironment({ profileId: "profile-a", project, api: environmentApi, legacyStore }));

    await act(async () => undefined);
    await expect(act(async () => result.current.migrateManifest({ managedPaths: [".env", "extra.env"], environments: [] }))).rejects.toThrow("migration failed");
    expect(legacyValues.has("projectEnvs:project-a")).toBe(true);
    expect(legacyValues.has("projectActiveEnv:project-a")).toBe(true);
    expect(legacyStore.delete).not.toHaveBeenCalled();
    expect(result.current.migrationRequired).toBe(true);
  });

  it("keeps the fast B scope after a slow A refresh finishes", async () => {
    const nextProject = { id: "project-b", path: "C:\\Workspace\\Other" };
    const slowA = deferred<EnvironmentProjectState>();
    const fastB = deferred<EnvironmentProjectState>();
    const stateB = { ...state, profileId: "profile-b", projectId: nextProject.id, projectPath: nextProject.path };
    const environmentApi = api({
      openProject: vi.fn((ref) => ref.projectId === project.id ? slowA.promise : fastB.promise),
    });
    const view = renderHook(
      ({ profileId, selectedProject }: { profileId: string; selectedProject: typeof project }) =>
        useEnvironment({ profileId, project: selectedProject, api: environmentApi }),
      { initialProps: { profileId: "profile-a", selectedProject: project } },
    );

    await waitFor(() => expect(environmentApi.openProject).toHaveBeenCalledOnce());
    await act(async () => view.rerender({ profileId: "profile-b", selectedProject: nextProject }));
    await waitFor(() => expect(environmentApi.openProject).toHaveBeenCalledTimes(2));

    await act(async () => {
      fastB.resolve(stateB);
      await fastB.promise;
    });
    await act(async () => {
      slowA.resolve(state);
      await slowA.promise;
    });

    expect(view.result.current.state).toEqual(stateB);
    expect(view.result.current.error).toBeNull();
  });

  it("drops an old operation error after switching scope", async () => {
    const nextProject = { id: "project-b", path: "C:\\Workspace\\Other" };
    const slowCreate = deferred<EnvironmentProjectState>();
    const stateB = { ...state, profileId: "profile-b", projectId: nextProject.id, projectPath: nextProject.path };
    const environmentApi = api({
      create: vi.fn(() => slowCreate.promise),
      openProject: vi.fn(async (ref) => ref.projectId === nextProject.id ? stateB : state),
    });
    const view = renderHook(
      ({ profileId, selectedProject }: { profileId: string; selectedProject: typeof project }) =>
        useEnvironment({ profileId, project: selectedProject, api: environmentApi }),
      { initialProps: { profileId: "profile-a", selectedProject: project } },
    );

    await act(async () => undefined);
    const oldCreate = view.result.current.create("stale", [".env"]);
    await waitFor(() => expect(environmentApi.create).toHaveBeenCalledOnce());
    await act(async () => view.rerender({ profileId: "profile-b", selectedProject: nextProject }));
    await act(async () => {
      slowCreate.reject(new Error("A failed"));
      await expect(oldCreate).rejects.toThrow("A failed");
    });
    await waitFor(() => expect(view.result.current.state?.projectId).toBe(nextProject.id));

    expect(view.result.current.error).toBeNull();
  });

  it("does not let an old finally clear B busy", async () => {
    const nextProject = { id: "project-b", path: "C:\\Workspace\\Other" };
    const slowCreate = deferred<EnvironmentProjectState>();
    const slowBOpen = deferred<EnvironmentProjectState>();
    const stateB = { ...state, profileId: "profile-b", projectId: nextProject.id, projectPath: nextProject.path };
    const environmentApi = api({
      create: vi.fn(() => slowCreate.promise),
      openProject: vi.fn()
        .mockResolvedValueOnce(state)
        .mockImplementationOnce(() => slowBOpen.promise),
    });
    const view = renderHook(
      ({ profileId, selectedProject }: { profileId: string; selectedProject: typeof project }) =>
        useEnvironment({ profileId, project: selectedProject, api: environmentApi }),
      { initialProps: { profileId: "profile-a", selectedProject: project } },
    );

    await act(async () => undefined);
    const oldCreate = view.result.current.create("stale", [".env"]);
    await waitFor(() => expect(environmentApi.create).toHaveBeenCalledOnce());
    await act(async () => view.rerender({ profileId: "profile-b", selectedProject: nextProject }));
    await waitFor(() => expect(view.result.current.busy).toBe(true));

    await act(async () => {
      slowCreate.resolve(state);
      await slowCreate.promise;
    });
    expect(view.result.current.busy).toBe(true);

    await act(async () => {
      slowBOpen.resolve(stateB);
      await slowBOpen.promise;
    });
    await expect(oldCreate).resolves.toEqual(state);
    expect(view.result.current.busy).toBe(false);
  });

  it("rejects an old migration callback without submitting to the new scope", async () => {
    const nextProject = { id: "project-b", path: "C:\\Workspace\\Other" };
    const environmentApi = api();
    const view = renderHook(
      ({ profileId, selectedProject }: { profileId: string; selectedProject: typeof project }) =>
        useEnvironment({ profileId, project: selectedProject, api: environmentApi }),
      { initialProps: { profileId: "profile-a", selectedProject: project } },
    );

    await act(async () => undefined);
    const oldMigrate = view.result.current.migrateManifest;
    await act(async () => view.rerender({ profileId: "profile-b", selectedProject: nextProject }));

    await expect(oldMigrate({ managedPaths: [".env"], environments: [] })).rejects.toThrow();
    expect(environmentApi.migrateManifest).not.toHaveBeenCalled();
  });
});
