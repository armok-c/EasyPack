import { useState, useCallback } from "react";

export type VisibilityState = "VISIBLE" | "TRAY_HIDDEN";

export function useVisibilityState() {
  const [visibility, setVisibility] = useState<VisibilityState>("VISIBLE");

  const hideToTray = useCallback(() => {
    setVisibility("TRAY_HIDDEN");
  }, []);

  const showFromTray = useCallback(() => {
    setVisibility("VISIBLE");
  }, []);

  const isVisible = visibility === "VISIBLE";

  return {
    visibility,
    hideToTray,
    showFromTray,
    setVisibility,
    isVisible,
  };
}
