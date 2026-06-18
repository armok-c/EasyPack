/**
 * EnvSelectDialog - 多选目标环境弹窗组件
 *
 * 用户点击「同步差异」按钮后打开，展示所有其他环境（排除源环境），
 * 显示各环境与勾选文件的匹配/缺失文件数，支持多选。
 *
 * 决策参考: CONTEXT.md D-01 ~ D-08, D-36
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { FileX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Environment } from "@/lib/types";

export interface EnvSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEnvId: string;
  envs: Environment[];
  checkedFiles: string[];
  onConfirm: (targetEnvIds: string[]) => void;
}

/**
 * Compute match and missing file counts for a target environment.
 * @param checkedFiles - files checked in source env
 * @param targetEnv - target environment to compare against
 */
function computeFileCounts(
  checkedFiles: string[],
  targetEnv: Environment
): { matchCount: number; missingCount: number } {
  const targetFileNames = new Set(targetEnv.files.map((f) => f.name));
  let matchCount = 0;
  let missingCount = 0;

  for (const fileName of checkedFiles) {
    if (targetFileNames.has(fileName)) {
      matchCount++;
    } else {
      missingCount++;
    }
  }

  return { matchCount, missingCount };
}

export function EnvSelectDialog({
  open,
  onOpenChange,
  sourceEnvId,
  envs,
  checkedFiles,
  onConfirm,
}: EnvSelectDialogProps) {
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>([]);

  // D-08: Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedEnvIds([]);
    }
  }, [open]);

  // D-07: Filter out source env, sort remaining by name alphabetically
  const filteredEnvs = useMemo(() => {
    const otherEnvs = envs.filter((env) => env.id !== sourceEnvId);
    return [...otherEnvs].sort((a, b) => a.name.localeCompare(b.name));
  }, [envs, sourceEnvId]);

  // D-05: Get source env name for title
  const sourceEnvName = useMemo(() => {
    const source = envs.find((env) => env.id === sourceEnvId);
    return source?.name ?? "";
  }, [envs, sourceEnvId]);

  // Pre-compute match/missing counts for each filtered env
  const envItems = useMemo(() => {
    return filteredEnvs.map((env) => ({
      env,
      ...computeFileCounts(checkedFiles, env),
    }));
  }, [filteredEnvs, checkedFiles]);

  // D-02: Select-all state
  const allSelected = envItems.length > 0 && selectedEnvIds.length === envItems.length;
  const someSelected = selectedEnvIds.length > 0 && selectedEnvIds.length < envItems.length;

  // D-02: Toggle select-all
  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedEnvIds([]);
    } else {
      setSelectedEnvIds(envItems.map((item) => item.env.id));
    }
  }, [allSelected, envItems]);

  // Toggle single env
  const handleToggleEnv = useCallback((envId: string) => {
    setSelectedEnvIds((prev) => {
      if (prev.includes(envId)) {
        return prev.filter((id) => id !== envId);
      }
      return [...prev, envId];
    });
  }, []);

  // D-03: Confirm handler
  const handleConfirm = useCallback(() => {
    if (selectedEnvIds.length === 0) return;
    onConfirm(selectedEnvIds);
    onOpenChange(false);
  }, [selectedEnvIds, onConfirm, onOpenChange]);

  const confirmDisabled = selectedEnvIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>同步差异 — {sourceEnvName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Header: D-02 Select-all row */}
          {envItems.length > 0 ? (
            <>
              <div className="flex items-center gap-2 px-1 py-1.5">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={handleToggleAll}
                />
                <span className="text-xs text-muted-foreground select-none">
                  全选
                </span>
              </div>

              {/* Environment list */}
              <ScrollArea className="max-h-[260px]">
                <div className="space-y-1">
                  {envItems.map(({ env, matchCount, missingCount }) => (
                    <div
                      key={env.id}
                      className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-accent cursor-pointer"
                      onClick={() => handleToggleEnv(env.id)}
                    >
                      <Checkbox
                        checked={selectedEnvIds.includes(env.id)}
                        onCheckedChange={() => handleToggleEnv(env.id)}
                      />
                      {/* D-07: Truncate long env names with title tooltip */}
                      <span
                        className="text-sm truncate flex-1"
                        title={env.name}
                      >
                        {env.name}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        <span>· {matchCount} 个匹配, {missingCount} 个缺失</span>
                        {/* D-36: FileX icon for missing files */}
                        {missingCount > 0 && (
                          <FileX className="size-3.5 inline-block mr-0.5 text-muted-foreground ml-1" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            // D-06: Empty state when no other environments
            <p className="text-sm text-muted-foreground text-center py-6">
              没有其他可选环境
            </p>
          )}
        </div>

        {/* D-03: Footer with cancel/confirm */}
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            variant="default"
            disabled={confirmDisabled}
            onClick={handleConfirm}
            title={confirmDisabled ? "请至少选择一个目标环境" : undefined}
            className={confirmDisabled ? "opacity-50 cursor-not-allowed" : ""}
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
