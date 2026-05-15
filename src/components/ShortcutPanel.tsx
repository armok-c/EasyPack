import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  keyboardEventToShortcut,
  shortcutToDisplay,
} from "@/lib/shortcutUtils";
import type { ShortcutAction, ShortcutCategory } from "@/lib/types";
import {
  ChevronDown,
  ChevronRight,
  X,
  RotateCcw,
  Search,
} from "lucide-react";

interface ShortcutPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ShortcutAction[];
  bindings: Record<string, string>;
  onSetBinding: (
    actionId: string,
    shortcut: string,
  ) => Promise<string | null>;
  onClearBinding: (actionId: string) => Promise<void>;
  onResetAll: () => Promise<void>;
  onRecordingChange: (recording: boolean) => void;
}

interface ConflictInfo {
  actionId: string;
  label: string;
  newShortcut: string;
}

const CATEGORY_ORDER: ShortcutCategory[] = ["command", "window", "project"];

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  command: "指令执行",
  window: "窗口操作",
  project: "项目操作",
};

export function ShortcutPanel({
  open,
  onOpenChange,
  actions,
  bindings,
  onSetBinding,
  onClearBinding,
  onResetAll,
  onRecordingChange,
}: ShortcutPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<
    Set<ShortcutCategory>
  >(() => new Set(["command", "window", "project"]));
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Build action lookup for conflict label resolution
  const actionsMap = useMemo(
    () => new Map(actions.map((a) => [a.id, a])),
    [actions],
  );

  // Filter actions by search query (match label or category Chinese name)
  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return actions;
    const q = searchQuery.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        CATEGORY_LABELS[a.category].toLowerCase().includes(q),
    );
  }, [actions, searchQuery]);

  // Group filtered actions by category
  const groupedActions = useMemo(() => {
    const groups: Record<ShortcutCategory, ShortcutAction[]> = {
      command: [],
      window: [],
      project: [],
    };
    for (const action of filteredActions) {
      groups[action.category].push(action);
    }
    return groups;
  }, [filteredActions]);

  // Toggle category expand/collapse
  const toggleCategory = useCallback((category: ShortcutCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Start recording for a specific action
  const startRecording = useCallback(
    (actionId: string) => {
      setRecordingId(actionId);
      setConflictInfo(null);
      onRecordingChange(true);
    },
    [onRecordingChange],
  );

  // Stop recording
  const stopRecording = useCallback(() => {
    setRecordingId(null);
    setConflictInfo(null);
    onRecordingChange(false);
  }, [onRecordingChange]);

  // Confirm conflict override
  const confirmConflict = useCallback(async () => {
    if (!conflictInfo) return;
    await onClearBinding(conflictInfo.actionId);
    await onSetBinding(recordingId!, conflictInfo.newShortcut, [conflictInfo.actionId]);
    stopRecording();
  }, [conflictInfo, recordingId, onClearBinding, onSetBinding, stopRecording]);

  // Cancel conflict
  const cancelConflict = useCallback(() => {
    setConflictInfo(null);
  }, []);

  // Handle keydown during recording
  useEffect(() => {
    if (recordingId === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if target is input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      e.preventDefault();
      e.stopPropagation();

      // Esc cancels recording
      if (e.key === "Escape") {
        stopRecording();
        return;
      }

      const shortcut = keyboardEventToShortcut(e);
      if (!shortcut) return; // Invalid combo, keep recording

      // Attempt to bind — check for conflict
      onSetBinding(recordingId, shortcut).then((conflictId) => {
        if (conflictId) {
          const conflictingAction = actionsMap.get(conflictId);
          setConflictInfo({
            actionId: conflictId,
            label: conflictingAction?.label ?? conflictId,
            newShortcut: shortcut,
          });
        } else {
          stopRecording();
        }
      }).catch((err) => {
        if (import.meta.env.DEV) console.error("Failed to set binding:", err);
        stopRecording();
      });
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingId, actionsMap, onSetBinding, stopRecording]);

  // Prevent Dialog from closing on Escape during recording
  const handleEscapeKeyDown = useCallback(
    (e: Event) => {
      if (recordingId !== null) {
        e.preventDefault();
        stopRecording();
      }
    },
    [recordingId, stopRecording],
  );

  // Reset all shortcuts
  const handleResetConfirm = useCallback(async () => {
    await onResetAll();
    setResetConfirmOpen(false);
  }, [onResetAll]);

  // Render a single action row
  function renderActionRow(action: ShortcutAction) {
    const binding = bindings[action.id];
    const isRecordingThis = recordingId === action.id;
    const hasConflictForThis =
      conflictInfo && recordingId === action.id;

    return (
      <div key={action.id}>
        <div className="flex items-center justify-between py-1.5 px-1 group">
          <span className="text-sm truncate mr-2">{action.label}</span>

          {/* Shortcut badge area */}
          <div className="flex items-center gap-1 shrink-0">
            {isRecordingThis ? (
              // Recording state: dashed border + pulse animation
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs rounded border border-dashed border-accent animate-pulse text-accent-foreground"
              >
                按下快捷键...
              </span>
            ) : binding ? (
              // Bound state: show shortcut display + clear button on hover
              <>
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground font-mono">
                  {shortcutToDisplay(binding)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearBinding(action.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground"
                  title="清除快捷键"
                >
                  <X className="size-3" />
                </button>
              </>
            ) : (
              // Unbound state: click to start recording
              <button
                onClick={() => startRecording(action.id)}
                className="px-2 py-0.5 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                未设置
              </button>
            )}

            {/* Click the bound badge to re-record */}
            {binding && !isRecordingThis && (
              <button
                onClick={() => startRecording(action.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                更换
              </button>
            )}
          </div>
        </div>

        {/* Conflict warning bar */}
        {hasConflictForThis && conflictInfo && (
          <div className="mx-1 mb-1 px-3 py-2 rounded bg-amber-500/15 border border-amber-500/30">
            <p className="text-xs text-amber-200 mb-2">
              此快捷键已分配给「{conflictInfo.label}」，继续将覆盖
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
                onClick={confirmConflict}
              >
                确认覆盖
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-muted-foreground"
                onClick={cancelConflict}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Main ShortcutPanel Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[420px]"
          onEscapeKeyDown={handleEscapeKeyDown}
          showCloseButton={recordingId === null}
        >
          <DialogHeader>
            <DialogTitle>快捷键设置</DialogTitle>
          </DialogHeader>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索操作..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Grouped action list */}
          <ScrollArea className="max-h-[400px] -mx-2 px-2">
            <div className="space-y-1">
              {CATEGORY_ORDER.map((category) => {
                const groupActions = groupedActions[category];
                if (groupActions.length === 0) return null;
                const isExpanded = expandedCategories.has(category);

                return (
                  <div key={category}>
                    {/* Category header — clickable to toggle expand/collapse */}
                    <button
                      className="flex items-center gap-1.5 w-full py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                      onClick={() => toggleCategory(category)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                      {CATEGORY_LABELS[category]}
                      <span className="text-muted-foreground/60 normal-case tracking-normal">
                        ({groupActions.length})
                      </span>
                    </button>

                    {/* Expanded action list */}
                    {isExpanded && (
                      <div className="ml-1 border-l border-white/10 pl-2">
                        {groupActions.map(renderActionRow)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty state when no actions match search */}
              {filteredActions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  未找到匹配的操作
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Reset all button */}
          <div className="border-t border-white/10 pt-3">
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="size-3" />
              重置所有快捷键
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="sm:max-w-[340px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>确认重置</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            确定要清除所有快捷键绑定吗？此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleResetConfirm}
            >
              确认重置
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
