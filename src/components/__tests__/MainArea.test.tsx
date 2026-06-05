import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MainArea } from "@/components/MainArea";
import type { ProjectItem } from "@/hooks/useProject";
import type { CommandItem } from "@/lib/types";

const mockProject: ProjectItem = {
  id: "e/gitlib/test-project",
  name: "test-project",
  path: "E:\\GitLib\\test-project",
  addedAt: Date.now(),
};

/** Default props for tests -- matches the expanded MainAreaProps interface. */
const defaultCommands: CommandItem[] = [
  { id: "preset-git-pull", name: "拉取代码", command: "git pull", icon: "GitBranch", type: "preset", scope: "global", addedAt: 0 },
  { id: "preset-claude", name: "启动 Claude", command: "claude", icon: "Sparkles", type: "preset", scope: "global", addedAt: 1 },
];

function getDefaultProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    currentProject: mockProject as ProjectItem | null,
    onExecute: vi.fn(),
    commands: defaultCommands,
    commandMode: "global" as const,
    editMode: false,
    setEditMode: vi.fn(),
    addCommand: vi.fn().mockResolvedValue(undefined),
    updateCommand: vi.fn().mockResolvedValue(undefined),
    deleteCommand: vi.fn().mockResolvedValue(undefined),
    enableProjectCommands: vi.fn().mockResolvedValue(undefined),
    disableProjectCommands: vi.fn().mockResolvedValue(undefined),
    activeZone: "main" as const,
    onZoneSwitch: vi.fn(),
    projectInfo: null,
    projectInfoLoading: false,
    projectInfoError: false,
    onOpenFolder: vi.fn(),
    isProjectToggleDisabled: false,
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

  // Test 3: Toggle Group -- "全局指令" and "项目指令" buttons
  it("shows '全局指令' button in global mode with secondary variant", () => {
    render(<MainArea {...getDefaultProps({ commandMode: "global" })} />);
    const btn = screen.getByRole("radio", { name: "全局指令" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-checked", "true");
  });

  it("shows '项目指令' button in project mode with secondary variant", () => {
    render(<MainArea {...getDefaultProps({ commandMode: "project" })} />);
    const btn = screen.getByRole("radio", { name: "项目指令" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-checked", "true");
  });

  // Test 4: Toggle Group mode switch via buttons
  it("shows '打开文件夹' button with outline variant", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(screen.getByLabelText("打开项目文件夹")).toBeInTheDocument();
  });

  it("disables '项目指令' button when isProjectToggleDisabled is true", () => {
    render(<MainArea {...getDefaultProps({ isProjectToggleDisabled: true })} />);
    const btn = screen.getByRole("radio", { name: "项目指令" });
    expect(btn).toBeDisabled();
  });

  it("calls enableProjectCommands when clicking '项目指令' in global mode", () => {
    const enableProjectCommands = vi.fn().mockResolvedValue(undefined);
    render(<MainArea {...getDefaultProps({ commandMode: "global", enableProjectCommands })} />);

    fireEvent.click(screen.getByRole("radio", { name: "项目指令" }));
    expect(enableProjectCommands).toHaveBeenCalledOnce();
  });

  // Test 5: Edit mode shows "添加指令" placeholder card
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
      { id: "custom-1", name: "MyCmd", command: "echo hi", icon: "Terminal", type: "custom", scope: "global", addedAt: 100 },
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
