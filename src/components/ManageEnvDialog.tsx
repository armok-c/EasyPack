import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/types";

interface ManageEnvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envs: Environment[];
  activeEnvId: string | null;
  onCreateEnv: (name: string) => Promise<string | null>;
  onRenameEnv: (envId: string, newName: string) => Promise<void>;
  onDeleteEnv: (envId: string) => Promise<void>;
}

/** Rename inline state — null means rename UI is closed */
interface RenameState {
  envId: string;
  currentName: string;
  inputValue: string;
}

/** Delete confirmation state — null means no pending delete */
interface DeleteState {
  envId: string;
  envName: string;
  isActive: boolean;
}

export function ManageEnvDialog({
  open,
  onOpenChange,
  envs,
  activeEnvId,
  onCreateEnv,
  onRenameEnv,
  onDeleteEnv,
}: ManageEnvDialogProps) {
  // Create env input
  const [newEnvName, setNewEnvName] = useState("");

  // Rename state
  const [renameState, setRenameState] = useState<RenameState | null>(null);

  // Delete confirmation state
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  // Reset local state when dialog opens/closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setNewEnvName("");
        setRenameState(null);
        setDeleteState(null);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  // Create env handler
  const handleCreateEnv = useCallback(async () => {
    const name = newEnvName.trim();
    if (!name) {
      toast.error("请输入环境名称");
      return;
    }

    // Check uniqueness per D-20
    if (envs.some((e) => e.name === name)) {
      toast.error("环境名称已存在");
      return;
    }

    const result = await onCreateEnv(name);
    if (result !== null) {
      setNewEnvName("");
      toast.success(`已创建环境: ${name}`);
    }
  }, [newEnvName, envs, onCreateEnv]);

  // Handle Enter key in create input
  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleCreateEnv();
      }
    },
    [handleCreateEnv]
  );

  // Open rename UI
  const handleOpenRename = useCallback((env: Environment) => {
    setRenameState({
      envId: env.id,
      currentName: env.name,
      inputValue: env.name,
    });
  }, []);

  // Confirm rename
  const handleConfirmRename = useCallback(async () => {
    if (!renameState) return;
    const newName = renameState.inputValue.trim();
    if (!newName) {
      toast.error("环境名称不能为空");
      return;
    }

    // Check uniqueness excluding self
    if (envs.some((e) => e.name === newName && e.id !== renameState.envId)) {
      toast.error("环境名称已存在");
      return;
    }

    await onRenameEnv(renameState.envId, newName);
    setRenameState(null);
    toast.success(`已重命名为: ${newName}`);
  }, [renameState, envs, onRenameEnv]);

  // Open delete confirmation
  const handleOpenDelete = useCallback(
    (env: Environment) => {
      setDeleteState({
        envId: env.id,
        envName: env.name,
        isActive: env.id === activeEnvId,
      });
    },
    [activeEnvId]
  );

  // IN-01: re-derive isActive at confirm time from the live activeEnvId. The
  // snapshot captured at open time can go stale if the active env changes
  // while the dialog is open, allowing deletion of a now-active env or
  // blocking deletion of a now-inactive one.
  const isDeleteTargetActive =
    deleteState !== null && deleteState.envId === activeEnvId;

  // Confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteState) return;
    if (deleteState.envId === activeEnvId) return; // re-derived guard
    await onDeleteEnv(deleteState.envId);
    toast.success(`已删除环境: ${deleteState.envName}`);
    setDeleteState(null);
  }, [deleteState, activeEnvId, onDeleteEnv]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>管理环境</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create environment section */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="环境名称"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                className="flex-1"
              />
              <Button onClick={handleCreateEnv} size="sm">
                新增
              </Button>
            </div>

            {/* Environment list table */}
            {envs.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">名称</TableHead>
                      <TableHead className="w-[22%]">创建时间</TableHead>
                      <TableHead className="w-[22%]">修改时间</TableHead>
                      <TableHead className="w-[26%]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {envs.map((env) => {
                      const isActive = env.id === activeEnvId;

                      return (
                        <TableRow key={env.id}>
                          {/* Name column */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{env.name}</span>
                              {isActive && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                                  <span className="size-1.5 rounded-full bg-green-500" />
                                  已应用
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Created at column */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {new Date(env.createdAt).toLocaleString()}
                            </span>
                          </TableCell>

                          {/* Updated at column */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {new Date(env.updatedAt).toLocaleString()}
                            </span>
                          </TableCell>

                          {/* Actions column */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRename(env)}
                              >
                                重命名
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDelete(env)}
                                className="text-red-400 hover:text-red-300"
                              >
                                删除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无环境，请在上方输入框添加
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      {renameState && (
        <Dialog
          open={true}
          onOpenChange={() => setRenameState(null)}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>重命名环境</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                placeholder="新名称"
                value={renameState.inputValue}
                onChange={(e) =>
                  setRenameState({ ...renameState, inputValue: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmRename();
                }}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRenameState(null)}>
                  取消
                </Button>
                <Button onClick={handleConfirmRename}>
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation AlertDialog */}
      {deleteState && (
        <AlertDialog
          open={true}
          onOpenChange={() => setDeleteState(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除环境?</AlertDialogTitle>
              <AlertDialogDescription>
                {isDeleteTargetActive ? (
                  <>
                    环境「{deleteState.envName}」当前已应用，请先切换到其他环境后再删除。
                  </>
                ) : (
                  <>
                    环境「{deleteState.envName}」将被永久删除，其管理的文件副本将一并移除。此操作不可撤销。
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleteTargetActive}
                className={cn(
                  isDeleteTargetActive
                    ? "opacity-50 cursor-not-allowed"
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={isDeleteTargetActive ? undefined : handleConfirmDelete}
              >
                {isDeleteTargetActive ? "无法删除" : "删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
