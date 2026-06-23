mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            use tauri::Emitter;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("main:shown-from-rust", ());
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--autostart")
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::shell::execute_command,
            commands::shell::execute_script,
            commands::project_info::scan_project_icons,
            commands::project_info::get_project_info,
            commands::shell::open_folder,
            commands::shell::read_file_content,
            commands::shell::write_file_content,
            commands::shell::delete_file_content,
            commands::update::check_for_updates,
            commands::update::open_release_page,
        ])
        .setup(|app| {
            // --autostart 检测：开机自启时在 WebView 加载前隐藏窗口
            let is_autostart = std::env::args().any(|arg| arg == "--autostart");
            if is_autostart {
                use tauri::Manager;
                use tauri::Emitter;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                    let _ = window.set_skip_taskbar(true);
                }
                let _ = app.emit("app:autostart-hidden", ());
                // D-02: 自启时确保 trayEnabled 和 closeToTray 为 true，否则无处可去。
                // 所有 store.save() 和 store.set() 均为 best-effort —— 失败时静默忽略，
                // 因为自愈逻辑每次启动都会执行，下次启动时会重试。
                {
                    use tauri_plugin_store::StoreExt;
                    if let Ok(store) = app.store("easypack-store.json") {
                        let needs_tray = store
                            .get("trayEnabled")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        if !needs_tray {
                            let _ = store.set("trayEnabled", serde_json::Value::Bool(true));
                            let _ = store.set("closeToTray", serde_json::Value::Bool(true));
                            let _ = store.save();
                        } else {
                            let needs_ctt = store
                                .get("closeToTray")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(true);
                            if !needs_ctt {
                                let _ = store.set("closeToTray", serde_json::Value::Bool(true));
                                let _ = store.save();
                            }
                        }
                    }
                }
            }

            // 自愈：如果 store 中 autostartEnabled=true 但注册表条目丢失，静默重新注册。
            // manager.enable() 为 best-effort，失败时静默忽略（下次启动重试）。
            {
                use tauri_plugin_store::StoreExt;
                use tauri_plugin_autostart::ManagerExt;
                if let Ok(store) = app.store("easypack-store.json") {
                    let autostart_on = store
                        .get("autostartEnabled")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    if autostart_on {
                        let manager = app.autolaunch();
                        if !manager.is_enabled().unwrap_or(false) {
                            let _ = manager.enable();
                        }
                    }
                }
            }

            // 全局菜单事件处理器：Rust 端直接处理核心窗口操作，
            // 不依赖 WebView JS 运行时。解决主窗口隐藏后 WebView
            // 可能被节流导致 JS 回调不执行的问题。
            app.on_menu_event(|app_handle, event| {
                use tauri::Manager;
                use tauri::Emitter;

                let menu_id = event.id().as_ref();
                match menu_id {
                    "toggle-window" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if let Ok(is_visible) = window.is_visible() {
                                if is_visible {
                                    let _ = window.hide();
                                    let _ = app_handle.emit("main:hidden-from-rust", ());
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                    let _ = app_handle.emit("main:shown-from-rust", ());
                                }
                            }
                        }
                    }
                    "quit" => {
                        if let Some(float_win) = app_handle.get_webview_window("float") {
                            let _ = float_win.destroy();
                        }
                        app_handle.exit(0);
                    }
                    _ => {}
                }
            });

            // 运行时加载高分辨率图标，绕过 Tauri codegen 只取 ICO 第一个条目的 bug。
            let img = image::load_from_memory(include_bytes!("../icons/icon.png"))
                .expect("failed to decode icon.png");

            // 窗口图标（影响任务栏）：保持原始 1024x1024，让 Windows 自行缩放。
            let rgba = img.to_rgba8();
            let window_icon = tauri::image::Image::new_owned(
                rgba.to_vec(),
                rgba.width(),
                rgba.height(),
            );

            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_icon(window_icon);
                }
            }

            // 托盘图标：Rust 端创建（带 ID "main-tray"），使用 64x64 Triangle 滤波避免过度锐化。
            // 前端 useTray.ts 通过 getById("main-tray") 找到它并设置右键菜单，不重复创建。
            let tray_img = img.resize_exact(64, 64, image::imageops::FilterType::Triangle);
            let tray_rgba = tray_img.to_rgba8();
            let tray_icon = tauri::image::Image::new_owned(
                tray_rgba.to_vec(),
                tray_rgba.width(),
                tray_rgba.height(),
            );

            let _tray = tauri::tray::TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon)
                .tooltip("EasyPack")
                .build(app)?;

            // 全局托盘图标事件处理器：左键点击切换主窗口显示/隐藏。
            // 在 Rust 端直接处理，不依赖 WebView JS 运行时。
            // 解决主窗口隐藏后 WebView 可能被节流导致 JS 回调不执行的问题。
            app.on_tray_icon_event(|app_handle, event| {
                use tauri::tray::TrayIconEvent;
                use tauri::tray::MouseButton;
                use tauri::tray::MouseButtonState;
                use tauri::Manager;
                use tauri::Emitter;

                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if let Ok(is_visible) = window.is_visible() {
                            if is_visible {
                                let _ = window.hide();
                                let _ = app_handle.emit("main:hidden-from-rust", ());
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = app_handle.emit("main:shown-from-rust", ());
                            }
                        }
                    }
                }
            });

            // 边缘抽屉：鼠标位置轮询
            // 前端通过 emit("drawer:start-polling", payload) 启动
            // 前端通过 emit("drawer:stop-polling") 停止
            // 定时器回调中检测鼠标是否在 sliver 区域附近，是则 emit("drawer:mouse-near-edge")
            use std::sync::{Arc, Mutex};
            use std::thread;
            use std::time::Duration;
            use tauri::Listener;
            use tauri::Emitter;

            // 使用 running flag 控制轮询线程退出，比 JoinHandle::abort() 更可控
            let polling_running: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
            let sliver_rect: Arc<Mutex<Option<(f64, f64, f64, f64)>>> =
                Arc::new(Mutex::new(None)); // (x, y, w, h) 物理坐标

            let app_handle = app.handle().clone();
            let pr = polling_running.clone();
            let sr = sliver_rect.clone();

            app.listen("drawer:start-polling", move |event| {
                // 解析 payload: { "sliverRect": { "x", "y", "w", "h" } } (逻辑像素)
                let payload = event.payload().to_string();
                let parsed: serde_json::Value = match serde_json::from_str(&payload) {
                    Ok(v) => v,
                    Err(_) => return,
                };

                let sr_obj = match parsed.get("sliverRect") {
                    Some(obj) => obj,
                    None => return,
                };

                let sx = match sr_obj.get("x").and_then(|v| v.as_f64()) {
                    Some(v) => v,
                    None => return,
                };
                let sy = match sr_obj.get("y").and_then(|v| v.as_f64()) {
                    Some(v) => v,
                    None => return,
                };
                let sw = match sr_obj.get("w").and_then(|v| v.as_f64()) {
                    Some(v) => v,
                    None => return,
                };
                let sh = match sr_obj.get("h").and_then(|v| v.as_f64()) {
                    Some(v) => v,
                    None => return,
                };

                // 获取 scaleFactor 将逻辑坐标转为物理坐标
                let scale = match app_handle.primary_monitor() {
                    Ok(Some(monitor)) => monitor.scale_factor() as f64,
                    _ => 1.0,
                };

                let phys_x = sx * scale;
                let phys_y = sy * scale;
                let phys_w = sw * scale;
                let phys_h = sh * scale;

                // 存入共享状态并原子地检查/设置 running flag（避免 TOCTOU 竞争）
                {
                    let mut rect = sr.lock().unwrap_or_else(|e| e.into_inner());
                    *rect = Some((phys_x, phys_y, phys_w, phys_h));
                    let mut running = pr.lock().unwrap_or_else(|e| e.into_inner());
                    if *running {
                        // Thread already active; rect already updated above
                        return;
                    }
                    *running = true;
                }

                // 启动轮询线程
                let ah = app_handle.clone();
                let pr2 = pr.clone();
                let sr2 = sr.clone();

                thread::spawn(move || {
                    loop {
                        thread::sleep(Duration::from_millis(100));

                        // 检查是否应该继续运行
                        {
                            let running = pr2.lock().unwrap_or_else(|e| e.into_inner());
                            if !*running {
                                break;
                            }
                        }

                        // 检查是否还有 sliver rect
                        let rect_opt = {
                            let rect = sr2.lock().unwrap_or_else(|e| e.into_inner());
                            *rect
                        };
                        let (rx, ry, rw, rh) = match rect_opt {
                            Some(r) => r,
                            None => break,
                        };

                        // 获取鼠标物理坐标
                        let cursor = match ah.cursor_position() {
                            Ok(pos) => pos,
                            Err(_) => continue,
                        };
                        let cx = cursor.x;
                        let cy = cursor.y;

                        // 判断 cursor 是否在 sliver rect 扩展 5px 范围内
                        let margin = 5.0;
                        let in_x = cx >= rx - margin && cx <= rx + rw + margin;
                        let in_y = cy >= ry - margin && cy <= ry + rh + margin;

                        if in_x && in_y {
                            let _ = ah.emit("drawer:mouse-near-edge", ());
                            // 停止自身：先释放 pr 再获取 sr，避免与 start-polling
                            // handler（先 sr 后 pr）形成 ABBA 死锁
                            {
                                let mut running = pr2.lock().unwrap_or_else(|e| e.into_inner());
                                *running = false;
                            } // release pr BEFORE acquiring sr
                            {
                                let mut rect = sr2.lock().unwrap_or_else(|e| e.into_inner());
                                *rect = None;
                            }
                            break;
                        }
                    }
                });
            });

            let pr3 = polling_running.clone();
            let sr3 = sliver_rect.clone();

            app.listen("drawer:stop-polling", move |_| {
                // 停止轮询
                {
                    let mut running = pr3.lock().unwrap_or_else(|e| e.into_inner());
                    *running = false;
                }
                // 清空 sliver rect
                {
                    let mut rect = sr3.lock().unwrap_or_else(|e| e.into_inner());
                    *rect = None;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
