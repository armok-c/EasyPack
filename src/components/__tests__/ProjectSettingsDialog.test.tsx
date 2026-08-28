import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import type { ProjectItem } from "@/hooks/useProject";

const { invokeMock, convertFileSrcMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  convertFileSrcMock: vi.fn((path: string) => path),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  convertFileSrc: convertFileSrcMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const project: ProjectItem = {
  id: "project-a",
  name: "项目A",
  path: "C:\\Workspace\\ProjectA",
  addedAt: 1,
  color: "#112233",
};

function renderSettings(
  onSave = vi.fn(),
  projectOverride: ProjectItem = project,
) {
  return render(
    <ProjectSettingsDialog
      open
      onOpenChange={vi.fn()}
      project={projectOverride}
      onSave={onSave}
      onRebind={vi.fn().mockResolvedValue(true)}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProjectSettingsDialog custom icon picker", () => {
  it("does not show an empty result before scanning, then reports an empty scan", async () => {
    invokeMock.mockResolvedValueOnce([]);
    renderSettings();

    expect(screen.queryByText("未找到可用图标")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "从项目目录导入图标" }));

    expect(await screen.findByText("未找到可用图标")).toBeInTheDocument();
  });

  it("shows scanned icons in a bordered three-column, three-row scroll container", async () => {
    const candidates = Array.from({ length: 10 }, (_, index) => ({
      path: `C:/icons/icon-${index}.png`,
      name: index === 0 ? "a-very-long-icon-file-name.png" : `icon-${index}.png`,
      source: "project",
    }));
    invokeMock.mockResolvedValueOnce(candidates);
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "从项目目录导入图标" }));

    const grid = await screen.findByRole("radiogroup", { name: "扫描到的图标" });
    expect(grid).toHaveClass(
      "grid",
      "grid-cols-3",
      "auto-rows-[64px]",
      "h-[224px]",
      "overflow-y-auto",
      "border",
      "rounded-md",
    );
    expect(within(grid).getAllByRole("radio")).toHaveLength(10);

    const card = within(grid).getByRole("radio", {
      name: "a-very-long-icon-file-name.png",
    });
    expect(card).toHaveClass("min-w-0");
    expect(card.querySelector("span")).toHaveClass("truncate");
    expect(card.querySelector("span")).not.toHaveAttribute("title");
  });
});

describe("ProjectSettingsDialog color picker", () => {
  it("keeps the long project name constrained in the preview", () => {
    const longName = "这是一个非常长的项目名称用于测试预览省略显示";
    renderSettings(vi.fn(), { ...project, name: longName });

    const name = screen.getByText(longName);
    expect(name).toHaveClass("flex-1", "min-w-0", "truncate");
    expect(name).not.toHaveAttribute("title");
    expect(name.parentElement).toHaveClass("min-w-0");
  });

  it("keeps the body and preview spacing separate from the shared dialog padding", () => {
    renderSettings();

    const dialog = screen.getByRole("dialog");
    const scrollWrapper = Array.from(dialog.children).find((child) => child.classList.contains("overflow-y-auto"));
    expect(scrollWrapper).toBeDefined();

    const body = scrollWrapper?.children[0];
    const preview = scrollWrapper?.children[1];
    expect(body).toHaveClass("space-y-4");
    expect(body).not.toHaveClass("py-4");
    expect(preview).toHaveClass("mt-4");
  });

  it("keeps the native picker, text input, preview, and saved value synchronized", () => {
    const onSave = vi.fn();
    renderSettings(onSave);

    const picker = screen.getByLabelText("颜色取色器");
    const textInput = screen.getByLabelText("颜色编号");
    expect(picker).toHaveValue("#112233");
    expect(textInput).toHaveValue("#112233");

    fireEvent.change(textInput, { target: { value: "#AABBCC" } });
    expect(textInput).toHaveValue("#aabbcc");
    expect(picker).toHaveValue("#aabbcc");
    expect(screen.getByTestId("project-color-preview")).toHaveStyle({
      backgroundColor: "#aabbcc",
    });

    fireEvent.change(picker, { target: { value: "#445566" } });
    expect(textInput).toHaveValue("#445566");
    expect(screen.getByTestId("project-color-preview")).toHaveStyle({
      backgroundColor: "#445566",
    });

    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(onSave).toHaveBeenCalledWith("project-a", {
      icon: "Terminal",
      color: "#445566",
    });
  });

  it("does not enable saving or preview an invalid intermediate color", () => {
    const onSave = vi.fn();
    renderSettings(onSave);

    const textInput = screen.getByLabelText("颜色编号");
    fireEvent.change(textInput, { target: { value: "#1122" } });

    expect(textInput).toHaveValue("#1122");
    expect(screen.getByLabelText("颜色取色器")).toHaveValue("#112233");
    expect(screen.getByTestId("project-color-preview")).toHaveStyle({
      backgroundColor: "#112233",
    });
    expect(screen.getByRole("button", { name: "保存设置" })).toBeDisabled();
    expect(textInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("请输入 6 位十六进制颜色，例如 #112233")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
