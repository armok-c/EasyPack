import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { EnvironmentDiffDialog } from "@/components/EnvironmentDiffDialog";
import type { EnvironmentDetailResponse } from "@/lib/environment-types";

function response(path: string, snapshot: EnvironmentDetailResponse["snapshot"] = { state: "text", content: "A=1\n" }, current: EnvironmentDetailResponse["current"] = { state: "text", content: "A=2\n" }): EnvironmentDetailResponse {
  return {
    profileId: "profile-a",
    projectId: "project-a",
    environmentId: "dev",
    path,
    snapshot,
    current,
  };
}

describe("EnvironmentDiffDialog", () => {
  it("truncates long file paths in the selector and both diff headers", async () => {
    const longPath = "nested/" + "very-long-file-name-".repeat(12) + "config.txt";
    const onDetail = vi.fn().mockResolvedValue(response(longPath));
    render(<EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={[longPath]} busy={false} onOpenChange={vi.fn()} onDetail={onDetail} />);

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    expect(trigger).toHaveClass("min-w-0", "flex-1");
    expect(trigger).toHaveAttribute("title", longPath);
    expect(trigger.className).toContain("*:data-[slot=select-value]:min-w-0");
    expect(trigger.className).toContain("*:data-[slot=select-value]:truncate");

    const snapshotHeader = screen.getByTitle(`环境快照 · ${longPath}`);
    const currentHeader = screen.getByTitle(`项目当前文件 · ${longPath}`);
    expect(snapshotHeader).toHaveClass("min-w-[440px]", "truncate");
    expect(currentHeader).toHaveClass("min-w-[440px]", "truncate");

    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    try {
      fireEvent.click(trigger);
      const content = screen.getByRole("listbox");
      expect(content).toHaveClass("min-w-0", "w-[var(--radix-select-trigger-width)]", "max-w-[var(--radix-select-content-available-width)]");
      const option = await screen.findByRole("option", { name: longPath });
      expect(option).toHaveClass("min-w-0");
      expect(option).toHaveAttribute("title", longPath);
      expect(option.querySelector('[data-slot="select-item-text"]')).toBeInTheDocument();
      expect(option.className).toContain("*:[span]:last:min-w-0");
      expect(option.className).toContain("*:[span]:last:truncate");
    } finally {
      if (originalScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: originalScrollIntoView });
      else delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  it("truncates a long title without colliding with the close button", async () => {
    const longName = "这是一个非常长的环境名称用于测试标题省略显示";
    const onDetail = vi.fn().mockResolvedValue(response(".env"));
    render(<EnvironmentDiffDialog open environmentName={longName} environmentId="dev" paths={[".env"]} busy={false} onOpenChange={vi.fn()} onDetail={onDetail} />);

    const title = screen.getByRole("heading", { name: `查看环境：${longName}` });
    expect(title).toHaveClass("min-w-0", "truncate", "pr-8");
    expect(title).toHaveAttribute("title", `查看环境：${longName}`);
    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", ".env"));
  });

  it("renders a read-only two-column merge view with line numbers and inline changes", async () => {
    const onDetail = vi.fn().mockResolvedValue(response(".env"));
    render(<EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={[".env"]} busy={false} onOpenChange={vi.fn()} onDetail={onDetail} />);

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getAllByText(/环境快照/).some((element) => element.textContent?.includes(".env"))).toBe(true);
    expect(screen.getAllByText(/项目当前文件/).some((element) => element.textContent?.includes(".env"))).toBe(true);
    expect(document.querySelectorAll(".cm-editor")).toHaveLength(2);
    expect(document.querySelectorAll(".cm-content[contenteditable='false']")).toHaveLength(2);
    const horizontalScroll = screen.getByTestId("environment-diff-scroll");
    const diffView = screen.getByTestId("environment-diff-view");
    expect(horizontalScroll).toHaveClass("overflow-x-auto");
    expect(diffView).toBeInTheDocument();
    expect(diffView.className).not.toContain("cm-mergeViewEditors");
    expect(horizontalScroll.querySelector(".cm-mergeView")).toBeInTheDocument();
    expect(document.querySelectorAll("[class*='overflow-x-auto']")).toHaveLength(1);
    const editorContents = Array.from(document.querySelectorAll(".cm-content"));
    expect(editorContents.some((element) => element.textContent?.includes("A=1"))).toBe(true);
    expect(editorContents.some((element) => element.textContent?.includes("A=2"))).toBe(true);
    expect(onDetail).toHaveBeenCalledWith("dev", ".env");
  });

  it("labels absent and non-UTF8 files without exposing fake text", async () => {
    const onDetail = vi.fn().mockResolvedValue(response("binary.dat", { state: "nonUtf8" }, { state: "absent" }));
    render(<EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={["binary.dat"]} busy={false} onOpenChange={vi.fn()} onDetail={onDetail} />);

    await waitFor(() => expect(screen.getByText("无法预览")).toBeInTheDocument());
    expect(screen.getByText("文件不存在")).toBeInTheDocument();
    expect(screen.queryByText("A=1")).not.toBeInTheDocument();
  });

  it("discards a stale detail response after switching files", async () => {
    let resolveFirst: ((value: EnvironmentDetailResponse) => void) | undefined;
    let resolveSecond: ((value: EnvironmentDetailResponse) => void) | undefined;
    const onDetail = vi.fn((_: string, path: string) => new Promise<EnvironmentDetailResponse>((resolve) => {
      if (path === ".env") resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    render(<EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={[".env", "config"]} busy={false} onOpenChange={vi.fn()} onDetail={onDetail} />);
    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", ".env"));

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
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
    await waitFor(() => expect(Array.from(document.querySelectorAll(".cm-content")).some((element) => element.textContent?.includes("newer"))).toBe(true));
    resolveFirst?.(response(".env", { state: "text", content: "stale\n" }, { state: "text", content: "stale-current\n" }));
    await waitFor(() => {
      expect(Array.from(document.querySelectorAll(".cm-content")).some((element) => element.textContent?.includes("newer"))).toBe(true);
      expect(Array.from(document.querySelectorAll(".cm-content")).some((element) => element.textContent?.includes("stale-current"))).toBe(false);
    });
  });

  it("disables the file selector and shows its empty placeholder when no files are managed", () => {
    render(<EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={[]} busy={false} onOpenChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "选择文件" });
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("没有受管文件");
  });
});
