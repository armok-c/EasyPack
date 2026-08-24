/**
 * FileEditorDialog - CodeMirror 6 file editor modal dialog for viewing and editing managed files.
 *
 * Features:
 * - Large dialog (80% viewport) per D-15
 * - Syntax highlighting via getLanguageExtension() per D-10
 * - Lint support via getLinterExtensions() per D-11
 * - Unsaved changes indicator and save prompt per D-18/D-19/D-20
 * - Ctrl+S save shortcut per D-18
 * - Bottom status bar with file info and save button per D-13
 */
import { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCodeMirror } from "@/hooks/useCodeMirror";
import {
  getLanguageExtension,
  getLinterExtensions,
  formatRelativeTime,
} from "@/lib/file-lang";
import type { ManagedFile } from "@/lib/types";
import type { Extension } from "@codemirror/state";

export interface FileEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: ManagedFile | null;
  onSave: (fileName: string, content: string) => Promise<void>;
}

/** Prompt type for unsaved changes dialog */
type UnsavedPromptType = "close" | "switch" | "leave" | null;

export interface FileEditorDialogHandle {
  requestLeave: (options?: {
    onInteractionNeeded?: () => void | Promise<void>;
  }) => Promise<boolean>;
}

export const FileEditorDialog = forwardRef<FileEditorDialogHandle, FileEditorDialogProps>(function FileEditorDialog({
  open,
  onOpenChange,
  file,
  onSave,
}: FileEditorDialogProps, ref) {
  const [editingContent, setEditingContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [pendingSwitchFile, setPendingSwitchFile] = useState<ManagedFile | null>(null);
  const [unsavedPromptType, setUnsavedPromptType] = useState<UnsavedPromptType>(null);
  const [saving, setSaving] = useState(false);
  const leaveResolverRef = useRef<((allowed: boolean) => void) | null>(null);
  const leavePromiseRef = useRef<Promise<boolean> | null>(null);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const latestFileRef = useRef<ManagedFile | null>(null);

  // Compute extensions based on current file
  const getExtensions = useCallback((fileName: string): Extension[] => {
    return [...getLanguageExtension(fileName), ...getLinterExtensions(fileName)];
  }, []);

  const [extensions, setExtensions] = useState<Extension[]>([]);

  // Initialize/reset state when file changes
  useEffect(() => {
    if (file) {
      if (isDirty && latestFileRef.current && latestFileRef.current.name !== file.name) {
        // D-20: unsaved changes + different file → show save prompt
        setPendingSwitchFile(file);
        setUnsavedPromptType("switch");
      } else {
        setEditingContent(file.content);
        setIsDirty(false);
        setExtensions(getExtensions(file.name));
        latestFileRef.current = file;
      }
    } else {
      // Dialog closing - reset state
      setEditingContent("");
      setIsDirty(false);
      setPendingSwitchFile(null);
      setUnsavedPromptType(null);
      latestFileRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.name, file?.content]);

  // Handle editor content changes
  const handleChange = useCallback((value: string) => {
    setEditingContent(value);
    setIsDirty(true);
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!file || saving) return;
    setSaving(true);
    try {
      await onSave(file.name, editingContent);
      setIsDirty(false);
      toast.success("已保存");
    } catch (error) {
      toast.error("保存失败");
      if (import.meta.env.DEV) console.error("保存失败:", error);
    } finally {
      setSaving(false);
    }
  }, [file, editingContent, saving, onSave]);

  // Handle close with unsaved check
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isDirty) {
        // A project/tab leave prompt owns the dialog until it resolves.
        // Otherwise an outside click could replace it with a close prompt and
        // discard the draft before the user chooses "取消".
        if (unsavedPromptType === "leave") return;
        // D-18: Escape with dirty → show save prompt
        setUnsavedPromptType("close");
        return; // Don't close - prompt first
      }
      onOpenChange(open);
    },
    [isDirty, onOpenChange, unsavedPromptType]
  );

  // Handle save prompt: save then proceed
  const handlePromptSave = useCallback(async () => {
    if (!file) return;
    setSaving(true);
    let saved = false;
    try {
      await onSave(file.name, editingContent);
      setIsDirty(false);
      saved = true;

      if (unsavedPromptType === "close") {
        onOpenChange(false);
      } else if (unsavedPromptType === "switch" && pendingSwitchFile) {
        // Switch to pending file
        setEditingContent(pendingSwitchFile.content);
        setIsDirty(false);
        setExtensions(getExtensions(pendingSwitchFile.name));
        latestFileRef.current = pendingSwitchFile;
        setPendingSwitchFile(null);
      } else if (unsavedPromptType === "leave") {
        onOpenChange(false);
        leaveResolverRef.current?.(true);
        leaveResolverRef.current = null;
        leavePromiseRef.current = null;
      }
    } catch (error) {
      toast.error("保存失败");
      if (import.meta.env.DEV) console.error("保存失败:", error);
    } finally {
      setSaving(false);
      if (saved) setUnsavedPromptType(null);
    }
  }, [file, editingContent, onSave, unsavedPromptType, pendingSwitchFile, onOpenChange, getExtensions]);

  // Handle save prompt: discard changes
  const handlePromptDiscard = useCallback(() => {
    if (unsavedPromptType === "close") {
      setIsDirty(false);
      onOpenChange(false);
    } else if (unsavedPromptType === "switch" && pendingSwitchFile) {
      // Discard and switch to pending file
      setEditingContent(pendingSwitchFile.content);
      setIsDirty(false);
      setExtensions(getExtensions(pendingSwitchFile.name));
      latestFileRef.current = pendingSwitchFile;
      setPendingSwitchFile(null);
    } else if (unsavedPromptType === "leave") {
      setIsDirty(false);
      onOpenChange(false);
      leaveResolverRef.current?.(true);
      leaveResolverRef.current = null;
      leavePromiseRef.current = null;
    }
    setUnsavedPromptType(null);
  }, [unsavedPromptType, pendingSwitchFile, onOpenChange, getExtensions]);

  // Handle save prompt: cancel (stay on current file)
  const handlePromptCancel = useCallback(() => {
    setPendingSwitchFile(null);
    if (unsavedPromptType === "leave") {
      leaveResolverRef.current?.(false);
      leaveResolverRef.current = null;
      leavePromiseRef.current = null;
    }
    setUnsavedPromptType(null);
  }, [unsavedPromptType]);

  useImperativeHandle(ref, () => ({
    requestLeave: async (options) => {
      if (!open || !file || !isDirty) return Promise.resolve(true);
      if (leavePromiseRef.current) return leavePromiseRef.current;
      await options?.onInteractionNeeded?.();
      const promise = new Promise<boolean>((resolve) => {
        leaveResolverRef.current = resolve;
        setUnsavedPromptType("leave");
      });
      leavePromiseRef.current = promise;
      return promise;
    },
  }), [open, file, isDirty, ref]);

  useEffect(() => () => {
    const resolver = leaveResolverRef.current;
    leaveResolverRef.current = null;
    leavePromiseRef.current = null;
    resolver?.(false);
  }, []);

  // Ctrl+S / Cmd+S keyboard shortcut per D-18
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  // useCodeMirror hook - stable options
  useCodeMirror(parentRef, {
    value: editingContent,
    onChange: handleChange,
    darkMode: true,
    extensions,
  });

  // Update `key` on parentRef div to force re-mount when extensions change
  const editorKey = file ? `${file.name}-${extensions.length}` : "no-file";

  if (!file) return null;

  // Compute error count from lint diagnostics (via status bar only - not ideal but practical)
  // The actual error count is computed by CodeMirror lint gutter; we use a simpler approach
  // by displaying what we can derive from the file extension

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[80vw] max-h-[80vh] h-[80vh] flex flex-col"
          onKeyDown={handleKeyDown}
        >
          {/* Title bar per D-19 */}
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              {/* Unsaved indicator per D-19 */}
              {isDirty && (
                <span className="size-2 rounded-full bg-orange-400 flex-shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(file.addedAt)}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Editor area per D-14 */}
          <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-border">
            <div
              key={editorKey}
              ref={parentRef}
              className="h-full"
            />
          </div>

          {/* Bottom status bar per D-13 */}
          <div className="flex items-center justify-between h-9 border-t border-border mt-auto flex-shrink-0">
            <span className="text-xs text-muted-foreground truncate">
              {file.name}
              <span className="mx-1">·</span>
              {formatRelativeTime(file.addedAt)}
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes prompt per D-20 */}
      {unsavedPromptType && (
        <AlertDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) handlePromptCancel();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>文件未保存</AlertDialogTitle>
              <AlertDialogDescription>
                当前文件有未保存的修改，是否先保存？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handlePromptCancel}>
                取消
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => { event.preventDefault(); handlePromptDiscard(); }}
              >
                放弃
              </AlertDialogAction>
              <AlertDialogAction onClick={(event) => { event.preventDefault(); void handlePromptSave(); }}>
                保存
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
});
