use tauri::State;

use crate::domain::types::{ClaudeSession, RateLimitState};
use crate::state::AppState;

#[tauri::command]
pub fn get_sessions(state: State<'_, AppState>) -> Vec<ClaudeSession> {
    state.store.lock().unwrap().all_sessions()
}

#[tauri::command]
pub fn get_rate_limits(state: State<'_, AppState>) -> RateLimitState {
    state.rate_limits.lock().unwrap().clone()
}
