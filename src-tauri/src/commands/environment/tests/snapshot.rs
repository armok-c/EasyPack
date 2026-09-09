use super::super::model::*;
use super::super::path::*;
use super::super::store::EnvironmentStore;
use super::super::store::UNDO_FILE;
use super::common::{create, file_count, project, test_lock};
use std::fs;
use std::sync::{Arc, Mutex};
use tempfile::tempdir;

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
fn migrate_manifest_invalidates_undo_after_save_only() {
    let _guard = test_lock();
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path()).unwrap();
    fs::write(dir.path().join("a.env"), b"initial").unwrap();
    let store = EnvironmentStore::new(dir.path().join("data"));
    let project = project(dir.path());
    let created = store
        .create_environment(&CreateEnvironmentRequest {
            project: project.clone(),
            name: "dev".into(),
            managed_paths: vec!["a.env".into()],
        })
        .unwrap();
    let environment_id = created.environments[0].id.clone();

    fs::write(dir.path().join("a.env"), b"external").unwrap();
    let plan = store
        .plan_environment(&EnvironmentRequest {
            project: project.clone(),
            environment_id: environment_id.clone(),
            operation_id: "migrate-undo-plan".into(),
        })
        .unwrap();
    let applied = store
        .apply_environment(&ApplyRequest {
            project: project.clone(),
            environment_id: environment_id.clone(),
            plan_token: plan.token,
            operation_id: "migrate-undo-apply".into(),
        })
        .unwrap();
    assert!(applied.undo_available);
    let undo_path = store
        .key_dir(&project.profile_id, &project.project_id)
        .join(UNDO_FILE);
    let old_undo = fs::read(&undo_path).unwrap();
    let old_record: UndoRecord = serde_json::from_slice(&old_undo).unwrap();
    let old_snapshot = store.undo_snapshot_root(&project, &old_record);

    let unchanged = store
        .migrate_manifest(&MigrateManifestRequest {
            project: project.clone(),
            managed_paths: vec!["a.env".into()],
            environments: vec![MigrationEnvironment {
                environment_id: environment_id.clone(),
                entries: Vec::new(),
            }],
        })
        .unwrap();
    assert!(unchanged.undo_available);
    assert_eq!(fs::read(&undo_path).unwrap(), old_undo);
    assert!(old_snapshot.exists());

    let migration = || MigrateManifestRequest {
        project: project.clone(),
        managed_paths: vec!["a.env".into(), "b.env".into()],
        environments: vec![MigrationEnvironment {
            environment_id: environment_id.clone(),
            entries: vec![MigrationEntry {
                path: "b.env".into(),
                state: SnapshotState::Present,
                content: Some(b"migrated".to_vec()),
            }],
        }],
    };

    std::env::set_var("EASYPACK_ENV_FAIL_MANIFEST", "1");
    assert!(store.migrate_manifest(&migration()).is_err());
    std::env::remove_var("EASYPACK_ENV_FAIL_MANIFEST");
    assert_eq!(
        store.load_manifest(&project).unwrap().managed_paths,
        vec!["a.env"]
    );
    assert_eq!(fs::read(&undo_path).unwrap(), old_undo);
    assert!(store.plan_undo_environment(&project).is_ok());

    let migrated = store.migrate_manifest(&migration()).unwrap();
    assert_eq!(migrated.managed_paths, vec!["a.env", "b.env"]);
    assert!(!migrated.undo_available);
    assert!(!store.undo_exists(&project));
    assert!(!old_snapshot.exists());
    let no_undo = store.plan_undo_environment(&project).unwrap_err();
    assert!(no_undo.contains("没有可撤销的环境变更"));
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
