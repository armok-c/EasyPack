/**
 * DiffViewDialog - Main diff comparison modal with file tabs, environment sub-tabs,
 * hunk-level operations, and status bar.
 *
 * Integrates @git-diff-view/react for visual diff rendering and adds custom
 * hunk action controls (←使用源 / 使用目标→ / 撤销) above the diff view.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { structuredPatch } from "diff";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DiffView,
  DiffModeEnum,
} from "@git-diff-view/react";
import { generateDiffFile, type DiffFile } from "@git-diff-view/file";
import { getFileLanguage } from "@/lib/diff-utils";
import type { Environment, ManagedFile } from "@/lib/types";
import {
  FileX,
  FileText,
  ChevronLeft,
  ChevronRight,
  Undo2,
  CheckCheck,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiffViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEnv: { id: string; name: string; files: ManagedFile[] };
  targetEnvs: Environment[];
  fileNames: string[];
  projectId: string;
  onUpdateFile: (
    projectId: string,
    envId: string,
    fileName: string,
    content: string,
  ) => Promise<void>;
  onAddFiles: (
    projectId: string,
    envId: string,
    files: ManagedFile[],
  ) => Promise<void>;
  onDeleteFiles: (
    projectId: string,
    envId: string,
    fileNames: string[],
  ) => Promise<void>;
}

/** Structured hunk info parsed from diff.structuredPatch */
interface HunkInfo {
  index: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** All lines in the hunk (prefixed with space/+/-) */
  lines: string[];
}

/** Diff state for one (fileName, envId) pair */
interface PairState {
  /** Whether this file exists in the target env */
  fileExists: boolean;
  /** Computed hunks (empty if file missing or identical) */
  hunks: HunkInfo[];
  /** Whether files are identical (no diff) */
  isIdentical: boolean;
  /** @git-diff-view/react DiffFile instance (null if file missing) */
  diffFile: DiffFile | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Split text content into lines, preserving empty trailing/leading lines */
function toLines(content: string): string[] {
  if (!content) return [""];
  return content.split("\n");
}

/** Join lines back into content */
function fromLines(lines: string[]): string {
  return lines.join("\n");
}

/**
 * Extract text content for a given hunk from the full source text.
 * Returns lines [oldStart - 1, oldStart - 1 + oldLines) from source content.
 */
function extractSourceHunkContent(
  sourceContent: string,
  hunk: HunkInfo,
): string {
  const lines = toLines(sourceContent);
  const start = Math.max(0, hunk.oldStart - 1);
  const end = Math.min(lines.length, start + hunk.oldLines);
  return fromLines(lines.slice(start, end));
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DiffViewDialog({
  open,
  onOpenChange,
  sourceEnv,
  targetEnvs,
  fileNames,
  projectId,
  onUpdateFile,
  onAddFiles,
  onDeleteFiles,
}: DiffViewDialogProps) {
  // Active tab state
  const [activeFileName, setActiveFileName] = useState<string>("");
  const [activeEnvId, setActiveEnvId] = useState<string>("");
  const [diffMode, setDiffMode] = useState<DiffModeEnum>(DiffModeEnum.Split);

  // Resolved hunks: key = `${fileName}::${envId}` → Set<hunkIndex>
  const [resolvedMap, setResolvedMap] = useState<
    Record<string, Set<number>>
  >({});

  // Undo snapshots: key = `${fileName}::${envId}::${hunkIndex}` → previous target content
  const [undoSnapshots, setUndoSnapshots] = useState<Record<string, string>>(
    {},
  );

  // Created file tracking: key = `${fileName}::${envId}` → boolean
  const [createdFiles, setCreatedFiles] = useState<Record<string, boolean>>(
    {},
  );

  // Loading state for file creation
  const [creatingFiles, setCreatingFiles] = useState<Record<string, boolean>>(
    {},
  );

  // Cached diff data: key = `${fileName}::${envId}` → PairState
  const diffCacheRef = useRef<Record<string, PairState>>({});

  // Get current target env
  const currentTargetEnv = useMemo(
    () => targetEnvs.find((e) => e.id === activeEnvId) ?? null,
    [targetEnvs, activeEnvId],
  );

  // Get current pair key
  const pairKey = useMemo(
    () => `${activeFileName}::${activeEnvId}`,
    [activeFileName, activeEnvId],
  );

  // Compute pair state for current selection
  const currentPairState = useMemo((): PairState | null => {
    if (!activeFileName || !activeEnvId) return null;
    const cached = diffCacheRef.current[pairKey];
    if (cached) return cached;

    const targetEnv = targetEnvs.find((e) => e.id === activeEnvId);
    if (!targetEnv) return null;

    const sourceFile = sourceEnv.files.find((f) => f.name === activeFileName);
    const sourceContent = sourceFile?.content ?? "";
    const targetFile = targetEnv.files.find(
      (f) => f.name === activeFileName,
    );

    if (!targetFile) {
      // File missing in target env
      const state: PairState = {
        fileExists: false,
        hunks: [],
        isIdentical: false,
        diffFile: null,
      };
      diffCacheRef.current[pairKey] = state;
      return state;
    }

    const targetContent = targetFile.content;

    if (sourceContent === targetContent) {
      const state: PairState = {
        fileExists: true,
        hunks: [],
        isIdentical: true,
        diffFile: null,
      };
      diffCacheRef.current[pairKey] = state;
      return state;
    }

    const lang = getFileLanguage(activeFileName);

    // Compute structured diff hunks
    const patch = structuredPatch(
      activeFileName,
      activeFileName,
      sourceContent,
      targetContent,
    );
    const hunks: HunkInfo[] = patch.hunks.map((h, idx) => ({
      index: idx,
      oldStart: h.oldStart,
      oldLines: h.oldLines,
      newStart: h.newStart,
      newLines: h.newLines,
      lines: h.lines,
    }));

    // Build DiffFile for visual rendering
    try {
      const diffFile = generateDiffFile(
        activeFileName,
        sourceContent,
        activeFileName,
        targetContent,
        lang,
        lang,
      );
      diffFile.initTheme("dark");
      diffFile.init();
      try {
        diffFile.buildSplitDiffLines();
        diffFile.buildUnifiedDiffLines();
      } catch {
        // Safe to ignore — DiffView handles missing build lines
      }

      const state: PairState = {
        fileExists: true,
        hunks,
        isIdentical: false,
        diffFile,
      };
      diffCacheRef.current[pairKey] = state;
      return state;
    } catch {
      // Fallback: just mark as diff exists
      const state: PairState = {
        fileExists: true,
        hunks,
        isIdentical: false,
        diffFile: null,
      };
      diffCacheRef.current[pairKey] = state;
      return state;
    }
  }, [activeFileName, activeEnvId, sourceEnv, targetEnvs, pairKey]);

  // Initialize first file+env on open
  useEffect(() => {
    if (open && fileNames.length > 0 && targetEnvs.length > 0) {
      setActiveFileName(fileNames[0]);
      setActiveEnvId(targetEnvs[0].id);
    }
  }, [open, fileNames, targetEnvs]);

  // Clear cache when dialog opens
  useEffect(() => {
    if (open) {
      diffCacheRef.current = {};
    }
  }, [open]);

  // ---- Handlers ----

  // Toggle diff mode
  const handleToggleMode = useCallback(() => {
    setDiffMode((prev) =>
      prev === DiffModeEnum.Split ? DiffModeEnum.Unified : DiffModeEnum.Split,
    );
  }, []);

  // Apply source hunk to target (←使用源)
  const handleApplySource = useCallback(
    async (hunkIndex: number) => {
      if (!currentPairState || !currentTargetEnv) return;
      const { hunks } = currentPairState;
      const hunk = hunks[hunkIndex];
      if (!hunk) return;

      const targetFile = currentTargetEnv.files.find(
        (f) => f.name === activeFileName,
      );
      if (!targetFile) return;

      const sourceFile = sourceEnv.files.find(
        (f) => f.name === activeFileName,
      );
      if (!sourceFile) return;

      // Extract source hunk content and replace corresponding target region
      const sourceLines = toLines(sourceFile.content);
      const targetLines = toLines(targetFile.content);

      const srcStart = Math.max(0, hunk.oldStart - 1);
      const srcEnd = Math.min(sourceLines.length, srcStart + hunk.oldLines);
      const srcHunkLines = sourceLines.slice(srcStart, srcEnd);

      const tgtStart = Math.max(0, hunk.newStart - 1);
      const tgtEnd = Math.min(targetLines.length, tgtStart + hunk.newLines);

      // Save snapshot for undo
      const snapshotKey = `${pairKey}::${hunkIndex}`;
      const prevContent = targetFile.content;

      // Build new content
      const newLines = [
        ...targetLines.slice(0, tgtStart),
        ...srcHunkLines,
        ...targetLines.slice(tgtEnd),
      ];
      const newContent = fromLines(newLines);

      // Store undo snapshot
      setUndoSnapshots((prev) => ({ ...prev, [snapshotKey]: prevContent }));

      // Write to profileStore
      try {
        await onUpdateFile(projectId, currentTargetEnv.id, activeFileName, newContent);
        // Mark hunk as resolved
        setResolvedMap((prev) => {
          const key = pairKey;
          const existing = prev[key] ?? new Set();
          const updated = new Set(existing);
          updated.add(hunkIndex);
          return { ...prev, [key]: updated };
        });
        // Invalidate cache
        delete diffCacheRef.current[pairKey];

        toast.success("已应用源变更 (可撤销)");
      } catch (error) {
        toast.error("应用变更失败");
        if (import.meta.env.DEV) console.error("Apply source hunk failed:", error);
      }
    },
    [
      currentPairState,
      currentTargetEnv,
      activeFileName,
      sourceEnv,
      projectId,
      onUpdateFile,
      pairKey,
    ],
  );

  // Accept target (使用目标→) — just mark resolved
  const handleAcceptTarget = useCallback(
    (hunkIndex: number) => {
      const key = pairKey;
      setResolvedMap((prev) => {
        const existing = prev[key] ?? new Set();
        const updated = new Set(existing);
        updated.add(hunkIndex);
        return { ...prev, [key]: updated };
      });
      toast.success("已确认目标内容");
    },
    [pairKey],
  );

  // Undo a previously applied hunk
  const handleUndo = useCallback(
    async (hunkIndex: number) => {
      const snapshotKey = `${pairKey}::${hunkIndex}`;
      const prevContent = undoSnapshots[snapshotKey];
      if (!prevContent || !currentTargetEnv) return;

      try {
        await onUpdateFile(projectId, currentTargetEnv.id, activeFileName, prevContent);

        // Remove undo snapshot
        setUndoSnapshots((prev) => {
          const updated = { ...prev };
          delete updated[snapshotKey];
          return updated;
        });

        // Mark as unresolved
        setResolvedMap((prev) => {
          const key = pairKey;
          const existing = prev[key] ?? new Set();
          const updated = new Set(existing);
          updated.delete(hunkIndex);
          // Clean up empty sets
          if (updated.size === 0) {
            const rest = { ...prev };
            delete rest[key];
            return rest;
          }
          return { ...prev, [key]: updated };
        });

        // Invalidate cache
        delete diffCacheRef.current[pairKey];

        toast.success("已撤销变更");
      } catch (error) {
        toast.error("撤销失败");
        if (import.meta.env.DEV) console.error("Undo failed:", error);
      }
    },
    [undoSnapshots, currentTargetEnv, projectId, activeFileName, onUpdateFile, pairKey],
  );

  // Create missing file in target env
  const handleCreateFile = useCallback(async () => {
    if (!currentTargetEnv || !activeFileName) return;
    const createKey = `${activeFileName}::${currentTargetEnv.id}`;
    if (creatingFiles[createKey]) return;

    setCreatingFiles((prev) => ({ ...prev, [createKey]: true }));

    const sourceFile = sourceEnv.files.find((f) => f.name === activeFileName);
    const sourceContent = sourceFile?.content ?? "";

    try {
      const newFile: ManagedFile = {
        name: activeFileName,
        content: sourceContent,
        addedAt: Date.now(),
      };

      await onAddFiles(projectId, currentTargetEnv.id, [newFile]);

      setCreatedFiles((prev) => ({ ...prev, [createKey]: true }));
      delete diffCacheRef.current[pairKey];

      toast.success(`已在 ${currentTargetEnv.name} 中创建 ${activeFileName}`);
    } catch (error) {
      toast.error("创建文件失败");
      if (import.meta.env.DEV) console.error("Create file failed:", error);
    } finally {
      setCreatingFiles((prev) => ({ ...prev, [createKey]: false }));
    }
  }, [
    currentTargetEnv,
    activeFileName,
    creatingFiles,
    sourceEnv,
    projectId,
    onAddFiles,
    pairKey,
  ]);

  // Undo file creation (delete the created file)
  const handleUndoCreate = useCallback(async () => {
    if (!currentTargetEnv || !activeFileName) return;
    try {
      await onDeleteFiles(projectId, currentTargetEnv.id, [activeFileName]);
      const createKey = `${activeFileName}::${currentTargetEnv.id}`;
      setCreatedFiles((prev) => {
        const updated = { ...prev };
        delete updated[createKey];
        return updated;
      });
      delete diffCacheRef.current[pairKey];
      toast.success("已撤销创建");
    } catch (error) {
      toast.error("撤销创建失败");
      if (import.meta.env.DEV) console.error("Undo create failed:", error);
    }
  }, [currentTargetEnv, activeFileName, projectId, onDeleteFiles, pairKey]);

  // ---- Computed values ----

  const resolvedSet = useMemo(
    () => resolvedMap[pairKey] ?? new Set<number>(),
    [resolvedMap, pairKey],
  );

  const totalHunks = currentPairState?.hunks.length ?? 0;
  const resolvedCount = resolvedSet.size;
  const unresolvedCount = totalHunks - resolvedCount;
  const allResolved = totalHunks > 0 && resolvedCount === totalHunks;

  const isFileMissing =
    currentPairState !== null && !currentPairState.fileExists;

  const isIdentical = currentPairState?.isIdentical ?? false;

  const missingCreateKey =
    activeFileName && currentTargetEnv
      ? `${activeFileName}::${currentTargetEnv.id}`
      : "";
  const wasFileCreated = createdFiles[missingCreateKey] ?? false;

  // Only show reset/close if there are no changes
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // ---- Render helpers ----

  const renderHunkControls = () => {
    if (!currentPairState || totalHunks === 0) return null;

    return (
      <div className="space-y-1 px-1 pb-2">
        {currentPairState.hunks.map((hunk, idx) => {
          const isResolved = resolvedSet.has(idx);
          const snapshotKey = `${pairKey}::${idx}`;
          const hasUndo = undoSnapshots[snapshotKey] !== undefined;

          return (
            <div
              key={idx}
              className={`
                flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs border
                ${isResolved ? "bg-green-500/10 border-green-500/30" : "bg-card border-border"}
              `}
            >
              {/* Hunk header info */}
              <span className="text-muted-foreground font-mono text-[11px] truncate flex-1">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},
                {hunk.newLines} @@
              </span>

              {/* Action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isResolved ? (
                  <>
                    {hasUndo && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] px-1.5"
                        onClick={() => handleUndo(idx)}
                        title="撤销此 hunk 的变更"
                      >
                        <Undo2 className="size-3 mr-0.5" />
                        撤销
                      </Button>
                    )}
                    <span className="text-green-400 text-[11px] flex items-center gap-0.5">
                      <CheckCheck className="size-3" />
                      已解决
                    </span>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-1.5"
                      onClick={() => handleApplySource(idx)}
                      title="使用源环境内容替换此 hunk"
                    >
                      <ChevronLeft className="size-3 mr-0.5" />
                      使用源
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-1.5"
                      onClick={() => handleAcceptTarget(idx)}
                      title="保留目标环境内容并标记已解决"
                    >
                      使用目标
                      <ChevronRight className="size-3 ml-0.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDiffContent = () => {
    if (!currentPairState) {
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          选择文件和环境以查看差异
        </div>
      );
    }

    // Missing file
    if (isFileMissing) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-md mx-1 mb-1">
          <FileX className="size-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            此文件在目标环境中不存在
          </p>
          {wasFileCreated ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndoCreate}
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
              onClick={handleCreateFile}
              disabled={creatingFiles[missingCreateKey]}
            >
              {creatingFiles[missingCreateKey] ? "创建中..." : "创建此文件"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            将从源环境复制内容到目标环境
          </p>
        </div>
      );
    }

    // Identical files
    if (isIdentical) {
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          文件内容相同，无差异
        </div>
      );
    }

    // Normal diff view
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Hunk controls above the diff view */}
        {renderHunkControls()}

        {/* DiffView component */}
        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border mx-1 mb-1">
          {currentPairState.diffFile ? (
            <DiffView
              diffFile={currentPairState.diffFile}
              diffViewMode={diffMode}
              diffViewTheme="dark"
              diffViewHighlight={true}
              diffViewFontSize={12}
              diffViewWrap={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              差异数据加载失败
            </div>
          )}
        </div>
      </div>
    );
  };

  // Build dynamic title per D-18
  const dialogTitle = useMemo(() => {
    if (!activeFileName) return "差异对比";
    const targetEnvName = currentTargetEnv?.name ?? "";
    return `差异对比 — ${activeFileName} (${sourceEnv.name} → ${targetEnvName})`;
  }, [activeFileName, currentTargetEnv, sourceEnv.name]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[80vw] max-h-[80vh] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
          }
        }}
      >
        {/* Title area per D-18, D-19 */}
        <DialogHeader className="px-6 pt-4 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base truncate">
              {dialogTitle}
            </DialogTitle>
            {/* Split/Unified toggle */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-4">
              <Button
                variant={diffMode === DiffModeEnum.Split ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setDiffMode(DiffModeEnum.Split)}
              >
                Split
              </Button>
              <Button
                variant={diffMode === DiffModeEnum.Unified ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setDiffMode(DiffModeEnum.Unified)}
              >
                Unified
              </Button>
            </div>
          </div>
          {/* Subtitle per D-19 */}
          {activeFileName && currentTargetEnv && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {sourceEnv.name} → {currentTargetEnv.name}
            </p>
          )}
        </DialogHeader>

        {/* File tabs (top level) per D-12 */}
        {fileNames.length > 0 && (
          <div className="px-6 pt-3 flex-shrink-0">
            <Tabs
              value={activeFileName}
              onValueChange={(val) => {
                setActiveFileName(val);
                // Reset env tab to first env
                if (targetEnvs.length > 0) {
                  setActiveEnvId(targetEnvs[0].id);
                }
              }}
            >
              <TabsList className="w-full justify-start overflow-x-auto scrollbar-none h-auto p-0 bg-transparent">
                {fileNames.map((fname) => {
                  const targetEnv = targetEnvs.find((e) => e.id === activeEnvId);
                  const env = targetEnv || targetEnvs[0];
                  const fileMissing =
                    env && !env.files.some((ff) => ff.name === fname);
                  return (
                    <TabsTrigger
                      key={fname}
                      value={fname}
                      className="text-xs data-[state=active]:bg-accent data-[state=active]:shadow-none px-3 py-1.5 mr-0.5"
                    >
                      <span className="flex items-center gap-1">
                        {fileMissing ? (
                          <FileX className="size-3 text-muted-foreground" />
                        ) : (
                          <FileText className="size-3 text-muted-foreground" />
                        )}
                        <span className="truncate max-w-[120px]">
                          {fname.split(/[\\/]/).pop() || fname}
                        </span>
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Environment sub-tabs per file per D-12 */}
        {targetEnvs.length > 1 && (
          <div className="px-6 pt-2 flex-shrink-0">
            <Tabs
              value={activeEnvId}
              onValueChange={setActiveEnvId}
            >
              <TabsList className="w-full justify-start overflow-x-auto scrollbar-none h-auto p-0 bg-transparent">
                {targetEnvs.map((env) => (
                  <TabsTrigger
                    key={env.id}
                    value={env.id}
                    className="text-xs data-[state=active]:bg-accent data-[state=active]:shadow-none px-2.5 py-1 mr-0.5"
                  >
                    <span className="truncate max-w-[100px]">{env.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Diff content area (flex-1) */}
        <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-0 overflow-hidden">
          {renderDiffContent()}
        </div>

        {/* Status bar per D-27 */}
        <div className="flex items-center justify-between h-9 px-6 border-t border-border flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {totalHunks > 0
              ? `已解决: ${resolvedCount} / 未解决: ${unresolvedCount}`
              : isFileMissing
                ? "文件缺失"
                : isIdentical
                  ? "无差异"
                  : "差异对比"}
          </span>
          {allResolved && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCheck className="size-3" />
              全部已解决
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
