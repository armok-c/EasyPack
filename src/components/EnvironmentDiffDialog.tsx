import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Maximize2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  EnvironmentFileContent,
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
}

type GapExpansion = { up: number; down: number };
type GapExpansionState = Record<number, GapExpansion>;

const EXPANSION_STEP = 3;

function stateLabel(file: EnvironmentFileContent): string {
  if (file.state === "text") return "文本文件";
  return file.state === "absent" ? "文件不存在" : "无法预览";
}

function DiffStatus({ model }: { model: EnvironmentDiffModel }) {
  return (
    <div data-testid="environment-diff-status" className="environment-diff-status flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span>旧（项目当前文件）：{stateLabel(model.old)}</span>
      <span>新（环境快照）：{stateLabel(model.new)}</span>
      {model.changeKind === "unchanged" && <span className="text-emerald-200">内容无变化</span>}
      {model.changeKind !== "unchanged" && model.changeKind !== "unavailable" && !model.hasContentChange && <span className="text-amber-200">文件状态已变化</span>}
    </div>
  );
}

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
        {row.noNewline && <span className="environment-diff-no-newline" title="文件末尾没有换行" aria-label="文件末尾没有换行">↵</span>}
      </td>
    </tr>
  );
}

function visibleGapRows(gap: EnvironmentDiffGap, expansion: GapExpansion) {
  const up = Math.min(expansion.up, gap.rows.length);
  const down = Math.min(expansion.down, Math.max(0, gap.rows.length - up));
  const hidden = gap.rows.length - up - down;
  return {
    upRows: gap.rows.slice(gap.rows.length - up),
    downRows: gap.rows.slice(0, down),
    hidden,
  };
}

function GapRow({
  gap,
  expansion,
  onExpand,
}: {
  gap: EnvironmentDiffGap;
  expansion: GapExpansion;
  onExpand: (direction: "up" | "down") => void;
}) {
  const { hidden } = visibleGapRows(gap, expansion);
  if (hidden <= 0) return null;

  return (
    <tr data-state="gap" data-gap-index={gap.index}>
      <td colSpan={3} className="environment-diff-gap-cell">
        <div className="environment-diff-gap-actions">
          <Button type="button" variant="ghost" size="icon" title="向上展开3行" aria-label="向上展开3行" onClick={() => onExpand("up")}>
            <ChevronUp />
          </Button>
          <span className="environment-diff-gap-count">还有 {hidden} 行</span>
          <Button type="button" variant="ghost" size="icon" title="向下展开3行" aria-label="向下展开3行" onClick={() => onExpand("down")}>
            <ChevronDown />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function UnifiedDiff({ model }: { model: EnvironmentDiffModel }) {
  const [gapExpansion, setGapExpansion] = useState<GapExpansionState>({});
  useEffect(() => {
    setGapExpansion({});
  }, [model]);
  const hasHiddenRows = model.gaps.some((gap) => gap.rows.length > 0);
  const allExpanded = model.gaps.every((gap) => gap.rows.length === 0 || visibleGapRows(gap, gapExpansion[gap.index] ?? { up: 0, down: 0 }).hidden === 0);

  if (!model.hasContentChange || model.hunks.length === 0) return null;

  const expandGap = (gap: EnvironmentDiffGap, direction: "up" | "down") => {
    setGapExpansion((previous) => {
      const current = previous[gap.index] ?? { up: 0, down: 0 };
      const visible = Math.min(gap.rows.length, current.up + current.down);
      const amount = Math.min(EXPANSION_STEP, gap.rows.length - visible);
      if (amount <= 0) return previous;
      return {
        ...previous,
        [gap.index]: {
          ...current,
          [direction]: current[direction] + amount,
        },
      };
    });
  };

  const expandAll = () => {
    setGapExpansion(Object.fromEntries(model.gaps.map((gap) => [gap.index, { up: gap.rows.length, down: 0 }])));
  };

  return (
    <div data-testid="environment-diff-view" className="environment-diff-view min-w-0">
      <div className="environment-diff-actions flex items-center justify-end border-b border-border bg-card px-3 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="展开当前文件全部内容"
          aria-label="展开当前文件全部内容"
          disabled={!hasHiddenRows || allExpanded}
          onClick={expandAll}
        >
          <Maximize2 />
        </Button>
      </div>
      <div className="environment-diff-code">
        <div className="environment-diff-table-wrapper">
          <table className="environment-diff-table">
            <thead className="sr-only">
              <tr><th scope="col">旧行号</th><th scope="col">新行号</th><th scope="col">差异内容</th></tr>
            </thead>
            <tbody>
              {model.hunks.map((hunk, hunkIndex) => {
                const gap = model.gaps[hunkIndex];
                const expansion = gapExpansion[gap.index] ?? { up: 0, down: 0 };
                const visible = visibleGapRows(gap, expansion);
                return (
                  <Fragment key={`hunk-group-${hunk.index}`}>
                    {visible.downRows.map((row, index) => <DiffLine key={lineKey(row, index)} row={row} index={index} />)}
                    <GapRow gap={gap} expansion={expansion} onExpand={(direction) => expandGap(gap, direction)} />
                    {visible.upRows.map((row, index) => <DiffLine key={lineKey(row, visible.downRows.length + index)} row={row} index={visible.downRows.length + index} />)}
                    <tr data-testid="environment-diff-hunk-header" data-hunk-index={hunk.index} data-state="hunk">
                      <td colSpan={3} className="environment-diff-hunk-header">{hunk.header}</td>
                    </tr>
                    {hunk.rows.map((row, index) => <DiffLine key={lineKey(row, index)} row={row} index={index} />)}
                  </Fragment>
                );
              })}
              {(() => {
                const gap = model.gaps[model.gaps.length - 1];
                const expansion = gapExpansion[gap.index] ?? { up: 0, down: 0 };
                const visible = visibleGapRows(gap, expansion);
                return (
                  <Fragment key={`tail-gap-${gap.index}`}>
                    {visible.downRows.map((row, index) => <DiffLine key={lineKey(row, index)} row={row} index={index} />)}
                    <GapRow gap={gap} expansion={expansion} onExpand={(direction) => expandGap(gap, direction)} />
                    {visible.upRows.map((row, index) => <DiffLine key={lineKey(row, visible.downRows.length + index)} row={row} index={visible.downRows.length + index} />)}
                  </Fragment>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DiffContent({ model }: { model: EnvironmentDiffModel }) {
  return (
    <>
      <DiffStatus model={model} />
      <UnifiedDiff model={model} />
      {model.available && !model.hasContentChange && (
        <p data-testid="environment-diff-empty" className="px-3 py-6 text-center text-sm text-muted-foreground">
          {model.changeKind === "unchanged" ? "内容无变化" : "文件内容为空"}
        </p>
      )}
    </>
  );
}

export function EnvironmentDiffDialog({ open, environmentName, environmentId, paths, onOpenChange, onDetail }: EnvironmentDiffDialogProps) {
  const [selectedPath, setSelectedPath] = useState(paths[0] ?? "");
  const [detail, setDetail] = useState<EnvironmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!paths.includes(selectedPath)) setSelectedPath(paths[0] ?? "");
  }, [paths, selectedPath]);

  useEffect(() => {
    if (!open || !selectedPath || !onDetail) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setDetail(null);
    void onDetail(environmentId, selectedPath)
      .then((response) => {
        if (requestRef.current === requestId && response.environmentId === environmentId && response.path === selectedPath) setDetail(response);
      })
      .catch(() => {
        if (requestRef.current === requestId) setDetail(null);
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
    return () => { requestRef.current += 1; };
  }, [environmentId, onDetail, open, selectedPath]);

  const model = useMemo(
    () => detail ? buildEnvironmentDiff(detail.path, detail.current, detail.snapshot) : null,
    [detail],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px]">
        <DialogHeader>
          <DialogTitle className="min-w-0 truncate pr-8" title={`查看环境：${environmentName}`}>查看环境：{environmentName}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">单栏显示项目当前文件到环境快照的只读差异。</DialogDescription>
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <label htmlFor="environment-diff-file" className="shrink-0 text-xs text-muted-foreground">文件</label>
            <Select value={selectedPath} onValueChange={setSelectedPath} disabled={paths.length === 0}>
              <SelectTrigger
                id="environment-diff-file"
                aria-label="选择文件"
                title={selectedPath || undefined}
                className="min-w-0 flex-1"
              >
                <SelectValue placeholder="没有受管文件" />
              </SelectTrigger>
              <SelectContent className="min-w-0 w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)]">
                {paths.filter(Boolean).map((path) => <SelectItem key={path} value={path} title={path} className="min-w-0">{path}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div data-testid="environment-diff-scroll" className="environment-diff-shell min-w-0 overflow-hidden rounded-md border border-border">
            <div className="min-w-0">
              <div className="environment-diff-header flex min-w-0 items-center gap-3 border-b border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                <span className="min-w-0 flex-1 truncate" title={`项目当前文件 · ${selectedPath || "未选择文件"}`}>旧 · 项目当前文件 · {selectedPath || "未选择文件"}</span>
                <span className="min-w-0 flex-1 truncate" title={`环境快照 · ${selectedPath || "未选择文件"}`}>新 · 环境快照 · {selectedPath || "未选择文件"}</span>
                {model && <DiffStats model={model} />}
              </div>
              {!onDetail || !selectedPath ? <p className="p-6 text-center text-sm text-muted-foreground">无法读取文件详情</p> : loading ? <p className="p-6 text-center text-sm text-muted-foreground">正在读取文件...</p> : !detail || !model ? <p className="p-6 text-center text-sm text-red-300">无法读取文件详情</p> : (
                <DiffContent key={`${detail.environmentId}:${detail.path}`} model={model} />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
