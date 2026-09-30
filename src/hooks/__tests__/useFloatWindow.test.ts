import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFloatWindow } from "../useFloatWindow";

const { createWindow } = vi.hoisted(() => ({ createWindow: vi.fn() }));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: class {
    static getByLabel = vi.fn().mockResolvedValue(null);
    constructor(label: string, options: unknown) { createWindow(label, options); }
    async listen(event: string, callback: () => void) {
      if (event === "tauri://created") queueMicrotask(callback);
      return () => {};
    }
  },
}));
vi.mock("@tauri-apps/api/window", () => ({ primaryMonitor: vi.fn().mockResolvedValue(null) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emitTo: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("creates a transparent float without the Windows native white border", async () => {
  const { result } = renderHook(() => useFloatWindow({
    currentProject: null, projects: [], commands: [],
    onExecute: vi.fn(), onSwitchProject: vi.fn(),
  }));
  act(() => result.current.toggleFloat());
  await waitFor(() => expect(result.current.floatVisible).toBe(true));
  expect(createWindow).toHaveBeenCalledWith("float", expect.objectContaining({
    decorations: false,
    transparent: true,
    shadow: false,
  }));
});
