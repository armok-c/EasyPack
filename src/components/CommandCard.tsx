import { useState, useCallback, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { keyboardEventToShortcut, shortcutToDisplay } from "@/lib/shortcutUtils";
import { toast } from "sonner";

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
  // Phase 11: global shortcut badge
  shortcut?: string;
  isRecording?: boolean;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onShortcutAssign?: (shortcut: string) => void;
  onShortcutClear?: () => void;
  hasConflict?: boolean;
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
  isRecording = false,
  onRecordingStart,
  onRecordingStop,
  onShortcutAssign,
  onShortcutClear,
  hasConflict = false,
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

  // Phase 11: recording mode keydown handler
  useEffect(() => {
    if (!isRecording) return;

    function handleRecordingKeydown(e: KeyboardEvent) {
      // Skip if target is input/textarea (per RESEARCH Pitfall 6)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        onRecordingStop?.();
        return;
      }

      const shortcutString = keyboardEventToShortcut(e);
      if (!shortcutString) {
        const MODIFIER_KEYS = ["Control", "Alt", "Shift", "Meta"];
        if (MODIFIER_KEYS.includes(e.key)) return; // silently ignore modifier press
        // No modifier at all
        if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
          toast.error("快捷键必须包含修饰键 (Ctrl/Alt/Shift)");
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      onShortcutAssign?.(shortcutString);
    }

    window.addEventListener("keydown", handleRecordingKeydown);
    return () => window.removeEventListener("keydown", handleRecordingKeydown);
  }, [isRecording, onRecordingStop, onShortcutAssign]);

  const showDeleteButton = editMode && isCustom;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      tabIndex={tabIndex}
      title={disabled ? undefined : command}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
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
      {/* Phase 11: Global shortcut badge state machine */}
      {isRecording ? (
        // State 3: Recording — pulsing accent border
        <span
          className={cn(
            "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px]",
            "bg-accent/20 border border-accent/60 text-accent",
            "animate-pulse min-w-[48px] text-center"
          )}
          aria-label="正在录制快捷键"
          aria-live="assertive"
        >
          按下快捷键...
        </span>
      ) : hasConflict ? (
        // State 4: Conflict — destructive red
        <span
          className={cn(
            "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold",
            "bg-destructive/20 border border-destructive/60 text-destructive",
            "min-w-[24px] text-center"
          )}
          aria-label="快捷键冲突"
          role="alert"
        >
          冲突
        </span>
      ) : shortcut ? (
        // State 1: Display mode — shows shortcut combo
        <span
          className={cn(
            "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold",
            "bg-white/10 border border-white/10 text-muted-foreground/80",
            "min-w-[24px] text-center",
            editMode && "cursor-pointer hover:bg-white/15 hover:border-white/20"
          )}
          aria-label={editMode ? `快捷键: ${shortcutToDisplay(shortcut)}` : undefined}
          aria-hidden={!editMode}
          onClick={editMode ? (e) => { e.stopPropagation(); onRecordingStart?.(); } : undefined}
        >
          {shortcutToDisplay(shortcut)}
          {/* Clear button — visible on hover in edit mode only */}
          {editMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onShortcutClear?.(); }}
              className="absolute -top-1 -right-1 size-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-100"
              aria-label={`清除快捷键: ${shortcutToDisplay(shortcut)}`}
            >
              <X className="size-2" />
            </button>
          )}
        </span>
      ) : editMode ? (
        // State 2: Empty slot — "+" clickable button
        <button
          onClick={(e) => { e.stopPropagation(); onRecordingStart?.(); }}
          className={cn(
            "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px]",
            "bg-white/5 border border-dashed border-white/20 text-muted-foreground/50",
            "cursor-pointer hover:bg-white/10 hover:border-white/30",
            "transition-all duration-150 ease-out",
            "focus-visible:ring-1 focus-visible:ring-ring"
          )}
          aria-label="设置快捷键"
          role="button"
        >
          +
        </button>
      ) : (
        // No shortcut, non-edit mode: show number badge if available
        shortcutNumber != null && !disabled && (
          <span
            className="absolute top-1 left-1 text-[10px] font-semibold text-muted-foreground/70 pointer-events-none"
            aria-hidden="true"
          >
            {shortcutNumber}
          </span>
        )
      )}
      <Icon className={cn("size-6", flashing && "animate-spin")} />
      <span>{name}</span>
    </button>
  );
}
