import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MainArea } from "@/components/MainArea";
import type { ProjectItem } from "@/hooks/useProject";

const mockProject: ProjectItem = {
  id: "e/gitlib/test-project",
  name: "test-project",
  path: "E:\\GitLib\\test-project",
  addedAt: Date.now(),
};

describe("MainArea", () => {
  it("renders empty state when no project selected", () => {
    render(<MainArea currentProject={null} onExecute={vi.fn()} />);
    expect(screen.getByText("选择一个项目开始")).toBeInTheDocument();
    expect(
      screen.getByText("从左侧添加或选择项目，然后点击指令卡片执行")
    ).toBeInTheDocument();
  });

  it("renders no CommandCard when no project selected", () => {
    render(<MainArea currentProject={null} onExecute={vi.fn()} />);
    // No buttons with card labels should be present
    expect(screen.queryByText("打包项目")).not.toBeInTheDocument();
    expect(screen.queryByText("启动项目")).not.toBeInTheDocument();
    expect(screen.queryByText("Git Pull")).not.toBeInTheDocument();
    expect(screen.queryByText("启动 Claude")).not.toBeInTheDocument();
  });

  it("renders 4 CommandCards when project is selected", () => {
    render(<MainArea currentProject={mockProject} onExecute={vi.fn()} />);
    expect(screen.getByText("打包项目")).toBeInTheDocument();
    expect(screen.getByText("启动项目")).toBeInTheDocument();
    expect(screen.getByText("Git Pull")).toBeInTheDocument();
    expect(screen.getByText("启动 Claude")).toBeInTheDocument();
  });

  it("displays project name and path when project is selected", () => {
    render(<MainArea currentProject={mockProject} onExecute={vi.fn()} />);
    expect(
      screen.getByText(`当前项目: ${mockProject.name}`)
    ).toBeInTheDocument();
    expect(screen.getByText(mockProject.path)).toBeInTheDocument();
  });

  it("uses auto-fill and minmax for grid layout", () => {
    const { container } = render(
      <MainArea currentProject={mockProject} onExecute={vi.fn()} />
    );
    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
    const className = grid!.className;
    expect(className).toContain("auto-fill");
    expect(className).toContain("minmax");
  });
});
