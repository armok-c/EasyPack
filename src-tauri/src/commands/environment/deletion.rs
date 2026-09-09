use super::model::{
    DeleteFinalizeRequest, DeleteResponse, DeleteRestoreRequest, DeleteStatusRequest,
    DeleteStatusResponse, DeletionKind, DeletionPhase, DeletionProject, DeletionRecord,
    DeletionTombstone, ProfileDeleteRequest, ProjectDeleteRequest,
};
use super::path::{atomic_write, io_error, mark_blocked_path, new_id, validate_operation_id};
use super::store::{DELETION_DIR, DELETION_TOMBSTONE_DIR};
use super::EnvironmentStore;
use std::fs;
use std::path::{Path, PathBuf};

impl EnvironmentStore {
    pub(super) fn deletion_record_path(&self, token: &str) -> PathBuf {
        self.root.join(DELETION_DIR).join(format!("{}.json", token))
    }

    pub(super) fn checked_deletion_record_path(&self, token: &str) -> Result<PathBuf, String> {
        if validate_operation_id(token).is_err() {
            return Err("删除事务标识无效".to_string());
        }
        Ok(self.deletion_record_path(token))
    }

    pub(super) fn deletion_stage_root(&self, token: &str) -> PathBuf {
        self.root.join(DELETION_DIR).join(token)
    }

    pub(super) fn write_deletion_record(
        &self,
        path: &Path,
        record: &DeletionRecord,
    ) -> Result<(), String> {
        atomic_write(
            path,
            &serde_json::to_vec_pretty(record).map_err(|e| e.to_string())?,
        )
    }

    pub(super) fn load_deletion_record(
        &self,
        token: &str,
    ) -> Result<(PathBuf, DeletionRecord), String> {
        let path = self.checked_deletion_record_path(token)?;
        let bytes = fs::read(&path).map_err(io_error)?;
        let record: DeletionRecord =
            serde_json::from_slice(&bytes).map_err(|_| "删除事务数据损坏".to_string())?;
        self.validate_deletion_record(&record, token)?;
        Ok((path, record))
    }

    pub(super) fn load_deletion_record_if_exists(
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

    pub(super) fn validate_deletion_record(
        &self,
        record: &DeletionRecord,
        token: &str,
    ) -> Result<(), String> {
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

    pub(super) fn remove_deletion_tree(&self, path: &Path) -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }
        fs::remove_dir_all(path).map_err(io_error)
    }

    pub(super) fn remove_deletion_tree_for_project(
        &self,
        path: &Path,
        ordinal: usize,
    ) -> Result<(), String> {
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

    pub(super) fn cleanup_deletion_artifacts(
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

    pub(super) fn ensure_deletion_tombstones(&self, record: &DeletionRecord) -> Result<(), String> {
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

    pub(super) fn mark_deletion_blocked(&self, token: &str) {
        let _ = mark_blocked_path(&self.deletion_blocked_path(token));
    }

    pub(super) fn deletion_rename_should_fail(operation: &str, key: &str, ordinal: usize) -> bool {
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

    pub(super) fn rename_for_deletion(
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

    pub(super) fn prepare_delete_projects_locked(
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

    pub(super) fn prepare_delete_projects(
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

    pub(super) fn finalize_delete_locked(
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

    pub(super) fn restore_delete_locked(
        &self,
        path: &Path,
        record: &DeletionRecord,
    ) -> Result<(), String> {
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
pub(super) fn deletion_projects_match(left: &[DeletionProject], right: &[DeletionProject]) -> bool {
    left.len() == right.len()
        && left.iter().zip(right).all(|(a, b)| {
            a.profile_id == b.profile_id && a.project_id == b.project_id && a.key == b.key
        })
}
