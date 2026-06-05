import { useState, useCallback, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MainArea } from "@/components/MainArea";
import { TitleBar } from "@/components/TitleBar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ShortcutPanel } from "@/components/ShortcutPanel";
import { useProject } from "@/hooks/useProject";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useShortcutActions } from "@/hooks/useShortcutActions";
import { useVisibilityState } from "@/hooks/useVisibilityState";
import { useRecentCommands } from "@/hooks/useRecentCommands";
import { useTray } from "@/hooks/useTray";
import { useFloatWindow } from "@/hooks/useFloatWindow";
import { useEdgeDrawer } from "@/hooks/useEdgeDrawer";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { SnapIndicator } from "@/components/SnapIndicator";
import { detectSnapEdge } from "@/lib/drawer-geometry";
import type { CommandItem } from "@/lib/types";
import type { SnapEdge, Rect, WindowInfo } from "@/lib/drawer-geometry";
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  enable as autostartEnable,
  disable as autostartDisable,
} from "@tauri-apps/plugin-autostart";
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
    executeScriptCommand,
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
    // Phase 18: unified shortcut bindings
    shortcutBindings,
    setShortcutBinding,
    clearShortcutBinding,
    resetAllShortcuts,
    // Phase 12: store for tray settings
    store,
    // Phase 20: profile management
    profileMetas,
    activeProfileId,
    profileSwitching,
    switchProfile,
    createProfile,
    deleteProfile,
    renameProfile,
    importProfile,
    exportProfile,
    mainStore,
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
    onExecute: (command, cmd) => handleExecuteWithRecent(command, cmd),
    editMode,
  });

  // Phase 11: OS-level global shortcuts (per KB-02, KB-03)
  const [isRecording, setIsRecording] = useState(false);
  const handleRecordingChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
  }, []);

  // Phase 12: tray settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Phase 18: shortcut panel state
  const [shortcutPanelOpen, setShortcutPanelOpen] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(true);
  const [closeToTray, setCloseToTray] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Phase 14: drawer settings state
  const [drawerEnabled, setDrawerEnabled] = useState(false);
  // Phase 15: autostart settings state
  const [autostartEnabled, setAutostartEnabled] = useState(false);
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
  const { recentCommands, addRecentCommand } = useRecentCommands({ store, activeProfileId });
  const { updateAvailable, latestVersion, currentVersion, openReleasePage, checkNow } = useUpdateCheck(!!store);

  // Phase 12: execute with recent command tracking
  const handleExecuteWithRecent = useCallback(async (shellCommand: string, cmdItem?: CommandItem) => {
    const success = cmdItem
      ? await executeScriptCommand(cmdItem)
      : await executeCommand(shellCommand);
    if (!success) return;
    const cmd = cmdItem ?? commands.find((c) => c.command === shellCommand);
    if (cmd) {
      await addRecentCommand(cmd.name, cmd.command);
    } else {
      const recent = recentCommands.find((c) => c.command === shellCommand);
      await addRecentCommand(recent?.name ?? shellCommand, shellCommand);
    }
  }, [executeCommand, executeScriptCommand, commands, addRecentCommand, recentCommands]);

  // Phase 13: 悬浮窗 (must be before useShortcutActions — toggleFloat used there)
  const { floatVisible, toggleFloat, destroyFloat } = useFloatWindow({
    currentProject,
    projects,
    commands,
    onExecute: handleExecuteWithRecent,
    onSwitchProject: selectProject,
  });

  // Phase 18: Build ShortcutAction registry and pass to useGlobalShortcuts
  const actions = useShortcutActions({
    commands,
    onExecute: (cmd) => handleExecuteWithRecent(cmd.command, cmd),
    onToggleVisibility: () => {
      if (visibility === "TRAY_HIDDEN") {
        showFromTray();
        appWindow.show().catch((err) => { if (import.meta.env.DEV) console.error(err); });
        appWindow.setFocus().catch((err) => { if (import.meta.env.DEV) console.error(err); });
      } else {
        hideToTray();
        appWindow.hide().catch((err) => { if (import.meta.env.DEV) console.error(err); });
      }
    },
    onToggleFloat: toggleFloat,
    onPrevProject: () => {
      if (!selectedId || projects.length === 0) return;
      const idx = projects.findIndex((p) => p.id === selectedId);
      const prevIdx = (idx - 1 + projects.length) % projects.length;
      selectProject(projects[prevIdx].id);
    },
    onNextProject: () => {
      if (!selectedId || projects.length === 0) return;
      const idx = projects.findIndex((p) => p.id === selectedId);
      const nextIdx = (idx + 1) % projects.length;
      selectProject(projects[nextIdx].id);
    },
    onOpenFolder: handleOpenFolder,
  });

  useGlobalShortcuts({
    actions,
    bindings: shortcutBindings,
    enabled: !!currentProject,
    recording: isRecording,
  });

  // Phase 14: 边缘抽屉
  const { handleDragEnd, handleMouseEnter, handleMouseLeave, handleDragWhileSnapped, restoreFromDrawer, isDrawerAnimating, snapEdge } = useEdgeDrawer({
    visibility,
    hideToDrawer,
    showFromDrawer,
    drawerEnabled,
  });

  // Phase 14: ref 模式避免 onMoved useEffect 因 snapEdge/isDrawerAnimating 变化而频繁重建
  const snapEdgeRef = useRef(snapEdge);
  snapEdgeRef.current = snapEdge;
  const isDrawerAnimatingRef = useRef(isDrawerAnimating);
  isDrawerAnimatingRef.current = isDrawerAnimating;
  const handleDragEndRef = useRef(handleDragEnd);
  handleDragEndRef.current = handleDragEnd;

  // Phase 12: system tray
  useTray({
    currentProject,
    commands,
    recentCommands,
    visibility,
    onExecute: handleExecuteWithRecent,
    onShow: async () => {
      if (isDrawerHidden || visibility === "DRAWER_HIDDEN") {
        await restoreFromDrawer();
        showFromDrawer();
      } else {
        showFromTray();
      }
      appWindow.show().catch((err) => { if (import.meta.env.DEV) console.error(err); });
      appWindow.setFocus().catch((err) => { if (import.meta.env.DEV) console.error(err); });
    },
    onHide: () => { hideToTray(); appWindow.hide().catch((err) => { if (import.meta.env.DEV) console.error(err); }); },
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
    const unlistenAutostartHidden = listen("app:autostart-hidden", () => {
      hideToTray();
    });
    return () => {
      unlistenShown.then((fn) => fn());
      unlistenHidden.then((fn) => fn());
      unlistenAutostartHidden.then((fn) => fn());
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
        if (import.meta.env.DEV) {
          console.error("Failed to hide window:", err);
        }
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [hideToTray, restoreFromDrawer, showFromDrawer]);

  // Phase 12: load tray settings from store on mount
  useEffect(() => {
    let mounted = true;
    async function loadTraySettings() {
      if (!mainStore) return;
      const saved = await mainStore.get<boolean>("trayEnabled");
      const savedCTT = await mainStore.get<boolean>("closeToTray");
      const savedDrawer = await mainStore.get<boolean>("drawerEnabled");
      const savedAutostart = await mainStore.get<boolean>("autostartEnabled");
      if (mounted) {
        const effectiveTrayEnabled = saved !== undefined && saved !== null ? saved : true;
        const effectiveCloseToTray = effectiveTrayEnabled
          ? (savedCTT !== undefined && savedCTT !== null ? savedCTT : true)
          : false;
        setTrayEnabled(effectiveTrayEnabled);
        setCloseToTray(effectiveCloseToTray);
        setDrawerEnabled(savedDrawer !== undefined && savedDrawer !== null ? savedDrawer : false);
        const effectiveAutostartEnabled = effectiveCloseToTray
          ? (savedAutostart !== undefined && savedAutostart !== null ? savedAutostart : false)
          : false;
        setAutostartEnabled(effectiveAutostartEnabled);
        // 如果 store 中 autostartEnabled 与 closeToTray 不一致，静默修正 store
        if (effectiveCloseToTray === false && (savedAutostart === true)) {
          await mainStore.set("autostartEnabled", false);
          try { await autostartDisable(); } catch (err) {
            if (import.meta.env.DEV) {
              console.error("Failed to disable autostart on store invariant fix:", err);
            }
          }
        }
        setSettingsLoaded(true);
      }
    }
    loadTraySettings();
    return () => { mounted = false; };
  }, [mainStore]);

  // Phase 12: persist tray settings on change
  const handleTrayEnabledChange = useCallback(async (enabled: boolean) => {
    setTrayEnabled(enabled);
    if (!enabled) {
      setCloseToTray(false);
      await mainStore?.set("closeToTray", false);
      // D-10: 关闭 trayEnabled 时级联关闭 autostartEnabled
      setAutostartEnabled(false);
      await mainStore?.set("autostartEnabled", false);
      try { await autostartDisable(); } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to disable autostart on tray cascade:", err);
        }
      }
    }
    await mainStore?.set("trayEnabled", enabled);
  }, [mainStore]);

  const handleCloseToTrayChange = useCallback(async (enabled: boolean) => {
    setCloseToTray(enabled);
    await mainStore?.set("closeToTray", enabled);
    // D-11: 关闭 closeToTray 时级联关闭 autostartEnabled
    if (!enabled) {
      setAutostartEnabled(false);
      await mainStore?.set("autostartEnabled", false);
      try { await autostartDisable(); } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to disable autostart on closeToTray cascade:", err);
        }
      }
    }
  }, [mainStore]);

  // Phase 15: autostart enabled persistence
  const handleAutostartEnabledChange = useCallback(async (enabled: boolean) => {
    setAutostartEnabled(enabled);
    await mainStore?.set("autostartEnabled", enabled);
    try {
      if (enabled) {
        await autostartEnable();
      } else {
        await autostartDisable();
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to configure autostart:", err);
      }
    }
  }, [mainStore]);

  // Phase 14: drawer enabled persistence
  const handleDrawerEnabledChange = useCallback(async (enabled: boolean) => {
    setDrawerEnabled(enabled);
    await mainStore?.set("drawerEnabled", enabled);
  }, [mainStore]);

  // Phase 18: open shortcut panel (close settings first)
  const handleOpenShortcutPanel = useCallback(() => {
    setSettingsOpen(false);
    setShortcutPanelOpen(true);
  }, []);

  // Phase 14: D-04 onMoved 驱动 SnapIndicator + 拖拽结束检测
  // Windows WebView2 在 startDragging() 原生拖拽期间吞掉 JS 鼠标事件（mouseup/mousemove），
  // 因此用 onMoved + debounce 检测拖拽结束：窗口停止移动 150ms 后视为拖拽结束。
  // 使用 ref 模式读取 snapEdge/isDrawerAnimating/handleDragEnd，避免依赖变化导致
  // onMoved 监听器被反复销毁重建（可能丢失高频移动事件）。
  useEffect(() => {
    if (!drawerEnabled) return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    let dragEndTimer: ReturnType<typeof setTimeout> | null = null;

    function clearDragEndTimer() {
      if (dragEndTimer) {
        clearTimeout(dragEndTimer);
        dragEndTimer = null;
      }
    }

    async function setupMoveListener() {
      const currentWindow = getCurrentWindow();
      const fn = await currentWindow.onMoved(async () => {
        if (cancelled) return;
        // 使用 ref 读取最新值，避免闭包捕获过期状态
        if (snapEdgeRef.current !== null || isDrawerAnimatingRef.current) {
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

        // 拖拽结束检测：每次 onMoved 重置定时器，150ms 无新移动则视为拖拽结束
        clearDragEndTimer();
        dragEndTimer = setTimeout(async () => {
          if (cancelled) return;
          dragEndTimer = null;
          setSnapPreviewEdge(null);
          await handleDragEndRef.current();
        }, 150);
      });
      if (cancelled) { fn(); return; }
      unlisten = fn;
    }
    setupMoveListener();

    return () => {
      cancelled = true;
      clearDragEndTimer();
      unlisten?.();
    };
  }, [drawerEnabled]);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      onMouseEnter={snapEdge ? handleMouseEnter : undefined}
      onMouseLeave={snapEdge ? handleMouseLeave : undefined}
    >
      {profileSwitching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-sm text-muted-foreground">切换配置中...</p>
          </div>
        </div>
      )}
      <TitleBar
        onSettingsOpen={() => setSettingsOpen(true)}
        onFloatToggle={toggleFloat}
        floatVisible={floatVisible}
        onDragWhileSnapped={drawerEnabled ? handleDragWhileSnapped : null}
        drawerSnapEdge={snapEdge}
        updateAvailable={updateAvailable}
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
        autostartEnabled={autostartEnabled}
        onAutostartEnabledChange={handleAutostartEnabledChange}
        currentVersion={currentVersion}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion}
        onOpenReleasePage={openReleasePage}
        onCheckNow={checkNow}
        onOpenShortcutPanel={handleOpenShortcutPanel}
        profileMetas={profileMetas}
        activeProfileId={activeProfileId}
        onSwitchProfile={switchProfile}
        onCreateProfile={createProfile}
        onDeleteProfile={deleteProfile}
        onRenameProfile={renameProfile}
        onImportProfile={importProfile}
        onExportProfile={exportProfile}
      />
      <ShortcutPanel
        open={shortcutPanelOpen}
        onOpenChange={setShortcutPanelOpen}
        actions={actions}
        bindings={shortcutBindings}
        onSetBinding={setShortcutBinding}
        onClearBinding={clearShortcutBinding}
        onResetAll={resetAllShortcuts}
        onRecordingChange={handleRecordingChange}
      />
      <SnapIndicator edge={snapPreviewEdge} />
      <Toaster richColors position="bottom-right" duration={1500} />
    </div>
  );
}

export default App;
