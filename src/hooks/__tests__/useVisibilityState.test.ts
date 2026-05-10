import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisibilityState } from "../useVisibilityState";

describe("useVisibilityState", () => {
  it("初始状态为 VISIBLE", () => {
    const { result } = renderHook(() => useVisibilityState());
    expect(result.current.visibility).toBe("VISIBLE");
    expect(result.current.isVisible).toBe(true);
  });

  it("hideToTray() 后状态变为 TRAY_HIDDEN", () => {
    const { result } = renderHook(() => useVisibilityState());

    act(() => {
      result.current.hideToTray();
    });

    expect(result.current.visibility).toBe("TRAY_HIDDEN");
    expect(result.current.isVisible).toBe(false);
  });

  it("showFromTray() 后状态变为 VISIBLE", () => {
    const { result } = renderHook(() => useVisibilityState());

    act(() => {
      result.current.hideToTray();
    });
    expect(result.current.visibility).toBe("TRAY_HIDDEN");

    act(() => {
      result.current.showFromTray();
    });

    expect(result.current.visibility).toBe("VISIBLE");
    expect(result.current.isVisible).toBe(true);
  });

  it("setVisibility() 可直接设置状态", () => {
    const { result } = renderHook(() => useVisibilityState());

    act(() => {
      result.current.setVisibility("TRAY_HIDDEN");
    });

    expect(result.current.visibility).toBe("TRAY_HIDDEN");
    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.setVisibility("VISIBLE");
    });

    expect(result.current.visibility).toBe("VISIBLE");
    expect(result.current.isVisible).toBe(true);
  });

  it("setVisibility 接受字符串类型参数（Phase 14 扩展接口）", () => {
    const { result } = renderHook(() => useVisibilityState());

    const state: string = "TRAY_HIDDEN";

    act(() => {
      result.current.setVisibility(state as "TRAY_HIDDEN");
    });

    expect(result.current.visibility).toBe("TRAY_HIDDEN");
  });

  // Phase 14: 三态扩展测试
  it("hideToDrawer 将状态设为 DRAWER_HIDDEN", () => {
    const { result } = renderHook(() => useVisibilityState());

    act(() => {
      result.current.hideToDrawer();
    });

    expect(result.current.visibility).toBe("DRAWER_HIDDEN");
    expect(result.current.isVisible).toBe(false);
    expect(result.current.isDrawerHidden).toBe(true);
  });

  it("showFromDrawer 从 DRAWER_HIDDEN 恢复为 VISIBLE", () => {
    const { result } = renderHook(() => useVisibilityState());

    act(() => {
      result.current.hideToDrawer();
    });
    expect(result.current.visibility).toBe("DRAWER_HIDDEN");

    act(() => {
      result.current.showFromDrawer();
    });

    expect(result.current.visibility).toBe("VISIBLE");
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isDrawerHidden).toBe(false);
  });

  it("hideToTray 在 DRAWER_HIDDEN 时直接覆盖为 TRAY_HIDDEN（互斥）", () => {
    const { result } = renderHook(() => useVisibilityState());

    act(() => {
      result.current.hideToDrawer();
    });
    expect(result.current.visibility).toBe("DRAWER_HIDDEN");

    act(() => {
      result.current.hideToTray();
    });

    expect(result.current.visibility).toBe("TRAY_HIDDEN");
    expect(result.current.isDrawerHidden).toBe(false);
  });

  it("hideToDrawer 在 TRAY_HIDDEN 时直接覆盖为 DRAWER_HIDDEN（互斥）", () => {
    const { result } = renderHook(() => useVisibilityState());

    act(() => {
      result.current.hideToTray();
    });
    expect(result.current.visibility).toBe("TRAY_HIDDEN");

    act(() => {
      result.current.hideToDrawer();
    });

    expect(result.current.visibility).toBe("DRAWER_HIDDEN");
    expect(result.current.isDrawerHidden).toBe(true);
  });

  it("isVisible 在 VISIBLE 时为 true，其他两态为 false", () => {
    const { result } = renderHook(() => useVisibilityState());

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.hideToTray();
    });
    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.showFromTray();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.hideToDrawer();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("isDrawerHidden 在 DRAWER_HIDDEN 时为 true，其他两态为 false", () => {
    const { result } = renderHook(() => useVisibilityState());

    expect(result.current.isDrawerHidden).toBe(false);

    act(() => {
      result.current.hideToTray();
    });
    expect(result.current.isDrawerHidden).toBe(false);

    act(() => {
      result.current.hideToDrawer();
    });
    expect(result.current.isDrawerHidden).toBe(true);

    act(() => {
      result.current.showFromDrawer();
    });
    expect(result.current.isDrawerHidden).toBe(false);
  });
});
