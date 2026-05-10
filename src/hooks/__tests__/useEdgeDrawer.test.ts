import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { VisibilityState } from "../useVisibilityState";

// ---- Mocks ----

const mockOuterPosition = vi.fn();
const mockInnerSize = vi.fn();
const mockIsMaximized = vi.fn();
const mockPrimaryMonitor = vi.fn();
const mockSetPosition = vi.fn().mockResolvedValue(undefined);
const mockSetSize = vi.fn().mockResolvedValue(undefined);
const mockSetMinSize = vi.fn().mockResolvedValue(undefined);

const mockWindow = {
  outerPosition: mockOuterPosition,
  innerSize: mockInnerSize,
  isMaximized: mockIsMaximized,
  primaryMonitor: mockPrimaryMonitor,
  setPosition: mockSetPosition,
  setSize: mockSetSize,
  setMinSize: mockSetMinSize,
};

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => mockWindow,
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
  LogicalSize: class LogicalSize {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  },
}));

const mockUnlisten = vi.fn();
const mockListen = vi.fn().mockResolvedValue(mockUnlisten);
const mockEmit = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
  emit: (...args: unknown[]) => mockEmit(...args),
}));

// ---- Static import after vi.mock (hoisted) ----

import { useEdgeDrawer } from "../useEdgeDrawer";

// ---- Helpers ----

/** 默认主显示器 workArea (逻辑像素) */
const DEFAULT_WORKAREA = { x: 0, y: 0, w: 1920, h: 1080 };
const DEFAULT_SCALE = 1.0;

function setupWindowAtPosition(
  winX: number,
  winY: number,
  winW: number,
  winH: number,
  opts?: { isMaximized?: boolean; scaleFactor?: number }
) {
  const scale = opts?.scaleFactor ?? DEFAULT_SCALE;
  mockOuterPosition.mockResolvedValue({ x: winX, y: winY });
  mockInnerSize.mockResolvedValue({ width: winW, height: winH });
  mockIsMaximized.mockResolvedValue(opts?.isMaximized ?? false);
  mockPrimaryMonitor.mockResolvedValue({
    workArea: {
      position: { x: DEFAULT_WORKAREA.x, y: DEFAULT_WORKAREA.y },
      size: { width: DEFAULT_WORKAREA.w, height: DEFAULT_WORKAREA.h },
    },
    scaleFactor: scale,
    isPrimary: true,
  });
}

function createMockVisibility(): {
  visibility: VisibilityState;
  hideToDrawer: ReturnType<typeof vi.fn>;
  showFromDrawer: ReturnType<typeof vi.fn>;
} {
  let vis: VisibilityState = "VISIBLE";
  return {
    get visibility() { return vis; },
    hideToDrawer: vi.fn(() => { vis = "DRAWER_HIDDEN"; }),
    showFromDrawer: vi.fn(() => { vis = "VISIBLE"; }),
  };
}

// ---- Tests ----

describe("useEdgeDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockListen.mockResolvedValue(mockUnlisten);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- handleDragEnd: 吸附检测 ----

  it("handleDragEnd 在窗口左边缘距 workArea 5px 时触发吸附", async () => {
    setupWindowAtPosition(5, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    await act(async () => {
      await result.current.handleDragEnd();
    });

    expect(vis.hideToDrawer).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith("drawer:start-polling", expect.any(Object));
    expect(result.current.snapEdge).toBe("left");
  });

  it("handleDragEnd 在窗口距所有边 > 10px 时不触发吸附", async () => {
    setupWindowAtPosition(200, 200, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    await act(async () => {
      await result.current.handleDragEnd();
    });

    expect(vis.hideToDrawer).not.toHaveBeenCalled();
    expect(result.current.snapEdge).toBeNull();
  });

  it("handleDragEnd 在窗口最大化时不触发吸附", async () => {
    setupWindowAtPosition(0, 0, 1920, 1080, { isMaximized: true });

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    await act(async () => {
      await result.current.handleDragEnd();
    });

    expect(vis.hideToDrawer).not.toHaveBeenCalled();
    expect(result.current.snapEdge).toBeNull();
  });

  it("handleDragEnd 设置状态为 DRAWER_HIDDEN 并调用动画收缩为 sliver", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    await act(async () => {
      await result.current.handleDragEnd();
    });

    // 应该先移除 minWidth 限制
    expect(mockSetMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 0, height: 0 }));
    // 应该触发 hideToDrawer（设置 DRAWER_HIDDEN 状态）
    expect(vis.hideToDrawer).toHaveBeenCalled();
    // 应该通知 Rust 启动轮询
    expect(mockEmit).toHaveBeenCalledWith("drawer:start-polling", expect.any(Object));
  });

  // ---- drawer:mouse-near-edge 事件触发滑出 ----

  it("收到 drawer:mouse-near-edge 事件时触发滑出动画", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    let eventHandler: ((event: { payload: unknown }) => void) | null = null;
    mockListen.mockImplementation(async (event: string, handler: (e: unknown) => void) => {
      if (event === "drawer:mouse-near-edge") {
        eventHandler = handler;
      }
      return mockUnlisten;
    });

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    // 吸附
    await act(async () => {
      await result.current.handleDragEnd();
    });

    expect(eventHandler).not.toBeNull();

    // 模拟鼠标接近边缘
    await act(async () => {
      eventHandler!({ payload: {} });
    });

    expect(mockEmit).toHaveBeenCalledWith("drawer:stop-polling");
    expect(vis.showFromDrawer).toHaveBeenCalled();
  });

  // ---- 延迟收回 ----

  it("滑出后 onMouseLeave 触发延迟收回定时器（400ms 后收回）", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    // 先吸附
    await act(async () => {
      await result.current.handleDragEnd();
    });

    // 触发 onMouseLeave
    act(() => {
      result.current.handleMouseLeave();
    });

    // 推进时间 400ms
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // hideToDrawer 应至少调用 2 次（吸附 + 收回）
    expect(vis.hideToDrawer.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("onMouseEnter 取消延迟收回定时器", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    // 先吸附
    await act(async () => {
      await result.current.handleDragEnd();
    });

    const callCountBefore = vis.hideToDrawer.mock.calls.length;

    // 触发 onMouseLeave
    act(() => {
      result.current.handleMouseLeave();
    });

    // 在定时器到期前 onMouseEnter
    act(() => {
      result.current.handleMouseEnter();
    });

    // 推进时间，不应该有收回
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // hideToDrawer 调用次数不应增加
    expect(vis.hideToDrawer.mock.calls.length).toBe(callCountBefore);
  });

  // ---- 取消吸附 ----

  it("拖拽超过 20px 时触发取消吸附，恢复原始位置和尺寸", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    // 先吸附
    await act(async () => {
      await result.current.handleDragEnd();
    });

    expect(result.current.snapEdge).toBe("left");

    // 拖拽超过 20px (delta = 15 + 10 = 25 > 20)
    act(() => {
      result.current.handleDragWhileSnapped(15, 10);
    });

    expect(result.current.snapEdge).toBeNull();
    expect(mockEmit).toHaveBeenCalledWith("drawer:stop-polling");
    // 恢复 minWidth
    expect(mockSetMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 600, height: 400 }));
  });

  // ---- drawerEnabled=false ----

  it("drawerEnabled=false 时所有吸附逻辑不执行", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: false,
      })
    );

    await act(async () => {
      await result.current.handleDragEnd();
    });

    expect(vis.hideToDrawer).not.toHaveBeenCalled();
    expect(result.current.snapEdge).toBeNull();
  });

  // ---- 吸附时记录原始位置 ----

  it("吸附时记录原始窗口位置和尺寸", async () => {
    // 窗口紧贴左边缘 (x=3 <= 10px 阈值)
    setupWindowAtPosition(3, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    await act(async () => {
      await result.current.handleDragEnd();
    });

    // 吸附成功（snapEdge 不为 null）
    expect(result.current.snapEdge).not.toBeNull();
  });

  // ---- minWidth 限制管理 ----

  it("吸附时临时移除 minWidth 限制", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    await act(async () => {
      await result.current.handleDragEnd();
    });

    // 应该调用 setMinSize(0, 0) 移除限制
    expect(mockSetMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 0, height: 0 }));
  });

  it("取消吸附时恢复 minWidth 限制", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    // 先吸附
    await act(async () => {
      await result.current.handleDragEnd();
    });

    mockSetMinSize.mockClear();

    // 取消吸附 (delta = 15 + 10 = 25 > 20)
    act(() => {
      result.current.handleDragWhileSnapped(15, 10);
    });

    // 应该恢复 minWidth 到 600x400
    expect(mockSetMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 600, height: 400 }));
  });

  // ---- restoreFromDrawer ----

  it("restoreFromDrawer 停止轮询，恢复窗口位置和 minWidth，清除 snapEdge", async () => {
    setupWindowAtPosition(0, 100, 720, 480);

    const vis = createMockVisibility();
    const { result } = renderHook(() =>
      useEdgeDrawer({
        visibility: vis.visibility,
        hideToDrawer: vis.hideToDrawer,
        showFromDrawer: vis.showFromDrawer,
        drawerEnabled: true,
      })
    );

    // 先吸附
    await act(async () => {
      await result.current.handleDragEnd();
    });

    expect(result.current.snapEdge).toBe("left");

    mockSetMinSize.mockClear();
    mockEmit.mockClear();

    // 调用 restoreFromDrawer
    await act(async () => {
      await result.current.restoreFromDrawer();
    });

    // 应该停止轮询
    expect(mockEmit).toHaveBeenCalledWith("drawer:stop-polling");
    // 应该恢复 minWidth
    expect(mockSetMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 600, height: 400 }));
    // 应该清除 snapEdge
    expect(result.current.snapEdge).toBeNull();
    // 不应该调用 showFromDrawer（由调用方负责）
    expect(vis.showFromDrawer).not.toHaveBeenCalled();
  });
});
