/**
 * MissingFilePlaceholder - Shown in the diff view when a file doesn't exist in the target environment.
 *
 * Displays a FileX icon, explanation text, and a "创建此文件" button to create
 * the file from source content. After creation, shows a "撤销" button to undo.
 */
import { Button } from "@/components/ui/button";
import { FileX, Undo2 } from "lucide-react";

export interface MissingFilePlaceholderProps {
  /** Whether the file is missing in the target environment. When false, renders nothing. */
  isMissing: boolean;
  /** Whether the file was just created (shows undo state). */
  wasCreated: boolean;
  /** Whether the create operation is in progress. */
  isCreating: boolean;
  /** Called when the user clicks "创建此文件". */
  onCreate: () => void;
  /** Called when the user clicks "撤销" to undo file creation. */
  onUndoCreate: () => void;
}

export function MissingFilePlaceholder({
  isMissing,
  wasCreated,
  isCreating,
  onCreate,
  onUndoCreate,
}: MissingFilePlaceholderProps) {
  if (!isMissing) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-md mx-1 mb-1">
      <FileX className="size-12 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        此文件在目标环境中不存在
      </p>
      {wasCreated ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndoCreate}
          >
            <Undo2 className="size-3 mr-1" />
            撤销
          </Button>
          <span className="text-xs text-green-400">已创建</span>
        </div>
      ) : (
        <Button
          variant="default"
          size="sm"
          onClick={onCreate}
          disabled={isCreating}
        >
          {isCreating ? "创建中..." : "创建此文件"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        将从源环境复制内容到目标环境
      </p>
    </div>
  );
}
