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
