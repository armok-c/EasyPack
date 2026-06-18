/**
 * SyncDiffButton - FileList 工具栏中的「同步差异」按钮组件
 *
 * 功能:
 * - 展示 GitCompare 图标和「同步差异」文字
 * - 未勾选文件时 disabled，显示提示 tooltip
 * - 勾选文件后 enabled，点击触发同步差异流程
 */
import { memo } from "react";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SyncDiffButtonProps {
  /** 当前已勾选的文件数量 */
  checkedCount: number;
  /** 点击按钮时的回调 */
  onClick: () => void;
}

export const SyncDiffButton = memo(function SyncDiffButton({
  checkedCount,
  onClick,
}: SyncDiffButtonProps) {
  const disabled = checkedCount === 0;

  return (
    <Button
      variant="default"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "请先勾选要对比的文件" : undefined}
      className={disabled ? "opacity-50 cursor-not-allowed" : ""}
    >
      <GitCompare className="size-4 mr-1.5" />
      同步差异
    </Button>
  );
});
