use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
pub(super) struct StoredTransaction {
    pub(super) id: String,
    pub(super) phase: TransactionPhase,
    #[serde(default)]
    pub(super) root_path: String,
    pub(super) before: Vec<TransactionEntry>,
    pub(super) target: Vec<TransactionEntry>,
    pub(super) undo_environment_id: Option<String>,
    #[serde(default)]
    pub(super) pending_undo: PendingUndoAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(super) enum TransactionPhase {
    Prepared,
    Committing,
    Completed,
    RollingBack,
    RollbackFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct TransactionEntry {
    pub(super) path: String,
    pub(super) state: SnapshotState,
    pub(super) digest: Option<String>,
    pub(super) size: Option<u64>,
    pub(super) staging: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct UndoRecord {
    pub(super) environment_id: String,
    pub(super) before: Vec<TransactionEntry>,
    pub(super) after: Vec<TransactionEntry>,
    #[serde(default)]
    pub(super) snapshot_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum PendingUndoAction {
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

pub(super) enum UndoIntent<'a> {
    Publish(&'a str),
    Remove(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ProfileIndex {
    pub(super) profiles: BTreeMap<String, BTreeMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) enum DeletionKind {
    Project,
    Profile,
}

pub(super) fn default_deletion_kind() -> DeletionKind {
    DeletionKind::Project
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(super) enum DeletionPhase {
    Prepared,
    Finalizing,
    Finalized,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DeletionProject {
    pub(super) profile_id: String,
    pub(super) project_id: String,
    pub(super) key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DeletionRecord {
    pub(super) id: String,
    pub(super) phase: DeletionPhase,
    #[serde(default = "default_deletion_kind")]
    pub(super) kind: DeletionKind,
    pub(super) projects: Vec<DeletionProject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DeletionTombstone {
    pub(super) token: String,
    pub(super) profile_id: String,
    pub(super) project_id: String,
    pub(super) key: String,
}

#[derive(Debug, Clone)]
pub(super) struct CurrentEntry {
    pub(super) state: SnapshotState,
    pub(super) digest: Option<String>,
    pub(super) size: Option<u64>,
    pub(super) bytes: Option<Vec<u8>>,
}

pub(super) type ProgressCallback<'a> = Option<&'a dyn Fn(&EnvironmentProgressEvent)>;

pub(super) fn report_progress(
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
