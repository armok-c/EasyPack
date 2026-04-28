import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("title bar height", () => {
    const { container } = render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("h-[28px]");
    expect(outerDiv.className).toContain("shrink-0");
  });

  it("double click toggles maximize", () => {
    const { container } = render(<TitleBar onSettingsOpen={mockOnSettingsOpen} />);
    const outerDiv = container.firstElementChild as HTMLElement;
    fireEvent.doubleClick(outerDiv);
    expect(mockToggleMaximize).toHaveBeenCalled();
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
    expect(screen.getByLabelText("设置")).toBeInTheDocument();
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
