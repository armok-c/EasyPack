import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

describe("DialogContent", () => {
  afterEach(() => {
    cleanup();
  });

  function renderDialog(children: React.ReactNode, testId = "test-dialog") {
    return render(
      <Dialog open>
        <DialogContent data-testid={testId}>{children}</DialogContent>
      </Dialog>
    );
  }

  function getDialogByTestId(testId: string) {
    return screen.getByTestId(testId);
  }

  function findScrollWrapper(container: HTMLElement): HTMLElement | undefined {
    return Array.from(container.children).find(
      (child) =>
        child instanceof HTMLElement &&
        child.classList.contains("overflow-y-auto")
    ) as HTMLElement | undefined;
  }

  it("renders outer container with max-h-[90vh] class", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Test</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div>Content</div>
      </>,
      "dialog-maxh"
    );

    const content = getDialogByTestId("dialog-maxh");
    expect(content.className).toContain("max-h-[90vh]");
  });

  it("renders outer container with flex and flex-col classes", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Test</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div>Content</div>
      </>,
      "dialog-flex"
    );

    const content = getDialogByTestId("dialog-flex");
    expect(content.className).toContain("flex");
    expect(content.className).toContain("flex-col");
  });

  it("does not render outer container with grid class", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Test</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div>Content</div>
      </>,
      "dialog-nogrid"
    );

    const content = getDialogByTestId("dialog-nogrid");
    expect(content.className).not.toContain("grid");
  });

  it("wraps non-header/non-footer children in a scrollable container", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Test</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div data-testid="middle-content">Middle content</div>
        <DialogFooter>
          <Button>Footer button</Button>
        </DialogFooter>
      </>,
      "dialog-wrap"
    );

    const content = getDialogByTestId("dialog-wrap");
    const scrollWrapper = findScrollWrapper(content);

    expect(scrollWrapper).toBeDefined();
    expect(scrollWrapper!.classList.contains("flex-1")).toBe(true);
    expect(scrollWrapper!.classList.contains("min-h-0")).toBe(true);
    expect(scrollWrapper!.textContent).toContain("Middle content");
  });

  it("renders DialogHeader outside the scroll wrapper (does not scroll)", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Header Title</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div data-testid="middle-content">Middle content</div>
        <DialogFooter>
          <Button>Footer button</Button>
        </DialogFooter>
      </>,
      "dialog-header"
    );

    const content = getDialogByTestId("dialog-header");
    const scrollWrapper = findScrollWrapper(content);

    expect(scrollWrapper).toBeDefined();

    // Header should be a direct child of the content container (NOT inside scroll wrapper)
    const directChildren = Array.from(content.children);
    const headerChild = directChildren.find(
      (child) =>
        child instanceof HTMLElement &&
        child.getAttribute("data-slot") === "dialog-header"
    );
    expect(headerChild).toBeDefined();

    // Header and scroll wrapper should be different elements
    expect(headerChild).not.toBe(scrollWrapper);

    // Header should come before the scroll wrapper in DOM order
    const headerIndex = directChildren.indexOf(headerChild!);
    const scrollIndex = directChildren.indexOf(scrollWrapper!);
    expect(headerIndex).toBeLessThan(scrollIndex);
  });

  it("renders DialogFooter outside the scroll wrapper (does not scroll)", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Header Title</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div data-testid="middle-content">Middle content</div>
        <DialogFooter>
          <Button>Footer button</Button>
        </DialogFooter>
      </>,
      "dialog-footer"
    );

    const content = getDialogByTestId("dialog-footer");
    const scrollWrapper = findScrollWrapper(content);

    expect(scrollWrapper).toBeDefined();

    // Footer should be a direct child of the content container (NOT inside scroll wrapper)
    const directChildren = Array.from(content.children);
    const footerChild = directChildren.find(
      (child) =>
        child instanceof HTMLElement &&
        child.getAttribute("data-slot") === "dialog-footer"
    );
    expect(footerChild).toBeDefined();

    // Footer and scroll wrapper should be different elements
    expect(footerChild).not.toBe(scrollWrapper);

    // Footer should come after the scroll wrapper in DOM order
    const footerIndex = directChildren.indexOf(footerChild!);
    const scrollIndex = directChildren.indexOf(scrollWrapper!);
    expect(footerIndex).toBeGreaterThan(scrollIndex);
  });

  it("renders close button with absolute positioning", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Test</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div>Content</div>
      </>,
      "dialog-close"
    );

    const content = getDialogByTestId("dialog-close");
    const closeButton = content.querySelector('[data-slot="dialog-close"]');
    expect(closeButton).toBeDefined();
    expect((closeButton as HTMLElement).className).toContain("absolute");
  });

  it("handles dialog with only content (no header/footer)", () => {
    renderDialog(
      <div data-testid="bare-content">Just content</div>,
      "dialog-bare"
    );

    const content = getDialogByTestId("dialog-bare");
    const scrollWrapper = findScrollWrapper(content);

    expect(scrollWrapper).toBeDefined();
    expect(scrollWrapper!.textContent).toContain("Just content");
  });

  it("handles dialog with only header and content (no footer)", () => {
    renderDialog(
      <>
        <DialogHeader>
          <DialogTitle>Only Header</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogHeader>
        <div>Main content only</div>
      </>,
      "dialog-nofooter"
    );

    const content = getDialogByTestId("dialog-nofooter");
    const scrollWrapper = findScrollWrapper(content);

    expect(scrollWrapper).toBeDefined();
    expect(scrollWrapper!.textContent).toContain("Main content only");

    // Header should be a direct child, not inside the scroll wrapper
    const directChildren = Array.from(content.children);
    const headerChild = directChildren.find(
      (child) =>
        child instanceof HTMLElement &&
        child.getAttribute("data-slot") === "dialog-header"
    );
    expect(headerChild).toBeDefined();
    expect(headerChild).not.toBe(scrollWrapper);
  });
});
