//! SQLite persistence. Metadata only — see module docs in `storage/mod.rs`
//! for exactly what is (and is never) written here.
//!
//! Writes are batched: callers accumulate changes in memory and call
//! `persist_snapshot` / `record_processed_events` at most once per flush
//! interval (see `state.rs`), each wrapped in a single transaction, instead
//! of issuing one statement per event.

use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{params, Connection};

use crate::domain::types::ClaudeSession;

pub struct Database {
    conn: Connection,
}

/// Where the SQLite file lives on disk. Documented in README.md "SQLite保存場所".
pub fn default_db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("sessions.sqlite3")
}

impl Database {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> rusqlite::Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> rusqlite::Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                snapshot_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS processed_events (
                event_id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                processed_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )
    }

    /// Overwrites the full sessions table with the current in-memory state.
    /// Simpler and safer than incremental upserts for a dataset this small
    /// (a handful of sessions), and keeps the batching contract trivial: one
    /// transaction per flush regardless of how many sessions changed.
    pub fn persist_snapshot(&mut self, sessions: &[ClaudeSession]) -> rusqlite::Result<()> {
        let tx = self.conn.transaction()?;
        tx.execute("DELETE FROM sessions", [])?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO sessions (id, snapshot_json, updated_at) VALUES (?1, ?2, ?3)",
            )?;
            let now = Utc::now().to_rfc3339();
            for session in sessions {
                let json = serde_json::to_string(session).unwrap_or_default();
                stmt.execute(params![session.id, json, now])?;
            }
        }
        tx.commit()
    }

    pub fn load_snapshot(&self) -> rusqlite::Result<Vec<ClaudeSession>> {
        let mut stmt = self.conn.prepare("SELECT snapshot_json FROM sessions")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for row in rows {
            let json = row?;
            if let Ok(session) = serde_json::from_str::<ClaudeSession>(&json) {
                out.push(session);
            }
        }
        Ok(out)
    }

    pub fn record_processed_events(&mut self, ids: &[(String, String)]) -> rusqlite::Result<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let tx = self.conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO processed_events (event_id, source, processed_at) VALUES (?1, ?2, ?3)",
            )?;
            let now = Utc::now().to_rfc3339();
            for (event_id, source) in ids {
                stmt.execute(params![event_id, source, now])?;
            }
        }
        tx.commit()
    }

    /// Loads recent processed event ids to seed idempotency after a restart.
    /// Bounded so a very long-lived install doesn't load an unbounded table.
    pub fn load_recent_processed_event_ids(&self, limit: u32) -> rusqlite::Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT event_id FROM processed_events ORDER BY processed_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| row.get::<_, String>(0))?;
        rows.collect()
    }

    pub fn set_setting(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })
    }

    /// Deletes all locally stored metadata. Used by the "データ削除" setting.
    pub fn clear_all(&self) -> rusqlite::Result<()> {
        self.conn.execute_batch(
            "DELETE FROM sessions; DELETE FROM processed_events; DELETE FROM settings;",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::types::{Confidence, DataSource, SessionStatus};

    fn sample_session(id: &str) -> ClaudeSession {
        ClaudeSession {
            id: id.to_string(),
            pid: Some(123),
            project_name: "demo".into(),
            cwd: Some("/tmp/demo".into()),
            model: Some("claude-sonnet-5".into()),
            status: SessionStatus::Thinking,
            status_source: DataSource::OfficialHook,
            status_confidence: Confidence::High,
            started_at: None,
            last_activity_at: None,
            stopped_at: None,
            context: None,
            subagents: vec![],
            is_stale: false,
        }
    }

    #[test]
    fn persists_and_restores_snapshot() {
        let mut db = Database::open_in_memory().unwrap();
        db.persist_snapshot(&[sample_session("s1"), sample_session("s2")])
            .unwrap();
        let restored = db.load_snapshot().unwrap();
        assert_eq!(restored.len(), 2);
    }

    #[test]
    fn processed_events_are_idempotent_on_disk_too() {
        let mut db = Database::open_in_memory().unwrap();
        let batch = vec![("e1".to_string(), "official_hook".to_string())];
        db.record_processed_events(&batch).unwrap();
        db.record_processed_events(&batch).unwrap(); // duplicate insert must not error
        let ids = db.load_recent_processed_event_ids(10).unwrap();
        assert_eq!(ids, vec!["e1".to_string()]);
    }

    #[test]
    fn settings_roundtrip() {
        let db = Database::open_in_memory().unwrap();
        db.set_setting("history_enabled", "false").unwrap();
        assert_eq!(
            db.get_setting("history_enabled").unwrap(),
            Some("false".to_string())
        );
        assert_eq!(db.get_setting("missing").unwrap(), None);
    }

    #[test]
    fn clear_all_empties_every_table() {
        let mut db = Database::open_in_memory().unwrap();
        db.persist_snapshot(&[sample_session("s1")]).unwrap();
        db.record_processed_events(&[("e1".into(), "process".into())])
            .unwrap();
        db.set_setting("k", "v").unwrap();
        db.clear_all().unwrap();
        assert!(db.load_snapshot().unwrap().is_empty());
        assert!(db.load_recent_processed_event_ids(10).unwrap().is_empty());
        assert_eq!(db.get_setting("k").unwrap(), None);
    }
}
