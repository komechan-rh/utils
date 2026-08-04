//! Local-only persistence.
//!
//! What we store: session id/pid/cwd/project name, normalized status +
//! source, model name, context token *counts*, subagent id/type/timing, and
//! processed-event ids for idempotency.
//!
//! What we never store: prompt text, tool arguments, tool output, file
//! contents, or transcript text of any kind. Collectors only ever extract
//! the numeric/metadata fields listed above before anything reaches this
//! module — see collectors::transcripts and collectors::hooks.
//!
//! Location: `<app data dir>/sessions.sqlite3` (see `default_db_path`),
//! i.e. `~/Library/Application Support/dev.komechan.claude-session-viewer/`
//! on macOS. Documented again in README.md "SQLite保存場所".

pub mod db;

pub use db::{default_db_path, Database};
