/**
 * EnvSelectDialog - Multi-select environment picker dialog for sync diff.
 *
 * Features:
 * - Shows all target environments (source env excluded) with match/missing file counts per D-01
 * - Select-all header checkbox with indeterminate state per D-02
 * - Sorted alphabetically per D-07
 * - Opens with all unselected per D-08
 * - Confirm button disabled when no env selected per D-03
 */
import { useState, useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileX } from "lucide-react";

export interface EnvTargetItem {
  id: string;
  name: string;
  matched: number;
  missing: number;
}

export interface EnvSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the source (current browsing) environment for the title */
  sourceEnvName: string;
  /** List of selectable target environments (source env excluded, counts pre-computed) */
  targetEnvs: EnvTargetItem[];
  /** Called with selected env IDs when user confirms */
  onConfirm: (selectedEnvIds: string[]) => Promise<void>;
}

export function EnvSelectDialog({
  open,
  onOpenChange,
  sourceEnvName,
  targetEnvs,
  onConfirm,
}: EnvSelectDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  // Track the last known open state to reset on open
  const prevOpenRef = useRef(open);

  // Reset all selections when dialog opens (D-08)
  if (open && !prevOpenRef.current) {
    setSelectedIds(new Set());
  }
  prevOpenRef.current = open;

  // Sorted alphabetically per D-07
  const sortedEnvs = useMemo(
    () => [...targetEnvs].sort((a, b) => a.name.localeCompare(b.name)),
    [targetEnvs],
  );

  // Derived state
  const allSelected = sortedEnvs.length > 0 && selectedIds.size === sortedEnvs.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === sortedEnvs.length) {
        return new Set();
      }
      return new Set(sortedEnvs.map((e) => e.id));
    });
  }, [sortedEnvs]);

  const handleConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      await onConfirm(Array.from(selectedIds));
    } finally {
      setLoading(false);
    }
  }, [selectedIds, onConfirm]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedIds(new Set());
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          {/* D-05: title includes source env name */}
          <DialogTitle>同步差异 — {sourceEnvName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {/* Select-all header row per D-02 */}
          {sortedEnvs.length > 0 && (
            <div
              className="flex items-center gap-2 px-1 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
              onClick={handleToggleAll}
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleToggleAll}
                className="size-4 cursor-pointer accent-primary"
              />
              <span className="text-xs text-muted-foreground select-none">全选</span>
            </div>
          )}

          {/* Separator */}
          {sortedEnvs.length > 0 && <div className="border-t border-border my-1" />}

          {/* Environment list */}
          <div className="max-h-[300px] overflow-y-auto space-y-0.5">
            {sortedEnvs.length > 0 ? (
              sortedEnvs.map((env) => {
                const isChecked = selectedIds.has(env.id);
                return (
                  <div
                    key={env.id}
                    className="flex items-center gap-2 px-1 py-2 cursor-pointer hover:bg-accent rounded-sm"
                    onClick={() => handleToggle(env.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(env.id)}
                      className="size-4 cursor-pointer accent-primary flex-shrink-0"
                    />
                    {/* Env name with truncation per D-07 */}
                    <span
                      className="text-sm truncate flex-1 min-w-0"
                      title={env.name}
                    >
                      {env.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {env.matched} 个匹配
                    </span>
                    {env.missing > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground flex-shrink-0">
                        <FileX className="size-3" />
                        {env.missing} 个缺失
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                没有其他环境可供选择
              </p>
            )}
          </div>
        </div>

        {/* Footer per D-02 */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || loading}
            title={selectedIds.size === 0 ? "请至少选择一个目标环境" : undefined}
          >
            {loading ? "处理中..." : "确认"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
