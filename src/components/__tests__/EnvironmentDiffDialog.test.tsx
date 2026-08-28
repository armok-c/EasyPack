import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvironmentDiffDialog } from "@/components/EnvironmentDiffDialog";
import type { EnvironmentDetailResponse } from "@/lib/environment-types";

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
  it("truncates long file paths in the selector and unified headers", async () => {
    const longPath = "nested/" + "very-long-file-name-".repeat(12) + "config.txt";
    const onDetail = vi.fn().mockResolvedValue(response(longPath));
    renderDialog(onDetail, [longPath]);

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    expect(trigger).toHaveClass("min-w-0", "flex-1");
    expect(trigger).toHaveAttribute("title", longPath);
    expect(trigger.className).toContain("*:data-[slot=select-value]:min-w-0");
    expect(trigger.className).toContain("*:data-[slot=select-value]:truncate");

    const oldHeader = screen.getByTitle(`项目当前文件 · ${longPath}`);
    const newHeader = screen.getByTitle(`环境快照 · ${longPath}`);
    expect(oldHeader).toHaveClass("min-w-0", "truncate");
    expect(newHeader).toHaveClass("min-w-0", "truncate");

    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    try {
      fireEvent.click(trigger);
      const content = screen.getByRole("listbox");
      expect(content).toHaveClass("min-w-0", "w-[var(--radix-select-trigger-width)]", "max-w-[var(--radix-select-content-available-width)]");
      const option = await screen.findByRole("option", { name: longPath });
      expect(option).toHaveClass("min-w-0");
      expect(option).toHaveAttribute("title", longPath);
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
    expect(hunkHeaders().map((header) => header.textContent)).toEqual(["@@ -1,5 +1,5 @@", "@@ -15,6 +15,6 @@"]);
    expect(renderedLineTexts()).toEqual([
      "line-1", "line-2", "changed-2", "line-3", "line-4", "line-5",
      "line-15", "line-16", "line-17", "line-18", "changed-18", "line-19", "line-20",
    ]);
    expect(document.querySelectorAll("[data-state='gap']")).toHaveLength(1);
    expect(screen.getByText("还有 9 行")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("line-8");
  });

  it("expands gaps by three lines without moving or duplicating hunk headers", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("expand.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["expand.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    const header = hunkHeaders()[0];
    const before = renderedLineTexts();
    expect(before).toContain("line-12");
    expect(before).not.toContain("line-1");
    const expandUp = screen.getAllByRole("button", { name: "向上展开3行" })[0];
    fireEvent.click(expandUp);
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-9", "line-10", "line-11"]));
    expect(renderedLineTexts()).not.toContain("line-1");
    expect(hunkHeaders()).toHaveLength(1);
    expect(hunkHeaders()[0]).toBe(header);
    fireEvent.click(screen.getAllByRole("button", { name: "向下展开3行" })[0]);
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-1", "line-2", "line-3"]));
    expect(renderedLineTexts().indexOf("line-3")).toBeLessThan(renderedLineTexts().indexOf("line-9"));
    expect(hunkHeaders()).toHaveLength(1);

    while (screen.queryAllByRole("button", { name: "向上展开3行" }).length > 0) {
      fireEvent.click(screen.queryAllByRole("button", { name: "向上展开3行" })[0]);
    }
    await waitFor(() => expect(renderedLineTexts()).toContain("line-30"));
    expect(hunkHeaders()).toHaveLength(1);
    expect(hunkHeaders()[0].textContent).toBe("@@ -12,7 +12,7 @@");
    expect(renderedLineTexts()).toEqual([
      ...Array.from({ length: 14 }, (_, index) => `line-${index + 1}`),
      "line-15", "changed-15",
      ...Array.from({ length: 15 }, (_, index) => `line-${index + 16}`),
    ]);
    expect(renderedLineTexts().filter((line) => line === "line-8")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "展开当前文件全部内容" })).toBeDisabled();
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
    expect(headers.map((header) => header.textContent)).toEqual(["@@ -1,5 +1,5 @@", "@@ -22,7 +22,7 @@"]);
    expect(headers[0].compareDocumentPosition(headers[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const lines = renderedLineTexts();
    expect(lines.filter((line) => line === "line-10")).toHaveLength(1);
    expect(lines.indexOf("line-5")).toBeLessThan(lines.indexOf("line-22"));
    expect(lines.indexOf("line-22")).toBeLessThan(lines.indexOf("line-25"));
  });

  it("expands an inter-hunk gap toward the correct boundary", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-2", "changed-2").replace("line-25", "changed-25");
    const onDetail = vi.fn().mockResolvedValue(response("direction.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["direction.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const middleGap = () => within(document.querySelector("[data-gap-index='1']") as HTMLElement);
    fireEvent.click(middleGap().getByRole("button", { name: "向上展开3行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-19", "line-20", "line-21"]));
    expect(renderedLineTexts()).not.toEqual(expect.arrayContaining(["line-6", "line-7", "line-8"]));

    fireEvent.click(middleGap().getByRole("button", { name: "向下展开3行" }));
    const lines = renderedLineTexts();
    expect(lines).toEqual(expect.arrayContaining(["line-6", "line-7", "line-8", "line-19", "line-20", "line-21"]));
    expect(lines.indexOf("line-8")).toBeLessThan(lines.indexOf("line-19"));
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("uses the same expansion direction for a trailing gap", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = oldContent.replace("line-4", "changed-4").replace("line-15", "changed-15");
    const onDetail = vi.fn().mockResolvedValue(response("trailing-gap.txt", { state: "text", content: snapshotContent }, { state: "text", content: oldContent }));
    renderDialog(onDetail, ["trailing-gap.txt"]);

    await waitFor(() => expect(hunkHeaders()).toHaveLength(2));
    const trailingGap = () => within(document.querySelector("[data-gap-index='2']") as HTMLElement);
    fireEvent.click(trailingGap().getByRole("button", { name: "向下展开3行" }));
    expect(renderedLineTexts()).toEqual(expect.arrayContaining(["line-19", "line-20", "line-21"]));
    expect(renderedLineTexts()).not.toEqual(expect.arrayContaining(["line-28", "line-29", "line-30"]));

    fireEvent.click(trailingGap().getByRole("button", { name: "向上展开3行" }));
    const lines = renderedLineTexts();
    expect(lines).toEqual(expect.arrayContaining(["line-19", "line-20", "line-21", "line-28", "line-29", "line-30"]));
    expect(lines.indexOf("line-21")).toBeLessThan(lines.indexOf("line-28"));
    expect(new Set(lines).size).toBe(lines.length);
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

    await waitFor(() => expect(screen.getByTestId("environment-diff-status")).toBeInTheDocument());
    expect(screen.getByTestId("environment-diff-stats")).toHaveTextContent("+0/-0");
    expect(screen.getByText("旧（项目当前文件）：文件不存在")).toBeInTheDocument();
    expect(screen.getByText("新（环境快照）：文本文件")).toBeInTheDocument();
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    expect(screen.getByText("文件内容为空")).toBeInTheDocument();
  });

  it("shows unavailable stats and no fake text for non-UTF8 files", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("binary.dat", { state: "nonUtf8" }, { state: "absent" }));
    renderDialog(onDetail, ["binary.dat"]);

    await waitFor(() => expect(screen.getByText("新（环境快照）：无法预览")).toBeInTheDocument());
    expect(screen.getByText("旧（项目当前文件）：文件不存在")).toBeInTheDocument();
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
    fireEvent.click(screen.getAllByRole("button", { name: "向上展开3行" })[0]);
    expect(renderedLineTexts()).toContain("line-11");
    expect(renderedLineTexts()).not.toContain("line-1");

    rerender(<EnvironmentDiffDialog open={false} {...props} />);
    expect(screen.queryByTestId("environment-diff-view")).not.toBeInTheDocument();
    rerender(<EnvironmentDiffDialog open {...props} />);
    await waitFor(() => expect(onDetail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    expect(renderedLineTexts()).not.toContain("line-1");
    expect(screen.getByText("还有 11 行")).toBeInTheDocument();
  });

  it("resets gap expansion when same-path detail is replaced", async () => {
    const oldContent = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`).join("\n");
    const firstDetail = vi.fn().mockResolvedValue(response("same-path.txt", { state: "text", content: oldContent.replace("line-15", "first-change") }, { state: "text", content: oldContent }));
    const secondDetail = vi.fn().mockResolvedValue(response("same-path.txt", { state: "text", content: oldContent.replace("line-15", "second-change") }, { state: "text", content: oldContent }));
    const props = { environmentName: "开发", environmentId: "dev", paths: ["same-path.txt"], busy: false, onOpenChange: vi.fn() };
    const { rerender } = render(<EnvironmentDiffDialog open {...props} onDetail={firstDetail} />);
    await waitFor(() => expect(hunkHeaders()).toHaveLength(1));
    fireEvent.click(screen.getAllByRole("button", { name: "向上展开3行" })[0]);
    expect(renderedLineTexts()).toContain("line-11");

    rerender(<EnvironmentDiffDialog open {...props} onDetail={secondDetail} />);
    await waitFor(() => expect(secondDetail).toHaveBeenCalledWith("dev", "same-path.txt"));
    await waitFor(() => expect(document.body.textContent).toContain("second-change"));
    expect(renderedLineTexts()).not.toContain("line-11");
    expect(screen.getByText("还有 11 行")).toBeInTheDocument();
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
