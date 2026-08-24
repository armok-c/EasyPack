import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { AddFileDialog } from "@/components/AddFileDialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const openMock = vi.mocked(openFileDialog);
const invokeMock = vi.mocked(invoke);

function renderDialog(onBusyChange = vi.fn(), onConfirm = vi.fn().mockResolvedValue(undefined)) {
  render(
    <AddFileDialog
      open={true}
      onOpenChange={vi.fn()}
      projectPath="C:/project"
      existingFileNames={[]}
      onConfirm={onConfirm}
      onBusyChange={onBusyChange}
    />
  );
  return { onBusyChange, onConfirm };
}

describe("AddFileDialog busy lifecycle", () => {
  it("sets busy before opening the system picker and clears it after cancel", async () => {
    let resolvePicker: (value: null) => void = () => undefined;
    openMock.mockReturnValue(new Promise((resolve) => { resolvePicker = resolve; }));
    const { onBusyChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "选择文件" }));
    await waitFor(() => expect(onBusyChange).toHaveBeenNthCalledWith(1, true));
    expect(screen.getByRole("button", { name: "读取中..." })).toBeDisabled();

    resolvePicker(null);
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(onBusyChange).toHaveBeenCalledTimes(2);
  });

  it("clears busy when the system picker fails", async () => {
    openMock.mockRejectedValue(new Error("picker failed"));
    const { onBusyChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "选择文件" }));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(onBusyChange).toHaveBeenCalledTimes(2);
  });

  it("keeps busy through file reading and confirmation", async () => {
    openMock.mockResolvedValue(["C:/project/.env"]);
    invokeMock.mockResolvedValue("MODE=dev");
    let resolveConfirm: () => void = () => undefined;
    const onConfirm = vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveConfirm = resolve; }));
    const { onBusyChange } = renderDialog(vi.fn(), onConfirm);

    fireEvent.click(screen.getByRole("button", { name: "选择文件" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ name: ".env", content: "MODE=dev" }),
    ]));
    expect(onBusyChange).toHaveBeenNthCalledWith(1, true);
    expect(onBusyChange).not.toHaveBeenCalledWith(false);

    resolveConfirm();
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(onBusyChange).toHaveBeenCalledTimes(2);
  });
});
