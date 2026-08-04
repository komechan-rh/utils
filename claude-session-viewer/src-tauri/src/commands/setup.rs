use tauri::State;

use crate::claude_config::{self, ApplySummary, RevertResult};
use crate::state::AppState;

#[derive(Debug, serde::Serialize)]
pub struct SetupPreview {
    pub settings_path: String,
    pub before: serde_json::Value,
    pub after: serde_json::Value,
    pub summary: ApplySummary,
}

#[tauri::command]
pub fn preview_claude_setup(state: State<'_, AppState>) -> Result<SetupPreview, String> {
    let settings_path = state.paths.claude_settings_path();
    let (before, after, summary) =
        claude_config::preview(&settings_path, &state.paths.app_data_dir).map_err(|e| e.to_string())?;
    Ok(SetupPreview {
        settings_path: settings_path.to_string_lossy().to_string(),
        before,
        after,
        summary,
    })
}

#[tauri::command]
pub fn apply_claude_setup(state: State<'_, AppState>) -> Result<ApplySummary, String> {
    let settings_path = state.paths.claude_settings_path();
    claude_config::apply(&settings_path, &state.paths.app_data_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn revert_claude_setup(state: State<'_, AppState>) -> Result<RevertResult, String> {
    let settings_path = state.paths.claude_settings_path();
    claude_config::revert(&settings_path, &state.paths.app_data_dir).map_err(|e| e.to_string())
}
