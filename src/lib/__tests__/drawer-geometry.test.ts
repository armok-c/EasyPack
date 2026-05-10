import { describe, it, expect } from "vitest";
import {
  detectSnapEdge,
  calculateSliverRect,
  type MonitorInfo,
  type WindowInfo,
  type Rect,
} from "../drawer-geometry";

// Helper: 创建默认的 monitor workArea (1920x1080 主显示器)
function makeDefaultMonitor(overrides?: Partial<MonitorInfo>): MonitorInfo {
  return {
    workArea: { x: 0, y: 0, w: 1920, h: 1080 },
    scaleFactor: 1,
    isPrimary: true,
    ...overrides,
  };
}

// Helper: 创建窗口信息
function makeWindow(overrides?: Partial<WindowInfo>): WindowInfo {
  return {
    x: 100,
    y: 100,
    w: 800,
    h: 600,
    isMaximized: false,
    ...overrides,
  };
}

describe("detectSnapEdge", () => {
  it("窗口左边距 workArea 左边 5px 时返回 { edge: 'left' }", () => {
    const monitor = makeDefaultMonitor();
    const win = makeWindow({ x: 5, y: 200 });
    const result = detectSnapEdge(win, monitor);
    expect(result).toEqual({ edge: "left" });
  });

  it("窗口右边距 workArea 右边 3px 时返回 { edge: 'right' }", () => {
    const monitor = makeDefaultMonitor();
    // workArea 右边界 = 1920, 窗口右边 = win.x + win.w = 1917, 距离 = 3
    const win = makeWindow({ x: 1917 - 800, y: 200 });
    const result = detectSnapEdge(win, monitor);
    expect(result).toEqual({ edge: "right" });
  });

  it("窗口上边距 workArea 上边 8px 时返回 { edge: 'top' }", () => {
    const monitor = makeDefaultMonitor();
    const win = makeWindow({ x: 200, y: 8 });
    const result = detectSnapEdge(win, monitor);
    expect(result).toEqual({ edge: "top" });
  });

  it("窗口下边距 workArea 下边 10px 时返回 { edge: 'bottom' }", () => {
    const monitor = makeDefaultMonitor();
    // workArea 下边界 = 1080, 窗口下边 = win.y + win.h = 1070, 距离 = 10
    const win = makeWindow({ x: 200, y: 1080 - 600 - 10 });
    const result = detectSnapEdge(win, monitor);
    expect(result).toEqual({ edge: "bottom" });
  });

  it("窗口距所有边 > 10px 时返回 null", () => {
    const monitor = makeDefaultMonitor();
    const win = makeWindow({ x: 100, y: 100 });
    const result = detectSnapEdge(win, monitor);
    expect(result).toBeNull();
  });

  it("当 monitor 不是主显示器时返回 null (D-18)", () => {
    const monitor = makeDefaultMonitor({ isPrimary: false });
    const win = makeWindow({ x: 5, y: 200 });
    const result = detectSnapEdge(win, monitor);
    expect(result).toBeNull();
  });

  it("当窗口最大化时返回 null (D-05)", () => {
    const monitor = makeDefaultMonitor();
    const win = makeWindow({ x: 0, y: 0, w: 1920, h: 1080, isMaximized: true });
    const result = detectSnapEdge(win, monitor);
    expect(result).toBeNull();
  });
});

describe("calculateSliverRect", () => {
  const workArea: Rect = { x: 0, y: 0, w: 1920, h: 1080 };

  it("为 left 边返回正确的 sliver 矩形", () => {
    const result = calculateSliverRect("left", workArea, 1);
    expect(result).toEqual({
      x: 0,
      y: 0,
      w: 2, // Math.ceil(2/1) = 2
      h: 1080,
    });
  });

  it("为 right 边返回正确的 sliver 矩形", () => {
    const result = calculateSliverRect("right", workArea, 1);
    expect(result).toEqual({
      x: 1920 - 2,
      y: 0,
      w: 2,
      h: 1080,
    });
  });

  it("为 top 边返回正确的 sliver 矩形", () => {
    const result = calculateSliverRect("top", workArea, 1);
    expect(result).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: 2,
    });
  });

  it("为 bottom 边返回正确的 sliver 矩形", () => {
    const result = calculateSliverRect("bottom", workArea, 1);
    expect(result).toEqual({
      x: 0,
      y: 1080 - 2,
      w: 1920,
      h: 2,
    });
  });

  it("sliver 宽度在 150% DPI 下为 Math.ceil(2/1.5) = 2 逻辑像素 (D-08)", () => {
    const result = calculateSliverRect("left", workArea, 1.5);
    // Math.ceil(2 / 1.5) = Math.ceil(1.333...) = 2
    expect(result.w).toBe(2);
  });
});
