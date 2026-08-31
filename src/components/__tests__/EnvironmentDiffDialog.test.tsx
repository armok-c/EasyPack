import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvironmentDiffDialog } from "@/components/EnvironmentDiffDialog";
import type { EnvironmentDetailResponse } from "@/lib/environment-types";

const environmentDiffStyles = readFileSync(resolve(process.cwd(), "src/components/environment-diff.css"), "utf8");

function response(
  path: string,
  snapshot: EnvironmentDetailResponse["snapshot"] = { state: "text", content: "A=1\n" },
  current: EnvironmentDetailResponse["current"] = { state: "text", content: "A=2\n" },
): EnvironmentDetailResponse {
  return {
    profileId: "profile-a",
    projectId: "project-a",
    environmentId: "dev",
    path,
    snapshot,
    current,
  };
}

type EnvironmentDiffDialogProps = ComponentProps<typeof EnvironmentDiffDialog>;

function renderDialog(onDetail: EnvironmentDiffDialogProps["onDetail"], paths = [".env"]) {
  return render(
    <EnvironmentDiffDialog
      open
      environmentName="开发"
      environmentId="dev"
      paths={paths}
      busy={false}
      onOpenChange={vi.fn()}
      onDetail={onDetail}
    />,
  );
}

function hunkHeaders(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-testid='environment-diff-hunk-header']")];
}

function renderedLineTexts(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".environment-diff-line-content")]
    .map((line) => line.textContent ?? "")
    .map((line) => line.slice(1).replace("↵", ""));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EnvironmentDiffDialog", () => {
  it("sets the dialog height to 40px less than the viewport", () => {
    renderDialog(undefined);

    expect(screen.getByRole("dialog")).toHaveClass("h-[calc(100vh-40px)]", "max-h-[calc(100vh-40px)]", "pb-3");
    expect(screen.getByRole("dialog")).not.toHaveClass("min-h-[520px]");
  });

  it("keeps the title and compact file selector centered on the same row", () => {
    renderDialog(undefined);

    const title = screen.getByRole("heading", { name: "查看环境：开发" });
    const selectorGroup = screen.getByTestId("environment-diff-file-selector");
    const header = title.parentElement;

    expect(header).toBe(selectorGroup.parentElement);
    expect(header).toHaveClass(
      "grid",
      "grid-cols-[minmax(0,1fr)_25%_minmax(0,1fr)]",
      "items-center",
      "pr-8",
    );
    expect(title).toHaveClass("min-w-0", "text-base", "leading-normal", "break-words");
    expect(title).not.toHaveClass("truncate");
    expect(selectorGroup).toHaveClass("w-full", "min-w-0", "justify-self-center");
  });

  it("fills the dialog middle area while keeping scrolling on the table wrapper", async () => {
    const onDetail = vi.fn().mockResolvedValue(response(".env"));
    renderDialog(onDetail);

    const shell = screen.getByTestId("environment-diff-scroll");
    expect(shell.parentElement).toHaveClass("flex", "h-full", "min-h-0", "min-w-0", "flex-col");
    expect(shell).toHaveClass("min-h-0", "min-w-0", "flex-1");

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    const view = screen.getByTestId("environment-diff-view");
    const code = view.querySelector(".environment-diff-code");
    const wrapper = view.querySelector(".environment-diff-table-wrapper");
    const header = screen.getByTestId("environment-diff-path-title").parentElement;
    expect(view).toHaveClass("min-w-0", "flex-1");
    expect(header).toHaveClass("environment-diff-header", "shrink-0");
    expect(code).toHaveClass("environment-diff-code");
    expect(wrapper).toHaveClass("environment-diff-table-wrapper");
    expect(environmentDiffStyles).not.toContain("max-height: 52vh");
    expect(environmentDiffStyles).not.toContain("container-type");
    expect(environmentDiffStyles).not.toContain("100cqi");
    expect(environmentDiffStyles).toContain("flex: 1 1 auto;");
  });

  it("keeps the compact diff footer fixed and navigates files without cycling", async () => {
    const paths = ["first.txt", "second.txt", "third.txt"];
    const onDetail = vi.fn((_: string, path: string) => Promise.resolve(response(path)));
    renderDialog(onDetail, paths);

    const dialog = screen.getByRole("dialog");
    const footer = screen.getByTestId("environment-diff-toolbar");
    expect(footer.parentElement).toBe(dialog);
    expect(footer).toHaveClass("mt-2", "pt-2", "gap-1");
    expect(screen.getByRole("button", { name: "上一个文件" })).toHaveClass("h-7", "w-7", "p-0");
    expect(screen.getByRole("button", { name: "下一个文件" })).toHaveClass("h-7", "w-7", "p-0");

    const previous = screen.getByRole("button", { name: "上一个文件" });
    const next = screen.getByRole("button", { name: "下一个文件" });
    expect(previous).not.toHaveAttribute("title");
    expect(next).not.toHaveAttribute("title");
    expect(screen.getByRole("button", { name: "展开当前文件全部内容" })).not.toHaveAttribute("title");
    expect(previous).toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", "second.txt"));
    expect(previous).not.toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", "third.txt"));
    expect(previous).not.toBeDisabled();
    expect(next).toBeDisabled();
  });

  it("truncates long file paths in the selector and unified headers", async () => {
    const longPath = "nested/" + "very-long-file-name-".repeat(12) + "config.txt";
    const onDetail = vi.fn().mockResolvedValue(response(longPath));
    renderDialog(onDetail, [longPath]);

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    expect(trigger).toHaveClass("min-w-0", "flex-1");
    expect(trigger).not.toHaveAttribute("title");
    expect(trigger.className).toContain("*:data-[slot=select-value]:min-w-0");
    expect(trigger.className).toContain("*:data-[slot=select-value]:truncate");

    const pathHeader = screen.getByTestId("environment-diff-path-title");
    expect(pathHeader).toHaveTextContent(longPath);
    expect(pathHeader).toHaveClass("min-w-0", "flex-1", "truncate", "overflow-hidden");
    expect(pathHeader).not.toHaveAttribute("title");
    expect(screen.queryByText(`旧 · 项目当前文件 · ${longPath}`)).not.toBeInTheDocument();
    expect(screen.queryByText(`新 · 环境快照 · ${longPath}`)).not.toBeInTheDocument();

    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    try {
      fireEvent.click(trigger);
      const content = screen.getByRole("listbox");
      expect(content).toHaveClass("min-w-0", "w-[var(--radix-select-trigger-width)]", "max-w-[var(--radix-select-content-available-width)]");
      const option = await screen.findByRole("option", { name: longPath });
      expect(option).toHaveClass("min-w-0");
      expect(option).not.toHaveAttribute("title");
    } finally {
      if (originalScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: originalScrollIntoView });
      else delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  it("renders one read-only unified table with current as old and snapshot as new", async () => {
    const onDetail = vi.fn().mockResolvedValue(response(".env"));
    renderDialog(onDetail);

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+1/-1");
    expect(document.body.textContent).toContain("@@ -1,1 +1,1 @@");
    expect(document.body.textContent).toContain("A=2");
    expect(document.body.textContent).toContain("A=1");
    expect(document.querySelectorAll(".environment-diff-table")).toHaveLength(1);
    expect(document.querySelectorAll(".environment-diff-table-wrapper")).toHaveLength(1);
    expect(document.querySelectorAll("[data-testid='environment-diff-scroll']")).toHaveLength(1);
    expect(hunkHeaders()[0].closest("table")).not.toBeNull();
    expect(document.querySelectorAll("[data-operator='+']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-operator='-']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-line-old-num]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-line-new-num]")).toHaveLength(1);
    expect(document.querySelector(".environment-diff-old-line-num")).toHaveClass("sticky");
    expect(document.querySelector(".environment-diff-new-line-num")).toHaveClass("sticky");
    const hunkHeader = hunkHeaders()[0];
    expect(hunkHeader.children).toHaveLength(2);
    expect(hunkHeader.children[0]).toHaveAttribute("colspan", "2");
    expect(hunkHeader.children[0]).toHaveClass("environment-diff-hunk-header");
    expect(hunkHeader.children[1]).not.toHaveAttribute("colspan");
    expect(hunkHeader.children[1]).toHaveClass("environment-diff-hunk-header");
    const hunkRange = screen.getByTestId("environment-diff-hunk-header-range");
    expect(hunkRange).toHaveTextContent("@@ -1,1 +1,1 @@");
    expect(hunkRange).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(hunkRange).not.toHaveClass("truncate");
    expect(hunkRange).not.toHaveAttribute("title");
    expect(screen.queryByTestId("environment-diff-hunk-header-context")).not.toBeInTheDocument();
    expect(hunkRange.parentElement).toHaveClass("environment-diff-hunk-header-content", "min-w-0", "overflow-hidden");
    expect(document.querySelector(".environment-diff-table-wrapper")).toHaveClass("environment-diff-table-wrapper");
    expect(screen.queryByTestId("environment-diff-status")).not.toBeInTheDocument();
    expect(document.querySelectorAll("[contenteditable='true']")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /接收|拒绝|应用|回滚|暂存/ })).not.toBeInTheDocument();
    expect(onDetail).toHaveBeenCalledWith("dev", ".env");
  });

  it("keeps permanent hunk headers adjacent to their own content", async () => {
    const oldContent = Array.from({ length: 20 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-18", "changed-18");
    const onDetail = vi.fn().mockResolvedValue(response("multi.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["multi.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -1,5 +1,5 @@ line-1", "@@ -15,6 +15,6 @@ line-17"]);
    expect(screen.getAllByTestId("environment-diff-hunk-header-context").map((context) => context.textContent)).toEqual(["line-1", "line-17"]);
    expect(screen.getAllByTestId("environment-diff-hunk-header-range").every((range) => range.classList.contains("shrink-0"))).toBe(true);
    expect(screen.getAllByTestId("environment-diff-hunk-header-context").every((context) => context.classList.contains("min-w-0") && context.classList.contains("flex-1") && context.classList.contains("truncate"))).toBe(true);
    expect(renderedLineTexts()).toEqual([
      "line-1", "line-2", "changed-2", "line-3", "line-4", "line-5",
      "line-15", "line-16", "line-17", "line-18", "changed-18", "line-19", "line-20",
    ]);
    expect(document.querySelectorAll("[data-state='gap']")).toHaveLength(1);
    expect(document.querySelector("[data-state='gap']")).toHaveClass("environment-diff-gap-marker");
    const gapMarker = document.querySelector("[data-state='gap']") as HTMLElement;
    expect(gapMarker.closest("tr")).toBe(hunkHeaders()[1]);
    expect(within(gapMarker).getByRole("button", { name: "向上展开10行" })).toBeInTheDocument();
    expect(within(gapMarker).getByRole("button", { name: "向下展开10行" })).toBeInTheDocument();
    expect(within(gapMarker).getByRole("button", { name: "向上展开10行" })).not.toHaveAttribute("title");
    expect(within(gapMarker).getByRole("button", { name: "向下展开10行" })).not.toHaveAttribute("title");
    expect(document.body.textContent).not.toContain("还有");
    expect(document.body.textContent).not.toContain("line-8");
  });

  it("keeps expanded middle gap rows before the header and the header before its hunk rows", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("order.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["order.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const middleGap = document.querySelector("[data-gap-index='1']") as HTMLElement;
    fireEvent.click(within(middleGap).getByRole("button", { name: "向上展开10行" }));

    const headers = hunkHeaders();
    const secondHeader = headers[1];
    expect(secondHeader.querySelector("[data-state='gap']")).toBe(middleGap);
    expect(middleGap.closest("tr")).toBe(secondHeader);
    expect(secondHeader.previousElementSibling).toHaveClass("environment-diff-line");
    expect(secondHeader.previousElementSibling).toHaveTextContent("line-21");
    expect(secondHeader.nextElementSibling).toHaveClass("environment-diff-line");
    expect(secondHeader.nextElementSibling).toHaveTextContent("line-22");
    expect(secondHeader).toHaveTextContent("@@ -12,17 +12,17 @@ line-24");
  });

  it("expands gaps by ten lines without moving or duplicating hunk headers", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("expand.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["expand.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const header = hunkHeaders()[0];
    const before = renderedLineTexts();
    expect(before).toContain("line-12");
    expect(before).not.toContain("line-1");
    const expandUp = screen.getAllByRole("button", { name: "向上展开10行" })[0];
    fireEvent.click(expandUp);
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-2", "line-3", "line-10", "line-11"]));
    expect(renderedLineTexts()).not.toContain("line-1");
    expect(hunkHeaders()).toHaveLength(1);
    expect(hunkHeaders()[0]).toBe(header);
    fireEvent.click(screen.getAllByRole("button", { name: "向下展开10行" })[0]);
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-1", "line-2", "line-3"]));
    expect(renderedLineTexts().indexOf("line-3")).toBeLessThan(renderedLineTexts().indexOf("line-9"));
    expect(hunkHeaders()).toHaveLength(1);

    while (screen.queryAllByRole("button", { name: "向上展开10行" }).length > 0) {
      fireEvent.click(screen.queryAllByRole("button", { name: "向上展开10行" })[0]);
    }
    await waitFor(() => expect(renderedLineTexts()).toContain("line-30"));
    expect(hunkHeaders()).toHaveLength(1);
    expect(hunkHeaders()[0].textContent).toBe("@@ -1,30 +1,30 @@ line-14");
    expect(renderedLineTexts()).toEqual([
      ...Array.from({ length: 14 }, (_, index) => `line-${index + 1}`),
      "line-15", "changed-15",
      ...Array.from({ length: 15 }, (_, index) => `line-${index + 16}`),
    ]);
    expect(renderedLineTexts().filter((line) => line === "line-8")).toHaveLength(1);
    const toggleAll = screen.getByRole("button", { name: "折叠当前文件全部内容" });
    expect(toggleAll).not.toBeDisabled();
    fireEvent.click(toggleAll);
    expect(screen.getByRole("button", { name: "展开当前文件全部内容" })).toBeInTheDocument();
    expect(renderedLineTexts()).not.toContain("line-1");
    expect(document.querySelectorAll("[data-state='gap']").length).toBeGreaterThan(0);
  });

  it("keeps all multi-hunk headers in order after full expansion", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("all.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["all.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "展开当前文件全部内容" }));
    await waitFor(() => expect(screen.getByText("line-30")).toBeInTheDocument());
    const headers = hunkHeaders();
    expect(headers.map((header) => header.textContent)).toEqual(["@@ -1,5 +1,5 @@ line-1", "@@ -6,25 +6,25 @@ line-24"]);
    expect(headers[0].compareDocumentPosition(headers[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const lines = renderedLineTexts();
    expect(lines.filter((line) => line === "line-10")).toHaveLength(1);
    expect(lines.indexOf("line-5")).toBeLessThan(lines.indexOf("line-22"));
    expect(lines.indexOf("line-22")).toBeLessThan(lines.indexOf("line-25"));
    fireEvent.click(screen.getByRole("button", { name: "折叠当前文件全部内容" }));
    expect(screen.getByRole("button", { name: "展开当前文件全部内容" })).not.toBeDisabled();
    expect(renderedLineTexts()).not.toContain("line-10");
  });

  it("extends a single hunk range through the end of a 110-line file", async () => {
    const oldContent = Array.from({ length: 110 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-55", "changed-55");
    const onDetail = vi.fn().mockResolvedValue(response("long.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["long.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "展开当前文件全部内容" }));
    await waitFor(() => expect(screen.getByText("line-110")).toBeInTheDocument());
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,110 +1,110 @@ line-54");
  });

  it("expands an inter-hunk gap toward the correct boundary", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("direction.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["direction.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const middleGapMarker = document.querySelector("[data-gap-index='1']") as HTMLElement;
    expect(middleGapMarker.closest("tr")).toBe(hunkHeaders()[1]);
    const middleGap = () => within(middleGapMarker);
    fireEvent.click(middleGap().getByRole("button", { name: "向上展开10行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-12", "line-19", "line-20", "line-21"]));
    expect(renderedLineTexts()).not.toEqual(expect.arrayContaining(["line-6", "line-7", "line-8"]));
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -1,5 +1,5 @@ line-1", "@@ -12,17 +12,17 @@ line-24"]);

    fireEvent.click(middleGap().getByRole("button", { name: "向下展开10行" }));
    const lines = renderedLineTexts();
    expect(lines).toEqual(expect.arrayContaining(["line-6", "line-7", "line-8", "line-19", "line-20", "line-21"]));
    expect(lines.indexOf("line-8")).toBeLessThan(lines.indexOf("line-19"));
    expect(new Set(lines).size).toBe(lines.length);
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -1,11 +1,11 @@ line-1", "@@ -12,17 +12,17 @@ line-24"]);
  });

  it("uses the same expansion direction for a trailing gap", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-4", "changed-4").replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("trailing-gap.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["trailing-gap.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const trailingGapMarker = document.querySelector("[data-gap-index='2']") as HTMLElement;
    expect(trailingGapMarker.closest("tr")?.previousElementSibling).toHaveClass("environment-diff-line");
    const trailingGap = () => within(trailingGapMarker);
    fireEvent.click(trailingGap().getByRole("button", { name: "向下展开10行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-19", "line-20", "line-21", "line-22", "line-23", "line-24"]));
    expect(renderedLineTexts()).not.toEqual(expect.arrayContaining(["line-28", "line-29", "line-30"]));

    fireEvent.click(trailingGap().getByRole("button", { name: "向上展开10行" }));
    const lines = renderedLineTexts();
    expect(lines).toEqual(expect.arrayContaining(["line-19", "line-20", "line-21", "line-28", "line-29", "line-30"]));
    expect(lines.indexOf("line-21")).toBeLessThan(lines.indexOf("line-28"));
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("does not count a partial head-gap down expansion in a discontinuous range", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("head-gap.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["head-gap.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const headGap = document.querySelector("[data-gap-index='0']") as HTMLElement;
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -22,7 +22,7 @@ line-24");
    fireEvent.click(within(headGap).getByRole("button", { name: "向下展开10行" }));
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -22,7 +22,7 @@ line-24");
    for (let expansion = 0; expansion < 2; expansion += 1) {
      fireEvent.click(within(headGap).getByRole("button", { name: "向下展开10行" }));
    }
    expect(document.querySelector("[data-gap-index='0']")).not.toBeInTheDocument();
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,28 +1,28 @@ line-24");
  });

  it("assigns trailing-gap down expansion to the last hunk range", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2");
    const onDetail = vi.fn().mockResolvedValue(response("tail-gap.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["tail-gap.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const tailGap = document.querySelector("[data-gap-index='1']") as HTMLElement;
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,5 +1,5 @@ line-1");
    fireEvent.click(within(tailGap).getByRole("button", { name: "向下展开10行" }));
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,15 +1,15 @@ line-1");
    for (let expansion = 0; expansion < 2; expansion += 1) {
      fireEvent.click(within(tailGap).getByRole("button", { name: "向上展开10行" }));
    }
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,30 +1,30 @@ line-1");
  });

  it("renders a head insertion as one new-side row", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("head-only.txt", { state: "text", content: "X\nA\n" }, { state: "text", content: "A\n" }));
    renderDialog(onDetail, ["head-only.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+1/-0");
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -1,1 +1,2 @@"]);
    expect(document.querySelectorAll("[data-kind='addition']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-kind='deletion']")).toHaveLength(0);
    expect(renderedLineTexts()).toEqual(["X", "A"]);
  });

  it("supports creation and deletion direction with precise stats", async () => {
    const created = vi.fn().mockResolvedValue(response("created.env", { state: "text", content: "A=1\nB=2\n" }, { state: "absent" }));
    renderDialog(created, ["created.env"]);
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+2/-0");
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -0,0 +1,2 @@"]);
    expect(document.querySelectorAll("[data-kind='addition']")).toHaveLength(2);
    expect(document.querySelectorAll("[data-kind='deletion']")).toHaveLength(0);
  });

  it("renders deletion rows from current and no snapshot content", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("deleted.env", { state: "absent" }, { state: "text", content: "A=1\nB=2\n" }));
    renderDialog(onDetail, ["deleted.env"]);
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+0/-2");
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -1,2 +0,0 @@"]);
    expect(document.querySelectorAll("[data-kind='addition']")).toHaveLength(0);
    expect(document.querySelectorAll("[data-kind='deletion']")).toHaveLength(2);
  });

  it("preserves absent and empty states without rendering a blank table", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("empty.env", { state: "text", content: "" }, { state: "absent" }));
    renderDialog(onDetail, ["empty.env"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-stats")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+0/-0");
    expect(screen.queryByTestId("environment-diff-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    expect(screen.getByText("文件内容为空")).toBeInTheDocument();
  });

  it("shows unavailable stats and no fake text for non-UTF8 files", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("binary.dat", { state: "nonUtf8" }, { state: "absent" }));
    renderDialog(onDetail, ["binary.dat"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-stats")).toBeInTheDocument());
    expect(screen.queryByTestId("environment-diff-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("不可用/不可用");
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    expect(screen.queryByText("A=1")).not.toBeInTheDocument();
  });

  it("discards a stale detail response after switching files", async () => {
    let resolveFirst: ((value: EnvironmentDetailResponse) => void) | undefined;
    let resolveSecond: ((value: EnvironmentDetailResponse) => void) | undefined;
    const onDetail = vi.fn((_: string, path: string) => new Promise<EnvironmentDetailResponse>((resolve) => {
      if (path === ".env") resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    renderDialog(onDetail, [".env", "config"]);
    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", ".env"));

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    try {
      fireEvent.click(trigger);
      fireEvent.click(await screen.findByRole("option", { name: "config" }));
    } finally {
      if (originalScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: originalScrollIntoView });
      else delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", "config"));
    resolveSecond?.(response("config", { state: "text", content: "new\n" }, { state: "text", content: "newer\n" }));
    await waitFor(() => expect(document.body.textContent).toContain("newer"));
    resolveFirst?.(response(".env", { state: "text", content: "stale\n" }, { state: "text", content: "stale-current\n" }));
    await waitFor(() => {
      expect(document.body.textContent).toContain("newer");
      expect(document.body.textContent).not.toContain("stale-current");
    });
  });

  it("resets gap expansion after closing and reopening", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("reset.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    const props = { environmentName: "开发", environmentId: "dev", paths: ["reset.txt"], busy: false, onOpenChange: vi.fn(), onDetail };
    const { rerender } = render(<EnvironmentDiffDialog open {...props} />);
    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    fireEvent.click(screen.getAllByRole("button", { name: "向上展开10行" })[0]);
    expect(renderedLineTexts()).toContain("line-11");
    expect(renderedLineTexts()).not.toContain("line-1");

    rerender(<EnvironmentDiffDialog open={false} {...props} />);
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    rerender(<EnvironmentDiffDialog open {...props} />);
    await waitFor(() => expect(onDetail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    expect(renderedLineTexts()).not.toContain("line-1");
    expect(screen.queryByText(/还有 \d+ 行/)).not.toBeInTheDocument();
  });

  it("resets gap expansion when same-path detail is replaced", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const firstDetail = vi.fn().mockResolvedValue(response("same-path.txt", { state: "text", content: oldContent.replace("line-15", "first-change") }, { state: "text", content: oldContent }));
    const secondDetail = vi.fn().mockResolvedValue(response("same-path.txt", { state: "text", content: oldContent.replace("line-15", "second-change") }, { state: "text", content: oldContent }));
    const props = { environmentName: "开发", environmentId: "dev", paths: ["same-path.txt"], busy: false, onOpenChange: vi.fn() };
    const { rerender } = render(<EnvironmentDiffDialog open {...props} onDetail={firstDetail} />);
    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    fireEvent.click(screen.getAllByRole("button", { name: "向上展开10行" })[0]);
    expect(renderedLineTexts()).toContain("line-11");

    rerender(<EnvironmentDiffDialog open {...props} onDetail={secondDetail} />);
    await waitFor(() => expect(secondDetail).toHaveBeenCalledWith("dev", "same-path.txt"));
    await waitFor(() => expect(document.body.textContent).toContain("second-change"));
    expect(renderedLineTexts()).not.toContain("line-11");
    expect(screen.queryByText(/还有 \d+ 行/)).not.toBeInTheDocument();
  });

  it("disables the file selector and shows its empty placeholder when no files are managed", () => {
    render(
      <EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={[]} busy={false} onOpenChange={vi.fn()} />,
    );

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("没有受管文件");
  });
});
