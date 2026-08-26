import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { AlertCircle, Check, Copy, FilePlus2, FolderSync, Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  ApplyPlan,
  ApplyResponse,
  BootstrapEnvironment,
  EnvironmentProjectState,
  LegacyMigrationDraft,
  MigrationEntry,
  MigrationEnvironment,
} from "@/lib/environment-types";

const TEXT_EXTENSIONS = new Set([
  "env", "json", "yaml", "yml", "toml", "xml", "conf", "ini", "cfg", "txt", "md",
]);

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
  onCopy: (environmentId: string, name: string) => Promise<EnvironmentProjectState>;
  onDelete: (environmentId: string) => Promise<EnvironmentProjectState>;
  onMigrate: (request: { managedPaths: string[]; environments: (MigrationEnvironment | BootstrapEnvironment)[] }) => Promise<EnvironmentProjectState>;
  onPlan: (environmentId: string) => Promise<ApplyPlan>;
  onApply: (environmentId: string, planToken: string) => Promise<ApplyResponse>;
  onPlanUndo: () => Promise<ApplyPlan>;
  onUndo: (planToken: string) => Promise<ApplyResponse>;
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
      <DialogContent className="sm:max-w-[560px]">
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="button" onClick={() => void onSave(draft)} disabled={busy || draft.length === 0}><Save className="size-4" />保存清单</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ plan, open, busy, onOpenChange, onConfirm }: { plan: ApplyPlan | null; open: boolean; busy: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  const changed = plan?.changes.filter((change) => change.action !== "unchanged") ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader><DialogTitle>确认应用环境</DialogTitle></DialogHeader>
        {!plan ? <p className="text-sm text-muted-foreground">正在生成变更计划...</p> : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">将按下面计划处理项目文件。外部修改不会被拦截，应用失败时由程序自动恢复。</p>
            <div className="flex gap-4 text-xs">
              {(["create", "overwrite", "delete"] as const).map((action) => <span key={action} className={actionClass(action)}>{actionLabel(action)} {changed.filter((item) => item.action === action).length}</span>)}
            </div>
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              {changed.length === 0 ? <p className="p-4 text-sm text-muted-foreground">没有文件需要变化</p> : changed.map((change) => <div key={change.path} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"><span className={cn("w-12 text-xs", actionClass(change.action))}>{actionLabel(change.action)}</span><span className="truncate text-sm">{change.path}</span></div>)}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={onConfirm} disabled={busy}><Check className="size-4" />确认应用</Button></div>
          </div>
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
        return <div key={key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_1.4fr] sm:items-center"><span className="truncate text-sm">{environmentName} / {path}</span><select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={choices[key] ?? "absent"} onChange={(event) => setChoice(key, event.target.value as MigrationChoice)}><option value="absent">设为缺失</option><option value="current">从当前文件捕获</option>{sourcesForPath.length > 0 && <option value="copy">复制来源</option>}</select>{(choices[key] ?? "absent") === "copy" && <><select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={sources[key] ?? ""} onChange={(event) => setSources((current) => ({ ...current, [key]: event.target.value }))}><option value="">选择来源环境</option>{sourcesForPath.map((source) => <option key={source.environmentId} value={source.environmentId}>{source.environmentId}</option>)}</select>{copyError && <p role="alert" className="text-xs text-red-300 sm:col-span-3">{copyError}</p>}</>}</div>;
      })}
    </div>
    <Button onClick={() => void submit()} disabled={busy || Object.keys(copyErrors).length > 0}><FolderSync className="size-4" />完成迁移</Button>
  </div>;
}

export function EnvironmentWorkspace({ projectPath, state, busy, error, recoveryBlocked, recoveryError, migrationRequired, migrationDraft, onRefresh, onCreate, onCapture, onCopy, onDelete, onMigrate, onPlan, onApply, onPlanUndo, onUndo }: EnvironmentWorkspaceProps) {
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"current" | "copy">("current");
  const [copySource, setCopySource] = useState("");
  const [initialPaths, setInitialPaths] = useState<string[]>([]);
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [plan, setPlan] = useState<ApplyPlan | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoPlan, setUndoPlan] = useState<ApplyPlan | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const environments = state?.environments ?? [];
  const canEdit = !busy && !migrationRequired && !recoveryBlocked;
  const run = async (operation: () => Promise<unknown>, success?: string) => {
    setOperationError(null);
    try { await operation(); if (success) toast.success(success); } catch (cause) { setOperationError(errorText(cause)); }
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
    await run(async () => {
      if (newMode === "copy" && copySource) await onCopy(copySource, name);
      else await onCreate(name, initialPaths.length > 0 ? initialPaths : state?.managedPaths ?? []);
      setNewDialogOpen(false); setNewName(""); setCopySource("");
    }, "已创建环境");
  };

  const preparePlan = async (environmentId: string) => {
    setOperationError(null);
    try { setPlan(await onPlan(environmentId)); setPlanOpen(true); } catch (cause) { setOperationError(errorText(cause)); }
  };

  const confirmApply = async () => {
    if (!plan) return;
    try {
      const response = await onApply(plan.environmentId, plan.token);
      if (response.stale) { setPlan(response.plan); return; }
       if (response.applied) { setPlanOpen(false); toast.success("环境已应用"); }
    } catch (cause) { setOperationError(errorText(cause)); }
  };

  const prepareUndoPlan = async () => {
    setOperationError(null);
    try { setUndoPlan(await onPlanUndo()); setUndoOpen(true); } catch (cause) { setOperationError(errorText(cause)); }
  };

  const confirmUndo = async () => {
    if (!undoPlan) return;
    try {
      const response = await onUndo(undoPlan.token);
      if (response.stale) { setUndoPlan(response.plan); setOperationError(null); return; }
      if (response.applied) { setUndoOpen(false); toast.success("已撤销上次应用"); }
    } catch (cause) { setOperationError(errorText(cause)); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setOperationError(null);
    try {
      await onDelete(target.id);
      setDeleteTarget(null);
      toast.success("已删除环境");
    } catch (cause) {
      setOperationError(errorText(cause));
    }
  };

  if (migrationRequired && migrationDraft) return <MigrationWizard draft={migrationDraft} projectPath={projectPath} busy={busy} onMigrate={onMigrate} />;
  if (recoveryBlocked) return <div className="space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 text-red-300" /><div><h3 className="text-sm font-medium">项目恢复未完成</h3><p className="mt-1 text-xs text-muted-foreground">环境操作已暂时停止。可以重试恢复并重新读取项目状态。</p>{recoveryError && <p role="alert" className="mt-2 text-xs text-red-200">恢复提示：{recoveryError}</p>}</div></div><Button variant="outline" onClick={() => void onRefresh()} disabled={busy}><RefreshCw className="size-4" />重试恢复</Button></div>;

  return <div className="space-y-5">
     <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-medium">项目环境</h3></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPathDialogOpen(true)} disabled={!canEdit || !state}><FolderSync className="size-4" />受管文件清单</Button><Button size="sm" onClick={() => setNewDialogOpen(true)} disabled={!canEdit}><Plus className="size-4" />新建环境</Button>{state?.undoAvailable && <Button variant="outline" size="sm" onClick={() => void prepareUndoPlan()} disabled={!canEdit}><RotateCcw className="size-4" />撤销上次应用</Button>}</div></div>
    {(error || operationError) && <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-200">{operationError ?? errorText(error)}</div>}
    {!state && busy && <p className="text-sm text-muted-foreground">正在读取项目环境...</p>}
    {state && environments.length === 0 && <div className="rounded-lg border border-dashed border-border p-8 text-center"><p className="text-sm">还没有环境</p><p className="mt-1 text-xs text-muted-foreground">先选择项目内的文本文件，再从当前文件捕获第一个环境。</p><Button className="mt-4" onClick={() => setNewDialogOpen(true)} disabled={!canEdit}><FilePlus2 className="size-4" />创建第一个环境</Button></div>}
    <div className="space-y-1.5">{environments.map((environment) => <div key={environment.id} data-environment-row={environment.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"><div className="flex min-w-0 flex-1 items-center gap-2"><p className="min-w-0 truncate text-sm font-medium">{environment.name}</p><span className="shrink-0 text-xs text-muted-foreground">{environment.fileCount} 个文件</span></div><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setCaptureTarget(environment.id)} disabled={!canEdit}><RefreshCw className="size-4" />捕获更新</Button><Button variant="outline" size="sm" className="shrink-0" onClick={() => void preparePlan(environment.id)} disabled={!canEdit}><Check className="size-4" />应用</Button><Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setNewMode("copy"); setCopySource(environment.id); setNewDialogOpen(true); }} disabled={!canEdit}><Copy className="size-4" />复制</Button><Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-red-300" aria-label={`删除环境 ${environment.name}`} title={`删除环境 ${environment.name}`} onClick={() => setDeleteTarget({ id: environment.id, name: environment.name })} disabled={!canEdit}><Trash2 className="size-4" /></Button></div>)}</div>

    <ManagedPathsDialog open={pathDialogOpen} projectPath={projectPath} paths={environments.length === 0 ? initialPaths : state?.managedPaths ?? []} busy={busy} onOpenChange={setPathDialogOpen} onSave={environments.length === 0 ? async (paths) => { setInitialPaths(paths); setPathDialogOpen(false); } : savePaths} />
    <Dialog open={newDialogOpen} onOpenChange={(open) => { setNewDialogOpen(open); if (open && environments.length === 0) { setInitialPaths(state?.managedPaths ?? []); setNewMode("current"); } }}><DialogContent className="sm:max-w-[420px]"><DialogHeader><DialogTitle>{environments.length === 0 ? "创建第一个环境" : "新建环境"}</DialogTitle></DialogHeader><div className="space-y-3"><Input autoFocus placeholder="环境名称" value={newName} onChange={(event) => setNewName(event.target.value)} />{environments.length === 0 && <div className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-sm">受管文件 {initialPaths.length} 个</span><Button variant="outline" size="sm" onClick={() => setPathDialogOpen(true)}><FilePlus2 className="size-4" />选择文件</Button></div>{initialPaths.length === 0 && <p className="mt-1 text-xs text-muted-foreground">先选择项目内文本文件</p>}</div>}<div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="radio" checked={newMode === "current"} onChange={() => setNewMode("current")} />从当前文件捕获</label>{environments.length > 0 && <label className="flex items-center gap-2"><input type="radio" checked={newMode === "copy"} onChange={() => setNewMode("copy")} />复制已有环境</label>}</div>{newMode === "copy" && <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={copySource} onChange={(event) => setCopySource(event.target.value)}><option value="">选择复制来源</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}</select>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewDialogOpen(false)}>取消</Button><Button onClick={() => void createEnvironment()} disabled={!newName.trim() || (environments.length === 0 && initialPaths.length === 0) || (newMode === "copy" && !copySource) || !canEdit}><Plus className="size-4" />创建</Button></div></div></DialogContent></Dialog>
    <AlertDialog open={captureTarget !== null} onOpenChange={(open) => { if (!open) setCaptureTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认捕获更新？</AlertDialogTitle><AlertDialogDescription>将用项目当前文件覆盖这个环境的快照。外部编辑的内容只有确认后才会进入环境。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => { const target = captureTarget; setCaptureTarget(null); if (target) void run(() => onCapture(target), "已捕获环境更新"); }}>确认捕获</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认删除环境？</AlertDialogTitle><AlertDialogDescription>将删除“{deleteTarget?.name}”环境的快照，且不能恢复。项目文件不会受到影响。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={busy || !deleteTarget}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <PlanDialog plan={plan} open={planOpen} busy={busy} onOpenChange={setPlanOpen} onConfirm={() => void confirmApply()} />
     <AlertDialog open={undoOpen} onOpenChange={setUndoOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认撤销上次应用？</AlertDialogTitle><AlertDialogDescription>将按下面计划恢复上次应用前的文件状态。外部修改后会重新校验并更新计划，请重新确认。</AlertDialogDescription></AlertDialogHeader>{undoPlan && <div className="space-y-2"><div className="flex flex-wrap gap-4 text-xs">{(["create", "overwrite", "delete", "unchanged"] as const).map((action) => <span key={action} className={actionClass(action)}>{actionLabel(action)} {undoPlan.changes.filter((item) => item.action === action).length}</span>)}</div><div className="max-h-40 overflow-auto rounded-md border border-border px-3 py-2 text-xs">{undoPlan.changes.map((change) => <div key={change.path} className="flex gap-2 py-1"><span className={actionClass(change.action)}>{actionLabel(change.action)}</span><span>{change.path}</span></div>)}</div></div>}<AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmUndo(); }} disabled={busy || !undoPlan}>确认撤销</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
