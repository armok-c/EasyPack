export interface PendingProjectSwitch {
  current: Promise<void> | null;
}

export interface ProjectSwitchRequest {
  projectId: string;
  selectedId: string | null;
  pending: PendingProjectSwitch;
  requestLeave: () => Promise<boolean>;
  selectProject: (projectId: string) => Promise<void> | void;
}

/** Start one guarded project switch and ignore competing targets while it waits. */
export function requestProjectSwitch({
  projectId,
  selectedId,
  pending,
  requestLeave,
  selectProject,
}: ProjectSwitchRequest): void {
  if (projectId === selectedId || pending.current) return;

  const request = (async () => {
    if (await requestLeave()) await selectProject(projectId);
  })();
  pending.current = request;
  void request.then(
    () => {
      if (pending.current === request) pending.current = null;
    },
    () => {
      if (pending.current === request) pending.current = null;
    },
  );
}
