import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockStoreGet = vi.fn().mockResolvedValue(undefined);
const mockStoreSet = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: mockStoreGet,
    set: mockStoreSet,
  }),
}));

import { useRecentCommands } from "../useRecentCommands";
import type { Store } from "@tauri-apps/plugin-store";

function createMockStore(): Store {
  return {
    get: mockStoreGet,
    set: mockStoreSet,
  } as unknown as Store;
}

describe("useRecentCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreGet.mockResolvedValue(undefined);
    mockStoreSet.mockResolvedValue(undefined);
  });

  it("初始列表为空 []", async () => {
    const store = createMockStore();

    const { result } = renderHook(() => useRecentCommands({ store }));

    await waitFor(() => {
      expect(result.current.recentCommands).toEqual([]);
    });
  });

  it("addCommand({name, command}) 后列表长度为 1", async () => {
    const store = createMockStore();

    const { result } = renderHook(() => useRecentCommands({ store }));

    await waitFor(() => {
      expect(result.current.recentCommands).toEqual([]);
    });

    await act(async () => {
      await result.current.addRecentCommand("build", "npm run build");
    });

    expect(result.current.recentCommands).toHaveLength(1);
    expect(result.current.recentCommands[0]).toEqual({
      name: "build",
      command: "npm run build",
    });
  });

  it("重复指令移到头部而非追加（去重）", async () => {
    const store = createMockStore();

    const { result } = renderHook(() => useRecentCommands({ store }));

    await waitFor(() => {
      expect(result.current.recentCommands).toEqual([]);
    });

    await act(async () => {
      await result.current.addRecentCommand("build", "npm run build");
      await result.current.addRecentCommand("dev", "npm run dev");
      await result.current.addRecentCommand("build", "npm run build");
    });

    expect(result.current.recentCommands).toHaveLength(2);
    expect(result.current.recentCommands[0]).toEqual({
      name: "build",
      command: "npm run build",
    });
    expect(result.current.recentCommands[1]).toEqual({
      name: "dev",
      command: "npm run dev",
    });
  });

  it("列表最多保持 8 条", async () => {
    const store = createMockStore();

    const { result } = renderHook(() => useRecentCommands({ store }));

    await waitFor(() => {
      expect(result.current.recentCommands).toEqual([]);
    });

    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await result.current.addRecentCommand(`cmd-${i}`, `cmd-${i}`);
      }
    });

    expect(result.current.recentCommands).toHaveLength(8);
    expect(result.current.recentCommands[0]).toEqual({
      name: "cmd-9",
      command: "cmd-9",
    });
  });

  it("store 持久化 key 为 recentCommands", async () => {
    const store = createMockStore();

    const { result } = renderHook(() => useRecentCommands({ store }));

    await waitFor(() => {
      expect(result.current.recentCommands).toEqual([]);
    });

    await act(async () => {
      await result.current.addRecentCommand("build", "npm run build");
    });

    expect(mockStoreSet).toHaveBeenCalledWith(
      "recentCommands",
      expect.arrayContaining([
        expect.objectContaining({ name: "build", command: "npm run build" }),
      ])
    );
  });
});
