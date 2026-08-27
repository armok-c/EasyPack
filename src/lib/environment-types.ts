import { invoke } from "@tauri-apps/api/core";

/** Rust SnapshotState (serde rename_all = camelCase). */
export type SnapshotState = "present" | "absent";

export interface SnapshotEntry {
  path: string;
  state: SnapshotState;
  digest: string | null;
  size: number | null;
  blob: string | null;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  fileCount: number;
}

export interface EnvironmentProjectRef {
  profileId: string;
  projectId: string;
  projectPath: string;
}

export interface EnvironmentProjectState {
  profileId: string;
  projectId: string;
  projectPath: string;
  managedPaths: string[];
  environments: EnvironmentSummary[];
  undoAvailable: boolean;
  blocked: boolean;
  recoveryError?: string | null;
}

export type ChangeAction = "create" | "overwrite" | "delete" | "unchanged";

export interface PlanChange {
  path: string;
  action: ChangeAction;
  currentState: SnapshotState;
  targetState: SnapshotState;
  currentDigest: string | null;
  targetDigest: string | null;
  targetSize: number | null;
}

export interface ApplyPlan {
  token: string;
  profileId: string;
  projectId: string;
  environmentId: string;
  generation: number;
  changes: PlanChange[];
}

export interface ApplyResponse {
  applied: boolean;
  stale: boolean;
  plan: ApplyPlan;
  undoAvailable: boolean;
}

export interface CreateEnvironmentRequest {
  project: EnvironmentProjectRef;
  name: string;
  managedPaths: string[];
}

export interface EnvironmentRequest {
  project: EnvironmentProjectRef;
  environmentId: string;
  operationId: string;
}

export interface CopyEnvironmentRequest {
  project: EnvironmentProjectRef;
  environmentId: string;
  name: string;
}

export interface ApplyRequest {
  project: EnvironmentProjectRef;
  environmentId: string;
  planToken: string;
  operationId: string;
}

export type EnvironmentFileState = "text" | "absent" | "nonUtf8";

export interface EnvironmentFileContent {
  state: EnvironmentFileState;
  content?: string;
}

export interface EnvironmentDetailRequest {
  project: EnvironmentProjectRef;
  environmentId: string;
  path: string;
}

export interface EnvironmentDetailResponse {
  profileId: string;
  projectId: string;
  environmentId: string;
  path: string;
  snapshot: EnvironmentFileContent;
  current: EnvironmentFileContent;
}

export type EnvironmentOperationKind = "capture" | "apply" | "undo";

export interface EnvironmentProgressEvent {
  operationId: string;
  profileId: string;
  projectId: string;
  environmentId: string;
  kind: EnvironmentOperationKind;
  completedFiles: number;
  totalFiles: number;
}

export type EnvironmentProgressStatus = "running" | "success" | "failed";

export interface EnvironmentProgress {
  operationId: string;
  kind: EnvironmentOperationKind;
  completedFiles: number;
  totalFiles: number;
  percent: number;
  status: EnvironmentProgressStatus;
  error?: unknown;
}

export interface EnvironmentBatchItemResult {
  environmentId: string;
  success: boolean;
  state?: EnvironmentProjectState;
  error?: unknown;
}

export interface EnvironmentBatchResult {
  results: EnvironmentBatchItemResult[];
  state: EnvironmentProjectState | null;
}

export interface MigrationEntry {
  path: string;
  state: SnapshotState;
  content?: number[] | null;
}

export interface MigrationEnvironment {
  environmentId: string;
  entries: MigrationEntry[];
}

export interface MigrateManifestRequest {
  project: EnvironmentProjectRef;
  managedPaths: string[];
  environments: MigrationEnvironment[];
}

export interface BootstrapEnvironment {
  environmentId: string;
  name: string;
  entries: MigrationEntry[];
}

export interface BootstrapImportRequest {
  project: EnvironmentProjectRef;
  managedPaths: string[];
  environments: BootstrapEnvironment[];
}

export interface RebindProjectRequest {
  project: EnvironmentProjectRef;
  newProjectPath: string;
}

export interface ProjectDeleteRequest {
  profileId: string;
  projectId: string;
  operationId?: string;
}

export interface ProfileDeleteRequest {
  profileId: string;
  operationId?: string;
}

export interface ProjectPathRequest {
  profileId: string;
  projectId: string;
}

export interface DeleteResponse {
  token: string;
  projectCount: number;
}

export interface DeleteFinalizeRequest {
  token: string;
}

export interface DeleteRestoreRequest {
  token: string;
}

export interface DeleteStatusRequest {
  token: string;
}

export type DeleteStatus = "notFound" | "prepared" | "finalizing";
export type DeleteKind = "project" | "profile" | "unknown";

export interface DeleteStatusResponse {
  status: DeleteStatus;
  kind: DeleteKind;
  profileId: string;
  projectId?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Validate untrusted IPC data before a delete recovery can mutate local data. */
export function isDeleteStatusResponse(value: unknown): value is DeleteStatusResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<DeleteStatusResponse>;
  if (response.status !== "notFound"
    && response.status !== "prepared"
    && response.status !== "finalizing") return false;
  if (response.kind !== "project" && response.kind !== "profile" && response.kind !== "unknown") return false;
  if (response.projectId !== undefined && typeof response.projectId !== "string") return false;

  if (response.status === "notFound") {
    return response.kind === "unknown"
      ? response.profileId === ""
      : isNonEmptyString(response.profileId);
  }

  if (!isNonEmptyString(response.profileId)) return false;
  if (response.kind === "project") return isNonEmptyString(response.projectId);
  return response.kind === "profile" && response.projectId === undefined;
}

export function isDeleteResponse(value: unknown): value is DeleteResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<DeleteResponse>;
  return typeof response.token === "string"
    && typeof response.projectCount === "number"
    && Number.isInteger(response.projectCount)
    && response.projectCount >= 0;
}

export interface EnvironmentApi {
  openProject(project: EnvironmentProjectRef): Promise<EnvironmentProjectState>;
  getProjectPath(request: ProjectPathRequest): Promise<string | null>;
  create(request: CreateEnvironmentRequest): Promise<EnvironmentProjectState>;
  capture(request: EnvironmentRequest): Promise<EnvironmentProjectState>;
  detail(request: EnvironmentDetailRequest): Promise<EnvironmentDetailResponse>;
  copy(request: CopyEnvironmentRequest): Promise<EnvironmentProjectState>;
  deleteEnvironment(request: EnvironmentRequest): Promise<EnvironmentProjectState>;
  migrateManifest(request: MigrateManifestRequest): Promise<EnvironmentProjectState>;
  bootstrapImport(request: BootstrapImportRequest): Promise<EnvironmentProjectState>;
  rebindProject(request: RebindProjectRequest): Promise<EnvironmentProjectState>;
  plan(request: EnvironmentRequest): Promise<ApplyPlan>;
  apply(request: ApplyRequest): Promise<ApplyResponse>;
  planUndo(project: EnvironmentProjectRef): Promise<ApplyPlan>;
  undo(project: EnvironmentProjectRef, planToken: string, operationId: string): Promise<ApplyResponse>;
  prepareDeleteProject(request: ProjectDeleteRequest): Promise<DeleteResponse>;
  prepareDeleteProfile(request: ProfileDeleteRequest): Promise<DeleteResponse>;
  finalizeDelete(request: DeleteFinalizeRequest): Promise<void>;
  restoreDelete(request: DeleteRestoreRequest): Promise<void>;
  deleteStatus(request: DeleteStatusRequest): Promise<DeleteStatusResponse>;
  /** Compatibility wrappers for callers that still need the non-transactional command. */
  deleteProject(request: ProjectDeleteRequest): Promise<void>;
  deleteProfile(request: ProfileDeleteRequest): Promise<void>;
}

export type EnvironmentInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

/**
 * Keep IPC details in one place. Passing an invoke function makes every API
 * method independently testable without a Tauri runtime.
 */
export function createEnvironmentApi(
  invokeFn: EnvironmentInvoke = invoke as EnvironmentInvoke,
): EnvironmentApi {
  const call = <T>(command: string, args: Record<string, unknown>) =>
    invokeFn<T>(command, args);

  return {
    openProject: (project) => call("environment_open_project", { project }),
    getProjectPath: (request) => call("environment_get_project_path", { request }),
    create: (request) => call("environment_create", { request }),
    capture: (request) => call("environment_capture", { request }),
    detail: (request) => call("environment_detail", { request }),
    copy: (request) => call("environment_copy", { request }),
    deleteEnvironment: (request) => call("environment_delete", { request }),
    migrateManifest: (request) => call("environment_migrate_manifest", { request }),
    bootstrapImport: (request) => call("environment_bootstrap_import", { request }),
    rebindProject: (request) => call("environment_rebind_project", { request }),
    plan: (request) => call("environment_plan", { request }),
    apply: (request) => call("environment_apply", { request }),
    planUndo: (project) => call("environment_plan_undo", { project }),
    undo: (project, planToken, operationId) => call("environment_undo", { request: { project, planToken, operationId } }),
    prepareDeleteProject: (request) => call("environment_prepare_delete_project", { request }),
    prepareDeleteProfile: (request) => call("environment_prepare_delete_profile", { request }),
    finalizeDelete: (request) => call("environment_finalize_delete", { request }),
    restoreDelete: (request) => call("environment_restore_delete", { request }),
    deleteStatus: (request) => call("environment_delete_status", { request }),
    deleteProject: (request) => call("environment_delete_project", { request }),
    deleteProfile: (request) => call("environment_delete_profile", { request }),
  };
}

export const environmentApi = createEnvironmentApi();

export interface LegacyEnvironmentStore {
  get<T>(key: string): Promise<T | undefined>;
  delete(key: string): Promise<void>;
  save(): Promise<void>;
}

export interface LegacyMigrationDraft {
  profileId: string;
  projectId: string;
  projectPath: string;
  managedPaths: string[];
  environments: BootstrapEnvironment[];
  legacyActiveEnvironmentId: string | null;
  reason: "collection-mismatch";
}

/**
 * Minimal shape of the removed profile-store environment records.
 * Keep this compatibility type at the migration boundary only.
 */
export interface LegacyManagedFile {
  name: string;
  content: string;
  addedAt: number;
}

export interface LegacyEnvironment {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: LegacyManagedFile[];
}

export interface LegacyMigrationResult {
  status: "none" | "ready" | "required" | "migrated" | "failed";
  draft?: LegacyMigrationDraft;
  state?: EnvironmentProjectState;
  error?: unknown;
}

function legacyKey(projectId: string): string {
  return `projectEnvs:${projectId}`;
}

function legacyActiveKey(projectId: string): string {
  return `projectActiveEnv:${projectId}`;
}

export async function clearLegacyEnvironmentData(
  store: LegacyEnvironmentStore,
  projectId: string,
): Promise<void> {
  await store.delete(legacyKey(projectId));
  await store.delete(legacyActiveKey(projectId));
  await store.save();
}

function sortedUniquePaths(environments: LegacyEnvironment[]): string[] {
  return [...new Set(environments.flatMap((environment) => environment.files.map((file) => file.name.replace(/\\/g, "/"))))].sort();
}

function pathsOf(environment: LegacyEnvironment): string[] {
  return environment.files.map((file) => file.name.replace(/\\/g, "/")).sort();
}

function toBootstrapEnvironment(environment: LegacyEnvironment): BootstrapEnvironment {
  return {
    environmentId: environment.id,
    name: environment.name,
    entries: environment.files.map((file: LegacyManagedFile) => ({
      path: file.name.replace(/\\/g, "/"),
      state: "present",
      content: [...new TextEncoder().encode(file.content)],
    })),
  };
}

export function buildLegacyMigrationDraft(
  profileId: string,
  projectId: string,
  projectPath: string,
  environments: LegacyEnvironment[],
  legacyActiveEnvironmentId: string | null,
): LegacyMigrationDraft | null {
  if (environments.length === 0) return null;
  const expected = JSON.stringify(pathsOf(environments[0]));
  const consistent = environments.every(
    (environment) => JSON.stringify(pathsOf(environment)) === expected,
  );
  if (consistent) return null;
  return {
    profileId,
    projectId,
    projectPath,
    managedPaths: sortedUniquePaths(environments),
    environments: environments.map(toBootstrapEnvironment),
    legacyActiveEnvironmentId,
    reason: "collection-mismatch",
  };
}

export function buildLegacyBootstrapImportRequest(
  profileId: string,
  projectId: string,
  projectPath: string,
  environments: LegacyEnvironment[],
): BootstrapImportRequest | null {
  if (environments.length === 0) return null;
  const expected = JSON.stringify(pathsOf(environments[0]));
  if (!environments.every((environment) => JSON.stringify(pathsOf(environment)) === expected)) {
    return null;
  }
  return {
    project: { profileId, projectId, projectPath },
    managedPaths: sortedUniquePaths(environments),
    environments: environments.map(toBootstrapEnvironment),
  };
}

/** @deprecated Use buildLegacyBootstrapImportRequest for first import data. */
export const buildLegacyMigrationRequest = buildLegacyBootstrapImportRequest;

/**
 * Migrate one legacy project only after Rust confirms the write. Legacy keys
 * remain intact on every error, so an interrupted migration can be retried.
 */
export async function migrateLegacyEnvironmentData(options: {
  store: LegacyEnvironmentStore;
  api: EnvironmentApi;
  profileId: string;
  projectId: string;
  projectPath: string;
}): Promise<LegacyMigrationResult> {
  const { store, api, profileId, projectId, projectPath } = options;
  const environments = (await store.get<LegacyEnvironment[]>(legacyKey(projectId))) ?? [];
  if (environments.length === 0) return { status: "none" };
  const active = (await store.get<string>(legacyActiveKey(projectId))) ?? null;
  const request = buildLegacyBootstrapImportRequest(profileId, projectId, projectPath, environments);
  if (!request) {
    return {
      status: "required",
      draft: buildLegacyMigrationDraft(profileId, projectId, projectPath, environments, active)!,
    };
  }
  try {
    const state = await api.bootstrapImport(request);
    await clearLegacyEnvironmentData(store, projectId);
    return { status: "migrated", state };
  } catch (error) {
    return { status: "failed", error };
  }
}
