import type { SnapEdge, Rect } from "@/lib/drawer-geometry";

interface SnapIndicatorProps {
  edge: SnapEdge | null;
  workArea: Rect | null;
}

/**
 * SnapIndicator — 拖拽接近屏幕边缘时的吸附预览覆盖层 (D-04)。
 *
 * 当窗口拖拽过程中接近 workArea 边缘 <=10px 时，显示半透明蓝色条
 * 提示"即将吸附"。edge 为 null 时不渲染。
 */
export function SnapIndicator({ edge, workArea }: SnapIndicatorProps) {
  if (!edge || !workArea) return null;

  // 根据吸附边计算指示器位置和尺寸
  const style: React.CSSProperties = (() => {
    switch (edge) {
      case "left":
        return {
          position: "fixed",
          left: 0,
          top: workArea.y,
          width: 4,
          height: workArea.h,
        };
      case "right":
        return {
          position: "fixed",
          right: 0,
          top: workArea.y,
          width: 4,
          height: workArea.h,
        };
      case "top":
        return {
          position: "fixed",
          top: 0,
          left: workArea.x,
          height: 4,
          width: workArea.w,
        };
      case "bottom":
        return {
          position: "fixed",
          bottom: 0,
          left: workArea.x,
          height: 4,
          width: workArea.w,
        };
    }
  })();

  return (
    <div
      className="bg-blue-500/30 pointer-events-none transition-all duration-150 z-[9999]"
      style={style}
    />
  );
}
