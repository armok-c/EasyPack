import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/Sidebar";
import type { ProjectItem } from "@/hooks/useProject";

vi.hoisted(() => {
  if (!("ResizeObserver" in globalThis)) {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
});

const project: ProjectItem = {
  id: "project-a",
  name: "项目A",
  path: "C:\\Workspace\\ProjectA",
  addedAt: 1,
};

const secondProject: ProjectItem = {
  id: "project-b",
  name: "项目B",
  path: "D:\\Workspace\\ProjectB",
  addedAt: 2,
};

function renderSidebar(
  onRemoveProject: (id: string) => Promise<boolean>,
  options: {
    projects?: ProjectItem[];
    onOpenFolder?: (path: string) => void;
    onSelectProject?: (id: string) => void;
  } = {},
) {
  const projects = options.projects ?? [project];
  return render(
    <Sidebar
      projects={projects}
      selectedId={projects[0]?.id ?? null}
      onAddProject={vi.fn()}
      onSelectProject={options.onSelectProject ?? vi.fn()}
      onRemoveProject={onRemoveProject}
      onUpdateStyle={vi.fn()}
      onRebindProject={vi.fn().mockResolvedValue(true)}
      onOpenFolder={options.onOpenFolder ?? vi.fn()}
      onReorderProjects={vi.fn()}
      activeZone="sidebar"
      onZoneSwitch={vi.fn()}
    />,
  );
}

async function openDeleteConfirmation() {
  fireEvent.click(screen.getByRole("button", { name: "删除项目 项目A" }));
  expect(screen.getByText("永久删除项目？")).toBeInTheDocument();
}

async function openContextMenu(projectName: string) {
  const projectItem = screen
    .getByText(projectName)
    .closest('[data-slot="context-menu-trigger"]');
  expect(projectItem).not.toBeNull();
  fireEvent.contextMenu(projectItem!);
  await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
}

describe("Sidebar project context menu", () => {
  it("shows project actions in a desktop-friendly order", async () => {
    renderSidebar(vi.fn().mockResolvedValue(true));
    await openContextMenu(project.name);

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "打开项目文件夹",
      "项目设置",
      "删除项目",
    ]);
  });

  it("uses a clear local danger style for the delete action", async () => {
    renderSidebar(vi.fn().mockResolvedValue(true));
    await openContextMenu(project.name);

    const deleteItem = screen.getByRole("menuitem", { name: "删除项目" });
    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
    expect(deleteItem).toHaveClass(
      "!text-red-300",
      "hover:!bg-red-500/10",
      "hover:!text-red-200",
      "focus:!bg-red-500/10",
      "focus:!text-red-200",
      "data-[variant=destructive]:*:[svg]:text-red-300!",
    );
    expect(deleteItem.querySelector("svg")).toHaveClass("text-red-300!");
  });

  it("opens settings for the project that was right-clicked", async () => {
    renderSidebar(vi.fn().mockResolvedValue(true), {
      projects: [project, secondProject],
    });
    await openContextMenu(secondProject.name);

    fireEvent.click(screen.getByRole("menuitem", { name: "项目设置" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("项目设置");
    expect(screen.getByText(secondProject.path)).toBeInTheDocument();
  });

  it("opens the folder for the right-clicked project without selecting it", async () => {
    const onOpenFolder = vi.fn();
    const onSelectProject = vi.fn();
    renderSidebar(vi.fn().mockResolvedValue(true), {
      projects: [project, secondProject],
      onOpenFolder,
      onSelectProject,
    });
    await openContextMenu(secondProject.name);

    fireEvent.click(screen.getByRole("menuitem", { name: "打开项目文件夹" }));

    expect(onOpenFolder).toHaveBeenCalledWith(secondProject.path);
    expect(onSelectProject).not.toHaveBeenCalled();
  });

  it("opens the existing delete confirmation from the context menu", async () => {
    const onRemoveProject = vi.fn().mockResolvedValue(true);
    renderSidebar(onRemoveProject);
    await openContextMenu(project.name);

    fireEvent.click(screen.getByRole("menuitem", { name: "删除项目" }));

    expect(screen.getByText("永久删除项目？")).toBeInTheDocument();
    expect(onRemoveProject).not.toHaveBeenCalled();
  });
});

describe("Sidebar deletion confirmation", () => {
  it("keeps the confirmation open when deletion is busy or not executed", async () => {
    const onRemoveProject = vi.fn().mockResolvedValue(false);
    renderSidebar(onRemoveProject);
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(onRemoveProject).toHaveBeenCalledWith(project.id));
    expect(screen.getByText("永久删除项目？")).toBeInTheDocument();
  });

  it("closes the confirmation only after deletion succeeds", async () => {
    const onRemoveProject = vi.fn().mockResolvedValue(true);
    renderSidebar(onRemoveProject);
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(screen.queryByText("永久删除项目？")).not.toBeInTheDocument());
  });

  it("keeps the confirmation open when deletion rejects", async () => {
    const onRemoveProject = vi.fn().mockRejectedValue(new Error("删除失败"));
    renderSidebar(onRemoveProject);
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(onRemoveProject).toHaveBeenCalledWith(project.id));
    expect(screen.getByText("永久删除项目？")).toBeInTheDocument();
  });
});
