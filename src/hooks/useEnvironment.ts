import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";
import {
  buildLegacyMigrationDraft,
  clearLegacyEnvironmentData,
  environmentApi as defaultEnvironmentApi,
  migrateLegacyEnvironmentData,
  type ApplyPlan,
  type ApplyResponse,
  type BootstrapImportRequest,
  type CreateEnvironmentRequest,
  type EnvironmentBatchResult,
  type EnvironmentDetailResponse,
  type EnvironmentApi,
  type EnvironmentOperationKind,
  type EnvironmentProgress,
  type EnvironmentProgressEvent,
  type EnvironmentProjectRef,
  type EnvironmentProjectState,
  type LegacyEnvironmentStore,
  type LegacyMigrationDraft,
  type MigrateManifestRequest,
} from "@/lib/environment-types";

type EnvironmentMigrationInput =
  | Omit<MigrateManifestRequest, "project">
  | Omit<BootstrapImportRequest, "project">;

export interface UseEnvironmentOptions {
  profileId: string | null | undefined;
  project: { id: string; path: string } | null | undefined;
  api?: EnvironmentApi;
  legacyStore?: LegacyEnvironmentStore | null;
}

type CaptureAction = {
  (environmentId: string): Promise<EnvironmentProjectState>;
  (environmentIds: string[]): Promise<EnvironmentBatchResult>;
};

type DeleteAction = {
  (environmentId: string): Promise<EnvironmentProjectState>;
  (environmentIds: string[]): Promise<EnvironmentBatchResult>;
};

export interface UseEnvironmentResult {
  state: EnvironmentProjectState | null;
  busy: boolean;
  error: unknown;
  recoveryBlocked: boolean;
  recoveryError: string | null;
  migrationRequired: boolean;
  migrationDraft: LegacyMigrationDraft | null;
  scopeKey: string;
  progress: Record<string, EnvironmentProgress>;
  refresh: () => Promise<EnvironmentProjectState | null>;
  create: (name: string, managedPaths: string[]) => Promise<EnvironmentProjectState>;
  capture: CaptureAction;
  captureMany: (environmentIds: string[]) => Promise<EnvironmentBatchResult>;
  detail: (environmentId: string, path: string) => Promise<EnvironmentDetailResponse>;
  copy: (environmentId: string, name: string) => Promise<EnvironmentProjectState>;
  deleteEnvironment: DeleteAction;
  deleteMany: (environmentIds: string[]) => Promise<EnvironmentBatchResult>;
  migrateManifest: (request: EnvironmentMigrationInput) => Promise<EnvironmentProjectState>;
  plan: (environmentId: string) => Promise<ApplyPlan>;
  apply: (environmentId: string, planToken: string) => Promise<ApplyResponse>;
  planUndo: () => Promise<ApplyPlan>;
  undo: (planToken: string) => Promise<ApplyResponse>;
}

function toProjectRef(
  profileId: string | null | undefined,
  project: { id: string; path: string } | null | undefined,
): EnvironmentProjectRef | null {
  if (!profileId || !project) return null;
  return { profileId, projectId: project.id, projectPath: project.path };
}

interface EnvironmentScope {
  key: string;
  token: number;
  projectRef: EnvironmentProjectRef | null;
}

interface ActiveEnvironmentOperation {
  scope: EnvironmentScope;
  environmentId: string;
  kind: EnvironmentOperationKind;
}

function newOperationId(kind: EnvironmentOperationKind | "plan" | "delete"): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  const suffix = randomUuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${kind}-${suffix}`;
}

function progressPercent(completedFiles: number, totalFiles: number): number {
  if (totalFiles <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completedFiles / totalFiles) * 100)));
}

function operationStateBlocksContinuation(
  state: EnvironmentProjectState | null,
  migrationRequired: boolean,
): boolean {
  return migrationRequired || !!state?.blocked || !!state?.recoveryError;
}

/**
 * Environment state is scoped by the active profile and selected project.
 * This hook owns IPC orchestration only; it does not inspect files or infer
 * which environment is currently active.
 */
export function useEnvironment(options: UseEnvironmentOptions): UseEnvironmentResult {
  const { profileId, project, legacyStore } = options;
  const api = options.api ?? defaultEnvironmentApi;
  const projectRef = useMemo(
    () => toProjectRef(profileId, project),
    [profileId, project?.id, project?.path],
  );
  const scopeKey = projectRef
    ? `${projectRef.profileId}\0${projectRef.projectId}\0${projectRef.projectPath}`
    : "";
  const scopeRef = useRef<EnvironmentScope>({ key: scopeKey, token: 0, projectRef });
  if (scopeRef.current.key !== scopeKey) {
    scopeRef.current = {
      key: scopeKey,
      token: scopeRef.current.token + 1,
      projectRef,
    };
  }
  const renderScope = scopeRef.current;
  const progressScopeRef = useRef(renderScope.token);
  if (progressScopeRef.current !== renderScope.token) progressScopeRef.current = renderScope.token;
  const busyScopeRef = useRef({ key: renderScope.key, token: renderScope.token, count: 0 });
  if (busyScopeRef.current.key !== renderScope.key || busyScopeRef.current.token !== renderScope.token) {
    busyScopeRef.current = { key: renderScope.key, token: renderScope.token, count: 0 };
  }
  const [state, setState] = useState<EnvironmentProjectState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [progress, setProgress] = useState<Record<string, EnvironmentProgress>>({});
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [migrationDraft, setMigrationDraft] = useState<LegacyMigrationDraft | null>(null);
  const errorScopeRef = useRef(renderScope.token);
  const activeOperationsRef = useRef(new Map<string, ActiveEnvironmentOperation>());
  const stateLoadRef = useRef(0);
  if (errorScopeRef.current !== renderScope.token) errorScopeRef.current = renderScope.token;

  const isCurrentScope = useCallback((scope: EnvironmentScope): boolean => {
    const current = scopeRef.current;
    return current.key === scope.key && current.token === scope.token;
  }, []);

  const updateBusy = useCallback((scope: EnvironmentScope, delta: 1 | -1) => {
    if (!isCurrentScope(scope)) return;
    const current = busyScopeRef.current;
    if (current.key !== scope.key || current.token !== scope.token) return;
    current.count = Math.max(0, current.count + delta);
    setBusy(current.count > 0);
  }, [isCurrentScope]);

  const startProgress = useCallback((
    scope: EnvironmentScope,
    environmentId: string,
    kind: EnvironmentOperationKind,
    operationId: string,
  ) => {
    if (!isCurrentScope(scope)) return;
    activeOperationsRef.current.set(operationId, { scope, environmentId, kind });
    setProgress((current) => ({
      ...current,
      [environmentId]: {
        operationId,
        kind,
        completedFiles: 0,
        totalFiles: 0,
        percent: 0,
        status: "running",
      },
    }));
  }, [isCurrentScope]);

  const finishProgress = useCallback((
    scope: EnvironmentScope,
    operationId: string,
    status: "success" | "failed",
    cause?: unknown,
  ) => {
    const operation = activeOperationsRef.current.get(operationId);
    activeOperationsRef.current.delete(operationId);
    if (!operation || !isCurrentScope(scope)) return;
    setProgress((current) => {
      const previous = current[operation.environmentId];
      if (!previous || previous.operationId !== operationId) return current;
      return {
        ...current,
        [operation.environmentId]: {
          ...previous,
          status,
          percent: status === "success" ? 100 : previous.percent,
          ...(status === "failed" ? { error: cause } : {}),
        },
      };
    });
  }, [isCurrentScope]);

  const clearProgress = useCallback((scope: EnvironmentScope, operationId: string) => {
    const operation = activeOperationsRef.current.get(operationId);
    activeOperationsRef.current.delete(operationId);
    if (!operation || !isCurrentScope(scope)) return;
    setProgress((current) => {
      const previous = current[operation.environmentId];
      if (!previous || previous.operationId !== operationId) return current;
      const next = { ...current };
      delete next[operation.environmentId];
      return next;
    });
  }, [isCurrentScope]);

  useEffect(() => {
    const operationScope = renderScope;
    let mounted = true;
    let unlisten: UnlistenFn | null = null;
    const handleProgress = (event: Event<EnvironmentProgressEvent>) => {
      const payload = event.payload;
      if (!payload || typeof payload !== "object") return;
      const operation = activeOperationsRef.current.get(payload.operationId);
      const ref = operationScope.projectRef;
      if (!mounted || !ref || !operation || operation.scope.token !== operationScope.token
        || !isCurrentScope(operationScope)
        || payload.profileId !== ref.profileId
        || payload.projectId !== ref.projectId
        || payload.environmentId !== operation.environmentId
        || payload.kind !== operation.kind
        || !Number.isFinite(payload.completedFiles)
        || !Number.isFinite(payload.totalFiles)
        || payload.completedFiles < 0
        || payload.totalFiles < 0) return;
      const totalFiles = Math.floor(payload.totalFiles);
      const completedFiles = Math.min(totalFiles, Math.floor(payload.completedFiles));
      setProgress((current) => {
        const previous = current[payload.environmentId];
        if (!previous || previous.operationId !== payload.operationId) return current;
        return {
          ...current,
          [payload.environmentId]: {
            ...previous,
            completedFiles,
            totalFiles,
            percent: progressPercent(completedFiles, totalFiles),
          },
        };
      });
    };

    const setup = Promise.resolve().then(() => listen<EnvironmentProgressEvent>("environment-progress", handleProgress));
    void setup.then((cleanup) => {
      if (!mounted || !isCurrentScope(operationScope)) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    }).catch(() => {
      // Progress is advisory; a missing listener must not block file operations.
    });

    return () => {
      mounted = false;
      unlisten?.();
      for (const [operationId, operation] of activeOperationsRef.current) {
        if (operation.scope.token === operationScope.token) activeOperationsRef.current.delete(operationId);
      }
    };
  }, [isCurrentScope, renderScope]);

  const refresh = useCallback(async (): Promise<EnvironmentProjectState | null> => {
    const operationScope = renderScope;
    const ref = operationScope.projectRef;
    if (!isCurrentScope(operationScope)) return null;
    const loadToken = ++stateLoadRef.current;
    if (!ref || !legacyStore) {
      setMigrationRequired(false);
      setMigrationDraft(null);
    }
    if (!ref) {
      setState(null);
      errorScopeRef.current = operationScope.token;
      setError(null);
      return null;
    }

    updateBusy(operationScope, 1);
    errorScopeRef.current = operationScope.token;
    setError(null);
    try {
      if (legacyStore) {
        const migration = await migrateLegacyEnvironmentData({
          store: legacyStore,
          api,
          profileId: ref.profileId,
          projectId: ref.projectId,
          projectPath: ref.projectPath,
        });
        if (!isCurrentScope(operationScope)) return null;
        if (migration.status === "required") {
          setMigrationRequired(true);
          setMigrationDraft(migration.draft ?? null);
        } else if (migration.status === "migrated") {
          setMigrationRequired(false);
          setMigrationDraft(null);
          setState(migration.state ?? null);
        } else if (migration.status === "failed") {
          setMigrationRequired(false);
          setMigrationDraft(null);
          errorScopeRef.current = operationScope.token;
          setError(migration.error ?? new Error("环境迁移失败"));
        } else {
          setMigrationRequired(false);
          setMigrationDraft(null);
        }
      }

      const loaded = await api.openProject(ref);
      if (!isCurrentScope(operationScope) || loadToken !== stateLoadRef.current) return null;
      setState(loaded);
      return loaded;
    } catch (cause) {
      if (isCurrentScope(operationScope)) {
        errorScopeRef.current = operationScope.token;
        setError(cause);
      }
      return null;
    } finally {
      updateBusy(operationScope, -1);
    }
  }, [api, isCurrentScope, legacyStore, renderScope, updateBusy]);

  useEffect(() => {
    setState(null);
    setError(null);
    setMigrationRequired(false);
    setMigrationDraft(null);
    setProgress({});
    activeOperationsRef.current.clear();
    stateLoadRef.current += 1;
    errorScopeRef.current = renderScope.token;
    setBusy(false);
    void refresh();
  }, [scopeKey, refresh]);

  const currentRef = renderScope.projectRef;
  const stateForScope = state && currentRef
    && state.profileId === currentRef.profileId
    && state.projectId === currentRef.projectId
    && state.projectPath === currentRef.projectPath
    ? state
    : null;
  const migrationDraftForScope = migrationDraft && currentRef
    && migrationDraft.profileId === currentRef.profileId
    && migrationDraft.projectId === currentRef.projectId
    && migrationDraft.projectPath === currentRef.projectPath
    ? migrationDraft
    : null;
  const migrationRequiredForScope = migrationRequired && migrationDraftForScope !== null;

  const requireProject = useCallback((allowMigration = false): EnvironmentProjectRef => {
    const ref = renderScope.projectRef;
    if (!ref) throw new Error("没有选择项目或配置文件");
    if (!allowMigration && migrationRequiredForScope) throw new Error("环境清单迁移未完成，暂不能应用环境");
    if (stateForScope?.blocked || stateForScope?.recoveryError) throw new Error("项目存在未恢复完成的事务，暂不能应用环境");
    return ref;
  }, [migrationRequiredForScope, renderScope, stateForScope?.blocked, stateForScope?.recoveryError]);

  const reloadCurrentState = useCallback(async (
    scope: EnvironmentScope,
    ref: EnvironmentProjectRef,
  ): Promise<EnvironmentProjectState | null> => {
    if (!isCurrentScope(scope)) return null;
    const loadToken = ++stateLoadRef.current;
    try {
      const loaded = await api.openProject(ref);
      if (!isCurrentScope(scope) || loadToken !== stateLoadRef.current) return null;
      setState(loaded);
      return loaded;
    } catch {
      return null;
    }
  }, [api, isCurrentScope]);

  const perform = useCallback(
    async <T,>(scope: EnvironmentScope, operation: () => Promise<T>): Promise<T> => {
      if (!isCurrentScope(scope)) throw new Error("项目已切换，已取消这次环境操作");
      updateBusy(scope, 1);
      errorScopeRef.current = scope.token;
      setError(null);
      try {
        return await operation();
      } catch (cause) {
        if (isCurrentScope(scope)) {
          errorScopeRef.current = scope.token;
          setError(cause);
        }
        throw cause;
      } finally {
        updateBusy(scope, -1);
      }
    },
    [isCurrentScope, updateBusy],
  );

  const create = useCallback(
    (name: string, managedPaths: string[]) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        const request: CreateEnvironmentRequest = { project: ref, name, managedPaths };
        const next = await api.create(request);
        if (isCurrentScope(renderScope)) setState(next);
        return next;
      }),
    [api, isCurrentScope, perform, renderScope, requireProject],
  );

  const captureMany = useCallback(
    (environmentIds: string[]) =>
      perform(renderScope, async (): Promise<EnvironmentBatchResult> => {
        const ref = requireProject();
        let latestState = stateForScope;
        const results: EnvironmentBatchResult["results"] = [];
        for (const environmentId of environmentIds) {
          if (!isCurrentScope(renderScope)) throw new Error("项目已切换，已取消这次环境操作");
          const operationId = newOperationId("capture");
          startProgress(renderScope, environmentId, "capture", operationId);
          try {
            const next = await api.capture({ project: ref, environmentId, operationId });
            finishProgress(renderScope, operationId, "success");
            if (isCurrentScope(renderScope)) {
              setState(next);
              latestState = next;
            }
            results.push({ environmentId, success: true, state: next });
          } catch (cause) {
            finishProgress(renderScope, operationId, "failed", cause);
            if (!isCurrentScope(renderScope)) throw cause;
            const refreshed = await reloadCurrentState(renderScope, ref);
            if (!isCurrentScope(renderScope)) throw cause;
            if (refreshed) latestState = refreshed;
            results.push({ environmentId, success: false, error: cause });
            if (operationStateBlocksContinuation(refreshed, migrationRequiredForScope)) break;
          }
        }
        return { results, state: latestState };
      }),
    [api, finishProgress, isCurrentScope, migrationRequiredForScope, perform, reloadCurrentState, renderScope, requireProject, startProgress, stateForScope],
  );

  const capture = useCallback(
    ((environmentIdOrIds: string | string[]) => {
      if (Array.isArray(environmentIdOrIds)) return captureMany(environmentIdOrIds);
      return captureMany([environmentIdOrIds]).then((batch) => {
        const result = batch.results[0];
        if (!result?.success) throw result?.error ?? new Error("捕获环境更新失败");
        return result.state ?? batch.state ?? (() => { throw new Error("捕获环境更新未返回项目状态"); })();
      });
    }) as CaptureAction,
    [captureMany],
  );

  const detail = useCallback(
    (environmentId: string, path: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        return api.detail({ project: ref, environmentId, path });
      }),
    [api, perform, renderScope, requireProject],
  );

  const copy = useCallback(
    (environmentId: string, name: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        const next = await api.copy({ project: ref, environmentId, name });
        if (isCurrentScope(renderScope)) setState(next);
        return next;
      }),
    [api, isCurrentScope, perform, renderScope, requireProject],
  );

  const deleteMany = useCallback(
    (environmentIds: string[]) =>
      perform(renderScope, async (): Promise<EnvironmentBatchResult> => {
        const ref = requireProject();
        let latestState = stateForScope;
        const results: EnvironmentBatchResult["results"] = [];
        for (const environmentId of environmentIds) {
          if (!isCurrentScope(renderScope)) throw new Error("项目已切换，已取消这次环境操作");
          try {
            const next = await api.deleteEnvironment({
              project: ref,
              environmentId,
              operationId: newOperationId("delete"),
            });
            if (isCurrentScope(renderScope)) {
              setState(next);
              latestState = next;
            }
            results.push({ environmentId, success: true, state: next });
          } catch (cause) {
            if (!isCurrentScope(renderScope)) throw cause;
            results.push({ environmentId, success: false, error: cause });
          }
        }
        return { results, state: latestState };
      }),
    [api, isCurrentScope, perform, renderScope, requireProject, stateForScope],
  );

  const deleteEnvironment = useCallback(
    ((environmentIdOrIds: string | string[]) => {
      if (Array.isArray(environmentIdOrIds)) return deleteMany(environmentIdOrIds);
      return deleteMany([environmentIdOrIds]).then((batch) => {
        const result = batch.results[0];
        if (!result?.success) throw result?.error ?? new Error("删除环境失败");
        return result.state ?? batch.state ?? (() => { throw new Error("删除环境未返回项目状态"); })();
      });
    }) as DeleteAction,
    [deleteMany],
  );

  const migrateManifest = useCallback(
    (request: EnvironmentMigrationInput) =>
      perform(renderScope, async () => {
        const ref = requireProject(true);
        const next = migrationRequiredForScope
          ? await api.bootstrapImport({ ...request, project: ref } as BootstrapImportRequest)
          : await api.migrateManifest({ ...request, project: ref } as MigrateManifestRequest);
        if (legacyStore) await clearLegacyEnvironmentData(legacyStore, ref.projectId);
        if (isCurrentScope(renderScope)) {
          setState(next);
          setMigrationRequired(false);
          setMigrationDraft(null);
        }
        const refreshed = await refresh();
        return refreshed ?? next;
      }),
    [api, isCurrentScope, legacyStore, migrationRequiredForScope, perform, refresh, renderScope, requireProject],
  );

  const plan = useCallback(
    (environmentId: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        return api.plan({ project: ref, environmentId, operationId: newOperationId("plan") });
      }),
    [api, perform, renderScope, requireProject],
  );

  const apply = useCallback(
    (environmentId: string, planToken: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        const operationId = newOperationId("apply");
        startProgress(renderScope, environmentId, "apply", operationId);
        let response: ApplyResponse;
        try {
          response = await api.apply({ project: ref, environmentId, planToken, operationId });
        } catch (cause) {
          finishProgress(renderScope, operationId, "failed", cause);
          await reloadCurrentState(renderScope, ref);
          throw cause;
        }
        if (response.stale) clearProgress(renderScope, operationId);
        else finishProgress(renderScope, operationId, response.applied ? "success" : "failed");
        if (response.applied && isCurrentScope(renderScope)) {
          setState((current) => current ? { ...current, undoAvailable: response.undoAvailable } : current);
        }
        return response;
      }),
    [api, clearProgress, finishProgress, isCurrentScope, perform, reloadCurrentState, renderScope, requireProject, startProgress],
  );

  const planUndo = useCallback(
    () =>
      perform(renderScope, async () => {
        const ref = requireProject();
        return api.planUndo(ref);
      }),
    [api, perform, renderScope, requireProject],
  );

  const undo = useCallback(
    (planToken: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        const response = await api.undo(ref, planToken);
        if (response.applied && isCurrentScope(renderScope)) {
          setState((current) => current ? { ...current, undoAvailable: response.undoAvailable } : current);
        }
        return response;
      }),
    [api, isCurrentScope, perform, renderScope, requireProject],
  );

  const errorForScope = errorScopeRef.current === renderScope.token ? error : null;
  const busyForScope = busyScopeRef.current.token === renderScope.token && busy;
  const progressForScope = progressScopeRef.current === renderScope.token ? progress : {};

  return {
    state: stateForScope,
    busy: busyForScope,
    error: errorForScope,
    recoveryBlocked: !!stateForScope?.blocked || !!stateForScope?.recoveryError,
    recoveryError: stateForScope?.recoveryError ?? null,
    migrationRequired: migrationRequiredForScope,
    migrationDraft: migrationDraftForScope,
    scopeKey,
    progress: progressForScope,
    refresh,
    create,
    capture,
    captureMany,
    detail,
    copy,
    deleteEnvironment,
    deleteMany,
    migrateManifest,
    plan,
    apply,
    planUndo,
    undo,
  };
}

export { buildLegacyMigrationDraft };
