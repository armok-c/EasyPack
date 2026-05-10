import { useState, useCallback } from "react";

export type VisibilityState = "VISIBLE" | "TRAY_HIDDEN" | "DRAWER_HIDDEN";

export function useVisibilityState() {
  const [visibility, setVisibility] = useState<VisibilityState>("VISIBLE");

  const hideToTray = useCallback(() => {
    setVisibility("TRAY_HIDDEN");
  }, []);

  const showFromTray = useCallback(() => {
    setVisibility("VISIBLE");
  }, []);

  const hideToDrawer = useCallback(() => {
    setVisibility("DRAWER_HIDDEN");
  }, []);

  const showFromDrawer = useCallback(() => {
    setVisibility("VISIBLE");
  }, []);

  const isVisible = visibility === "VISIBLE";
  const isDrawerHidden = visibility === "DRAWER_HIDDEN";

  return {
    visibility,
    hideToTray,
    showFromTray,
    hideToDrawer,
    showFromDrawer,
    setVisibility,
    isVisible,
    isDrawerHidden,
  };
}
