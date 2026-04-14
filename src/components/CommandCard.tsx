import { useState, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCardProps {
  name: string;
  icon: LucideIcon;
  command?: string;
  disabled?: boolean;
  onClick?: () => void;
  // Phase 4: edit mode & custom marker support
  isCustom?: boolean;
  editMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  commandId?: string;
}

export function CommandCard({
  name,
  icon: Icon,
  command,
  disabled = false,
  onClick,
  isCustom = false,
  editMode = false,
  onEdit,
  onDelete,
}: CommandCardProps) {
  const [flashing, setFlashing] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled) return;

    // Edit mode: custom cards trigger onEdit, preset cards do nothing
    if (editMode) {
      if (isCustom) {
        onEdit?.();
      }
      return;
    }

    // Normal mode: execute with flashing feedback
    if (flashing) return;
    setFlashing(true);
    onClick?.();
    setTimeout(() => setFlashing(false), 420);
  }, [disabled, editMode, isCustom, onEdit, flashing, onClick]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete]
  );

  const showDeleteButton = editMode && isCustom;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? undefined : command}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
        "bg-white/5 border border-white/10",
        "cursor-pointer select-none",
        "text-xs text-card-foreground",
        // Custom command visual marker (per D-17)
        isCustom && "border-l-2 border-l-blue-400/50",
        // Base transition (only when not flashing)
        !flashing && "transition-all duration-150 ease-out",
        // Execution flash animation (per D-05)
        flashing && "animate-card-flash",
        // hover/active states (only when not disabled and not flashing)
        !disabled &&
          !flashing && [
            "hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]",
            isCustom && "hover:border-l-blue-400/70",
            "active:bg-white/15 active:scale-[0.98] active:duration-100",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          ],
        // Disabled state
        disabled && "opacity-40 cursor-not-allowed",
        // Accessibility: reduced motion support
        "motion-reduce:animate-none"
      )}
      aria-label={name}
    >
      {showDeleteButton && (
        <div
          onClick={handleDelete}
          aria-label={`删除指令: ${name}`}
          className={cn(
            "absolute -top-1 -right-1",
            "bg-red-500/80 hover:bg-red-500 text-white rounded-full",
            "size-4 flex items-center justify-center",
            "transition-colors duration-100 cursor-pointer"
          )}
        >
          <X className="size-3" />
        </div>
      )}
      <Icon className={cn("size-6", flashing && "animate-spin")} />
      <span>{name}</span>
    </button>
  );
}
