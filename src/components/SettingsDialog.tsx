import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { ProfileMeta } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trayEnabled: boolean;
  onTrayEnabledChange: (enabled: boolean) => void;
  closeToTray: boolean;
  onCloseToTrayChange: (enabled: boolean) => void;
  // Phase 14: 边缘抽屉
  drawerEnabled: boolean;
  onDrawerEnabledChange: (enabled: boolean) => void;
  // Phase 15: 开机启动
  autostartEnabled: boolean;
  onAutostartEnabledChange: (enabled: boolean) => void;
  // 应用版本
  currentVersion: string;
  // Phase 18: 快捷键设置面板入口
  onOpenShortcutPanel: () => void;
  // Phase 20: profile management
  profileMetas: ProfileMeta[];
  activeProfileId: string | null;
  onSwitchProfile: (id: string) => Promise<void>;
  onCreateProfile: (name: string) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<boolean>;
  onRenameProfile: (id: string, newName: string) => Promise<void>;
  onImportProfile: (filePath: string) => Promise<void>;
  onExportProfile: (filePath: string) => Promise<void>;
}

export function SettingsDialog({
  open,
  onOpenChange,
  trayEnabled,
  onTrayEnabledChange,
  closeToTray,
  onCloseToTrayChange,
  drawerEnabled,
  onDrawerEnabledChange,
  autostartEnabled,
  onAutostartEnabledChange,
  currentVersion,
  onOpenShortcutPanel,
  profileMetas,
  activeProfileId,
  onSwitchProfile,
  onCreateProfile,
  onDeleteProfile,
  onRenameProfile,
  onImportProfile,
  onExportProfile,
}: SettingsDialogProps) {
  const [manageExpanded, setManageExpanded] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);
  const [importingProfile, setImportingProfile] = useState(false);

  async function handleImport() {
    try {
      const selected = await openDialog({
        multiple: false,
        title: "导入配置文件",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof selected !== "string") return;

      setPendingImportPath(selected);
    } catch (error) {
      console.error("导入失败:", error);
    }
  }

  async function handleConfirmImport() {
    if (!pendingImportPath || importingProfile) return;

    setImportingProfile(true);
    try {
      await onImportProfile(pendingImportPath);
      setPendingImportPath(null);
    } catch (error) {
      console.error("导入失败:", error);
    } finally {
      setImportingProfile(false);
    }
  }

  async function handleExport() {
    try {
      const currentName = profileMetas.find(p => p.id === activeProfileId)?.name ?? "unknown";
      const date = new Date().toISOString().split("T")[0];
      const defaultName = `easypack-${currentName}-${date}.json`;

      const selected = await saveDialog({
        defaultPath: defaultName,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof selected !== "string") return;

      await onExportProfile(selected);
    } catch (error) {
      console.error("导出失败:", error);
    }
  }

  async function handleDeleteProfile() {
    if (!deleteProfileId || deletingProfile) return;

    setDeletingProfile(true);
    try {
      const deleted = await onDeleteProfile(deleteProfileId);
      if (deleted) setDeleteProfileId(null);
    } catch {
      // The hook has already shown the error toast. Keep the confirmation open
      // so the user can retry after the failed rollback.
    } finally {
      setDeletingProfile(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader className="mb-2">
          <DialogTitle>设置</DialogTitle>
          <DialogDescription className="sr-only">
            管理应用设置和配置文件
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pb-4">
          {/* Section: 配置管理 */}
          <div>
            <div className="border-b border-white/10 pb-2 mb-4">
              <Label>配置管理</Label>
            </div>

            {/* Profile 下拉框 + 齿轮图标 */}
            <div className="flex items-center gap-2 mb-2">
              <Select
                value={activeProfileId ?? ""}
                onValueChange={(value) => {
                  onSwitchProfile(value);
                  onOpenChange(false);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择配置" />
                </SelectTrigger>
                <SelectContent>
                  {profileMetas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => setManageExpanded(!manageExpanded)}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                title="管理配置"
              >
                <Settings className="size-4" />
              </button>
            </div>

            {/* 可折叠的管理区域 */}
            {manageExpanded && (
              <div className="space-y-2 pl-1">
                {/* 创建 profile */}
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="新配置名称"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newProfileName.trim()) {
                        onCreateProfile(newProfileName.trim());
                        setNewProfileName("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (newProfileName.trim()) {
                        onCreateProfile(newProfileName.trim());
                        setNewProfileName("");
                      }
                    }}
                    disabled={!newProfileName.trim()}
                  >
                    创建
                  </Button>
                </div>

                {/* 重命名当前 profile */}
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="重命名当前配置"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim() && activeProfileId) {
                        onRenameProfile(activeProfileId, renameValue.trim());
                        setRenameValue("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (renameValue.trim() && activeProfileId) {
                        onRenameProfile(activeProfileId, renameValue.trim());
                        setRenameValue("");
                      }
                    }}
                    disabled={!renameValue.trim() || !activeProfileId}
                  >
                    重命名
                  </Button>
                </div>

                {/* 删除当前 profile */}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (activeProfileId && profileMetas.length > 1) {
                      setDeleteProfileId(activeProfileId);
                    }
                  }}
                  disabled={!activeProfileId || profileMetas.length <= 1}
                  className="w-full"
                >
                  删除当前配置
                </Button>

                {/* 导入/导出 */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleImport}
                    className="flex-1"
                  >
                    导入配置
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleExport}
                    className="flex-1"
                  >
                    导出配置
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Section: 系统托盘 */}
          <div>
            <div className="border-b border-white/10 pb-2 mb-4">
              <Label>系统托盘</Label>
            </div>

            <div className="space-y-4">
              {/* Switch: 启用系统托盘 */}
              <label htmlFor="settings-tray-enabled" className="flex items-center justify-between">
                <div>
                  <p className="text-sm">启用系统托盘</p>
                  <p className="text-xs text-muted-foreground">
                    在系统托盘显示应用图标，关闭窗口后保持运行
                  </p>
                </div>
                <Switch
                  id="settings-tray-enabled"
                  aria-label="启用系统托盘"
                  checked={trayEnabled}
                  onCheckedChange={onTrayEnabledChange}
                />
              </label>

              {/* Switch: 关闭时隐藏到托盘 (depends on main switch) */}
              <label
                htmlFor="settings-close-to-tray"
                className={cn(
                  "flex items-center justify-between",
                  !trayEnabled && "opacity-50 pointer-events-none"
                )}
              >
                <div>
                  <p className="text-sm">关闭时隐藏到托盘</p>
                  <p className="text-xs text-muted-foreground">
                    点击关闭按钮时隐藏到托盘而不是退出程序
                  </p>
                </div>
                <Switch
                  id="settings-close-to-tray"
                  aria-label="关闭时隐藏到托盘"
                  checked={closeToTray}
                  onCheckedChange={onCloseToTrayChange}
                  disabled={!trayEnabled}
                />
              </label>

              {/* Switch: 开机启动 (depends on closeToTray) */}
              <label
                htmlFor="settings-autostart-enabled"
                className={cn(
                  "flex items-center justify-between",
                  !closeToTray && "opacity-50 pointer-events-none"
                )}
              >
                <div>
                  <p className="text-sm">开机启动</p>
                  <p className="text-xs text-muted-foreground">
                    Windows 启动时自动运行 EasyPack 并最小化到系统托盘
                  </p>
                </div>
                <Switch
                  id="settings-autostart-enabled"
                  aria-label="开机启动"
                  checked={autostartEnabled}
                  onCheckedChange={onAutostartEnabledChange}
                  disabled={!closeToTray}
                />
              </label>
            </div>
          </div>

          {/* Section: 边缘抽屉 */}
          <div>
            <div className="border-b border-white/10 pb-2 mb-4">
              <Label>边缘抽屉</Label>
            </div>
            <div className="space-y-4">
              <label htmlFor="settings-drawer-enabled" className="flex items-center justify-between">
                <div>
                  <p className="text-sm">启用边缘抽屉</p>
                  <p className="text-xs text-muted-foreground">
                    拖拽窗口到屏幕边缘自动隐藏，鼠标滑过边缘快速唤出
                  </p>
                </div>
                <Switch
                  id="settings-drawer-enabled"
                  aria-label="启用边缘抽屉"
                  checked={drawerEnabled}
                  onCheckedChange={onDrawerEnabledChange}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Phase 18: 快捷键设置入口 */}
        <button
          onClick={() => {
            onOpenShortcutPanel();
            onOpenChange(false);
          }}
          className="w-full text-left px-3 py-2 mb-2 rounded-md border-l-2 border-blue-400 bg-blue-400/10 text-sm text-blue-300 hover:bg-blue-400/20 transition-colors cursor-pointer"
        >
          快捷键设置...
        </button>

        {/* 版本号 */}
        <div className="border-t border-white/10 pt-3 mt-2">
          <p className="text-xs text-muted-foreground text-center">
            v{currentVersion || "..."}
          </p>
        </div>
      </DialogContent>

      <AlertDialog
        open={pendingImportPath !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !importingProfile) setPendingImportPath(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认导入配置？</AlertDialogTitle>
            <AlertDialogDescription>
              此文件会作为新配置导入，不会覆盖当前配置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importingProfile}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={importingProfile}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmImport();
              }}
            >
              {importingProfile ? "导入中..." : "确认导入"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteProfileId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deletingProfile) setDeleteProfileId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除当前配置？</AlertDialogTitle>
            <AlertDialogDescription>
              项目记录、环境快照和受管文件清单都会永久删除，不能恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProfile}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingProfile}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteProfile();
              }}
            >
              {deletingProfile ? "删除中..." : "永久删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
