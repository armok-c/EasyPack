//! Project environment snapshots.
//!
//! This module deliberately treats file bodies as opaque bytes.  The on-disk
//! format is private to the application and is kept below the application
//! local-data directory, never in the project directory.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const DATA_DIR: &str = "environment-data";
const SCHEMA_VERSION: u32 = 1;
const TX_FILE: &str = "transaction.json";
const UNDO_FILE: &str = "undo.json";
const PROFILE_INDEX_FILE: &str = "profile-index.json";
const DELETION_DIR: &str = "deletions";
const DELETION_TOMBSTONE_DIR: &str = "deletion-tombstones";
const DELETION_BLOCKED_SUFFIX: &str = ".blocked";
const UNDO_SNAPSHOT_DIR: &str = "undo-snapshots";
const BLOCKED_FILE: &str = "rollback-failed";
const RECOVERY_ERROR_CODE: &str = "rollback-failed";
const BLOCKED_MESSAGE: &str = "项目存在未恢复完成的事务，已锁定";

static PROJECT_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();
static DELETION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static ID_COUNTER: OnceLock<Mutex<u64>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SnapshotState {
    Present,
    Absent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    pub path: String,
    pub state: SnapshotState,
    pub digest: Option<String>,
    pub size: Option<u64>,
    pub blob: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentRecord {
    pub id: String,
    pub name: String,
    pub entries: BTreeMap<String, SnapshotEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub schema_version: u32,
    pub profile_id: String,
    pub project_id: String,
    pub root_path: String,
    pub managed_paths: Vec<String>,
    pub environments: Vec<EnvironmentRecord>,
    pub generation: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRef {
    pub profile_id: String,
    pub project_id: String,
    pub project_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentSummary {
    pub id: String,
    pub name: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectState {
    pub profile_id: String,
    pub project_id: String,
    pub project_path: String,
    pub managed_paths: Vec<String>,
    pub environments: Vec<EnvironmentSummary>,
    pub undo_available: bool,
    pub blocked: bool,
    /// Sanitized recovery evidence. Never contains transaction or file bodies.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeAction {
    Create,
    Overwrite,
    Delete,
    Unchanged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanChange {
    pub path: String,
    pub action: ChangeAction,
    pub current_state: SnapshotState,
    pub target_state: SnapshotState,
    pub current_digest: Option<String>,
    pub target_digest: Option<String>,
    pub target_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPlan {
    pub token: String,
    pub profile_id: String,
    pub project_id: String,
    pub environment_id: String,
    pub generation: u64,
    pub changes: Vec<PlanChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResponse {
    pub applied: bool,
    pub stale: bool,
    pub plan: ApplyPlan,
    pub undo_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEnvironmentRequest {
    pub project: ProjectRef,
    pub name: String,
    pub managed_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentRequest {
    pub project: ProjectRef,
    pub environment_id: String,
    pub operation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EnvironmentFileState {
    Text,
    Absent,
    NonUtf8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentFileContent {
    pub state: EnvironmentFileState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentDetailRequest {
    pub project: ProjectRef,
    pub environment_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentDetailResponse {
    pub profile_id: String,
    pub project_id: String,
    pub environment_id: String,
    pub path: String,
    pub snapshot: EnvironmentFileContent,
    pub current: EnvironmentFileContent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentProgressEvent {
    pub operation_id: String,
    pub profile_id: String,
    pub project_id: String,
    pub environment_id: String,
    pub kind: String,
    pub completed_files: usize,
    pub total_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyRequest {
    pub project: ProjectRef,
    pub environment_id: String,
    pub plan_token: String,
    pub operation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoRequest {
    pub project: ProjectRef,
    pub plan_token: String,
    pub operation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationEntry {
    pub path: String,
    pub state: SnapshotState,
    #[serde(default)]
    pub content: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationEnvironment {
    pub environment_id: String,
    pub entries: Vec<MigrationEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateManifestRequest {
    pub project: ProjectRef,
    pub managed_paths: Vec<String>,
    pub environments: Vec<MigrationEnvironment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapEnvironment {
    pub environment_id: String,
    pub name: String,
    pub entries: Vec<MigrationEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapImportRequest {
    pub project: ProjectRef,
    pub managed_paths: Vec<String>,
    pub environments: Vec<BootstrapEnvironment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebindProjectRequest {
    pub project: ProjectRef,
    pub new_project_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDeleteRequest {
    pub profile_id: String,
    pub project_id: String,
    #[serde(default)]
    pub operation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileDeleteRequest {
    pub profile_id: String,
    #[serde(default)]
    pub operation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPathRequest {
    pub profile_id: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFinalizeRequest {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRestoreRequest {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStatusRequest {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub token: String,
    pub project_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStatusResponse {
    pub status: String,
    pub kind: String,
    pub profile_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredTransaction {
    id: String,
    phase: TransactionPhase,
    #[serde(default)]
    root_path: String,
    before: Vec<TransactionEntry>,
    target: Vec<TransactionEntry>,
    undo_environment_id: Option<String>,
    #[serde(default)]
    pending_undo: PendingUndoAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum TransactionPhase {
    Prepared,
    Committing,
    Completed,
    RollingBack,
    RollbackFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransactionEntry {
    path: String,
    state: SnapshotState,
    digest: Option<String>,
    size: Option<u64>,
    staging: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UndoRecord {
    environment_id: String,
    before: Vec<TransactionEntry>,
    after: Vec<TransactionEntry>,
    #[serde(default)]
    snapshot_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum PendingUndoAction {
    Noop,
    PublishNew {
        staging_dir: String,
        final_dir: String,
        record: UndoRecord,
        old_snapshot_dirs: Vec<String>,
    },
    RemoveExisting {
        snapshot_dirs: Vec<String>,
    },
}

impl Default for PendingUndoAction {
    fn default() -> Self {
        Self::Noop
    }
}

enum UndoIntent<'a> {
    Publish(&'a str),
    Remove(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileIndex {
    profiles: BTreeMap<String, BTreeMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum DeletionKind {
    Project,
    Profile,
}

fn default_deletion_kind() -> DeletionKind {
    DeletionKind::Project
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum DeletionPhase {
    Prepared,
    Finalizing,
    Finalized,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeletionProject {
    profile_id: String,
    project_id: String,
    key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeletionRecord {
    id: String,
    phase: DeletionPhase,
    #[serde(default = "default_deletion_kind")]
    kind: DeletionKind,
    projects: Vec<DeletionProject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeletionTombstone {
    token: String,
    profile_id: String,
    project_id: String,
    key: String,
}

#[derive(Debug, Clone)]
struct CurrentEntry {
    state: SnapshotState,
    digest: Option<String>,
    size: Option<u64>,
    bytes: Option<Vec<u8>>,
}

type ProgressCallback<'a> = Option<&'a dyn Fn(&EnvironmentProgressEvent)>;

fn report_progress(
    callback: ProgressCallback<'_>,
    operation_id: &str,
    project: &ProjectRef,
    environment_id: &str,
    kind: &str,
    completed_files: usize,
    total_files: usize,
) {
    if let Some(callback) = callback {
        callback(&EnvironmentProgressEvent {
            operation_id: operation_id.to_string(),
            profile_id: project.profile_id.clone(),
            project_id: project.project_id.clone(),
            environment_id: environment_id.to_string(),
            kind: kind.to_string(),
            completed_files,
            total_files,
        });
    }
}

#[derive(Clone, Debug)]
pub struct EnvironmentStore {
    root: PathBuf,
}

impl EnvironmentStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn key_for(profile_id: &str, project_id: &str) -> String {
        digest_bytes(format!("{}\0{}", profile_id, project_id).as_bytes())
    }

    fn key_dir(&self, profile_id: &str, project_id: &str) -> PathBuf {
        self.root.join(Self::key_for(profile_id, project_id))
    }

    fn lock_for(&self, profile_id: &str, project_id: &str) -> Arc<Mutex<()>> {
        let map = PROJECT_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
        let key = format!("{}\0{}\0{}", self.root.display(), profile_id, project_id);
        let mut locks = map.lock().unwrap_or_else(|e| e.into_inner());
        locks
            .entry(key)
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    fn deletion_lock() -> &'static Mutex<()> {
        DELETION_LOCK.get_or_init(|| Mutex::new(()))
    }

    fn with_lock<T>(
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

    fn ensure_dir(&self, project: &ProjectRef) -> Result<PathBuf, String> {
        let dir = self.key_dir(&project.profile_id, &project.project_id);
        fs::create_dir_all(dir.join("blobs")).map_err(io_error)?;
        fs::create_dir_all(dir.join("staging")).map_err(io_error)?;
        Ok(dir)
    }

    fn profile_index_path(&self) -> PathBuf {
        self.root.join(PROFILE_INDEX_FILE)
    }

    fn load_profile_index(&self) -> Result<ProfileIndex, String> {
        let path = self.profile_index_path();
        if !path.exists() {
            return Ok(ProfileIndex {
                profiles: BTreeMap::new(),
            });
        }
        let bytes = fs::read(path).map_err(io_error)?;
        serde_json::from_slice(&bytes).map_err(|_| "环境索引损坏".to_string())
    }

    fn save_profile_index(&self, index: &ProfileIndex) -> Result<(), String> {
        if std::env::var_os("EASYPACK_ENV_FAIL_DELETE_INDEX").is_some() {
            return Err("测试注入的删除索引写入失败".to_string());
        }
        let bytes = serde_json::to_vec_pretty(index).map_err(|e| e.to_string())?;
        atomic_write(&self.profile_index_path(), &bytes)
    }

    fn register_project(&self, project: &ProjectRef) -> Result<(), String> {
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

    fn project_path(&self, request: &ProjectPathRequest) -> Result<Option<String>, String> {
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

    fn unregister_projects(&self, projects: &[DeletionProject]) -> Result<(), String> {
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

    fn register_projects(&self, projects: &[DeletionProject]) -> Result<(), String> {
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

    fn manifest_path(&self, project: &ProjectRef) -> PathBuf {
        self.key_dir(&project.profile_id, &project.project_id)
            .join("manifest.json")
    }

    fn transaction_path(&self, project: &ProjectRef) -> PathBuf {
        self.key_dir(&project.profile_id, &project.project_id)
            .join(TX_FILE)
    }

    fn blocked_path(&self, project: &ProjectRef) -> PathBuf {
        self.key_dir(&project.profile_id, &project.project_id)
            .join(BLOCKED_FILE)
    }

    fn deletion_tombstone_path(&self, key: &str) -> PathBuf {
        self.root
            .join(DELETION_TOMBSTONE_DIR)
            .join(format!("{}.json", key))
    }

    fn deletion_tombstone_token_exists(&self, token: &str) -> Result<bool, String> {
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

    fn deletion_blocked_path(&self, token: &str) -> PathBuf {
        self.root
            .join(DELETION_DIR)
            .join(format!("{}{}", token, DELETION_BLOCKED_SUFFIX))
    }

    fn is_tombstoned(&self, project: &ProjectRef) -> bool {
        self.deletion_tombstone_path(&Self::key_for(&project.profile_id, &project.project_id))
            .exists()
    }

    fn ensure_not_tombstoned(&self, project: &ProjectRef) -> Result<(), String> {
        if self.is_tombstoned(project) {
            return Err("项目正在删除事务中，请先完成恢复或删除".to_string());
        }
        Ok(())
    }

    fn mark_blocked(&self, project: &ProjectRef) -> Result<(), String> {
        mark_blocked_path(&self.blocked_path(project))
    }

    fn load_manifest(&self, project: &ProjectRef) -> Result<Manifest, String> {
        let bytes = fs::read(self.manifest_path(project)).map_err(io_error)?;
        self.parse_manifest(project, &bytes)
    }

    fn load_manifest_if_exists(&self, project: &ProjectRef) -> Result<Option<Manifest>, String> {
        let bytes = match fs::read(self.manifest_path(project)) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(io_error(error)),
        };
        Ok(Some(self.parse_manifest(project, &bytes)?))
    }

    fn parse_manifest(&self, project: &ProjectRef, bytes: &[u8]) -> Result<Manifest, String> {
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

    fn save_manifest(&self, project: &ProjectRef, manifest: &Manifest) -> Result<(), String> {
        let bytes =
            serde_json::to_vec_pretty(manifest).map_err(|e| format!("无法保存环境数据: {}", e))?;
        atomic_write(&self.manifest_path(project), &bytes)
    }

    fn ensure_root(&self, project_path: &str) -> Result<PathBuf, String> {
        let root = PathBuf::from(project_path);
        ensure_project_root(&root)?;
        Ok(root)
    }

    fn project_root(&self, project: &ProjectRef, manifest: &Manifest) -> Result<PathBuf, String> {
        let _ = project;
        self.ensure_root(&manifest.root_path)
    }

    fn ensure_ready(&self, project: &ProjectRef) -> Result<(), String> {
        self.ensure_not_tombstoned(project)?;
        if self.transaction_path(project).exists() {
            self.recover_locked(project)?;
        }
        if self.blocked_path(project).exists() {
            return Err(BLOCKED_MESSAGE.to_string());
        }
        Ok(())
    }

    fn recover_locked(&self, project: &ProjectRef) -> Result<(), String> {
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

    fn cleanup_transaction(&self, project: &ProjectRef, id: &str) -> Result<(), String> {
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

    fn save_transaction(
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

    fn data_path(&self, project: &ProjectRef, relative: &str) -> Result<PathBuf, String> {
        validate_relative_path(relative)?;
        Ok(self
            .key_dir(&project.profile_id, &project.project_id)
            .join(relative))
    }

    fn undo_snapshot_dirs(&self, project: &ProjectRef) -> Result<Vec<String>, String> {
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

    fn stage_undo_publish(
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

    fn complete_pending_undo(
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
    fn recover_deletions_locked(&self) -> Result<(), String> {
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

    fn to_project_state(&self, project: &ProjectRef, manifest: &Manifest) -> ProjectState {
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

    fn begin_blob_staging(&self, project: &ProjectRef) -> Result<(String, PathBuf), String> {
        let dir = self.ensure_dir(project)?;
        let id = new_id("blob-stage");
        let stage = dir.join("staging").join(&id).join("blobs");
        fs::create_dir_all(&stage).map_err(io_error)?;
        Ok((id, stage))
    }

    fn cleanup_capture_failure(
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

    fn publish_blob_staging(
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

    fn cleanup_unreferenced_blobs(
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

    fn save_manifest_and_publish(
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

    fn undo_exists(&self, project: &ProjectRef) -> bool {
        self.key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_FILE)
            .exists()
    }

    fn load_undo(&self, project: &ProjectRef) -> Result<(PathBuf, UndoRecord), String> {
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

    fn undo_snapshot_root(&self, project: &ProjectRef, undo: &UndoRecord) -> PathBuf {
        let dir = self.key_dir(&project.profile_id, &project.project_id);
        undo.snapshot_dir
            .as_deref()
            .map(|relative| dir.join(relative))
            .unwrap_or_else(|| dir.join("undo"))
    }

    fn make_plan(
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

    fn make_plan_from_target(
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

    fn make_plan_with_current(
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

    fn read_current(
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

    fn capture_entries(
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

    fn copy_entries(
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

    fn read_blob_entry(&self, dir: &Path, entry: &SnapshotEntry) -> Result<Vec<u8>, String> {
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

    fn read_snapshot_detail(
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

    fn commit_apply(
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

    fn commit_apply_target(
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

    fn rollback_apply(
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

    fn stage_target(
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

    fn apply_entries(
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

    fn restore_entries(
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

    fn current_matches_transaction(current: &CurrentEntry, expected: &TransactionEntry) -> bool {
        current.state == expected.state
            && current.digest == expected.digest
            && current.size == expected.size
    }

    fn deletion_record_path(&self, token: &str) -> PathBuf {
        self.root.join(DELETION_DIR).join(format!("{}.json", token))
    }

    fn checked_deletion_record_path(&self, token: &str) -> Result<PathBuf, String> {
        if validate_operation_id(token).is_err() {
            return Err("删除事务标识无效".to_string());
        }
        Ok(self.deletion_record_path(token))
    }

    fn deletion_stage_root(&self, token: &str) -> PathBuf {
        self.root.join(DELETION_DIR).join(token)
    }

    fn write_deletion_record(&self, path: &Path, record: &DeletionRecord) -> Result<(), String> {
        atomic_write(
            path,
            &serde_json::to_vec_pretty(record).map_err(|e| e.to_string())?,
        )
    }

    fn load_deletion_record(&self, token: &str) -> Result<(PathBuf, DeletionRecord), String> {
        let path = self.checked_deletion_record_path(token)?;
        let bytes = fs::read(&path).map_err(io_error)?;
        let record: DeletionRecord =
            serde_json::from_slice(&bytes).map_err(|_| "删除事务数据损坏".to_string())?;
        self.validate_deletion_record(&record, token)?;
        Ok((path, record))
    }

    fn load_deletion_record_if_exists(
        &self,
        token: &str,
    ) -> Result<Option<(PathBuf, DeletionRecord)>, String> {
        let path = self.checked_deletion_record_path(token)?;
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(io_error(error)),
        };
        let record: DeletionRecord =
            serde_json::from_slice(&bytes).map_err(|_| "删除事务数据损坏".to_string())?;
        self.validate_deletion_record(&record, token)?;
        Ok(Some((path, record)))
    }

    fn validate_deletion_record(&self, record: &DeletionRecord, token: &str) -> Result<(), String> {
        if record.id != token || record.projects.is_empty() {
            return Err("删除事务数据损坏".to_string());
        }
        let mut previous = None;
        for project in &record.projects {
            if project.key != Self::key_for(&project.profile_id, &project.project_id) {
                return Err("删除事务项目标识无效".to_string());
            }
            let current = format!(
                "{}\0{}\0{}",
                project.profile_id, project.project_id, project.key
            );
            if previous
                .as_ref()
                .is_some_and(|item: &String| item >= &current)
            {
                return Err("删除事务项目顺序无效".to_string());
            }
            previous = Some(current);
        }
        Ok(())
    }

    fn remove_deletion_tree(&self, path: &Path) -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }
        fs::remove_dir_all(path).map_err(io_error)
    }

    fn remove_deletion_tree_for_project(&self, path: &Path, ordinal: usize) -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }
        if let Some(value) = std::env::var_os("EASYPACK_ENV_FAIL_DELETE_TRASH") {
            let value = value.to_string_lossy();
            if value == "all" || value.parse::<usize>().ok() == Some(ordinal) {
                return Err("测试注入的删除回收区清理失败".to_string());
            }
        }
        self.remove_deletion_tree(path)
    }

    fn cleanup_deletion_artifacts(
        &self,
        path: &Path,
        record: &DeletionRecord,
        remove_stage: bool,
    ) -> Result<(), String> {
        if remove_stage {
            self.remove_deletion_tree(&self.deletion_stage_root(&record.id))?;
        }
        for project in &record.projects {
            let tombstone = self.deletion_tombstone_path(&project.key);
            if tombstone.exists() {
                fs::remove_file(tombstone).map_err(io_error)?;
            }
        }
        let tombstone_dir = self.root.join(DELETION_TOMBSTONE_DIR);
        if tombstone_dir.exists() {
            let _ = fs::remove_dir(tombstone_dir);
        }
        if path.exists() {
            fs::remove_file(path).map_err(io_error)?;
        }
        let blocked = self.deletion_blocked_path(&record.id);
        if blocked.exists() {
            fs::remove_file(blocked).map_err(io_error)?;
        }
        Ok(())
    }

    fn ensure_deletion_tombstones(&self, record: &DeletionRecord) -> Result<(), String> {
        fs::create_dir_all(self.root.join(DELETION_TOMBSTONE_DIR)).map_err(io_error)?;
        for project in &record.projects {
            let path = self.deletion_tombstone_path(&project.key);
            if path.exists() {
                continue;
            }
            let tombstone = DeletionTombstone {
                token: record.id.clone(),
                profile_id: project.profile_id.clone(),
                project_id: project.project_id.clone(),
                key: project.key.clone(),
            };
            atomic_write(
                &path,
                &serde_json::to_vec_pretty(&tombstone).map_err(|e| e.to_string())?,
            )?;
        }
        Ok(())
    }

    fn mark_deletion_blocked(&self, token: &str) {
        let _ = mark_blocked_path(&self.deletion_blocked_path(token));
    }

    fn deletion_rename_should_fail(operation: &str, key: &str, ordinal: usize) -> bool {
        let variable = match operation {
            "prepare" => "EASYPACK_ENV_FAIL_DELETE_PREPARE",
            "restore" => "EASYPACK_ENV_FAIL_DELETE_RESTORE",
            _ => return false,
        };
        let Some(value) = std::env::var_os(variable) else {
            return false;
        };
        let value = value.to_string_lossy();
        value == "all" || value == key || value.parse::<usize>().ok() == Some(ordinal)
    }

    fn rename_for_deletion(
        &self,
        source: &Path,
        destination: &Path,
        operation: &str,
        key: &str,
        ordinal: usize,
    ) -> Result<(), String> {
        if Self::deletion_rename_should_fail(operation, key, ordinal) {
            return Err(format!("测试注入的删除{}移动失败", operation));
        }
        fs::rename(source, destination).map_err(io_error)
    }

    fn prepare_delete_projects_locked(
        &self,
        projects: Vec<DeletionProject>,
        operation_id: Option<&str>,
        kind: DeletionKind,
    ) -> Result<DeleteResponse, String> {
        if projects.is_empty() {
            return Err("没有找到可删除的项目快照".to_string());
        }
        let mut projects = projects;
        projects.sort_by(|left, right| {
            (&left.profile_id, &left.project_id, &left.key).cmp(&(
                &right.profile_id,
                &right.project_id,
                &right.key,
            ))
        });
        projects.dedup_by(|left, right| {
            left.profile_id == right.profile_id && left.project_id == right.project_id
        });
        for project in &mut projects {
            let expected_key = Self::key_for(&project.profile_id, &project.project_id);
            if project.key != expected_key {
                project.key = expected_key;
            }
        }

        let token = if let Some(operation_id) = operation_id {
            self.checked_deletion_record_path(operation_id)?;
            operation_id.to_string()
        } else {
            new_id("delete")
        };
        if let Some((_, existing)) = self.load_deletion_record_if_exists(&token)? {
            if existing.kind == kind && deletion_projects_match(&existing.projects, &projects) {
                return Ok(DeleteResponse {
                    token,
                    project_count: projects.len(),
                });
            }
            return Err("删除事务标识已用于其他目标".to_string());
        }
        if self.deletion_blocked_path(&token).exists()
            || self.deletion_stage_root(&token).exists()
            || self.deletion_tombstone_token_exists(&token)?
        {
            return Err("删除事务标识已被占用".to_string());
        }

        let locks: Vec<_> = projects
            .iter()
            .map(|project| self.lock_for(&project.profile_id, &project.project_id))
            .collect();
        let _guards: Vec<_> = locks
            .iter()
            .map(|lock| lock.lock().unwrap_or_else(|e| e.into_inner()))
            .collect();
        for project in &projects {
            if self.deletion_tombstone_path(&project.key).exists() {
                return Err("项目正在删除事务中，请先完成当前事务".to_string());
            }
        }

        let record = DeletionRecord {
            id: token.clone(),
            phase: DeletionPhase::Prepared,
            kind,
            projects: projects.clone(),
        };
        fs::create_dir_all(self.root.join(DELETION_DIR)).map_err(io_error)?;
        fs::create_dir_all(self.root.join(DELETION_TOMBSTONE_DIR)).map_err(io_error)?;
        let record_path = self.deletion_record_path(&token);
        let stage_root = self.deletion_stage_root(&token);
        fs::create_dir_all(&stage_root).map_err(io_error)?;
        self.write_deletion_record(&record_path, &record)?;
        for project in &projects {
            let tombstone = DeletionTombstone {
                token: token.clone(),
                profile_id: project.profile_id.clone(),
                project_id: project.project_id.clone(),
                key: project.key.clone(),
            };
            if let Err(error) = atomic_write(
                &self.deletion_tombstone_path(&project.key),
                &serde_json::to_vec_pretty(&tombstone).map_err(|e| e.to_string())?,
            ) {
                let _ = self.cleanup_deletion_artifacts(&record_path, &record, true);
                return Err(error);
            }
        }

        let mut moved = Vec::new();
        let move_result = (|| {
            for (index, project) in projects.iter().enumerate() {
                let source = self.root.join(&project.key);
                if !source.exists() {
                    continue;
                }
                self.rename_for_deletion(
                    &source,
                    &stage_root.join(&project.key),
                    "prepare",
                    &project.key,
                    index + 1,
                )?;
                moved.push(project.key.clone());
            }
            Ok::<(), String>(())
        })();
        if let Err(error) = move_result {
            let mut rollback_error = None;
            for key in moved.iter().rev() {
                let staged = stage_root.join(key);
                let original = self.root.join(key);
                if let Err(rollback) = fs::rename(staged, original).map_err(io_error) {
                    rollback_error = Some(rollback);
                    break;
                }
            }
            if let Some(rollback) = rollback_error {
                self.mark_deletion_blocked(&token);
                return Err(format!("删除准备失败且回滚失败: {}", rollback));
            }
            if let Err(cleanup) = self.cleanup_deletion_artifacts(&record_path, &record, true) {
                self.mark_deletion_blocked(&token);
                return Err(format!("删除准备失败且清理失败: {}", cleanup));
            }
            return Err(format!("删除准备失败，已自动回滚: {}", error));
        }

        Ok(DeleteResponse {
            token,
            project_count: projects.len(),
        })
    }

    fn prepare_delete_projects(
        &self,
        projects: Vec<DeletionProject>,
        operation_id: Option<&str>,
        kind: DeletionKind,
    ) -> Result<DeleteResponse, String> {
        let _deletion_guard = Self::deletion_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        self.prepare_delete_projects_locked(projects, operation_id, kind)
    }

    pub fn prepare_delete_project(
        &self,
        request: &ProjectDeleteRequest,
    ) -> Result<DeleteResponse, String> {
        let key = Self::key_for(&request.profile_id, &request.project_id);
        self.prepare_delete_projects(
            vec![DeletionProject {
                profile_id: request.profile_id.clone(),
                project_id: request.project_id.clone(),
                key,
            }],
            request.operation_id.as_deref(),
            DeletionKind::Project,
        )
    }

    fn finalize_delete_locked(
        &self,
        path: &Path,
        mut record: DeletionRecord,
    ) -> Result<(), String> {
        if record.phase == DeletionPhase::Finalized {
            let _ = self.cleanup_deletion_artifacts(path, &record, true);
            return Ok(());
        }
        let was_prepared = record.phase == DeletionPhase::Prepared;
        if record.phase == DeletionPhase::Prepared {
            record.phase = DeletionPhase::Finalizing;
            self.write_deletion_record(path, &record)?;
        }
        if let Err(error) = self.unregister_projects(&record.projects) {
            if was_prepared {
                record.phase = DeletionPhase::Prepared;
                if let Err(rollback) = self.write_deletion_record(path, &record) {
                    return Err(format!("删除提交失败且无法恢复准备状态: {}", rollback));
                }
            }
            return if was_prepared { Err(error) } else { Ok(()) };
        }
        let mut cleanup_failed = false;
        for (index, project) in record.projects.iter().enumerate() {
            let staged = self.deletion_stage_root(&record.id).join(&project.key);
            if !staged.exists() {
                continue;
            }
            if self
                .remove_deletion_tree_for_project(&staged, index + 1)
                .is_err()
            {
                cleanup_failed = true;
            }
        }
        if !cleanup_failed
            && self
                .remove_deletion_tree(&self.deletion_stage_root(&record.id))
                .is_err()
        {
            cleanup_failed = true;
        }
        if cleanup_failed {
            return Ok(());
        }
        record.phase = DeletionPhase::Finalized;
        if self.write_deletion_record(path, &record).is_err() {
            return Ok(());
        }
        let _ = self.cleanup_deletion_artifacts(path, &record, false);
        Ok(())
    }

    pub fn finalize_delete(&self, request: &DeleteFinalizeRequest) -> Result<(), String> {
        let _deletion_guard = Self::deletion_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let Some((path, record)) = self.load_deletion_record_if_exists(&request.token)? else {
            return Ok(());
        };
        let locks: Vec<_> = record
            .projects
            .iter()
            .map(|project| self.lock_for(&project.profile_id, &project.project_id))
            .collect();
        let _guards: Vec<_> = locks
            .iter()
            .map(|lock| lock.lock().unwrap_or_else(|e| e.into_inner()))
            .collect();
        let result = self.finalize_delete_locked(&path, record);
        if result.is_err() {
            self.mark_deletion_blocked(&request.token);
        }
        result
    }

    pub fn restore_delete(&self, request: &DeleteRestoreRequest) -> Result<(), String> {
        let _deletion_guard = Self::deletion_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let Some((path, record)) = self.load_deletion_record_if_exists(&request.token)? else {
            return Ok(());
        };
        let locks: Vec<_> = record
            .projects
            .iter()
            .map(|project| self.lock_for(&project.profile_id, &project.project_id))
            .collect();
        let _guards: Vec<_> = locks
            .iter()
            .map(|lock| lock.lock().unwrap_or_else(|e| e.into_inner()))
            .collect();
        let result = self.restore_delete_locked(&path, &record);
        if result.is_err() {
            self.mark_deletion_blocked(&request.token);
        }
        result
    }

    pub fn delete_status(
        &self,
        request: &DeleteStatusRequest,
    ) -> Result<DeleteStatusResponse, String> {
        let _deletion_guard = Self::deletion_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let Some((_, record)) = self.load_deletion_record_if_exists(&request.token)? else {
            return Ok(DeleteStatusResponse {
                status: "notFound".to_string(),
                kind: "unknown".to_string(),
                profile_id: String::new(),
                project_id: None,
            });
        };
        let status = match record.phase {
            DeletionPhase::Prepared => "prepared",
            DeletionPhase::Finalizing => "finalizing",
            DeletionPhase::Finalized => "notFound",
        };
        let kind = match record.kind {
            DeletionKind::Project => "project",
            DeletionKind::Profile => "profile",
        };
        let profile_id = record
            .projects
            .first()
            .map(|project| project.profile_id.clone())
            .unwrap_or_default();
        let project_id = (record.kind == DeletionKind::Project)
            .then(|| {
                record
                    .projects
                    .first()
                    .map(|project| project.project_id.clone())
            })
            .flatten();
        Ok(DeleteStatusResponse {
            status: status.to_string(),
            kind: kind.to_string(),
            profile_id,
            project_id,
        })
    }

    fn restore_delete_locked(&self, path: &Path, record: &DeletionRecord) -> Result<(), String> {
        if record.phase != DeletionPhase::Prepared {
            return Err("删除事务已提交，不能恢复".to_string());
        }
        let stage_root = self.deletion_stage_root(&record.id);
        for (index, project) in record.projects.iter().enumerate() {
            let staged = stage_root.join(&project.key);
            let original = self.root.join(&project.key);
            if !staged.exists() {
                continue;
            }
            if original.exists() {
                return Err("恢复删除失败：原项目目录已存在".to_string());
            }
            self.rename_for_deletion(&staged, &original, "restore", &project.key, index + 1)?;
        }
        self.register_projects(&record.projects)?;
        self.remove_deletion_tree(&stage_root)?;
        self.cleanup_deletion_artifacts(path, record, false)
    }

    pub fn delete_project(&self, request: &ProjectDeleteRequest) -> Result<(), String> {
        let prepared = self.prepare_delete_project(request)?;
        self.finalize_delete(&DeleteFinalizeRequest {
            token: prepared.token,
        })
    }

    pub fn delete_profile(&self, request: &ProfileDeleteRequest) -> Result<(), String> {
        let prepared = self.prepare_delete_profile(request)?;
        if prepared.token.is_empty() {
            return Ok(());
        }
        self.finalize_delete(&DeleteFinalizeRequest {
            token: prepared.token,
        })
    }

    pub fn prepare_delete_profile(
        &self,
        request: &ProfileDeleteRequest,
    ) -> Result<DeleteResponse, String> {
        let _deletion_guard = Self::deletion_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let index = self.load_profile_index()?;
        let projects = index
            .profiles
            .get(&request.profile_id)
            .map(|items| {
                items
                    .iter()
                    .map(|(project_id, key)| DeletionProject {
                        profile_id: request.profile_id.clone(),
                        project_id: project_id.clone(),
                        key: key.clone(),
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if projects.is_empty() {
            return Ok(DeleteResponse {
                token: String::new(),
                project_count: 0,
            });
        }
        self.prepare_delete_projects_locked(
            projects,
            request.operation_id.as_deref(),
            DeletionKind::Profile,
        )
    }
}

fn snapshot_from_environment(
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

fn deletion_projects_match(left: &[DeletionProject], right: &[DeletionProject]) -> bool {
    left.len() == right.len()
        && left.iter().zip(right).all(|(a, b)| {
            a.profile_id == b.profile_id && a.project_id == b.project_id && a.key == b.key
        })
}

fn transaction_entries_to_snapshot(
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

fn transaction_entries_to_plan_target(
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

fn stage_entries_from_current(
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

fn entry_from_bytes(
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

fn validate_bootstrap_environments(
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

fn bootstrap_matches_manifest(
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

fn find_environment<'a>(manifest: &'a Manifest, id: &str) -> Result<&'a EnvironmentRecord, String> {
    manifest
        .environments
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| "环境不存在".to_string())
}

fn find_environment_mut<'a>(
    manifest: &'a mut Manifest,
    id: &str,
) -> Result<&'a mut EnvironmentRecord, String> {
    manifest
        .environments
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| "环境不存在".to_string())
}

fn file_content_from_bytes(bytes: Vec<u8>) -> EnvironmentFileContent {
    match String::from_utf8(bytes) {
        Ok(content) => EnvironmentFileContent {
            state: EnvironmentFileState::Text,
            content: Some(content),
        },
        Err(_) => EnvironmentFileContent {
            state: EnvironmentFileState::NonUtf8,
            content: None,
        },
    }
}

fn read_current_detail(root: &Path, path: &str) -> Result<EnvironmentFileContent, String> {
    let full = resolve_safe_path(root, path)?;
    match fs::symlink_metadata(&full) {
        Ok(metadata) if metadata.is_dir() => Err(format!("受管路径不是普通文件: {}", path)),
        Ok(metadata) => {
            if is_reparse_metadata(&metadata) {
                return Err(format!("受管路径包含重解析点: {}", path));
            }
            if !metadata.is_file() {
                return Err(format!("受管路径不是普通文件: {}", path));
            }
            Ok(file_content_from_bytes(fs::read(full).map_err(io_error)?))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(EnvironmentFileContent {
            state: EnvironmentFileState::Absent,
            content: None,
        }),
        Err(error) => Err(io_error(error)),
    }
}

fn normalize_paths(paths: &[String]) -> Result<Vec<String>, String> {
    let mut result: Vec<String> = Vec::new();
    for path in paths {
        validate_relative_path(path)?;
        let normalized = path.replace('\\', "/");
        if !result
            .iter()
            .any(|item| item.eq_ignore_ascii_case(&normalized))
        {
            result.push(normalized);
        } else {
            return Err(format!("受管路径重复: {}", path));
        }
    }
    result.sort();
    Ok(result)
}

pub fn validate_relative_path(path: &str) -> Result<(), String> {
    if path.is_empty()
        || path.starts_with('/')
        || path.starts_with('\\')
        || path.contains(':')
        || path.contains('\0')
    {
        return Err("路径必须是项目内相对路径".to_string());
    }
    if Path::new(path).is_absolute() || path.starts_with("//") || path.starts_with("\\\\") {
        return Err("不允许绝对路径或 UNC 路径".to_string());
    }
    let normalized = path.replace('\\', "/");
    for component in normalized.split('/') {
        if component.is_empty() || component == "." || component == ".." {
            return Err("路径包含无效组件".to_string());
        }
        if component.chars().any(|character| {
            character.is_control() || matches!(character, '*' | '?' | '"' | '<' | '>' | '|')
        }) {
            return Err("路径包含 Windows 不允许的字符".to_string());
        }
        if component.ends_with('.') || component.ends_with(' ') {
            return Err("Windows 路径不能以点或空格结尾".to_string());
        }
        let stem = component
            .split('.')
            .next()
            .unwrap_or(component)
            .to_ascii_uppercase();
        if matches!(
            stem.as_str(),
            "CON"
                | "PRN"
                | "AUX"
                | "NUL"
                | "COM1"
                | "COM2"
                | "COM3"
                | "COM4"
                | "COM5"
                | "COM6"
                | "COM7"
                | "COM8"
                | "COM9"
                | "LPT1"
                | "LPT2"
                | "LPT3"
                | "LPT4"
                | "LPT5"
                | "LPT6"
                | "LPT7"
                | "LPT8"
                | "LPT9"
        ) {
            return Err("路径包含 Windows 保留名称".to_string());
        }
    }
    Ok(())
}

pub fn resolve_safe_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    validate_relative_path(relative)?;
    ensure_project_root(root)?;
    let canonical = fs::canonicalize(root).map_err(io_error)?;
    let mut current = canonical;
    for component in relative.replace('\\', "/").split('/') {
        current.push(component);
        if let Ok(meta) = fs::symlink_metadata(&current) {
            if is_reparse_metadata(&meta) {
                return Err(format!("路径包含重解析点: {}", relative));
            }
        }
    }
    Ok(current)
}

fn ensure_project_root(root: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(root).map_err(io_error)?;
    if !metadata.is_dir() {
        return Err("项目路径不是目录".to_string());
    }
    if is_reparse_metadata(&metadata) {
        return Err("项目根目录不能是重解析点".to_string());
    }
    Ok(())
}

#[cfg(windows)]
fn is_reparse_metadata(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
fn is_reparse_metadata(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn digest_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn blob_name(env_id: &str, path: &str) -> String {
    digest_bytes(format!("{}\0{}", env_id, path).as_bytes()) + ".bin"
}

fn unique_blob_name(operation: &str, path: &str) -> String {
    digest_bytes(format!("{}\0{}\0{}", operation, path, new_id("blob")).as_bytes()) + ".bin"
}

fn plan_token(
    project: &ProjectRef,
    generation: u64,
    environment_id: &str,
    current: &BTreeMap<String, CurrentEntry>,
) -> String {
    let mut bytes = format!(
        "{}\0{}\0{}\0{}",
        project.profile_id, project.project_id, generation, environment_id
    )
    .into_bytes();
    for (path, entry) in current {
        bytes.extend_from_slice(path.as_bytes());
        bytes.push(0);
        bytes.extend_from_slice(entry.digest.as_deref().unwrap_or("absent").as_bytes());
        bytes.push(0);
    }
    digest_bytes(&bytes)
}

fn validate_environment_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() || name.len() > 128 || name.contains(['/', '\\', '\0']) {
        return Err("环境名称无效".to_string());
    }
    Ok(())
}

fn validate_operation_id(operation_id: &str) -> Result<(), String> {
    if operation_id.is_empty()
        || operation_id.len() > 128
        || !operation_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("操作标识无效".to_string());
    }
    Ok(())
}

fn new_id(prefix: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = ID_COUNTER.get_or_init(|| Mutex::new(0));
    let mut value = counter.lock().unwrap_or_else(|e| e.into_inner());
    *value = value.saturating_add(1);
    format!("{}-{:x}-{}-{}", prefix, now, std::process::id(), *value)
}

fn io_error(error: std::io::Error) -> String {
    format!("文件操作失败: {}", error)
}

fn mark_blocked_path(path: &Path) -> Result<(), String> {
    atomic_write(path, RECOVERY_ERROR_CODE.as_bytes())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "目标路径没有父目录".to_string())?;
    fs::create_dir_all(parent).map_err(io_error)?;
    let temp = parent.join(format!(
        ".{}.tmp-{}",
        path.file_name().and_then(|n| n.to_str()).unwrap_or("data"),
        new_id("write")
    ));
    (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(io_error)?;
        file.write_all(bytes).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        replace_existing(&temp, path)
    })()
}

fn replace_existing(source: &Path, destination: &Path) -> Result<(), String> {
    if std::env::var_os("EASYPACK_ENV_FAIL_REPLACE").is_some() {
        return Err("测试注入的原子替换失败".to_string());
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;

        if !destination.exists() {
            return fs::rename(source, destination).map_err(io_error);
        }

        #[link(name = "kernel32")]
        extern "system" {
            fn MoveFileExW(existing: *const u16, replacement: *const u16, flags: u32) -> i32;
        }

        let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
        let destination_wide: Vec<u16> = destination
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        // MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
        let moved =
            unsafe { MoveFileExW(source_wide.as_ptr(), destination_wide.as_ptr(), 0x1 | 0x8) };
        if moved == 0 {
            // 保留 source 和 destination，调用方才能在失败后回滚或重试。
            return Err(format!(
                "Windows 原子替换失败: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(())
    }

    #[cfg(not(windows))]
    fs::rename(source, destination).map_err(io_error)
}

fn replace_file_from(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Err("事务暂存文件不存在".to_string());
    }
    if let Some(parent) = destination.parent() {
        if !parent.exists() {
            return Err("不会自动创建配置文件父目录".to_string());
        }
    }
    let temp = destination.with_file_name(format!(
        ".{}.tmp-{}",
        destination
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("config"),
        new_id("apply")
    ));
    fs::copy(source, &temp).map_err(io_error)?;
    replace_existing(&temp, destination)
}

fn from_app(app: &tauri::AppHandle) -> Result<EnvironmentStore, String> {
    use tauri::Manager;
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法定位应用数据目录: {}", e))?;
    Ok(EnvironmentStore::new(root.join(DATA_DIR)))
}

fn emit_environment_progress(app: &tauri::AppHandle, event: &EnvironmentProgressEvent) {
    use tauri::Emitter;
    // Progress is advisory; a disconnected or closed frontend must not fail
    // the underlying file operation.
    let _ = app.emit("environment-progress", event);
}

#[tauri::command]
pub fn environment_open_project(
    app: tauri::AppHandle,
    project: ProjectRef,
) -> Result<ProjectState, String> {
    from_app(&app)?.open_project(&project)
}

#[tauri::command]
pub fn environment_get_project_path(
    app: tauri::AppHandle,
    request: ProjectPathRequest,
) -> Result<Option<String>, String> {
    from_app(&app)?.project_path(&request)
}

#[tauri::command]
pub fn environment_create(
    app: tauri::AppHandle,
    request: CreateEnvironmentRequest,
) -> Result<ProjectState, String> {
    from_app(&app)?.create_environment(&request)
}

#[tauri::command]
pub fn environment_capture(
    app: tauri::AppHandle,
    request: EnvironmentRequest,
) -> Result<ProjectState, String> {
    let store = from_app(&app)?;
    let callback = |event: &EnvironmentProgressEvent| emit_environment_progress(&app, event);
    store.capture_environment_with_progress(&request, Some(&callback))
}

#[tauri::command]
pub fn environment_detail(
    app: tauri::AppHandle,
    request: EnvironmentDetailRequest,
) -> Result<EnvironmentDetailResponse, String> {
    from_app(&app)?.environment_detail(&request)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyEnvironmentRequest {
    pub project: ProjectRef,
    pub environment_id: String,
    pub name: String,
}

#[tauri::command]
pub fn environment_copy(
    app: tauri::AppHandle,
    request: CopyEnvironmentRequest,
) -> Result<ProjectState, String> {
    from_app(&app)?.copy_environment(
        &EnvironmentRequest {
            project: request.project,
            environment_id: request.environment_id,
            operation_id: String::new(),
        },
        &request.name,
    )
}

#[tauri::command]
pub fn environment_delete(
    app: tauri::AppHandle,
    request: EnvironmentRequest,
) -> Result<ProjectState, String> {
    from_app(&app)?.delete_environment(&request)
}

#[tauri::command]
pub fn environment_migrate_manifest(
    app: tauri::AppHandle,
    request: MigrateManifestRequest,
) -> Result<ProjectState, String> {
    from_app(&app)?.migrate_manifest(&request)
}

#[tauri::command]
pub fn environment_bootstrap_import(
    app: tauri::AppHandle,
    request: BootstrapImportRequest,
) -> Result<ProjectState, String> {
    from_app(&app)?.bootstrap_import(&request)
}

#[tauri::command]
pub fn environment_import(
    app: tauri::AppHandle,
    request: BootstrapImportRequest,
) -> Result<ProjectState, String> {
    environment_bootstrap_import(app, request)
}

#[tauri::command]
pub fn environment_rebind_project(
    app: tauri::AppHandle,
    request: RebindProjectRequest,
) -> Result<ProjectState, String> {
    from_app(&app)?.rebind_project(&request)
}

#[tauri::command]
pub fn environment_plan(
    app: tauri::AppHandle,
    request: EnvironmentRequest,
) -> Result<ApplyPlan, String> {
    from_app(&app)?.plan_environment(&request)
}

#[tauri::command]
pub fn environment_apply(
    app: tauri::AppHandle,
    request: ApplyRequest,
) -> Result<ApplyResponse, String> {
    let store = from_app(&app)?;
    let callback = |event: &EnvironmentProgressEvent| emit_environment_progress(&app, event);
    store.apply_environment_with_progress(&request, Some(&callback))
}

#[tauri::command]
pub fn environment_plan_undo(
    app: tauri::AppHandle,
    project: ProjectRef,
) -> Result<ApplyPlan, String> {
    from_app(&app)?.plan_undo_environment(&project)
}

#[tauri::command]
pub fn environment_undo(
    app: tauri::AppHandle,
    request: UndoRequest,
) -> Result<ApplyResponse, String> {
    let store = from_app(&app)?;
    let callback = |event: &EnvironmentProgressEvent| emit_environment_progress(&app, event);
    store.undo_environment_with_progress(&request, Some(&callback))
}

#[tauri::command]
pub fn environment_delete_project(
    app: tauri::AppHandle,
    request: ProjectDeleteRequest,
) -> Result<(), String> {
    from_app(&app)?.delete_project(&request)
}

#[tauri::command]
pub fn environment_delete_profile(
    app: tauri::AppHandle,
    request: ProfileDeleteRequest,
) -> Result<(), String> {
    from_app(&app)?.delete_profile(&request)
}

#[tauri::command]
pub fn environment_prepare_delete_project(
    app: tauri::AppHandle,
    request: ProjectDeleteRequest,
) -> Result<DeleteResponse, String> {
    from_app(&app)?.prepare_delete_project(&request)
}

#[tauri::command]
pub fn environment_prepare_delete_profile(
    app: tauri::AppHandle,
    request: ProfileDeleteRequest,
) -> Result<DeleteResponse, String> {
    from_app(&app)?.prepare_delete_profile(&request)
}

#[tauri::command]
pub fn environment_finalize_delete(
    app: tauri::AppHandle,
    request: DeleteFinalizeRequest,
) -> Result<(), String> {
    from_app(&app)?.finalize_delete(&request)
}

#[tauri::command]
pub fn environment_restore_delete(
    app: tauri::AppHandle,
    request: DeleteRestoreRequest,
) -> Result<(), String> {
    from_app(&app)?.restore_delete(&request)
}

#[tauri::command]
pub fn environment_delete_status(
    app: tauri::AppHandle,
    request: DeleteStatusRequest,
) -> Result<DeleteStatusResponse, String> {
    from_app(&app)?.delete_status(&request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    static TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn test_lock() -> std::sync::MutexGuard<'static, ()> {
        TEST_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    fn project(root: &Path) -> ProjectRef {
        ProjectRef {
            profile_id: "p".to_string(),
            project_id: "C:\\project\\one".to_string(),
            project_path: root.to_string_lossy().to_string(),
        }
    }
    fn create(root: &Path) -> (EnvironmentStore, ProjectRef, ProjectState) {
        fs::create_dir_all(root).unwrap();
        fs::write(root.join("a.env"), b"\xef\xbb\xbfA=1\r\n").unwrap();
        fs::write(root.join("b.env"), b"B=1").unwrap();
        let store = EnvironmentStore::new(root.join("data"));
        let project = project(root);
        let state = store
            .create_environment(&CreateEnvironmentRequest {
                project: project.clone(),
                name: "dev".to_string(),
                managed_paths: vec![
                    "a.env".to_string(),
                    "b.env".to_string(),
                    "missing.env".to_string(),
                ],
            })
            .unwrap();
        (store, project, state)
    }

    fn file_count(root: &Path) -> usize {
        if !root.exists() {
            return 0;
        }
        fs::read_dir(root)
            .unwrap()
            .filter_map(Result::ok)
            .map(|item| {
                if item.file_type().unwrap().is_dir() {
                    file_count(&item.path())
                } else {
                    1
                }
            })
            .sum()
    }

    fn create_registered_project(
        store: &EnvironmentStore,
        root: &Path,
        profile_id: &str,
        project_id: &str,
    ) -> ProjectRef {
        fs::create_dir_all(root).unwrap();
        fs::write(root.join("config.env"), project_id.as_bytes()).unwrap();
        let project = ProjectRef {
            profile_id: profile_id.to_string(),
            project_id: project_id.to_string(),
            project_path: root.to_string_lossy().to_string(),
        };
        store
            .create_environment(&CreateEnvironmentRequest {
                project: project.clone(),
                name: "dev".to_string(),
                managed_paths: vec!["config.env".to_string()],
            })
            .unwrap();
        project
    }

    fn seed_rollback_failed(
        store: &EnvironmentStore,
        project: &ProjectRef,
        include_before_blob: bool,
    ) {
        let tx_id = "tx-recovery-test";
        let key_dir = store.key_dir(&project.profile_id, &project.project_id);
        let stage = key_dir.join("staging").join(tx_id).join("before");
        fs::create_dir_all(&stage).unwrap();
        if include_before_blob {
            fs::write(stage.join("before-a"), b"before").unwrap();
        }
        let transaction = StoredTransaction {
            id: tx_id.to_string(),
            phase: TransactionPhase::RollbackFailed,
            root_path: project.project_path.clone(),
            before: vec![TransactionEntry {
                path: "a.env".to_string(),
                state: SnapshotState::Present,
                digest: Some(digest_bytes(b"before")),
                size: Some(6),
                staging: Some("before-a".to_string()),
            }],
            target: vec![TransactionEntry {
                path: "a.env".to_string(),
                state: SnapshotState::Present,
                digest: Some(digest_bytes(b"after")),
                size: Some(5),
                staging: None,
            }],
            undo_environment_id: None,
            pending_undo: PendingUndoAction::Noop,
        };
        fs::write(
            store.transaction_path(project),
            serde_json::to_vec(&transaction).unwrap(),
        )
        .unwrap();
        fs::write(store.blocked_path(project), b"secret transaction body").unwrap();
        fs::write(Path::new(&project.project_path).join("a.env"), b"after").unwrap();
    }

    #[test]
    fn delete_environment_removes_snapshot_and_returns_updated_state() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, state) = create(dir.path());
        let source_id = state.environments[0].id.clone();
        let copied = store
            .copy_environment(
                &EnvironmentRequest {
                    project: project.clone(),
                    environment_id: source_id.clone(),
                    operation_id: "test-copy".into(),
                },
                "test",
            )
            .unwrap();
        let manifest = store.load_manifest(&project).unwrap();
        let source_blob = manifest.environments[0]
            .entries
            .get("a.env")
            .and_then(|entry| entry.blob.clone())
            .unwrap();
        let copied_blob = manifest.environments[1]
            .entries
            .get("a.env")
            .and_then(|entry| entry.blob.clone())
            .unwrap();
        let blobs = store
            .key_dir(&project.profile_id, &project.project_id)
            .join("blobs");
        assert!(blobs.join(&source_blob).exists());
        assert!(blobs.join(&copied_blob).exists());

        let missing = store.delete_environment(&EnvironmentRequest {
            project: project.clone(),
            environment_id: "missing".to_string(),
            operation_id: "test-delete".into(),
        });
        assert_eq!(missing.unwrap_err(), "环境不存在");
        assert_eq!(copied.environments.len(), 2);

        let next = store
            .delete_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: source_id,
                operation_id: "test-delete".into(),
            })
            .unwrap();
        assert_eq!(next.environments.len(), 1);
        assert_eq!(next.environments[0].name, "test");
        assert!(!blobs.join(source_blob).exists());
        assert!(blobs.join(copied_blob).exists());
        assert_eq!(store.load_manifest(&project).unwrap().environments.len(), 1);
    }

    #[test]
    fn delete_environment_rejects_project_without_environment_data() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = project(dir.path());
        let error = store
            .delete_environment(&EnvironmentRequest {
                project,
                environment_id: "missing".to_string(),
                operation_id: "test-delete".into(),
            })
            .unwrap_err();
        assert_eq!(error, "项目环境不存在");
    }

    #[test]
    fn bootstrap_import_creates_all_environments_atomically_and_is_idempotent() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path()).unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = project(dir.path());
        let request = BootstrapImportRequest {
            project: project.clone(),
            managed_paths: vec!["a.env".into(), "missing.env".into()],
            environments: vec![
                BootstrapEnvironment {
                    environment_id: "legacy-dev".into(),
                    name: "dev".into(),
                    entries: vec![
                        MigrationEntry {
                            path: "a.env".into(),
                            state: SnapshotState::Present,
                            content: Some(b"dev".to_vec()),
                        },
                        MigrationEntry {
                            path: "missing.env".into(),
                            state: SnapshotState::Absent,
                            content: None,
                        },
                    ],
                },
                BootstrapEnvironment {
                    environment_id: "legacy-test".into(),
                    name: "test".into(),
                    entries: vec![
                        MigrationEntry {
                            path: "a.env".into(),
                            state: SnapshotState::Present,
                            content: Some(b"test".to_vec()),
                        },
                        MigrationEntry {
                            path: "missing.env".into(),
                            state: SnapshotState::Absent,
                            content: None,
                        },
                    ],
                },
            ],
        };
        let state = store.bootstrap_import(&request).unwrap();
        assert_eq!(state.environments.len(), 2);
        let generation = store.load_manifest(&project).unwrap().generation;
        assert_eq!(
            store.bootstrap_import(&request).unwrap().environments.len(),
            2
        );
        assert_eq!(
            store.load_manifest(&project).unwrap().generation,
            generation
        );

        let mut changed = request.clone();
        changed.environments[0].name = "other".into();
        assert!(store.bootstrap_import(&changed).is_err());
        assert_eq!(
            store.load_manifest(&project).unwrap().generation,
            generation
        );
    }

    #[test]
    fn bootstrap_idempotence_repairs_a_missing_index_and_retries_index_failure() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = project(dir.path());
        fs::create_dir_all(dir.path()).unwrap();
        let request = BootstrapImportRequest {
            project: project.clone(),
            managed_paths: vec!["a.env".into()],
            environments: vec![BootstrapEnvironment {
                environment_id: "dev".into(),
                name: "dev".into(),
                entries: vec![MigrationEntry {
                    path: "a.env".into(),
                    state: SnapshotState::Present,
                    content: Some(b"dev".to_vec()),
                }],
            }],
        };
        store.bootstrap_import(&request).unwrap();
        fs::remove_file(store.profile_index_path()).unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_DELETE_INDEX", "1");
        assert!(store.bootstrap_import(&request).is_err());
        std::env::remove_var("EASYPACK_ENV_FAIL_DELETE_INDEX");
        assert!(store.bootstrap_import(&request).is_ok());
        let expected_key = EnvironmentStore::key_for(&project.profile_id, &project.project_id);
        assert_eq!(
            store
                .load_profile_index()
                .unwrap()
                .profiles
                .get(&project.profile_id)
                .and_then(|projects| projects.get(&project.project_id)),
            Some(&expected_key)
        );
    }

    #[test]
    fn capture_manifest_failure_keeps_previous_snapshot() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let before = store.load_manifest(&project).unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_MANIFEST", "1");
        let result = store.capture_environment(&EnvironmentRequest {
            project: project.clone(),
            environment_id: before.environments[0].id.clone(),
            operation_id: "capture-manifest-failure".into(),
        });
        std::env::remove_var("EASYPACK_ENV_FAIL_MANIFEST");
        assert!(result.is_err());
        let after = store.load_manifest(&project).unwrap();
        assert_eq!(after.generation, before.generation);
        let entry = &after.environments[0].entries["a.env"];
        assert_eq!(
            store
                .read_blob_entry(&store.key_dir("p", &project.project_id), entry)
                .unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
        assert_eq!(
            file_count(
                &store
                    .key_dir(&project.profile_id, &project.project_id)
                    .join("staging")
            ),
            0
        );
    }

    #[test]
    fn environment_detail_reads_snapshot_and_current_file_states() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, state) = create(dir.path());
        let environment_id = state.environments[0].id.clone();

        fs::write(dir.path().join("a.env"), b"CURRENT=1\n").unwrap();
        let text = store
            .environment_detail(&EnvironmentDetailRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                path: "a.env".into(),
            })
            .unwrap();
        assert_eq!(text.path, "a.env");
        assert_eq!(text.snapshot.state, EnvironmentFileState::Text);
        assert_eq!(text.snapshot.content.as_deref(), Some("\u{feff}A=1\r\n"));
        assert_eq!(text.current.state, EnvironmentFileState::Text);
        assert_eq!(text.current.content.as_deref(), Some("CURRENT=1\n"));

        fs::write(dir.path().join("b.env"), [0xff, 0xfe]).unwrap();
        let non_utf8 = store
            .environment_detail(&EnvironmentDetailRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                path: "b.env".into(),
            })
            .unwrap();
        assert_eq!(non_utf8.snapshot.state, EnvironmentFileState::Text);
        assert_eq!(non_utf8.current.state, EnvironmentFileState::NonUtf8);
        assert_eq!(non_utf8.current.content, None);

        let absent = store
            .environment_detail(&EnvironmentDetailRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                path: "missing.env".into(),
            })
            .unwrap();
        assert_eq!(absent.snapshot.state, EnvironmentFileState::Absent);
        assert_eq!(absent.current.state, EnvironmentFileState::Absent);

        assert!(store
            .environment_detail(&EnvironmentDetailRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                path: "../a.env".into(),
            })
            .is_err());
        assert!(store
            .environment_detail(&EnvironmentDetailRequest {
                project,
                environment_id,
                path: "unmanaged.env".into(),
            })
            .is_err());
    }

    #[test]
    fn environment_detail_rejects_corrupt_snapshot_content() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, state) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = state.environments[0].id.clone();
        let entry = &manifest.environments[0].entries["a.env"];
        fs::write(
            store
                .key_dir(&project.profile_id, &project.project_id)
                .join("blobs")
                .join(entry.blob.as_ref().unwrap()),
            b"tampered",
        )
        .unwrap();

        let result = store.environment_detail(&EnvironmentDetailRequest {
            project,
            environment_id,
            path: "a.env".into(),
        });
        assert!(result.is_err());
    }

    #[test]
    fn capture_and_apply_report_file_progress_and_omit_success_on_failure() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, state) = create(dir.path());
        let environment_id = state.environments[0].id.clone();
        let events = Arc::new(Mutex::new(Vec::<EnvironmentProgressEvent>::new()));
        let capture_events = events.clone();
        let capture_callback = move |event: &EnvironmentProgressEvent| {
            capture_events.lock().unwrap().push(event.clone());
        };
        store
            .capture_environment_with_progress(
                &EnvironmentRequest {
                    project: project.clone(),
                    environment_id: environment_id.clone(),
                    operation_id: "capture-progress-1".into(),
                },
                Some(&capture_callback),
            )
            .unwrap();
        let captured = events.lock().unwrap().clone();
        assert_eq!(
            captured
                .iter()
                .map(|event| event.completed_files)
                .collect::<Vec<_>>(),
            vec![0, 1, 2, 3]
        );
        assert!(captured.iter().all(|event| {
            event.kind == "capture"
                && event.total_files == 3
                && event.profile_id == "p"
                && event.project_id == "C:\\project\\one"
                && event.environment_id == environment_id
                && event.operation_id == "capture-progress-1"
        }));
        assert!(captured
            .windows(2)
            .all(|pair| pair[0].operation_id == pair[1].operation_id));

        fs::write(dir.path().join("a.env"), b"changed-a").unwrap();
        fs::write(dir.path().join("b.env"), b"changed-b").unwrap();
        let plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                operation_id: "apply-plan-1".into(),
            })
            .unwrap();
        events.lock().unwrap().clear();
        let apply_events = events.clone();
        let apply_callback = move |event: &EnvironmentProgressEvent| {
            apply_events.lock().unwrap().push(event.clone());
        };
        store
            .apply_environment_with_progress(
                &ApplyRequest {
                    project: project.clone(),
                    environment_id: environment_id.clone(),
                    plan_token: plan.token,
                    operation_id: "apply-progress-1".into(),
                },
                Some(&apply_callback),
            )
            .unwrap();
        let applied = events.lock().unwrap().clone();
        assert_eq!(
            applied
                .iter()
                .map(|event| event.completed_files)
                .collect::<Vec<_>>(),
            vec![0, 1, 2, 3]
        );
        assert!(applied.iter().all(|event| {
            event.kind == "apply"
                && event.total_files == 3
                && event.environment_id == environment_id
                && event.operation_id == "apply-progress-1"
        }));

        let undo_plan = store.plan_undo_environment(&project).unwrap();
        events.lock().unwrap().clear();
        let undo_events = events.clone();
        let undo_callback = move |event: &EnvironmentProgressEvent| {
            undo_events.lock().unwrap().push(event.clone());
        };
        store
            .undo_environment_with_progress(
                &UndoRequest {
                    project: project.clone(),
                    plan_token: undo_plan.token,
                    operation_id: "undo-progress-1".into(),
                },
                Some(&undo_callback),
            )
            .unwrap();
        let undone = events.lock().unwrap().clone();
        assert_eq!(
            undone
                .iter()
                .map(|event| event.completed_files)
                .collect::<Vec<_>>(),
            vec![0, 1, 2, 3]
        );
        assert!(undone.iter().all(|event| {
            event.kind == "undo"
                && event.total_files == 3
                && event.environment_id == environment_id
                && event.operation_id == "undo-progress-1"
        }));

        fs::write(dir.path().join("a.env"), b"failed-a").unwrap();
        fs::write(dir.path().join("b.env"), b"failed-b").unwrap();
        let failed_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                operation_id: "apply-plan-2".into(),
            })
            .unwrap();
        events.lock().unwrap().clear();
        std::env::set_var("EASYPACK_ENV_FAIL_AFTER", "1");
        let failed = store.apply_environment_with_progress(
            &ApplyRequest {
                project,
                environment_id,
                plan_token: failed_plan.token,
                operation_id: "apply-progress-2".into(),
            },
            Some(&apply_callback),
        );
        std::env::remove_var("EASYPACK_ENV_FAIL_AFTER");
        assert!(failed.is_err());
        let failed_events = events.lock().unwrap().clone();
        assert_eq!(
            failed_events
                .iter()
                .map(|event| event.completed_files)
                .collect::<Vec<_>>(),
            vec![0, 1]
        );
        assert!(failed_events
            .iter()
            .all(|event| event.completed_files < event.total_files));
        assert!(failed_events
            .iter()
            .all(|event| event.operation_id == "apply-progress-2"));
        assert_ne!(
            applied.first().map(|event| &event.operation_id),
            failed_events.first().map(|event| &event.operation_id)
        );
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"failed-a");
        assert_eq!(fs::read(dir.path().join("b.env")).unwrap(), b"failed-b");
    }

    #[test]
    fn operation_id_uses_camel_case_and_rejects_invalid_values() {
        let request = EnvironmentRequest {
            project: ProjectRef {
                profile_id: "profile".into(),
                project_id: "project".into(),
                project_path: "C:\\project".into(),
            },
            environment_id: "environment".into(),
            operation_id: "capture-001".into(),
        };
        let value = serde_json::to_value(&request).unwrap();
        assert_eq!(
            value.get("operationId").and_then(|item| item.as_str()),
            Some("capture-001")
        );
        assert!(value.get("operation_id").is_none());
        assert!(validate_operation_id("capture-001").is_ok());
        assert!(validate_operation_id("").is_err());
        assert!(validate_operation_id("capture/id").is_err());
        assert!(validate_operation_id(&"x".repeat(129)).is_err());
    }

    #[test]
    fn recovery_prepared_only_cleans_transaction() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let tx = StoredTransaction {
            id: "prepared".into(),
            phase: TransactionPhase::Prepared,
            root_path: project.project_path.clone(),
            before: Vec::new(),
            target: Vec::new(),
            undo_environment_id: None,
            pending_undo: PendingUndoAction::Noop,
        };
        fs::write(
            store.transaction_path(&project),
            serde_json::to_vec(&tx).unwrap(),
        )
        .unwrap();
        fs::write(dir.path().join("a.env"), b"outside").unwrap();
        assert!(store.open_project(&project).is_ok());
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"outside");
        assert!(!store.transaction_path(&project).exists());
    }

    #[test]
    fn recovery_third_state_blocks_without_overwriting_external_file() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let tx = StoredTransaction {
            id: "committing-external".into(),
            phase: TransactionPhase::Committing,
            root_path: project.project_path.clone(),
            before: vec![TransactionEntry {
                path: "a.env".into(),
                state: SnapshotState::Present,
                digest: Some(digest_bytes(b"before")),
                size: Some(6),
                staging: Some("before".into()),
            }],
            target: vec![TransactionEntry {
                path: "a.env".into(),
                state: SnapshotState::Present,
                digest: Some(digest_bytes(b"target")),
                size: Some(6),
                staging: Some("target".into()),
            }],
            undo_environment_id: None,
            pending_undo: PendingUndoAction::Noop,
        };
        fs::create_dir_all(
            store
                .key_dir(&project.profile_id, &project.project_id)
                .join("staging/committing-external/before"),
        )
        .unwrap();
        fs::write(
            store
                .key_dir(&project.profile_id, &project.project_id)
                .join("staging/committing-external/before/before"),
            b"before",
        )
        .unwrap();
        fs::write(dir.path().join("a.env"), b"external").unwrap();
        fs::write(
            store.transaction_path(&project),
            serde_json::to_vec(&tx).unwrap(),
        )
        .unwrap();
        let state = store.open_project(&project).unwrap();
        assert!(state.blocked);
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"external");
    }

    #[test]
    fn failed_replace_keeps_destination_and_temporary_source() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let source = dir.path().join("source");
        let destination = dir.path().join("target");
        fs::write(&source, b"new").unwrap();
        fs::write(&destination, b"old").unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_REPLACE", "1");
        let result = replace_file_from(&source, &destination);
        std::env::remove_var("EASYPACK_ENV_FAIL_REPLACE");
        assert!(result.is_err());
        assert_eq!(fs::read(&destination).unwrap(), b"old");
        assert!(source.exists());
        assert!(fs::read_dir(dir.path())
            .unwrap()
            .filter_map(Result::ok)
            .any(|item| item
                .file_name()
                .to_string_lossy()
                .starts_with(".target.tmp-")));
    }

    #[test]
    fn undo_publish_failure_keeps_previous_undo_snapshot() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"first").unwrap();
        let first_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                plan_token: first_plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();
        let undo_path = store
            .key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_FILE);
        let old_undo = fs::read(&undo_path).unwrap();
        let old_record: UndoRecord = serde_json::from_slice(&old_undo).unwrap();
        let old_snapshot = store.undo_snapshot_root(&project, &old_record);
        fs::write(dir.path().join("a.env"), b"second").unwrap();
        let second_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id,
                operation_id: "test-plan".into(),
            })
            .unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_UNDO_PUBLISH", "1");
        assert!(store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: manifest.environments[0].id.clone(),
                plan_token: second_plan.token,
                operation_id: "test-apply".into(),
            })
            .is_err());
        std::env::remove_var("EASYPACK_ENV_FAIL_UNDO_PUBLISH");
        assert_eq!(fs::read(&undo_path).unwrap(), old_undo);
        assert!(old_snapshot.exists());
        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
        assert!(store.transaction_path(&project).exists());
        assert!(store.blocked_path(&project).exists());

        let recovered = store.open_project(&project).unwrap();
        assert!(!recovered.blocked);
        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
        assert_ne!(fs::read(&undo_path).unwrap(), old_undo);
        assert!(!old_snapshot.exists());
        assert!(!store.transaction_path(&project).exists());
    }

    #[test]
    fn completed_write_failure_rolls_back_and_keeps_previous_undo() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"first").unwrap();
        let first_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                plan_token: first_plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();
        let undo_path = store
            .key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_FILE);
        let old_undo = fs::read(&undo_path).unwrap();
        let old_record: UndoRecord = serde_json::from_slice(&old_undo).unwrap();
        let old_snapshot = store.undo_snapshot_root(&project, &old_record);
        fs::write(dir.path().join("a.env"), b"second").unwrap();
        let second_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id,
                operation_id: "test-plan".into(),
            })
            .unwrap();

        std::env::set_var("EASYPACK_ENV_FAIL_COMPLETED", "1");
        assert!(store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: manifest.environments[0].id.clone(),
                plan_token: second_plan.token,
                operation_id: "test-apply".into(),
            })
            .is_err());
        std::env::remove_var("EASYPACK_ENV_FAIL_COMPLETED");

        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"second");
        assert_eq!(fs::read(&undo_path).unwrap(), old_undo);
        assert!(old_snapshot.exists());
        assert!(!store.transaction_path(&project).exists());
        assert!(!store.blocked_path(&project).exists());
    }

    #[test]
    fn completed_transaction_recovery_publishes_pending_undo_after_interrupt() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"first").unwrap();
        let first_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                plan_token: first_plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();
        let undo_path = store
            .key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_FILE);
        let old_undo = fs::read(&undo_path).unwrap();
        let old_record: UndoRecord = serde_json::from_slice(&old_undo).unwrap();
        let old_snapshot = store.undo_snapshot_root(&project, &old_record);
        fs::write(dir.path().join("a.env"), b"second").unwrap();
        let second_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id,
                operation_id: "test-plan".into(),
            })
            .unwrap();

        std::env::set_var("EASYPACK_ENV_CRASH_AFTER_COMPLETED", "1");
        assert!(store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: manifest.environments[0].id.clone(),
                plan_token: second_plan.token,
                operation_id: "test-apply".into(),
            })
            .is_err());
        std::env::remove_var("EASYPACK_ENV_CRASH_AFTER_COMPLETED");

        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
        assert_eq!(fs::read(&undo_path).unwrap(), old_undo);
        assert!(old_snapshot.exists());
        assert!(store.transaction_path(&project).exists());

        let restarted = EnvironmentStore::new(store.root.clone());
        restarted.recover_startup().unwrap();
        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
        assert_ne!(fs::read(&undo_path).unwrap(), old_undo);
        assert!(!old_snapshot.exists());
        assert!(!restarted.transaction_path(&project).exists());
        assert!(!restarted.blocked_path(&project).exists());
    }

    #[test]
    fn undo_cleanup_failure_keeps_committed_project_and_retries() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"first").unwrap();
        let first_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                plan_token: first_plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();
        let undo_path = store
            .key_dir(&project.profile_id, &project.project_id)
            .join(UNDO_FILE);
        let old_undo = fs::read(&undo_path).unwrap();
        let old_record: UndoRecord = serde_json::from_slice(&old_undo).unwrap();
        let old_snapshot = store.undo_snapshot_root(&project, &old_record);
        fs::write(dir.path().join("a.env"), b"second").unwrap();
        let second_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id,
                operation_id: "test-plan".into(),
            })
            .unwrap();

        std::env::set_var("EASYPACK_ENV_FAIL_UNDO_CLEANUP", "1");
        assert!(store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: manifest.environments[0].id.clone(),
                plan_token: second_plan.token,
                operation_id: "test-apply".into(),
            })
            .is_err());
        std::env::remove_var("EASYPACK_ENV_FAIL_UNDO_CLEANUP");

        let new_undo = fs::read(&undo_path).unwrap();
        assert_ne!(new_undo, old_undo);
        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
        assert!(old_snapshot.exists());
        assert!(store.transaction_path(&project).exists());
        assert!(store.blocked_path(&project).exists());

        let restarted = EnvironmentStore::new(store.root.clone());
        restarted.recover_startup().unwrap();
        assert_eq!(fs::read(&undo_path).unwrap(), new_undo);
        assert!(!old_snapshot.exists());
        assert!(!restarted.transaction_path(&project).exists());
        assert!(!restarted.blocked_path(&project).exists());
    }

    #[test]
    fn profile_delete_uses_index_when_manifest_is_corrupt_and_delete_can_restore() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let root_a = dir.path().join("a");
        let root_b = dir.path().join("b");
        fs::create_dir_all(&root_a).unwrap();
        fs::create_dir_all(&root_b).unwrap();
        fs::write(root_a.join("a.env"), b"a").unwrap();
        fs::write(root_b.join("a.env"), b"b").unwrap();
        let project_a = ProjectRef {
            profile_id: "profile-index".into(),
            project_id: "a".into(),
            project_path: root_a.to_string_lossy().to_string(),
        };
        let project_b = ProjectRef {
            profile_id: "profile-index".into(),
            project_id: "b".into(),
            project_path: root_b.to_string_lossy().to_string(),
        };
        for project in [&project_a, &project_b] {
            store
                .create_environment(&CreateEnvironmentRequest {
                    project: project.clone(),
                    name: "dev".into(),
                    managed_paths: vec!["a.env".into()],
                })
                .unwrap();
        }
        fs::write(store.manifest_path(&project_b), b"broken").unwrap();
        let response = store
            .prepare_delete_project(&ProjectDeleteRequest {
                profile_id: project_a.profile_id.clone(),
                project_id: project_a.project_id.clone(),
                operation_id: None,
            })
            .unwrap();
        assert!(store.open_project(&project_a).is_err());
        store
            .restore_delete(&DeleteRestoreRequest {
                token: response.token,
            })
            .unwrap();
        assert!(store.open_project(&project_a).is_ok());
        store
            .delete_profile(&ProfileDeleteRequest {
                profile_id: project_a.profile_id,
                operation_id: None,
            })
            .unwrap();
        assert!(!store.key_dir("profile-index", "a").exists());
        assert!(!store.key_dir("profile-index", "b").exists());
    }

    #[test]
    fn rebind_updates_root_and_recovery_uses_transaction_root() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let root_a = dir.path().join("a");
        let root_b = dir.path().join("b");
        fs::create_dir_all(&root_a).unwrap();
        fs::create_dir_all(&root_b).unwrap();
        fs::write(root_a.join("a.env"), b"old").unwrap();
        fs::write(root_b.join("a.env"), b"current").unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = ProjectRef {
            profile_id: "p".into(),
            project_id: "rebind".into(),
            project_path: root_a.to_string_lossy().to_string(),
        };
        store
            .create_environment(&CreateEnvironmentRequest {
                project: project.clone(),
                name: "dev".into(),
                managed_paths: vec!["a.env".into()],
            })
            .unwrap();
        store
            .rebind_project(&RebindProjectRequest {
                project: project.clone(),
                new_project_path: root_b.to_string_lossy().to_string(),
            })
            .unwrap();
        let manifest = store.load_manifest(&project).unwrap();
        let plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: manifest.environments[0].id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_AFTER", "0");
        assert!(store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: manifest.environments[0].id.clone(),
                plan_token: plan.token,
                operation_id: "test-apply".into(),
            })
            .is_err());
        std::env::remove_var("EASYPACK_ENV_FAIL_AFTER");
        assert_eq!(fs::read(root_b.join("a.env")).unwrap(), b"current");
        assert_eq!(fs::read(root_a.join("a.env")).unwrap(), b"old");
    }

    #[test]
    fn paths_are_strict_and_case_insensitive() {
        let _guard = test_lock();
        assert!(validate_relative_path("config\\settings.json").is_ok());
        assert!(validate_relative_path("../settings.json").is_err());
        assert!(validate_relative_path("C:\\settings.json").is_err());
        assert!(validate_relative_path("file.txt:secret").is_err());
        assert!(validate_relative_path("CON.txt").is_err());
        assert!(normalize_paths(&["a.txt".into(), "A.TXT".into()]).is_err());
    }

    #[test]
    fn snapshot_preserves_opaque_bytes_and_absent_state() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, state) = create(dir.path());
        assert_eq!(state.environments[0].file_count, 3);
        fs::write(dir.path().join("a.env"), b"second").unwrap();
        let second = store
            .create_environment(&CreateEnvironmentRequest {
                project: project.clone(),
                name: "test".to_string(),
                managed_paths: vec![
                    "a.env".to_string(),
                    "b.env".to_string(),
                    "missing.env".to_string(),
                ],
            })
            .unwrap();
        assert_eq!(second.environments.len(), 2);
        let manifest = store.load_manifest(&project).unwrap();
        let env = &manifest.environments[0];
        assert_eq!(env.entries["a.env"].size, Some(8));
        assert_eq!(env.entries["missing.env"].state, SnapshotState::Absent);
        let bytes = store
            .read_blob_entry(
                &store.key_dir("p", &project.project_id),
                &env.entries["a.env"],
            )
            .unwrap();
        assert_eq!(bytes, b"\xef\xbb\xbfA=1\r\n");
    }

    #[test]
    fn project_and_profile_data_are_isolated() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let make_root = |name: &str| {
            let root = dir.path().join(name);
            fs::create_dir_all(&root).unwrap();
            fs::write(root.join("config.env"), name.as_bytes()).unwrap();
            root
        };
        let root_a = make_root("project-a");
        let root_b = make_root("project-b");
        let root_c = make_root("profile-two-project");
        let project_a = ProjectRef {
            profile_id: "profile-one".to_string(),
            project_id: "project".to_string(),
            project_path: root_a.to_string_lossy().to_string(),
        };
        let project_b = ProjectRef {
            profile_id: "profile-one".to_string(),
            project_id: "other-project".to_string(),
            project_path: root_b.to_string_lossy().to_string(),
        };
        let project_c = ProjectRef {
            profile_id: "profile-two".to_string(),
            project_id: "project".to_string(),
            project_path: root_c.to_string_lossy().to_string(),
        };
        let create = |project: &ProjectRef| {
            store
                .create_environment(&CreateEnvironmentRequest {
                    project: project.clone(),
                    name: "dev".to_string(),
                    managed_paths: vec!["config.env".to_string()],
                })
                .unwrap();
        };
        create(&project_a);
        create(&project_b);
        create(&project_c);

        assert_ne!(
            EnvironmentStore::key_for(&project_a.profile_id, &project_a.project_id),
            EnvironmentStore::key_for(&project_b.profile_id, &project_b.project_id)
        );
        assert_ne!(
            EnvironmentStore::key_for(&project_a.profile_id, &project_a.project_id),
            EnvironmentStore::key_for(&project_c.profile_id, &project_c.project_id)
        );

        store
            .delete_project(&ProjectDeleteRequest {
                profile_id: project_a.profile_id.clone(),
                project_id: project_a.project_id.clone(),
                operation_id: None,
            })
            .unwrap();
        assert!(store
            .open_project(&project_a)
            .unwrap()
            .environments
            .is_empty());
        assert!(store.open_project(&project_b).is_ok());
        assert!(store.open_project(&project_c).is_ok());

        store
            .delete_profile(&ProfileDeleteRequest {
                profile_id: project_a.profile_id,
                operation_id: None,
            })
            .unwrap();
        assert!(store
            .open_project(&project_b)
            .unwrap()
            .environments
            .is_empty());
        assert!(store.open_project(&project_c).is_ok());
    }

    #[test]
    fn plan_apply_delete_and_undo_once() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        fs::write(dir.path().join("a.env"), b"changed").unwrap();
        fs::remove_file(dir.path().join("b.env")).unwrap();
        fs::write(dir.path().join("missing.env"), b"new").unwrap();
        let plan = store.plan_environment(&EnvironmentRequest {
            project: project.clone(),
            environment_id: "env-does-not-exist".into(),
            operation_id: "test-plan".into(),
        });
        assert!(plan.is_err());
        let manifest = store.load_manifest(&project).unwrap();
        let env_id = manifest.environments[0].id.clone();
        let plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: env_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        assert!(plan
            .changes
            .iter()
            .any(|c| matches!(c.action, ChangeAction::Overwrite)));
        assert!(plan
            .changes
            .iter()
            .any(|c| matches!(c.action, ChangeAction::Delete)));
        assert!(plan
            .changes
            .iter()
            .any(|c| matches!(c.action, ChangeAction::Create)));
        let applied = store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: env_id.clone(),
                plan_token: plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();
        assert!(applied.applied);
        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
        assert_eq!(fs::read(dir.path().join("b.env")).unwrap(), b"B=1");
        assert!(!dir.path().join("missing.env").exists());
        let undo_plan = store.plan_undo_environment(&project).unwrap();
        assert!(undo_plan
            .changes
            .iter()
            .any(|c| matches!(c.action, ChangeAction::Overwrite)));
        assert!(undo_plan
            .changes
            .iter()
            .any(|c| matches!(c.action, ChangeAction::Delete)));
        assert!(undo_plan
            .changes
            .iter()
            .any(|c| matches!(c.action, ChangeAction::Create)));
        let undone = store
            .undo_environment(&UndoRequest {
                project: project.clone(),
                plan_token: undo_plan.token,
                operation_id: "test-undo".into(),
            })
            .unwrap();
        assert!(undone.applied);
        assert!(!undone.undo_available);
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"changed");
        assert!(!dir.path().join("b.env").exists());
        assert_eq!(fs::read(dir.path().join("missing.env")).unwrap(), b"new");
        let no_undo = store.plan_undo_environment(&project).unwrap_err();
        assert!(no_undo.contains("没有可撤销的环境变更"));
        let no_undo = store
            .undo_environment(&UndoRequest {
                project,
                plan_token: "unused".to_string(),
                operation_id: "test-undo-missing".into(),
            })
            .unwrap_err();
        assert!(no_undo.contains("没有可撤销的环境变更"));
    }

    #[test]
    fn undo_plan_is_stale_without_writing_and_new_token_can_overwrite() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"changed").unwrap();
        let apply_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: environment_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id,
                plan_token: apply_plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();

        let before_plan = fs::read(dir.path().join("a.env")).unwrap();
        let files_before_preview = file_count(store.root.as_path());
        let undo_plan = store.plan_undo_environment(&project).unwrap();
        let repeated_plan = store.plan_undo_environment(&project).unwrap();
        assert_eq!(undo_plan.token, repeated_plan.token);
        assert_eq!(file_count(store.root.as_path()), files_before_preview);
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), before_plan);
        assert!(undo_plan
            .changes
            .iter()
            .any(|c| c.path == "a.env" && matches!(c.action, ChangeAction::Overwrite)));
        fs::write(dir.path().join("a.env"), b"outside").unwrap();
        let stale = store
            .undo_environment(&UndoRequest {
                project: project.clone(),
                plan_token: undo_plan.token,
                operation_id: "test-undo-stale".into(),
            })
            .unwrap();
        assert!(!stale.applied);
        assert!(stale.stale);
        assert_ne!(stale.plan.token, "");
        assert!(stale
            .plan
            .changes
            .iter()
            .any(|c| c.path == "a.env" && matches!(c.action, ChangeAction::Overwrite)));
        assert_eq!(file_count(store.root.as_path()), files_before_preview);
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"outside");

        let applied = store
            .undo_environment(&UndoRequest {
                project: project.clone(),
                plan_token: stale.plan.token,
                operation_id: "test-undo-stale-retry".into(),
            })
            .unwrap();
        assert!(applied.applied);
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"changed");
        assert!(!store.undo_exists(&project));
    }

    #[test]
    fn undo_failure_rolls_back_and_keeps_undo_record() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"changed").unwrap();
        let apply_plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id,
                operation_id: "test-plan".into(),
            })
            .unwrap();
        store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: manifest.environments[0].id.clone(),
                plan_token: apply_plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();
        let undo_plan = store.plan_undo_environment(&project).unwrap();

        std::env::set_var("EASYPACK_ENV_FAIL_AFTER", "1");
        let result = store.undo_environment(&UndoRequest {
            project: project.clone(),
            plan_token: undo_plan.token,
            operation_id: "test-undo-failure".into(),
        });
        std::env::remove_var("EASYPACK_ENV_FAIL_AFTER");

        assert!(result.is_err());
        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xEF\xBB\xBFA=1\r\n"
        );
        assert_eq!(fs::read(dir.path().join("b.env")).unwrap(), b"B=1");
        assert!(!dir.path().join("missing.env").exists());
        assert!(store.undo_exists(&project));
        assert!(!store.transaction_path(&project).exists());
    }

    #[test]
    fn stale_plan_returns_new_plan_without_writing() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let env_id = manifest.environments[0].id.clone();
        let plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: env_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        fs::write(dir.path().join("a.env"), b"outside").unwrap();
        let response = store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: env_id,
                plan_token: plan.token,
                operation_id: "test-apply".into(),
            })
            .unwrap();
        assert!(response.stale);
        assert!(!response.applied);
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"outside");
    }

    #[test]
    fn failed_commit_rolls_back_and_recovery_rolls_back_transaction() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let env_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"changed").unwrap();
        let plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: env_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_AFTER", "1");
        let result = store.apply_environment(&ApplyRequest {
            project: project.clone(),
            environment_id: env_id.clone(),
            plan_token: plan.token,
            operation_id: "test-apply".into(),
        });
        std::env::remove_var("EASYPACK_ENV_FAIL_AFTER");
        assert!(result.is_err());
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"changed");
        assert!(!store.transaction_path(&project).exists());
        let _ = store.open_project(&project).unwrap();
    }

    #[test]
    fn undo_record_failure_rolls_back_after_files_are_written() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let env_id = manifest.environments[0].id.clone();
        fs::write(dir.path().join("a.env"), b"changed").unwrap();
        let plan = store
            .plan_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: env_id.clone(),
                operation_id: "test-plan".into(),
            })
            .unwrap();

        std::env::set_var("EASYPACK_ENV_FAIL_UNDO", "1");
        let result = store.apply_environment(&ApplyRequest {
            project: project.clone(),
            environment_id: env_id,
            plan_token: plan.token,
            operation_id: "test-apply".into(),
        });
        std::env::remove_var("EASYPACK_ENV_FAIL_UNDO");

        assert!(result.is_err());
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"changed");
        assert!(!store.transaction_path(&project).exists());
        assert!(!store.blocked_path(&project).exists());
    }

    #[test]
    fn open_project_exposes_blocked_state_without_evidence_body() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        fs::write(store.blocked_path(&project), b"secret transaction body").unwrap();

        let state = store.open_project(&project).unwrap();

        assert!(state.blocked);
        assert_eq!(state.recovery_error.as_deref(), Some(RECOVERY_ERROR_CODE));
        let serialized = serde_json::to_string(&state).unwrap();
        assert!(serialized.contains("recoveryError"));
        assert!(!serialized.contains("secret transaction body"));
    }

    #[test]
    fn open_project_returns_empty_state_without_creating_environment_data() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = project(dir.path());

        let state = store.open_project(&project).unwrap();

        assert_eq!(state.profile_id, project.profile_id);
        assert_eq!(state.project_id, project.project_id);
        assert_eq!(state.project_path, project.project_path);
        assert!(state.managed_paths.is_empty());
        assert!(state.environments.is_empty());
        assert!(!state.undo_available);
        assert!(!state.blocked);
        assert_eq!(state.recovery_error, None);
        assert!(!store.root.exists());
        assert!(!store.manifest_path(&project).exists());
    }

    #[test]
    fn open_project_rejects_missing_project_path_without_manifest() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project_root = dir.path().join("missing-project");
        let project = project(&project_root);

        let result = store.open_project(&project);

        assert!(result.is_err());
        assert!(!store.root.exists());
    }

    #[test]
    fn open_project_retries_failed_recovery_and_clears_block_on_success() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        seed_rollback_failed(&store, &project, true);

        let state = store.open_project(&project).unwrap();

        assert!(!state.blocked);
        assert_eq!(state.recovery_error, None);
        assert!(!store.transaction_path(&project).exists());
        assert!(!store.blocked_path(&project).exists());
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"before");
    }

    #[test]
    fn open_project_keeps_blocked_after_failed_retry_until_recovery_is_fixed() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        seed_rollback_failed(&store, &project, false);

        let blocked = store.open_project(&project).unwrap();

        assert!(blocked.blocked);
        assert_eq!(blocked.recovery_error.as_deref(), Some(RECOVERY_ERROR_CODE));
        assert!(store.transaction_path(&project).exists());
        assert!(store.blocked_path(&project).exists());
        let serialized = serde_json::to_string(&blocked).unwrap();
        assert!(!serialized.contains("secret transaction body"));

        let stage = store
            .key_dir(&project.profile_id, &project.project_id)
            .join("staging")
            .join("tx-recovery-test")
            .join("before");
        fs::write(stage.join("before-a"), b"before").unwrap();
        let recovered = store.open_project(&project).unwrap();
        assert!(!recovered.blocked);
        assert_eq!(recovered.recovery_error, None);
        assert_eq!(fs::read(dir.path().join("a.env")).unwrap(), b"before");
    }

    #[test]
    fn recover_startup_cleans_completed_transaction() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let transaction = StoredTransaction {
            id: "tx-completed".to_string(),
            phase: TransactionPhase::Completed,
            root_path: project.project_path.clone(),
            before: Vec::new(),
            target: Vec::new(),
            undo_environment_id: None,
            pending_undo: PendingUndoAction::Noop,
        };
        fs::write(
            store.transaction_path(&project),
            serde_json::to_vec(&transaction).unwrap(),
        )
        .unwrap();

        assert!(store.recover_startup().is_ok());
        assert!(!store.transaction_path(&project).exists());
        assert!(!store.blocked_path(&project).exists());
        assert!(!store.open_project(&project).unwrap().blocked);
    }

    #[test]
    fn recover_startup_blocks_corrupt_transaction_without_cross_project_effects() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let root_a = dir.path().join("project-a");
        let root_b = dir.path().join("project-b");
        fs::create_dir_all(&root_a).unwrap();
        fs::create_dir_all(&root_b).unwrap();
        fs::write(root_a.join("config.env"), b"a").unwrap();
        fs::write(root_b.join("config.env"), b"b").unwrap();
        let project_a = ProjectRef {
            profile_id: "profile-one".to_string(),
            project_id: "project-a".to_string(),
            project_path: root_a.to_string_lossy().to_string(),
        };
        let project_b = ProjectRef {
            profile_id: "profile-one".to_string(),
            project_id: "project-b".to_string(),
            project_path: root_b.to_string_lossy().to_string(),
        };
        for project in [&project_a, &project_b] {
            store
                .create_environment(&CreateEnvironmentRequest {
                    project: project.clone(),
                    name: "dev".to_string(),
                    managed_paths: vec!["config.env".to_string()],
                })
                .unwrap();
        }
        fs::write(
            store.transaction_path(&project_a),
            br#"{"secret":"transaction body""#,
        )
        .unwrap();
        let completed = StoredTransaction {
            id: "tx-project-b".to_string(),
            phase: TransactionPhase::Completed,
            root_path: project_b.project_path.clone(),
            before: Vec::new(),
            target: Vec::new(),
            undo_environment_id: None,
            pending_undo: PendingUndoAction::Noop,
        };
        fs::write(
            store.transaction_path(&project_b),
            serde_json::to_vec(&completed).unwrap(),
        )
        .unwrap();

        assert!(store.recover_startup().is_err());
        assert_eq!(
            fs::read(store.blocked_path(&project_a)).unwrap(),
            RECOVERY_ERROR_CODE.as_bytes()
        );
        assert!(!store.transaction_path(&project_b).exists());
        let state_a = store.open_project(&project_a).unwrap();
        let state_b = store.open_project(&project_b).unwrap();
        assert!(state_a.blocked);
        assert_eq!(state_a.recovery_error.as_deref(), Some(RECOVERY_ERROR_CODE));
        assert!(!state_b.blocked);
        let serialized = serde_json::to_string(&state_a).unwrap();
        assert!(!serialized.contains("transaction body"));
    }

    #[test]
    fn apply_rejects_a_blocked_project_without_writing() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let (store, project, _) = create(dir.path());
        let manifest = store.load_manifest(&project).unwrap();
        let environment_id = manifest.environments[0].id.clone();
        fs::write(store.blocked_path(&project), b"secret transaction body").unwrap();

        let result = store.apply_environment(&ApplyRequest {
            project: project.clone(),
            environment_id,
            plan_token: "unused".to_string(),
            operation_id: "test-apply".into(),
        });

        assert!(result.is_err());
        assert_eq!(
            fs::read(dir.path().join("a.env")).unwrap(),
            b"\xef\xbb\xbfA=1\r\n"
        );
    }

    #[test]
    fn prepare_profile_rolls_back_all_moves_when_a_later_move_fails() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project_a =
            create_registered_project(&store, &dir.path().join("project-a"), "profile-delete", "a");
        let project_b =
            create_registered_project(&store, &dir.path().join("project-b"), "profile-delete", "b");

        std::env::set_var("EASYPACK_ENV_FAIL_DELETE_PREPARE", "2");
        let result = store.prepare_delete_profile(&ProfileDeleteRequest {
            profile_id: "profile-delete".to_string(),
            operation_id: None,
        });
        std::env::remove_var("EASYPACK_ENV_FAIL_DELETE_PREPARE");

        assert!(result.is_err());
        assert!(store
            .key_dir(&project_a.profile_id, &project_a.project_id)
            .exists());
        assert!(store
            .key_dir(&project_b.profile_id, &project_b.project_id)
            .exists());
        assert!(store
            .load_profile_index()
            .unwrap()
            .profiles
            .get("profile-delete")
            .is_some_and(|projects| projects.len() == 2));
        assert!(!store.root.join(DELETION_DIR).join("tombstones").exists());
    }

    #[test]
    fn finalize_index_failure_returns_to_prepared_and_can_restore() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = create_registered_project(
            &store,
            &dir.path().join("project"),
            "profile-index-failure",
            "project",
        );
        let response = store
            .prepare_delete_project(&ProjectDeleteRequest {
                profile_id: project.profile_id.clone(),
                project_id: project.project_id.clone(),
                operation_id: None,
            })
            .unwrap();
        let key = EnvironmentStore::key_for(&project.profile_id, &project.project_id);
        let record_path = store.deletion_record_path(&response.token);
        std::env::set_var("EASYPACK_ENV_FAIL_DELETE_INDEX", "1");
        assert!(store
            .finalize_delete(&DeleteFinalizeRequest {
                token: response.token.clone(),
            })
            .is_err());
        std::env::remove_var("EASYPACK_ENV_FAIL_DELETE_INDEX");

        let record: DeletionRecord =
            serde_json::from_slice(&fs::read(&record_path).unwrap()).unwrap();
        assert_eq!(record.phase, DeletionPhase::Prepared);
        assert!(store.deletion_tombstone_path(&key).exists());
        assert!(store
            .deletion_stage_root(&response.token)
            .join(&key)
            .exists());
        assert!(store
            .load_profile_index()
            .unwrap()
            .profiles
            .get(&project.profile_id)
            .is_some_and(|projects| projects.contains_key(&project.project_id)));

        store
            .restore_delete(&DeleteRestoreRequest {
                token: response.token,
            })
            .unwrap();
        assert!(!record_path.exists());
        assert!(!store.deletion_tombstone_path(&key).exists());
        assert!(store
            .key_dir(&project.profile_id, &project.project_id)
            .exists());
        assert!(store
            .load_profile_index()
            .unwrap()
            .profiles
            .get(&project.profile_id)
            .is_some_and(|projects| projects.contains_key(&project.project_id)));
    }

    #[test]
    fn finalize_partial_trash_failure_returns_ok_and_startup_retries_without_restore() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project_a = create_registered_project(
            &store,
            &dir.path().join("project-a"),
            "profile-trash-failure",
            "a",
        );
        let project_b = create_registered_project(
            &store,
            &dir.path().join("project-b"),
            "profile-trash-failure",
            "b",
        );
        let response = store
            .prepare_delete_profile(&ProfileDeleteRequest {
                profile_id: "profile-trash-failure".to_string(),
                operation_id: None,
            })
            .unwrap();
        let key_a = EnvironmentStore::key_for(&project_a.profile_id, &project_a.project_id);
        let key_b = EnvironmentStore::key_for(&project_b.profile_id, &project_b.project_id);
        std::env::set_var("EASYPACK_ENV_FAIL_DELETE_TRASH", "2");
        assert!(store
            .finalize_delete(&DeleteFinalizeRequest {
                token: response.token.clone(),
            })
            .is_ok());
        std::env::remove_var("EASYPACK_ENV_FAIL_DELETE_TRASH");
        let record: DeletionRecord =
            serde_json::from_slice(&fs::read(store.deletion_record_path(&response.token)).unwrap())
                .unwrap();
        assert_eq!(record.phase, DeletionPhase::Finalizing);
        assert!(!store
            .load_profile_index()
            .unwrap()
            .profiles
            .contains_key("profile-trash-failure"));
        assert!(!store
            .deletion_stage_root(&response.token)
            .join(&key_a)
            .exists());
        assert!(store
            .deletion_stage_root(&response.token)
            .join(&key_b)
            .exists());
        assert!(store
            .restore_delete(&DeleteRestoreRequest {
                token: response.token.clone(),
            })
            .is_err());
        assert!(!store
            .key_dir(&project_a.profile_id, &project_a.project_id)
            .exists());
        assert!(!store
            .key_dir(&project_b.profile_id, &project_b.project_id)
            .exists());

        let restarted = EnvironmentStore::new(store.root.clone());
        restarted.recover_startup().unwrap();
        assert!(!restarted.deletion_record_path(&response.token).exists());
        assert!(!restarted.deletion_tombstone_path(&key_a).exists());
        assert!(!restarted.deletion_tombstone_path(&key_b).exists());
        assert!(!restarted
            .key_dir(&project_a.profile_id, &project_a.project_id)
            .exists());
        assert!(!restarted
            .key_dir(&project_b.profile_id, &project_b.project_id)
            .exists());
        let index = restarted.load_profile_index().unwrap();
        for projects in index.profiles.values() {
            for key in projects.values() {
                assert!(restarted.root.join(key).exists());
            }
        }
    }

    #[test]
    fn finalize_committed_delete_can_retry_after_partial_cleanup() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project_a = create_registered_project(
            &store,
            &dir.path().join("project-a"),
            "profile-delete-retry",
            "a",
        );
        let project_b = create_registered_project(
            &store,
            &dir.path().join("project-b"),
            "profile-delete-retry",
            "b",
        );
        let response = store
            .prepare_delete_profile(&ProfileDeleteRequest {
                profile_id: "profile-delete-retry".to_string(),
                operation_id: None,
            })
            .unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_DELETE_TRASH", "2");
        store
            .finalize_delete(&DeleteFinalizeRequest {
                token: response.token.clone(),
            })
            .unwrap();
        std::env::remove_var("EASYPACK_ENV_FAIL_DELETE_TRASH");

        store
            .finalize_delete(&DeleteFinalizeRequest {
                token: response.token.clone(),
            })
            .unwrap();
        assert!(!store.deletion_record_path(&response.token).exists());
        assert!(!store
            .key_dir(&project_a.profile_id, &project_a.project_id)
            .exists());
        assert!(!store
            .key_dir(&project_b.profile_id, &project_b.project_id)
            .exists());
    }

    #[test]
    fn recover_startup_finalizing_removes_index_before_cleanup() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = create_registered_project(
            &store,
            &dir.path().join("project"),
            "profile-finalizing-crash",
            "project",
        );
        let response = store
            .prepare_delete_project(&ProjectDeleteRequest {
                profile_id: project.profile_id.clone(),
                project_id: project.project_id.clone(),
                operation_id: None,
            })
            .unwrap();
        let record_path = store.deletion_record_path(&response.token);
        let (_, mut record) = store.load_deletion_record(&response.token).unwrap();
        record.phase = DeletionPhase::Finalizing;
        store.write_deletion_record(&record_path, &record).unwrap();

        let restarted = EnvironmentStore::new(store.root.clone());
        restarted.recover_startup().unwrap();
        assert!(!restarted.deletion_record_path(&response.token).exists());
        assert!(!restarted
            .key_dir(&project.profile_id, &project.project_id)
            .exists());
        assert!(!restarted
            .load_profile_index()
            .unwrap()
            .profiles
            .get(&project.profile_id)
            .is_some_and(|projects| projects.contains_key(&project.project_id)));
    }

    #[test]
    fn restore_partial_failure_keeps_tombstones_and_can_retry() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project_a = create_registered_project(
            &store,
            &dir.path().join("project-a"),
            "profile-restore",
            "a",
        );
        let project_b = create_registered_project(
            &store,
            &dir.path().join("project-b"),
            "profile-restore",
            "b",
        );
        let response = store
            .prepare_delete_profile(&ProfileDeleteRequest {
                profile_id: "profile-restore".to_string(),
                operation_id: None,
            })
            .unwrap();
        std::env::set_var("EASYPACK_ENV_FAIL_DELETE_RESTORE", "2");
        assert!(store
            .restore_delete(&DeleteRestoreRequest {
                token: response.token.clone(),
            })
            .is_err());
        std::env::remove_var("EASYPACK_ENV_FAIL_DELETE_RESTORE");
        assert!(store
            .key_dir(&project_a.profile_id, &project_a.project_id)
            .exists());
        assert!(!store
            .key_dir(&project_b.profile_id, &project_b.project_id)
            .exists());
        assert!(store.deletion_record_path(&response.token).exists());
        assert!(store
            .deletion_tombstone_path(&EnvironmentStore::key_for(
                &project_a.profile_id,
                &project_a.project_id
            ))
            .exists());

        store
            .restore_delete(&DeleteRestoreRequest {
                token: response.token,
            })
            .unwrap();
        assert!(store
            .key_dir(&project_b.profile_id, &project_b.project_id)
            .exists());
        assert!(store
            .load_profile_index()
            .unwrap()
            .profiles
            .get("profile-restore")
            .is_some_and(|projects| projects.len() == 2));
    }

    #[test]
    fn tombstone_rejects_normal_operations_until_restore() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = create_registered_project(
            &store,
            &dir.path().join("project"),
            "profile-tombstone",
            "project",
        );
        let response = store
            .prepare_delete_project(&ProjectDeleteRequest {
                profile_id: project.profile_id.clone(),
                project_id: project.project_id.clone(),
                operation_id: None,
            })
            .unwrap();
        assert!(store
            .create_environment(&CreateEnvironmentRequest {
                project: project.clone(),
                name: "new".to_string(),
                managed_paths: vec!["config.env".to_string()],
            })
            .is_err());
        assert!(store.open_project(&project).is_err());
        assert!(store
            .capture_environment(&EnvironmentRequest {
                project: project.clone(),
                environment_id: "env".to_string(),
                operation_id: "test-capture".into(),
            })
            .is_err());
        assert!(store
            .apply_environment(&ApplyRequest {
                project: project.clone(),
                environment_id: "env".to_string(),
                plan_token: "unused".to_string(),
                operation_id: "test-apply".into(),
            })
            .is_err());
        store
            .restore_delete(&DeleteRestoreRequest {
                token: response.token,
            })
            .unwrap();
        assert!(store.open_project(&project).is_ok());
    }

    #[test]
    fn recover_startup_keeps_prepared_delete_for_frontend_recovery() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = EnvironmentStore::new(dir.path().join("data"));
        let project = create_registered_project(
            &store,
            &dir.path().join("project"),
            "profile-startup-delete",
            "project",
        );
        let response = store
            .prepare_delete_project(&ProjectDeleteRequest {
                profile_id: project.profile_id.clone(),
                project_id: project.project_id.clone(),
                operation_id: None,
            })
            .unwrap();
        let restarted = EnvironmentStore::new(store.root.clone());
        restarted.recover_startup().unwrap();
        assert!(!restarted
            .key_dir(&project.profile_id, &project.project_id)
            .exists());
        assert!(restarted.deletion_record_path(&response.token).exists());
        assert!(restarted
            .deletion_tombstone_path(&EnvironmentStore::key_for(
                &project.profile_id,
                &project.project_id,
            ))
            .exists());
        assert!(restarted.open_project(&project).is_err());
        restarted
            .restore_delete(&DeleteRestoreRequest {
                token: response.token,
            })
            .unwrap();
        assert!(restarted
            .key_dir(&project.profile_id, &project.project_id)
            .exists());
        assert!(restarted.open_project(&project).is_ok());
    }

    #[test]
    fn concurrent_delete_prepare_keeps_projects_isolated() {
        let _guard = test_lock();
        let dir = tempdir().unwrap();
        let store = std::sync::Arc::new(EnvironmentStore::new(dir.path().join("data")));
        let project_a = create_registered_project(
            &store,
            &dir.path().join("project-a"),
            "profile-concurrent",
            "a",
        );
        let project_b = create_registered_project(
            &store,
            &dir.path().join("project-b"),
            "profile-concurrent",
            "b",
        );
        let store_a = store.clone();
        let store_b = store.clone();
        let project_a_for_thread = project_a.clone();
        let project_b_for_thread = project_b.clone();
        let handle_a = std::thread::spawn(move || {
            store_a.prepare_delete_project(&ProjectDeleteRequest {
                profile_id: project_a_for_thread.profile_id,
                project_id: project_a_for_thread.project_id,
                operation_id: None,
            })
        });
        let handle_b = std::thread::spawn(move || {
            store_b.prepare_delete_project(&ProjectDeleteRequest {
                profile_id: project_b_for_thread.profile_id,
                project_id: project_b_for_thread.project_id,
                operation_id: None,
            })
        });
        let response_a = handle_a.join().unwrap().unwrap();
        let response_b = handle_b.join().unwrap().unwrap();
        assert!(!store
            .key_dir(&project_a.profile_id, &project_a.project_id)
            .exists());
        assert!(!store
            .key_dir(&project_b.profile_id, &project_b.project_id)
            .exists());
        store
            .restore_delete(&DeleteRestoreRequest {
                token: response_a.token,
            })
            .unwrap();
        store
            .restore_delete(&DeleteRestoreRequest {
                token: response_b.token,
            })
            .unwrap();
        assert!(store.open_project(&project_a).is_ok());
        assert!(store.open_project(&project_b).is_ok());
    }
}
