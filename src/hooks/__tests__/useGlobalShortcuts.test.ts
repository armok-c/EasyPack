import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

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
import type { CommandItem } from "@/lib/types";

function makeCommand(overrides: Partial<CommandItem> & { id: string; shortcut?: string }): CommandItem {
  return {
    name: "Test",
    command: "echo test",
    icon: "Terminal",
    type: "custom",
    scope: "global" as const,
    addedAt: Date.now(),
    ...overrides,
  };
}

describe("useGlobalShortcuts", () => {
  const onShortcutTrigger = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onShortcutTrigger.mockClear();
  });

  it("registers shortcuts on mount when enabled", async () => {
    const commands = [
      makeCommand({ id: "1", shortcut: "CommandOrControl+G" }),
      makeCommand({ id: "2", shortcut: "CommandOrControl+Shift+R" }),
    ];

    renderHook(() =>
      useGlobalShortcuts({
        commands,
        onExecute: onShortcutTrigger,
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
    const commands = [
      makeCommand({ id: "1", shortcut: "CommandOrControl+G" }),
    ];

    renderHook(() =>
      useGlobalShortcuts({
        commands,
        onExecute: onShortcutTrigger,
        enabled: false,
      })
    );

    await vi.waitFor(() => {
      expect(mockUnregisterAll).toHaveBeenCalled();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("unregisters all on unmount", async () => {
    const commands = [
      makeCommand({ id: "1", shortcut: "CommandOrControl+G" }),
    ];

    const { unmount } = renderHook(() =>
      useGlobalShortcuts({
        commands,
        onExecute: onShortcutTrigger,
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

  it("handler executes command only on Pressed state", async () => {
    const commands = [
      makeCommand({ id: "1", shortcut: "CommandOrControl+G" }),
    ];

    renderHook(() =>
      useGlobalShortcuts({
        commands,
        onExecute: onShortcutTrigger,
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
    expect(onShortcutTrigger).toHaveBeenCalledTimes(1);
    expect(onShortcutTrigger).toHaveBeenCalledWith("echo test");

    // Simulate Released state — should not trigger again
    handler({ shortcut: "CommandOrControl+G", state: "Released" });
    expect(onShortcutTrigger).toHaveBeenCalledTimes(1); // still 1
  });

  it("re-registers on commands change", async () => {
    const commands1 = [
      makeCommand({ id: "1", shortcut: "CommandOrControl+G" }),
    ];

    const { rerender } = renderHook(
      ({ commands }) =>
        useGlobalShortcuts({
          commands,
          onExecute: onShortcutTrigger,
          enabled: true,
        }),
      { initialProps: { commands: commands1 } }
    );

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });

    vi.clearAllMocks();

    const commands2 = [
      makeCommand({ id: "2", shortcut: "Alt+F5" }),
      makeCommand({ id: "3", shortcut: "CommandOrControl+T" }),
    ];

    rerender({ commands: commands2 });

    await vi.waitFor(() => {
      expect(mockUnregisterAll).toHaveBeenCalled();
      expect(mockRegister).toHaveBeenCalledTimes(2);
    });
  });
});
