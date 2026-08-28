import { useState, useCallback, useMemo, useEffect } from "react";
import { X, FolderOpen, FileImage, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ICON_OPTIONS, DEFAULT_ICON, getIconByName, isFileIcon, getFilePath } from "@/lib/icons";
import { DEFAULT_COLOR } from "@/lib/colors";
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

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function normalizeHexColor(value: string | undefined): string {
  if (!value || !HEX_COLOR_PATTERN.test(value)) return DEFAULT_COLOR;
  return value.toLowerCase();
}

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectItem | null;
  onSave: (projectId: string, style: { icon: string; color: string }) => void;
  onRebind: (projectId: string) => Promise<boolean>;
  pathUnavailable?: boolean;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
  onSave,
  onRebind,
  pathUnavailable = false,
}: ProjectSettingsDialogProps) {
  const initialColor = normalizeHexColor(project?.color);
  const [selectedIcon, setSelectedIcon] = useState(
    () => project?.icon ?? DEFAULT_ICON
  );
  const [selectedColor, setSelectedColor] = useState(() => initialColor);
  const [colorInputValue, setColorInputValue] = useState(() => initialColor);
  const [candidates, setCandidates] = useState<IconCandidate[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [rebinding, setRebinding] = useState(false);

  // Reset state when project changes or dialog opens
  useEffect(() => {
    if (open && project) {
      setSelectedIcon(project.icon ?? DEFAULT_ICON);
      const color = normalizeHexColor(project.color);
      setSelectedColor(color);
      setColorInputValue(color);
      setCandidates([]);
      setHasScanned(false);
      setScanError(null);
    }
  }, [open, project]);

  const projectColor = normalizeHexColor(project?.color);
  const colorInputIsValid =
    colorInputValue === DEFAULT_COLOR
      ? selectedColor === DEFAULT_COLOR
      : HEX_COLOR_PATTERN.test(colorInputValue) &&
        normalizeHexColor(colorInputValue) === selectedColor;
  const hasChanges =
    colorInputIsValid &&
    (selectedIcon !== (project?.icon ?? DEFAULT_ICON) ||
      selectedColor !== projectColor);

  const handleSubmit = useCallback(() => {
    if (!project || !hasChanges) return;
    onSave(project.id, { icon: selectedIcon, color: selectedColor });
    onOpenChange(false);
  }, [project, hasChanges, selectedIcon, selectedColor, onSave, onOpenChange]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && project) {
        setSelectedIcon(project.icon ?? DEFAULT_ICON);
        const color = normalizeHexColor(project.color);
        setSelectedColor(color);
        setColorInputValue(color);
        setCandidates([]);
        setHasScanned(false);
        setScanError(null);
      }
      onOpenChange(newOpen);
    },
    [project, onOpenChange]
  );

  const handleScanIcons = useCallback(async () => {
    if (!project) return;
    setScanning(true);
    setHasScanned(false);
    setScanError(null);
    try {
      const result = await invoke<IconCandidate[]>("scan_project_icons", {
        projectPath: project.path,
      });
      setCandidates(result);
      setHasScanned(true);
    } catch {
      setScanError("图标扫描失败，请重试");
    } finally {
      setScanning(false);
    }
  }, [project]);

  const handleRebind = useCallback(async () => {
    if (!project || rebinding) return;
    setRebinding(true);
    try {
      if (await onRebind(project.id)) onOpenChange(false);
    } finally {
      setRebinding(false);
    }
  }, [project, rebinding, onRebind, onOpenChange]);

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
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            项目设置
          </DialogTitle>
          <DialogDescription className="sr-only">
            为项目选择图标和颜色标记
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project directory binding */}
          <div className="space-y-2">
            <Label>项目目录</Label>
            <div className="flex items-start gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 break-all rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs",
                  pathUnavailable ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {pathUnavailable ? "目录不可用：" : ""}{project?.path ?? "未绑定目录"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRebind}
                disabled={!project || rebinding}
                aria-label="重新绑定项目目录"
              >
                <FolderOpen className="size-3.5 mr-1" />
                {rebinding ? "选择中" : "重新绑定"}
              </Button>
            </div>
            {pathUnavailable && (
              <p className="text-xs text-destructive">
                原目录不可用，请选择新的项目目录。
              </p>
            )}
          </div>

          {/* Icon picker */}
          <div className="space-y-2">
            <Label>图标</Label>
            <div
              className="flex flex-wrap gap-2"
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
                className="grid h-[224px] auto-rows-[64px] grid-cols-3 gap-2 overflow-y-auto rounded-md border border-white/10 p-2"
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
                        "flex min-w-0 flex-col items-center gap-1 rounded-md border p-1.5",
                        "bg-white/5 border-white/10",
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
                      <span
                        className="max-w-full truncate text-xs text-muted-foreground"
                      >
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
            {!scanning && hasScanned && candidates.length === 0 && scanError === null && (
              <p className="text-xs text-muted-foreground">
                未找到可用图标
              </p>
            )}
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>颜色</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedColor || "#000000"}
                onChange={(event) => {
                  const color = normalizeHexColor(event.target.value);
                  if (!color) return;
                  setSelectedColor(color);
                  setColorInputValue(color);
                }}
                aria-label="颜色取色器"
                className="size-10 cursor-pointer rounded-md border border-white/10 bg-transparent p-0.5"
              />
              <input
                type="text"
                value={colorInputValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setColorInputValue(value);
                  if (HEX_COLOR_PATTERN.test(value)) {
                    setSelectedColor(normalizeHexColor(value));
                    setColorInputValue(normalizeHexColor(value));
                  }
                }}
                placeholder="#RRGGBB"
                aria-label="颜色编号"
                aria-invalid={!colorInputIsValid}
                inputMode="text"
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm uppercase outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <button
                type="button"
                aria-label="无颜色"
                aria-pressed={selectedColor === DEFAULT_COLOR}
                onClick={() => {
                  setSelectedColor(DEFAULT_COLOR);
                  setColorInputValue(DEFAULT_COLOR);
                }}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  "border-2 border-dashed border-white/20",
                  "transition-all duration-150 cursor-pointer outline-none",
                  "hover:border-white/40",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  selectedColor === DEFAULT_COLOR &&
                    "ring-2 ring-white/60"
                )}
              >
                <X className="size-3 text-muted-foreground" />
              </button>
            </div>
            {!colorInputIsValid && (
              <p className="text-xs text-destructive">
                请输入 6 位十六进制颜色，例如 #112233
              </p>
            )}
          </div>
        </div>

        {/* Preview section */}
        <div className="mt-4 border-t border-white/10 pt-4">
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
                data-testid="project-color-preview"
              />
            )}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-2">
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
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
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
