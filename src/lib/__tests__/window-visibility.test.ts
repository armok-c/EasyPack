import { describe, expect, it, vi } from "vitest";
import { ensureMainWindowVisible } from "@/lib/window-visibility";

function makeWindow(isVisible: boolean, isMinimized = false) {
  return {
    isVisible: vi.fn().mockResolvedValue(isVisible),
    isMinimized: vi.fn().mockResolvedValue(isMinimized),
    unminimize: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ensureMainWindowVisible", () => {
  it("reveals and focuses a hidden main window", async () => {
    const window = makeWindow(false);
    const showFromTray = vi.fn();

    await ensureMainWindowVisible({
      window,
      visibility: "TRAY_HIDDEN",
      showFromTray,
      showFromDrawer: vi.fn(),
    });

    expect(showFromTray).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.setFocus).toHaveBeenCalledOnce();
    expect(window.show.mock.invocationCallOrder[0]).toBeLessThan(window.setFocus.mock.invocationCallOrder[0]);
  });

  it("does not call show again when the main window is already visible", async () => {
    const window = makeWindow(true);
    const showFromTray = vi.fn();

    await ensureMainWindowVisible({
      window,
      visibility: "VISIBLE",
      showFromTray,
      showFromDrawer: vi.fn(),
    });

    expect(showFromTray).not.toHaveBeenCalled();
    expect(window.isMinimized).toHaveBeenCalledOnce();
    expect(window.unminimize).not.toHaveBeenCalled();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.setFocus).toHaveBeenCalledOnce();
  });

  it("unminimizes a visible main window before focusing it", async () => {
    const window = makeWindow(true, true);

    await ensureMainWindowVisible({
      window,
      visibility: "VISIBLE",
      showFromTray: vi.fn(),
      showFromDrawer: vi.fn(),
    });

    expect(window.isMinimized).toHaveBeenCalledOnce();
    expect(window.unminimize).toHaveBeenCalledOnce();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.setFocus).toHaveBeenCalledOnce();
    expect(window.unminimize.mock.invocationCallOrder[0]).toBeLessThan(window.setFocus.mock.invocationCallOrder[0]);
  });

  it("restores a drawer-hidden window before focusing it", async () => {
    const window = makeWindow(true);
    const restoreFromDrawer = vi.fn().mockResolvedValue(undefined);
    const showFromDrawer = vi.fn();

    await ensureMainWindowVisible({
      window,
      visibility: "DRAWER_HIDDEN",
      showFromTray: vi.fn(),
      showFromDrawer,
      restoreFromDrawer,
    });

    expect(restoreFromDrawer).toHaveBeenCalledOnce();
    expect(showFromDrawer).toHaveBeenCalledOnce();
    expect(window.setFocus).toHaveBeenCalledOnce();
  });
});
