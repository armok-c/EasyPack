import { describe, expect, it, vi } from "vitest";
import { requestProjectSwitch } from "@/lib/project-switch";

describe("requestProjectSwitch", () => {
  it("selects the target only after the leave guard allows it", async () => {
    const pending = { current: null };
    const requestLeave = vi.fn().mockResolvedValue(true);
    const selectProject = vi.fn().mockResolvedValue(undefined);

    requestProjectSwitch({
      projectId: "project-b",
      selectedId: "project-a",
      pending,
      requestLeave,
      selectProject,
    });

    await vi.waitFor(() => expect(selectProject).toHaveBeenCalledWith("project-b"));
    expect(requestLeave).toHaveBeenCalledOnce();
    expect(pending.current).toBeNull();
  });

  it("does not select when the leave guard rejects the switch", async () => {
    const pending = { current: null };
    const selectProject = vi.fn();

    requestProjectSwitch({
      projectId: "project-b",
      selectedId: "project-a",
      pending,
      requestLeave: vi.fn().mockResolvedValue(false),
      selectProject,
    });

    await vi.waitFor(() => expect(pending.current).toBeNull());
    expect(selectProject).not.toHaveBeenCalled();
  });

  it("ignores a second target while the first guard is pending", async () => {
    let resolveLeave: (allowed: boolean) => void = () => undefined;
    const requestLeave = vi.fn().mockReturnValue(new Promise<boolean>((resolve) => { resolveLeave = resolve; }));
    const selectProject = vi.fn().mockResolvedValue(undefined);
    const pending = { current: null };

    requestProjectSwitch({
      projectId: "project-b",
      selectedId: "project-a",
      pending,
      requestLeave,
      selectProject,
    });
    requestProjectSwitch({
      projectId: "project-c",
      selectedId: "project-a",
      pending,
      requestLeave,
      selectProject,
    });

    expect(requestLeave).toHaveBeenCalledOnce();
    resolveLeave(true);
    await vi.waitFor(() => expect(selectProject).toHaveBeenCalledWith("project-b"));
    expect(selectProject).toHaveBeenCalledTimes(1);
  });
});
