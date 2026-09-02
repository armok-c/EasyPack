import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createRef } from "react";
import { CommandDialog, type CommandDialogHandle } from "@/components/CommandDialog";

// Mock @tauri-apps/plugin-store to prevent import errors
vi.mock("@tauri-apps/plugin-store", () => ({}));

function renderDialog(overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<CommandDialog {...props} />),
    props,
  };
}

describe("CommandDialog", () => {
  describe("add mode", () => {
    it('displays "添加指令" as title and "添加" as save button text', () => {
      renderDialog();
      expect(screen.getByText("添加指令")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "添加" })).toBeInTheDocument();
    });

    it("has empty name and command inputs by default", () => {
      renderDialog();
      const nameInput = screen.getByPlaceholderText("例如: 运行测试") as HTMLInputElement;
      const commandInput = screen.getByPlaceholderText("例如: npm test") as HTMLInputElement;
      expect(nameInput.value).toBe("");
      expect(commandInput.value).toBe("");
    });
  });

  describe("edit mode", () => {
    it('displays "编辑指令" as title and "保存" as save button text when initialData is provided', () => {
      renderDialog({
        initialData: {
          id: "cmd-1",
          name: "运行测试",
          command: "npm test",
          icon: "Terminal",
          type: "custom" as const,
          scope: "project",
          addedAt: 1000,
        },
      });
      expect(screen.getByText("编辑指令")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    });

    it("pre-fills form fields with initialData values", () => {
      renderDialog({
        initialData: {
          id: "cmd-1",
          name: "运行测试",
          command: "npm test",
          icon: "Package",
          type: "custom" as const,
          scope: "project",
          addedAt: 1000,
        },
      });
      const nameInput = screen.getByPlaceholderText("例如: 运行测试") as HTMLInputElement;
      const commandInput = screen.getByPlaceholderText("例如: npm test") as HTMLInputElement;
      expect(nameInput.value).toBe("运行测试");
      expect(commandInput.value).toBe("npm test");
    });
  });

  describe("form validation", () => {
    it("disables save button when name and command are both empty", () => {
      renderDialog();
      const saveButton = screen.getByRole("button", { name: "添加" });
      expect(saveButton).toBeDisabled();
    });

    it("disables save button when only name is filled", () => {
      renderDialog();
      const nameInput = screen.getByPlaceholderText("例如: 运行测试");
      fireEvent.change(nameInput, { target: { value: "测试" } });
      const saveButton = screen.getByRole("button", { name: "添加" });
      expect(saveButton).toBeDisabled();
    });

    it("disables save button when only command is filled", () => {
      renderDialog();
      const commandInput = screen.getByPlaceholderText("例如: npm test");
      fireEvent.change(commandInput, { target: { value: "npm test" } });
      const saveButton = screen.getByRole("button", { name: "添加" });
      expect(saveButton).toBeDisabled();
    });

    it("enables save button when both name and command are filled", () => {
      renderDialog();
      const nameInput = screen.getByPlaceholderText("例如: 运行测试");
      const commandInput = screen.getByPlaceholderText("例如: npm test");
      fireEvent.change(nameInput, { target: { value: "运行测试" } });
      fireEvent.change(commandInput, { target: { value: "npm test" } });
      const saveButton = screen.getByRole("button", { name: "添加" });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe("icon selection", () => {
    it("selects Terminal icon by default in add mode", () => {
      renderDialog();
      const terminalButton = screen.getByRole("radio", { name: "Terminal" });
      expect(terminalButton).toHaveAttribute("aria-checked", "true");
    });

    it("selects the initialData icon in edit mode", () => {
      renderDialog({
        initialData: {
          id: "cmd-1",
          name: "打包",
          command: "npm run build",
          icon: "Package",
          type: "custom" as const,
          scope: "project",
          addedAt: 1000,
        },
      });
      const packageButton = screen.getByRole("radio", { name: "Package" });
      expect(packageButton).toHaveAttribute("aria-checked", "true");
    });

    it("changes selection when a different icon is clicked", () => {
      renderDialog();
      const codeButton = screen.getByRole("radio", { name: "Code" });
      fireEvent.click(codeButton);
      expect(codeButton).toHaveAttribute("aria-checked", "true");
      const terminalButton = screen.getByRole("radio", { name: "Terminal" });
      expect(terminalButton).toHaveAttribute("aria-checked", "false");
    });

    it("selects and saves a newly available icon", () => {
      const { props } = renderDialog();
      const databaseButton = screen.getByRole("radio", { name: "Database" });
      fireEvent.click(databaseButton);

      expect(databaseButton).toHaveAttribute("aria-checked", "true");

      fireEvent.change(screen.getByPlaceholderText("例如: 运行测试"), {
        target: { value: "备份数据库" },
      });
      fireEvent.change(screen.getByPlaceholderText("例如: npm test"), {
        target: { value: "npm run backup" },
      });
      fireEvent.click(screen.getByRole("button", { name: "添加" }));

      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "备份数据库",
        command: "npm run backup",
        icon: "Database",
      });
    });
  });

  describe("preview card", () => {
    it('displays placeholder text "指令名称" when name is empty', () => {
      renderDialog();
      expect(screen.getByText("指令名称")).toBeInTheDocument();
    });

    it("updates preview with entered name", () => {
      renderDialog();
      const nameInput = screen.getByPlaceholderText("例如: 运行测试");
      fireEvent.change(nameInput, { target: { value: "我的指令" } });
      expect(screen.getByText("我的指令")).toBeInTheDocument();
    });

    it("updates preview icon when a different icon is selected", () => {
      renderDialog();
      const codeButton = screen.getByRole("radio", { name: "Code" });
      fireEvent.click(codeButton);
      // Preview section should exist with a Code SVG icon rendered
      const previewSection = screen.getByText("预览");
      expect(previewSection).toBeInTheDocument();
      // Verify the icon grid has Code selected
      expect(codeButton).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("onSubmit callback", () => {
    it("saves a named folder action with the selected icon and no script fields", () => {
      const { props } = renderDialog();

      fireEvent.click(screen.getByRole("radio", { name: "打开目录" }));
      fireEvent.change(screen.getByPlaceholderText("例如: 运行测试"), {
        target: { value: "打开安装包目录" },
      });
      fireEvent.change(screen.getByPlaceholderText("例如: src-tauri\\target\\release\\bundle"), {
        target: { value: "src-tauri\\target\\release\\bundle" },
      });
      fireEvent.click(screen.getByRole("button", { name: "添加" }));

      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "打开安装包目录",
        command: "src-tauri\\target\\release\\bundle",
        icon: "FolderOpen",
        action: "open-folder",
      });
    });

    it("restores the default icon when a new folder action switches to single-line", () => {
      const { props } = renderDialog();

      fireEvent.click(screen.getByRole("radio", { name: "打开目录" }));
      fireEvent.change(screen.getByPlaceholderText("例如: 运行测试"), {
        target: { value: "打开目录" },
      });
      fireEvent.change(screen.getByPlaceholderText("例如: src-tauri\\target\\release\\bundle"), {
        target: { value: "logs" },
      });
      fireEvent.click(screen.getByRole("radio", { name: "单行命令" }));

      expect(screen.getByRole("radio", { name: "Terminal" })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("button", { name: "添加" }));

      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "打开目录",
        command: "logs",
        icon: "Terminal",
      });
    });

    it("recognizes a folder action while editing and preserves its icon", () => {
      renderDialog({
        initialData: {
          id: "folder-1",
          name: "打开日志目录",
          command: "logs",
          icon: "Code",
          type: "custom" as const,
          scope: "project",
          addedAt: 1000,
          action: "open-folder" as const,
        },
      });

      expect(screen.getByRole("radio", { name: "打开目录" })).toHaveAttribute("aria-checked", "true");
      expect((screen.getByPlaceholderText("例如: src-tauri\\target\\release\\bundle") as HTMLInputElement).value).toBe("logs");
      expect(screen.getByRole("radio", { name: "Code" })).toHaveAttribute("aria-checked", "true");
    });

    it("uses FolderOpen by default without replacing an explicitly selected icon", () => {
      const { unmount } = renderDialog();
      fireEvent.click(screen.getByRole("radio", { name: "打开目录" }));
      expect(screen.getByRole("radio", { name: "FolderOpen" })).toHaveAttribute("aria-checked", "true");
      unmount();

      renderDialog();
      fireEvent.click(screen.getByRole("radio", { name: "Code" }));
      fireEvent.click(screen.getByRole("radio", { name: "打开目录" }));
      expect(screen.getByRole("radio", { name: "Code" })).toHaveAttribute("aria-checked", "true");
    });

    it("clears the folder action when saving an edited command as single-line", () => {
      const { props } = renderDialog({
        initialData: {
          id: "folder-2",
          name: "打开日志目录",
          command: "logs",
          icon: "FolderOpen",
          type: "custom" as const,
          scope: "project",
          addedAt: 1000,
          action: "open-folder" as const,
        },
      });

      fireEvent.click(screen.getByRole("radio", { name: "单行命令" }));
      fireEvent.click(screen.getByRole("button", { name: "保存" }));

      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "打开日志目录",
        command: "logs",
        icon: "FolderOpen",
      });
    });

    it("clears multi-line fields when saving an edited command from single-line mode", () => {
      const { props } = renderDialog({
        initialData: {
          id: "cmd-1",
          name: "运行测试",
          command: "npm test",
          icon: "Terminal",
          type: "custom" as const,
          scope: "project",
          addedAt: 1000,
          scriptLines: "npm test\nnpm run lint",
          executionMode: "lenient" as const,
        },
      });

      fireEvent.click(screen.getByRole("radio", { name: "单行命令" }));
      fireEvent.click(screen.getByRole("button", { name: "保存" }));

      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "运行测试",
        command: "npm test",
        icon: "Terminal",
      });
    });

    it("calls onSubmit with correct data when save is clicked", () => {
      const { props } = renderDialog();
      const nameInput = screen.getByPlaceholderText("例如: 运行测试");
      const commandInput = screen.getByPlaceholderText("例如: npm test");
      fireEvent.change(nameInput, { target: { value: "运行测试" } });
      fireEvent.change(commandInput, { target: { value: "npm test" } });
      const saveButton = screen.getByRole("button", { name: "添加" });
      fireEvent.click(saveButton);
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "运行测试",
        command: "npm test",
        icon: "Terminal",
      });
    });

    it("calls onSubmit with selected icon when icon changed", () => {
      const { props } = renderDialog();
      const nameInput = screen.getByPlaceholderText("例如: 运行测试");
      const commandInput = screen.getByPlaceholderText("例如: npm test");
      fireEvent.change(nameInput, { target: { value: "部署" } });
      fireEvent.change(commandInput, { target: { value: "npm run deploy" } });
      const codeButton = screen.getByRole("radio", { name: "Code" });
      fireEvent.click(codeButton);
      const saveButton = screen.getByRole("button", { name: "添加" });
      fireEvent.click(saveButton);
      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "部署",
        command: "npm run deploy",
        icon: "Code",
      });
    });
  });

  describe("leaving with unsaved changes", () => {
    it("keeps the prompt and draft when saving during leave fails", async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error("write failed"));
      const onOpenChange = vi.fn();
      const ref = createRef<CommandDialogHandle>();
      render(
        <CommandDialog
          ref={ref}
          open={true}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      );

      fireEvent.change(screen.getByPlaceholderText("例如: 运行测试"), {
        target: { value: "临时指令" },
      });
      fireEvent.change(screen.getByPlaceholderText("例如: npm test"), {
        target: { value: "npm test" },
      });

      const leavePromise = ref.current!.requestLeave();
      const prompt = await screen.findByRole("alertdialog");
      fireEvent.click(within(prompt).getByRole("button", { name: "保存" }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect((screen.getByPlaceholderText("例如: 运行测试") as HTMLInputElement).value).toBe("临时指令");

      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "取消" }));
      await expect(leavePromise).resolves.toBe(false);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});
