use super::model::report_progress;
use super::model::{
    BootstrapEnvironment, BootstrapImportRequest, CreateEnvironmentRequest, CurrentEntry,
    DeletionPhase, DeletionProject, DeletionRecord, DeletionTombstone, EnvironmentDetailRequest,
    EnvironmentDetailResponse, EnvironmentRecord, EnvironmentRequest, EnvironmentSummary, Manifest,
    MigrateManifestRequest, PendingUndoAction, ProfileIndex, ProgressCallback, ProjectPathRequest,
    ProjectRef, ProjectState, RebindProjectRequest, SnapshotEntry, SnapshotState,
    StoredTransaction, TransactionEntry, TransactionPhase, UndoRecord,
};
use super::path::{
    atomic_write, blob_name, digest_bytes, ensure_project_root, io_error, is_reparse_metadata,
    mark_blocked_path, new_id, normalize_paths, read_current_detail, resolve_safe_path,
    unique_blob_name, validate_environment_name, validate_operation_id,
};
use super::validate_relative_path;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

pub(super) const SCHEMA_VERSION: u32 = 1;
pub(super) const TX_FILE: &str = "transaction.json";
pub(super) const UNDO_FILE: &str = "undo.json";
pub(super) const PROFILE_INDEX_FILE: &str = "profile-index.json";
pub(super) const DELETION_DIR: &str = "deletions";
pub(super) const DELETION_TOMBSTONE_DIR: &str = "deletion-tombstones";
pub(super) const DELETION_BLOCKED_SUFFIX: &str = ".blocked";
pub(super) const UNDO_SNAPSHOT_DIR: &str = "undo-snapshots";
pub(super) const BLOCKED_FILE: &str = "rollback-failed";
pub(super) const RECOVERY_ERROR_CODE: &str = "rollback-failed";
pub(super) const BLOCKED_MESSAGE: &str = "项目存在未恢复完成的事务，已锁定";

pub(super) static PROJECT_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();
pub(super) static DELETION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Clone, Debug)]
pub struct EnvironmentStore {
    pub(super) root: PathBuf,
}

impl EnvironmentStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn key_for(profile_id: &str, project_id: &str) -> String {
        digest_bytes(format!("{}\0{}", profile_id, project_id).as_bytes())
    }

    pub(super) fn key_dir(&self, profile_id: &str, project_id: &str) -> PathBuf {
        self.root.join(Self::key_for(profile_id, project_id))
    }

    pub(super) fn lock_for(&self, profile_id: &str, project_id: &str) -> Arc<Mutex<()>> {
        let map = PROJECT_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
        let key = format!("{}\0{}\0{}", self.root.display(), profile_id, project_id);
        let mut locks = map.lock().unwrap_or_else(|e| e.into_inner());
        locks
            .entry(key)
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    pub(super) fn deletion_lock() -> &'static Mutex<()> {
        DELETION_LOCK.get_or_init(|| Mutex::new(()))
    }

    pub(super) fn with_lock<T>(
        &self,
        project: &ProjectRef,
        f: impl FnOnce(&Self) -> Result<T, String>,
    ) -> Result<T, String> {
        // Every environment operation takes the global deletion lock first,
        // then its project lock. Deletion uses the same order for all targets.
        let _deletion_guard = Self::deletion_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let lock = self.lock_for(&project.profile_id, &project.project_id);
        let _guard = lock.lock().unwrap_or_else(|e| e.into_inner());
        f(self)
    }

    pub(super) fn ensure_dir(&self, project: &ProjectRef) -> Result<PathBuf, String> {
        let dir = self.key_dir(&project.profile_id, &project.project_id);
        fs::create_dir_all(dir.join("blobs")).map_err(io_error)?;
        fs::create_dir_all(dir.join("staging")).map_err(io_error)?;
        Ok(dir)
    }

    pub(super) fn profile_index_path(&self) -> PathBuf {
        self.root.join(PROFILE_INDEX_FILE)
    }

    pub(super) fn load_profile_index(&self) -> Result<ProfileIndex, String> {
        let path = self.profile_index_path();
        if !path.exists() {
            return Ok(ProfileIndex {
                profiles: BTreeMap::new(),
            });
        }
        let bytes = fs::read(path).map_err(io_error)?;
        serde_json::from_slice(&bytes).map_err(|_| "环境索引损坏".to_string())
    }

    pub(super) fn save_profile_index(&self, index: &ProfileIndex) -> Result<(), String> {
        if std::env::var_os("EASYPACK_ENV_FAIL_DELETE_INDEX").is_some() {
            return Err("测试注入的删除索引写入失败".to_string());
        }
        let bytes = serde_json::to_vec_pretty(index).map_err(|e| e.to_string())?;
        atomic_write(&self.profile_index_path(), &bytes)
    }

    pub(super) fn register_project(&self, project: &ProjectRef) -> Result<(), String> {
        let mut index = self.load_profile_index()?;
        index
            .profiles
            .entry(project.profile_id.clone())
            .or_default()
            .insert(
                project.project_id.clone(),
                Self::key_for(&project.profile_id, &project.project_id),
            );
        self.save_profile_index(&index)
    }

    pub(super) fn project_path(
        &self,
        request: &ProjectPathRequest,
    ) -> Result<Option<String>, String> {
        let index = self.load_profile_index()?;
        let Some(key) = index
            .profiles
            .get(&request.profile_id)
            .and_then(|projects| projects.get(&request.project_id))
        else {
            return Ok(None);
        };
        if key != &Self::key_for(&request.profile_id, &request.project_id) {
            return Err("环境索引项目标识无效".to_string());
        }
        let manifest_path = self.root.join(key).join("manifest.json");
        let bytes = match fs::read(manifest_path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(io_error(error)),
        };
        let manifest: Manifest =
            serde_json::from_slice(&bytes).map_err(|_| "环境数据损坏".to_string())?;
        if manifest.profile_id != request.profile_id
            || manifest.project_id != request.project_id
            || manifest.schema_version != SCHEMA_VERSION
        {
            return Err("环境数据所属项目不匹配".to_string());
        }
        Ok(Some(manifest.root_path))
    }

    pub(super) fn unregister_projects(&self, projects: &[DeletionProject]) -> Result<(), String> {
        let mut index = self.load_profile_index()?;
        for project in projects {
            let remove_profile = if let Some(items) = index.profiles.get_mut(&project.profile_id) {
                items.remove(&project.project_id);
                items.is_empty()
            } else {
                false
            };
            if remove_profile {
                index.profiles.remove(&project.profile_id);
            }
        }
        self.save_profile_index(&index)
    }

    pub(super) fn register_projects(&self, projects: &[DeletionProject]) -> Result<(), String> {
        let mut index = self.load_profile_index()?;
        for project in projects {
            index
                .profiles
                .entry(project.profile_id.clone())
                .or_default()
                .insert(project.project_id.clone(), project.key.clone());
        }
        self.save_profile_index(&index)
    }

    pub(super) fn manifest_path(&self, project: &ProjectRef) -> PathBuf {
        self.key_dir(&project.profile_id, &project.project_id)
            .join("manifest.json")
    }

    pub(super) fn transaction_path(&self, project: &ProjectRef) -> PathBuf {
        self.key_dir(&project.profile_id, &project.project_id)
            .join(TX_FILE)
    }

    pub(super) fn blocked_path(&self, project: &ProjectRef) -> PathBuf {
        self.key_dir(&project.profile_id, &project.project_id)
            .join(BLOCKED_FILE)
    }

    pub(super) fn deletion_tombstone_path(&self, key: &str) -> PathBuf {
        self.root
            .join(DELETION_TOMBSTONE_DIR)
            .join(format!("{}.json", key))
    }

    pub(super) fn deletion_tombstone_token_exists(&self, token: &str) -> Result<bool, String> {
        let dir = self.root.join(DELETION_TOMBSTONE_DIR);
        if !dir.exists() {
            return Ok(false);
        }
        for item in fs::read_dir(dir).map_err(io_error)? {
            let item = item.map_err(io_error)?;
            if !item.file_type().map_err(io_error)?.is_file() {
                continue;
            }
            let bytes = fs::read(item.path()).map_err(io_error)?;
            if serde_json::from_slice::<DeletionTombstone>(&bytes)
                .ok()
                .is_some_and(|tombstone| tombstone.token == token)
            {
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub(super) fn deletion_blocked_path(&self, token: &str) -> PathBuf {
        self.root
            .join(DELETION_DIR)
            .join(format!("{}{}", token, DELETION_BLOCKED_SUFFIX))
    }

    pub(super) fn is_tombstoned(&self, project: &ProjectRef) -> bool {
        self.deletion_tombstone_path(&Self::key_for(&project.profile_id, &project.project_id))
            .exists()
    }

    pub(super) fn ensure_not_tombstoned(&self, project: &ProjectRef) -> Result<(), String> {
        if self.is_tombstoned(project) {
            return Err("项目正在删除事务中，请先完成恢复或删除".to_string());
        }
        Ok(())
    }

    pub(super) fn mark_blocked(&self, project: &ProjectRef) -> Result<(), String> {
        mark_blocked_path(&self.blocked_path(project))
    }

    pub(super) fn load_manifest(&self, project: &ProjectRef) -> Result<Manifest, String> {
        let bytes = fs::read(self.manifest_path(project)).map_err(io_error)?;
        self.parse_manifest(project, &bytes)
    }

    pub(super) fn load_manifest_if_exists(
        &self,
        project: &ProjectRef,
    ) -> Result<Option<Manifest>, String> {
        let bytes = match fs::read(self.manifest_path(project)) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(io_error(error)),
        };
        Ok(Some(self.parse_manifest(project, &bytes)?))
    }

    pub(super) fn parse_manifest(
        &self,
        project: &ProjectRef,
        bytes: &[u8],
    ) -> Result<Manifest, String> {
        let manifest: Manifest =
            serde_json::from_slice(&bytes).map_err(|e| format!("环境数据损坏: {}", e))?;
        if manifest.profile_id != project.profile_id || manifest.project_id != project.project_id {
            return Err("环境数据所属项目不匹配".to_string());
        }
        if manifest.schema_version != SCHEMA_VERSION {
            return Err("不支持的环境数据版本".to_string());
        }
        Ok(manifest)
    }

    pub(super) fn save_manifest(
        &self,
        project: &ProjectRef,
        manifest: &Manifest,
    ) -> Result<(), String> {
        let bytes =
            serde_json::to_vec_pretty(manifest).map_err(|e| format!("无法保存环境数据: {}", e))?;
        atomic_write(&self.manifest_path(project), &bytes)
    }

    pub(super) fn ensure_root(&self, project_path: &str) -> Result<PathBuf, String> {
        let root = PathBuf::from(project_path);
        ensure_project_root(&root)?;
        Ok(root)
    }

    pub(super) fn project_root(
        &self,
        project: &ProjectRef,
        manifest: &Manifest,
    ) -> Result<PathBuf, String> {
        let _ = project;
        self.ensure_root(&manifest.root_path)
    }

    pub(super) fn ensure_ready(&self, project: &ProjectRef) -> Result<(), String> {
        self.ensure_not_tombstoned(project)?;
        if self.transaction_path(project).exists() {
            self.recover_locked(project)?;
        }
        if self.blocked_path(project).exists() {
            return Err(BLOCKED_MESSAGE.to_string());
        }
        Ok(())
    }

    pub(super) fn recover_locked(&self, project: &ProjectRef) -> Result<(), String> {
        let tx_path = self.transaction_path(project);
        let bytes = match fs::read(&tx_path) {
            Ok(bytes) => bytes,
            Err(_) => {
                let _ = self.mark_blocked(project);
                return Err(RECOVERY_ERROR_CODE.to_string());
            }
        };
        let mut tx: StoredTransaction = match serde_json::from_slice(&bytes) {
            Ok(transaction) => transaction,
            Err(_) => {
                let _ = self.mark_blocked(project);
                return Err(RECOVERY_ERROR_CODE.to_string());
            }
        };
        if tx.phase == TransactionPhase::Completed {
            if let Err(error) = self.complete_pending_undo(project, &tx.pending_undo) {
                let _ = self.mark_blocked(project);
                return Err(format!("撤销数据发布失败，项目已提交并锁定: {}", error));
            }
            return self.cleanup_transaction(project, &tx.id);
        }
        if tx.phase == TransactionPhase::Prepared {
            // Prepared only records durable staging. No project file was changed.
            return self.cleanup_transaction(project, &tx.id);
        }
        let root = if tx.root_path.is_empty() {
            match self
                .load_manifest(project)
                .and_then(|manifest| self.ensure_root(&manifest.root_path))
            {
                Ok(root) => root,
                Err(error) => {
                    let _ = self.mark_blocked(project);
                    return Err(error);
                }
            }
        } else {
            match self.ensure_root(&tx.root_path) {
                Ok(root) => root,
                Err(error) => {
                    let _ = self.mark_blocked(project);
                    return Err(error);
                }
            }
        };
        tx.phase = TransactionPhase::RollingBack;
        if let Err(error) = atomic_write(
            &tx_path,
            &serde_json::to_vec_pretty(&tx).map_err(|e| e.to_string())?,
        ) {
            let _ = self.mark_blocked(project);
            return Err(error);
        }
        let stage = self
            .key_dir(&project.profile_id, &project.project_id)
            .join("staging")
            .join(&tx.id);
        match self.restore_entries(&root, &tx.before, &tx.target, &stage) {
            Ok(()) => {
                self.cleanup_transaction(project, &tx.id)?;
                Ok(())
            }
            Err(error) => {
                tx.phase = TransactionPhase::RollbackFailed;
                let _ = atomic_write(
                    &tx_path,
                    &serde_json::to_vec_pretty(&tx).unwrap_or_default(),
                );
                let _ = self.mark_blocked(project);
                Err(format!("事务恢复失败，项目已锁定: {}", error))
            }
        }
    }

    pub(super) fn cleanup_transaction(&self, project: &ProjectRef, id: &str) -> Result<(), String> {
        let path = self.transaction_path(project);
        if path.exists() {
            fs::remove_file(path).map_err(io_error)?;
        }
        let dir = self
            .key_dir(&project.profile_id, &project.project_id)
            .join("staging")
            .join(id);
        if dir.exists() {
            fs::remove_dir_all(dir).map_err(io_error)?;
        }
        let blocked = self.blocked_path(project);
        if blocked.exists() {
            fs::remove_file(blocked).map_err(io_error)?;
        }
        Ok(())
    }

    pub(super) fn save_transaction(
        &self,
        project: &ProjectRef,
        transaction: &StoredTransaction,
    ) -> Result<(), String> {
        if transaction.phase == TransactionPhase::Completed
            && std::env::var_os("EASYPACK_ENV_FAIL_COMPLETED").is_some()
        {
            return Err("测试注入的完成事务写入失败".to_string());
        }
        atomic_write(
            &self.transaction_path(project),
            &serde_json::to_vec_pretty(transaction).map_err(|e| e.to_string())?,
        )
    }

    pub(super) fn data_path(
        &self,
        project: &ProjectRef,
        relative: &str,
    ) -> Result<PathBuf, String> {
        validate_relative_path(relative)?;
        Ok(self
            .key_dir(&project.profile_id, &project.project_id)
            .join(relative))
    }

    pub(super) fn undo_snapshot_dirs(&self, project: &ProjectRef) -> Result<Vec<String>, String> {
        let root = self
            .key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_SNAPSHOT_DIR);
        if !root.exists() {
            return Ok(Vec::new());
        }
        let mut result = Vec::new();
        for item in fs::read_dir(root).map_err(io_error)? {
            let item = item.map_err(io_error)?;
            if item.file_type().map_err(io_error)?.is_dir() {
                result.push(format!(
                    "{}/{}",
                    UNDO_SNAPSHOT_DIR,
                    item.file_name().to_string_lossy()
                ));
            }
        }
        result.sort();
        Ok(result)
    }

    pub(super) fn stage_undo_publish(
        &self,
        project: &ProjectRef,
        tx_id: &str,
        before: &[TransactionEntry],
        after: &[TransactionEntry],
        stage: &Path,
        environment_id: &str,
    ) -> Result<PendingUndoAction, String> {
        if std::env::var_os("EASYPACK_ENV_FAIL_UNDO").is_some() {
            return Err("测试注入的撤销记录失败".to_string());
        }
        let snapshot_id = new_id("undo");
        let staging_root = stage.join("undo").join(&snapshot_id);
        let before_dir = staging_root.join("before");
        fs::create_dir_all(&before_dir).map_err(io_error)?;
        for entry in before {
            if let Some(name) = &entry.staging {
                let bytes = fs::read(stage.join("before").join(name)).map_err(io_error)?;
                atomic_write(&before_dir.join(name), &bytes)?;
            }
        }
        let snapshot_dir = format!("{}/{}", UNDO_SNAPSHOT_DIR, snapshot_id);
        let record = UndoRecord {
            environment_id: environment_id.to_string(),
            before: before.to_vec(),
            after: after.to_vec(),
            snapshot_dir: Some(snapshot_dir.clone()),
        };
        Ok(PendingUndoAction::PublishNew {
            staging_dir: format!("staging/{}/undo/{}", tx_id, snapshot_id),
            final_dir: snapshot_dir,
            record,
            old_snapshot_dirs: self.undo_snapshot_dirs(project)?,
        })
    }

    pub(super) fn complete_pending_undo(
        &self,
        project: &ProjectRef,
        action: &PendingUndoAction,
    ) -> Result<(), String> {
        match action {
            PendingUndoAction::Noop => Ok(()),
            PendingUndoAction::PublishNew {
                staging_dir,
                final_dir,
                record,
                old_snapshot_dirs,
            } => {
                let staging = self.data_path(project, staging_dir)?;
                let final_root = self.data_path(project, final_dir)?;
                match (staging.exists(), final_root.exists()) {
                    (true, false) => {
                        if let Some(parent) = final_root.parent() {
                            fs::create_dir_all(parent).map_err(io_error)?;
                        }
                        fs::rename(&staging, &final_root).map_err(io_error)?;
                    }
                    (false, true) => {}
                    (true, true) => {
                        fs::remove_dir_all(&staging).map_err(io_error)?;
                    }
                    (false, false) => return Err("撤销数据暂存目录不存在".to_string()),
                }
                if !final_root.is_dir() {
                    return Err("撤销数据发布目录无效".to_string());
                }
                let undo_path = self
                    .key_dir(&project.profile_id, &project.project_id)
                    .join(UNDO_FILE);
                let bytes = serde_json::to_vec_pretty(record).map_err(|e| e.to_string())?;
                let already_published = fs::read(&undo_path)
                    .map(|existing| existing == bytes)
                    .unwrap_or(false);
                if !already_published {
                    if std::env::var_os("EASYPACK_ENV_FAIL_UNDO_PUBLISH").is_some() {
                        return Err("测试注入的撤销切换失败".to_string());
                    }
                    atomic_write(&undo_path, &bytes)?;
                }
                for old_dir in old_snapshot_dirs {
                    if old_dir == final_dir {
                        continue;
                    }
                    let old_root = self.data_path(project, old_dir)?;
                    if old_root.exists() {
                        if std::env::var_os("EASYPACK_ENV_FAIL_UNDO_CLEANUP").is_some() {
                            return Err("测试注入的旧撤销目录清理失败".to_string());
                        }
                        fs::remove_dir_all(old_root).map_err(io_error)?;
                    }
                }
                Ok(())
            }
            PendingUndoAction::RemoveExisting { snapshot_dirs } => {
                let undo_path = self
                    .key_dir(&project.profile_id, &project.project_id)
                    .join(UNDO_FILE);
                if undo_path.exists() {
                    fs::remove_file(undo_path).map_err(io_error)?;
                }
                for snapshot_dir in snapshot_dirs {
                    let path = self.data_path(project, snapshot_dir)?;
                    if path.exists() {
                        fs::remove_dir_all(path).map_err(io_error)?;
                    }
                }
                Ok(())
            }
        }
    }

    pub fn open_project(&self, project: &ProjectRef) -> Result<ProjectState, String> {
        self.with_lock(project, |store| {
            store.ensure_not_tombstoned(project)?;
            let recovery_failed = if store.transaction_path(project).exists() {
                store.recover_locked(project).is_err()
            } else {
                store.blocked_path(project).exists()
            };
            if recovery_failed {
                // Keep the lock marker durable, but never expose its contents.
                let _ = store.mark_blocked(project);
            }
            let Some(manifest) = store.load_manifest_if_exists(project)? else {
                if recovery_failed {
                    return Err(RECOVERY_ERROR_CODE.to_string());
                }
                store.ensure_root(&project.project_path)?;
                return Ok(ProjectState {
                    profile_id: project.profile_id.clone(),
                    project_id: project.project_id.clone(),
                    project_path: project.project_path.clone(),
                    managed_paths: Vec::new(),
                    environments: Vec::new(),
                    undo_available: false,
                    blocked: false,
                    recovery_error: None,
                });
            };
            let _ = store.project_root(project, &manifest)?;
            let mut state = store.to_project_state(project, &manifest);
            state.blocked = recovery_failed || store.blocked_path(project).exists();
            state.recovery_error = state.blocked.then(|| RECOVERY_ERROR_CODE.to_string());
            Ok(state)
        })
    }

    /// Restore interrupted project transactions during application startup.
    /// A failed project stays locked and its evidence remains on disk; other
    /// projects continue to be recovered independently.
    pub(super) fn recover_deletions_locked(&self) -> Result<(), String> {
        let deletion_dir = self.root.join(DELETION_DIR);
        if !deletion_dir.exists() {
            return Ok(());
        }
        let mut records = fs::read_dir(&deletion_dir)
            .map_err(io_error)?
            .filter_map(|item| item.ok().map(|item| item.path()))
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
            .collect::<Vec<_>>();
        records.sort();
        let mut failures = Vec::new();
        for path in records {
            let token = match path.file_stem().and_then(|value| value.to_str()) {
                Some(token) if !token.is_empty() => token.to_string(),
                _ => {
                    failures.push(RECOVERY_ERROR_CODE.to_string());
                    continue;
                }
            };
            let bytes = match fs::read(&path) {
                Ok(bytes) => bytes,
                Err(error) => {
                    self.mark_deletion_blocked(&token);
                    failures.push(io_error(error));
                    continue;
                }
            };
            let record: DeletionRecord = match serde_json::from_slice(&bytes) {
                Ok(record) => record,
                Err(_) => {
                    self.mark_deletion_blocked(&token);
                    failures.push("删除事务数据损坏".to_string());
                    continue;
                }
            };
            if let Err(error) = self.validate_deletion_record(&record, &token) {
                self.mark_deletion_blocked(&token);
                failures.push(error);
                continue;
            }
            let locks: Vec<_> = record
                .projects
                .iter()
                .map(|project| self.lock_for(&project.profile_id, &project.project_id))
                .collect();
            let _guards: Vec<_> = locks
                .iter()
                .map(|lock| lock.lock().unwrap_or_else(|e| e.into_inner()))
                .collect();
            let result = match record.phase.clone() {
                DeletionPhase::Prepared => self.ensure_deletion_tombstones(&record),
                DeletionPhase::Finalizing => self.finalize_delete_locked(&path, record),
                DeletionPhase::Finalized => self.cleanup_deletion_artifacts(&path, &record, true),
            };
            if let Err(error) = result {
                self.mark_deletion_blocked(&token);
                failures.push(error);
            }
        }
        if failures.is_empty() {
            Ok(())
        } else {
            Err(format!("{} 个删除事务恢复失败", failures.len()))
        }
    }

    pub fn recover_startup(&self) -> Result<(), String> {
        if !self.root.exists() {
            return Ok(());
        }
        let mut failures = Vec::new();
        {
            let _deletion_guard = Self::deletion_lock()
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            if let Err(error) = self.recover_deletions_locked() {
                failures.push(error);
            }
        }
        for item in fs::read_dir(&self.root).map_err(io_error)? {
            let item = item.map_err(io_error)?;
            if !item.file_type().map_err(io_error)?.is_dir() {
                continue;
            }
            let tx_path = item.path().join(TX_FILE);
            if !tx_path.exists() {
                continue;
            }
            let manifest_path = item.path().join("manifest.json");
            let manifest = match fs::read(&manifest_path)
                .ok()
                .and_then(|bytes| serde_json::from_slice::<Manifest>(&bytes).ok())
            {
                Some(manifest) => manifest,
                None => {
                    // The transaction cannot identify its project by itself. The
                    // existing data directory is the remaining project context.
                    let _ = mark_blocked_path(&item.path().join(BLOCKED_FILE));
                    failures.push(RECOVERY_ERROR_CODE.to_string());
                    continue;
                }
            };
            let project = ProjectRef {
                profile_id: manifest.profile_id,
                project_id: manifest.project_id,
                project_path: manifest.root_path,
            };
            let result = self.with_lock(&project, |store| store.ensure_ready(&project));
            if let Err(error) = result {
                failures.push(error);
            }
        }
        if failures.is_empty() {
            Ok(())
        } else {
            Err(format!("{} 个项目的环境事务恢复失败", failures.len()))
        }
    }

    pub(super) fn to_project_state(
        &self,
        project: &ProjectRef,
        manifest: &Manifest,
    ) -> ProjectState {
        ProjectState {
            profile_id: manifest.profile_id.clone(),
            project_id: manifest.project_id.clone(),
            project_path: manifest.root_path.clone(),
            managed_paths: manifest.managed_paths.clone(),
            environments: manifest
                .environments
                .iter()
                .map(|e| EnvironmentSummary {
                    id: e.id.clone(),
                    name: e.name.clone(),
                    file_count: e.entries.len(),
                })
                .collect(),
            undo_available: self
                .key_dir(&project.profile_id, &project.project_id)
                .join(UNDO_FILE)
                .exists(),
            blocked: self.blocked_path(project).exists(),
            recovery_error: None,
        }
    }

    pub(super) fn begin_blob_staging(
        &self,
        project: &ProjectRef,
    ) -> Result<(String, PathBuf), String> {
        let dir = self.ensure_dir(project)?;
        let id = new_id("blob-stage");
        let stage = dir.join("staging").join(&id).join("blobs");
        fs::create_dir_all(&stage).map_err(io_error)?;
        Ok((id, stage))
    }

    pub(super) fn cleanup_capture_failure(
        &self,
        project: &ProjectRef,
        operation_id: &str,
        previous_manifest: &Manifest,
    ) {
        let operation_dir = self
            .key_dir(&project.profile_id, &project.project_id)
            .join("staging")
            .join(operation_id);
        let _ = fs::remove_dir_all(operation_dir);
        // A publish may have moved some staged blobs before the manifest write
        // failed.  The previous manifest is still authoritative in that case.
        let _ = self.cleanup_unreferenced_blobs(project, previous_manifest);
    }

    pub(super) fn publish_blob_staging(
        &self,
        project: &ProjectRef,
        stage: &Path,
        operation_id: &str,
    ) -> Result<(), String> {
        let dir = self.ensure_dir(project)?;
        for item in fs::read_dir(stage).map_err(io_error)? {
            let item = item.map_err(io_error)?;
            if !item.file_type().map_err(io_error)?.is_file() {
                continue;
            }
            let destination = dir.join("blobs").join(item.file_name());
            // Names are operation-unique, so publishing never replaces an old blob.
            fs::rename(item.path(), destination).map_err(io_error)?;
        }
        let operation_dir = dir.join("staging").join(operation_id);
        if operation_dir.exists() {
            fs::remove_dir_all(operation_dir).map_err(io_error)?;
        }
        Ok(())
    }

    pub(super) fn cleanup_unreferenced_blobs(
        &self,
        project: &ProjectRef,
        manifest: &Manifest,
    ) -> Result<(), String> {
        let referenced: std::collections::HashSet<String> = manifest
            .environments
            .iter()
            .flat_map(|environment| environment.entries.values())
            .filter_map(|entry| entry.blob.clone())
            .collect();
        let blobs = self
            .key_dir(&project.profile_id, &project.project_id)
            .join("blobs");
        if !blobs.exists() {
            return Ok(());
        }
        for item in fs::read_dir(blobs).map_err(io_error)? {
            let item = item.map_err(io_error)?;
            if item.file_type().map_err(io_error)?.is_file()
                && !referenced.contains(&item.file_name().to_string_lossy().to_string())
            {
                fs::remove_file(item.path()).map_err(io_error)?;
            }
        }
        Ok(())
    }

    pub(super) fn save_manifest_and_publish(
        &self,
        project: &ProjectRef,
        manifest: &Manifest,
        stage: Option<(&Path, &str)>,
    ) -> Result<(), String> {
        if std::env::var_os("EASYPACK_ENV_FAIL_MANIFEST").is_some() {
            return Err("测试注入的环境清单发布失败".to_string());
        }
        if let Some((stage_path, operation_id)) = stage {
            self.publish_blob_staging(project, stage_path, operation_id)?;
        }
        self.save_manifest(project, manifest)?;
        // 清理只是回收旧文件；清理失败不影响已发布且可校验的新清单。
        let _ = self.cleanup_unreferenced_blobs(project, manifest);
        Ok(())
    }

    pub fn create_environment(
        &self,
        request: &CreateEnvironmentRequest,
    ) -> Result<ProjectState, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let root = store.ensure_root(&request.project.project_path)?;
            let paths = normalize_paths(&request.managed_paths)?;
            if paths.is_empty() {
                return Err("至少需要一个受管文件".to_string());
            }
            validate_environment_name(&request.name)?;
            let dir = store.key_dir(&request.project.profile_id, &request.project.project_id);
            if store.manifest_path(&request.project).exists() {
                let mut manifest = store.load_manifest(&request.project)?;
                if manifest.managed_paths != paths {
                    return Err("已有项目的受管清单不同，请先完成清单迁移".to_string());
                }
                if manifest
                    .environments
                    .iter()
                    .any(|environment| environment.name == request.name)
                {
                    return Err("环境名称已存在".to_string());
                }
                let id = new_id("env");
                let (stage_id, stage) = store.begin_blob_staging(&request.project)?;
                let entries = store.capture_entries(
                    &root,
                    &paths,
                    &id,
                    &stage,
                    &stage_id,
                    &request.project,
                    None,
                )?;
                manifest.environments.push(EnvironmentRecord {
                    id,
                    name: request.name.clone(),
                    entries,
                });
                manifest.generation = manifest.generation.saturating_add(1);
                store.save_manifest_and_publish(
                    &request.project,
                    &manifest,
                    Some((&stage, &stage_id)),
                )?;
                store.register_project(&request.project)?;
                return Ok(store.to_project_state(&request.project, &manifest));
            }
            fs::create_dir_all(dir.join("blobs")).map_err(io_error)?;
            let id = new_id("env");
            let (stage_id, stage) = store.begin_blob_staging(&request.project)?;
            let entries = store.capture_entries(
                &root,
                &paths,
                &id,
                &stage,
                &stage_id,
                &request.project,
                None,
            )?;
            let manifest = Manifest {
                schema_version: SCHEMA_VERSION,
                profile_id: request.project.profile_id.clone(),
                project_id: request.project.project_id.clone(),
                root_path: root.to_string_lossy().to_string(),
                managed_paths: paths,
                environments: vec![EnvironmentRecord {
                    id,
                    name: request.name.clone(),
                    entries,
                }],
                generation: 1,
            };
            store.save_manifest_and_publish(
                &request.project,
                &manifest,
                Some((&stage, &stage_id)),
            )?;
            store.register_project(&request.project)?;
            Ok(store.to_project_state(&request.project, &manifest))
        })
    }

    pub fn capture_environment(
        &self,
        request: &EnvironmentRequest,
    ) -> Result<ProjectState, String> {
        self.capture_environment_with_progress(request, None)
    }

    pub fn capture_environment_with_progress(
        &self,
        request: &EnvironmentRequest,
        progress: ProgressCallback<'_>,
    ) -> Result<ProjectState, String> {
        validate_operation_id(&request.operation_id)?;
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let mut manifest = store.load_manifest(&request.project)?;
            let root = store.project_root(&request.project, &manifest)?;
            let managed_paths = manifest.managed_paths.clone();
            let env_id = find_environment(&manifest, &request.environment_id)?
                .id
                .clone();
            let (stage_id, stage) = store.begin_blob_staging(&request.project)?;
            let old_manifest = manifest.clone();
            report_progress(
                progress,
                &request.operation_id,
                &request.project,
                &env_id,
                "capture",
                0,
                managed_paths.len(),
            );
            let result = (|| {
                let entries = store.capture_entries(
                    &root,
                    &managed_paths,
                    &env_id,
                    &stage,
                    &request.operation_id,
                    &request.project,
                    progress,
                )?;
                find_environment_mut(&mut manifest, &request.environment_id)?.entries = entries;
                manifest.generation = manifest.generation.saturating_add(1);
                store.save_manifest_and_publish(
                    &request.project,
                    &manifest,
                    Some((&stage, &stage_id)),
                )?;
                report_progress(
                    progress,
                    &request.operation_id,
                    &request.project,
                    &env_id,
                    "capture",
                    managed_paths.len(),
                    managed_paths.len(),
                );
                Ok(store.to_project_state(&request.project, &manifest))
            })();
            if result.is_err() {
                store.cleanup_capture_failure(&request.project, &stage_id, &old_manifest);
            }
            result
        })
    }

    pub fn environment_detail(
        &self,
        request: &EnvironmentDetailRequest,
    ) -> Result<EnvironmentDetailResponse, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let manifest = store.load_manifest(&request.project)?;
            let path = request.path.replace('\\', "/");
            validate_relative_path(&path)?;
            if !manifest
                .managed_paths
                .iter()
                .any(|managed| managed == &path)
            {
                return Err("文件不属于受管清单".to_string());
            }
            let environment = find_environment(&manifest, &request.environment_id)?;
            let profile_id = manifest.profile_id.clone();
            let project_id = manifest.project_id.clone();
            let environment_id = environment.id.clone();
            let entry = environment
                .entries
                .get(&path)
                .ok_or_else(|| "环境快照缺少受管文件".to_string())?;
            if entry.path != path {
                return Err("环境快照路径不一致".to_string());
            }
            let snapshot = store.read_snapshot_detail(&request.project, entry)?;
            let root = store.project_root(&request.project, &manifest)?;
            let current = read_current_detail(&root, &path)?;
            Ok(EnvironmentDetailResponse {
                profile_id,
                project_id,
                environment_id,
                path,
                snapshot,
                current,
            })
        })
    }

    pub fn current_file_path(&self, request: &EnvironmentDetailRequest) -> Result<PathBuf, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let manifest = store.load_manifest(&request.project)?;
            let path = request.path.replace('\\', "/");
            validate_relative_path(&path)?;
            if !manifest
                .managed_paths
                .iter()
                .any(|managed| managed == &path)
            {
                return Err("文件不属于受管清单".to_string());
            }
            let environment = find_environment(&manifest, &request.environment_id)?;
            let entry = environment
                .entries
                .get(&path)
                .ok_or_else(|| "环境快照缺少受管文件".to_string())?;
            if entry.path != path {
                return Err("环境快照路径不一致".to_string());
            }
            let root = store.project_root(&request.project, &manifest)?;
            let full = resolve_safe_path(&root, &path)?;
            match fs::symlink_metadata(&full) {
                Ok(metadata) if metadata.is_dir() => Err(format!("受管路径不是普通文件: {}", path)),
                Ok(metadata) if is_reparse_metadata(&metadata) => {
                    Err(format!("受管路径包含重解析点: {}", path))
                }
                Ok(metadata) if !metadata.is_file() => {
                    Err(format!("受管路径不是普通文件: {}", path))
                }
                Ok(_) => Ok(full),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    Err(format!("受管文件不存在: {}", path))
                }
                Err(error) => Err(io_error(error)),
            }
        })
    }

    pub fn copy_environment(
        &self,
        request: &EnvironmentRequest,
        name: &str,
    ) -> Result<ProjectState, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            validate_environment_name(name)?;
            let mut manifest = store.load_manifest(&request.project)?;
            let source = find_environment(&manifest, &request.environment_id)?.clone();
            if manifest.environments.iter().any(|e| e.name == name) {
                return Err("环境名称已存在".to_string());
            }
            let id = new_id("env");
            let (stage_id, stage) = store.begin_blob_staging(&request.project)?;
            let dir = store.key_dir(&request.project.profile_id, &request.project.project_id);
            let entries = store.copy_entries(&source.entries, &id, &dir, &stage)?;
            manifest.environments.push(EnvironmentRecord {
                id,
                name: name.to_string(),
                entries,
            });
            manifest.generation = manifest.generation.saturating_add(1);
            store.save_manifest_and_publish(
                &request.project,
                &manifest,
                Some((&stage, &stage_id)),
            )?;
            Ok(store.to_project_state(&request.project, &manifest))
        })
    }

    pub fn delete_environment(&self, request: &EnvironmentRequest) -> Result<ProjectState, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let mut manifest = store
                .load_manifest_if_exists(&request.project)?
                .ok_or_else(|| "项目环境不存在".to_string())?;
            let index = manifest
                .environments
                .iter()
                .position(|environment| environment.id == request.environment_id)
                .ok_or_else(|| "环境不存在".to_string())?;
            manifest.environments.remove(index);
            manifest.generation = manifest.generation.saturating_add(1);
            store.save_manifest(&request.project, &manifest)?;
            // The manifest is the source of truth; reclaim blobs no longer
            // referenced by the remaining environments after publishing it.
            let _ = store.cleanup_unreferenced_blobs(&request.project, &manifest);
            Ok(store.to_project_state(&request.project, &manifest))
        })
    }

    pub fn migrate_manifest(
        &self,
        request: &MigrateManifestRequest,
    ) -> Result<ProjectState, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let mut manifest = store.load_manifest(&request.project)?;
            let paths = normalize_paths(&request.managed_paths)?;
            let old_paths: std::collections::BTreeSet<_> =
                manifest.managed_paths.iter().cloned().collect();
            let new_paths: std::collections::BTreeSet<_> = paths.iter().cloned().collect();
            let old_undo_snapshot_dirs = if old_paths != new_paths {
                Some(store.undo_snapshot_dirs(&request.project)?)
            } else {
                None
            };
            for env in &manifest.environments {
                let migration = request
                    .environments
                    .iter()
                    .find(|item| item.environment_id == env.id)
                    .ok_or_else(|| format!("环境 {} 缺少迁移内容", env.id))?;
                for path in new_paths.difference(&old_paths) {
                    if !migration.entries.iter().any(|entry| entry.path == *path) {
                        return Err(format!("环境 {} 未提供新增路径 {}", env.name, path));
                    }
                }
            }
            let (stage_id, stage) = store.begin_blob_staging(&request.project)?;
            for env in &mut manifest.environments {
                let migration = request
                    .environments
                    .iter()
                    .find(|item| item.environment_id == env.id)
                    .unwrap();
                let mut entries = BTreeMap::new();
                for path in &paths {
                    if let Some(old) = env.entries.get(path) {
                        if old_paths.contains(path) {
                            entries.insert(path.clone(), old.clone());
                            continue;
                        }
                    }
                    let item = migration
                        .entries
                        .iter()
                        .find(|item| item.path == *path)
                        .unwrap();
                    let entry = entry_from_bytes(
                        path,
                        &env.id,
                        &stage,
                        &item.state,
                        item.content.as_deref(),
                    )?;
                    entries.insert(path.clone(), entry);
                }
                env.entries = entries;
            }
            manifest.managed_paths = paths;
            manifest.generation = manifest.generation.saturating_add(1);
            store.save_manifest_and_publish(
                &request.project,
                &manifest,
                Some((&stage, &stage_id)),
            )?;
            if let Some(snapshot_dirs) = old_undo_snapshot_dirs {
                // 清单已提交后，撤销记录是一次性缓存；记录已删时仅快照回收失败不影响迁移结果。
                if let Err(error) = store.complete_pending_undo(
                    &request.project,
                    &PendingUndoAction::RemoveExisting { snapshot_dirs },
                ) {
                    if store.undo_exists(&request.project) {
                        return Err(format!("环境清单已保存，但旧撤销记录清理失败: {}", error));
                    }
                }
            }
            Ok(store.to_project_state(&request.project, &manifest))
        })
    }

    pub fn bootstrap_import(
        &self,
        request: &BootstrapImportRequest,
    ) -> Result<ProjectState, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let paths = normalize_paths(&request.managed_paths)?;
            if paths.is_empty() || request.environments.is_empty() {
                return Err("导入必须包含受管清单和至少一个环境".to_string());
            }
            let root = store.ensure_root(&request.project.project_path)?;
            validate_bootstrap_environments(&paths, &request.environments)?;

            if store.manifest_path(&request.project).exists() {
                let manifest = store.load_manifest(&request.project)?;
                if bootstrap_matches_manifest(
                    &manifest,
                    &root,
                    &paths,
                    &request.environments,
                    store,
                )? {
                    // An earlier publish may have succeeded while index repair
                    // failed. Keep the idempotent path retryable and observable.
                    store.register_project(&request.project)?;
                    return Ok(store.to_project_state(&request.project, &manifest));
                }
                return Err("已有环境清单与旧数据不一致，拒绝覆盖".to_string());
            }

            let (stage_id, stage) = store.begin_blob_staging(&request.project)?;
            let environments = request
                .environments
                .iter()
                .map(|item| {
                    let mut entries = BTreeMap::new();
                    for migration in &item.entries {
                        let entry = entry_from_bytes(
                            &migration.path,
                            &item.environment_id,
                            &stage,
                            &migration.state,
                            migration.content.as_deref(),
                        )?;
                        entries.insert(migration.path.replace('\\', "/"), entry);
                    }
                    Ok::<EnvironmentRecord, String>(EnvironmentRecord {
                        id: item.environment_id.clone(),
                        name: item.name.clone(),
                        entries,
                    })
                })
                .collect::<Result<Vec<_>, _>>()?;
            let manifest = Manifest {
                schema_version: SCHEMA_VERSION,
                profile_id: request.project.profile_id.clone(),
                project_id: request.project.project_id.clone(),
                root_path: root.to_string_lossy().to_string(),
                managed_paths: paths,
                environments,
                generation: 1,
            };
            store.save_manifest_and_publish(
                &request.project,
                &manifest,
                Some((&stage, &stage_id)),
            )?;
            store.register_project(&request.project)?;
            Ok(store.to_project_state(&request.project, &manifest))
        })
    }

    pub fn rebind_project(&self, request: &RebindProjectRequest) -> Result<ProjectState, String> {
        self.with_lock(&request.project, |store| {
            store.ensure_ready(&request.project)?;
            let root = store.ensure_root(&request.new_project_path)?;
            let mut manifest = store.load_manifest(&request.project)?;
            manifest.root_path = root.to_string_lossy().to_string();
            manifest.generation = manifest.generation.saturating_add(1);
            store.save_manifest(&request.project, &manifest)?;
            Ok(store.to_project_state(&request.project, &manifest))
        })
    }
}

pub(super) fn snapshot_from_environment(
    env: &EnvironmentRecord,
) -> Result<BTreeMap<String, SnapshotEntry>, String> {
    for (path, entry) in &env.entries {
        validate_relative_path(path)?;
        if entry.path != *path {
            return Err(format!("环境快照路径不一致: {}", path));
        }
        if entry.state == SnapshotState::Present
            && (entry.digest.is_none() || entry.size.is_none() || entry.blob.is_none())
        {
            return Err(format!("环境快照缺少文件内容: {}", path));
        }
    }
    Ok(env.entries.clone())
}

pub(super) fn transaction_entries_to_snapshot(
    entries: &[TransactionEntry],
    undo_dir: &Path,
    blob_dir: &Path,
) -> Result<BTreeMap<String, SnapshotEntry>, String> {
    let mut result = BTreeMap::new();
    for item in entries {
        let blob = if item.state == SnapshotState::Present {
            let name = item
                .staging
                .as_ref()
                .ok_or_else(|| "撤销数据缺少文件内容".to_string())?;
            let bytes = fs::read(undo_dir.join("before").join(name)).map_err(io_error)?;
            let blob_name = unique_blob_name("undo-plan", &item.path);
            atomic_write(&blob_dir.join(&blob_name), &bytes)?;
            Some(blob_name)
        } else {
            None
        };
        result.insert(
            item.path.clone(),
            SnapshotEntry {
                path: item.path.clone(),
                state: item.state.clone(),
                digest: item.digest.clone(),
                size: item.size,
                blob,
            },
        );
    }
    Ok(result)
}

pub(super) fn transaction_entries_to_plan_target(
    entries: &[TransactionEntry],
    undo_dir: &Path,
) -> Result<BTreeMap<String, SnapshotEntry>, String> {
    let mut result = BTreeMap::new();
    for item in entries {
        validate_relative_path(&item.path)?;
        let blob = if item.state == SnapshotState::Present {
            let name = item
                .staging
                .as_ref()
                .ok_or_else(|| "撤销数据缺少文件内容".to_string())?;
            let bytes = fs::read(undo_dir.join("before").join(name)).map_err(io_error)?;
            if Some(digest_bytes(&bytes)) != item.digest || Some(bytes.len() as u64) != item.size {
                return Err("撤销数据校验失败".to_string());
            }
            None
        } else {
            None
        };
        result.insert(
            item.path.clone(),
            SnapshotEntry {
                path: item.path.clone(),
                state: item.state.clone(),
                digest: item.digest.clone(),
                size: item.size,
                blob,
            },
        );
    }
    Ok(result)
}

pub(super) fn stage_entries_from_current(
    current: &BTreeMap<String, CurrentEntry>,
    stage: &Path,
) -> Result<Vec<TransactionEntry>, String> {
    let mut result: Vec<TransactionEntry> = Vec::new();
    for (path, item) in current {
        let staging = if let Some(bytes) = &item.bytes {
            let name = blob_name("before", path);
            let destination = stage.join(&name);
            atomic_write(&destination, bytes)
                .map_err(|error| format!("暂存路径 {}: {}", destination.display(), error))?;
            Some(name)
        } else {
            None
        };
        result.push(TransactionEntry {
            path: path.clone(),
            state: item.state.clone(),
            digest: item.digest.clone(),
            size: item.size,
            staging,
        });
    }
    Ok(result)
}

pub(super) fn entry_from_bytes(
    path: &str,
    env_id: &str,
    staging: &Path,
    state: &SnapshotState,
    content: Option<&[u8]>,
) -> Result<SnapshotEntry, String> {
    match state {
        SnapshotState::Absent => Ok(SnapshotEntry {
            path: path.to_string(),
            state: SnapshotState::Absent,
            digest: None,
            size: None,
            blob: None,
        }),
        SnapshotState::Present => {
            let bytes = content.ok_or_else(|| format!("新增路径 {} 缺少内容", path))?;
            let name = unique_blob_name(env_id, path);
            atomic_write(&staging.join(&name), bytes)?;
            Ok(SnapshotEntry {
                path: path.to_string(),
                state: SnapshotState::Present,
                digest: Some(digest_bytes(bytes)),
                size: Some(bytes.len() as u64),
                blob: Some(name),
            })
        }
    }
}

pub(super) fn validate_bootstrap_environments(
    paths: &[String],
    environments: &[BootstrapEnvironment],
) -> Result<(), String> {
    let expected: std::collections::BTreeSet<String> = paths.iter().cloned().collect();
    let mut ids = std::collections::BTreeSet::new();
    let mut names = std::collections::BTreeSet::new();
    for environment in environments {
        if environment.environment_id.trim().is_empty()
            || !ids.insert(environment.environment_id.clone())
        {
            return Err("导入环境 ID 重复或为空".to_string());
        }
        validate_environment_name(&environment.name)?;
        if !names.insert(environment.name.clone()) {
            return Err("导入环境名称重复".to_string());
        }
        let mut seen = std::collections::BTreeSet::new();
        for item in &environment.entries {
            validate_relative_path(&item.path)?;
            let path = item.path.replace('\\', "/");
            if !expected.contains(&path) || !seen.insert(path.clone()) {
                return Err(format!("导入环境包含无效或重复路径 {}", item.path));
            }
            if item.state == SnapshotState::Present && item.content.is_none() {
                return Err(format!(
                    "导入环境 {} 的路径 {} 缺少内容",
                    environment.name, path
                ));
            }
            if item.state == SnapshotState::Absent && item.content.is_some() {
                return Err(format!("不存在的路径 {} 不应包含内容", path));
            }
        }
        if seen != expected {
            return Err(format!("导入环境 {} 的条目不完整", environment.name));
        }
    }
    Ok(())
}

pub(super) fn bootstrap_matches_manifest(
    manifest: &Manifest,
    root: &Path,
    paths: &[String],
    environments: &[BootstrapEnvironment],
    store: &EnvironmentStore,
) -> Result<bool, String> {
    if manifest.root_path != root.to_string_lossy()
        || manifest.managed_paths != paths
        || manifest.environments.len() != environments.len()
    {
        return Ok(false);
    }
    let dir = store.key_dir(&manifest.profile_id, &manifest.project_id);
    for imported in environments {
        let Some(existing) = manifest
            .environments
            .iter()
            .find(|environment| environment.id == imported.environment_id)
        else {
            return Ok(false);
        };
        if existing.name != imported.name {
            return Ok(false);
        }
        for item in &imported.entries {
            let path = item.path.replace('\\', "/");
            let Some(entry) = existing.entries.get(&path) else {
                return Ok(false);
            };
            if entry.state != item.state {
                return Ok(false);
            }
            if item.state == SnapshotState::Present {
                let bytes = store.read_blob_entry(&dir, entry)?;
                if item.content.as_deref() != Some(bytes.as_slice()) {
                    return Ok(false);
                }
            }
        }
    }
    Ok(true)
}

pub(super) fn find_environment<'a>(
    manifest: &'a Manifest,
    id: &str,
) -> Result<&'a EnvironmentRecord, String> {
    manifest
        .environments
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| "环境不存在".to_string())
}

pub(super) fn find_environment_mut<'a>(
    manifest: &'a mut Manifest,
    id: &str,
) -> Result<&'a mut EnvironmentRecord, String> {
    manifest
        .environments
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| "环境不存在".to_string())
}
