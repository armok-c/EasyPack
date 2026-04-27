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
});
