export type MainWindowVisibility = "VISIBLE" | "TRAY_HIDDEN" | "DRAWER_HIDDEN";

export interface MainWindowLike {
  isVisible: () => Promise<boolean>;
  isMinimized: () => Promise<boolean>;
  unminimize: () => Promise<void>;
  show: () => Promise<void>;
  setFocus: () => Promise<void>;
}

export interface EnsureMainWindowVisibleOptions {
  window: MainWindowLike;
  visibility: MainWindowVisibility;
  showFromTray: () => void;
  showFromDrawer: () => void;
  restoreFromDrawer?: () => Promise<void>;
}

/** Reveal the main window only when an interaction is needed. */
export async function ensureMainWindowVisible({
  window,
  visibility,
  showFromTray,
  showFromDrawer,
  restoreFromDrawer,
}: EnsureMainWindowVisibleOptions): Promise<void> {
  let nativeMinimized = false;
  try {
    nativeMinimized = await window.isMinimized();
  } catch {
    // Continue with the existing visibility fallback if the native query fails.
  }
  if (nativeMinimized) await window.unminimize();

  let nativeVisible = visibility === "VISIBLE";
  try {
    nativeVisible = await window.isVisible();
  } catch {
    // Fall back to the React visibility state if the native query fails.
  }

  if (!nativeVisible || visibility !== "VISIBLE") {
    if (visibility === "DRAWER_HIDDEN") {
      await restoreFromDrawer?.();
      showFromDrawer();
    } else {
      showFromTray();
    }
    if (!nativeVisible) await window.show();
  }

  await window.setFocus();
}
