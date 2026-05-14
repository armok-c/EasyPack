import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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
  onCheckNow: () => void;
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
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
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
              onClick={onCheckNow}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              检查更新
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
