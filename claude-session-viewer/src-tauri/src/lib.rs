pub mod claude_config;
pub mod collectors;
pub mod commands;
pub mod domain;
pub mod notifications;
pub mod state;
pub mod storage;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};

/// Resolves `~/.claude`, honoring `CLAUDE_CONFIG_DIR` if Claude Code itself
/// is configured to use a non-default home (documented Claude Code env var).
fn claude_home_dir() -> std::path::PathBuf {
    if let Ok(dir) = std::env::var("CLAUDE_CONFIG_DIR") {
        return std::path::PathBuf::from(dir);
    }
    dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".claude")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Both overrides exist for `npm run simulate` (see
            // simulator/simulate.ts and README.md "開発用シミュレーター"):
            // pointing a dev run at a sandbox directory instead of the
            // developer's real ~/.claude and real app data directory.
            let app_data_dir = match std::env::var("CLAUDE_SESSION_VIEWER_DATA_DIR") {
                Ok(dir) => std::path::PathBuf::from(dir),
                Err(_) => app
                    .path()
                    .app_data_dir()
                    .expect("app data dir should be resolvable"),
            };
            let claude_home = claude_home_dir();

            let state = state::init_state(app_data_dir, claude_home);
            app.manage(state.clone());
            state::spawn_background_workers(app.handle().clone(), state);

            let show = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // A menu-bar-resident app should not quit when its window is
            // closed — hide it instead, matching the "常駐" requirement.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::sessions::get_sessions,
            commands::sessions::get_rate_limits,
            commands::settings::get_notification_settings,
            commands::settings::set_notification_settings,
            commands::settings::get_history_enabled,
            commands::settings::set_history_enabled,
            commands::settings::clear_all_data,
            commands::settings::get_sqlite_path,
            commands::setup::preview_claude_setup,
            commands::setup::apply_claude_setup,
            commands::setup::revert_claude_setup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
