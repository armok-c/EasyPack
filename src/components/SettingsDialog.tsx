import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { ProfileMeta } from "@/lib/types";
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
  // Phase 16: 版本管理
  currentVersion: string;
  updateAvailable: boolean;
  latestVersion: string | null;
  onOpenReleasePage: () => void;
  onCheckNow: () => Promise<boolean>;
  // Phase 18: 快捷键设置面板入口
  onOpenShortcutPanel: () => void;
  // Phase 20: profile management
  profileMetas: ProfileMeta[];
  activeProfileId: string | null;
  onSwitchProfile: (id: string) => Promise<void>;
  onCreateProfile: (name: string) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
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
  updateAvailable,
  latestVersion,
  onOpenReleasePage,
  onCheckNow,
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
  const [checkLabel, setCheckLabel] = useState("检查更新");
  const [checking, setChecking] = useState(false);
  const [manageExpanded, setManageExpanded] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [renameValue, setRenameValue] = useState("");

  async function handleCheckNow() {
    if (checking) return;
    setChecking(true);
    try {
      const ok = await onCheckNow();
      if (!ok) {
        setCheckLabel("检查失败");
        setTimeout(() => setCheckLabel("检查更新"), 2000);
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleImport() {
    try {
      const selected = await openDialog({
        multiple: false,
        title: "导入配置文件",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof selected !== "string") return;

      const confirmed = window.confirm("确定要导入为新配置吗？");
      if (!confirmed) return;

      await onImportProfile(selected);
    } catch (error) {
      console.error("导入失败:", error);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
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
                  <input
                    type="text"
                    placeholder="新配置名称"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="flex-1 rounded-md border border-white/10 bg-background px-2 py-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newProfileName.trim()) {
                        onCreateProfile(newProfileName.trim());
                        setNewProfileName("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newProfileName.trim()) {
                        onCreateProfile(newProfileName.trim());
                        setNewProfileName("");
                      }
                    }}
                    disabled={!newProfileName.trim()}
                    className="px-2 py-1 text-xs rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
                  >
                    创建
                  </button>
                </div>

                {/* 重命名当前 profile */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="重命名当前配置"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 rounded-md border border-white/10 bg-background px-2 py-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim() && activeProfileId) {
                        onRenameProfile(activeProfileId, renameValue.trim());
                        setRenameValue("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (renameValue.trim() && activeProfileId) {
                        onRenameProfile(activeProfileId, renameValue.trim());
                        setRenameValue("");
                      }
                    }}
                    disabled={!renameValue.trim() || !activeProfileId}
                    className="px-2 py-1 text-xs rounded-md bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-50"
                  >
                    重命名
                  </button>
                </div>

                {/* 删除当前 profile */}
                <button
                  onClick={() => {
                    if (activeProfileId && profileMetas.length > 1) {
                      const confirmed = window.confirm("确定要删除当前配置吗？此操作不可撤销");
                      if (!confirmed) return;
                      onDeleteProfile(activeProfileId);
                    }
                  }}
                  disabled={!activeProfileId || profileMetas.length <= 1}
                  className="w-full px-2 py-1 text-xs rounded-md text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:pointer-events-none"
                >
                  删除当前配置
                </button>

                {/* 导入/导出 */}
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    className="flex-1 px-2 py-1 text-xs rounded-md border border-white/10 hover:bg-white/10"
                  >
                    导入配置
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex-1 px-2 py-1 text-xs rounded-md border border-white/10 hover:bg-white/10"
                  >
                    导出配置
                  </button>
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">启用系统托盘</p>
                  <p className="text-xs text-muted-foreground">
                    在系统托盘显示应用图标，关闭窗口后保持运行
                  </p>
                </div>
                <Switch
                  checked={trayEnabled}
                  onCheckedChange={onTrayEnabledChange}
                />
              </div>

              {/* Switch: 关闭时隐藏到托盘 (depends on main switch) */}
              <div
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
                  checked={closeToTray}
                  onCheckedChange={onCloseToTrayChange}
                  disabled={!trayEnabled}
                />
              </div>

              {/* Switch: 开机启动 (depends on closeToTray) */}
              <div
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
                  checked={autostartEnabled}
                  onCheckedChange={onAutostartEnabledChange}
                  disabled={!closeToTray}
                />
              </div>
            </div>
          </div>

          {/* Section: 边缘抽屉 */}
          <div>
            <div className="border-b border-white/10 pb-2 mb-4">
              <Label>边缘抽屉</Label>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">启用边缘抽屉</p>
                  <p className="text-xs text-muted-foreground">
                    拖拽窗口到屏幕边缘自动隐藏，鼠标滑过边缘快速唤出
                  </p>
                </div>
                <Switch
                  checked={drawerEnabled}
                  onCheckedChange={onDrawerEnabledChange}
                />
              </div>
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

        {/* 版本号 + 更新提示 */}
        <div className="border-t border-white/10 pt-3 mt-2">
          {updateAvailable && latestVersion && (
            <button
              onClick={onOpenReleasePage}
              className="w-full text-left px-3 py-2 mb-2 rounded-md border-l-2 border-blue-400 bg-blue-400/10 text-sm text-blue-300 hover:bg-blue-400/20 transition-colors cursor-pointer"
            >
              发现新版本 v{latestVersion}，点击下载
            </button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            v{currentVersion || "..."}{" "}
            <button
              onClick={handleCheckNow}
              disabled={checking}
              className={cn(
                "text-blue-400 hover:text-blue-300 transition-colors",
                checking && "opacity-50 pointer-events-none"
              )}
            >
              {checkLabel}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
