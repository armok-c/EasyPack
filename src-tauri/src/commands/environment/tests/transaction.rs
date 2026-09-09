use super::super::model::*;
use super::super::path::*;
use super::super::store::EnvironmentStore;
use super::super::store::{RECOVERY_ERROR_CODE, UNDO_FILE};
use super::common::{create, file_count, project, seed_rollback_failed, test_lock};
use std::fs;
use tempfile::tempdir;

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
