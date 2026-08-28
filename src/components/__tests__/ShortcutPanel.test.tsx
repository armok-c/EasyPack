import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShortcutPanel } from "@/components/ShortcutPanel";
import type { ShortcutAction } from "@/lib/types";

const action: ShortcutAction = {
  id: "project.open",
  label: "打开项目",
  category: "project",
  handler: vi.fn(),
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof ShortcutPanel>> = {}) {
  const onRecordingChange = vi.fn();
  return {
    onRecordingChange,
    ...render(
      <ShortcutPanel
        open
        onOpenChange={vi.fn()}
        actions={[action]}
        bindings={{}}
        onSetBinding={vi.fn().mockResolvedValue(null)}
        onClearBinding={vi.fn().mockResolvedValue(undefined)}
        onResetAll={vi.fn().mockResolvedValue(undefined)}
        onRecordingChange={onRecordingChange}
        {...overrides}
      />,
    ),
  };
}

afterEach(() => cleanup());

describe("ShortcutPanel recording", () => {
  it("uses a fixed footer for reset confirmation actions", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "重置所有快捷键" }));

    const dialog = screen.getByRole("dialog", { name: "确认重置" });
    expect(screen.getByText("确定要清除所有快捷键绑定吗？此操作不可撤销。")).not.toHaveClass("py-2");
    const footer = screen.getByRole("button", { name: "取消" }).parentElement;
    expect(footer).toHaveAttribute("data-slot", "dialog-footer");
    expect(footer?.parentElement).toHaveAttribute("data-slot", "dialog-content");
    expect(dialog).toBeInTheDocument();
  });

  it("stops recording when the dialog is closed through the overlay", () => {
    const onOpenChange = vi.fn();
    const { onRecordingChange } = renderPanel({ onOpenChange });
    fireEvent.click(screen.getByRole("button", { name: "未设置" }));
    expect(onRecordingChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onRecordingChange).toHaveBeenLastCalledWith(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps clear and replace controls keyboard-focusable", () => {
    renderPanel({ bindings: { [action.id]: "Ctrl+P" } });

    expect(screen.getByRole("button", { name: "清除快捷键" })).toHaveClass(
      "focus-visible:opacity-100",
      "focus-visible:ring-2",
    );
    expect(screen.getByRole("button", { name: "更换打开项目快捷键" })).toHaveClass(
      "focus-visible:opacity-100",
      "focus-visible:ring-2",
    );
  });
});
