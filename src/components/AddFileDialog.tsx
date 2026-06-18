/**
 * AddFileDialog - File selection dialog for adding managed files to an environment.
 *
 * Supports:
 * - System file dialog via tauri-plugin-dialog (multi-select)
 * - Manual relative path input
 * - File type filter dropdown
 * - Reads file content via invoke("read_file_content")
 * - Strips project path prefix for relative path storage
 */
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManagedFile } from "@/lib/types";

export interface AddFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  existingFileNames: string[];
  onConfirm: (files: ManagedFile[]) => Promise<void>;
}

/** File type filter option definition */
interface FileTypeOption {
  label: string;
  filters: { name: string; extensions: string[] }[];
}

const ALL_FORMATS_LABEL = "所有支持的格式";

/** File type filter options for the dropdown (per D-09, D-03) */
const FILE_TYPE_OPTIONS: FileTypeOption[] = [
  {
    label: ALL_FORMATS_LABEL,
    filters: [
      {
        name: "配置文件",
        extensions: [
          "env", "json", "yaml", "yml", "toml",
          "xml", "conf", "ini", "cfg", "txt", "md",
        ],
      },
    ],
  },
  {
    label: "JSON (.json)",
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
  },
  {
    label: "YAML (.yaml/.yml)",
    filters: [
      { name: "YAML 文件", extensions: ["yaml", "yml"] },
    ],
  },
  {
    label: "TOML (.toml)",
    filters: [{ name: "TOML 文件", extensions: ["toml"] }],
  },
  {
    label: "XML (.xml)",
    filters: [{ name: "XML 文件", extensions: ["xml"] }],
  },
  {
    label: "INI (.conf/.ini/.cfg)",
    filters: [
      { name: "INI 文件", extensions: ["conf", "ini", "cfg"] },
    ],
  },
  {
    label: "环境文件 (.env)",
    filters: [{ name: "环境文件", extensions: ["env"] }],
  },
  {
    label: "文本文件 (.txt/.md)",
    filters: [
      { name: "文本文件", extensions: ["txt", "md"] },
    ],
  },
];

/** Strip project path prefix from an absolute path to get relative path */
function toRelativePath(absolutePath: string, projectPath: string): string {
  const normalizedAbs = absolutePath.replace(/\\/g, "/");
  const normalizedProj = projectPath.replace(/\\/g, "/");
  const prefix = normalizedProj.endsWith("/") ? normalizedProj : `${normalizedProj}/`;
  if (normalizedAbs.startsWith(prefix)) {
    return normalizedAbs.substring(prefix.length);
  }
  // Fallback: return the original absolute path if prefix doesn't match
  // This shouldn't happen since files are selected from within the project
  return normalizedAbs;
}

export function AddFileDialog({
  open,
  onOpenChange,
  projectPath,
  existingFileNames,
  onConfirm,
}: AddFileDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(ALL_FORMATS_LABEL);
  const [manualInput, setManualInput] = useState("");

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setLoading(false);
        setManualInput("");
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  // Handle system file dialog selection
  const handleSelectFiles = useCallback(async () => {
    const option = FILE_TYPE_OPTIONS.find((o) => o.label === selectedFilter);
    const filters = option?.filters ?? FILE_TYPE_OPTIONS[0].filters;

    try {
      const selected = await open({
        multiple: true,
        filters,
        title: "选择配置文件",
      });

      if (!selected) return; // User cancelled

      // selected is string[] | null from open()
      const paths = Array.isArray(selected) ? selected : [];

      // Convert absolute paths to relative and build ManagedFile objects
      await processFilesAndConfirm(paths);
    } catch (error) {
      // Error from dialog is non-fatal; user can retry
      if (import.meta.env.DEV) console.error("文件选择失败:", error);
    }
  }, [selectedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle manual input submission
  const handleManualAdd = useCallback(async () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;

    // Treat the manual input as a relative path within the project
    const fullPath = `${projectPath.replace(/\\/g, "/")}/${trimmed}`;
    await processFilesAndConfirm([fullPath]);
    setManualInput("");
  }, [manualInput, projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Process selected paths: read content, build ManagedFile objects
  const processFilesAndConfirm = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;

      setLoading(true);
      const managedFiles: ManagedFile[] = [];
      let failCount = 0;

      for (const absPath of paths) {
        const relativeName = toRelativePath(absPath, projectPath);

        // Check for duplicates per D-07
        if (existingFileNames.includes(relativeName)) {
          continue;
        }

        try {
          const content = await invoke<string>("read_file_content", {
            projectPath,
            fileName: relativeName,
          });
          managedFiles.push({
            name: relativeName,
            content,
            addedAt: Date.now(),
          });
        } catch {
          // Partial failure tolerance per D-08
          failCount++;
        }
      }

      setLoading(false);

      if (managedFiles.length > 0) {
        await onConfirm(managedFiles);
      }

      // Handle feedback — partial success/failure will be shown by the caller
      if (failCount > 0 && import.meta.env.DEV) {
        console.warn(`${failCount} 个文件读取失败`);
      }

      // Close dialog on success (all files processed)
      if (managedFiles.length > 0 || failCount === 0) {
        onOpenChange(false);
      }
    },
    [projectPath, existingFileNames, onConfirm, onOpenChange]
  );

  // Handle Enter key on manual input
  const handleManualKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleManualAdd();
      }
    },
    [handleManualAdd]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加配置文件</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File type filter dropdown per D-09 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              文件类型
            </span>
            <Select
              value={selectedFilter}
              onValueChange={setSelectedFilter}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.label} value={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System file dialog button per D-01, D-02 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSelectFiles}
            disabled={loading}
          >
            {loading ? "读取中..." : "选择文件"}
          </Button>

          {/* Divider with text */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">或手动输入</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Manual input per D-04 */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="输入文件相对路径"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={handleManualKeyDown}
              className="flex-1"
              disabled={loading}
            />
            <Button
              onClick={handleManualAdd}
              disabled={loading || !manualInput.trim()}
              size="sm"
            >
              添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
