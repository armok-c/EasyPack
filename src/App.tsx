import { useState, useCallback, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MainArea } from "@/components/MainArea";
import { TitleBar } from "@/components/TitleBar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useProject } from "@/hooks/useProject";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useVisibilityState } from "@/hooks/useVisibilityState";
import { useRecentCommands } from "@/hooks/useRecentCommands";
import { useTray } from "@/hooks/useTray";
import { useFloatWindow } from "@/hooks/useFloatWindow";
import { useEdgeDrawer } from "@/hooks/useEdgeDrawer";
import { SnapIndicator } from "@/components/SnapIndicator";
import { detectSnapEdge } from "@/lib/drawer-geometry";
import type { SnapEdge, Rect, WindowInfo } from "@/lib/drawer-geometry";
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import "./index.css";

const appWindow = getCurrentWindow();

function App() {
  const {
    projects,
    selectedId,
    currentProject,
    selectFolder,
    selectProject,
    removeProject,
    executeCommand,
    // Phase 4: command management
    commands,
    commandMode,
    editMode,
    setEditMode,
    addCommand,
    updateCommand,
    deleteCommand,
    enableProjectCommands,
    disableProjectCommands,
    // Phase 5: project icon & color
    updateProjectStyle,
    // Phase 5: drag-and-drop reorder
    reorderProjects,
    // Phase 8: project info
    projectInfo,
    projectInfoLoading,
    projectInfoError,
    // Phase 9: open folder
    openFolder,
    // Phase 11: shortcut assignment
    assignShortcut,
    clearShortcut,
    // Phase 12: store for tray settings
    store,
  } = useProject();

  // Phase 5 Plan 03: keyboard navigation zone management (per D-15, D-16)
  const [activeZone, setActiveZone] = useState<"sidebar" | "main">("sidebar");
  const handleZoneSwitch = useCallback(() => {
    setActiveZone((prev) => (prev === "sidebar" ? "main" : "sidebar"));
  }, []);

  // Phase 9: derive project toggle disabled state (per D-05)
  const isProjectToggleDisabled = !currentProject;

  // Phase 9: open folder handler with project path bound
  const handleOpenFolder = useCallback(() => {
    if (currentProject) {
      openFolder(currentProject.path);
    }
  }, [currentProject, openFolder]);

  // Phase 5 Plan 03: global number key shortcuts (per D-13)
  useKeyboard({
    commands,
    currentProject,
    onExecute: executeCommand,
    editMode,
  });

  // Phase 11: OS-level global shortcuts (per KB-02, KB-03)
  const [isRecording, setIsRecording] = useState(false);
  const handleRecordingChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
  }, []);

  // Phase 12: tray settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(true);
  const [closeToTray, setCloseToTray] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Phase 14: drawer settings state
  const [drawerEnabled, setDrawerEnabled] = useState(false);
  // Phase 14: 拖拽中实时吸附预览状态 (D-04)
  const [snapPreviewEdge, setSnapPreviewEdge] = useState<SnapEdge | null>(null);
  const closeToTrayRef = useRef(closeToTray);
  closeToTrayRef.current = closeToTray;
  const settingsLoadedRef = useRef(settingsLoaded);
  settingsLoadedRef.current = settingsLoaded;
  // Phase 12: window visibility state machine (Phase 14: three-state)
  const { visibility, hideToTray, showFromTray, hideToDrawer, showFromDrawer, isDrawerHidden } = useVisibilityState();

  // Phase 14: visibility ref for stale-closure prevention
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;

  // Phase 12: recent commands tracking
  const { recentCommands, addRecentCommand } = useRecentCommands({ store });

  // Phase 12: execute with recent command tracking
  const handleExecuteWithRecent = useCallback(async (shellCommand: string) => {
    const success = await executeCommand(shellCommand);
    if (!success) return;
    const cmd = commands.find((c) => c.command === shellCommand);
    if (cmd) {
      await addRecentCommand(cmd.name, cmd.command);
    } else {
      await addRecentCommand(shellCommand, shellCommand);
    }
  }, [executeCommand, commands, addRecentCommand]);

  useGlobalShortcuts({
    commands,
    onExecute: handleExecuteWithRecent,
    enabled: !!currentProject,
    recording: isRecording,
  });

  // Phase 13: 悬浮窗
  const { floatVisible, toggleFloat, destroyFloat } = useFloatWindow({
    currentProject,
    commands,
    onExecute: handleExecuteWithRecent,
  });

  // Phase 14: 边缘抽屉
  const { handleDragEnd, handleMouseEnter, handleMouseLeave, handleDragWhileSnapped, restoreFromDrawer, isDrawerAnimating, snapEdge } = useEdgeDrawer({
    visibility,
    hideToDrawer,
    showFromDrawer,
    drawerEnabled,
  });

  // Phase 12: system tray
  useTray({
    currentProject,
    commands,
    recentCommands,
    visibility,
    onExecute: handleExecuteWithRecent,
    onShow: () => {
      if (isDrawerHidden || visibility === "DRAWER_HIDDEN") {
        restoreFromDrawer();
        showFromDrawer();
      } else {
        showFromTray();
      }
      appWindow.show().catch(console.error);
      appWindow.setFocus().catch(console.error);
    },
    onHide: () => { hideToTray(); appWindow.hide().catch(console.error); },
    onQuit: async () => {
      await destroyFloat();
      await appWindow.destroy();
    },
    enabled: trayEnabled,
    appWindow,
    onToggleFloat: toggleFloat,
    floatVisible,
    onRestoreFromDrawer: restoreFromDrawer,
  });

  // 监听 Rust 端发出的窗口可见性变更事件。
  // Rust 端在全局菜单/托盘事件处理器中直接操作窗口，
  // 然后通过这些事件通知前端同步 React 状态。
  useEffect(() => {
    const unlistenShown = listen("main:shown-from-rust", async () => {
      if (isDrawerHidden || visibilityRef.current === "DRAWER_HIDDEN") {
        await restoreFromDrawer();
        showFromDrawer();
      } else {
        showFromTray();
      }
    });
    const unlistenHidden = listen("main:hidden-from-rust", () => {
      hideToTray();
    });
    return () => {
      unlistenShown.then((fn) => fn());
      unlistenHidden.then((fn) => fn());
    };
  }, [showFromTray, hideToTray, showFromDrawer, restoreFromDrawer, isDrawerHidden]);

  // Phase 12: onCloseRequested — always registered, reads state from refs
  useEffect(() => {
    const unlisten = appWindow.onCloseRequested(async (event) => {
      const shouldHide = settingsLoadedRef.current ? closeToTrayRef.current : true;
      if (!shouldHide) return;
      event.preventDefault();
      // Phase 14: DRAWER_HIDDEN 状态下先恢复窗口位置
      if (visibilityRef.current === "DRAWER_HIDDEN") {
        await restoreFromDrawer();
        showFromDrawer();
      }
      hideToTray();
      try {
        await appWindow.hide();
      } catch (err) {
        console.error("Failed to hide window:", err);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [hideToTray, restoreFromDrawer, showFromDrawer]);

  // Phase 12: load tray settings from store on mount
  useEffect(() => {
    let mounted = true;
    async function loadTraySettings() {
      if (!store) return;
      const saved = await store.get<boolean>("trayEnabled");
      const savedCTT = await store.get<boolean>("closeToTray");
      const savedDrawer = await store.get<boolean>("drawerEnabled");
      if (mounted) {
        const effectiveTrayEnabled = saved !== undefined && saved !== null ? saved : true;
        const effectiveCloseToTray = effectiveTrayEnabled
          ? (savedCTT !== undefined && savedCTT !== null ? savedCTT : true)
          : false;
        setTrayEnabled(effectiveTrayEnabled);
        setCloseToTray(effectiveCloseToTray);
        setDrawerEnabled(savedDrawer !== undefined && savedDrawer !== null ? savedDrawer : false);
        setSettingsLoaded(true);
      }
    }
    loadTraySettings();
    return () => { mounted = false; };
  }, [store]);

  // Phase 12: persist tray settings on change
  const handleTrayEnabledChange = useCallback(async (enabled: boolean) => {
    setTrayEnabled(enabled);
    if (!enabled) {
      setCloseToTray(false);
      await store?.set("closeToTray", false);
    }
    await store?.set("trayEnabled", enabled);
  }, [store]);

  const handleCloseToTrayChange = useCallback(async (enabled: boolean) => {
    setCloseToTray(enabled);
    await store?.set("closeToTray", enabled);
  }, [store]);

  // Phase 14: drawer enabled persistence
  const handleDrawerEnabledChange = useCallback(async (enabled: boolean) => {
    setDrawerEnabled(enabled);
    await store?.set("drawerEnabled", enabled);
  }, [store]);

  // Phase 14: D-04 拖拽中实时窗口位置检测驱动 SnapIndicator
  useEffect(() => {
    if (!drawerEnabled) return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    async function setupMoveListener() {
      const currentWindow = getCurrentWindow();
      const fn = await currentWindow.onMoved(async () => {
        if (cancelled) return;
        // 只在未吸附且未在动画中时检测（即用户正在拖拽）
        if (snapEdge !== null || isDrawerAnimating) {
          setSnapPreviewEdge(null);
          return;
        }
        try {
          const pos = await currentWindow.outerPosition();
          const size = await currentWindow.innerSize();
          const monitor = await primaryMonitor();
          if (!monitor) return;

          const scaleFactor = monitor.scaleFactor;
          const workArea: Rect = {
            x: monitor.workArea.position.x / scaleFactor,
            y: monitor.workArea.position.y / scaleFactor,
            w: monitor.workArea.size.width / scaleFactor,
            h: monitor.workArea.size.height / scaleFactor,
          };
          const windowInfo: WindowInfo = {
            x: pos.x / scaleFactor,
            y: pos.y / scaleFactor,
            w: size.width / scaleFactor,
            h: size.height / scaleFactor,
            isMaximized: false,
          };

          const snapResult = detectSnapEdge(windowInfo, { workArea, scaleFactor, isPrimary: true });
          if (snapResult) {
            setSnapPreviewEdge(snapResult.edge);
          } else {
            setSnapPreviewEdge(null);
          }
        } catch {
          // 窗口操作可能失败（窗口已销毁等），静默忽略
        }
      });
      if (cancelled) { fn(); return; }
      unlisten = fn;
    }
    setupMoveListener();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [drawerEnabled, snapEdge, isDrawerAnimating]);

  // Phase 14: 拖拽结束时清除预览
  const handleDragEndWithCleanup = useCallback(async () => {
    setSnapPreviewEdge(null);
    await handleDragEnd();
  }, [handleDragEnd]);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      onMouseEnter={snapEdge ? handleMouseEnter : undefined}
      onMouseLeave={snapEdge ? handleMouseLeave : undefined}
    >
      <TitleBar
        onSettingsOpen={() => setSettingsOpen(true)}
        onFloatToggle={toggleFloat}
        floatVisible={floatVisible}
        onDragEnd={drawerEnabled ? handleDragEndWithCleanup : null}
        onDragWhileSnapped={drawerEnabled ? handleDragWhileSnapped : null}
        drawerSnapEdge={snapEdge}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          projects={projects}
          selectedId={selectedId}
          onAddProject={selectFolder}
          onSelectProject={selectProject}
          onRemoveProject={removeProject}
          onUpdateStyle={updateProjectStyle}
          onReorderProjects={reorderProjects}
          activeZone={activeZone}
          onZoneSwitch={handleZoneSwitch}
        />
        <MainArea
          currentProject={currentProject}
          onExecute={handleExecuteWithRecent}
          commands={commands}
          commandMode={commandMode}
          editMode={editMode}
          setEditMode={setEditMode}
          addCommand={addCommand}
          updateCommand={updateCommand}
          deleteCommand={deleteCommand}
          enableProjectCommands={enableProjectCommands}
          disableProjectCommands={disableProjectCommands}
          activeZone={activeZone}
          onZoneSwitch={handleZoneSwitch}
          projectInfo={projectInfo}
          projectInfoLoading={projectInfoLoading}
          projectInfoError={projectInfoError}
          onOpenFolder={handleOpenFolder}
          isProjectToggleDisabled={isProjectToggleDisabled}
          assignShortcut={assignShortcut}
          clearShortcut={clearShortcut}
          onRecordingChange={handleRecordingChange}
        />
      </div>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        trayEnabled={trayEnabled}
        onTrayEnabledChange={handleTrayEnabledChange}
        closeToTray={closeToTray}
        onCloseToTrayChange={handleCloseToTrayChange}
        drawerEnabled={drawerEnabled}
        onDrawerEnabledChange={handleDrawerEnabledChange}
      />
      <SnapIndicator edge={snapPreviewEdge} />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
