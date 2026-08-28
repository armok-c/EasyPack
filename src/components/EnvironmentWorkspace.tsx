import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { AlertCircle, ArrowLeftRight, Check, Copy, Eye, FilePlus2, FolderSync, Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnvironmentDiffDialog } from "@/components/EnvironmentDiffDialog";
import { cn } from "@/lib/utils";
import type {
  ApplyPlan,
  ApplyResponse,
  BootstrapEnvironment,
  EnvironmentBatchResult,
  EnvironmentDetailResponse,
  EnvironmentProgress,
  EnvironmentProjectState,
  LegacyMigrationDraft,
  MigrationEntry,
  MigrationEnvironment,
} from "@/lib/environment-types";

const TEXT_EXTENSIONS = new Set([
  "env", "json", "yaml", "yml", "toml", "xml", "conf", "ini", "cfg", "txt", "md",
]);

const toolbarActionClass = "border-white/20 bg-white/5 text-foreground hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-muted-foreground";
const destructiveToolbarActionClass = "border-red-400/40 bg-red-500/10 text-red-200 hover:border-red-300/60 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-muted-foreground";

function relativePath(path: string, projectPath: string): string {
  const absolute = path.replace(/\\/g, "/");
  const root = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
  return absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : absolute;
}

function isTextPath(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? path;
  if (name.startsWith(".") && !name.slice(1).includes(".")) return true;
  const dot = name.lastIndexOf(".");
  return dot > 0 && TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function actionLabel(action: ApplyPlan["changes"][number]["action"]): string {
  return { create: "新建", overwrite: "覆盖", delete: "删除", unchanged: "不变" }[action];
}

function actionClass(action: ApplyPlan["changes"][number]["action"]): string {
  return {
    create: "text-emerald-300",
    overwrite: "text-amber-300",
    delete: "text-red-300",
    unchanged: "text-muted-foreground",
  }[action];
}

function bytesOf(content: string): number[] {
  return [...new TextEncoder().encode(content)];
}

export interface EnvironmentWorkspaceProps {
  /** Recreates local dialogs when profile/project scope changes. */
  scopeKey?: string;
  projectPath: string;
  state: EnvironmentProjectState | null;
  busy: boolean;
  error: unknown;
  recoveryBlocked: boolean;
  recoveryError: string | null;
  migrationRequired: boolean;
  migrationDraft: LegacyMigrationDraft | null;
  onRefresh: () => Promise<EnvironmentProjectState | null>;
  onCreate: (name: string, managedPaths: string[]) => Promise<EnvironmentProjectState>;
  onCapture: (environmentId: string) => Promise<EnvironmentProjectState>;
  onCaptureMany?: (environmentIds: string[]) => Promise<EnvironmentBatchResult>;
  onDetail?: (environmentId: string, path: string) => Promise<EnvironmentDetailResponse>;
  onCopy: (environmentId: string, name: string) => Promise<EnvironmentProjectState>;
  onDelete: (environmentId: string) => Promise<EnvironmentProjectState>;
  onDeleteMany?: (environmentIds: string[]) => Promise<EnvironmentBatchResult>;
  onMigrate: (request: { managedPaths: string[]; environments: (MigrationEnvironment | BootstrapEnvironment)[] }) => Promise<EnvironmentProjectState>;
  onPlan: (environmentId: string) => Promise<ApplyPlan>;
  onApply: (environmentId: string, planToken: string) => Promise<ApplyResponse>;
  onPlanUndo: () => Promise<ApplyPlan>;
  onUndo: (environmentId: string, planToken: string) => Promise<ApplyResponse>;
  progress?: Record<string, EnvironmentProgress>;
}

interface PathDialogProps {
  open: boolean;
  projectPath: string;
  paths: string[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (paths: string[]) => Promise<void>;
}

function ManagedPathsDialog({ open, projectPath, paths, busy, onOpenChange, onSave }: PathDialogProps) {
  const [draft, setDraft] = useState<string[]>(paths);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) setDraft(paths);
    onOpenChange(next);
  }, [onOpenChange, paths]);

  const selectFiles = useCallback(async () => {
    const selected = await openFileDialog({
      multiple: true,
      defaultPath: projectPath,
      title: "选择受管文本文件",
      filters: [{ name: "文本文件", extensions: [...TEXT_EXTENSIONS] }],
    });
    const files = Array.isArray(selected) ? selected : selected ? [selected] : [];
    const invalid = files.filter((path) => !isTextPath(path));
    if (invalid.length > 0) {
      toast.error("已跳过非普通文本文件");
    }
    const next = files
      .filter(isTextPath)
      .map((path) => relativePath(path, projectPath))
      .filter((path) => path && isTextPath(path));
    setDraft((current) => [...new Set([...current, ...next])].sort());
  }, [projectPath]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader><DialogTitle>受管文件清单</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">这里只管理项目内的普通文本文件。修改后会为所有环境补齐新增路径。</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void selectFiles()} disabled={busy}>
              <FilePlus2 className="size-4" />选择文件
            </Button>
          </div>
          <div className="max-h-56 overflow-auto rounded-md border border-border">
            {draft.length === 0 ? <p className="p-4 text-sm text-muted-foreground">还没有受管文件</p> : draft.map((path) => (
              <div key={path} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
                <span className="min-w-0 flex-1 truncate text-sm">{path}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`移除 ${path}`} onClick={() => setDraft((current) => current.filter((item) => item !== path))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="button" onClick={() => void onSave(draft)} disabled={busy || draft.length === 0}><Save className="size-4" />保存清单</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ plan, open, busy, onOpenChange, onConfirm }: { plan: ApplyPlan | null; open: boolean; busy: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  const changed = plan?.changes.filter((change) => change.action !== "unchanged") ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader><DialogTitle>确认应用环境</DialogTitle></DialogHeader>
        {!plan ? <p className="text-sm text-muted-foreground">正在生成变更计划...</p> : (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">将按下面计划处理项目文件。外部修改不会被拦截，应用失败时由程序自动恢复。</p>
              <div className="flex gap-4 text-xs">
                {(["create", "overwrite", "delete"] as const).map((action) => <span key={action} className={cn("whitespace-nowrap", actionClass(action))}>{actionLabel(action)} {changed.filter((item) => item.action === action).length}</span>)}
              </div>
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                {changed.length === 0 ? <p className="p-4 text-sm text-muted-foreground">没有文件需要变化</p> : changed.map((change) => <div key={change.path} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 border-b border-border px-3 py-2 last:border-b-0"><span className={cn("whitespace-nowrap text-xs", actionClass(change.action))}>{actionLabel(change.action)}</span><span className="min-w-0 truncate text-sm">{change.path}</span></div>)}
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={onConfirm} disabled={busy}><Check className="size-4" />确认应用</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type MigrationChoice = "absent" | "current" | "copy";

function findCopySource(draft: LegacyMigrationDraft, environmentId: string, path: string, sourceId: string): MigrationEntry | undefined {
  if (!sourceId || sourceId === environmentId) return undefined;
  return draft.environments
    .find((environment) => environment.environmentId === sourceId)
    ?.entries.find((entry) => entry.path === path && entry.state === "present");
}

export async function buildMigrationEnvironments({
  draft,
  projectPath,
  choices,
  sources,
}: {
  draft: LegacyMigrationDraft;
  projectPath: string;
  choices: Record<string, MigrationChoice>;
  sources: Record<string, string>;
}): Promise<LegacyMigrationDraft["environments"]> {
  for (const environment of draft.environments) {
    for (const path of draft.managedPaths) {
      if (environment.entries.some((entry) => entry.path === path)) continue;
      const key = `${environment.environmentId}:${path}`;
      if (choices[key] === "copy" && !findCopySource(draft, environment.environmentId, path, sources[key] ?? "")) {
        throw new Error(`无法复制 ${environment.environmentId} / ${path}：请选择有效来源环境`);
      }
    }
  }

  return Promise.all(draft.environments.map(async (environment) => {
    const entries = [...environment.entries];
    for (const path of draft.managedPaths) {
      if (entries.some((entry) => entry.path === path)) continue;
      const key = `${environment.environmentId}:${path}`;
      const choice = choices[key] ?? "absent";
      let entry: MigrationEntry = { path, state: "absent", content: null };
      if (choice === "current") {
        const content = await invoke<string | null>("read_file_content", { projectPath, fileName: path });
        if (content !== null) entry = { path, state: "present", content: bytesOf(content) };
      } else if (choice === "copy") {
        const source = findCopySource(draft, environment.environmentId, path, sources[key] ?? "");
        if (!source) throw new Error(`无法复制 ${environment.environmentId} / ${path}：请选择有效来源环境`);
        entry = { ...source, content: source.content ? [...source.content] : null };
      }
      entries.push(entry);
    }
    return { ...environment, entries };
  }));
}

function MigrationWizard({ draft, projectPath, busy, onMigrate }: { draft: LegacyMigrationDraft; projectPath: string; busy: boolean; onMigrate: EnvironmentWorkspaceProps["onMigrate"] }) {
  const [choices, setChoices] = useState<Record<string, MigrationChoice>>({});
  const [sources, setSources] = useState<Record<string, string>>({});
  const missing = useMemo(() => draft.environments.flatMap((environment) => draft.managedPaths.filter((path) => !environment.entries.some((entry) => entry.path === path)).map((path) => ({ environmentId: environment.environmentId, path }))), [draft]);
  const sourceOptionsByKey = useMemo(() => new Map<string, BootstrapEnvironment[]>(missing.map(({ environmentId, path }) => {
    const sourcesForPath = draft.environments.filter((environment) => environment.environmentId !== environmentId && environment.entries.some((entry) => entry.path === path && entry.state === "present"));
    return [`${environmentId}:${path}`, sourcesForPath] as const;
  })), [draft, missing]);
  const copyErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const { environmentId, path } of missing) {
      const key = `${environmentId}:${path}`;
      if (choices[key] !== "copy") continue;
      const sourceId = sources[key] ?? "";
      if (!sourceId) errors[key] = "请选择来源环境";
      else if (!sourceOptionsByKey.get(key)?.some((environment) => environment.environmentId === sourceId)) errors[key] = "所选来源没有这个文件，请重新选择";
    }
    return errors;
  }, [choices, missing, sourceOptionsByKey, sources]);

  useEffect(() => {
    setSources((current) => {
      let changed = false;
      const next = Object.fromEntries(Object.entries(current).filter(([key, sourceId]) => {
        const valid = sourceOptionsByKey.get(key)?.some((environment) => environment.environmentId === sourceId) ?? false;
        if (!valid) changed = true;
        return valid;
      }));
      return changed ? next : current;
    });
  }, [sourceOptionsByKey]);

  const setChoice = (key: string, choice: MigrationChoice) => {
    setChoices((current) => ({ ...current, [key]: choice }));
    if (choice !== "copy") {
      setSources((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };
  const submit = async () => {
    const environments = await buildMigrationEnvironments({ draft, projectPath, choices, sources });
    await onMigrate({ managedPaths: draft.managedPaths, environments });
  };

  return <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
    <div><h3 className="text-sm font-medium">需要补齐旧环境清单</h3><p className="mt-1 text-xs text-muted-foreground">不同环境原来的文件不一致。请逐项选择缺少文件的处理方式，完成前不能应用环境。</p></div>
    <div className="max-h-72 space-y-2 overflow-auto">
      {missing.map(({ environmentId, path }) => {
        const key = `${environmentId}:${path}`;
        const sourcesForPath = sourceOptionsByKey.get(key) ?? [];
        const environmentName = draft.environments.find((environment) => environment.environmentId === environmentId)?.environmentId ?? environmentId;
        const copyError = copyErrors[key];
        return <div key={key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center"><span className="min-w-0 truncate text-sm">{environmentName} / {path}</span><select className="h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm" value={choices[key] ?? "absent"} onChange={(event) => setChoice(key, event.target.value as MigrationChoice)}><option value="absent">设为缺失</option><option value="current">从当前文件捕获</option>{sourcesForPath.length > 0 && <option value="copy">复制来源</option>}</select>{(choices[key] ?? "absent") === "copy" && <><Select value={sources[key] ?? ""} onValueChange={(value) => setSources((current) => ({ ...current, [key]: value }))}><SelectTrigger className="min-w-0 w-full" aria-label="选择来源环境"><SelectValue placeholder="选择来源环境" /></SelectTrigger><SelectContent>{sourcesForPath.map((source) => <SelectItem key={source.environmentId} value={source.environmentId}>{source.environmentId}</SelectItem>)}</SelectContent></Select>{copyError && <p role="alert" className="text-xs text-red-300 sm:col-span-3">{copyError}</p>}</>}</div>;
      })}
    </div>
    <Button onClick={() => void submit()} disabled={busy || Object.keys(copyErrors).length > 0}><FolderSync className="size-4" />完成迁移</Button>
  </div>;
}

export function EnvironmentWorkspace({ projectPath, state, busy, error, recoveryBlocked, recoveryError, migrationRequired, migrationDraft, onRefresh, onCreate, onCapture, onCaptureMany, onDetail, onCopy, onDelete, onDeleteMany, onMigrate, onPlan, onApply, onPlanUndo, onUndo, progress = {} }: EnvironmentWorkspaceProps) {
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"current" | "copy">("current");
  const [copySource, setCopySource] = useState("");
  const [copyStartedFromSelection, setCopyStartedFromSelection] = useState(false);
  const [initialPaths, setInitialPaths] = useState<string[]>([]);
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [captureConfirmOpen, setCaptureConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTarget, setDetailTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeBatch, setActiveBatch] = useState<{
    kind: "capture" | "apply";
    environmentIds: string[];
    pendingIds: string[];
    previousOperationIds: Record<string, string | undefined>;
  } | null>(null);
  const [plan, setPlan] = useState<ApplyPlan | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoPlan, setUndoPlan] = useState<ApplyPlan | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const environments = useMemo(() => state?.environments ?? [], [state?.environments]);
  const canEdit = !busy && !migrationRequired && !recoveryBlocked;
  const selectedEnvironments = environments.filter((environment) => selectedIds.includes(environment.id));
  const selectedSingle = selectedEnvironments.length === 1 ? selectedEnvironments[0] : null;
  const undoProgress = undoPlan && progress[undoPlan.environmentId]?.kind === "undo"
    ? progress[undoPlan.environmentId]
    : undefined;

  useEffect(() => {
    const available = new Set(environments.map((environment) => environment.id));
    setSelectedIds((current) => current.filter((id) => available.has(id)));
  }, [environments]);

  useEffect(() => {
    setActiveBatch((current) => {
      if (!current || current.pendingIds.length === 0) return current;
      const pendingIds = current.pendingIds.filter((id) => {
        const currentOperationId = progress[id]?.operationId;
        return !currentOperationId || currentOperationId === current.previousOperationIds[id];
      });
      if (pendingIds.length === current.pendingIds.length) return current;
      return { ...current, pendingIds };
    });
  }, [progress]);

  const run = async (operation: () => Promise<unknown>, success?: string) => {
    setOperationError(null);
    try { await operation(); if (success) toast.success(success); } catch (cause) { setOperationError(errorText(cause)); }
  };

  const invertSelection = () => {
    setSelectedIds((current) => {
      const selected = new Set(current);
      return environments.filter((environment) => !selected.has(environment.id)).map((environment) => environment.id);
    });
  };

  const fallbackBatch = async (ids: string[], operation: (id: string) => Promise<EnvironmentProjectState>): Promise<EnvironmentBatchResult> => {
    const results: EnvironmentBatchResult["results"] = [];
    let latestState = state;
    for (const id of ids) {
      try {
        const next = await operation(id);
        latestState = next;
        results.push({ environmentId: id, success: true, state: next });
      } catch (cause) {
        results.push({ environmentId: id, success: false, error: cause });
      }
    }
    return { results, state: latestState };
  };

  const captureSelected = async () => {
    const ids = selectedEnvironments.map((environment) => environment.id);
    if (ids.length === 0) return;
    setCaptureConfirmOpen(false);
    setActiveBatch({
      kind: "capture",
      environmentIds: ids,
      pendingIds: ids,
      previousOperationIds: Object.fromEntries(ids.map((id) => [id, progress[id]?.operationId])),
    });
    await run(async () => {
      const batch = onCaptureMany
        ? await onCaptureMany(ids)
        : await fallbackBatch(ids, onCapture);
      const failed = batch.results.filter((result) => !result.success).length;
      const succeeded = batch.results.length - failed;
      toast[failed > 0 ? "info" : "success"](`已更新 ${succeeded} 个环境${failed > 0 ? `，失败 ${failed} 个` : ""}`);
      setSelectedIds([]);
    });
    setActiveBatch(null);
  };

  const deleteSelected = async () => {
    const ids = selectedEnvironments.map((environment) => environment.id);
    if (ids.length === 0) return;
    setDeleteConfirmOpen(false);
    await run(async () => {
      const batch = onDeleteMany
        ? await onDeleteMany(ids)
        : await fallbackBatch(ids, onDelete);
      const failed = batch.results.filter((result) => !result.success).length;
      const succeeded = batch.results.length - failed;
      setSelectedIds([]);
      toast[failed > 0 ? "info" : "success"](`已删除 ${succeeded} 个环境${failed > 0 ? `，失败 ${failed} 个` : ""}`);
    });
  };

  const savePaths = async (paths: string[]) => {
    if (!state) return;
    const old = new Set(state.managedPaths);
    const added = paths.filter((path) => !old.has(path));
    const environmentsRequest = await Promise.all(environments.map(async (environment) => {
      const entries: MigrationEntry[] = [];
      for (const path of added) {
        const content = await invoke<string | null>("read_file_content", { projectPath, fileName: path });
        entries.push(content === null ? { path, state: "absent", content: null } : { path, state: "present", content: bytesOf(content) });
      }
      return { environmentId: environment.id, entries };
    }));
    await run(() => onMigrate({ managedPaths: paths, environments: environmentsRequest }), "已更新受管文件清单");
    setPathDialogOpen(false);
  };

  const createEnvironment = async () => {
    const name = newName.trim();
    if (!name) return;
    if (environments.some((environment) => environment.name === name)) { setOperationError("环境名称已存在"); return; }
    const copyFromSelected = copyStartedFromSelection && newMode === "copy" && Boolean(copySource);
    await run(async () => {
      if (newMode === "copy" && copySource) await onCopy(copySource, name);
      else await onCreate(name, initialPaths.length > 0 ? initialPaths : state?.managedPaths ?? []);
      if (copyFromSelected) setSelectedIds([]);
      setNewDialogOpen(false); setNewName(""); setCopySource("");
    }, "已创建环境");
  };

  const preparePlan = async (environmentId: string) => {
    setOperationError(null);
    try { setPlan(await onPlan(environmentId)); setPlanOpen(true); } catch (cause) { setOperationError(errorText(cause)); }
  };

  const confirmApply = async () => {
    if (!plan) return;
    setActiveBatch({
      kind: "apply",
      environmentIds: [plan.environmentId],
      pendingIds: [plan.environmentId],
      previousOperationIds: { [plan.environmentId]: progress[plan.environmentId]?.operationId },
    });
    try {
      const response = await onApply(plan.environmentId, plan.token);
      if (response.stale) { setPlan(response.plan); return; }
       if (response.applied) { setSelectedIds([]); setPlanOpen(false); toast.success("环境已应用"); }
    } catch (cause) { setOperationError(errorText(cause)); }
    finally { setActiveBatch(null); }
  };

  const prepareUndoPlan = async () => {
    setOperationError(null);
    try { setUndoPlan(await onPlanUndo()); setUndoOpen(true); } catch (cause) { setOperationError(errorText(cause)); }
  };

  const confirmUndo = async () => {
    if (!undoPlan) return;
    try {
      const response = await onUndo(undoPlan.environmentId, undoPlan.token);
      if (response.stale) { setUndoPlan(response.plan); setOperationError(null); return; }
      if (response.applied) { setSelectedIds([]); setUndoOpen(false); toast.success("已撤销上次应用"); }
    } catch (cause) { setOperationError(errorText(cause)); }
  };

  if (migrationRequired && migrationDraft) return <MigrationWizard draft={migrationDraft} projectPath={projectPath} busy={busy} onMigrate={onMigrate} />;
  if (recoveryBlocked) return <div className="space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 text-red-300" /><div><h3 className="text-sm font-medium">项目恢复未完成</h3><p className="mt-1 text-xs text-muted-foreground">环境操作已暂时停止。可以重试恢复并重新读取项目状态。</p>{recoveryError && <p role="alert" className="mt-2 text-xs text-red-200">恢复提示：{recoveryError}</p>}</div></div><Button variant="outline" onClick={() => void onRefresh()} disabled={busy}><RefreshCw className="size-4" />重试恢复</Button></div>;

  return <div className="flex h-full min-h-0 flex-col">
      <div data-environment-toolbar className="shrink-0 space-y-3">
       <div className="flex flex-wrap items-center gap-2">
         <Button variant="outline" size="sm" className={toolbarActionClass} onClick={() => setPathDialogOpen(true)} disabled={!canEdit || !state}><FolderSync className="size-4" />文件清单</Button>
         <Button size="sm" onClick={() => { setNewMode("current"); setCopySource(""); setCopyStartedFromSelection(false); setNewDialogOpen(true); }} disabled={!canEdit}><Plus className="size-4" />新建</Button>
         <Button variant="outline" size="sm" className={toolbarActionClass} onClick={invertSelection} disabled={!canEdit || environments.length === 0}><ArrowLeftRight className="size-4" />反选</Button>
         <span className="ml-auto text-xs text-muted-foreground">已选 {selectedEnvironments.length} 个</span>
       </div>
       <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
         <Button variant="outline" size="sm" className={toolbarActionClass} onClick={() => setCaptureConfirmOpen(true)} disabled={!canEdit || selectedEnvironments.length === 0}><RefreshCw className="size-4" />捕获更新</Button>
         <Button variant="outline" size="sm" className={toolbarActionClass} onClick={() => selectedSingle && void preparePlan(selectedSingle.id)} disabled={!canEdit || !selectedSingle}><Check className="size-4" />应用</Button>
         <Button variant="outline" size="sm" className={toolbarActionClass} onClick={() => { if (selectedSingle) { setNewMode("copy"); setCopySource(selectedSingle.id); setCopyStartedFromSelection(true); setNewDialogOpen(true); } }} disabled={!canEdit || !selectedSingle}><Copy className="size-4" />复制</Button>
         <Button variant="outline" size="sm" className={destructiveToolbarActionClass} onClick={() => setDeleteConfirmOpen(true)} disabled={!canEdit || selectedEnvironments.length === 0}><Trash2 className="size-4" />删除</Button>
         {state?.undoAvailable && <Button variant="outline" size="sm" onClick={() => void prepareUndoPlan()} disabled={!canEdit}><RotateCcw className="size-4" />撤销</Button>}
       </div>
      </div>
     <div data-environment-list className="mt-5 min-h-0 flex-1 overflow-y-auto scrollbar-none">
       {(error || operationError) && <div role="alert" className="mb-5 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-200">{operationError ?? errorText(error)}</div>}
       {!state && busy && <p className="text-sm text-muted-foreground">正在读取项目环境...</p>}
        {state && environments.length === 0 && <div className="rounded-lg border border-dashed border-border p-8 text-center"><p className="text-sm">还没有环境</p><p className="mt-1 text-xs text-muted-foreground">先选择项目内的文本文件，再从当前文件捕获第一个环境。</p><Button className="mt-4" onClick={() => { setCopyStartedFromSelection(false); setNewDialogOpen(true); }} disabled={!canEdit}><FilePlus2 className="size-4" />创建第一个环境</Button></div>}
       <div className="space-y-1.5">{environments.map((environment) => {
        const pending = activeBatch?.pendingIds.includes(environment.id) ?? false;
        const environmentProgress = pending || progress[environment.id]?.kind === "undo" ? undefined : progress[environment.id];
        const waiting = pending && activeBatch?.environmentIds.includes(environment.id);
        const operationLabel = environmentProgress?.kind === "capture" ? "更新" : environmentProgress?.kind === "copy" ? "复制" : "应用";
        const progressColor = environmentProgress?.status === "failed" ? "bg-red-400" : environmentProgress?.kind === "apply" ? "bg-green-400" : environmentProgress?.kind === "capture" ? "bg-cyan-400" : environmentProgress?.kind === "copy" ? "bg-blue-400" : "bg-primary";
        const statusText = environmentProgress
          ? environmentProgress.status === "running" ? `${operationLabel}处理中 ${environmentProgress.percent}%`
            : `${operationLabel}${environmentProgress.status === "success" ? "成功" : "失败"}${environmentProgress.status === "success" ? " 100%" : ""}`
          : waiting ? "等待中" : "就绪";
          const selectionId = `environment-select-${environment.id}`;
          return <div key={environment.id} data-environment-row={environment.id} className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,9rem)_auto_auto] items-center gap-x-2 rounded-md border px-3 py-2", selectedIds.includes(environment.id) ? "border-white/25 bg-muted/70" : "border-border bg-muted/40")}>
            <label htmlFor={selectionId} className={cn("-ml-3 -my-2 flex min-w-0 self-stretch items-center gap-2 py-2 pl-3", canEdit ? "cursor-pointer" : "cursor-not-allowed")}>
              <Checkbox id={selectionId} className="size-4 shrink-0" aria-label={`选择环境 ${environment.name}`} checked={selectedIds.includes(environment.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, environment.id] : current.filter((id) => id !== environment.id))} disabled={!canEdit} />
              <p className="min-w-0 truncate text-sm font-medium">{environment.name}</p>
            </label>
            <div className="flex min-w-0 flex-col gap-1" data-progress-status={environmentProgress?.status ?? (waiting ? "waiting" : "idle")}><span className="min-w-0 truncate text-right text-xs text-muted-foreground">{statusText}</span>{environmentProgress && <div role="progressbar" aria-label={`${environment.name} ${operationLabel}进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={environmentProgress.percent} className="ml-auto h-1.5 w-2/3 overflow-hidden rounded-full bg-muted"><div className={cn("h-full transition-[width]", progressColor)} style={{ width: `${environmentProgress.percent}%` }} /></div>}{!environmentProgress && !waiting && <div data-ready-progress aria-hidden="true" className="ml-auto h-1.5 w-2/3 overflow-hidden rounded-full bg-white" />}</div>
            <span className="min-w-0 whitespace-nowrap text-xs text-muted-foreground">文件：{environment.fileCount}</span>
            <div className="flex min-w-0 justify-end"><Button variant="ghost" size="icon" className="size-7 min-w-0 shrink-0" aria-label="查看" onClick={() => setDetailTarget({ id: environment.id, name: environment.name })} disabled={!canEdit}><Eye className="size-4" /></Button></div>
          </div>;
       })}</div>
     </div>

    <ManagedPathsDialog open={pathDialogOpen} projectPath={projectPath} paths={environments.length === 0 ? initialPaths : state?.managedPaths ?? []} busy={busy} onOpenChange={setPathDialogOpen} onSave={environments.length === 0 ? async (paths) => { setInitialPaths(paths); setPathDialogOpen(false); } : savePaths} />
      <Dialog open={newDialogOpen} onOpenChange={(open) => { setNewDialogOpen(open); if (open && environments.length === 0) { setInitialPaths(state?.managedPaths ?? []); setNewMode("current"); } }}><DialogContent className="max-w-[420px]"><DialogHeader><DialogTitle>{environments.length === 0 ? "创建第一个环境" : "新建环境"}</DialogTitle></DialogHeader><div className="space-y-3"><Input autoFocus placeholder="环境名称" value={newName} onChange={(event) => setNewName(event.target.value)} />{environments.length === 0 && <div className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-sm">受管文件 {initialPaths.length} 个</span><Button variant="outline" size="sm" onClick={() => setPathDialogOpen(true)}><FilePlus2 className="size-4" />选择文件</Button></div>{initialPaths.length === 0 && <p className="mt-1 text-xs text-muted-foreground">先选择项目内文本文件</p>}</div>}<div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="radio" checked={newMode === "current"} onChange={() => setNewMode("current")} />从当前文件捕获</label>{environments.length > 0 && <label className="flex items-center gap-2"><input type="radio" checked={newMode === "copy"} onChange={() => setNewMode("copy")} />复制已有环境</label>}</div>{newMode === "copy" && <Select value={copySource} onValueChange={setCopySource}><SelectTrigger className="w-full" aria-label="选择复制来源"><SelectValue placeholder="选择复制来源" /></SelectTrigger><SelectContent>{environments.map((environment) => <SelectItem key={environment.id} value={environment.id}>{environment.name}</SelectItem>)}</SelectContent></Select>}</div><DialogFooter><Button variant="outline" onClick={() => setNewDialogOpen(false)}>取消</Button><Button onClick={() => void createEnvironment()} disabled={!newName.trim() || (environments.length === 0 && initialPaths.length === 0) || (newMode === "copy" && !copySource) || !canEdit}><Plus className="size-4" />创建</Button></DialogFooter></DialogContent></Dialog>
     <AlertDialog open={captureConfirmOpen} onOpenChange={setCaptureConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认捕获更新？</AlertDialogTitle><AlertDialogDescription>将按列表顺序更新选中的 {selectedEnvironments.length} 个环境，单个环境失败不会影响其他环境。</AlertDialogDescription></AlertDialogHeader><div className="mt-4 max-h-40 overflow-auto rounded-md border border-border px-3 py-2 text-sm">{selectedEnvironments.map((environment) => <div key={environment.id} className="truncate py-1">{environment.name}</div>)}</div><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void captureSelected()} disabled={busy || selectedEnvironments.length === 0}>确认捕获</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
     <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认删除环境？</AlertDialogTitle><AlertDialogDescription>将删除选中的 {selectedEnvironments.length} 个环境快照，且不能恢复。项目文件不会受到影响。</AlertDialogDescription></AlertDialogHeader><div className="mt-4 max-h-40 overflow-auto rounded-md border border-border px-3 py-2 text-sm">{selectedEnvironments.map((environment) => <div key={environment.id} className="truncate py-1">{environment.name}</div>)}</div><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={(event) => { event.preventDefault(); void deleteSelected(); }} disabled={busy || selectedEnvironments.length === 0}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
     <PlanDialog plan={plan} open={planOpen} busy={busy} onOpenChange={setPlanOpen} onConfirm={() => void confirmApply()} />
      <AlertDialog open={undoOpen} onOpenChange={setUndoOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认撤销上次应用？</AlertDialogTitle><AlertDialogDescription>将按下面计划恢复上次应用前的文件状态。外部修改后会重新校验并更新计划，请重新确认。</AlertDialogDescription></AlertDialogHeader>{undoPlan && <div className="mt-4 space-y-2"><div className="flex flex-wrap gap-4 text-xs">{(["create", "overwrite", "delete", "unchanged"] as const).map((action) => <span key={action} className={cn("whitespace-nowrap", actionClass(action))}>{actionLabel(action)} {undoPlan.changes.filter((item) => item.action === action).length}</span>)}</div><div className="max-h-40 overflow-auto rounded-md border border-border px-3 py-2 text-xs">{undoPlan.changes.map((change) => <div key={change.path} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 py-1"><span className={cn("whitespace-nowrap text-xs", actionClass(change.action))}>{actionLabel(change.action)}</span><span className="min-w-0 truncate text-sm">{change.path}</span></div>)}</div>{undoProgress && <div data-undo-progress className="space-y-1"><span className="text-xs text-muted-foreground">{undoProgress.status === "running" ? `撤销处理中 ${undoProgress.percent}%` : undoProgress.status === "success" ? "撤销成功" : "撤销失败"}</span><div role="progressbar" aria-label="撤销进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={undoProgress.percent} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full transition-[width]", undoProgress.status === "failed" ? "bg-red-400" : undoProgress.status === "success" ? "bg-emerald-400" : "bg-primary")} style={{ width: `${undoProgress.percent}%` }} /></div></div>}</div>}<AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmUndo(); }} disabled={busy || !undoPlan}>确认撤销</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
     <EnvironmentDiffDialog open={detailTarget !== null} environmentName={detailTarget?.name ?? ""} environmentId={detailTarget?.id ?? ""} paths={state?.managedPaths ?? []} busy={busy} onOpenChange={(open) => { if (!open) setDetailTarget(null); }} onDetail={onDetail} />
   </div>;
}
