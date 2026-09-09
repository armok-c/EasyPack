use super::model::{CurrentEntry, EnvironmentFileContent, EnvironmentFileState, ProjectRef};
use super::store::RECOVERY_ERROR_CODE;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) static ID_COUNTER: OnceLock<Mutex<u64>> = OnceLock::new();

pub(super) fn file_content_from_bytes(bytes: Vec<u8>) -> EnvironmentFileContent {
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

pub(super) fn read_current_detail(
    root: &Path,
    path: &str,
) -> Result<EnvironmentFileContent, String> {
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

pub(super) fn normalize_paths(paths: &[String]) -> Result<Vec<String>, String> {
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

pub(super) fn ensure_project_root(root: &Path) -> Result<(), String> {
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
pub(super) fn is_reparse_metadata(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
pub(super) fn is_reparse_metadata(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

pub(super) fn digest_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

pub(super) fn blob_name(env_id: &str, path: &str) -> String {
    digest_bytes(format!("{}\0{}", env_id, path).as_bytes()) + ".bin"
}

pub(super) fn unique_blob_name(operation: &str, path: &str) -> String {
    digest_bytes(format!("{}\0{}\0{}", operation, path, new_id("blob")).as_bytes()) + ".bin"
}

pub(super) fn plan_token(
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

pub(super) fn validate_environment_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() || name.len() > 128 || name.contains(['/', '\\', '\0']) {
        return Err("环境名称无效".to_string());
    }
    Ok(())
}

pub(super) fn validate_operation_id(operation_id: &str) -> Result<(), String> {
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

pub(super) fn new_id(prefix: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = ID_COUNTER.get_or_init(|| Mutex::new(0));
    let mut value = counter.lock().unwrap_or_else(|e| e.into_inner());
    *value = value.saturating_add(1);
    format!("{}-{:x}-{}-{}", prefix, now, std::process::id(), *value)
}

pub(super) fn io_error(error: std::io::Error) -> String {
    format!("文件操作失败: {}", error)
}

pub(super) fn mark_blocked_path(path: &Path) -> Result<(), String> {
    atomic_write(path, RECOVERY_ERROR_CODE.as_bytes())
}

pub(super) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
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

pub(super) fn replace_existing(source: &Path, destination: &Path) -> Result<(), String> {
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

pub(super) fn replace_file_from(source: &Path, destination: &Path) -> Result<(), String> {
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
