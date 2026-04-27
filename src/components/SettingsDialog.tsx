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
}

export function SettingsDialog({
  open,
  onOpenChange,
  trayEnabled,
  onTrayEnabledChange,
  closeToTray,
  onCloseToTrayChange,
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
