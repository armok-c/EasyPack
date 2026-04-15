import { useState, useCallback, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import { ICON_OPTIONS, DEFAULT_ICON, getIconByName } from "@/lib/icons";
import { COLOR_OPTIONS, DEFAULT_COLOR } from "@/lib/colors";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ProjectItem } from "@/hooks/useProject";

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectItem | null;
  onSave: (projectId: string, style: { icon: string; color: string }) => void;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
  onSave,
}: ProjectSettingsDialogProps) {
  const [selectedIcon, setSelectedIcon] = useState(
    () => project?.icon ?? DEFAULT_ICON
  );
  const [selectedColor, setSelectedColor] = useState(
    () => project?.color ?? DEFAULT_COLOR
  );

  // Reset state when project changes or dialog opens
  useEffect(() => {
    if (open && project) {
      setSelectedIcon(project.icon ?? DEFAULT_ICON);
      setSelectedColor(project.color ?? DEFAULT_COLOR);
    }
  }, [open, project]);

  const hasChanges =
    selectedIcon !== (project?.icon ?? DEFAULT_ICON) ||
    selectedColor !== (project?.color ?? DEFAULT_COLOR);

  const handleSubmit = useCallback(() => {
    if (!project || !hasChanges) return;
    onSave(project.id, { icon: selectedIcon, color: selectedColor });
    onOpenChange(false);
  }, [project, hasChanges, selectedIcon, selectedColor, onSave, onOpenChange]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && project) {
        setSelectedIcon(project.icon ?? DEFAULT_ICON);
        setSelectedColor(project.color ?? DEFAULT_COLOR);
      }
      onOpenChange(newOpen);
    },
    [project, onOpenChange]
  );

  const PreviewIcon = useMemo(() => getIconByName(selectedIcon), [selectedIcon]);

  const iconEntries = useMemo(() => Object.entries(ICON_OPTIONS), []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            设置图标和颜色
          </DialogTitle>
          <DialogDescription className="sr-only">
            为项目选择图标和颜色标记
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Icon picker */}
          <div className="space-y-2">
            <Label>图标</Label>
            <div
              className="grid grid-cols-5 gap-2"
              role="radiogroup"
              aria-label="选择图标"
            >
              {iconEntries.map(([iconName, IconComponent]) => (
                <button
                  key={iconName}
                  type="button"
                  role="radio"
                  aria-checked={selectedIcon === iconName}
                  aria-label={iconName}
                  onClick={() => setSelectedIcon(iconName)}
                  className={cn(
                    "flex items-center justify-center size-9 rounded-lg",
                    "bg-white/5 hover:bg-white/10",
                    "transition-all duration-150 ease-out",
                    "cursor-pointer outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selectedIcon === iconName &&
                      "bg-white/15 border border-primary ring-1 ring-primary/50"
                  )}
                >
                  <IconComponent className="size-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>颜色</Label>
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label="选择颜色"
            >
              {/* No color option */}
              <button
                type="button"
                role="radio"
                aria-checked={selectedColor === DEFAULT_COLOR}
                aria-label="无颜色"
                onClick={() => setSelectedColor(DEFAULT_COLOR)}
                className={cn(
                  "flex items-center justify-center size-6 rounded-full",
                  "border-2 border-dashed border-white/20",
                  "transition-all duration-150 cursor-pointer outline-none",
                  "hover:border-white/40",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  selectedColor === DEFAULT_COLOR &&
                    "ring-2 ring-white/60 scale-110"
                )}
              >
                <X className="size-3 text-muted-foreground" />
              </button>

              {/* Color swatches */}
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  role="radio"
                  aria-checked={selectedColor === color.value}
                  aria-label={color.name}
                  onClick={() => setSelectedColor(color.value)}
                  className={cn(
                    "size-6 rounded-full",
                    "opacity-70 hover:opacity-100 hover:scale-110",
                    "transition-all duration-150 cursor-pointer outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selectedColor === color.value &&
                      "opacity-100 ring-2 ring-white/60 scale-110"
                  )}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Preview section */}
        <div className="border-t border-white/10 pt-4">
          <p className="text-xs text-muted-foreground mb-2">预览</p>
          <div
            className={cn(
              "relative flex items-center px-2 py-2 rounded-lg border",
              "bg-white/5 border-white/10",
              "overflow-hidden"
            )}
          >
            {/* Color bar preview */}
            {selectedColor && (
              <div
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-l-lg"
                style={{ backgroundColor: selectedColor }}
              />
            )}
            <div className="flex items-center gap-1.5 pl-2">
              <PreviewIcon className="size-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-foreground truncate">
                {project?.name ?? "项目名称"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button disabled={!hasChanges} onClick={handleSubmit}>
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
