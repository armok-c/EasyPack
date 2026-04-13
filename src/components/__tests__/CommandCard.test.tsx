import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CommandCard } from "@/components/CommandCard";
import { Package } from "lucide-react";

describe("CommandCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
