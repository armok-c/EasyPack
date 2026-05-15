import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockRegister, mockUnregisterAll, mockIsRegistered } = vi.hoisted(() => ({
  mockRegister: vi.fn().mockResolvedValue(undefined),
  mockUnregisterAll: vi.fn().mockResolvedValue(undefined),
  mockIsRegistered: vi.fn().mockResolvedValue(false),
}));

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: mockRegister,
  unregister: vi.fn().mockResolvedValue(undefined),
  unregisterAll: mockUnregisterAll,
  isRegistered: mockIsRegistered,
}));

import { useGlobalShortcuts } from "../useGlobalShortcuts";
import type { ShortcutAction } from "@/lib/types";

function makeAction(id: string, shortcut?: string): ShortcutAction {
  return {
    id,
    label: `Action ${id}`,
    category: "command",
    handler: vi.fn(),
  };
}

describe("useGlobalShortcuts", () => {
  const onActionTrigger = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onActionTrigger.mockClear();
  });

  it("registers shortcuts on mount when enabled", async () => {
    const actions = [makeAction("cmd-1"), makeAction("cmd-2")];
    const bindings: Record<string, string> = {
      "cmd-1": "CommandOrControl+G",
      "cmd-2": "CommandOrControl+Shift+R",
    };

    renderHook(() =>
      useGlobalShortcuts({
        actions,
        bindings,
        enabled: true,
      })
    );

    // Wait for async registerAll to complete
    await vi.waitFor(() => {
      expect(mockUnregisterAll).toHaveBeenCalled();
      expect(mockRegister).toHaveBeenCalledTimes(2);
    });
  });

  it("does not register when disabled", async () => {
    const actions = [makeAction("cmd-1")];
    const bindings: Record<string, string> = { "cmd-1": "CommandOrControl+G" };

    renderHook(() =>
      useGlobalShortcuts({
        actions,
        bindings,
        enabled: false,
      })
    );

    await vi.waitFor(() => {
      expect(mockUnregisterAll).toHaveBeenCalled();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("unregisters all on unmount", async () => {
    const actions = [makeAction("cmd-1")];
    const bindings: Record<string, string> = { "cmd-1": "CommandOrControl+G" };

    const { unmount } = renderHook(() =>
      useGlobalShortcuts({
        actions,
        bindings,
        enabled: true,
      })
    );

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    const callCountBeforeUnmount = mockUnregisterAll.mock.calls.length;
    unmount();

    expect(mockUnregisterAll.mock.calls.length).toBeGreaterThan(callCountBeforeUnmount);
  });

  it("handler executes action only on Pressed state", async () => {
    const action = makeAction("cmd-1");
    const actions = [action];
    const bindings: Record<string, string> = { "cmd-1": "CommandOrControl+G" };

    renderHook(() =>
      useGlobalShortcuts({
        actions,
        bindings,
        enabled: true,
      })
    );

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    // Extract the handler passed to register()
    const handler = mockRegister.mock.calls[0][1];

    // Simulate Pressed state
    handler({ shortcut: "CommandOrControl+G", state: "Pressed" });
    expect(action.handler).toHaveBeenCalledTimes(1);

    // Simulate Released state — should not trigger again
    handler({ shortcut: "CommandOrControl+G", state: "Released" });
    expect(action.handler).toHaveBeenCalledTimes(1); // still 1
  });

  it("re-registers on actions/bindings change", async () => {
    const actions1 = [makeAction("cmd-1")];
    const bindings1: Record<string, string> = { "cmd-1": "CommandOrControl+G" };

    const { rerender } = renderHook(
      ({ actions, bindings }: { actions: ShortcutAction[]; bindings: Record<string, string> }) =>
        useGlobalShortcuts({
          actions,
          bindings,
          enabled: true,
        }),
      { initialProps: { actions: actions1, bindings: bindings1 } }
    );

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });

    vi.clearAllMocks();

    const actions2 = [makeAction("cmd-2"), makeAction("cmd-3")];
    const bindings2: Record<string, string> = {
      "cmd-2": "Alt+F5",
      "cmd-3": "CommandOrControl+T",
    };

    rerender({ actions: actions2, bindings: bindings2 });

    await vi.waitFor(() => {
      expect(mockUnregisterAll).toHaveBeenCalled();
      expect(mockRegister).toHaveBeenCalledTimes(2);
    });
  });

  it("only registers actions that have bindings", async () => {
    const actions = [makeAction("cmd-1"), makeAction("cmd-2"), makeAction("cmd-3")];
    const bindings: Record<string, string> = {
      "cmd-2": "Alt+F5",
    };

    renderHook(() =>
      useGlobalShortcuts({
        actions,
        bindings,
        enabled: true,
      })
    );

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });
  });
});
