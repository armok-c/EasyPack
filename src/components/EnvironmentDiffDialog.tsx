import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EnvironmentDetailResponse,
  EnvironmentFileContent,
} from "@/lib/environment-types";

export interface EnvironmentDiffDialogProps {
  open: boolean;
  environmentName: string;
  environmentId: string;
  paths: string[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDetail?: (environmentId: string, path: string) => Promise<EnvironmentDetailResponse>;
}

function contentForSide(file: EnvironmentFileContent | undefined): string {
  return file?.state === "text" ? file.content ?? "" : "";
}

function stateLabel(file: EnvironmentFileContent | undefined): string | null {
  if (!file || file.state === "text") return null;
  return file.state === "absent" ? "文件不存在" : "无法预览";
}

const editorTheme = EditorView.theme({
  "&": {
    color: "#e5e7eb",
    backgroundColor: "#111827",
    fontSize: "12px",
  },
  ".cm-gutters": {
    backgroundColor: "#111827",
    color: "#6b7280",
    border: "none",
  },
  ".cm-content": { padding: "8px 0" },
  ".cm-line": { padding: "0 8px" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    overflowX: "visible !important",
  },
});

function ReadOnlyMergeView({ snapshot, current }: { snapshot: EnvironmentFileContent | undefined; current: EnvironmentFileContent | undefined }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new MergeView({
      parent: host,
      orientation: "a-b",
      highlightChanges: true,
      gutter: true,
      diffConfig: { timeout: 2000 },
      a: {
        doc: contentForSide(snapshot),
        extensions: [
          editorTheme,
          lineNumbers(),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
        ],
      },
      b: {
        doc: contentForSide(current),
        extensions: [
          editorTheme,
          lineNumbers(),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
        ],
      },
    });

    let syncing = false;
    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (syncing) return;
      syncing = true;
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;
      queueMicrotask(() => { syncing = false; });
    };
    const syncA = () => syncScroll(view.a.scrollDOM, view.b.scrollDOM);
    const syncB = () => syncScroll(view.b.scrollDOM, view.a.scrollDOM);
    view.a.scrollDOM.addEventListener("scroll", syncA);
    view.b.scrollDOM.addEventListener("scroll", syncB);

    return () => {
      view.a.scrollDOM.removeEventListener("scroll", syncA);
      view.b.scrollDOM.removeEventListener("scroll", syncB);
      view.destroy();
    };
  }, [current, snapshot]);

  return <div ref={hostRef} className="min-w-[880px] [&_.cm-mergeView]:max-h-[52vh] [&_.cm-mergeView]:overflow-y-auto" data-testid="environment-diff-view" />;
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

  const snapshotState = stateLabel(detail?.snapshot);
  const currentState = stateLabel(detail?.current);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px]">
        <DialogHeader>
          <DialogTitle className="min-w-0 truncate pr-8" title={`查看环境：${environmentName}`}>查看环境：{environmentName}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">左右并排显示环境快照和项目当前文件，只读查看文件差异。</DialogDescription>
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <label htmlFor="environment-diff-file" className="shrink-0 text-xs text-muted-foreground">文件</label>
            <Select value={selectedPath} onValueChange={setSelectedPath} disabled={paths.length === 0}>
              <SelectTrigger
                id="environment-diff-file"
                aria-label="选择文件"
                className="min-w-0 flex-1"
              >
                <SelectValue placeholder="没有受管文件" />
              </SelectTrigger>
              <SelectContent>
                {paths.filter(Boolean).map((path) => <SelectItem key={path} value={path}>{path}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div data-testid="environment-diff-scroll" className="min-w-0 overflow-x-auto rounded-md border border-border">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
                <div className="min-w-[440px] bg-card px-3 py-2 text-xs font-medium text-muted-foreground">环境快照 · {selectedPath || "未选择文件"}</div>
                <div className="min-w-[440px] bg-card px-3 py-2 text-xs font-medium text-muted-foreground">项目当前文件 · {selectedPath || "未选择文件"}</div>
              </div>
              {!onDetail || !selectedPath ? <p className="p-6 text-center text-sm text-muted-foreground">无法读取文件详情</p> : loading ? <p className="p-6 text-center text-sm text-muted-foreground">正在读取文件...</p> : !detail ? <p className="p-6 text-center text-sm text-red-300">无法读取文件详情</p> : (
                <>
                  {(snapshotState || currentState) && <div className="grid grid-cols-2 gap-px border-b border-border bg-border text-xs"><div className="bg-card px-3 py-2 text-amber-200">{snapshotState ?? "文本文件"}</div><div className="bg-card px-3 py-2 text-emerald-200">{currentState ?? "文本文件"}</div></div>}
                  <ReadOnlyMergeView key={`${detail.environmentId}:${detail.path}`} snapshot={detail.snapshot} current={detail.current} />
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
