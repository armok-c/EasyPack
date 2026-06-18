/**
 * FileList - File management list component with toolbar, table, and integrated dialogs.
 *
 * Features:
 * - Toolbar with file count, sync diff button, add button, and delete button per D-09/D-25
 * - Five-column table: checkbox, filename, extension, modified time, view per D-22/D-23
 * - Row click toggles checkbox per D-31
 * - Max height 300px with scroll per D-28
 * - Sort by file name per D-29
 * - Empty state guide text per D-24
 * - Delete confirmation AlertDialog per D-26
 * - Integrates AddFileDialog and FileEditorDialog
 */
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Button } from "@/components/ui/button";
import { AddFileDialog } from "@/components/AddFileDialog";
import { FileEditorDialog } from "@/components/FileEditorDialog";
import { formatRelativeTime, getLanguageExtension } from "@/lib/file-lang";
import { SyncDiffButton } from "@/components/SyncDiffButton";
import type { ManagedFile } from "@/lib/types";

export interface FileListProps {
  envId: string;
  files: ManagedFile[];
  projectPath: string;
  onAddFiles: (envId: string, files: ManagedFile[]) => Promise<void>;
  onDeleteFiles: (envId: string, fileNames: string[]) => Promise<void>;
  onUpdateFile: (envId: string, fileName: string, content: string) => Promise<void>;
  onSyncDiff?: (checkedFiles: string[]) => void;
}

/** Extract file extension from name */
function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return name.substring(dotIndex).toLowerCase();
}

/** Extract basename (last segment) from a relative path */
function getBasename(name: string): string {
  const segments = name.split(/[\\/]/);
  return segments[segments.length - 1] || name;
}

export function FileList({
  envId,
  files,
  projectPath,
  onAddFiles,
  onDeleteFiles,
  onUpdateFile,
  onSyncDiff,
}: FileListProps) {
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editorDialogOpen, setEditorDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<ManagedFile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Sort files alphabetically by name per D-29
  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => a.name.localeCompare(b.name)),
    [files]
  );

  // Existing file names for dedup in AddFileDialog
  const existingFileNames = useMemo(
    () => files.map((f) => f.name),
    [files]
  );

  // Toggle a single file selection per D-31
  const toggleSelection = useCallback((fileName: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  }, []);

  // Handle row click - toggles checkbox (view column excluded)
  const handleRowClick = useCallback(
    (fileName: string, event: React.MouseEvent) => {
      // Don't toggle if clicking the view button or its parent cell
      const target = event.target as HTMLElement;
      if (target.closest('[data-action="view"]')) return;
      toggleSelection(fileName);
    },
    [toggleSelection]
  );

  // Open delete confirmation dialog
  const handleDeleteClick = useCallback(() => {
    if (selectedNames.size === 0) return;
    setDeleteDialogOpen(true);
  }, [selectedNames]);

  // Confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (selectedNames.size === 0) return;
    const names = Array.from(selectedNames);
    try {
      await onDeleteFiles(envId, names);
      setSelectedNames(new Set());
      setDeleteDialogOpen(false);
      toast.success(`已删除 ${names.length} 个文件`);
    } catch (error) {
      toast.error("删除失败");
      if (import.meta.env.DEV) console.error("删除失败:", error);
    }
  }, [selectedNames, envId, onDeleteFiles]);

  // Open AddFileDialog
  const handleOpenAddDialog = useCallback(() => {
    setAddDialogOpen(true);
  }, []);

  // Handle AddFileDialog confirm
  const handleAddFileConfirm = useCallback(
    async (newFiles: ManagedFile[]) => {
      try {
        await onAddFiles(envId, newFiles);
        toast.success(`已添加 ${newFiles.length} 个文件`);
      } catch (error) {
        toast.error("添加文件失败");
        if (import.meta.env.DEV) console.error("添加文件失败:", error);
      }
    },
    [envId, onAddFiles]
  );

  // Open editor dialog for a file
  const handleViewFile = useCallback((file: ManagedFile) => {
    setEditingFile(file);
    setEditorDialogOpen(true);
  }, []);

  // Handle editor save
  const handleEditorSave = useCallback(
    async (fileName: string, content: string) => {
      await onUpdateFile(envId, fileName, content);
    },
    [envId, onUpdateFile]
  );

  // Handle editor dialog close
  const handleEditorOpenChange = useCallback(
    (open: boolean) => {
      setEditorDialogOpen(open);
      if (!open) {
        setEditingFile(null);
      }
    },
    []
  );

  return (
    <>
      <div className="rounded-lg border mt-2">
        {/* Toolbar per D-25, with sync diff button per D-09 */}
        <div className="flex items-center gap-1 px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {files.length} 个文件
          </span>
          <span className="text-xs text-muted-foreground">|</span>
          <SyncDiffButton
            checkedCount={selectedNames.size}
            onClick={() => onSyncDiff?.(Array.from(selectedNames))}
          />
          <span className="text-xs text-muted-foreground">|</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenAddDialog}
            >
              添加文件
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteClick}
              disabled={selectedNames.size === 0}
              className={selectedNames.size === 0 ? "opacity-50 cursor-not-allowed" : ""}
              title={selectedNames.size === 0 ? "请先勾选要删除的文件" : undefined}
            >
              删除
            </Button>
          </div>
        </div>

        {/* File list or empty state */}
        {sortedFiles.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>文件名</TableHead>
                  <TableHead>后缀</TableHead>
                  <TableHead>修改时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFiles.map((file) => {
                  const isSelected = selectedNames.has(file.name);
                  return (
                    <TableRow
                      key={file.name}
                      className="hover:bg-accent cursor-pointer"
                      onClick={(e) => handleRowClick(file.name, e)}
                    >
                      {/* Checkbox column per D-31 */}
                      <TableCell className="w-12">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(file.name)}
                          className="size-4 cursor-pointer accent-primary"
                        />
                      </TableCell>

                      {/* Filename column per D-30 */}
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={file.name}
                      >
                        <span className="text-sm">
                          {getBasename(file.name)}
                        </span>
                      </TableCell>

                      {/* Extension column */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {getExtension(file.name)}
                        </span>
                      </TableCell>

                      {/* Modified time column per D-27 */}
                      <TableCell
                        title={new Date(file.addedAt).toLocaleString()}
                      >
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(file.addedAt)}
                        </span>
                      </TableCell>

                      {/* Actions column - view button per D-23 */}
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          data-action="view"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewFile(file);
                          }}
                        >
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Empty state per D-24 */
          <div className="text-sm text-muted-foreground text-center py-8 border-t border-border">
            暂无文件，点击添加按钮添加配置文件
          </div>
        )}
      </div>

      {/* AddFileDialog integration */}
      <AddFileDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        projectPath={projectPath}
        existingFileNames={existingFileNames}
        onConfirm={handleAddFileConfirm}
      />

      {/* FileEditorDialog integration */}
      <FileEditorDialog
        open={editorDialogOpen}
        onOpenChange={handleEditorOpenChange}
        file={editingFile}
        onSave={handleEditorSave}
      />

      {/* Delete confirmation AlertDialog per D-26 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除文件？</AlertDialogTitle>
            <AlertDialogDescription>
              以下 {selectedNames.size} 个文件将被从当前环境移除，源文件不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[200px] overflow-y-auto px-1">
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {Array.from(selectedNames).map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
