//! Generic incremental line-tail reader shared by every NDJSON-based
//! collector (Claude Code transcripts, our own hooks.ndjson relay log, and
//! statusline.ndjson). Keeping this in one place is what makes "never
//! rescan a file from the start" (perf requirement) apply uniformly.

use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

#[derive(Default)]
pub struct NdjsonTailReader {
    offsets: HashMap<PathBuf, u64>,
}

impl NdjsonTailReader {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn read_new_lines(&mut self, path: &Path) -> std::io::Result<Vec<String>> {
        let mut file = File::open(path)?;
        let len = file.metadata()?.len();
        let offset = *self.offsets.get(path).unwrap_or(&0);
        if len < offset {
            self.offsets.insert(path.to_path_buf(), 0);
            return self.read_new_lines(path);
        }
        if len == offset {
            return Ok(vec![]);
        }
        file.seek(SeekFrom::Start(offset))?;
        let mut buf = String::new();
        file.read_to_string(&mut buf)?;

        let last_newline = buf.rfind('\n');
        let (complete, consumed) = match last_newline {
            Some(idx) => (&buf[..=idx], offset + idx as u64 + 1),
            None => ("", offset),
        };
        let lines: Vec<String> = complete.lines().map(|l| l.to_string()).collect();
        self.offsets.insert(path.to_path_buf(), consumed);
        Ok(lines)
    }
}
