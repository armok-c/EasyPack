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

function renderSidebar(onRemoveProject: (id: string) => Promise<boolean>) {
  return render(
    <Sidebar
      projects={[project]}
      selectedId={project.id}
      onAddProject={vi.fn()}
      onSelectProject={vi.fn()}
      onRemoveProject={onRemoveProject}
      onUpdateStyle={vi.fn()}
      onRebindProject={vi.fn().mockResolvedValue(true)}
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
