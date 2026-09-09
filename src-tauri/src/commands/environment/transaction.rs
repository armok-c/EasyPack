use super::model::report_progress;
use super::model::{
    ApplyPlan, ApplyRequest, ApplyResponse, ChangeAction, CurrentEntry, EnvironmentFileContent,
    EnvironmentFileState, EnvironmentRecord, EnvironmentRequest, Manifest, PendingUndoAction,
    PlanChange, ProgressCallback, ProjectRef, SnapshotEntry, SnapshotState, StoredTransaction,
    TransactionEntry, TransactionPhase, UndoIntent, UndoRecord, UndoRequest,
};
use super::path::{
    atomic_write, digest_bytes, file_content_from_bytes, io_error, is_reparse_metadata, new_id,
    plan_token, replace_file_from, resolve_safe_path, unique_blob_name, validate_operation_id,
};
use super::store::UNDO_FILE;
use super::store::{
    find_environment, snapshot_from_environment, stage_entries_from_current,
    transaction_entries_to_plan_target, transaction_entries_to_snapshot,
};
use super::validate_relative_path;
use super::EnvironmentStore;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

impl EnvironmentStore {
    pub fn plan_environment(&self, request: &EnvironmentRequest) -> Result<ApplyPlan, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let manifest = store.load_manifest(&request.project)?;
            let root = store.project_root(&request.project, &manifest)?;
            store.make_plan(&request.project, &root, &manifest, &request.environment_id)
        })
    }

    pub fn plan_undo_environment(&self, project: &ProjectRef) -> Result<ApplyPlan, String> {
        self.with_lock(project, |store| {
            store.ensure_ready(project)?;
            let manifest = store.load_manifest(project)?;
            let root = store.project_root(project, &manifest)?;
            let (_, undo) = store.load_undo(project)?;
            let undo_root = store.undo_snapshot_root(project, &undo);
            let target = transaction_entries_to_plan_target(&undo.before, &undo_root)?;
            store.make_plan_from_target(project, &root, &manifest, &target, &undo.environment_id)
        })
    }

    pub fn apply_environment(&self, request: &ApplyRequest) -> Result<ApplyResponse, String> {
        self.apply_environment_with_progress(request, None)
    }

    pub fn apply_environment_with_progress(
        &self,
        request: &ApplyRequest,
        progress: ProgressCallback<'_>,
    ) -> Result<ApplyResponse, String> {
        validate_operation_id(&request.operation_id)?;
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let manifest = store.load_manifest(&request.project)?;
            let root = store.project_root(&request.project, &manifest)?;
            let plan =
                store.make_plan(&request.project, &root, &manifest, &request.environment_id)?;
            if plan.token != request.plan_token {
                return Ok(ApplyResponse {
                    applied: false,
                    stale: true,
                    plan,
                    undo_available: store.undo_exists(&request.project),
                });
            }
            let env = find_environment(&manifest, &request.environment_id)?;
            if plan
                .changes
                .iter()
                .all(|item| matches!(item.action, ChangeAction::Unchanged))
            {
                return Ok(ApplyResponse {
                    applied: true,
                    stale: false,
                    plan,
                    undo_available: store.undo_exists(&request.project),
                });
            }
            store.commit_apply(
                &request.project,
                &root,
                &manifest,
                env,
                &plan,
                &request.operation_id,
                progress,
            )
        })
    }

    pub fn undo_environment(&self, request: &UndoRequest) -> Result<ApplyResponse, String> {
        self.undo_environment_with_progress(request, None)
    }

    pub fn undo_environment_with_progress(
        &self,
        request: &UndoRequest,
        progress: ProgressCallback<'_>,
    ) -> Result<ApplyResponse, String> {
        validate_operation_id(&request.operation_id)?;
        let project = &request.project;
        self.with_lock(project, |store| {
            store.ensure_ready(project)?;
            let manifest = store.load_manifest(project)?;
            let root = store.project_root(project, &manifest)?;
            let (_, undo) = store.load_undo(project)?;
            let undo_root = store.undo_snapshot_root(project, &undo);
            let plan_target = transaction_entries_to_plan_target(&undo.before, &undo_root)?;
            let plan = store.make_plan_from_target(
                project,
                &root,
                &manifest,
                &plan_target,
                &undo.environment_id,
            )?;
            if plan.token != request.plan_token {
                return Ok(ApplyResponse {
                    applied: false,
                    stale: true,
                    plan,
                    undo_available: true,
                });
            }
            let key_dir = store.key_dir(&project.profile_id, &project.project_id);
            let target =
                transaction_entries_to_snapshot(&undo.before, &undo_root, &key_dir.join("blobs"))?;
            let snapshot_dirs = store.undo_snapshot_dirs(project)?;
            let response = store.commit_apply_target(
                project,
                &root,
                &manifest,
                &target,
                &plan,
                UndoIntent::Remove(snapshot_dirs),
                &request.operation_id,
                "undo",
                progress,
            )?;
            let _ = store.cleanup_unreferenced_blobs(project, &manifest);
            Ok(response)
        })
    }

    pub(super) fn undo_exists(&self, project: &ProjectRef) -> bool {
        self.key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_FILE)
            .exists()
    }

    pub(super) fn load_undo(&self, project: &ProjectRef) -> Result<(PathBuf, UndoRecord), String> {
        let path = self
            .key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_FILE);
        let bytes = fs::read(&path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "没有可撤销的环境变更".to_string()
            } else {
                io_error(error)
            }
        })?;
        let undo =
            serde_json::from_slice(&bytes).map_err(|error| format!("撤销数据损坏: {}", error))?;
        Ok((path, undo))
    }

    pub(super) fn undo_snapshot_root(&self, project: &ProjectRef, undo: &UndoRecord) -> PathBuf {
        let dir = self.key_dir(&project.profile_id, &project.project_id);
        undo.snapshot_dir
            .as_deref()
            .map(|relative| dir.join(relative))
            .unwrap_or_else(|| dir.join("undo"))
    }

    pub(super) fn make_plan(
        &self,
        project: &ProjectRef,
        root: &Path,
        manifest: &Manifest,
        environment_id: &str,
    ) -> Result<ApplyPlan, String> {
        let env = find_environment(manifest, environment_id)?;
        let target = snapshot_from_environment(env)?;
        self.make_plan_from_target(project, root, manifest, &target, environment_id)
    }

    pub(super) fn make_plan_from_target(
        &self,
        project: &ProjectRef,
        root: &Path,
        manifest: &Manifest,
        target: &BTreeMap<String, SnapshotEntry>,
        environment_id: &str,
    ) -> Result<ApplyPlan, String> {
        if target.len() != manifest.managed_paths.len()
            || manifest
                .managed_paths
                .iter()
                .any(|path| !target.contains_key(path))
            || target
                .keys()
                .any(|path| !manifest.managed_paths.iter().any(|managed| managed == path))
        {
            return Err("环境快照与受管清单不一致".to_string());
        }
        let current = self.read_current(root, &manifest.managed_paths)?;
        self.make_plan_with_current(project, manifest, target, environment_id, &current)
    }

    pub(super) fn make_plan_with_current(
        &self,
        project: &ProjectRef,
        manifest: &Manifest,
        target: &BTreeMap<String, SnapshotEntry>,
        environment_id: &str,
        current: &BTreeMap<String, CurrentEntry>,
    ) -> Result<ApplyPlan, String> {
        let mut changes = Vec::with_capacity(manifest.managed_paths.len());
        for path in &manifest.managed_paths {
            let now = current
                .get(path)
                .ok_or_else(|| "当前文件状态缺失".to_string())?;
            let wanted = target
                .get(path)
                .ok_or_else(|| format!("环境缺少受管文件 {}", path))?;
            let action = match (&now.state, &wanted.state) {
                (SnapshotState::Absent, SnapshotState::Present) => ChangeAction::Create,
                (SnapshotState::Present, SnapshotState::Absent) => ChangeAction::Delete,
                (SnapshotState::Present, SnapshotState::Present) if now.digest != wanted.digest => {
                    ChangeAction::Overwrite
                }
                _ => ChangeAction::Unchanged,
            };
            changes.push(PlanChange {
                path: path.clone(),
                action,
                current_state: now.state.clone(),
                target_state: wanted.state.clone(),
                current_digest: now.digest.clone(),
                target_digest: wanted.digest.clone(),
                target_size: wanted.size,
            });
        }
        let token = plan_token(project, manifest.generation, environment_id, current);
        Ok(ApplyPlan {
            token,
            profile_id: project.profile_id.clone(),
            project_id: project.project_id.clone(),
            environment_id: environment_id.to_string(),
            generation: manifest.generation,
            changes,
        })
    }

    pub(super) fn read_current(
        &self,
        root: &Path,
        paths: &[String],
    ) -> Result<BTreeMap<String, CurrentEntry>, String> {
        let mut result = BTreeMap::new();
        for path in paths {
            let full = resolve_safe_path(root, path)?;
            match fs::symlink_metadata(&full) {
                Ok(metadata) if metadata.is_dir() => {
                    return Err(format!("受管路径不是普通文件: {}", path))
                }
                Ok(metadata) => {
                    if is_reparse_metadata(&metadata) {
                        return Err(format!("受管路径包含重解析点: {}", path));
                    }
                    if !metadata.is_file() {
                        return Err(format!("受管路径不是普通文件: {}", path));
                    }
                    let bytes = fs::read(&full).map_err(io_error)?;
                    result.insert(
                        path.clone(),
                        CurrentEntry {
                            size: Some(bytes.len() as u64),
                            digest: Some(digest_bytes(&bytes)),
                            state: SnapshotState::Present,
                            bytes: Some(bytes),
                        },
                    );
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    result.insert(
                        path.clone(),
                        CurrentEntry {
                            state: SnapshotState::Absent,
                            digest: None,
                            size: None,
                            bytes: None,
                        },
                    );
                }
                Err(error) => return Err(io_error(error)),
            }
        }
        Ok(result)
    }

    pub(super) fn capture_entries(
        &self,
        root: &Path,
        paths: &[String],
        env_id: &str,
        staging: &Path,
        operation_id: &str,
        project: &ProjectRef,
        progress: ProgressCallback<'_>,
    ) -> Result<BTreeMap<String, SnapshotEntry>, String> {
        let current = self.read_current(root, paths)?;
        let mut entries = BTreeMap::new();
        for (index, path) in paths.iter().enumerate() {
            let item = current.get(path).unwrap();
            let entry = if let Some(bytes) = &item.bytes {
                let name = unique_blob_name(env_id, path);
                let blob_path = staging.join(&name);
                atomic_write(&blob_path, bytes)?;
                SnapshotEntry {
                    path: path.clone(),
                    state: SnapshotState::Present,
                    digest: item.digest.clone(),
                    size: item.size,
                    blob: Some(name),
                }
            } else {
                SnapshotEntry {
                    path: path.clone(),
                    state: SnapshotState::Absent,
                    digest: None,
                    size: None,
                    blob: None,
                }
            };
            entries.insert(path.clone(), entry);
            if index + 1 < paths.len() {
                report_progress(
                    progress,
                    operation_id,
                    project,
                    env_id,
                    "capture",
                    index + 1,
                    paths.len(),
                );
            }
        }
        Ok(entries)
    }

    pub(super) fn copy_entries(
        &self,
        source: &BTreeMap<String, SnapshotEntry>,
        env_id: &str,
        dir: &Path,
        staging: &Path,
    ) -> Result<BTreeMap<String, SnapshotEntry>, String> {
        let mut result = BTreeMap::new();
        for (path, old) in source {
            let mut entry = old.clone();
            entry.path = path.clone();
            if old.state == SnapshotState::Present {
                let bytes = self.read_blob_entry(dir, old)?;
                let name = unique_blob_name(env_id, path);
                atomic_write(&staging.join(&name), &bytes)?;
                entry.blob = Some(name);
            }
            result.insert(path.clone(), entry);
        }
        Ok(result)
    }

    pub(super) fn read_blob_entry(
        &self,
        dir: &Path,
        entry: &SnapshotEntry,
    ) -> Result<Vec<u8>, String> {
        let name = entry
            .blob
            .as_ref()
            .ok_or_else(|| "环境快照缺少文件内容".to_string())?;
        let digest_name = name.strip_prefix("undo-").unwrap_or(name);
        if digest_name.len() != 68
            || !digest_name.ends_with(".bin")
            || !digest_name[..64]
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err("环境快照文件名无效".to_string());
        }
        let bytes = fs::read(dir.join("blobs").join(name)).map_err(io_error)?;
        if Some(digest_bytes(&bytes)) != entry.digest || Some(bytes.len() as u64) != entry.size {
            return Err("环境快照校验失败".to_string());
        }
        Ok(bytes)
    }

    pub(super) fn read_snapshot_detail(
        &self,
        project: &ProjectRef,
        entry: &SnapshotEntry,
    ) -> Result<EnvironmentFileContent, String> {
        validate_relative_path(&entry.path)?;
        let bytes = match entry.state {
            SnapshotState::Absent => {
                if entry.digest.is_some() || entry.size.is_some() || entry.blob.is_some() {
                    return Err("环境快照完整性校验失败".to_string());
                }
                return Ok(EnvironmentFileContent {
                    state: EnvironmentFileState::Absent,
                    content: None,
                });
            }
            SnapshotState::Present => self.read_blob_entry(
                &self.key_dir(&project.profile_id, &project.project_id),
                entry,
            )?,
        };
        Ok(file_content_from_bytes(bytes))
    }

    pub(super) fn commit_apply(
        &self,
        project: &ProjectRef,
        root: &Path,
        manifest: &Manifest,
        env: &EnvironmentRecord,
        plan: &ApplyPlan,
        operation_id: &str,
        progress: ProgressCallback<'_>,
    ) -> Result<ApplyResponse, String> {
        let target = snapshot_from_environment(env)?;
        self.commit_apply_target(
            project,
            root,
            manifest,
            &target,
            plan,
            UndoIntent::Publish(env.id.as_str()),
            operation_id,
            "apply",
            progress,
        )
    }

    pub(super) fn commit_apply_target(
        &self,
        project: &ProjectRef,
        root: &Path,
        manifest: &Manifest,
        target: &BTreeMap<String, SnapshotEntry>,
        plan: &ApplyPlan,
        undo_intent: UndoIntent<'_>,
        operation_id: &str,
        operation_kind: &str,
        progress: ProgressCallback<'_>,
    ) -> Result<ApplyResponse, String> {
        let dir = self.ensure_dir(project)?;
        let current = self.read_current(root, &manifest.managed_paths)?;
        let current_plan =
            self.make_plan_with_current(project, manifest, target, &plan.environment_id, &current)?;
        if current_plan.token != plan.token {
            return Ok(ApplyResponse {
                applied: false,
                stale: true,
                plan: current_plan,
                undo_available: self.undo_exists(project),
            });
        }
        let tx_id = new_id("tx");
        let stage = dir.join("staging").join(&tx_id);
        fs::create_dir_all(stage.join("before")).map_err(io_error)?;
        fs::create_dir_all(stage.join("target")).map_err(io_error)?;
        let before = stage_entries_from_current(&current, &stage.join("before"))
            .map_err(|error| format!("准备恢复快照失败: {}", error))?;
        let target_entries = self
            .stage_target(target, &stage.join("target"), &dir)
            .map_err(|error| format!("准备目标快照失败: {}", error))?;
        let pending_undo = match undo_intent {
            UndoIntent::Publish(environment_id) => match self.stage_undo_publish(
                project,
                &tx_id,
                &before,
                &target_entries,
                &stage,
                environment_id,
            ) {
                Ok(action) => action,
                Err(error) => {
                    let _ = fs::remove_dir_all(&stage);
                    return Err(error);
                }
            },
            UndoIntent::Remove(snapshot_dirs) => {
                PendingUndoAction::RemoveExisting { snapshot_dirs }
            }
        };
        let mut tx = StoredTransaction {
            id: tx_id.clone(),
            phase: TransactionPhase::Prepared,
            root_path: root.to_string_lossy().to_string(),
            before: before.clone(),
            target: target_entries.clone(),
            undo_environment_id: match &pending_undo {
                PendingUndoAction::PublishNew { record, .. } => Some(record.environment_id.clone()),
                _ => None,
            },
            pending_undo,
        };
        self.save_transaction(project, &tx)?;
        tx.phase = TransactionPhase::Committing;
        self.save_transaction(project, &tx)?;
        report_progress(
            progress,
            operation_id,
            project,
            &plan.environment_id,
            operation_kind,
            0,
            target_entries.len(),
        );
        let result = self.apply_entries(
            root,
            &target_entries,
            &stage,
            operation_id,
            project,
            &plan.environment_id,
            operation_kind,
            progress,
        );
        match result {
            Ok(()) => {
                tx.phase = TransactionPhase::Completed;
                match self.save_transaction(project, &tx) {
                    Ok(()) => {
                        if std::env::var_os("EASYPACK_ENV_CRASH_AFTER_COMPLETED").is_some() {
                            return Err("测试注入的完成后中断".to_string());
                        }
                        match self.complete_pending_undo(project, &tx.pending_undo) {
                            Ok(()) => {
                                report_progress(
                                    progress,
                                    operation_id,
                                    project,
                                    &plan.environment_id,
                                    operation_kind,
                                    target_entries.len(),
                                    target_entries.len(),
                                );
                                // 完成标记和 undo 动作都已持久化并完成。清理失败时保留事务记录，启动时会继续清理。
                                let _ = self.cleanup_transaction(project, &tx_id);
                                Ok(ApplyResponse {
                                    applied: true,
                                    stale: false,
                                    plan: plan.clone(),
                                    undo_available: matches!(
                                        tx.pending_undo,
                                        PendingUndoAction::PublishNew { .. }
                                    ),
                                })
                            }
                            Err(error) => {
                                let _ = self.mark_blocked(project);
                                Err(format!(
                                    "环境已应用，但撤销数据发布失败，项目已锁定: {}",
                                    error
                                ))
                            }
                        }
                    }
                    Err(error) => match self.rollback_apply(project, &mut tx, &before, &stage) {
                        Ok(()) => Err(format!("应用后处理失败，项目已恢复: {}", error)),
                        Err(rollback_error) => Err(format!(
                            "应用后处理失败且恢复失败，项目已锁定: {}",
                            rollback_error
                        )),
                    },
                }
            }
            Err(error) => match self.rollback_apply(project, &mut tx, &before, &stage) {
                Ok(()) => Err(format!("应用环境失败，项目已恢复: {}", error)),
                Err(rollback_error) => {
                    Err(format!("应用和恢复均失败，项目已锁定: {}", rollback_error))
                }
            },
        }
    }

    pub(super) fn rollback_apply(
        &self,
        project: &ProjectRef,
        tx: &mut StoredTransaction,
        before: &[TransactionEntry],
        stage: &Path,
    ) -> Result<(), String> {
        tx.phase = TransactionPhase::RollingBack;
        let _ = atomic_write(
            &self.transaction_path(project),
            &serde_json::to_vec_pretty(tx).map_err(|e| e.to_string())?,
        );
        let restore_result =
            self.restore_entries(&self.ensure_root(&tx.root_path)?, before, &tx.target, stage);
        match restore_result {
            Ok(()) => {
                self.cleanup_transaction(project, &tx.id)?;
                Ok(())
            }
            Err(error) => {
                tx.phase = TransactionPhase::RollbackFailed;
                let _ = atomic_write(
                    &self.transaction_path(project),
                    &serde_json::to_vec_pretty(tx).unwrap_or_default(),
                );
                let _ = self.mark_blocked(project);
                Err(error)
            }
        }
    }

    pub(super) fn stage_target(
        &self,
        target: &BTreeMap<String, SnapshotEntry>,
        staging: &Path,
        dir: &Path,
    ) -> Result<Vec<TransactionEntry>, String> {
        let mut result = Vec::new();
        for (path, entry) in target {
            let (staging_name, size) = if entry.state == SnapshotState::Present {
                let bytes = self.read_blob_entry(dir, entry)?;
                let name = unique_blob_name("target", path);
                atomic_write(&staging.join(&name), &bytes)?;
                (Some(name), Some(bytes.len() as u64))
            } else {
                (None, None)
            };
            result.push(TransactionEntry {
                path: path.clone(),
                state: entry.state.clone(),
                digest: entry.digest.clone(),
                size: size.or(entry.size),
                staging: staging_name,
            });
        }
        Ok(result)
    }

    pub(super) fn apply_entries(
        &self,
        root: &Path,
        entries: &[TransactionEntry],
        stage: &Path,
        operation_id: &str,
        project: &ProjectRef,
        environment_id: &str,
        operation_kind: &str,
        progress: ProgressCallback<'_>,
    ) -> Result<(), String> {
        let key = std::env::var("EASYPACK_ENV_FAIL_AFTER")
            .ok()
            .and_then(|value| value.parse::<usize>().ok());
        for (index, entry) in entries.iter().enumerate() {
            if key == Some(index) {
                return Err("测试注入的写入失败".to_string());
            }
            let full = resolve_safe_path(root, &entry.path)?;
            match entry.state {
                SnapshotState::Present => {
                    let stage_name = entry
                        .staging
                        .as_ref()
                        .ok_or_else(|| "事务缺少目标内容".to_string())?;
                    let source = stage.join("target").join(stage_name);
                    replace_file_from(&source, &full)?;
                }
                SnapshotState::Absent => match fs::symlink_metadata(&full) {
                    Ok(meta) if meta.is_dir() || is_reparse_metadata(&meta) => {
                        return Err(format!("无法删除受管路径: {}", entry.path))
                    }
                    Ok(_) => fs::remove_file(&full).map_err(io_error)?,
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(error) => return Err(io_error(error)),
                },
            }
            if index + 1 < entries.len() {
                report_progress(
                    progress,
                    operation_id,
                    project,
                    environment_id,
                    operation_kind,
                    index + 1,
                    entries.len(),
                );
            }
        }
        let actual = self.read_current(
            root,
            &entries.iter().map(|e| e.path.clone()).collect::<Vec<_>>(),
        )?;
        for entry in entries {
            let got = actual
                .get(&entry.path)
                .ok_or_else(|| "应用后缺少文件状态".to_string())?;
            if got.state != entry.state || got.digest != entry.digest {
                return Err(format!("应用后校验失败: {}", entry.path));
            }
        }
        Ok(())
    }

    pub(super) fn restore_entries(
        &self,
        root: &Path,
        entries: &[TransactionEntry],
        target: &[TransactionEntry],
        stage: &Path,
    ) -> Result<(), String> {
        let current = self.read_current(
            root,
            &entries
                .iter()
                .map(|entry| entry.path.clone())
                .collect::<Vec<_>>(),
        )?;
        for entry in entries {
            let target_entry = target
                .iter()
                .find(|item| item.path == entry.path)
                .ok_or_else(|| format!("事务缺少目标状态: {}", entry.path))?;
            let now = current
                .get(&entry.path)
                .ok_or_else(|| format!("当前文件状态缺失: {}", entry.path))?;
            if Self::current_matches_transaction(now, entry) {
                continue;
            }
            if !Self::current_matches_transaction(now, target_entry) {
                return Err(format!("检测到外部修改，无法安全恢复: {}", entry.path));
            }
            let full = resolve_safe_path(root, &entry.path)?;
            match entry.state {
                SnapshotState::Present => {
                    let source = stage.join("before").join(
                        entry
                            .staging
                            .as_ref()
                            .ok_or_else(|| "事务缺少恢复内容".to_string())?,
                    );
                    replace_file_from(&source, &full)?;
                }
                SnapshotState::Absent => match fs::symlink_metadata(&full) {
                    Ok(meta) if meta.is_file() && !is_reparse_metadata(&meta) => {
                        fs::remove_file(&full).map_err(io_error)?
                    }
                    Ok(_) => return Err(format!("无法恢复受管路径: {}", entry.path)),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(error) => return Err(io_error(error)),
                },
            }
        }
        let actual = self.read_current(
            root,
            &entries
                .iter()
                .map(|entry| entry.path.clone())
                .collect::<Vec<_>>(),
        )?;
        for entry in entries {
            let got = actual
                .get(&entry.path)
                .ok_or_else(|| "恢复后缺少文件状态".to_string())?;
            if got.state != entry.state || got.digest != entry.digest {
                return Err(format!("恢复后校验失败: {}", entry.path));
            }
        }
        Ok(())
    }

    pub(super) fn current_matches_transaction(
        current: &CurrentEntry,
        expected: &TransactionEntry,
    ) -> bool {
        current.state == expected.state
            && current.digest == expected.digest
            && current.size == expected.size
    }
}
