use super::super::model::*;
use super::super::path::*;
use super::common::{create, test_lock};
use std::fs;
use tempfile::tempdir;

#[test]
fn current_file_path_validates_managed_existing_regular_files_without_spawning() {
    let _guard = test_lock();
    let dir = tempdir().unwrap();
    let (store, project, state) = create(dir.path());
    let environment_id = state.environments[0].id.clone();
    let request = |path: &str| EnvironmentDetailRequest {
        project: project.clone(),
        environment_id: environment_id.clone(),
        path: path.to_string(),
    };

    let resolved = store.current_file_path(&request("a.env")).unwrap();
    assert_eq!(
        resolved,
        fs::canonicalize(dir.path()).unwrap().join("a.env")
    );
    assert!(store.current_file_path(&request("missing.env")).is_err());
    assert!(store.current_file_path(&request("../a.env")).is_err());
    assert!(store.current_file_path(&request("unmanaged.env")).is_err());

    fs::remove_file(dir.path().join("a.env")).unwrap();
    fs::create_dir(dir.path().join("a.env")).unwrap();
    let result = store.current_file_path(&request("a.env"));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("普通文件"));
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
