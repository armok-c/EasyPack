use super::super::model::*;
use super::super::path::digest_bytes;
use super::super::store::EnvironmentStore;
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

static TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub(super) fn test_lock() -> std::sync::MutexGuard<'static, ()> {
    TEST_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

pub(super) fn project(root: &Path) -> ProjectRef {
    ProjectRef {
        profile_id: "p".to_string(),
        project_id: "C:\\project\\one".to_string(),
        project_path: root.to_string_lossy().to_string(),
    }
}
pub(super) fn create(root: &Path) -> (EnvironmentStore, ProjectRef, ProjectState) {
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

pub(super) fn file_count(root: &Path) -> usize {
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

pub(super) fn create_registered_project(
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

pub(super) fn seed_rollback_failed(
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
