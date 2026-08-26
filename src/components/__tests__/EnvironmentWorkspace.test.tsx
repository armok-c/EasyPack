import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { buildMigrationEnvironments, EnvironmentWorkspace, type EnvironmentWorkspaceProps } from "@/components/EnvironmentWorkspace";
import type { EnvironmentProjectState, LegacyMigrationDraft } from "@/lib/environment-types";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => "A=1") }));

const state: EnvironmentProjectState = {
  profileId: "profile-a",
  projectId: "project-a",
  projectPath: "C:\\Project",
  managedPaths: [".env"],
  environments: [{ id: "dev", name: "开发", fileCount: 1 }],
  undoAvailable: true,
  blocked: false,
};

function props(overrides: Partial<EnvironmentWorkspaceProps> = {}): EnvironmentWorkspaceProps {
  return {
    projectPath: state.projectPath,
    state,
    busy: false,
    error: null,
    recoveryBlocked: false,
    recoveryError: null,
    migrationRequired: false,
    migrationDraft: null,
    onRefresh: vi.fn().mockResolvedValue(state),
    onCreate: vi.fn().mockResolvedValue(state),
    onCapture: vi.fn().mockResolvedValue(state),
    onCopy: vi.fn().mockResolvedValue(state),
    onDelete: vi.fn().mockResolvedValue(state),
    onMigrate: vi.fn().mockResolvedValue(state),
    onPlan: vi.fn().mockResolvedValue({
      token: "token-1",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 1,
      changes: [{ path: ".env", action: "overwrite", currentState: "present", targetState: "present", currentDigest: "a", targetDigest: "b", targetSize: 3 }],
    }),
    onApply: vi.fn().mockResolvedValue({ applied: true, stale: false, plan: { token: "token-1", profileId: state.profileId, projectId: state.projectId, environmentId: "dev", generation: 1, changes: [] }, undoAvailable: true }),
    onPlanUndo: vi.fn().mockResolvedValue({ token: "undo-token-1", profileId: state.profileId, projectId: state.projectId, environmentId: "dev", generation: 1, changes: [] }),
    onUndo: vi.fn().mockResolvedValue({ applied: true, stale: false, plan: { token: "token-1", profileId: state.profileId, projectId: state.projectId, environmentId: "dev", generation: 1, changes: [] }, undoAvailable: false }),
    ...overrides,
  };
}

function migrationDraft(sourceEntries: LegacyMigrationDraft["environments"][number]["entries"] = [{ path: "local.txt", state: "present", content: [80] }]): LegacyMigrationDraft {
  return {
    profileId: "profile-a",
    projectId: "project-a",
    projectPath: state.projectPath,
    managedPaths: ["local.txt"],
    environments: [
      { environmentId: "dev", name: "开发", entries: [] },
      { environmentId: "prod", name: "生产", entries: sourceEntries },
    ],
    legacyActiveEnvironmentId: null,
    reason: "collection-mismatch",
  };
}

describe("EnvironmentWorkspace", () => {
  it("hides the overview copy and confirms environment snapshot deletion", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ...state, environments: [] });
    render(<EnvironmentWorkspace {...props({ onDelete })} />);

    expect(screen.queryByText("按项目保存配置文件快照，应用前会先列出文件变更。")).not.toBeInTheDocument();
    expect(screen.queryByText("受管文件 1 个")).not.toBeInTheDocument();
    expect(screen.queryByText("环境 1 个")).not.toBeInTheDocument();
    const row = screen.getByText("开发").closest("[data-environment-row]");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("items-center", "px-3", "py-2");
    expect(within(row as HTMLElement).getByText("1 个文件")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除环境 开发" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/快照/)).toBeInTheDocument();
    expect(within(dialog).getByText(/不能恢复/)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "删除环境 开发" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("dev"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("requires and confirms an apply plan without exposing legacy applied state", async () => {
    const onPlan = vi.fn().mockResolvedValue({
      token: "token-1",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 1,
      changes: [{ path: ".env", action: "overwrite", currentState: "present", targetState: "present", currentDigest: "a", targetDigest: "b", targetSize: 3 }],
    });
    const onApply = vi.fn().mockResolvedValue({ applied: true, stale: false, plan: { token: "token-1", profileId: "profile-a", projectId: "project-a", environmentId: "dev", generation: 1, changes: [] }, undoAvailable: true });
    render(<EnvironmentWorkspace {...props({ onPlan, onApply })} />);

    expect(screen.queryByText("已应用")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await waitFor(() => expect(onPlan).toHaveBeenCalledWith("dev"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("覆盖")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认应用" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith("dev", "token-1"));
  });

  it("asks before capturing external file changes and supports copying an environment", async () => {
    const onCapture = vi.fn().mockResolvedValue(state);
    const onCopy = vi.fn().mockResolvedValue(state);
    render(<EnvironmentWorkspace {...props({ onCapture, onCopy })} />);

    fireEvent.click(screen.getByRole("button", { name: "捕获更新" }));
    expect(screen.getByText("确认捕获更新？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认捕获" }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith("dev"));

    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    fireEvent.change(screen.getByPlaceholderText("环境名称"), { target: { value: "测试" } });
    fireEvent.click(screen.getByRole("radio", { name: "复制已有环境" }));
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("dev", "测试"));
  });

  it("opens the managed file picker at the project root without a manual path input", async () => {
    const openFileDialogMock = vi.mocked(openFileDialog);
    openFileDialogMock.mockReset().mockResolvedValue(null);
    render(<EnvironmentWorkspace {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: "受管文件清单" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByPlaceholderText("输入项目内相对路径")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "选择文件" }));
    await waitFor(() => expect(openFileDialogMock).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: state.projectPath })));
  });

  it("blocks the main workflow behind the legacy migration wizard", () => {
    const draft: LegacyMigrationDraft = {
      profileId: "profile-a",
      projectId: "project-a",
      projectPath: state.projectPath,
      managedPaths: [".env", "local.txt"],
      environments: [{ environmentId: "dev", name: "dev", entries: [{ path: ".env", state: "present", content: [65] }] }],
      legacyActiveEnvironmentId: null,
      reason: "collection-mismatch",
    };
    render(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: draft })} />);
    expect(screen.getByText("需要补齐旧环境清单")).toBeInTheDocument();
    expect(screen.getByText("dev / local.txt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "应用" })).not.toBeInTheDocument();
  });

  it("disables migration when copy has no source and shows a plain error", () => {
    const onMigrate = vi.fn().mockResolvedValue(state);
    render(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: migrationDraft(), onMigrate })} />);

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "copy" } });

    expect(screen.getByRole("button", { name: "完成迁移" })).toBeDisabled();
    expect(screen.getByText("请选择来源环境")).toBeInTheDocument();
    expect(onMigrate).not.toHaveBeenCalled();
  });

  it("disables migration when the selected source no longer has a present file", async () => {
    const draft = migrationDraft();
    const onMigrate = vi.fn().mockResolvedValue(state);
    const { rerender } = render(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: draft, onMigrate })} />);
    const comboboxes = screen.getAllByRole("combobox");
    fireEvent.change(comboboxes[0], { target: { value: "copy" } });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "prod" } });

    rerender(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: migrationDraft([{ path: "local.txt", state: "absent", content: null }]), onMigrate })} />);

    await waitFor(() => expect(screen.getAllByRole("combobox")[1]).toHaveValue(""));
    expect(screen.getByRole("button", { name: "完成迁移" })).toBeDisabled();
    expect(screen.getByText("请选择来源环境")).toBeInTheDocument();
    expect(onMigrate).not.toHaveBeenCalled();
  });

  it("copies the selected present source into the migration request", async () => {
    const onMigrate = vi.fn().mockResolvedValue(state);
    render(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: migrationDraft(), onMigrate })} />);

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "copy" } });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "prod" } });
    fireEvent.click(screen.getByRole("button", { name: "完成迁移" }));

    await waitFor(() => expect(onMigrate).toHaveBeenCalledOnce());
    expect(onMigrate.mock.calls[0][0].environments[0].entries).toEqual([{ path: "local.txt", state: "present", content: [80] }]);
  });

  it("rejects an invalid copy while constructing the migration request", async () => {
    await expect(buildMigrationEnvironments({
      draft: migrationDraft(),
      projectPath: state.projectPath,
      choices: { "dev:local.txt": "copy" },
      sources: { "dev:local.txt": "missing" },
    })).rejects.toThrow("请选择有效来源环境");
  });

  it("shows recovery evidence and retries loading the project", async () => {
    const onRefresh = vi.fn().mockResolvedValue(state);
    render(<EnvironmentWorkspace {...props({ recoveryBlocked: true, recoveryError: "rollback-failed", onRefresh })} />);

    expect(screen.getByText("恢复提示：rollback-failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试恢复" }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
  });

  it("shows the undo plan before confirming and refreshes it when stale", async () => {
    const undoPlan = { token: "undo-token-1", profileId: state.profileId, projectId: state.projectId, environmentId: "dev", generation: 1, changes: [
      { path: ".env", action: "overwrite", currentState: "present", targetState: "present", currentDigest: "a", targetDigest: "b", targetSize: 3 },
      { path: "new.env", action: "create", currentState: "absent", targetState: "present", currentDigest: null, targetDigest: "c", targetSize: 3 },
      { path: "gone.env", action: "delete", currentState: "present", targetState: "absent", currentDigest: "d", targetDigest: null, targetSize: null },
      { path: "same.env", action: "unchanged", currentState: "present", targetState: "present", currentDigest: "e", targetDigest: "e", targetSize: 3 },
    ] } as const;
    const refreshedPlan = { token: "undo-token-2", profileId: state.profileId, projectId: state.projectId, environmentId: "dev", generation: 2, changes: [{ path: ".env", action: "delete", currentState: "present", targetState: "absent", currentDigest: "b", targetDigest: null, targetSize: null }] } as const;
    const onPlanUndo = vi.fn().mockResolvedValue(undoPlan);
    const onUndo = vi.fn()
      .mockResolvedValueOnce({ applied: false, stale: true, plan: refreshedPlan, undoAvailable: true })
      .mockResolvedValueOnce({ applied: true, stale: false, plan: refreshedPlan, undoAvailable: false });
    render(<EnvironmentWorkspace {...props({ onPlanUndo, onUndo })} />);

    fireEvent.click(screen.getByRole("button", { name: "撤销上次应用" }));
    await waitFor(() => expect(onPlanUndo).toHaveBeenCalledOnce());
    const undoDialog = await screen.findByRole("alertdialog");
    expect(within(undoDialog).getByText("新建")).toBeInTheDocument();
    expect(within(undoDialog).getByText("覆盖")).toBeInTheDocument();
    expect(within(undoDialog).getByText("删除")).toBeInTheDocument();
    expect(within(undoDialog).getByText("不变")).toBeInTheDocument();
    fireEvent.click(within(undoDialog).getByRole("button", { name: "确认撤销" }));
    await waitFor(() => expect(onUndo).toHaveBeenCalledWith("undo-token-1"));
    expect(within(await screen.findByRole("alertdialog")).getByText("删除")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "确认撤销" }));
    await waitFor(() => expect(onUndo).toHaveBeenLastCalledWith("undo-token-2"));
  });
});
