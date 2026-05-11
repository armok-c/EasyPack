/**
 * useEdgeDrawer.ts — 边缘抽屉核心 hook
 *
 * 管理窗口边缘吸附检测、thin sliver 收缩/展开动画、
 * 延迟收回定时器、取消吸附检测和外部恢复接口。
 *
 * 依赖 Plan 14-01 的 drawer-geometry 和 drawer-animation 工具模块。
 * 通过 Tauri 事件系统与 Rust 后端鼠标位置轮询通信。
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { listen, emit } from "@tauri-apps/api/event";
import { detectSnapEdge, calculateSliverRect } from "@/lib/drawer-geometry";
import { animateWindow } from "@/lib/drawer-animation";
import type { SnapEdge, Rect } from "@/lib/drawer-geometry";
import type { AnimState } from "@/lib/drawer-animation";
import type { VisibilityState } from "./useVisibilityState";

/** useEdgeDrawer 配置选项 */
export interface UseEdgeDrawerOptions {
  visibility: VisibilityState;
  hideToDrawer: () => void;
  showFromDrawer: () => void;
  drawerEnabled: boolean;
}

/** useEdgeDrawer 返回接口 */
export interface UseEdgeDrawerReturn {
  handleDragEnd: () => Promise<void>;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleDragWhileSnapped: (deltaX: number, deltaY: number) => void;
  restoreFromDrawer: () => Promise<void>;
  isDrawerAnimating: boolean;
  snapEdge: SnapEdge | null;
}

/** 延迟收回时间 (D-10: 300-500ms, 取 400ms) */
const HIDE_DELAY_MS = 400;

/** 动画持续时间 (D-03, D-11: 约 200ms) */
const ANIMATION_DURATION_MS = 200;

/** 默认最小窗口尺寸 (与 tauri.conf.json 一致) */
const DEFAULT_MIN_WIDTH = 600;
const DEFAULT_MIN_HEIGHT = 400;

/**
 * 边缘抽屉核心 hook。
 *
 * 内部管理 snapEdge、originalRect、operationLock 和 hideTimeout，
 * 通过 Tauri 事件系统与 Rust 后端鼠标轮询协作完成滑出/收回交互。
 */
export function useEdgeDrawer(options: UseEdgeDrawerOptions): UseEdgeDrawerReturn {
  const { visibility, hideToDrawer, showFromDrawer, drawerEnabled } = options;

  // 当前吸附边（暴露给 UI 层）
  const [currentSnapEdge, setCurrentSnapEdge] = useState<SnapEdge | null>(null);
  // 动画进行中标志
  const [isAnimating, setIsAnimating] = useState(false);

  // 内部 refs
  const snapEdgeRef = useRef<SnapEdge | null>(null);
  const originalRectRef = useRef<Rect | null>(null);
  const operationLock = useRef<Promise<void>>(Promise.resolve());
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防闭包 ref 模式
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;
  const hideToDrawerRef = useRef(hideToDrawer);
  hideToDrawerRef.current = hideToDrawer;
  const showFromDrawerRef = useRef(showFromDrawer);
  showFromDrawerRef.current = showFromDrawer;

  const appWindow = getCurrentWindow();

  // ---- 动画辅助 ----

  /** 将 AnimState 应用到窗口位置和尺寸 */
  const applyAnimState = useCallback(
    (state: AnimState) => {
      appWindow.setPosition(new LogicalPosition(state.x, state.y));
      appWindow.setSize(new LogicalSize(state.w, state.h));
    },
    [appWindow]
  );

  // ---- handleDragEnd: 拖拽结束时检测吸附 ----

  const handleDragEnd = useCallback(async () => {
    if (!drawerEnabled) return;
    if (visibilityRef.current !== "VISIBLE") return;

    try {
      const pos = await appWindow.outerPosition();
      const size = await appWindow.innerSize();
      const isMax = await appWindow.isMaximized();
      const monitor = await primaryMonitor();

      if (!monitor) return;

      const scale = monitor.scaleFactor;
      const winX = pos.x / scale;
      const winY = pos.y / scale;
      const winW = size.width / scale;
      const winH = size.height / scale;

      const wa = monitor.workArea;
      const windowInfo = {
        x: winX,
        y: winY,
        w: winW,
        h: winH,
        isMaximized: isMax,
      };
      const monitorInfo = {
        workArea: {
          x: wa.position.x / scale,
          y: wa.position.y / scale,
          w: wa.size.width / scale,
          h: wa.size.height / scale,
        },
        scaleFactor: scale,
        isPrimary: true,
      };

      const snapResult = detectSnapEdge(windowInfo, monitorInfo);
      if (!snapResult) return;

      const edge = snapResult.edge;
      const workArea = monitorInfo.workArea;

      // 保存原始位置和尺寸 (D-15)
      originalRectRef.current = { x: winX, y: winY, w: winW, h: winH };

      // 移除 minWidth 限制 (Pitfall 2)
      await appWindow.setMinSize(new LogicalSize(0, 0));

      // 计算 sliver 位置
      const sliverRect = calculateSliverRect(edge, workArea, scale);

      // 动画：从当前位置收缩到 sliver
      const from: AnimState = { x: winX, y: winY, w: winW, h: winH };
      const to: AnimState = { x: sliverRect.x, y: sliverRect.y, w: sliverRect.w, h: sliverRect.h };

      operationLock.current = operationLock.current.then(async () => {
        setIsAnimating(true);
        try {
          await animateWindow(from, to, ANIMATION_DURATION_MS, (state) => {
            applyAnimState(state);
          });
        } finally {
          setIsAnimating(false);
        }
      });

      // 设置吸附边
      snapEdgeRef.current = edge;
      setCurrentSnapEdge(edge);

      // 触发 DRAWER_HIDDEN 状态
      hideToDrawerRef.current();

      // 通知 Rust 启动鼠标轮询
      emit("drawer:start-polling", { sliverRect });
    } catch (err) {
      console.error("handleDragEnd failed:", err);
    }
  }, [drawerEnabled, appWindow, applyAnimState]);

  // ---- drawer:mouse-near-edge 事件监听: 触发滑出 ----

  useEffect(() => {
    let cancelled = false;

    async function setupListener() {
      const unlisten = await listen<{ sliverRect?: Rect }>(
        "drawer:mouse-near-edge",
        async () => {
          // 停止 Rust 轮询
          emit("drawer:stop-polling");

          operationLock.current = operationLock.current.then(async () => {
            // 所有 state 读取在 lock 内完成，避免 stale capture
            if (visibilityRef.current !== "DRAWER_HIDDEN") return;
            if (!originalRectRef.current) return;
            if (cancelled) return;

            const orig = originalRectRef.current;
            const from = await getCurrentWindowState();
            if (!from) return;

            const to: AnimState = { x: orig.x, y: orig.y, w: orig.w, h: orig.h };

            setIsAnimating(true);
            try {
              await animateWindow(from, to, ANIMATION_DURATION_MS, (state) => {
                applyAnimState(state);
              });
            } finally {
              setIsAnimating(false);
            }

            // 滑出完成，状态回到 VISIBLE（snapEdge 保持不变）
            showFromDrawerRef.current();
          });
        }
      );

      if (cancelled) {
        unlisten();
        return;
      }

      return unlisten;
    }

    const unlistenPromise = setupListener();

    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn?.());
    };
  }, [applyAnimState]);

  // ---- handleMouseLeave / handleMouseEnter: 延迟收回 ----

  const handleMouseLeave = useCallback(() => {
    if (snapEdgeRef.current === null) return;

    // 清除之前的定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(async () => {
      hideTimeoutRef.current = null;
      if (snapEdgeRef.current === null) return;
      if (visibilityRef.current !== "VISIBLE") return;
      if (!originalRectRef.current) return;

      try {
        const monitor = await primaryMonitor();
        if (!monitor) return;
        const scale = monitor.scaleFactor;
        const workArea = {
          x: monitor.workArea.position.x / scale,
          y: monitor.workArea.position.y / scale,
          w: monitor.workArea.size.width / scale,
          h: monitor.workArea.size.height / scale,
        };

        const actualSliverRect = calculateSliverRect(snapEdgeRef.current, workArea, scale);
        const to: AnimState = {
          x: actualSliverRect.x,
          y: actualSliverRect.y,
          w: actualSliverRect.w,
          h: actualSliverRect.h,
        };

        operationLock.current = operationLock.current.then(async () => {
          // 在 lock 内重新检查状态（可能已变化）
          if (snapEdgeRef.current === null) return;
          if (visibilityRef.current !== "VISIBLE") return;

          const from = await getCurrentWindowState();
          if (!from) return;

          setIsAnimating(true);
          try {
            await animateWindow(from, to, ANIMATION_DURATION_MS, (state) => {
              applyAnimState(state);
            });
          } finally {
            setIsAnimating(false);
          }
        });

        hideToDrawerRef.current();
        emit("drawer:start-polling", { sliverRect: actualSliverRect });
      } catch (err) {
        console.error("handleMouseLeave slide-in failed:", err);
      }
    }, HIDE_DELAY_MS);
  }, [appWindow, applyAnimState]);

  const handleMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // ---- handleDragWhileSnapped: 取消吸附检测 ----

  const handleDragWhileSnapped = useCallback(
    async (deltaX: number, deltaY: number) => {
      if (snapEdgeRef.current === null) return;

      const delta = Math.abs(deltaX) + Math.abs(deltaY);
      if (delta <= 20) return;

      // 取消吸附
      emit("drawer:stop-polling");

      // 恢复到原始位置（如果有）
      const orig = originalRectRef.current;
      if (orig) {
        const to: AnimState = { x: orig.x, y: orig.y, w: orig.w, h: orig.h };
        operationLock.current = operationLock.current.then(async () => {
          await applyAnimState(to);

          // 恢复 minWidth AFTER animation
          await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));

          // 清除吸附状态 AFTER animation
          snapEdgeRef.current = null;
          setCurrentSnapEdge(null);
          originalRectRef.current = null;
        });
      } else {
        // 没有原始位置，直接恢复 minWidth 和清除状态
        await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));
        snapEdgeRef.current = null;
        setCurrentSnapEdge(null);
        originalRectRef.current = null;
      }

      // 如果不是 VISIBLE 状态，恢复
      if (visibilityRef.current !== "VISIBLE") {
        showFromDrawerRef.current();
      }
    },
    [appWindow, applyAnimState]
  );

  // ---- restoreFromDrawer: 外部恢复接口（托盘/快捷键调用）----

  const restoreFromDrawer = useCallback(async () => {
    if (snapEdgeRef.current === null) return;

    // 停止 Rust 轮询
    emit("drawer:stop-polling");

    // 清除延迟收回定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // 恢复到原始位置
    const orig = originalRectRef.current;
    if (orig) {
      const to: AnimState = { x: orig.x, y: orig.y, w: orig.w, h: orig.h };

      operationLock.current = operationLock.current.then(async () => {
        setIsAnimating(true);
        try {
          await applyAnimState(to);
        } finally {
          setIsAnimating(false);
        }

        // 恢复 minWidth AFTER animation
        await appWindow.setMinSize(new LogicalSize(DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT));

        // 清除吸附状态 AFTER animation
        snapEdgeRef.current = null;
        setCurrentSnapEdge(null);
        originalRectRef.current = null;
      });
    }

    // 注意：不调用 showFromDrawer() 或改变 visibility 状态
    // 由调用方（App.tsx 中的 onShow / onCloseRequested）负责
  }, [appWindow, applyAnimState]);

  // ---- 清理 ----

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleDragEnd,
    handleMouseEnter,
    handleMouseLeave,
    handleDragWhileSnapped,
    restoreFromDrawer,
    isDrawerAnimating: isAnimating,
    snapEdge: currentSnapEdge,
  };
}

/** 获取当前窗口的 AnimState（逻辑像素） */
async function getCurrentWindowState(): Promise<AnimState | null> {
  try {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const size = await win.innerSize();
    const monitor = await primaryMonitor();
    if (!monitor) return null;

    const scale = monitor.scaleFactor;
    return {
      x: pos.x / scale,
      y: pos.y / scale,
      w: size.width / scale,
      h: size.height / scale,
    };
  } catch {
    return null;
  }
}
