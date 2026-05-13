import { useState, useCallback, useMemo, useEffect } from "react";
import { X, FolderOpen, FileImage, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ICON_OPTIONS, DEFAULT_ICON, getIconByName, isFileIcon, getFilePath } from "@/lib/icons";
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

interface IconCandidate {
  path: string;
  name: string;
  source: string;
}

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
  const [candidates, setCandidates] = useState<IconCandidate[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Reset state when project changes or dialog opens
  useEffect(() => {
    if (open && project) {
      setSelectedIcon(project.icon ?? DEFAULT_ICON);
      setSelectedColor(project.color ?? DEFAULT_COLOR);
      setCandidates([]);
      setScanError(null);
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

  const handleScanIcons = useCallback(async () => {
    if (!project) return;
    setScanning(true);
    setScanError(null);
    try {
      const result = await invoke<IconCandidate[]>("scan_project_icons", {
        projectPath: project.path,
      });
      setCandidates(result);
    } catch {
      setScanError("图标扫描失败，请重试");
    } finally {
      setScanning(false);
    }
  }, [project]);

  const handleSelectFile = useCallback(async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        title: "选择图标文件",
        filters: [{
          name: "图标文件",
          extensions: ["ico", "png", "svg"],
        }],
      });
      if (typeof selected === "string") {
        setSelectedIcon(`file:${selected}`);
      }
    } catch {
      // 用户取消选择，不做任何处理
    }
  }, []);

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

          {/* Custom icon section (per D-02, D-03) */}
          <div className="space-y-2">
            <Label>自定义图标</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanIcons}
                disabled={scanning}
                aria-label="从项目目录导入图标"
              >
                {scanning ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <FileImage className="size-3.5 mr-1" />
                )}
                从项目导入
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectFile}
                aria-label="选择图标文件"
              >
                <FolderOpen className="size-3.5 mr-1" />
                选择文件
              </Button>
            </div>

            {/* Candidate icons from project scan */}
            {scanning && (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="size-8 rounded-md bg-white/5 animate-pulse" />
                ))}
              </div>
            )}
            {!scanning && candidates.length > 0 && (
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="扫描到的图标"
              >
                {candidates.map((candidate) => {
                  const iconValue = `file:${candidate.path}`;
                  const isSelected = selectedIcon === iconValue;
                  return (
                    <button
                      key={candidate.path}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={candidate.name}
                      onClick={() => setSelectedIcon(iconValue)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-1.5 rounded-md",
                        "bg-white/5 border border-white/10",
                        "transition-all duration-150 ease-out",
                        "cursor-pointer outline-none",
                        "hover:bg-white/10 hover:border-white/20",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected && "bg-white/15 border-primary ring-1 ring-primary/50"
                      )}
                    >
                      <img
                        src={convertFileSrc(candidate.path)}
                        alt=""
                        className="size-8 rounded-md object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                      <span className="text-xs text-muted-foreground truncate max-w-[32px]">
                        {candidate.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {!scanning && scanError && (
              <p className="text-xs text-destructive">{scanError}</p>
            )}
            {!scanning && candidates.length === 0 && scanError === null && (
              <p className="text-xs text-muted-foreground">
                未找到可用图标
              </p>
            )}
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
              {isFileIcon(selectedIcon) ? (
                <img
                  src={convertFileSrc(getFilePath(selectedIcon))}
                  alt=""
                  className="size-3.5 flex-shrink-0 rounded-sm object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <PreviewIcon className="size-3.5 text-muted-foreground flex-shrink-0" />
              )}
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
