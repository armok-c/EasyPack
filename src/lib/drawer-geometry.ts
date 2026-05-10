/**
 * drawer-geometry.ts — 边缘抽屉几何计算工具
 *
 * 提供窗口边缘吸附检测 (detectSnapEdge) 和 thin sliver 坐标计算 (calculateSliverRect)。
 * 所有参数使用纯对象类型，不依赖 Tauri API，便于单元测试。
 */

export type SnapEdge = "top" | "bottom" | "left" | "right";

export interface SnapResult {
  edge: SnapEdge;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MonitorInfo {
  workArea: Rect;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface WindowInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  isMaximized: boolean;
}

/** 吸附阈值：窗口边缘距 workArea 边 <= 10px 时触发 (D-01) */
const SNAP_THRESHOLD = 10;

/**
 * 检测窗口是否吸附到 monitor workArea 的某个边缘。
 *
 * 规则：
 * 1. 仅主显示器 (D-18)
 * 2. 最大化状态不吸附 (D-05)
 * 3. 窗口边缘距 workArea 边 <= 10px 时触发 (D-01)
 * 4. 返回最近匹配的边
 */
export function detectSnapEdge(
  window: WindowInfo,
  monitor: MonitorInfo
): SnapResult | null {
  // D-18: 仅主显示器
  if (!monitor.isPrimary) {
    return null;
  }

  // D-05: 最大化禁止吸附
  if (window.isMaximized) {
    return null;
  }

  const wa = monitor.workArea;

  // 计算窗口到 workArea 四边的距离
  const distLeft = window.x - wa.x;
  const distRight = wa.x + wa.w - (window.x + window.w);
  const distTop = window.y - wa.y;
  const distBottom = wa.y + wa.h - (window.y + window.h);

  // 收集所有满足阈值的边（距离 >= 0 且 <= 10）
  type Candidate = { edge: SnapEdge; dist: number };
  const candidates: Candidate[] = [];

  if (distLeft >= 0 && distLeft <= SNAP_THRESHOLD) {
    candidates.push({ edge: "left", dist: distLeft });
  }
  if (distRight >= 0 && distRight <= SNAP_THRESHOLD) {
    candidates.push({ edge: "right", dist: distRight });
  }
  if (distTop >= 0 && distTop <= SNAP_THRESHOLD) {
    candidates.push({ edge: "top", dist: distTop });
  }
  if (distBottom >= 0 && distBottom <= SNAP_THRESHOLD) {
    candidates.push({ edge: "bottom", dist: distBottom });
  }

  if (candidates.length === 0) {
    return null;
  }

  // 返回距离最近的边
  candidates.sort((a, b) => a.dist - b.dist);
  return { edge: candidates[0].edge };
}

/**
 * 计算 thin sliver 在指定边上的矩形位置和尺寸。
 *
 * sliver 宽度根据 DPI 缩放自适应：Math.ceil(2 / scaleFactor)，确保物理像素 >= 2px (D-08)。
 */
export function calculateSliverRect(
  edge: SnapEdge,
  workArea: Rect,
  scaleFactor: number
): Rect {
  // D-08: 物理像素至少 2px → 逻辑像素 = Math.ceil(2 / scaleFactor)
  const sliverLogical = Math.ceil(2 / scaleFactor);
  const wa = workArea;

  switch (edge) {
    case "left":
      return { x: wa.x, y: wa.y, w: sliverLogical, h: wa.h };
    case "right":
      return {
        x: wa.x + wa.w - sliverLogical,
        y: wa.y,
        w: sliverLogical,
        h: wa.h,
      };
    case "top":
      return { x: wa.x, y: wa.y, w: wa.w, h: sliverLogical };
    case "bottom":
      return {
        x: wa.x,
        y: wa.y + wa.h - sliverLogical,
        w: wa.w,
        h: sliverLogical,
      };
  }
}
