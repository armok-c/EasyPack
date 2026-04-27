mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::shell::execute_command,
            commands::project_info::scan_project_icons,
            commands::project_info::get_project_info,
            commands::shell::open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
