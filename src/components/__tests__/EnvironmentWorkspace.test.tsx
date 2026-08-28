import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { buildMigrationEnvironments, EnvironmentWorkspace, type EnvironmentWorkspaceProps } from "@/components/EnvironmentWorkspace";
import type { EnvironmentProjectState, LegacyMigrationDraft } from "@/lib/environment-types";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => "A=1") }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

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
  const manyState: EnvironmentProjectState = {
    ...state,
    environments: [
      { id: "dev", name: "开发", fileCount: 1 },
      { id: "staging", name: "预发布", fileCount: 1 },
      { id: "prod", name: "生产", fileCount: 1 },
    ],
  };

  it("keeps file list, creation, and selection count on the first row", () => {
    const { container } = render(<EnvironmentWorkspace {...props()} />);

    const firstRow = screen.getByRole("button", { name: "文件清单" }).parentElement as HTMLElement;
    const secondRow = screen.getByRole("button", { name: "捕获更新" }).parentElement as HTMLElement;
    const toolbar = container.querySelector("[data-environment-toolbar]");
    const list = container.querySelector("[data-environment-list]");

    expect(toolbar).toHaveClass("shrink-0");
    expect(list).toHaveClass("min-h-0", "flex-1", "overflow-y-auto", "scrollbar-none");
    expect(toolbar).not.toContainElement(list);
    expect(list).not.toContainElement(screen.getByRole("button", { name: "文件清单" }));
    expect(within(firstRow).getByRole("button", { name: "新建" })).toBeInTheDocument();
    expect(within(firstRow).queryByRole("button", { name: "捕获更新" })).not.toBeInTheDocument();
    expect(within(firstRow).getByText("已选 0 个")).toHaveClass("ml-auto");
    expect(within(secondRow).queryByText("已选 0 个")).not.toBeInTheDocument();
  });

  it("selects every environment when inverting an empty selection", () => {
    render(<EnvironmentWorkspace {...props({ state: manyState })} />);

    fireEvent.click(screen.getByRole("button", { name: "反选" }));

    expect(screen.getByText("已选 3 个")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 预发布" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 生产" })).toBeChecked();
  });

  it("selects only the previously unselected environments when inverting", () => {
    render(<EnvironmentWorkspace {...props({ state: manyState })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "反选" }));

    expect(screen.getByText("已选 2 个")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 预发布" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 生产" })).toBeChecked();
  });

  it("uses a darker default gray surface and a brighter selected surface", () => {
    render(<EnvironmentWorkspace {...props({ state: manyState })} />);
    const developmentRow = screen.getByText("开发").closest("[data-environment-row]") as HTMLElement;
    const stagingRow = screen.getByText("预发布").closest("[data-environment-row]") as HTMLElement;

    expect(developmentRow).toHaveClass("bg-muted/40");
    expect(stagingRow).toHaveClass("bg-muted/40");

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));

    expect(developmentRow).toHaveClass("bg-muted/70", "border-white/25");
    expect(stagingRow).toHaveClass("bg-muted/40", "border-border");
  });

  it("makes environment actions visible while keeping disabled actions subdued", () => {
    render(<EnvironmentWorkspace {...props({ state: manyState })} />);

    for (const name of ["文件清单", "反选", "捕获更新", "应用", "复制"]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "border-white/20",
        "bg-white/5",
        "text-foreground",
        "hover:border-white/30",
        "hover:bg-white/15",
      );
    }
    const deleteButton = screen.getByRole("button", { name: "删除" });
    expect(deleteButton).toHaveClass("border-red-400/40", "bg-red-500/10", "text-red-200", "hover:border-red-300/60", "hover:bg-red-500/20");
    expect(screen.getByRole("button", { name: "捕获更新" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "复制" })).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "新建" })).not.toHaveClass("bg-white/5");
  });

  it("disables invert selection without environments or editing permission", () => {
    const emptyState = { ...state, environments: [] };
    const { rerender } = render(<EnvironmentWorkspace {...props({ state: emptyState })} />);

    expect(screen.getByRole("button", { name: "反选" })).toBeDisabled();

    rerender(<EnvironmentWorkspace {...props({ busy: true })} />);
    expect(screen.getByRole("button", { name: "反选" })).toBeDisabled();
  });

  it("uses one confirmation for batch capture, preserves list order, and keeps apply single-select", async () => {
    const onCaptureMany = vi.fn().mockResolvedValue({
      results: [
        { environmentId: "dev", success: true, state: manyState },
        { environmentId: "staging", success: false, error: new Error("capture failed") },
      ],
      state: manyState,
    });
    render(<EnvironmentWorkspace {...props({ state: manyState, onCaptureMany })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 预发布" }));
    expect(screen.getByRole("button", { name: "捕获更新" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "捕获更新" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("开发")).toBeInTheDocument();
    expect(within(dialog).getByText("预发布")).toBeInTheDocument();
    expect(dialog.querySelector(".max-h-40")).toHaveClass("mt-4");
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 预发布", hidden: true })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认捕获" }));
    await waitFor(() => expect(onCaptureMany).toHaveBeenCalledWith(["dev", "staging"]));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 预发布" })).not.toBeChecked();
  });

  it("keeps batch capture selection when the request throws", async () => {
    const onCaptureMany = vi.fn().mockRejectedValue(new Error("capture request failed"));
    render(<EnvironmentWorkspace {...props({ state: manyState, onCaptureMany })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 预发布" }));
    fireEvent.click(screen.getByRole("button", { name: "捕获更新" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "确认捕获" }));

    await waitFor(() => expect(onCaptureMany).toHaveBeenCalledWith(["dev", "staging"]));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 预发布", hidden: true })).toBeChecked();
  });

  it("shows every selected environment as waiting before a new progress operation takes over old results", async () => {
    let resolveBatch: ((value: unknown) => void) | undefined;
    const onCaptureMany = vi.fn(() => new Promise((resolve) => { resolveBatch = resolve; }));
    const progress = {
      dev: { operationId: "old-capture", kind: "capture" as const, completedFiles: 1, totalFiles: 1, percent: 100, status: "success" as const },
      staging: { operationId: "old-apply", kind: "apply" as const, completedFiles: 1, totalFiles: 1, percent: 100, status: "failed" as const },
    };
    const { rerender } = render(<EnvironmentWorkspace {...props({ state: manyState, progress, onCaptureMany })} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 预发布" }));
    fireEvent.click(screen.getByRole("button", { name: "捕获更新" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "确认捕获" }));

    const devRow = screen.getByText("开发").closest("[data-environment-row]") as HTMLElement;
    const stagingRow = screen.getByText("预发布").closest("[data-environment-row]") as HTMLElement;
    expect(devRow.querySelector("[data-progress-status]")).toHaveAttribute("data-progress-status", "waiting");
    expect(stagingRow.querySelector("[data-progress-status]")).toHaveAttribute("data-progress-status", "waiting");

    rerender(<EnvironmentWorkspace {...props({ state: manyState, progress: {
      ...progress,
      dev: { operationId: "new-capture", kind: "capture", completedFiles: 0, totalFiles: 1, percent: 0, status: "running" },
    }, onCaptureMany })} />);
    await waitFor(() => expect(devRow.querySelector("[data-progress-status]")).toHaveAttribute("data-progress-status", "running"));
    expect(stagingRow.querySelector("[data-progress-status]")).toHaveAttribute("data-progress-status", "waiting");
    resolveBatch?.({ results: [], state: manyState });
    await waitFor(() => expect(onCaptureMany).toHaveBeenCalledOnce());
  });

  it("enables delete for multiple selected environments with one confirmation", async () => {
    const onDeleteMany = vi.fn().mockResolvedValue({
      results: [
        { environmentId: "dev", success: true, state: manyState },
        { environmentId: "staging", success: false, error: new Error("delete failed") },
      ],
      state: manyState,
    });
    render(<EnvironmentWorkspace {...props({ state: manyState, onDeleteMany })} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 预发布" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(onDeleteMany).toHaveBeenCalledWith(["dev", "staging"]));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 预发布" })).not.toBeChecked();
  });

  it("keeps batch delete selection when the request throws", async () => {
    const onDeleteMany = vi.fn().mockRejectedValue(new Error("delete request failed"));
    render(<EnvironmentWorkspace {...props({ state: manyState, onDeleteMany })} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 预发布" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(onDeleteMany).toHaveBeenCalledWith(["dev", "staging"]));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择环境 预发布", hidden: true })).toBeChecked();
  });

  it("renders persisted per-environment progress without exposing it during planning", async () => {
    const progress = {
      dev: { operationId: "capture-1", kind: "capture" as const, completedFiles: 1, totalFiles: 4, percent: 25, status: "running" as const },
    };
    render(<EnvironmentWorkspace {...props({ progress })} />);
    expect(screen.getByRole("progressbar", { name: "开发 更新进度" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("更新处理中 25%")).toBeInTheDocument();
  });

  it("uses operation colors, prioritizes failed red, and shortens progress tracks", () => {
    const colorsState: EnvironmentProjectState = {
      ...state,
      environments: [
        { id: "apply", name: "应用环境", fileCount: 1 },
        { id: "capture", name: "更新环境", fileCount: 1 },
        { id: "copy", name: "复制环境", fileCount: 1 },
        { id: "failed", name: "失败环境", fileCount: 1 },
      ],
    };
    render(<EnvironmentWorkspace {...props({
      state: colorsState,
      progress: {
        apply: { operationId: "apply-1", kind: "apply", completedFiles: 1, totalFiles: 4, percent: 25, status: "running" },
        capture: { operationId: "capture-1", kind: "capture", completedFiles: 1, totalFiles: 1, percent: 100, status: "success" },
        copy: { operationId: "copy-1", kind: "copy", completedFiles: 1, totalFiles: 1, percent: 100, status: "success" },
        failed: { operationId: "failed-1", kind: "apply", completedFiles: 1, totalFiles: 2, percent: 50, status: "failed" },
      },
    })} />);

    expect(screen.getByText("应用处理中 25%")).toHaveClass("text-right");
    expect(screen.getByText("更新成功 100%")).toHaveClass("text-right");
    expect(screen.getByText("复制成功 100%")).toHaveClass("text-right");
    expect(screen.getByText("应用失败")).toHaveClass("text-right");
    expect(screen.getByRole("progressbar", { name: "应用环境 应用进度" }).firstElementChild).toHaveClass("bg-green-400");
    expect(screen.getByRole("progressbar", { name: "更新环境 更新进度" }).firstElementChild).toHaveClass("bg-cyan-400");
    expect(screen.getByRole("progressbar", { name: "复制环境 复制进度" }).firstElementChild).toHaveClass("bg-blue-400");
    expect(screen.getByRole("progressbar", { name: "失败环境 应用进度" }).firstElementChild).toHaveClass("bg-red-400");
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
    for (const progressbar of screen.getAllByRole("progressbar")) expect(progressbar).toHaveClass("w-2/3", "ml-auto");
  });

  it("gives names most of the row and orders status before file count", () => {
    render(<EnvironmentWorkspace {...props()} />);
    const row = screen.getByText("开发").closest("[data-environment-row]");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("min-w-0", "items-center", "grid-cols-[minmax(0,1fr)_minmax(5rem,9rem)_auto_auto]");
    expect(row).not.toHaveClass("flex", "flex-wrap", "sm:flex-nowrap");

    const selectionCell = row?.querySelector("label");
    expect(selectionCell).toHaveClass("-ml-3", "-my-2", "min-w-0", "self-stretch", "items-center", "py-2", "pl-3", "cursor-pointer");
    expect(selectionCell).toHaveAttribute("for", "environment-select-dev");
    expect(within(selectionCell as HTMLElement).getByRole("checkbox", { name: "选择环境 开发" })).toHaveAttribute("id", "environment-select-dev");

    const columns = row;
    expect(columns).toHaveClass(
      "min-w-0",
      "grid-cols-[minmax(0,1fr)_minmax(5rem,9rem)_auto_auto]",
      "gap-x-2",
    );
    expect(within(columns as HTMLElement).getByText("开发")).toHaveClass("min-w-0", "truncate");
    expect(within(columns as HTMLElement).getByText("就绪")).toHaveClass("min-w-0", "text-right");
    const readyProgress = columns?.querySelector("[data-ready-progress]");
    expect(readyProgress).toHaveClass("h-1.5", "w-2/3", "ml-auto", "rounded-full", "bg-white");
    expect(within(columns as HTMLElement).queryAllByRole("progressbar")).toHaveLength(0);
    expect(within(columns as HTMLElement).getByText("文件：1")).toHaveClass("whitespace-nowrap");
    const viewButton = within(columns as HTMLElement).getByRole("button", { name: "查看" });
    expect(viewButton).toHaveClass("min-w-0", "size-7");
    expect(viewButton).toHaveAttribute("aria-label", "查看");
    expect(viewButton).not.toHaveAttribute("title");
    expect(viewButton.textContent).toBe("");
    expect(within(columns as HTMLElement).queryByText("查看")).not.toBeInTheDocument();
    expect(Array.from(columns?.children ?? []).map((column) => column.textContent)).toEqual(["开发", "就绪", "文件：1", ""]);

    const longName = "这是一个非常长的环境名称用于测试省略显示";
    const { unmount } = render(<EnvironmentWorkspace {...props({
      state: { ...state, environments: [{ id: "long", name: longName, fileCount: 2 }] },
    })} />);
    const name = screen.getByText(longName);
    expect(name).toHaveClass("min-w-0", "truncate");
    expect(name).not.toHaveAttribute("title");
    unmount();
  });

  it("toggles from the full first column without selecting from the right side", () => {
    render(<EnvironmentWorkspace {...props()} />);
    const row = screen.getByText("开发").closest("[data-environment-row]") as HTMLElement;
    const selectionCell = row.querySelector("label") as HTMLElement;
    const checkbox = screen.getByRole("checkbox", { name: "选择环境 开发" });

    fireEvent.click(screen.getByText("开发"));
    expect(checkbox).toBeChecked();
    fireEvent.click(selectionCell);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(within(row).getByText("就绪"));
    fireEvent.click(within(row).getByText("文件：1"));
    expect(checkbox).toBeChecked();

    fireEvent.click(within(row).getByRole("button", { name: "查看" }));
    expect(screen.getByRole("heading", { name: "查看环境：开发" })).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("does not change selection from the first column when editing is disabled", () => {
    render(<EnvironmentWorkspace {...props({ busy: true })} />);
    const row = screen.getByText("开发").closest("[data-environment-row]") as HTMLElement;
    const selectionCell = row.querySelector("label") as HTMLElement;
    const checkbox = screen.getByRole("checkbox", { name: "选择环境 开发" });

    expect(selectionCell).toHaveClass("cursor-not-allowed");
    expect(checkbox).toBeDisabled();
    fireEvent.click(selectionCell);
    fireEvent.click(screen.getByText("开发"));
    expect(checkbox).not.toBeChecked();
  });

  it("keeps successful and failed progress states visible until the next operation", () => {
    const { rerender } = render(<EnvironmentWorkspace {...props({ progress: {
      dev: { operationId: "capture-1", kind: "capture", completedFiles: 1, totalFiles: 1, percent: 100, status: "success" },
    } })} />);
    expect(screen.getByText("更新成功 100%")).toBeInTheDocument();

    rerender(<EnvironmentWorkspace {...props({ progress: {
      dev: { operationId: "apply-1", kind: "apply", completedFiles: 1, totalFiles: 2, percent: 50, status: "failed", error: new Error("apply failed") },
    } })} />);
    expect(screen.getByText("应用失败")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "开发 应用进度" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("hides the overview copy and confirms environment snapshot deletion", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ...state, environments: [] });
    render(<EnvironmentWorkspace {...props({ onDelete })} />);

    expect(screen.queryByText("按项目保存配置文件快照，应用前会先列出文件变更。")).not.toBeInTheDocument();
    expect(screen.queryByText("项目环境")).not.toBeInTheDocument();
    expect(screen.queryByText("受管文件 1 个")).not.toBeInTheDocument();
    expect(screen.queryByText("环境 1 个")).not.toBeInTheDocument();
    const row = screen.getByText("开发").closest("[data-environment-row]");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("items-center", "px-3", "py-2");
    expect(within(row as HTMLElement).getByText("文件：1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/快照/)).toBeInTheDocument();
    expect(within(dialog).getByText(/不能恢复/)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "删除" }));
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
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await waitFor(() => expect(onPlan).toHaveBeenCalledWith("dev"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("覆盖")).toBeInTheDocument();
    const footer = within(dialog).getByRole("button", { name: "取消" }).parentElement;
    expect(footer).toHaveAttribute("data-slot", "dialog-footer");
    expect(footer?.parentElement).toHaveAttribute("data-slot", "dialog-content");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认应用" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith("dev", "token-1"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).not.toBeChecked();
  });

  it("uses fixed columns for short and long application plan file names", async () => {
    const shortPath = "COOK.txt";
    const longPath = "这是一个非常长的中文文件名称用于验证应用变更明细不会挤压状态列.txt";
    const onPlan = vi.fn().mockResolvedValue({
      token: "token-1",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 1,
      changes: [
        { path: shortPath, action: "overwrite", currentState: "present", targetState: "present", currentDigest: "a", targetDigest: "b", targetSize: 3 },
        { path: longPath, action: "delete", currentState: "present", targetState: "absent", currentDigest: "b", targetDigest: null, targetSize: null },
      ],
    });
    render(<EnvironmentWorkspace {...props({ onPlan })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    const dialog = await screen.findByRole("dialog");
    const shortPathElement = within(dialog).getByText(shortPath);
    const longPathElement = within(dialog).getByText(longPath);
    const shortRow = shortPathElement.parentElement as HTMLElement;
    const longRow = longPathElement.parentElement as HTMLElement;

    for (const row of [shortRow, longRow]) expect(row).toHaveClass("grid", "grid-cols-[3rem_minmax(0,1fr)]", "items-center", "gap-x-3");
    expect(shortPathElement).toHaveClass("min-w-0", "truncate", "text-sm");
    expect(longPathElement).toHaveClass("min-w-0", "truncate", "text-sm");
    expect(within(shortRow).getByText("覆盖")).toHaveClass("whitespace-nowrap", "text-xs");
    expect(within(longRow).getByText("删除")).toHaveClass("whitespace-nowrap", "text-xs");
  });

  it("keeps selection when apply is stale or throws", async () => {
    const onApply = vi.fn()
      .mockResolvedValueOnce({ applied: false, stale: true, plan: {
        token: "token-2", profileId: state.profileId, projectId: state.projectId, environmentId: "dev", generation: 2, changes: [],
      }, undoAvailable: true })
      .mockRejectedValueOnce(new Error("apply request failed"));
    render(<EnvironmentWorkspace {...props({ onApply })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认应用" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith("dev", "token-1"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();

    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "确认应用" }));
    await waitFor(() => expect(onApply).toHaveBeenLastCalledWith("dev", "token-2"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();
  });

  it("asks before capturing external file changes and supports copying an environment", async () => {
    const onCapture = vi.fn().mockResolvedValue(state);
    const onCopy = vi.fn().mockResolvedValue(state);
    render(<EnvironmentWorkspace {...props({ onCapture, onCopy })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "捕获更新" }));
    expect(screen.getByText("确认捕获更新？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认捕获" }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith("dev"));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));

    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    fireEvent.change(screen.getByPlaceholderText("环境名称"), { target: { value: "测试" } });
    fireEvent.click(screen.getByRole("radio", { name: "复制已有环境" }));
    const createDialog = screen.getByRole("dialog");
    const copySourceSelect = within(createDialog).getByRole("combobox", { name: "选择复制来源" });
    expect(copySourceSelect).toHaveAttribute("data-slot", "select-trigger");
    expect(copySourceSelect).toHaveClass("w-full");
    expect(copySourceSelect).toHaveTextContent("开发");
    const createFooter = within(createDialog).getByRole("button", { name: "取消" }).parentElement;
    expect(createFooter).toHaveAttribute("data-slot", "dialog-footer");
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("dev", "测试"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).not.toBeChecked();
  });

  it("keeps selection when copying an environment fails", async () => {
    const onCopy = vi.fn().mockRejectedValue(new Error("copy request failed"));
    render(<EnvironmentWorkspace {...props({ onCopy })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    fireEvent.change(screen.getByPlaceholderText("环境名称"), { target: { value: "测试" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("dev", "测试"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();
  });

  it("keeps selection for a regular new environment", async () => {
    const onCreate = vi.fn().mockResolvedValue(state);
    render(<EnvironmentWorkspace {...props({ onCreate })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    fireEvent.change(screen.getByPlaceholderText("环境名称"), { target: { value: "测试" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("测试", [".env"]));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).toBeChecked();
  });

  it("opens the managed file picker at the project root without a manual path input", async () => {
    const openFileDialogMock = vi.mocked(openFileDialog);
    openFileDialogMock.mockReset().mockResolvedValue(null);
    render(<EnvironmentWorkspace {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: "文件清单" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByPlaceholderText("输入项目内相对路径")).not.toBeInTheDocument();
    const footer = within(dialog).getByRole("button", { name: "取消" }).parentElement;
    expect(footer).toHaveAttribute("data-slot", "dialog-footer");
    expect(footer?.parentElement).toHaveAttribute("data-slot", "dialog-content");

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
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "copy" } });
    fireEvent.click(screen.getByRole("combobox", { name: "选择来源环境" }));
    fireEvent.click(await screen.findByRole("option", { name: "prod" }));

    rerender(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: migrationDraft([{ path: "local.txt", state: "absent", content: null }]), onMigrate })} />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: "选择来源环境" })).toHaveTextContent("选择来源环境"));
    expect(screen.getByRole("button", { name: "完成迁移" })).toBeDisabled();
    expect(screen.getByText("请选择来源环境")).toBeInTheDocument();
    expect(onMigrate).not.toHaveBeenCalled();
  });

  it("copies the selected present source into the migration request", async () => {
    const onMigrate = vi.fn().mockResolvedValue(state);
    render(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: migrationDraft(), onMigrate })} />);

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "copy" } });
    fireEvent.click(screen.getByRole("combobox", { name: "选择来源环境" }));
    fireEvent.click(await screen.findByRole("option", { name: "prod" }));
    fireEvent.click(screen.getByRole("button", { name: "完成迁移" }));

    await waitFor(() => expect(onMigrate).toHaveBeenCalledOnce());
    expect(onMigrate.mock.calls[0][0].environments[0].entries).toEqual([{ path: "local.txt", state: "present", content: [80] }]);
  });

  it("keeps a long migration source selectable through the shared Select", async () => {
    const longSourceId = "1".repeat(160);
    const onMigrate = vi.fn().mockResolvedValue(state);
    const draft = migrationDraft();
    draft.environments[1].environmentId = longSourceId;
    render(<EnvironmentWorkspace {...props({ migrationRequired: true, migrationDraft: draft, onMigrate })} />);

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "copy" } });
    const sourceSelect = screen.getByRole("combobox", { name: "选择来源环境" });
    expect(sourceSelect).toHaveAttribute("data-slot", "select-trigger");
    fireEvent.click(sourceSelect);
    fireEvent.click(await screen.findByRole("option", { name: longSourceId }));

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

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    await waitFor(() => expect(onPlanUndo).toHaveBeenCalledOnce());
    const undoDialog = await screen.findByRole("alertdialog");
    expect(within(undoDialog).getByText("新建")).toBeInTheDocument();
    expect(within(undoDialog).getByText("覆盖")).toBeInTheDocument();
    expect(within(undoDialog).getByText("删除")).toBeInTheDocument();
    expect(within(undoDialog).getByText("不变")).toBeInTheDocument();
    fireEvent.click(within(undoDialog).getByRole("button", { name: "确认撤销" }));
    await waitFor(() => expect(onUndo).toHaveBeenCalledWith("dev", "undo-token-1"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();
    expect(within(await screen.findByRole("alertdialog")).getByText("删除")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "确认撤销" }));
    await waitFor(() => expect(onUndo).toHaveBeenLastCalledWith("dev", "undo-token-2"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发" })).not.toBeChecked();
  });

  it("uses fixed columns for short and long undo plan file names", async () => {
    const shortPath = "COOK.txt";
    const longPath = "这是一个非常长的中文文件名称用于验证撤销变更明细不会挤压状态列.txt";
    const onPlanUndo = vi.fn().mockResolvedValue({
      token: "undo-token-1",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 1,
      changes: [
        { path: shortPath, action: "overwrite", currentState: "present", targetState: "present", currentDigest: "a", targetDigest: "b", targetSize: 3 },
        { path: longPath, action: "delete", currentState: "present", targetState: "absent", currentDigest: "b", targetDigest: null, targetSize: null },
      ],
    });
    render(<EnvironmentWorkspace {...props({ onPlanUndo })} />);

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    const dialog = await screen.findByRole("alertdialog");
    const shortPathElement = within(dialog).getByText(shortPath);
    const longPathElement = within(dialog).getByText(longPath);
    const shortRow = shortPathElement.parentElement as HTMLElement;
    const longRow = longPathElement.parentElement as HTMLElement;

    for (const row of [shortRow, longRow]) expect(row).toHaveClass("grid", "grid-cols-[3rem_minmax(0,1fr)]", "items-center", "gap-x-3");
    expect(shortPathElement).toHaveClass("min-w-0", "truncate", "text-sm");
    expect(longPathElement).toHaveClass("min-w-0", "truncate", "text-sm");
    expect(within(shortRow).getByText("覆盖")).toHaveClass("whitespace-nowrap", "text-xs");
    expect(within(longRow).getByText("删除")).toHaveClass("whitespace-nowrap", "text-xs");
  });

  it("keeps selection when undo throws", async () => {
    const onPlanUndo = vi.fn().mockResolvedValue({
      token: "undo-token-1", profileId: state.profileId, projectId: state.projectId, environmentId: "dev", generation: 1, changes: [],
    });
    const onUndo = vi.fn().mockRejectedValue(new Error("undo request failed"));
    render(<EnvironmentWorkspace {...props({ onPlanUndo, onUndo })} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "选择环境 开发" }));
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认撤销" }));

    await waitFor(() => expect(onUndo).toHaveBeenCalledWith("dev", "undo-token-1"));
    expect(screen.getByRole("checkbox", { name: "选择环境 开发", hidden: true })).toBeChecked();
  });

  it("shows undo progress in the confirmation dialog without adding it to the environment row", async () => {
    const onPlanUndo = vi.fn().mockResolvedValue({
      token: "undo-token-1",
      profileId: state.profileId,
      projectId: state.projectId,
      environmentId: "dev",
      generation: 1,
      changes: [],
    });
    render(<EnvironmentWorkspace {...props({
      onPlanUndo,
      progress: {
        dev: { operationId: "undo-1", kind: "undo", completedFiles: 1, totalFiles: 4, percent: 25, status: "running" },
      },
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("撤销处理中 25%")).toBeInTheDocument();
    expect(within(dialog).getByRole("progressbar", { name: "撤销进度" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("开发").closest("[data-environment-row]")).not.toContainElement(screen.queryByRole("progressbar", { name: "撤销进度" }));
  });
});
