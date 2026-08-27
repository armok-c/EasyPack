import { describe, expect, it, vi } from "vitest";
import {
  buildLegacyMigrationDraft,
  buildLegacyBootstrapImportRequest,
  createEnvironmentApi,
  migrateLegacyEnvironmentData,
  type LegacyEnvironment,
  type LegacyManagedFile,
  type EnvironmentProjectState,
} from "@/lib/environment-types";

const project = {
  profileId: "profile-a",
  projectId: "project-a",
  projectPath: "C:\\Workspace\\Project",
};

const legacy = (id: string, files: LegacyEnvironment["files"]): LegacyEnvironment => ({
  id,
  name: id,
  createdAt: 1,
  updatedAt: 2,
  files,
});

const file = (name: string, content: string): LegacyManagedFile => ({ name, content, addedAt: 1 });

const state: EnvironmentProjectState = {
  ...project,
  managedPaths: [".env"],
  environments: [{ id: "dev", name: "dev", fileCount: 1 }],
  undoAvailable: false,
  blocked: false,
};

describe("environment API boundary", () => {
  it("maps every command to the Rust payload shape", async () => {
    const calls: Array<[string, unknown]> = [];
    const invoke = vi.fn(async <T,>(command: string, args?: Record<string, unknown>) => {
      calls.push([command, args]);
      return (command === "environment_plan"
        ? { token: "token" }
        : command.includes("prepare_delete")
          ? { token: "delete-token", projectCount: 1 }
          : state) as T;
    });
    const api = createEnvironmentApi(invoke);

    await api.openProject(project);
    await api.getProjectPath({ profileId: project.profileId, projectId: project.projectId });
    await api.create({ project, name: "dev", managedPaths: [".env"] });
    await api.capture({ project, environmentId: "dev", operationId: "capture-001" });
    await api.detail({ project, environmentId: "dev", path: ".env" });
    await api.copy({ project, environmentId: "dev", name: "test" });
    await api.deleteEnvironment({ project, environmentId: "dev", operationId: "delete-001" });
    await api.migrateManifest({ project, managedPaths: [".env"], environments: [] });
    await api.bootstrapImport({
      project,
      managedPaths: [".env"],
      environments: [{ environmentId: "dev", name: "dev", entries: [{ path: ".env", state: "present", content: [65] }] }],
    });
    await api.rebindProject({ project, newProjectPath: "D:\\Project" });
    await api.plan({ project, environmentId: "dev", operationId: "plan-001" });
    await api.apply({ project, environmentId: "dev", planToken: "token", operationId: "apply-001" });
    await api.planUndo(project);
    await api.undo(project, "undo-token", "undo-001");
    await api.prepareDeleteProject({ profileId: project.profileId, projectId: project.projectId, operationId: "delete-token" });
    await api.prepareDeleteProfile({ profileId: project.profileId, operationId: "delete-token" });
    await api.finalizeDelete({ token: "delete-token" });
    await api.restoreDelete({ token: "delete-token" });
    await api.deleteStatus({ token: "delete-token" });

    expect(calls.map(([command]) => command)).toEqual([
      "environment_open_project",
      "environment_get_project_path",
      "environment_create",
      "environment_capture",
      "environment_detail",
      "environment_copy",
      "environment_delete",
      "environment_migrate_manifest",
      "environment_bootstrap_import",
      "environment_rebind_project",
      "environment_plan",
      "environment_apply",
      "environment_plan_undo",
      "environment_undo",
      "environment_prepare_delete_project",
      "environment_prepare_delete_profile",
      "environment_finalize_delete",
      "environment_restore_delete",
      "environment_delete_status",
    ]);
    expect(calls[0][1]).toEqual({ project });
    expect(calls[1][1]).toEqual({ request: { profileId: project.profileId, projectId: project.projectId } });
    expect(calls[2][1]).toEqual({ request: { project, name: "dev", managedPaths: [".env"] } });
    expect(calls[3][1]).toEqual({ request: { project, environmentId: "dev", operationId: "capture-001" } });
    expect(calls[4][1]).toEqual({ request: { project, environmentId: "dev", path: ".env" } });
    expect(calls[6][1]).toEqual({ request: { project, environmentId: "dev", operationId: "delete-001" } });
    expect(calls[10][1]).toEqual({ request: { project, environmentId: "dev", operationId: "plan-001" } });
    expect(calls[11][1]).toEqual({ request: { project, environmentId: "dev", planToken: "token", operationId: "apply-001" } });
    expect(calls[12][1]).toEqual({ project });
    expect(calls[13][1]).toEqual({ request: { project, planToken: "undo-token", operationId: "undo-001" } });
    expect(calls[9][1]).toEqual({ request: { project, newProjectPath: "D:\\Project" } });
    expect(calls[18][1]).toEqual({ request: { token: "delete-token" } });
  });
});

describe("legacy environment migration", () => {
  it("builds an automatic request for equal file collections and preserves bytes as UTF-8 arrays", () => {
    const environments = [
      legacy("dev", [file(".env", "A=1\r\n")]),
      legacy("test", [file(".env", "A=2")]),
    ];
    const request = buildLegacyBootstrapImportRequest("p", "id", "C:\\p", environments);

    expect(request?.managedPaths).toEqual([".env"]);
    expect(request?.environments[0]).toEqual({
      environmentId: "dev",
      name: "dev",
      entries: [{
        path: ".env",
        state: "present",
        content: [...new TextEncoder().encode("A=1\r\n")],
      }],
    });
  });

  it("returns a structured draft and never calls Rust for mismatched collections", () => {
    const environments = [
      legacy("dev", [file(".env", "A=1")]),
      legacy("test", [file(".env", "A=2"), file("extra.env", "B=2")]),
    ];
    const draft = buildLegacyMigrationDraft("p", "id", "C:\\p", environments, "dev");

    expect(draft).toMatchObject({
      profileId: "p",
      projectId: "id",
      managedPaths: [".env", "extra.env"],
      legacyActiveEnvironmentId: "dev",
      reason: "collection-mismatch",
    });
  });

  it("deletes old keys only after Rust migration succeeds", async () => {
    const environments = [legacy("dev", [file(".env", "A=1")])];
    const store = {
      get: vi.fn(async (key: string) => key === "projectEnvs:id" ? environments : key === "projectActiveEnv:id" ? "dev" : undefined),
      delete: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    };
    const bootstrapImport = vi.fn(async () => state);
    const api = { bootstrapImport } as never;

    const result = await migrateLegacyEnvironmentData({
      store,
      api,
      profileId: project.profileId,
      projectId: "id",
      projectPath: project.projectPath,
    });

    expect(result.status).toBe("migrated");
    expect(store.delete).toHaveBeenCalledWith("projectEnvs:id");
    expect(store.delete).toHaveBeenCalledWith("projectActiveEnv:id");
    expect(store.save).toHaveBeenCalledOnce();
  });

  it("keeps old keys when Rust migration fails", async () => {
    const environments = [legacy("dev", [file(".env", "A=1")])];
    const store = {
      get: vi.fn(async (key: string) => key === "projectEnvs:id" ? environments : undefined),
      delete: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    };
    const api = {
      bootstrapImport: vi.fn(async () => {
        throw new Error("migration failed");
      }),
    } as never;

    const result = await migrateLegacyEnvironmentData({
      store,
      api,
      profileId: project.profileId,
      projectId: "id",
      projectPath: project.projectPath,
    });

    expect(result.status).toBe("failed");
    expect(store.delete).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("is idempotent after a successful migration", async () => {
    const values = new Map<string, unknown>([
      ["projectEnvs:id", [legacy("dev", [file(".env", "A=1")])]],
      ["projectActiveEnv:id", "dev"],
    ]);
    const store = {
      get: vi.fn(async <T,>(key: string) => values.get(key) as T | undefined),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
      save: vi.fn(async () => undefined),
    };
    const bootstrapImport = vi.fn(async () => state);
    const api = { bootstrapImport } as never;

    const first = await migrateLegacyEnvironmentData({
      store,
      api,
      profileId: project.profileId,
      projectId: "id",
      projectPath: project.projectPath,
    });
    const second = await migrateLegacyEnvironmentData({
      store,
      api,
      profileId: project.profileId,
      projectId: "id",
      projectPath: project.projectPath,
    });

    expect(first.status).toBe("migrated");
    expect(second.status).toBe("none");
    expect(bootstrapImport).toHaveBeenCalledOnce();
  });
});
