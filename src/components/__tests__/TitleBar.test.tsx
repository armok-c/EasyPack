import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const { mockMinimize, mockToggleMaximize, mockClose, mockHide, mockStartDragging, mockIsMaximized, mockOnResized } = vi.hoisted(() => ({
  mockMinimize: vi.fn().mockResolvedValue(undefined),
  mockToggleMaximize: vi.fn().mockResolvedValue(undefined),
  mockClose: vi.fn().mockResolvedValue(undefined),
  mockHide: vi.fn().mockResolvedValue(undefined),
  mockStartDragging: vi.fn().mockResolvedValue(undefined),
  mockIsMaximized: vi.fn().mockResolvedValue(false),
  mockOnResized: vi.fn().mockResolvedValue(vi.fn()),
}));

const mockOnSettingsOpen = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
    hide: mockHide,
    startDragging: mockStartDragging,
    isMaximized: mockIsMaximized,
    onResized: mockOnResized,
  }),
}));

import { TitleBar } from "@/components/TitleBar";

describe("TitleBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMaximized.mockResolvedValue(false);
    mockOnResized.mockResolvedValue(vi.fn());
  });

  it("renders EasyPack title", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    expect(screen.getByText("EasyPack")).toBeInTheDocument();
  });

  it("renders window control buttons", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    expect(screen.getByLabelText("最小化")).toBeInTheDocument();
    expect(screen.getByLabelText("最大化")).toBeInTheDocument();
    expect(screen.getByLabelText("关闭")).toBeInTheDocument();
  });

  it("window control buttons call correct APIs", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);

    fireEvent.click(screen.getByLabelText("最小化"));
    expect(mockMinimize).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByLabelText("最大化"));
    expect(mockToggleMaximize).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByLabelText("关闭"));
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("drag region attributes", () => {
    const { container } = render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);

    // Container div has data-tauri-drag-region
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv).toHaveAttribute("data-tauri-drag-region");

    // Left section (icon + name) has data-tauri-drag-region
    const leftSection = outerDiv.firstElementChild as HTMLElement;
    expect(leftSection).toHaveAttribute("data-tauri-drag-region");

    // Spacer div has data-tauri-drag-region
    const spacer = leftSection.nextElementSibling as HTMLElement;
    expect(spacer).toHaveAttribute("data-tauri-drag-region");

    // Button container does NOT have data-tauri-drag-region
    const buttonContainer = spacer.nextElementSibling as HTMLElement;
    expect(buttonContainer).not.toHaveAttribute("data-tauri-drag-region");
  });

  it("double click toggles maximize", () => {
    const { container } = render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    const outerDiv = container.firstElementChild as HTMLElement;
    fireEvent.doubleClick(outerDiv);
    expect(mockToggleMaximize).toHaveBeenCalled();
  });

  it("does not maximize when a titlebar button or its icon is double-clicked", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} onFloatToggle={vi.fn()} floatVisible={false} />);
    for (const button of screen.getAllByRole("button")) {
      fireEvent.doubleClick(button);
      const icon = button.querySelector("svg");
      if (icon) fireEvent.doubleClick(icon);
    }
    expect(mockToggleMaximize).not.toHaveBeenCalled();
  });

  it("reports initial, maximized, and restored states to the app shell", async () => {
    const onMaximizedChange = vi.fn();
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} onFloatToggle={vi.fn()} floatVisible={false} onMaximizedChange={onMaximizedChange} />);
    await waitFor(() => expect(onMaximizedChange).toHaveBeenLastCalledWith(false));
    const onResized = mockOnResized.mock.calls[0][0] as () => Promise<void>;
    mockIsMaximized.mockResolvedValue(true);
    await act(onResized);
    expect(screen.getByLabelText("还原")).toBeInTheDocument();
    expect(onMaximizedChange).toHaveBeenLastCalledWith(true);
    mockIsMaximized.mockResolvedValue(false);
    await act(onResized);
    expect(screen.getByLabelText("最大化")).toBeInTheDocument();
    expect(onMaximizedChange).toHaveBeenLastCalledWith(false);
  });

  it("ignores an older state response after a newer resize response", async () => {
    let resolveInitial!: (value: boolean) => void;
    mockIsMaximized.mockReturnValueOnce(new Promise<boolean>((resolve) => { resolveInitial = resolve; }));
    const onMaximizedChange = vi.fn();
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} onFloatToggle={vi.fn()} floatVisible={false} onMaximizedChange={onMaximizedChange} />);
    const onResized = mockOnResized.mock.calls[0][0] as () => Promise<void>;
    mockIsMaximized.mockResolvedValue(true);
    await act(onResized);
    await act(async () => { resolveInitial(false); });
    expect(screen.getByLabelText("还原")).toBeInTheDocument();
    expect(onMaximizedChange.mock.calls).toEqual([[true]]);
  });

  it("ignores state responses after unmount and removes the listener", async () => {
    let resolveState!: (value: boolean) => void;
    mockIsMaximized.mockReturnValueOnce(new Promise<boolean>((resolve) => { resolveState = resolve; }));
    const removeListener = vi.fn();
    mockOnResized.mockResolvedValue(removeListener);
    const onMaximizedChange = vi.fn();
    const { unmount } = render(<TitleBar onSettingsOpen={mockOnSettingsOpen} onFloatToggle={vi.fn()} floatVisible={false} onMaximizedChange={onMaximizedChange} />);
    unmount();
    await act(async () => { resolveState(true); });
    expect(onMaximizedChange).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledOnce();
  });

  it("mouse down on drag region starts dragging", () => {
    const { container } = render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    const outerDiv = container.firstElementChild as HTMLElement;
    fireEvent.mouseDown(outerDiv, { button: 0 });
    expect(mockStartDragging).toHaveBeenCalledOnce();
  });

  it("mouse down on button does not start dragging", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    const btn = screen.getByLabelText("最小化");
    fireEvent.mouseDown(btn, { button: 0 });
    expect(mockStartDragging).not.toHaveBeenCalled();
  });

  it("renders settings button", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    const settingsButton = screen.getByLabelText("设置");
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton).not.toHaveClass("relative");
    expect(settingsButton.querySelector("span")).not.toBeInTheDocument();
  });

  it("settings button calls onSettingsOpen", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    fireEvent.click(screen.getByLabelText("设置"));
    expect(mockOnSettingsOpen).toHaveBeenCalledOnce();
  });

  it("close button calls appWindow.close", () => {
    render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    fireEvent.click(screen.getByLabelText("关闭"));
    expect(mockClose).toHaveBeenCalledOnce();
    expect(mockHide).not.toHaveBeenCalled();
  });
});
