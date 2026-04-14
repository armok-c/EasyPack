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
  { id: "preset-0", name: "打包项目", command: "npm run build", icon: "Package", type: "preset", scope: "global", addedAt: 0 },
  { id: "preset-1", name: "启动项目", command: "npm run dev", icon: "Play", type: "preset", scope: "global", addedAt: 1 },
  { id: "preset-2", name: "Git Pull", command: "git pull", icon: "GitBranch", type: "preset", scope: "global", addedAt: 2 },
  { id: "preset-3", name: "启动 Claude", command: "claude", icon: "Sparkles", type: "preset", scope: "global", addedAt: 3 },
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
    expect(screen.queryByText("打包项目")).not.toBeInTheDocument();
    expect(screen.queryByText("启动项目")).not.toBeInTheDocument();
    expect(screen.queryByText("Git Pull")).not.toBeInTheDocument();
    expect(screen.queryByText("启动 Claude")).not.toBeInTheDocument();
  });

  it("renders 4 CommandCards when project is selected", () => {
    render(<MainArea {...getDefaultProps()} />);
    expect(screen.getByText("打包项目")).toBeInTheDocument();
    expect(screen.getByText("启动项目")).toBeInTheDocument();
    expect(screen.getByText("Git Pull")).toBeInTheDocument();
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

  // Test 3: Mode label -- "全局指令" or "项目自定义指令"
  it("shows '全局指令' label in global mode", () => {
    render(<MainArea {...getDefaultProps({ commandMode: "global" })} />);
    expect(screen.getByText("全局指令")).toBeInTheDocument();
  });

  it("shows '项目自定义指令' label in project mode", () => {
    render(<MainArea {...getDefaultProps({ commandMode: "project" })} />);
    expect(screen.getByText("项目自定义指令")).toBeInTheDocument();
  });

  // Test 4: Mode switch entry -- "使用项目自定义指令" / "使用全局指令"
  it("shows '使用项目自定义指令' switch in global mode", () => {
    render(<MainArea {...getDefaultProps({ commandMode: "global" })} />);
    expect(screen.getByText("使用项目自定义指令")).toBeInTheDocument();
  });

  it("shows '使用全局指令' switch in project mode", () => {
    render(<MainArea {...getDefaultProps({ commandMode: "project" })} />);
    expect(screen.getByText("使用全局指令")).toBeInTheDocument();
  });

  it("calls enableProjectCommands when clicking '使用项目自定义指令'", () => {
    const enableProjectCommands = vi.fn().mockResolvedValue(undefined);
    render(<MainArea {...getDefaultProps({ commandMode: "global", enableProjectCommands })} />);

    fireEvent.click(screen.getByText("使用项目自定义指令"));
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
    expect(screen.getByText("打包项目")).toBeInTheDocument();
  });

  // Test 7: Click execute in non-edit mode
  it("calls onExecute when clicking command card in non-edit mode", () => {
    const onExecute = vi.fn();
    render(<MainArea {...getDefaultProps({ onExecute })} />);

    fireEvent.click(screen.getByText("打包项目"));
    expect(onExecute).toHaveBeenCalledWith("npm run build");
  });
});
