/**
 * drawer-animation.ts — 边缘抽屉动画工具
 *
 * 提供 easeInOut 缓动函数和 animateWindow 帧驱动动画。
 * animateWindow 通过 onUpdate 回调输出每帧的插值状态，不直接调用 Tauri API，
 * 便于在测试中解耦验证。
 */

export interface AnimState {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * easeInOut 缓动函数。
 * t=0 → 0, t=1 → 1, t=0.5 → 0.5，中间值平滑过渡。
 * 前半段使用 t^2 (加速)，后半段使用 (4-2t)*t-1 (减速)。
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * 帧驱动窗口动画。
 *
 * 从 from 状态线性过渡到 to 状态，经过 easeInOut 缓动。
 * 使用 requestAnimationFrame 逐帧推进，通过 onUpdate 回调输出插值结果。
 *
 * @param from - 起始位置/尺寸
 * @param to - 目标位置/尺寸
 * @param durationMs - 动画持续时间（毫秒）
 * @param onUpdate - 每帧回调，接收插值后的状态和归一化进度 t
 */
export async function animateWindow(
  from: AnimState,
  to: AnimState,
  durationMs: number,
  onUpdate: (state: AnimState, t: number) => void
): Promise<void> {
  return new Promise<void>((resolve) => {
    const startTime = performance.now();

    function frame(now: number) {
      const elapsed = now - startTime;
      const rawT = Math.min(elapsed / durationMs, 1);
      const eased = easeInOut(rawT);

      const state: AnimState = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        w: from.w + (to.w - from.w) * eased,
        h: from.h + (to.h - from.h) * eased,
      };

      onUpdate(state, rawT);

      if (rawT < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}
