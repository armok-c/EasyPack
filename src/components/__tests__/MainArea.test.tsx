import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createRef } from "react";
import { MainArea, type MainAreaHandle } from "@/components/MainArea";
import type { EnvironmentWorkspaceProps } from "@/components/EnvironmentWorkspace";
import type { ApplyPlan, ApplyResponse, EnvironmentProjectState } from "@/lib/environment-types";
import type { ProjectItem } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";

const mockProject: ProjectItem = {
  id: "e/gitlib/test-project",
  name: "test-project",
  path: "E:\\GitLib\\test-project",
  addedAt: Date.now(),
};

/** Default props for tests -- matches the current MainAreaProps interface. */
const defaultCommands: CommandItem[] = [
  { id: "preset-git-pull", name: "拉取代码", command: "git pull", icon: "GitBranch", type: "preset", scope: "project", addedAt: 0 },
  { id: "preset-claude", name: "启动 Claude", command: "claude", icon: "Sparkles", type: "preset", scope: "project", addedAt: 1 },
];

const defaultEnvironmentState: EnvironmentProjectState = {
  profileId: "profile-a",
  projectId: mockProject.id,
  projectPath: mockProject.path,
  managedPaths: [],
  environments: [],
  undoAvailable: false,
  blocked: false,
};

const defaultPlan: ApplyPlan = {
  token: "plan-token",
  profileId: defaultEnvironmentState.profileId,
  projectId: defaultEnvironmentState.projectId,
  environmentId: "",
  generation: 0,
  changes: [],
};

const defaultApplyResponse: ApplyResponse = {
  applied: false,
  stale: false,
  plan: defaultPlan,
  undoAvailable: false,
};

const defaultEnvironment: EnvironmentWorkspaceProps = {
  projectPath: mockProject.path,
  state: defaultEnvironmentState,
  busy: false,
  error: null,
  recoveryBlocked: false,
  recoveryError: null,
  migrationRequired: false,
  migrationDraft: null,
  onRefresh: vi.fn().mockResolvedValue(defaultEnvironmentState),
  onCreate: vi.fn().mockResolvedValue(defaultEnvironmentState),
  onCapture: vi.fn().mockResolvedValue(defaultEnvironmentState),
  onCopy: vi.fn().mockResolvedValue(defaultEnvironmentState),
  onMigrate: vi.fn().mockResolvedValue(defaultEnvironmentState),
  onPlan: vi.fn().mockResolvedValue(defaultPlan),
  onApply: vi.fn().mockResolvedValue(defaultApplyResponse),
  onPlanUndo: vi.fn().mockResolvedValue(defaultPlan),
  onUndo: vi.fn().mockResolvedValue(defaultApplyResponse),
};

function getDefaultProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    currentProject: mockProject as ProjectItem | null,
    onExecute: vi.fn(),
    commands: defaultCommands,
    editMode: false,
    setEditMode: vi.fn(),
    addCommand: vi.fn().mockResolvedValue(undefined),
    updateCommand: vi.fn().mockResolvedValue(undefined),
    deleteCommand: vi.fn().mockResolvedValue(undefined),
    activeZone: "main" as const,
    onZoneSwitch: vi.fn(),
    projectInfo: null,
    projectInfoLoading: false,
    projectInfoError: false,
    onOpenFolder: vi.fn(),
    environment: defaultEnvironment,
    ...overrides,
  };
}

describe("MainArea - existing tests", () => {
  it("renders empty state when no project selected", () => {
    render(<MainArea {...getDefaultProps({ currentProject: null })} />);
    expect(screen.getByText("选择一个项目开始")).toBeInTheDocument();
    expect(
      screen.getByText("从左侧添加或选择项目，然后点击指令卡片执行")
    ).toBeInTheDocument();
  });

  it("renders no CommandCard when no project selected", () => {
    render(<MainArea {...getDefaultProps({ currentProject: null })} />);
    expect(screen.queryByText("拉取代码")).not.toBeInTheDocument();
    expect(screen.queryByText("启动 Claude")).not.toBeInTheDocument();
  });

  it("renders 2 CommandCards when project is selected", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(screen.getByText("拉取代码")).toBeInTheDocument();
    expect(screen.getByText("启动 Claude")).toBeInTheDocument();
  });

  it("displays project name and path when project is selected", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(
      screen.getByText(`当前项目: ${mockProject.name}`)
    ).toBeInTheDocument();
    expect(screen.getByText(mockProject.path)).toBeInTheDocument();
  });

  it("uses auto-fill and minmax for grid layout", () => {
    const { container } = render(<MainArea {...getDefaultProps()} />);
    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
    const className = grid!.className;
    expect(className).toContain("auto-fill");
    expect(className).toContain("minmax");
  });
});

describe("MainArea - Phase 4 edit mode UI", () => {
  // Test 1: Edit button visible when project selected, hidden when not
  it("shows Settings button when project is selected", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(screen.getByLabelText("编辑指令")).toBeInTheDocument();
  });

  it("hides Settings button when no project is selected", () => {
    render(<MainArea {...getDefaultProps({ currentProject: null })} />);
    expect(screen.queryByLabelText("编辑指令")).not.toBeInTheDocument();
  });

  // Test 2: Edit mode toggle -- clicking Settings calls setEditMode
  it("toggles edit mode when Settings button is clicked", () => {
    const setEditMode = vi.fn();
    render(<MainArea {...getDefaultProps({ editMode: false, setEditMode })} />);

    fireEvent.click(screen.getByLabelText("编辑指令"));
    expect(setEditMode).toHaveBeenCalledWith(true);
  });

  it("shows '完成编辑' label when in edit mode", () => {
    render(<MainArea {...getDefaultProps({ editMode: true })} />);
    expect(screen.getByLabelText("完成编辑")).toBeInTheDocument();
  });

  // Test 3: "打开文件夹" button
  it("shows '打开文件夹' button with outline variant", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(screen.getByLabelText("打开项目文件夹")).toBeInTheDocument();
  });

  // Test 4: Edit mode shows "添加指令" placeholder card
  it("shows '添加指令' placeholder card in edit mode", () => {
    render(<MainArea {...getDefaultProps({ editMode: true })} />);
    expect(screen.getByText("添加指令")).toBeInTheDocument();
  });

  it("hides '添加指令' placeholder when not in edit mode", () => {
    render(<MainArea {...getDefaultProps({ editMode: false })} />);
    expect(screen.queryByText("添加指令")).not.toBeInTheDocument();
  });

  // Test 6: Commands are rendered as CommandCard list
  it("renders commands array as CommandCard list", () => {
    const customCommands: CommandItem[] = [
      ...defaultCommands,
      { id: "custom-1", name: "MyCmd", command: "echo hi", icon: "Terminal", type: "custom", scope: "project", addedAt: 100 },
    ];
    render(<MainArea {...getDefaultProps({ commands: customCommands })} />);
    expect(screen.getByText("MyCmd")).toBeInTheDocument();
    expect(screen.getByText("拉取代码")).toBeInTheDocument();
  });

  // Test 7: Click execute in non-edit mode
  it("calls onExecute when clicking command card in non-edit mode", () => {
    const onExecute = vi.fn();
    render(<MainArea {...getDefaultProps({ onExecute })} />);

    fireEvent.click(screen.getByText("拉取代码"));
    expect(onExecute).toHaveBeenCalledWith("git pull", expect.objectContaining({
      id: "preset-git-pull",
      command: "git pull",
    }));
  });
});

describe("MainArea - Phase 22 edit mode UI", () => {
  it("blocks project leave while an environment operation is busy", async () => {
    const mainAreaRef = createRef<MainAreaHandle>();
    render(
      <MainArea
        ref={mainAreaRef}
        {...getDefaultProps({ environment: { ...defaultEnvironment, busy: true } })}
      />
    );

    await expect(mainAreaRef.current!.requestProjectLeave()).resolves.toBe(false);
  });

  it("renders Terminal card when project is selected", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(screen.getByText("终端")).toBeInTheDocument();
  });

  it("Terminal card calls onExecute with 'cmd.exe' when clicked", () => {
    const onExecute = vi.fn();
    render(<MainArea {...getDefaultProps({ onExecute })} />);

    fireEvent.click(screen.getByText("终端"));
    expect(onExecute).toHaveBeenCalledWith("cmd.exe");
  });

  it("renders the two top-level tabs with project commands selected by default", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(screen.getByRole("tab", { name: "项目指令" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tab", { name: "项目环境" })).toHaveAttribute("data-state", "inactive");
    expect(screen.getByText("拉取代码")).toBeVisible();
  });

  it("places the tab button group and command editor in one row", () => {
    render(<MainArea {...getDefaultProps()} />);

    const tabList = screen.getByRole("tablist");
    const tabRow = tabList.parentElement;
    const editorButton = screen.getByRole("button", { name: "编辑指令" });

    expect(tabRow).toHaveClass("flex", "items-center");
    expect(tabList).toHaveClass("bg-muted");
    expect(tabList).not.toHaveClass("bg-transparent");
    expect(tabList).not.toHaveClass("rounded-none");
    expect(tabList).not.toHaveClass("border-b");
    expect(editorButton).toHaveClass("ml-auto");
    expect(tabRow).toContainElement(editorButton);
    expect(tabRow?.firstElementChild).toBe(tabList);
  });

  it("switches to the environment tab and hides command cards", async () => {
    render(<MainArea {...getDefaultProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: "项目环境" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "项目环境" })).toHaveAttribute("data-state", "active");
    });
    expect(screen.queryByText("拉取代码")).not.toBeInTheDocument();
    expect(screen.getByText("还没有环境")).toBeVisible();
    expect(screen.queryByRole("button", { name: "编辑指令" })).not.toBeInTheDocument();
  });

  it("asks before leaving a dirty command draft and stays after cancel", async () => {
    render(<MainArea {...getDefaultProps({ editMode: true })} />);
    fireEvent.click(screen.getByText("添加指令"));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "临时指令" } });
    fireEvent.click(screen.getByRole("tab", { name: "项目环境", hidden: true }));

    const prompt = await screen.findByRole("alertdialog");
    expect(within(prompt).getByText("指令未保存")).toBeInTheDocument();
    fireEvent.click(within(prompt).getByRole("button", { name: "取消" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "项目指令", hidden: true })).toHaveAttribute("data-state", "active");
    });
  });

  it("notifies the caller before showing a dirty command leave prompt", async () => {
    const mainAreaRef = createRef<MainAreaHandle>();
    const onInteractionNeeded = vi.fn().mockResolvedValue(undefined);
    render(
      <MainArea
        ref={mainAreaRef}
        {...getDefaultProps({ editMode: true })}
      />
    );
    fireEvent.click(screen.getByText("添加指令"));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "临时指令" } });

    const leavePromise = mainAreaRef.current!.requestProjectLeave({ onInteractionNeeded });
    expect(onInteractionNeeded).toHaveBeenCalledOnce();
    const prompt = await screen.findByRole("alertdialog");
    fireEvent.click(within(prompt).getByRole("button", { name: "取消" }));
    await expect(leavePromise).resolves.toBe(false);
  });

  it("does not request interaction for a clean project leave", async () => {
    const mainAreaRef = createRef<MainAreaHandle>();
    const onInteractionNeeded = vi.fn();
    render(
      <MainArea
        ref={mainAreaRef}
        {...getDefaultProps()}
      />
    );

    await expect(mainAreaRef.current!.requestProjectLeave({ onInteractionNeeded })).resolves.toBe(true);
    expect(onInteractionNeeded).not.toHaveBeenCalled();
  });

  it("clears command card focus after leaving the command tab", async () => {
    render(<MainArea {...getDefaultProps()} />);
    const firstCard = screen.getByRole("button", { name: "拉取代码" });
    fireEvent.keyDown(firstCard, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "启动 Claude" })).toHaveAttribute("tabindex", "0");

    fireEvent.click(screen.getByRole("tab", { name: "项目环境" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "项目环境" })).toHaveAttribute("data-state", "active");
    });
    fireEvent.click(screen.getByRole("tab", { name: "项目指令" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "项目指令" })).toHaveAttribute("data-state", "active");
      expect(screen.getByRole("button", { name: "拉取代码" })).toHaveAttribute("tabindex", "0");
    });
    expect(screen.getByRole("button", { name: "启动 Claude" })).toHaveAttribute("tabindex", "-1");
  });

});
