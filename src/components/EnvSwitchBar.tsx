import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Environment } from "@/lib/types";

interface EnvSwitchBarProps {
  envs: Environment[];
  activeEnvId: string | null;
  onApply: (envId: string) => void;
  applying: boolean;
}

export function EnvSwitchBar({
  envs,
  activeEnvId,
  onApply,
  applying,
}: EnvSwitchBarProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // WR-07: do NOT reset selection on every envs reference change. The parent
  // passes a fresh array reference on any unrelated useProject state change
  // (e.g. editing a command in another project), which would silently clear
  // the user's pending selection mid-interaction. Only clear the selection
  // when the currently-selected id is no longer present in envs, keyed on a
  // stable signature so re-renders with the same env ids do not fire.
  const envIdSignature = envs.map((e) => e.id).join(",");
  useEffect(() => {
    if (selectedId !== null && !envs.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envIdSignature]);

  const handleApply = useCallback(() => {
    if (selectedId) {
      onApply(selectedId);
    }
  }, [selectedId, onApply]);

  // Determine the display value: user selection > active env > none
  const displayValue = selectedId ?? activeEnvId ?? "";
  const hasNoEnvs = envs.length === 0;

  const isDisabled =
    !selectedId ||
    selectedId === activeEnvId ||
    hasNoEnvs ||
    applying;

  return (
    <div className="flex items-center gap-2 mt-2">
      <Select
        value={displayValue}
        onValueChange={(value) => setSelectedId(value)}
        disabled={hasNoEnvs}
      >
        <SelectTrigger className="w-[200px]" size="sm">
          <SelectValue placeholder="选择环境" />
        </SelectTrigger>
        <SelectContent>
          {envs.map((env) => (
            <SelectItem key={env.id} value={env.id}>
              {env.name}
              {env.id === activeEnvId ? " (已应用)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="default"
        size="sm"
        onClick={handleApply}
        disabled={isDisabled}
      >
        {applying ? "启用中..." : "启用"}
      </Button>

      {hasNoEnvs && (
        <span className="text-xs text-muted-foreground">暂无可用环境</span>
      )}
    </div>
  );
}
