import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CommandCard } from "@/components/CommandCard";
import { Package } from "lucide-react";

// Mock shortcutUtils
vi.mock("@/lib/shortcutUtils", () => ({
  keyboardEventToShortcut: vi.fn(),
  shortcutToDisplay: vi.fn((s: string) => s.replace("CommandOrControl", "Ctrl")),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("CommandCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Phase 4: Edit mode & custom marker tests ---

  describe("custom command visual marker", () => {
    it("applies left blue border when isCustom=true", () => {
      render(<CommandCard name="自定义" icon={Package} isCustom />);
      const button = screen.getByRole("button");
      expect(button.className).toContain("border-l-blue-400/50");
    });

    it("does not apply left blue border when isCustom is not set", () => {
      render(<CommandCard name="预设" icon={Package} />);
      const button = screen.getByRole("button");
      expect(button.className).not.toContain("border-l-blue-400/50");
    });
  });

  describe("edit mode delete button", () => {
    it("shows delete button when editMode=true and isCustom=true", () => {
      render(
        <CommandCard name="自定义" icon={Package} isCustom editMode />
      );
      const deleteBtn = screen.getByLabelText("删除指令: 自定义");
      expect(deleteBtn).toBeInTheDocument();
    });

    it("does not show delete button when editMode=true but isCustom=false", () => {
      render(
        <CommandCard name="预设" icon={Package} editMode />
      );
      expect(screen.queryByLabelText(/删除指令/)).not.toBeInTheDocument();
    });

    it("calls onDelete and does not trigger onClick when delete button clicked", () => {
      const onDelete = vi.fn();
      const onClick = vi.fn();
      render(
        <CommandCard
          name="自定义"
          icon={Package}
          isCustom
          editMode
          onDelete={onDelete}
          onClick={onClick}
        />
      );
      const deleteBtn = screen.getByLabelText("删除指令: 自定义");
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledTimes(1);
      // onClick should NOT be called since delete stops propagation
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("edit mode click behavior", () => {
    it("calls onEdit instead of triggering flash when editMode=true and isCustom=true", () => {
      const onEdit = vi.fn();
      const onClick = vi.fn();
      render(
        <CommandCard
          name="自定义"
          icon={Package}
          isCustom
          editMode
          onEdit={onEdit}
          onClick={onClick}
        />
      );
      const button = screen.getByLabelText("自定义");
      fireEvent.click(button);
      expect(onEdit).toHaveBeenCalledTimes(1);
      // Should NOT trigger flash/execute
      expect(button.className).not.toContain("animate-card-flash");
      expect(onClick).not.toHaveBeenCalled();
    });

    it("does nothing when editMode=true and isCustom=false (preset)", () => {
      const onClick = vi.fn();
      render(
        <CommandCard
          name="预设"
          icon={Package}
          editMode
          onClick={onClick}
        />
      );
      const button = screen.getByLabelText("预设");
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
      expect(button.className).not.toContain("animate-card-flash");
    });
  });

  it("renders card with name and icon", () => {
    render(<CommandCard name="打包项目" icon={Package} />);
    expect(screen.getByLabelText("打包项目")).toBeInTheDocument();
    // Icon is rendered as SVG
    const button = screen.getByRole("button");
    expect(button.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("打包项目")).toBeInTheDocument();
  });

  it("calls onClick when clicked on enabled card", () => {
    const onClick = vi.fn();
    render(<CommandCard name="打包项目" icon={Package} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <CommandCard name="打包项目" icon={Package} disabled onClick={onClick} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
    const button = screen.getByRole("button");
    expect(button.className).toContain("opacity-40");
    expect(button.className).toContain("cursor-not-allowed");
  });

  it("enters flashing state after click (animate-card-flash class)", () => {
    const onClick = vi.fn();
    render(<CommandCard name="打包项目" icon={Package} onClick={onClick} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button.className).toContain("animate-card-flash");
  });

  it("prevents re-click while flashing (debounce)", () => {
    const onClick = vi.fn();
    render(<CommandCard name="打包项目" icon={Package} onClick={onClick} />);
    const button = screen.getByRole("button");

    // First click
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Second click while flashing
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1); // Still 1, not 2
  });

  it("icon has animate-spin class while flashing", () => {
    render(<CommandCard name="打包项目" icon={Package} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    const icon = button.querySelector("svg");
    // SVG elements use getAttribute for class in jsdom
    expect(icon?.getAttribute("class")).toContain("animate-spin");
  });

  it("flashing state clears after animation duration", () => {
    render(<CommandCard name="打包项目" icon={Package} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(button.className).toContain("animate-card-flash");

    // Advance past 420ms timeout and let React re-render
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(button.className).not.toContain("animate-card-flash");
  });

  it("shows title tooltip with command text when enabled", () => {
    render(
      <CommandCard name="打包项目" icon={Package} command="npm run build" />
    );
    expect(screen.getByRole("button").getAttribute("title")).toBe(
      "npm run build"
    );
  });

  it("does not show title when disabled", () => {
    render(
      <CommandCard
        name="打包项目"
        icon={Package}
        command="npm run build"
        disabled
      />
    );
    expect(screen.getByRole("button").getAttribute("title")).toBeNull();
  });

  // --- Phase 11: Shortcut badge state machine tests ---

  describe("shortcut badge states", () => {
    it("shows shortcut badge when shortcut prop is provided in non-edit mode", () => {
      render(
        <CommandCard name="打包" icon={Package} shortcut="CommandOrControl+G" />
      );
      expect(screen.getByText("Ctrl+G")).toBeInTheDocument();
    });

    it("shows + button in edit mode when no shortcut", () => {
      render(
        <CommandCard name="打包" icon={Package} editMode />
      );
      expect(screen.getByLabelText("设置快捷键")).toBeInTheDocument();
      expect(screen.getByText("+")).toBeInTheDocument();
    });

    it("does not show + button in non-edit mode when no shortcut", () => {
      render(
        <CommandCard name="打包" icon={Package} />
      );
      expect(screen.queryByLabelText("设置快捷键")).not.toBeInTheDocument();
      expect(screen.queryByText("+")).not.toBeInTheDocument();
    });

    it("shows recording state when isRecording is true", () => {
      render(
        <CommandCard name="打包" icon={Package} editMode isRecording />
      );
      expect(screen.getByText("按下快捷键...")).toBeInTheDocument();
      expect(screen.getByLabelText("正在录制快捷键")).toBeInTheDocument();
    });

    it("shows conflict state when hasConflict is true", () => {
      render(
        <CommandCard name="打包" icon={Package} editMode hasConflict />
      );
      expect(screen.getByText("冲突")).toBeInTheDocument();
      expect(screen.getByLabelText("快捷键冲突")).toBeInTheDocument();
    });

    it("shows clear button on hover in edit mode when shortcut is bound", () => {
      render(
        <CommandCard
          name="打包"
          icon={Package}
          editMode
          shortcut="CommandOrControl+G"
          onShortcutClear={vi.fn()}
        />
      );
      // Clear button exists but is opacity-0 until hover (group-hover)
      const clearBtn = screen.getByLabelText("清除快捷键: Ctrl+G");
      expect(clearBtn).toBeInTheDocument();
    });

    it("calls onRecordingStart when + button is clicked", () => {
      const onRecordingStart = vi.fn();
      render(
        <CommandCard
          name="打包"
          icon={Package}
          editMode
          onRecordingStart={onRecordingStart}
        />
      );
      fireEvent.click(screen.getByLabelText("设置快捷键"));
      expect(onRecordingStart).toHaveBeenCalledTimes(1);
    });

    it("prefers shortcut badge over number badge when both are available", () => {
      render(
        <CommandCard
          name="打包"
          icon={Package}
          shortcut="CommandOrControl+G"
          shortcutNumber={1}
        />
      );
      expect(screen.getByText("Ctrl+G")).toBeInTheDocument();
      // Number badge should not be visible since shortcut takes priority
      const button = screen.getByRole("button");
      expect(button.textContent).not.toContain("1");
    });

    it("shows number badge when no shortcut and conditions met", () => {
      render(
        <CommandCard
          name="打包"
          icon={Package}
          shortcutNumber={3}
        />
      );
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });
});
