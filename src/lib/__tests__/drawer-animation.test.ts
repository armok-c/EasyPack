import { describe, it, expect, vi, beforeEach } from "vitest";
import { easeInOut, animateWindow, type AnimState } from "../drawer-animation";

describe("easeInOut", () => {
  it("easeInOut(0) === 0", () => {
    expect(easeInOut(0)).toBe(0);
  });

  it("easeInOut(1) === 1", () => {
    expect(easeInOut(1)).toBe(1);
  });

  it("easeInOut(0.5) === 0.5", () => {
    expect(easeInOut(0.5)).toBe(0.5);
  });

  it("easeInOut 在 (0, 0.5) 区间为凸函数 (t^2 系数)", () => {
    // easeInOut(t) = 2*t*t when t < 0.5
    // 检查几个中间值是否符合凸函数特征
    const t = 0.25;
    const val = easeInOut(t);
    // 2 * 0.25 * 0.25 = 0.125
    expect(val).toBeCloseTo(0.125, 10);

    // 凸函数：easeInOut(0.1) + easeInOut(0.3) > 2 * easeInOut(0.2)
    const v01 = easeInOut(0.1);
    const v03 = easeInOut(0.3);
    const v02 = easeInOut(0.2);
    expect(v01 + v03).toBeGreaterThan(2 * v02);
  });
});

describe("animateWindow", () => {
  let rafCallbacks: Array<(time: number) => void>;
  let currentTime: number;

  beforeEach(() => {
    rafCallbacks = [];
    currentTime = 0;

    // Mock requestAnimationFrame: 收集回调，手动触发
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: (time: number) => void) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length; // frame id
      }
    );

    // Mock performance.now
    vi.stubGlobal("performance", {
      now: () => currentTime,
    });
  });

  /** 推进所有已注册的 rAF 回调 */
  function advanceFrames(ms: number) {
    currentTime += ms;
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    for (const cb of callbacks) {
      cb(currentTime);
    }
  }

  it("animateWindow 调用 onUpdate 的次数 > 0", async () => {
    const from: AnimState = { x: 0, y: 0, w: 100, h: 100 };
    const to: AnimState = { x: 200, y: 200, w: 300, h: 300 };
    const updates: Array<{ state: AnimState; t: number }> = [];

    const promise = animateWindow(from, to, 200, (state, t) => {
      updates.push({ state, t });
    });

    // 推进足够帧让动画完成
    // 每帧 ~16ms, 200ms 动画需要 ~13 帧
    for (let i = 0; i < 20; i++) {
      advanceFrames(16);
    }

    await promise;
    expect(updates.length).toBeGreaterThan(0);
  });

  it("animateWindow 最后一次调用的 t >= 1 且状态等于 to", async () => {
    const from: AnimState = { x: 0, y: 0, w: 100, h: 100 };
    const to: AnimState = { x: 200, y: 200, w: 300, h: 300 };
    const updates: Array<{ state: AnimState; t: number }> = [];

    const promise = animateWindow(from, to, 200, (state, t) => {
      updates.push({ state, t });
    });

    for (let i = 0; i < 20; i++) {
      advanceFrames(16);
    }

    await promise;

    const lastUpdate = updates[updates.length - 1];
    expect(lastUpdate.t).toBeGreaterThanOrEqual(1);
    expect(lastUpdate.state.x).toBeCloseTo(to.x, 5);
    expect(lastUpdate.state.y).toBeCloseTo(to.y, 5);
    expect(lastUpdate.state.w).toBeCloseTo(to.w, 5);
    expect(lastUpdate.state.h).toBeCloseTo(to.h, 5);
  });
});
