import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildEnvironmentDiff, type EnvironmentDiffGap, type EnvironmentDiffModel, type EnvironmentDiffRow } from "@/lib/environment-diff";
import type {
  EnvironmentDetailResponse,
} from "@/lib/environment-types";

import "./environment-diff.css";

export interface EnvironmentDiffDialogProps {
  open: boolean;
  environmentName: string;
  environmentId: string;
  paths: string[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDetail?: (environmentId: string, path: string) => Promise<EnvironmentDetailResponse>;
  onOpenCurrentFile?: (environmentId: string, path: string) => Promise<void>;
}

type GapExpansion = { up: number; down: number };
type GapExpansionState = Record<number, GapExpansion>;

const EXPANSION_STEP = 10;

type GapPosition = "head" | "middle" | "tail";

function DiffStats({ model }: { model: EnvironmentDiffModel }) {
  const additions = model.additions === null ? "不可用" : `+${model.additions}`;
  const deletions = model.deletions === null ? "不可用" : `-${model.deletions}`;

  return (
    <span data-testid="environment-diff-stats" className="shrink-0 font-mono text-xs" aria-label={`差异统计 ${additions}/${deletions}`}>
      {additions}/{deletions}
    </span>
  );
}

function lineKey(row: EnvironmentDiffRow, index: number): string {
  return `${index}-${row.kind}-${row.oldLineNumber ?? ""}-${row.newLineNumber ?? ""}`;
}

function lineNumberColumnStyle(rows: EnvironmentDiffRow[]): React.CSSProperties {
  let oldDigits = 2;
  let newDigits = 2;
  for (const row of rows) {
    if (row.oldLineNumber !== null) oldDigits = Math.max(oldDigits, String(row.oldLineNumber).length);
    if (row.newLineNumber !== null) newDigits = Math.max(newDigits, String(row.newLineNumber).length);
  }
  return {
    "--environment-diff-old-line-number-column-width": `calc(${oldDigits}ch + 4px)`,
    "--environment-diff-new-line-number-column-width": `calc(${newDigits}ch + 4px)`,
  } as React.CSSProperties;
}

function DiffLine({ row, index }: { row: EnvironmentDiffRow; index: number }) {
  const operator = row.kind === "addition" ? "+" : row.kind === "deletion" ? "-" : " ";
  return (
    <tr data-state="line" data-kind={row.kind} className={`environment-diff-line environment-diff-line-${row.kind}`}>
      <td data-line-old-num={row.oldLineNumber ?? undefined} className="environment-diff-old-line-num sticky align-top">
        {row.oldLineNumber ?? ""}
      </td>
      <td data-line-new-num={row.newLineNumber ?? undefined} className="environment-diff-new-line-num sticky align-top">
        {row.newLineNumber ?? ""}
      </td>
      <td className="environment-diff-line-content align-top">
        <span data-operator={operator} className="environment-diff-operator select-none">{operator}</span>
        {row.segments.map((segment, segmentIndex) => (
          <span key={`${lineKey(row, index)}-${segmentIndex}`} data-diff-highlight={segment.changed ? "true" : undefined} className={segment.changed ? "environment-diff-inline-change" : undefined}>
            {segment.text}
          </span>
        ))}
        {row.noNewline && <span className="environment-diff-no-newline" aria-label="文件末尾没有换行">↵</span>}
      </td>
    </tr>
  );
}

function visibleGapRows(gap: EnvironmentDiffGap, expansion: GapExpansion, position: GapPosition) {
  if (position === "head") {
    const up = Math.min(expansion.up, gap.rows.length);
    return {
      beforeRows: [],
      afterRows: gap.rows.slice(gap.rows.length - up),
      hidden: gap.rows.length - up,
    };
  }

  if (position === "tail") {
    const down = Math.min(expansion.down, gap.rows.length);
    return {
      beforeRows: gap.rows.slice(0, down),
      afterRows: [],
      hidden: gap.rows.length - down,
    };
  }

  const up = Math.min(expansion.up, gap.rows.length);
  const down = Math.min(expansion.down, Math.max(0, gap.rows.length - up));
  return {
    beforeRows: gap.rows.slice(0, down),
    afterRows: gap.rows.slice(gap.rows.length - up),
    hidden: gap.rows.length - up - down,
  };
}

function gapPosition(gap: EnvironmentDiffGap, gapCount: number): GapPosition {
  if (gap.index === 0) return "head";
  if (gap.index === gapCount - 1) return "tail";
  return "middle";
}

function hunkHeaderText(
  hunk: EnvironmentDiffModel["hunks"][number],
  prefixLength: number,
  suffixLength: number,
): string {
  const oldLines = hunk.oldLines + prefixLength + suffixLength;
  const newLines = hunk.newLines + prefixLength + suffixLength;
  const oldStart = oldLines === 0 ? hunk.oldStart - 1 : hunk.oldStart - prefixLength;
  const newStart = newLines === 0 ? hunk.newStart - 1 : hunk.newStart - prefixLength;
  return `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`;
}

function hunkBoundaryLengths(
  model: EnvironmentDiffModel,
  hunkIndex: number,
  gapExpansion: GapExpansionState,
): { prefixLength: number; suffixLength: number } {
  const precedingGap = model.gaps[hunkIndex];
  const preceding = visibleGapRows(
    precedingGap,
    gapExpansion[precedingGap.index] ?? { up: 0, down: 0 },
    gapPosition(precedingGap, model.gaps.length),
  );
  const followingGap = model.gaps[hunkIndex + 1];
  const following = followingGap
    ? visibleGapRows(
      followingGap,
      gapExpansion[followingGap.index] ?? { up: 0, down: 0 },
      gapPosition(followingGap, model.gaps.length),
    )
    : { beforeRows: [], afterRows: [], hidden: 0 };
  return {
    prefixLength: preceding.afterRows.length,
    suffixLength: following.beforeRows.length,
  };
}

function GapMarker({
  gap,
  expansion,
  position,
  onExpand,
}: {
  gap: EnvironmentDiffGap;
  expansion: GapExpansion;
  position: GapPosition;
  onExpand: (direction: "up" | "down") => void;
}) {
  const { hidden } = visibleGapRows(gap, expansion, position);
  if (hidden <= 0) return null;
  const allowUp = position !== "tail";
  const allowDown = position !== "head";

  return (
    <span data-state="gap" data-gap-index={gap.index} className="environment-diff-gap-marker">
      {allowUp && (
        <Button type="button" variant="ghost" size="icon" data-gap-direction="up" aria-label="向上展开10行" onClick={() => onExpand("up")}>
          <ChevronUp />
        </Button>
      )}
      {allowDown && (
        <Button type="button" variant="ghost" size="icon" data-gap-direction="down" aria-label="向下展开10行" onClick={() => onExpand("down")}>
          <ChevronDown />
        </Button>
      )}
    </span>
  );
}

function GapMarkerRow({
  gap,
  expansion,
  position,
  onExpand,
}: {
  gap: EnvironmentDiffGap;
  expansion: GapExpansion;
  position: GapPosition;
  onExpand: (direction: "up" | "down") => void;
}) {
  if (visibleGapRows(gap, expansion, position).hidden <= 0) return null;
  const marker = <GapMarker gap={gap} expansion={expansion} position={position} onExpand={onExpand} />;

  return (
    <tr data-state="gap-row" data-gap-index={gap.index}>
      <td colSpan={2} className="environment-diff-gap-cell environment-diff-gap-controls">
        <div className="environment-diff-gap-actions">{marker}</div>
      </td>
      <td className="environment-diff-gap-cell" aria-hidden="true" />
    </tr>
  );
}

function HunkHeader({
  hunk,
  precedingGap,
  precedingExpansion,
  precedingPosition,
  prefixLength,
  suffixLength,
  onExpand,
}: {
  hunk: EnvironmentDiffModel["hunks"][number];
  precedingGap: EnvironmentDiffGap;
  precedingExpansion: GapExpansion;
  precedingPosition: GapPosition;
  prefixLength: number;
  suffixLength: number;
  onExpand: (direction: "up" | "down") => void;
}) {
  return (
    <tr data-testid="environment-diff-hunk-header" data-hunk-index={hunk.index} data-state="hunk">
      <td colSpan={2} className="environment-diff-hunk-header environment-diff-hunk-header-controls">
        <GapMarker gap={precedingGap} expansion={precedingExpansion} position={precedingPosition} onExpand={onExpand} />
      </td>
      <td className="environment-diff-hunk-header">
        <div className="environment-diff-hunk-header-content min-w-0 overflow-hidden">
          <span data-testid="environment-diff-hunk-header-range" className="environment-diff-hunk-header-range shrink-0 whitespace-nowrap">
            {hunkHeaderText(hunk, prefixLength, suffixLength)}
          </span>
          {hunk.context && <>
            {" "}
            <span data-testid="environment-diff-hunk-header-context" className="environment-diff-hunk-header-context min-w-0 flex-1 truncate">{hunk.context}</span>
          </>}
        </div>
      </td>
    </tr>
  );
}

function fullHunkHeaderText(model: EnvironmentDiffModel): string {
  const oldRows = model.rows.filter((row) => row.oldLineNumber !== null);
  const newRows = model.rows.filter((row) => row.newLineNumber !== null);
  const oldStart = oldRows[0]?.oldLineNumber ?? 0;
  const newStart = newRows[0]?.newLineNumber ?? 0;
  return `@@ -${oldStart},${oldRows.length} +${newStart},${newRows.length} @@`;
}

function FullHunkHeader({ model }: { model: EnvironmentDiffModel }) {
  return (
    <tr data-testid="environment-diff-hunk-header" data-hunk-index="full" data-state="hunk">
      <td colSpan={2} className="environment-diff-hunk-header environment-diff-hunk-header-controls" />
      <td className="environment-diff-hunk-header">
        <div className="environment-diff-hunk-header-content min-w-0 overflow-hidden">
          <span data-testid="environment-diff-hunk-header-range" className="environment-diff-hunk-header-range shrink-0 whitespace-nowrap">
            {fullHunkHeaderText(model)}
          </span>
        </div>
      </td>
    </tr>
  );
}

function allGapsExpanded(model: EnvironmentDiffModel, gapExpansion: GapExpansionState): boolean {
  return model.gaps.every((gap) => gap.rows.length === 0 || visibleGapRows(
    gap,
    gapExpansion[gap.index] ?? { up: 0, down: 0 },
    gapPosition(gap, model.gaps.length),
  ).hidden === 0);
}

function UnifiedDiff({
  model,
  gapExpansion,
  onExpandGap,
  tableWrapperRef,
}: {
  model: EnvironmentDiffModel;
  gapExpansion: GapExpansionState;
  onExpandGap: (gap: EnvironmentDiffGap, direction: "up" | "down") => void;
  tableWrapperRef: { current: HTMLDivElement | null };
}) {
  const tableStyle = useMemo(() => lineNumberColumnStyle(model.rows), [model.rows]);
  if (!model.hasContentChange || model.hunks.length === 0) return null;
  const hasExpandableRows = model.gaps.some((gap) => gap.rows.length > 0);
  const fullyExpanded = hasExpandableRows && allGapsExpanded(model, gapExpansion);

  return (
    <div data-testid="environment-diff-view" className="environment-diff-view min-w-0 flex-1">
      <div className="environment-diff-code">
        <div ref={tableWrapperRef} className="environment-diff-table-wrapper">
          <table className="environment-diff-table" style={tableStyle}>
            <thead className="sr-only">
              <tr><th scope="col">旧行号</th><th scope="col">新行号</th><th scope="col">差异内容</th></tr>
            </thead>
            <tbody>
              {fullyExpanded ? (
                <>
                  <FullHunkHeader model={model} />
                  {model.rows.map((row, index) => <DiffLine key={lineKey(row, index)} row={row} index={index} />)}
                </>
              ) : model.hunks.map((hunk, hunkIndex) => {
                const precedingGap = model.gaps[hunkIndex];
                const precedingExpansion = gapExpansion[precedingGap.index] ?? { up: 0, down: 0 };
                const preceding = visibleGapRows(
                  precedingGap,
                  precedingExpansion,
                  gapPosition(precedingGap, model.gaps.length),
                );
                const followingGap = model.gaps[hunkIndex + 1];
                const followingExpansion = followingGap
                  ? gapExpansion[followingGap.index] ?? { up: 0, down: 0 }
                  : { up: 0, down: 0 };
                const following = followingGap
                  ? visibleGapRows(followingGap, followingExpansion, gapPosition(followingGap, model.gaps.length))
                  : { beforeRows: [], afterRows: [], hidden: 0 };
                const { prefixLength, suffixLength } = hunkBoundaryLengths(model, hunkIndex, gapExpansion);
                return (
                  <Fragment key={`hunk-group-${hunk.index}`}>
                    <HunkHeader
                      hunk={hunk}
                      precedingGap={precedingGap}
                      precedingExpansion={precedingExpansion}
                      precedingPosition={gapPosition(precedingGap, model.gaps.length)}
                      prefixLength={prefixLength}
                      suffixLength={suffixLength}
                      onExpand={(direction) => onExpandGap(precedingGap, direction)}
                    />
                    {preceding.afterRows.map((row, index) => <DiffLine key={lineKey(row, index)} row={row} index={index} />)}
                    {hunk.rows.map((row, index) => <DiffLine key={lineKey(row, preceding.afterRows.length + index)} row={row} index={preceding.afterRows.length + index} />)}
                    {following.beforeRows.map((row, index) => <DiffLine key={lineKey(row, hunk.rows.length + index)} row={row} index={hunk.rows.length + index} />)}
                    {followingGap && gapPosition(followingGap, model.gaps.length) === "tail" && (
                      <GapMarkerRow
                        gap={followingGap}
                        expansion={followingExpansion}
                        position="tail"
                        onExpand={(direction) => onExpandGap(followingGap, direction)}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DiffContent({
  model,
  gapExpansion,
  onExpandGap,
  tableWrapperRef,
}: {
  model: EnvironmentDiffModel;
  gapExpansion: GapExpansionState;
  onExpandGap: (gap: EnvironmentDiffGap, direction: "up" | "down") => void;
  tableWrapperRef: { current: HTMLDivElement | null };
}) {
  const status = model.old.state === "nonUtf8" || model.new.state === "nonUtf8"
    ? "二进制文件，无法显示文本差异"
    : !model.available
      ? "无法生成文本差异"
      : model.changeKind === "unchanged"
        ? "内容无变化"
        : !model.hasContentChange && model.changeKind === "created"
          ? "环境快照将创建空文件"
          : !model.hasContentChange && model.changeKind === "deleted"
            ? "环境快照将删除空文件"
            : null;

  return (
    <>
      <UnifiedDiff model={model} gapExpansion={gapExpansion} onExpandGap={onExpandGap} tableWrapperRef={tableWrapperRef} />
      {status && (
        <p data-testid="environment-diff-status" className="px-3 py-6 text-center text-sm text-muted-foreground">
          {status}
        </p>
      )}
    </>
  );
}

function detailErrorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return "未知错误";
}

function hasLargeTextContent(content: EnvironmentDetailResponse["current"]): boolean {
  return content.state === "text" && (content.content?.length ?? 0) > 1_000_000;
}

function LargeFileWarning({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div data-testid="environment-diff-large-file-warning" className="flex flex-col items-center gap-3 px-3 py-8 text-center text-sm text-muted-foreground">
      <p>文件内容过大，计算差异可能需要较长时间。</p>
      <Button type="button" variant="outline" onClick={onConfirm}>仍然显示差异</Button>
    </div>
  );
}

export function EnvironmentDiffDialog({ open, environmentName, environmentId, paths, onOpenChange, onDetail, onOpenCurrentFile }: EnvironmentDiffDialogProps) {
  const [selectedPath, setSelectedPath] = useState(paths[0] ?? "");
  const [detail, setDetail] = useState<EnvironmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirmedLargeDetail, setConfirmedLargeDetail] = useState<EnvironmentDetailResponse | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const requestRef = useRef(0);
  const diffShellRef = useRef<HTMLDivElement>(null);
  const diffTableWrapperRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<{ gapIndex: number; direction: "up" | "down"; scrollTop?: number } | null>(null);

  useEffect(() => {
    if (!paths.includes(selectedPath)) setSelectedPath(paths[0] ?? "");
  }, [paths, selectedPath]);

  const loadDetail = useCallback(() => {
    if (!open || !selectedPath || !onDetail) {
      setDetail(null);
      setLoading(false);
      setDetailError(null);
      setConfirmedLargeDetail(null);
      setLiveMessage("");
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    setDetail(null);
    setDetailError(null);
    setConfirmedLargeDetail(null);
    setLiveMessage("");
    setOpening(false);
    if (diffTableWrapperRef.current) diffTableWrapperRef.current.scrollTop = 0;
    void onDetail(environmentId, selectedPath)
      .then((response) => {
        if (requestRef.current !== requestId) return;
        if (response.environmentId !== environmentId || response.path !== selectedPath) {
          setDetail(null);
          setDetailError("返回内容与当前请求不匹配");
          return;
        }
        setDetail(response);
        setDetailError(null);
      })
      .catch((error: unknown) => {
        if (requestRef.current === requestId) {
          setDetail(null);
          setDetailError(detailErrorText(error));
        }
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [environmentId, onDetail, open, selectedPath]);

  useEffect(() => {
    loadDetail();
    return () => { requestRef.current += 1; };
  }, [loadDetail]);

  const largeFile = detail !== null && (hasLargeTextContent(detail.current) || hasLargeTextContent(detail.snapshot));
  const largeFileConfirmed = detail !== null && confirmedLargeDetail === detail;
  const model = useMemo(
    () => detail && (!largeFile || largeFileConfirmed)
      ? buildEnvironmentDiff(detail.path, detail.current, detail.snapshot)
      : null,
    [detail, largeFile, largeFileConfirmed],
  );
  const [gapExpansion, setGapExpansion] = useState<GapExpansionState>({});
  useEffect(() => {
    setGapExpansion({});
  }, [model]);

  useEffect(() => {
    const focusRequest = pendingFocusRef.current;
    if (!focusRequest) return;
    pendingFocusRef.current = null;
    if (focusRequest.scrollTop !== undefined && diffTableWrapperRef.current) {
      diffTableWrapperRef.current.scrollTop = focusRequest.scrollTop;
    }
    const selector = `[data-state="gap"][data-gap-index="${focusRequest.gapIndex}"] button[data-gap-direction="${focusRequest.direction}"]`;
    const button = diffShellRef.current?.querySelector<HTMLButtonElement>(selector);
    (button ?? diffShellRef.current)?.focus({ preventScroll: true });
  }, [gapExpansion]);

  const hasHiddenRows = model?.gaps.some((gap) => gap.rows.length > 0) ?? false;
  const allExpanded = model ? model.gaps.some((gap) => gap.rows.length > 0) && allGapsExpanded(model, gapExpansion) : false;
  const expandGap = useCallback((gap: EnvironmentDiffGap, direction: "up" | "down") => {
    if (!model) return;
    const position = gapPosition(gap, model.gaps.length);
    const current = gapExpansion[gap.index] ?? { up: 0, down: 0 };
    const visible = visibleGapRows(gap, current, position);
    const amount = Math.min(EXPANSION_STEP, visible.hidden);
    if (amount <= 0) return;
    pendingFocusRef.current = {
      gapIndex: gap.index,
      direction,
      scrollTop: position === "tail" ? diffTableWrapperRef.current?.scrollTop : undefined,
    };
    setLiveMessage(`已将第 ${gap.index + 1} 个缺口向${direction === "up" ? "上" : "下"}展开 ${amount} 行，剩余 ${visible.hidden - amount} 行`);
    setGapExpansion({
      ...gapExpansion,
      [gap.index]: {
        ...current,
        [direction]: current[direction] + amount,
      },
    });
  }, [gapExpansion, model]);
  const expandAll = () => {
    if (model) {
      setGapExpansion(Object.fromEntries(model.gaps.map((gap) => [
        gap.index,
        gapPosition(gap, model.gaps.length) === "tail"
          ? { up: 0, down: gap.rows.length }
          : { up: gap.rows.length, down: 0 },
      ])));
      setLiveMessage("已展开全部差异内容");
    }
  };
  const collapseAll = () => {
    setGapExpansion({});
    setLiveMessage("已折叠全部差异内容");
  };
  const toggleAll = () => (allExpanded ? collapseAll() : expandAll());
  const selectedIndex = paths.indexOf(selectedPath);
  const canRefresh = !!onDetail && open && !!selectedPath && !loading;
  const canOpenCurrentFile = !!onOpenCurrentFile
    && !!detail
    && !loading
    && !detailError
    && (detail.current.state === "text" || detail.current.state === "nonUtf8");
  const goToPath = (index: number) => {
    const path = paths[index];
    if (path) setSelectedPath(path);
  };
  const openCurrentFile = async () => {
    if (!canOpenCurrentFile || !onOpenCurrentFile || !selectedPath) return;
    setOpening(true);
    try {
      await onOpenCurrentFile(environmentId, selectedPath);
    } catch (error: unknown) {
      toast.error("打开当前文件失败", { description: detailErrorText(error) });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] pb-3">
        <DialogHeader className="grid min-w-0 grid-cols-[minmax(0,1fr)_25%_minmax(0,1fr)] items-center gap-0 pr-8">
          <DialogTitle className="min-w-0 text-base leading-normal break-words">查看环境：{environmentName}</DialogTitle>
          <div data-testid="environment-diff-file-selector" className="flex w-full min-w-0 items-center gap-3 justify-self-center">
            <label htmlFor="environment-diff-file" className="shrink-0 text-xs text-muted-foreground">文件</label>
            <Select value={selectedPath} onValueChange={setSelectedPath} disabled={paths.length === 0}>
              <SelectTrigger
                id="environment-diff-file"
                aria-label="选择文件"
                className="min-w-0 flex-1"
              >
                <SelectValue placeholder="没有受管文件" />
              </SelectTrigger>
              <SelectContent className="min-w-0 w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)]">
                {paths.filter(Boolean).map((path) => <SelectItem key={path} value={path} className="min-w-0">{path}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div aria-hidden="true" className="min-w-0" />
        </DialogHeader>
        <DialogDescription className="sr-only">单栏显示项目当前文件到环境快照的只读差异。</DialogDescription>
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div ref={diffShellRef} data-testid="environment-diff-scroll" tabIndex={-1} aria-label="差异内容" className="environment-diff-shell min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border border-border">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="environment-diff-header flex min-w-0 shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                <span data-testid="environment-diff-path-title" className="min-w-0 flex-1 truncate overflow-hidden">{selectedPath || "未选择文件"}</span>
                {model && <DiffStats model={model} />}
              </div>
              <p data-testid="environment-diff-live" aria-live="polite" className="sr-only">{liveMessage}</p>
              {!onDetail || !selectedPath ? <p className="p-6 text-center text-sm text-muted-foreground">无法读取文件详情</p> : loading ? <p className="p-6 text-center text-sm text-muted-foreground">正在读取文件...</p> : detailError ? (
                <div className="flex w-full min-h-0 min-w-0 max-w-full flex-1 flex-col items-center gap-3 px-3 py-8 text-center text-sm text-red-300">
                  <p data-testid="environment-diff-error" role="alert" className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto break-all">读取失败：{detailError}</p>
                  <Button type="button" variant="outline" className="shrink-0" onClick={() => loadDetail()}>重试</Button>
                </div>
              ) : !detail ? <p className="p-6 text-center text-sm text-red-300">无法读取文件详情</p> : largeFile && !largeFileConfirmed ? (
                <LargeFileWarning onConfirm={() => setConfirmedLargeDetail(detail)} />
              ) : !model ? <p className="p-6 text-center text-sm text-red-300">无法读取文件详情</p> : (
                <DiffContent key={`${detail.environmentId}:${detail.path}`} model={model} gapExpansion={gapExpansion} onExpandGap={expandGap} tableWrapperRef={diffTableWrapperRef} />
              )}
            </div>
          </div>
        </div>
        <DialogFooter data-testid="environment-diff-toolbar" className="environment-diff-toolbar mt-2 justify-between gap-1 border-border px-0 pt-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="environment-diff-toolbar-button h-7 w-7 p-0" aria-label="上一个文件" disabled={selectedIndex <= 0} onClick={() => goToPath(selectedIndex - 1)}>
              <ChevronLeft />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="environment-diff-toolbar-button h-7 w-7 p-0" aria-label="下一个文件" disabled={selectedIndex < 0 || selectedIndex >= paths.length - 1} onClick={() => goToPath(selectedIndex + 1)}>
              <ChevronRight />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="environment-diff-toolbar-button h-7 w-7 p-0" aria-label="刷新当前文件差异" disabled={!canRefresh} onClick={() => loadDetail()}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="environment-diff-toolbar-button h-7 w-7 p-0" aria-label="打开当前文件" disabled={!canOpenCurrentFile || opening} onClick={() => void openCurrentFile()}>
              <ExternalLink />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="environment-diff-toolbar-button h-7 w-7 p-0" aria-label={allExpanded ? "折叠当前文件全部内容" : "展开当前文件全部内容"} disabled={!hasHiddenRows} onClick={toggleAll}>
              {allExpanded ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
