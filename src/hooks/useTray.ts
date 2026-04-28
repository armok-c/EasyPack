import { useEffect, useRef } from "react";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
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

  async function buildMenu(): Promise<Menu> {
    const toggleText = visibilityRef.current === "VISIBLE" ? "隐藏窗口" : "显示窗口";
    const toggleItem = await MenuItem.new({
      id: "toggle-window",
      text: toggleText,
      action: () => {
        if (visibilityRef.current === "VISIBLE") {
          onHideRef.current();
          getCurrentWindow().hide().catch(console.error);
        } else {
          onShowRef.current();
          getCurrentWindow().show().catch(console.error);
          getCurrentWindow().setFocus().catch(console.error);
        }
      },
    });

    const items: Array<MenuItem | PredefinedMenuItem | Menu> = [toggleItem];

    const hasProject = currentProject !== null;
    const hasCommands = recentCommands.length > 0;

    if (hasProject || hasCommands) {
      items.push(await PredefinedMenuItem.new({ item: { item: "Separator" } }));
    }

    if (hasProject) {
      items.push(
        await MenuItem.new({
          id: "current-project",
          text: `▸ EasyPack (${currentProject.name})`,
          enabled: false,
          action: () => {},
        })
      );
    }

    if (hasCommands) {
      for (let i = 0; i < recentCommands.length; i++) {
        const cmd = recentCommands[i];
        items.push(
          await MenuItem.new({
            id: `cmd-${i}`,
            text: `▸ 执行: ${cmd.name}`,
            enabled: currentProject !== null,
            action: () => {
              onExecuteRef.current(cmd.command);
            },
          })
        );
      }
    }

    if (hasProject || hasCommands) {
      items.push(await PredefinedMenuItem.new({ item: { item: "Separator" } }));
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
        trayRef.current.close().catch(console.error);
        trayRef.current = null;
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
          action: (event) => {
            if (event.type === "Click" && event.button === "Left") {
              onShowRef.current();
              getCurrentWindow().show().catch(console.error);
              getCurrentWindow().setFocus().catch(console.error);
            }
          },
        });

        trayRef.current = tray;
      } catch (err) {
        console.error("Failed to create tray icon:", err);
      }
    }

    createTray();

    return () => {
      cancelled = true;
      if (trayRef.current) {
        trayRef.current.close().catch(console.error);
        trayRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

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
  }, [enabled, currentProject, recentCommands, visibility, commands]);
}
