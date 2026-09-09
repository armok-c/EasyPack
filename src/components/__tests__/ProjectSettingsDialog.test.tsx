import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import type { ProjectItem } from "@/hooks/useProject";

const { invokeMock, convertFileSrcMock, toastErrorMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  convertFileSrcMock: vi.fn((path: string) => path),
  toastErrorMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  convertFileSrc: convertFileSrcMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
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
  options: {
    onRebind?: (projectId: string) => Promise<boolean>;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
  } = {},
) {
  const {
    onRebind = vi.fn().mockResolvedValue(true),
    onOpenChange = vi.fn(),
    open = true,
  } = options;
  return render(
    <ProjectSettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      project={projectOverride}
      onSave={onSave}
      onRebind={onRebind}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  invokeMock.mockReset();
  toastErrorMock.mockReset();
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

  it("selects and saves a newly available built-in icon", () => {
    const onSave = vi.fn();
    renderSettings(onSave);

    fireEvent.click(screen.getByRole("radio", { name: "Cloud" }));
    expect(screen.getByRole("radio", { name: "Cloud" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    expect(onSave).toHaveBeenCalledWith("project-a", {
      icon: "Cloud",
      color: "#112233",
    });
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

  it("synchronizes a successful screen pick and saves the selected color", async () => {
    const onSave = vi.fn();
    invokeMock.mockResolvedValueOnce("#AABBCC");
    renderSettings(onSave);

    fireEvent.click(screen.getByRole("button", { name: "屏幕取色" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "屏幕取色" })).toBeEnabled();
    });
    const pickArgs = invokeMock.mock.calls.find(([command]) => command === "pick_screen_color")?.[1];
    expect(pickArgs).toEqual({ requestId: expect.any(String) });
    expect(screen.getByLabelText("颜色编号")).toHaveValue("#aabbcc");
    expect(screen.getByLabelText("颜色取色器")).toHaveValue("#aabbcc");
    expect(screen.getByTestId("project-color-preview")).toHaveStyle({
      backgroundColor: "#aabbcc",
    });

    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(onSave).toHaveBeenCalledWith("project-a", {
      icon: "Terminal",
      color: "#aabbcc",
    });
  });

  it("leaves the color unchanged when screen picking is cancelled", async () => {
    const onSave = vi.fn();
    invokeMock.mockResolvedValueOnce(null);
    renderSettings(onSave);

    fireEvent.click(screen.getByRole("button", { name: "屏幕取色" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "屏幕取色" })).toBeEnabled();
    });
    expect(screen.getByLabelText("颜色编号")).toHaveValue("#112233");
    expect(screen.getByLabelText("颜色取色器")).toHaveValue("#112233");
    expect(screen.getByTestId("project-color-preview")).toHaveStyle({
      backgroundColor: "#112233",
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows an error toast when screen picking fails", async () => {
    invokeMock.mockRejectedValueOnce(new Error("hook failed"));
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "屏幕取色" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("屏幕取色失败，请重试");
    });
    expect(screen.getByLabelText("颜色编号")).toHaveValue("#112233");
  });

  it("only invokes screen picking once for repeated clicks", async () => {
    let resolvePick!: (value: string | null) => void;
    const pendingPick = new Promise<string | null>((resolve) => {
      resolvePick = resolve;
    });
    invokeMock.mockReturnValueOnce(pendingPick);
    renderSettings();

    const button = screen.getByRole("button", { name: "屏幕取色" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    resolvePick("#abcdef");
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("does not start screen picking while rebinding is pending", async () => {
    let resolveRebind!: (value: boolean) => void;
    const pendingRebind = new Promise<boolean>((resolve) => {
      resolveRebind = resolve;
    });
    const onOpenChange = vi.fn();
    const onRebind = vi.fn(() => pendingRebind);
    renderSettings(vi.fn(), project, { onOpenChange, onRebind });

    const rebindButton = screen.getByRole("button", { name: "重新绑定项目目录" });
    fireEvent.click(rebindButton);
    expect(rebindButton).toBeDisabled();

    const pickButton = screen.getByRole("button", { name: "屏幕取色" });
    expect(pickButton).toBeDisabled();
    fireEvent.click(pickButton);
    expect(invokeMock).not.toHaveBeenCalledWith("pick_screen_color");

    resolveRebind(true);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("disables rebinding, scanning, and scanned icon actions while picking", async () => {
    const candidates = [{
      path: "C:/icons/icon.png",
      name: "icon.png",
      source: "project",
    }];
    invokeMock.mockResolvedValueOnce(candidates);
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "从项目目录导入图标" }));
    const grid = await screen.findByRole("radiogroup", { name: "扫描到的图标" });
    const iconButton = within(grid).getByRole("radio", { name: "icon.png" });

    let resolvePick!: (value: string | null) => void;
    const pendingPick = new Promise<string | null>((resolve) => {
      resolvePick = resolve;
    });
    invokeMock.mockReturnValueOnce(pendingPick);
    fireEvent.click(screen.getByRole("button", { name: "屏幕取色" }));

    const rebindButton = screen.getByRole("button", { name: "重新绑定项目目录" });
    const scanButton = screen.getByRole("button", { name: "从项目目录导入图标" });
    expect(rebindButton).toBeDisabled();
    expect(scanButton).toBeDisabled();
    expect(iconButton).toBeDisabled();

    fireEvent.click(rebindButton);
    fireEvent.click(scanButton);
    fireEvent.click(iconButton);
    expect(invokeMock).toHaveBeenCalledTimes(2);

    resolvePick(null);
    await waitFor(() => expect(screen.getByRole("button", { name: "屏幕取色" })).toBeEnabled());
  });

  it("does not apply a screen-pick result after switching projects", async () => {
    let resolvePick!: (value: string | null) => void;
    const pendingPick = new Promise<string | null>((resolve) => {
      resolvePick = resolve;
    });
    invokeMock.mockReturnValueOnce(pendingPick);
    const view = renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "屏幕取色" }));

    const nextProject: ProjectItem = {
      ...project,
      id: "project-b",
      name: "项目B",
      color: "#445566",
    };
    view.rerender(
      <ProjectSettingsDialog
        open
        onOpenChange={vi.fn()}
        project={nextProject}
        onSave={vi.fn()}
        onRebind={vi.fn().mockResolvedValue(true)}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText("颜色编号")).toHaveValue("#445566"));

    resolvePick("#abcdef");
    await waitFor(() => expect(screen.getByRole("button", { name: "屏幕取色" })).toBeEnabled());
    expect(screen.getByLabelText("颜色编号")).toHaveValue("#445566");
  });

  it("requests screen-pick cancellation when the dialog closes externally", async () => {
    let resolvePick!: (value: string | null) => void;
    const pendingPick = new Promise<string | null>((resolve) => {
      resolvePick = resolve;
    });
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    const onRebind = vi.fn().mockResolvedValue(true);
    invokeMock.mockReturnValueOnce(pendingPick).mockResolvedValue(undefined);
    const view = renderSettings(onSave, project, { onOpenChange, onRebind });

    fireEvent.click(screen.getByRole("button", { name: "屏幕取色" }));
    view.rerender(
      <ProjectSettingsDialog
        open={false}
        onOpenChange={onOpenChange}
        project={project}
        onSave={onSave}
        onRebind={onRebind}
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "cancel_screen_color_pick",
        expect.objectContaining({ requestId: expect.any(String) }),
      );
    });
    const pickArgs = invokeMock.mock.calls.find(([command]) => command === "pick_screen_color")?.[1];
    const cancelArgs = invokeMock.mock.calls.find(([command]) => command === "cancel_screen_color_pick")?.[1];
    expect(cancelArgs).toEqual(pickArgs);
    await act(async () => {
      resolvePick(null);
    });
  });

  it("requests screen-pick cancellation when the dialog unmounts", () => {
    let resolvePick!: (value: string | null) => void;
    const pendingPick = new Promise<string | null>((resolve) => {
      resolvePick = resolve;
    });
    invokeMock.mockReturnValueOnce(pendingPick).mockResolvedValue(undefined);
    const view = renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "屏幕取色" }));
    view.unmount();

    const pickArgs = invokeMock.mock.calls.find(([command]) => command === "pick_screen_color")?.[1];
    expect(invokeMock).toHaveBeenCalledWith("cancel_screen_color_pick", pickArgs);
    resolvePick(null);
  });
});
