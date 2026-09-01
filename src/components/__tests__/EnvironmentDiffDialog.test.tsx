import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnvironmentDiffDialog } from "@/components/EnvironmentDiffDialog";
import * as environmentDiff from "@/lib/environment-diff";
import type { EnvironmentDiffModel } from "@/lib/environment-diff";
import type { EnvironmentDetailResponse } from "@/lib/environment-types";

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mockToastError } }));

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

function renderDialog(
  onDetail: EnvironmentDiffDialogProps["onDetail"],
  paths = [".env"],
  onOpenCurrentFile: EnvironmentDiffDialogProps["onOpenCurrentFile"] = undefined,
) {
  return render(
    <EnvironmentDiffDialog
      open
      environmentName="开发"
      environmentId="dev"
      paths={paths}
      busy={false}
      onOpenChange={vi.fn()}
      onDetail={onDetail}
      onOpenCurrentFile={onOpenCurrentFile}
    />,
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (cause?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
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

beforeEach(() => {
  mockToastError.mockReset();
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
    expect(screen.getByRole("button", { name: "刷新当前文件差异" })).not.toHaveAttribute("title");
    expect(screen.getByRole("button", { name: "打开当前文件" })).not.toHaveAttribute("title");
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

  it("refreshes the selected file detail and disables actions while loading", async () => {
    const first = deferred<EnvironmentDetailResponse>();
    const second = deferred<EnvironmentDetailResponse>();
    const onDetail = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const onOpenCurrentFile = vi.fn().mockResolvedValue(undefined);
    renderDialog(onDetail, ["refresh.txt"], onOpenCurrentFile);

    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", "refresh.txt"));
    const refresh = screen.getByRole("button", { name: "刷新当前文件差异" });
    const open = screen.getByRole("button", { name: "打开当前文件" });
    expect(refresh).toBeDisabled();
    expect(open).toBeDisabled();

    first.resolve(response("refresh.txt", { state: "text", content: "old snapshot\n" }, { state: "text", content: "old current\n" }));
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(refresh).not.toBeDisabled();
    expect(open).not.toBeDisabled();

    fireEvent.click(refresh);
    await waitFor(() => expect(onDetail).toHaveBeenCalledTimes(2));
    expect(onDetail).toHaveBeenNthCalledWith(2, "dev", "refresh.txt");
    expect(refresh).toBeDisabled();
    expect(open).toBeDisabled();
    expect(screen.getByText("正在读取文件...")).toBeInTheDocument();

    second.resolve(response("refresh.txt", { state: "text", content: "new snapshot\n" }, { state: "text", content: "new current\n" }));
    await waitFor(() => expect(document.body.textContent).toContain("new current"));
    expect(document.body.textContent).not.toContain("old current");
    expect(refresh).not.toBeDisabled();
    expect(open).not.toBeDisabled();
  });

  it("ignores a stale refresh response after a newer detail request", async () => {
    const staleRefresh = deferred<EnvironmentDetailResponse>();
    const onDetail = vi.fn()
      .mockResolvedValueOnce(response("stale.txt", { state: "text", content: "snapshot\n" }, { state: "text", content: "initial\n" }))
      .mockReturnValueOnce(staleRefresh.promise);
    const replacement = vi.fn().mockResolvedValue(response("stale.txt", { state: "text", content: "snapshot\n" }, { state: "text", content: "fresh-current\n" }));
    const props = { environmentName: "开发", environmentId: "dev", paths: ["stale.txt"], busy: false, onOpenChange: vi.fn() };
    const { rerender } = render(<EnvironmentDiffDialog open {...props} onDetail={onDetail} />);

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "刷新当前文件差异" }));
    await waitFor(() => expect(onDetail).toHaveBeenCalledTimes(2));

    rerender(<EnvironmentDiffDialog open {...props} onDetail={replacement} />);
    await waitFor(() => expect(replacement).toHaveBeenCalledWith("dev", "stale.txt"));
    await waitFor(() => expect(document.body.textContent).toContain("fresh-current"));

    staleRefresh.resolve(response("stale.txt", { state: "text", content: "snapshot\n" }, { state: "text", content: "stale-refresh\n" }));
    await waitFor(() => {
      expect(document.body.textContent).toContain("fresh-current");
      expect(document.body.textContent).not.toContain("stale-refresh");
    });
  });

  it("resets expansion after refreshing the same selected file", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const onDetail = vi.fn()
      .mockResolvedValueOnce(response("reset-refresh.txt", { state: "text", content: oldContent.replace("line-15", "first-change") }, { state: "text", content: oldContent }))
      .mockResolvedValueOnce(response("reset-refresh.txt", { state: "text", content: oldContent.replace("line-16", "second-change") }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["reset-refresh.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "向上展开10行" }));
    expect(renderedLineTexts()).toContain("line-11");

    fireEvent.click(screen.getByRole("button", { name: "刷新当前文件差异" }));
    await waitFor(() => expect(onDetail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.body.textContent).toContain("second-change"));
    expect(renderedLineTexts()).not.toContain("line-11");
  });

  it("opens text and non-UTF8 current files and keeps the diff when opening fails", async () => {
    const onOpenCurrentFile = vi.fn().mockRejectedValue(new Error("默认程序启动失败"));
    const text = renderDialog(vi.fn().mockResolvedValue(response("open.txt")), ["open.txt"], onOpenCurrentFile);
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    const open = screen.getByRole("button", { name: "打开当前文件" });
    expect(open).not.toBeDisabled();
    fireEvent.click(open);
    await waitFor(() => expect(onOpenCurrentFile).toHaveBeenCalledWith("dev", "open.txt"));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("打开当前文件失败", { description: "默认程序启动失败" }));
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(document.body.textContent).toContain("A=2");
    text.unmount();

    renderDialog(
      vi.fn().mockResolvedValue(response("binary.dat", { state: "absent" }, { state: "nonUtf8" })),
      ["binary.dat"],
      onOpenCurrentFile,
    );
    await waitFor(() => expect(screen.getByTestId("environment-diff-status")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "打开当前文件" })).not.toBeDisabled();
  });

  it("disables opening without a loaded current file while keeping refresh available", async () => {
    const absent = renderDialog(
      vi.fn().mockResolvedValue(response("missing.txt", { state: "absent" }, { state: "absent" })),
      ["missing.txt"],
      vi.fn().mockResolvedValue(undefined),
    );
    await waitFor(() => expect(screen.getByTestId("environment-diff-status")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "刷新当前文件差异" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "打开当前文件" })).toBeDisabled();
    absent.unmount();

    const pending = deferred<EnvironmentDetailResponse>();
    const loading = renderDialog(vi.fn().mockReturnValue(pending.promise), ["loading.txt"], vi.fn());
    await waitFor(() => expect(screen.getByText("正在读取文件...")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "刷新当前文件差异" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "打开当前文件" })).toBeDisabled();
    loading.unmount();

    const failed = renderDialog(vi.fn().mockRejectedValue(new Error("读取失败")), ["error.txt"], vi.fn());
    await waitFor(() => expect(screen.getByTestId("environment-diff-error")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "刷新当前文件差异" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "打开当前文件" })).toBeDisabled();
    failed.unmount();

    renderDialog(undefined, [], vi.fn());
    expect(screen.getByRole("button", { name: "刷新当前文件差异" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "打开当前文件" })).toBeDisabled();
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
    expect(document.querySelector("[data-state='gap-row'][data-gap-index='1']")).not.toBeInTheDocument();
    expect(within(gapMarker).getByRole("button", { name: "向上展开10行" })).toBeInTheDocument();
    expect(within(gapMarker).getByRole("button", { name: "向下展开10行" })).toBeInTheDocument();
    expect(within(gapMarker).getByRole("button", { name: "向上展开10行" })).not.toHaveAttribute("title");
    expect(within(gapMarker).getByRole("button", { name: "向下展开10行" })).not.toHaveAttribute("title");
    expect(document.body.textContent).not.toContain("还有");
    expect(document.body.textContent).not.toContain("line-8");
  });

  it("keeps expanded middle gap rows before the marker and header before its hunk rows", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("order.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["order.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const middleGap = document.querySelector("[data-gap-index='1']") as HTMLElement;
    fireEvent.click(within(middleGap).getByRole("button", { name: "向上展开10行" }));

    const headers = hunkHeaders();
    const secondHeader = headers[1];
    expect(secondHeader.querySelector("[data-state='gap']")).toBeInTheDocument();
    expect(middleGap.closest("tr")).toBe(secondHeader);
    expect(document.querySelector("[data-state='gap-row'][data-gap-index='1']")).not.toBeInTheDocument();
    expect(secondHeader.nextElementSibling).toHaveClass("environment-diff-line");
    expect(secondHeader.nextElementSibling).toHaveTextContent("line-12");
    expect(secondHeader).toHaveTextContent("@@ -12,17 +12,17 @@ line-24");
  });

  it("expands head and tail gaps by ten lines without moving or duplicating hunk headers", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("expand.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["expand.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const before = renderedLineTexts();
    expect(before).toContain("line-12");
    expect(before).not.toContain("line-1");
    const headGap = document.querySelector("[data-gap-index='0']") as HTMLElement;
    fireEvent.click(within(headGap).getByRole("button", { name: "向上展开10行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-2", "line-3", "line-10", "line-11"]));
    expect(renderedLineTexts()).not.toContain("line-1");
    expect(hunkHeaders()).toHaveLength(1);
    const tailGap = document.querySelector("[data-gap-index='1']") as HTMLElement;
    fireEvent.click(within(tailGap).getByRole("button", { name: "向下展开10行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-2", "line-3", "line-10"]));
    expect(renderedLineTexts().indexOf("line-3")).toBeLessThan(renderedLineTexts().indexOf("line-9"));
    expect(hunkHeaders()).toHaveLength(1);
    fireEvent.click(within(headGap).getByRole("button", { name: "向上展开10行" }));
    fireEvent.click(within(tailGap).getByRole("button", { name: "向下展开10行" }));
    await waitFor(() => expect(renderedLineTexts()).toContain("line-30"));
    expect(hunkHeaders()).toHaveLength(1);
    expect(hunkHeaders()[0].textContent).toBe("@@ -1,30 +1,30 @@");
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

  it("merges all multi-hunk content into one header after full expansion", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("all.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["all.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "展开当前文件全部内容" }));
    await waitFor(() => expect(screen.getByText("line-30")).toBeInTheDocument());
    const headers = hunkHeaders();
    expect(headers.map((header) => header.textContent)).toEqual(["@@ -1,30 +1,30 @@"]);
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
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,110 +1,110 @@");
  });

  it("expands an inter-hunk gap toward the correct boundary", async () => {
    const oldContent = Array.from({ length: 60 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-55", "changed-55");
    const onDetail = vi.fn().mockResolvedValue(response("direction.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["direction.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const middleGapMarker = document.querySelector("[data-gap-index='1']") as HTMLElement;
    expect(middleGapMarker.closest("tr")).toBe(hunkHeaders()[1]);
    const middleGap = () => within(middleGapMarker);
    fireEvent.click(middleGap().getByRole("button", { name: "向上展开10行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-42", "line-43", "line-44", "line-51"]));
    expect(renderedLineTexts()).not.toEqual(expect.arrayContaining(["line-6", "line-7", "line-8"]));
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,5 +1,5 @@ line-1");
    expect(hunkHeaders()[1]).toHaveTextContent("@@ -42,17 +42,17 @@ line-54");

    fireEvent.click(middleGap().getByRole("button", { name: "向下展开10行" }));
    const lines = renderedLineTexts();
    expect(lines).toEqual(expect.arrayContaining(["line-6", "line-7", "line-8", "line-42", "line-43", "line-44"]));
    expect(lines.indexOf("line-8")).toBeLessThan(lines.indexOf("line-42"));
    expect(new Set(lines).size).toBe(lines.length);
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,15 +1,15 @@ line-1");
    expect(hunkHeaders()[1]).toHaveTextContent("@@ -42,17 +42,17 @@ line-54");
  });

  it("keeps a mixed middle-gap marker between the still-hidden rows", async () => {
    const oldContent = Array.from({ length: 80 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-75", "changed-75");
    const onDetail = vi.fn().mockResolvedValue(response("mixed-gap.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["mixed-gap.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const middleGap = document.querySelector("[data-gap-index='1']") as HTMLElement;
    fireEvent.click(within(middleGap).getByRole("button", { name: "向下展开10行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-6", "line-7", "line-15"]));
    expect(renderedLineTexts()).not.toContain("line-62");
    fireEvent.click(within(middleGap).getByRole("button", { name: "向上展开10行" }));

    const markerRow = middleGap.closest("tr");
    expect(markerRow).toBe(hunkHeaders()[1]);
    expect(markerRow).toHaveAttribute("data-state", "hunk");
    expect(markerRow?.previousElementSibling).toHaveTextContent("line-15");
    expect(markerRow?.querySelector("[data-state='gap']")).toBe(middleGap);
    expect(hunkHeaders()[1].nextElementSibling).toHaveTextContent("line-62");
    expect(renderedLineTexts()).not.toContain("line-16");
    expect(renderedLineTexts()).not.toContain("line-61");
  });

  it("keeps hunk and gap expansion controls sticky with the line-number columns", async () => {
    const oldContent = Array.from({ length: 40 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-20", "changed-20");
    const onDetail = vi.fn().mockResolvedValue(response("sticky.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["sticky.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(document.querySelector(".environment-diff-hunk-header-controls")).toHaveClass("environment-diff-hunk-header-controls");
    expect(document.querySelector(".environment-diff-gap-controls")).toHaveClass("environment-diff-gap-controls");
    expect(environmentDiffStyles).toContain(".environment-diff-hunk-header-controls {");
    expect(environmentDiffStyles).toContain(".environment-diff-gap-controls {");
    expect(environmentDiffStyles).toMatch(/\.environment-diff-hunk-header-controls\s*\{[\s\S]*position:\s*sticky;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-controls\s*\{[\s\S]*position:\s*sticky;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-controls\s*\{[\s\S]*left:\s*0;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-cell\s*\{[\s\S]*background:\s*#1f2937;/);
  });

  it("keeps diff columns compact and tail gap rows on the hunk-header background", () => {
    expect(environmentDiffStyles).toContain("--environment-diff-old-line-number-column-width: calc(2ch + 4px);");
    expect(environmentDiffStyles).toContain("--environment-diff-new-line-number-column-width: calc(2ch + 4px);");
    expect(environmentDiffStyles).toContain("--environment-diff-controls-width: calc(var(--environment-diff-old-line-number-column-width) + var(--environment-diff-new-line-number-column-width));");
    expect(environmentDiffStyles).toMatch(/\.environment-diff-old-line-num,[\s\S]*\.environment-diff-new-line-num\s*\{[\s\S]*padding:\s*0 2px;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-old-line-num\s*\{[\s\S]*width:\s*var\(--environment-diff-old-line-number-column-width\);[\s\S]*min-width:\s*var\(--environment-diff-old-line-number-column-width\);[\s\S]*max-width:\s*var\(--environment-diff-old-line-number-column-width\);/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-new-line-num\s*\{[\s\S]*width:\s*var\(--environment-diff-new-line-number-column-width\);[\s\S]*min-width:\s*var\(--environment-diff-new-line-number-column-width\);[\s\S]*max-width:\s*var\(--environment-diff-new-line-number-column-width\);[\s\S]*left:\s*var\(--environment-diff-old-line-number-column-width\);/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-hunk-header-controls\s*\{[\s\S]*width:\s*var\(--environment-diff-controls-width\);[\s\S]*min-width:\s*var\(--environment-diff-controls-width\);[\s\S]*max-width:\s*var\(--environment-diff-controls-width\);/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-controls\s*\{[\s\S]*width:\s*var\(--environment-diff-controls-width\);[\s\S]*min-width:\s*var\(--environment-diff-controls-width\);[\s\S]*max-width:\s*var\(--environment-diff-controls-width\);/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-marker\s*\{[\s\S]*display:\s*grid;[\s\S]*width:\s*100%;[\s\S]*height:\s*1\.25rem;[\s\S]*min-height:\s*1\.25rem;[\s\S]*grid-template-columns:\s*var\(--environment-diff-old-line-number-column-width\) var\(--environment-diff-new-line-number-column-width\);[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*gap:\s*0;[\s\S]*margin:\s*0;[\s\S]*background:\s*transparent;[\s\S]*border-right:\s*0;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-marker\s*>\s*button\[data-gap-direction="up"\]\s*\{[\s\S]*grid-column:\s*1;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-marker\s*>\s*button\[data-gap-direction="down"\]\s*\{[\s\S]*grid-column:\s*2;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-cell\s*\{[\s\S]*background:\s*#1f2937;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-controls\s*\{[\s\S]*background:\s*#1f2937;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-marker\s*>\s*button\s*\{[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*height:\s*1\.25rem;[\s\S]*min-height:\s*1\.25rem;[\s\S]*border-radius:\s*0\.25rem;/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-gap-marker\s*>\s*button:hover\s*\{[\s\S]*background:/);
    expect(environmentDiffStyles).toMatch(/\.environment-diff-hunk-header\s*\{[\s\S]*background:\s*#1f2937;/);
  });

  it("enlarges diff operators and gives them symmetric centered spacing", () => {
    expect(environmentDiffStyles).toMatch(/\.environment-diff-operator\s*\{[\s\S]*display:\s*inline-block;[\s\S]*width:\s*1\.5em;[\s\S]*padding:\s*0 4px;[\s\S]*font-size:\s*20px;[\s\S]*line-height:\s*1;[\s\S]*text-align:\s*center;/);
  });

  it("adapts old and new line-number columns to their largest line numbers", async () => {
    const oldContent = Array.from({ length: 99 }, (_, index) => `line-${index + 1}`).join("\n");
    const newContent = `${oldContent}\nline-100\nline-101`;
    const onDetail = vi.fn().mockResolvedValue(response("adaptive-width.txt", { state: "text", content: newContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["adaptive-width.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    const table = document.querySelector<HTMLTableElement>(".environment-diff-table");
    expect(table).not.toBeNull();
    expect(table?.style.getPropertyValue("--environment-diff-old-line-number-column-width")).toBe("calc(2ch + 4px)");
    expect(table?.style.getPropertyValue("--environment-diff-new-line-number-column-width")).toBe("calc(3ch + 4px)");
  });

  it("offers only downward expansion for a trailing gap", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-4", "changed-4").replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("trailing-gap.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["trailing-gap.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const trailingGapMarker = document.querySelector("[data-gap-index='2']") as HTMLElement;
    expect(trailingGapMarker.closest("tr")).toHaveAttribute("data-state", "gap-row");
    expect(trailingGapMarker.closest("tr")?.previousElementSibling).toHaveClass("environment-diff-line");
    const trailingGap = () => within(trailingGapMarker);
    expect(trailingGap().queryByRole("button", { name: "向上展开10行" })).not.toBeInTheDocument();
    fireEvent.click(trailingGap().getByRole("button", { name: "向下展开10行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-19", "line-20", "line-21", "line-22", "line-23", "line-24"]));
    expect(renderedLineTexts()).not.toEqual(expect.arrayContaining(["line-28", "line-29", "line-30"]));

    while (document.querySelector("[data-gap-index='2']")) {
      const marker = document.querySelector("[data-gap-index='2']") as HTMLElement;
      fireEvent.click(within(marker).getByRole("button", { name: "向下展开10行" }));
    }
    expect(hunkHeaders()).toHaveLength(2);
    expect(hunkHeaders()[1]).toHaveTextContent("@@ -12,19 +12,19 @@ line-14");
    expect(new Set(renderedLineTexts()).size).toBe(renderedLineTexts().length);
  });

  it("offers only upward expansion for a head gap", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("head-gap.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["head-gap.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const headGap = document.querySelector("[data-gap-index='0']") as HTMLElement;
    expect(headGap.closest("tr")).toBe(hunkHeaders()[0]);
    expect(document.querySelector("[data-state='gap-row'][data-gap-index='0']")).not.toBeInTheDocument();
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -22,7 +22,7 @@ line-24");
    expect(within(headGap).queryByRole("button", { name: "向下展开10行" })).not.toBeInTheDocument();
    fireEvent.click(within(headGap).getByRole("button", { name: "向上展开10行" }));
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -12,17 +12,17 @@ line-24");
    fireEvent.click(within(headGap).getByRole("button", { name: "向上展开10行" }));
    fireEvent.click(within(headGap).getByRole("button", { name: "向上展开10行" }));
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
      fireEvent.click(within(tailGap).getByRole("button", { name: "向下展开10行" }));
    }
    expect(hunkHeaders()[0]).toHaveTextContent("@@ -1,30 +1,30 @@");
  });

  it("changes the live message on repeated gap expansion and announces the final remainder", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2");
    const onDetail = vi.fn().mockResolvedValue(response("live.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["live.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const getTailGap = () => document.querySelector("[data-state='gap'][data-gap-index='1']") as HTMLElement;
    fireEvent.click(within(getTailGap()).getByRole("button", { name: "向下展开10行" }));
    const firstMessage = screen.getByTestId("environment-diff-live").textContent;
    fireEvent.click(within(getTailGap()).getByRole("button", { name: "向下展开10行" }));
    const secondMessage = screen.getByTestId("environment-diff-live").textContent;
    expect(secondMessage).not.toBe(firstMessage);

    while (document.querySelector("[data-state='gap'][data-gap-index='1']")) {
      fireEvent.click(within(getTailGap()).getByRole("button", { name: "向下展开10行" }));
    }
    expect(screen.getByTestId("environment-diff-live")).toHaveTextContent("剩余 0 行");
  });

  it("identifies equal-length gaps in live expansion messages", async () => {
    const oldContent = Array.from({ length: 42 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent
      .replace("line-2", "changed-2")
      .replace("line-20", "changed-20")
      .replace("line-38", "changed-38");
    const onDetail = vi.fn().mockResolvedValue(response("live-gaps.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["live-gaps.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(3));
    const firstMiddleGap = document.querySelector("[data-state='gap'][data-gap-index='1']") as HTMLElement;
    const secondMiddleGap = document.querySelector("[data-state='gap'][data-gap-index='2']") as HTMLElement;
    fireEvent.click(within(firstMiddleGap).getByRole("button", { name: "向下展开10行" }));
    const firstMessage = screen.getByTestId("environment-diff-live").textContent;
    fireEvent.click(within(secondMiddleGap).getByRole("button", { name: "向下展开10行" }));
    const secondMessage = screen.getByTestId("environment-diff-live").textContent;

    expect(firstMessage).toContain("第 2 个缺口");
    expect(secondMessage).toContain("第 3 个缺口");
    expect(secondMessage).not.toBe(firstMessage);
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
    expect(screen.queryByTestId("environment-diff-status")).not.toBeInTheDocument();
  });

  it("renders deletion rows from current and no snapshot content", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("deleted.env", { state: "absent" }, { state: "text", content: "A=1\nB=2\n" }));
    renderDialog(onDetail, ["deleted.env"]);
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+0/-2");
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -1,2 +0,0 @@"]);
    expect(document.querySelectorAll("[data-kind='addition']")).toHaveLength(0);
    expect(document.querySelectorAll("[data-kind='deletion']")).toHaveLength(2);
    expect(screen.queryByTestId("environment-diff-status")).not.toBeInTheDocument();
  });

  it("preserves absent and empty states without rendering a blank table", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("empty.env", { state: "text", content: "" }, { state: "absent" }));
    renderDialog(onDetail, ["empty.env"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-stats")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+0/-0");
    expect(screen.getByTestId("environment-diff-status")).toHaveTextContent("环境快照将创建空文件");
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    expect(screen.queryByText("文件内容为空")).not.toBeInTheDocument();
  });

  it("describes an empty file deletion and an unchanged file explicitly", async () => {
    const deleted = vi.fn().mockResolvedValue(response("deleted-empty.env", { state: "absent" }, { state: "text", content: "" }));
    renderDialog(deleted, ["deleted-empty.env"]);
    await waitFor(() => expect(screen.getByTestId("environment-diff-status")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-status")).toHaveTextContent("环境快照将删除空文件");

    const unchanged = vi.fn().mockResolvedValue(response("unchanged.env", { state: "text", content: "A=1\n" }, { state: "text", content: "A=1\n" }));
    const { rerender } = render(<EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={["unchanged.env"]} busy={false} onOpenChange={vi.fn()} onDetail={unchanged} />);
    await waitFor(() => expect(screen.getAllByTestId("environment-diff-status").some((status) => status.textContent === "内容无变化")).toBe(true));
    rerender(<EnvironmentDiffDialog open={false} environmentName="开发" environmentId="dev" paths={["unchanged.env"]} busy={false} onOpenChange={vi.fn()} onDetail={unchanged} />);
  });

  it("uses a generic status when a text diff cannot be generated", async () => {
    const oldFile = { state: "text" as const, content: "old\n" };
    const newFile = { state: "text" as const, content: "new\n" };
    const unavailableModel: EnvironmentDiffModel = {
      path: "unavailable.txt",
      old: oldFile,
      new: newFile,
      available: false,
      rows: [],
      hunks: [],
      gaps: [],
      additions: null,
      deletions: null,
      hasContentChange: true,
      hasStateChange: false,
      changeKind: "unavailable",
    };
    const buildSpy = vi.spyOn(environmentDiff, "buildEnvironmentDiff").mockReturnValue(unavailableModel);
    const onDetail = vi.fn().mockResolvedValue(response("unavailable.txt"));
    renderDialog(onDetail, ["unavailable.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-status")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-status")).toHaveTextContent("无法生成文本差异");
    expect(screen.getByTestId("environment-diff-status")).not.toHaveTextContent("二进制");
    buildSpy.mockRestore();
  });

  it("shows unavailable stats and no fake text for non-UTF8 files", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("binary.dat", { state: "nonUtf8" }, { state: "absent" }));
    renderDialog(onDetail, ["binary.dat"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-stats")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-status")).toHaveTextContent("二进制文件，无法显示文本差异");
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("不可用/不可用");
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    expect(screen.queryByText("A=1")).not.toBeInTheDocument();
  });

  it("waits for confirmation before building a large-file diff", async () => {
    const largeContent = "x".repeat(1_000_001);
    const onDetail = vi.fn().mockResolvedValue(response("large.txt", { state: "text", content: largeContent }, { state: "text", content: "small\n" }));
    renderDialog(onDetail, ["large.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-large-file-warning")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-large-file-warning")).toHaveTextContent("文件内容过大");
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("environment-diff-stats")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "仍然显示差异" }));
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toBeInTheDocument();
  }, 10_000);

  it("resets large-file confirmation after switching files, receiving detail, and reopening", async () => {
    const largeContent = "x".repeat(1_000_001);
    const smallModel = environmentDiff.buildEnvironmentDiff("stub.txt", { state: "text", content: "old\n" }, { state: "text", content: "new\n" });
    vi.spyOn(environmentDiff, "buildEnvironmentDiff").mockReturnValue(smallModel);
    const onDetail = vi.fn((_: string, path: string) => Promise.resolve(response(path, { state: "text", content: largeContent }, { state: "text", content: "small\n" })));
    const props = { environmentName: "开发", environmentId: "dev", paths: ["large-a.txt", "large-b.txt"], busy: false, onOpenChange: vi.fn(), onDetail };
    const { rerender } = render(<EnvironmentDiffDialog open {...props} />);
    await waitFor(() => expect(screen.getByTestId("environment-diff-large-file-warning")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "仍然显示差异" }));
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    try {
      fireEvent.click(trigger);
      fireEvent.click(await screen.findByRole("option", { name: "large-b.txt" }));
    } finally {
      if (originalScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: originalScrollIntoView });
      else delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
    await waitFor(() => expect(screen.getByTestId("environment-diff-large-file-warning")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "仍然显示差异" }));
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());

    const replacement = vi.fn().mockResolvedValue(response("large-b.txt", { state: "text", content: largeContent + "y" }, { state: "text", content: "small\n" }));
    rerender(<EnvironmentDiffDialog open {...props} onDetail={replacement} />);
    await waitFor(() => expect(replacement).toHaveBeenCalledWith("dev", "large-b.txt"));
    await waitFor(() => expect(screen.getByTestId("environment-diff-large-file-warning")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "仍然显示差异" }));
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());

    rerender(<EnvironmentDiffDialog open={false} {...props} onDetail={replacement} />);
    rerender(<EnvironmentDiffDialog open {...props} onDetail={replacement} />);
    await waitFor(() => expect(replacement).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("environment-diff-large-file-warning")).toBeInTheDocument());
  });

  it("constrains and breaks long detail errors inside the dialog", async () => {
    const longError = "读取失败".repeat(2_000);
    const onDetail = vi.fn().mockRejectedValue(new Error(longError));
    renderDialog(onDetail, ["long-error.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-error")).toBeInTheDocument());
    const error = screen.getByTestId("environment-diff-error");
    expect(error).toHaveClass("min-h-0", "min-w-0", "max-w-full", "flex-1", "overflow-y-auto", "break-all");
    expect(error.parentElement).toHaveClass("min-h-0", "min-w-0", "max-w-full", "flex-1");
    const retry = screen.getByRole("button", { name: "重试" });
    expect(retry).toHaveClass("shrink-0");
    expect(retry.parentElement).toBe(error.parentElement);
  });

  it("restores focus to the same gap button and falls back to the diff shell after the marker disappears", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("focus.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["focus.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const headGap = document.querySelector("[data-state='gap'][data-gap-index='0']") as HTMLElement;
    fireEvent.click(within(headGap).getByRole("button", { name: "向上展开10行" }));
    expect((document.querySelector("[data-state='gap'][data-gap-index='0']") as HTMLElement).querySelector("button[data-gap-direction='up']")).toHaveFocus();

    while (document.querySelector("[data-state='gap'][data-gap-index='0']")) {
      const marker = document.querySelector("[data-state='gap'][data-gap-index='0']") as HTMLElement;
      fireEvent.click(within(marker).getByRole("button", { name: "向上展开10行" }));
    }
    expect(screen.getByTestId("environment-diff-scroll")).toHaveFocus();
    expect(screen.getByTestId("environment-diff-live")).toHaveTextContent("向上展开");
  });

  it("keeps tail expansion rows visible while restoring the table scroll position", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("tail-scroll.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["tail-scroll.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const wrapper = document.querySelector(".environment-diff-table-wrapper") as HTMLElement;
    const initialScrollTop = 240;
    Object.defineProperty(wrapper, "scrollHeight", { configurable: true, value: 1000 });
    wrapper.scrollTop = initialScrollTop;

    let tailFocusOptions: FocusOptions | undefined;
    const originalFocus = HTMLElement.prototype.focus;
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      if (this.matches("[data-state='gap'][data-gap-index='1'] button[data-gap-direction='down']")) {
        tailFocusOptions = options;
        if (!options?.preventScroll) wrapper.scrollTop = wrapper.scrollHeight;
      }
      originalFocus.call(this, options);
    });

    try {
      const tailGap = document.querySelector("[data-state='gap'][data-gap-index='1']") as HTMLElement;
      fireEvent.click(within(tailGap).getByRole("button", { name: "向下展开10行" }));

      await waitFor(() => expect(renderedLineTexts()).toContain("line-20"));
      expect(wrapper.scrollTop).toBe(initialScrollTop);
      expect(tailFocusOptions).toEqual({ preventScroll: true });
      expect(focusSpy).toHaveBeenCalled();
    } finally {
      focusSpy.mockRestore();
    }
  });

  it("shows the original detail error with a retry action", async () => {
    const onDetail = vi.fn().mockRejectedValueOnce(new Error("磁盘读取失败")).mockResolvedValueOnce(response("retry.txt"));
    renderDialog(onDetail, ["retry.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-error")).toHaveTextContent("读取失败：磁盘读取失败"));
    const retry = screen.getByRole("button", { name: "重试" });
    expect(retry).toHaveClass("shrink-0");
    expect(retry.parentElement).toBe(screen.getByTestId("environment-diff-error").parentElement);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(onDetail).toHaveBeenCalledTimes(2);
  });

  it("reports a mismatched detail response instead of staying in loading", async () => {
    const mismatched = { ...response("other.txt"), environmentId: "other" };
    const onDetail = vi.fn().mockResolvedValue(mismatched);
    renderDialog(onDetail, ["expected.txt"]);

    await waitFor(() => expect(screen.getByTestId("environment-diff-error")).toHaveTextContent("返回内容与当前请求不匹配"));
    expect(screen.queryByText("正在读取文件...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
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
