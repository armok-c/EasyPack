use super::EnvironmentStore;
use super::{
    ApplyPlan, ApplyRequest, ApplyResponse, BootstrapImportRequest, CreateEnvironmentRequest,
    DeleteFinalizeRequest, DeleteResponse, DeleteRestoreRequest, DeleteStatusRequest,
    DeleteStatusResponse, EnvironmentDetailRequest, EnvironmentDetailResponse,
    EnvironmentProgressEvent, EnvironmentRequest, MigrateManifestRequest, ProfileDeleteRequest,
    ProjectDeleteRequest, ProjectPathRequest, ProjectRef, ProjectState, RebindProjectRequest,
    UndoRequest,
};
use serde::{Deserialize, Serialize};

const DATA_DIR: &str = "environment-data";

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

#[tauri::command]
pub fn environment_open_current_file(
    app: tauri::AppHandle,
    request: EnvironmentDetailRequest,
) -> Result<(), String> {
    let path = from_app(&app)?.current_file_path(&request)?;
    crate::commands::shell::open_file_with_default_program(&path)
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
