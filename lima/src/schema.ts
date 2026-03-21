import type { DatabaseSync } from 'node:sqlite'

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      id            TEXT PRIMARY KEY,
      content       TEXT NOT NULL,
      summary_en    TEXT NOT NULL,
      summary_orig  TEXT NOT NULL,
      tags          TEXT NOT NULL,       -- JSON array of strings
      scope         TEXT NOT NULL,
      source        TEXT NOT NULL,
      weight        REAL NOT NULL DEFAULT 0.5,
      activation    REAL NOT NULL DEFAULT 0.0,
      created       TEXT NOT NULL,
      last_used     TEXT NOT NULL,
      use_count     INTEGER NOT NULL DEFAULT 0,
      ttl           TEXT,
      links         TEXT,               -- JSON array of IDs
      chunk_index   INTEGER,
      source_url    TEXT,
      viewed_by_user INTEGER NOT NULL DEFAULT 0,
      -- task fields
      goal          TEXT,
      status        TEXT,
      steps         TEXT,               -- JSON
      errors        TEXT,               -- JSON array
      checkpoint    TEXT                -- JSON
    );

    -- FTS5 index for fast tag lookup
    CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
      id UNINDEXED,
      tags,
      content='facts',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
      INSERT INTO facts_fts(rowid, id, tags) VALUES (new.rowid, new.id, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
      INSERT INTO facts_fts(facts_fts, rowid, id, tags) VALUES ('delete', old.rowid, old.id, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
      INSERT INTO facts_fts(facts_fts, rowid, id, tags) VALUES ('delete', old.rowid, old.id, old.tags);
      INSERT INTO facts_fts(rowid, id, tags) VALUES (new.rowid, new.id, new.tags);
    END;

    -- Conversation history table (replaces JSON file)
    CREATE TABLE IF NOT EXISTS messages (
      id        TEXT PRIMARY KEY,
      role      TEXT NOT NULL,
      content   TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      agent_id  TEXT
    );

    CREATE INDEX IF NOT EXISTS messages_timestamp ON messages(timestamp);
  `)
}
