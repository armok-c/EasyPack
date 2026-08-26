import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildLegacyMigrationDraft,
  clearLegacyEnvironmentData,
  environmentApi as defaultEnvironmentApi,
  migrateLegacyEnvironmentData,
  type ApplyPlan,
  type ApplyResponse,
  type BootstrapImportRequest,
  type CreateEnvironmentRequest,
  type EnvironmentApi,
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

export interface UseEnvironmentResult {
  state: EnvironmentProjectState | null;
  busy: boolean;
  error: unknown;
  recoveryBlocked: boolean;
  recoveryError: string | null;
  migrationRequired: boolean;
  migrationDraft: LegacyMigrationDraft | null;
  scopeKey: string;
  refresh: () => Promise<EnvironmentProjectState | null>;
  create: (name: string, managedPaths: string[]) => Promise<EnvironmentProjectState>;
  capture: (environmentId: string) => Promise<EnvironmentProjectState>;
  copy: (environmentId: string, name: string) => Promise<EnvironmentProjectState>;
  deleteEnvironment: (environmentId: string) => Promise<EnvironmentProjectState>;
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
  const busyScopeRef = useRef({ key: renderScope.key, token: renderScope.token, count: 0 });
  if (busyScopeRef.current.key !== renderScope.key || busyScopeRef.current.token !== renderScope.token) {
    busyScopeRef.current = { key: renderScope.key, token: renderScope.token, count: 0 };
  }
  const [state, setState] = useState<EnvironmentProjectState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [migrationDraft, setMigrationDraft] = useState<LegacyMigrationDraft | null>(null);
  const errorScopeRef = useRef(renderScope.token);
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

  const refresh = useCallback(async (): Promise<EnvironmentProjectState | null> => {
    const operationScope = renderScope;
    const ref = operationScope.projectRef;
    if (!isCurrentScope(operationScope)) return null;
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
      if (!isCurrentScope(operationScope)) return null;
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
    if (stateForScope?.blocked) throw new Error("项目存在未恢复完成的事务，暂不能应用环境");
    return ref;
  }, [migrationRequiredForScope, renderScope, stateForScope?.blocked]);

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

  const capture = useCallback(
    (environmentId: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        const next = await api.capture({ project: ref, environmentId });
        if (isCurrentScope(renderScope)) setState(next);
        return next;
      }),
    [api, isCurrentScope, perform, renderScope, requireProject],
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

  const deleteEnvironment = useCallback(
    (environmentId: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        const next = await api.deleteEnvironment({ project: ref, environmentId });
        if (isCurrentScope(renderScope)) setState(next);
        return next;
      }),
    [api, isCurrentScope, perform, renderScope, requireProject],
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
        return api.plan({ project: ref, environmentId });
      }),
    [api, perform, renderScope, requireProject],
  );

  const apply = useCallback(
    (environmentId: string, planToken: string) =>
      perform(renderScope, async () => {
        const ref = requireProject();
        const response = await api.apply({ project: ref, environmentId, planToken });
        if (response.applied && isCurrentScope(renderScope)) {
          setState((current) => current ? { ...current, undoAvailable: response.undoAvailable } : current);
        }
        return response;
      }),
    [api, isCurrentScope, perform, renderScope, requireProject],
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

  return {
    state: stateForScope,
    busy: busyForScope,
    error: errorForScope,
    recoveryBlocked: stateForScope?.blocked ?? false,
    recoveryError: stateForScope?.recoveryError ?? null,
    migrationRequired: migrationRequiredForScope,
    migrationDraft: migrationDraftForScope,
    scopeKey,
    refresh,
    create,
    capture,
    copy,
    deleteEnvironment,
    migrateManifest,
    plan,
    apply,
    planUndo,
    undo,
  };
}

export { buildLegacyMigrationDraft };
