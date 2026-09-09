use super::super::model::*;
use super::super::store::EnvironmentStore;
use super::super::store::DELETION_DIR;
use super::common::{create_registered_project, test_lock};
use std::fs;
use tempfile::tempdir;

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

    let record: DeletionRecord = serde_json::from_slice(&fs::read(&record_path).unwrap()).unwrap();
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
