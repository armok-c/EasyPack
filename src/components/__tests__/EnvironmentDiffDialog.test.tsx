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
  it("renders a read-only two-column merge view with line numbers and inline changes", async () => {
    const onDetail = vi.fn().mockResolvedValue(response(".env"));
    render(<EnvironmentDiffDialog open environmentName="开发" environmentId="dev" paths={[".env"]} busy={false} onOpenChange={vi.fn()} onDetail={onDetail} />);

    await waitFor(() => expect(screen.getByTestId("environment-diff-view")).toBeInTheDocument());
    expect(screen.getAllByText(/环境快照/).some((element) => element.textContent?.includes(".env"))).toBe(true);
    expect(screen.getAllByText(/项目当前文件/).some((element) => element.textContent?.includes(".env"))).toBe(true);
    expect(document.querySelectorAll(".cm-editor")).toHaveLength(2);
    expect(document.querySelectorAll(".cm-content[contenteditable='false']")).toHaveLength(2);
    const horizontalScroll = screen.getByTestId("environment-diff-scroll");
    expect(horizontalScroll).toHaveClass("overflow-x-auto");
    expect(horizontalScroll.querySelector("[data-testid='environment-diff-view']")).toBeInTheDocument();
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

    fireEvent.change(screen.getByRole("combobox", { name: "选择文件" }), { target: { value: "config" } });
    await waitFor(() => expect(onDetail).toHaveBeenCalledWith("dev", "config"));
    resolveSecond?.(response("config", { state: "text", content: "new\n" }, { state: "text", content: "newer\n" }));
    await waitFor(() => expect(Array.from(document.querySelectorAll(".cm-content")).some((element) => element.textContent?.includes("newer"))).toBe(true));
    resolveFirst?.(response(".env", { state: "text", content: "stale\n" }, { state: "text", content: "stale-current\n" }));
    await waitFor(() => {
      expect(Array.from(document.querySelectorAll(".cm-content")).some((element) => element.textContent?.includes("newer"))).toBe(true);
      expect(Array.from(document.querySelectorAll(".cm-content")).some((element) => element.textContent?.includes("stale-current"))).toBe(false);
    });
  });
});
