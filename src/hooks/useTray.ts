import { useEffect, useRef } from "react";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import type { Window } from "@tauri-apps/api/window";
import type { ProjectItem } from "./useProject";
import type { CommandItem } from "@/lib/types";
import type { RecentCommand } from "./useRecentCommands";
import type { VisibilityState } from "./useVisibilityState";

interface UseTrayOptions {
  currentProject: ProjectItem | null;
  commands: CommandItem[];
  recentCommands: RecentCommand[];
  visibility: VisibilityState;
  onExecute: (command: string) => void;
  onShow: () => void;
  onHide: () => void;
  onQuit: () => void;
  enabled: boolean;
  appWindow: Window;
  // Phase 13: 悬浮窗
  onToggleFloat: () => void;
  floatVisible: boolean;
  // Phase 14: 边缘抽屉
  onRestoreFromDrawer?: () => void;
}

const TRAY_ID = "main-tray";

export function useTray({
  currentProject,
  commands,
  recentCommands,
  visibility,
  onExecute,
  onShow,
  onHide,
  onQuit,
  enabled,
  appWindow,
  onToggleFloat,
  floatVisible,
  onRestoreFromDrawer,
}: UseTrayOptions) {
  const trayRef = useRef<TrayIcon | null>(null);
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const onQuitRef = useRef(onQuit);
  onQuitRef.current = onQuit;
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;
  const recentCommandsRef = useRef(recentCommands);
  recentCommandsRef.current = recentCommands;
  // Phase 13: 悬浮窗 ref
  const onToggleFloatRef = useRef(onToggleFloat);
  onToggleFloatRef.current = onToggleFloat;
  const floatVisibleRef = useRef(floatVisible);
  floatVisibleRef.current = floatVisible;
  // Phase 14: 边缘抽屉 ref
  const onRestoreFromDrawerRef = useRef(onRestoreFromDrawer);
  onRestoreFromDrawerRef.current = onRestoreFromDrawer;

  async function buildMenu(): Promise<Menu> {
    const toggleText = visibilityRef.current === "VISIBLE" ? "隐藏窗口" : "显示窗口";
    const toggleItem = await MenuItem.new({
      id: "toggle-window",
      text: toggleText,
      action: async () => {
        if (visibilityRef.current === "VISIBLE") {
          onHideRef.current();
          appWindow.hide().catch(console.error);
        } else {
          // Phase 14: 如果从 DRAWER_HIDDEN 恢复，需要先恢复窗口位置
          if (visibilityRef.current === "DRAWER_HIDDEN" && onRestoreFromDrawerRef.current) {
            await onRestoreFromDrawerRef.current();
          }
          onShowRef.current();
          appWindow.show().catch(console.error);
          appWindow.setFocus().catch(console.error);
        }
      },
    });

    const items: Array<MenuItem | PredefinedMenuItem | Menu> = [toggleItem];

    // Phase 13: 悬浮窗 toggle 菜单项
    const floatText = floatVisibleRef.current ? "关闭悬浮窗" : "打开悬浮窗";
    const floatItem = await MenuItem.new({
      id: "toggle-float",
      text: floatText,
      action: () => {
        onToggleFloatRef.current();
      },
    });
    items.push(floatItem);

    const hasProject = currentProjectRef.current !== null;
    const hasCommands = recentCommandsRef.current.length > 0;

    if (hasProject || hasCommands) {
      items.push(await PredefinedMenuItem.new({ item: "Separator" }));
    }

    if (hasProject) {
      items.push(
        await MenuItem.new({
          id: "current-project",
          text: `▸ EasyPack (${currentProjectRef.current!.name})`,
          enabled: false,
          action: () => {},
        })
      );
    }

    if (hasCommands) {
      const cmds = recentCommandsRef.current;
      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        items.push(
          await MenuItem.new({
            id: `cmd-${i}`,
            text: `▸ 执行: ${cmd.name}`,
            enabled: currentProjectRef.current !== null,
            action: () => {
              onExecuteRef.current(cmd.command);
            },
          })
        );
      }
    }

    if (hasProject || hasCommands) {
      items.push(await PredefinedMenuItem.new({ item: "Separator" }));
    }

    items.push(
      await MenuItem.new({
        id: "quit",
        text: "退出",
        action: () => {
          onQuitRef.current();
        },
      })
    );

    return await Menu.new({ items });
  }

  // Effect 1: Tray icon lifecycle (create/destroy based on enabled)
  useEffect(() => {
    if (!enabled) {
      if (trayRef.current) {
        const tray = trayRef.current;
        trayRef.current = null;
        tray.close().catch(console.error);
      }
      return;
    }

    let cancelled = false;

    async function createTray() {
      try {
        const icon = await defaultWindowIcon();
        if (cancelled) return;

        const menu = await buildMenu();
        if (cancelled) return;

        const existing = await TrayIcon.getById(TRAY_ID);
        if (existing) {
          await existing.close();
        }
        if (cancelled) return;

        const tray = await TrayIcon.new({
          id: TRAY_ID,
          icon: icon ?? undefined,
          tooltip: "EasyPack",
          menu,
          showMenuOnLeftClick: false,
          action: async (event) => {
            if (event.type === "Click" && event.button === "Left") {
              // Phase 14: 如果从 DRAWER_HIDDEN 恢复，需要先恢复窗口位置
              if (visibilityRef.current === "DRAWER_HIDDEN" && onRestoreFromDrawerRef.current) {
                await onRestoreFromDrawerRef.current();
              }
              onShowRef.current();
              appWindow.show().catch(console.error);
              appWindow.setFocus().catch(console.error);
            }
          },
        });

        trayRef.current = tray;

        // Rebuild menu with latest data to cover any updates that Effect 2
        // may have missed during the async tray creation window.
        const latestMenu = await buildMenu();
        if (!cancelled && trayRef.current) {
          await trayRef.current.setMenu(latestMenu);
        }
      } catch (err) {
        console.error("Failed to create tray icon:", err);
      }
    }

    createTray();

    return () => {
      cancelled = true;
      const tray = trayRef.current;
      trayRef.current = null;
      if (tray) {
        tray.close().catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Effect 1 vs Effect 2 responsibility split:
  // - Effect 1 handles tray icon creation/destruction (only when `enabled` changes).
  //   It builds the initial menu as part of tray creation and once more after setup
  //   to cover updates that may have occurred during the async creation window.
  // - Effect 2 handles menu content updates (when project, commands, visibility, etc.
  //   change). It does NOT create or destroy the tray icon itself.
  //   Effect 2 depends on trayRef.current existing, so it skips if the tray is not ready.

  // Effect 2: Menu updates only (no tray recreation)
  useEffect(() => {
    if (!enabled) return;
    if (!trayRef.current) return;

    let cancelled = false;

    async function updateMenu() {
      try {
        const menu = await buildMenu();
        if (!cancelled && trayRef.current) {
          await trayRef.current.setMenu(menu);
        }
      } catch (err) {
        console.error("Failed to update tray menu:", err);
      }
    }

    updateMenu();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currentProject, recentCommands, visibility, commands, floatVisible]);
}
