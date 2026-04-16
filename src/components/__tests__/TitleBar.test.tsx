import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TitleBar } from "@/components/TitleBar";

const mockMinimize = vi.fn().mockResolvedValue(undefined);
const mockToggleMaximize = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
  }),
}));

describe("TitleBar", () => {
  it("renders EasyPack title", () => {
    render(<TitleBar />);
    expect(screen.getByText("EasyPack")).toBeInTheDocument();
  });

  it("renders window control buttons", () => {
    render(<TitleBar />);
    expect(screen.getByLabelText("最小化")).toBeInTheDocument();
    expect(screen.getByLabelText("最大化")).toBeInTheDocument();
    expect(screen.getByLabelText("关闭")).toBeInTheDocument();
  });

  it("window control buttons call correct APIs", () => {
    render(<TitleBar />);

    fireEvent.click(screen.getByLabelText("最小化"));
    expect(mockMinimize).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByLabelText("最大化"));
    expect(mockToggleMaximize).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByLabelText("关闭"));
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("drag region attributes", () => {
    const { container } = render(<TitleBar />);

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
    const { container } = render(<TitleBar />);
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("h-[28px]");
    expect(outerDiv.className).toContain("shrink-0");
  });

  it("double click toggles maximize", () => {
    const { container } = render(<TitleBar />);
    const outerDiv = container.firstElementChild as HTMLElement;
    fireEvent.doubleClick(outerDiv);
    expect(mockToggleMaximize).toHaveBeenCalled();
  });
});
