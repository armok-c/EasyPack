import { useState, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortcutToDisplay } from "@/lib/shortcutUtils";

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
  // Phase 5 Plan 03: keyboard navigation
  tabIndex?: number;
  shortcutNumber?: number;
  // Phase 11: global shortcut badge (display-only, recording moved to ShortcutPanel)
  shortcut?: string;
  // Phase 17: multi-line script content (not displayed on the card)
  scriptLines?: string;
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
  tabIndex = 0,
  shortcutNumber,
  shortcut,
  scriptLines,
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
      tabIndex={tabIndex}
      className={cn(
        "group relative flex h-24 min-w-0 flex-col items-center justify-start gap-2 pt-5 px-3 pb-3 rounded-xl",
        "bg-white/5 border border-white/10",
        "cursor-pointer select-none",
        "text-xs text-card-foreground",
        // Base transition (only when not flashing)
        !flashing && "transition-all duration-150 ease-out",
        // Execution flash animation (per D-05)
        flashing && "animate-card-flash",
        // hover/active states (only when not disabled and not flashing)
        !disabled &&
          !flashing && [
            "hover:bg-white/10 hover:border-white/20",
            "active:bg-white/15 active:scale-[0.98] active:duration-100",
            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none",
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
            "absolute top-2 right-2",
            "text-destructive bg-destructive/15 hover:bg-destructive/30 rounded-md",
            "size-6 flex items-center justify-center",
            "transition-colors duration-100 cursor-pointer"
          )}
        >
          <X className="size-3.5" />
        </div>
      )}
      {/* Shortcut badge: display-only (recording moved to ShortcutPanel in Phase 18) */}
      {shortcut ? (
        <span
          className={cn(
            "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold",
            "bg-white/10 border border-white/10 text-muted-foreground/80",
            "min-w-[24px] text-center"
          )}
          aria-hidden="true"
        >
          {shortcutToDisplay(shortcut)}
        </span>
      ) : !disabled && shortcutNumber != null ? (
        <span
          className="absolute top-1 left-1 text-[10px] font-semibold text-muted-foreground/70 pointer-events-none"
          aria-hidden="true"
        >
          {shortcutNumber}
        </span>
      ) : null}
      <Icon className={cn("size-6 shrink-0", flashing && "animate-spin")} />
      <span className="h-8 w-full min-w-0 shrink-0 line-clamp-2 text-center">{name}</span>
    </button>
  );
}
