import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FileEditorDialog, type FileEditorDialogHandle } from "@/components/FileEditorDialog";
import type { ManagedFile } from "@/lib/types";

vi.mock("@/hooks/useCodeMirror", async () => {
  const { useEffect, useRef } = await import("react");
  return {
    useCodeMirror: (_parentRef: unknown, options: { onChange: (value: string) => void }) => {
      useEffect(() => options.onChange("MODE=prod"), [options.onChange]);
      return { viewRef: useRef(null) };
    },
  };
});

const file: ManagedFile = {
  name: ".env",
  content: "MODE=dev",
  addedAt: 1,
};

async function makeDirty() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "保存" })).not.toBeDisabled();
  });
}

function renderEditor(onSave: (fileName: string, content: string) => Promise<void>) {
  const ref = { current: null } as React.RefObject<FileEditorDialogHandle | null>;
  render(
    <FileEditorDialog
      ref={ref}
      open={true}
      onOpenChange={vi.fn()}
      file={file}
      onSave={onSave}
    />
  );
  return ref;
}

describe("FileEditorDialog - leaving with unsaved content", () => {
  it("stays open when leaving is cancelled", async () => {
    const ref = renderEditor(vi.fn().mockResolvedValue(undefined));
    await makeDirty();

    const leavePromise = ref.current!.requestLeave();
    const prompt = await screen.findByRole("alertdialog");
    fireEvent.click(within(prompt).getByRole("button", { name: "取消" }));

    await expect(leavePromise).resolves.toBe(false);
    expect(screen.getByText(".env")).toBeInTheDocument();
  });

  it("notifies the caller before showing a dirty leave prompt", async () => {
    const ref = renderEditor(vi.fn().mockResolvedValue(undefined));
    const onInteractionNeeded = vi.fn().mockResolvedValue(undefined);
    await makeDirty();

    const leavePromise = ref.current!.requestLeave({ onInteractionNeeded });
    expect(onInteractionNeeded).toHaveBeenCalledOnce();
    const prompt = await screen.findByRole("alertdialog");
    fireEvent.click(within(prompt).getByRole("button", { name: "取消" }));

    await expect(leavePromise).resolves.toBe(false);
  });

  it("allows leaving after discarding unsaved content", async () => {
    const onOpenChange = vi.fn();
    const ref = { current: null } as React.RefObject<FileEditorDialogHandle | null>;
    render(
      <FileEditorDialog
        ref={ref}
        open={true}
        onOpenChange={onOpenChange}
        file={file}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );
    await makeDirty();

    const leavePromise = ref.current!.requestLeave();
    const prompt = await screen.findByRole("alertdialog");
    fireEvent.click(within(prompt).getByRole("button", { name: "放弃" }));

    await expect(leavePromise).resolves.toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves after the prompt save succeeds", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const ref = renderEditor(onSave);
    await makeDirty();

    const leavePromise = ref.current!.requestLeave();
    const prompt = await screen.findByRole("alertdialog");
    fireEvent.click(within(prompt).getByRole("button", { name: "保存" }));

    await expect(leavePromise).resolves.toBe(true);
    expect(onSave).toHaveBeenCalledWith(".env", "MODE=prod");
  });

  it("stays on the editor when the prompt save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("write failed"));
    const ref = renderEditor(onSave);
    await makeDirty();

    const leavePromise = ref.current!.requestLeave();
    const prompt = await screen.findByRole("alertdialog");
    fireEvent.click(within(prompt).getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "取消" }));
    await expect(leavePromise).resolves.toBe(false);
  });
});
