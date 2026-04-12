import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCardProps {
  name: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
}

export function CommandCard({ name, icon: Icon, disabled = false, onClick }: CommandCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // per UI-SPEC Grid Specification: p-4, rounded-xl (12px)
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
        // per UI-SPEC Raycast Visual Treatment: bg-white/5, border-white/10
        "bg-white/5 border border-white/10",
        "cursor-pointer select-none",
        // per UI-SPEC Typography: Label 12px regular
        "text-xs text-card-foreground",
        // per UI-SPEC Animation: 150ms hover, 100ms active
        "transition-all duration-150 ease-out",
        // per UI-SPEC Interaction States - Default
        !disabled && [
          "hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]",
          "active:bg-white/15 active:scale-[0.98] active:duration-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        ],
        // per UI-SPEC Interaction States - Disabled
        disabled && "opacity-40 cursor-not-allowed"
      )}
      aria-label={name}
    >
      <Icon className="size-6" />
      <span>{name}</span>
    </button>
  );
}
