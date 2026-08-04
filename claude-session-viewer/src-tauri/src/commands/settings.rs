use serde::{Deserialize, Serialize};
use tauri::State;

use crate::notifications::NotificationSettings;
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationSettingsDto {
    pub waiting_permission: bool,
    pub stalled_session: bool,
    pub subagent_completed: bool,
    pub rate_limit_warning: bool,
    pub rate_limit_reached: bool,
}

impl From<NotificationSettings> for NotificationSettingsDto {
    fn from(s: NotificationSettings) -> Self {
        Self {
            waiting_permission: s.waiting_permission,
            stalled_session: s.stalled_session,
            subagent_completed: s.subagent_completed,
            rate_limit_warning: s.rate_limit_warning,
            rate_limit_reached: s.rate_limit_reached,
        }
    }
}

#[tauri::command]
pub fn get_notification_settings(state: State<'_, AppState>) -> NotificationSettingsDto {
    (*state.notification_settings.lock().unwrap()).into()
}

#[tauri::command]
pub fn set_notification_settings(state: State<'_, AppState>, settings: NotificationSettingsDto) {
    let mut current = state.notification_settings.lock().unwrap();
    current.waiting_permission = settings.waiting_permission;
    current.stalled_session = settings.stalled_session;
    current.subagent_completed = settings.subagent_completed;
    current.rate_limit_warning = settings.rate_limit_warning;
    current.rate_limit_reached = settings.rate_limit_reached;
}

#[tauri::command]
pub fn get_history_enabled(state: State<'_, AppState>) -> bool {
    *state.history_enabled.lock().unwrap()
}

#[tauri::command]
pub fn set_history_enabled(state: State<'_, AppState>, enabled: bool) {
    *state.history_enabled.lock().unwrap() = enabled;
    if let Ok(db) = state.db.lock() {
        let _ = db.set_setting("history_enabled", if enabled { "true" } else { "false" });
    }
    if !enabled {
        if let Ok(db) = state.db.lock() {
            let _ = db.clear_all();
        }
    }
}

/// Deletes every row of locally stored metadata (sessions, processed event
/// ids, settings) immediately. Does not touch ~/.claude — only our own
/// sqlite database.
#[tauri::command]
pub fn clear_all_data(state: State<'_, AppState>) -> Result<(), String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .clear_all()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sqlite_path(state: State<'_, AppState>) -> String {
    crate::storage::default_db_path(&state.paths.app_data_dir)
        .to_string_lossy()
        .to_string()
}
