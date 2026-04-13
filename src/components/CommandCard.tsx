import { useState, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCardProps {
  name: string;
  icon: LucideIcon;
  command?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function CommandCard({
  name,
  icon: Icon,
  command,
  disabled = false,
  onClick,
}: CommandCardProps) {
  const [flashing, setFlashing] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled || flashing) return;
    setFlashing(true);
    onClick?.();
    setTimeout(() => setFlashing(false), 420);
  }, [disabled, flashing, onClick]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? undefined : command}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
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
            "hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]",
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
      <Icon className={cn("size-6", flashing && "animate-spin")} />
      <span>{name}</span>
    </button>
  );
}
