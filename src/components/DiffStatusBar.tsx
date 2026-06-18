/**
 * DiffStatusBar - Bottom status bar for the diff view dialog.
 *
 * Displays resolved/unresolved hunk counts on the left, and an "全部已解决"
 * badge on the right when all hunks are resolved (per D-27).
 */
import { CheckCheck } from "lucide-react";

export interface DiffStatusBarProps {
  /** Total number of hunks for the current (file, env) pair. */
  totalHunks: number;
  /** Number of resolved hunks. */
  resolvedCount: number;
  /** Number of unresolved hunks (should be totalHunks - resolvedCount). */
  unresolvedCount: number;
  /** Whether the file is missing in the target environment. */
  isFileMissing: boolean;
  /** Whether the files are identical (no diff). */
  isIdentical: boolean;
}

export function DiffStatusBar({
  totalHunks,
  resolvedCount,
  unresolvedCount,
  isFileMissing,
  isIdentical,
}: DiffStatusBarProps) {
  const allResolved = totalHunks > 0 && resolvedCount === totalHunks;

  let statusLabel: string;
  if (totalHunks > 0) {
    statusLabel = `已解决: ${resolvedCount} / 未解决: ${unresolvedCount}`;
  } else if (isFileMissing) {
    statusLabel = "文件缺失";
  } else if (isIdentical) {
    statusLabel = "无差异";
  } else {
    statusLabel = "差异对比";
  }

  return (
    <div className="flex items-center justify-between h-9 px-6 border-t border-border flex-shrink-0">
      <span className="text-xs text-muted-foreground">{statusLabel}</span>
      {allResolved && (
        <span className="text-xs text-green-400 flex items-center gap-1">
          <CheckCheck className="size-3" />
          全部已解决
        </span>
      )}
    </div>
  );
}
