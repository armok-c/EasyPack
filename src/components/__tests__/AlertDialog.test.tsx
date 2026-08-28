import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

afterEach(() => cleanup());

describe("AlertDialog", () => {
  it("uses stable layout classes and shared button styles", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="alert-content">
          <AlertDialogHeader>
            <AlertDialogTitle>确认操作</AlertDialogTitle>
            <AlertDialogDescription>操作说明</AlertDialogDescription>
          </AlertDialogHeader>
          <div data-testid="middle-content">操作主体</div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const content = screen.getByTestId("alert-content");
    const header = content.querySelector('[data-slot="alert-dialog-header"]');
    const footer = content.querySelector('[data-slot="alert-dialog-footer"]');
    const cancel = content.querySelector('[data-slot="alert-dialog-cancel"]');
    const action = content.querySelector('[data-slot="alert-dialog-action"]');

    expect(content.className).toContain("w-[calc(100%-2rem)]");
    expect(content.className).toContain("max-w-md");
    expect(content.className).toContain("overflow-hidden");
    expect(content.className).not.toContain("overflow-y-auto");
    expect(content.className).not.toMatch(/(?:^|:)sm:/);
    expect(header?.className).toContain("text-left");
    expect(header?.className).toContain("shrink-0");
    expect(header?.className).not.toContain("sm:text-left");
    expect(footer?.className).toContain("flex-row");
    expect(footer?.className).toContain("shrink-0");
    expect(footer?.className).toContain("justify-end");
    expect(footer?.className).not.toMatch(/(?:^|:)sm:/);
    expect(cancel?.className).toContain("border");
    expect(cancel?.className).toContain("h-9");
    expect(action?.className).toContain("bg-primary");
    expect(action?.className).toContain("h-9");

    const scrollWrapper = Array.from(content.children).find(
      (child) => child instanceof HTMLElement && child.classList.contains("overflow-y-auto"),
    ) as HTMLElement | undefined;
    expect(scrollWrapper).toBeDefined();
    expect(scrollWrapper).toHaveClass("min-h-0");
    expect(scrollWrapper).toContainElement(screen.getByTestId("middle-content"));
    expect(header?.parentElement).toBe(content);
    expect(footer?.parentElement).toBe(content);
    expect(header).not.toBe(scrollWrapper);
    expect(footer).not.toBe(scrollWrapper);
  });

  it("does not create an empty scroll wrapper for a short confirmation", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="short-alert-content">
          <AlertDialogHeader>
            <AlertDialogTitle>确认操作</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const content = screen.getByTestId("short-alert-content");
    expect(content.querySelector(".overflow-y-auto")).toBeNull();
  });

  it("supports destructive action styling", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="destructive-content">
          <AlertDialogAction variant="destructive">删除</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(
      screen
        .getByTestId("destructive-content")
        .querySelector('[data-slot="alert-dialog-action"]')?.className,
    ).toContain("bg-destructive");
  });
});
