-- Harness memory. Sessions, messages, tool calls, plans and approvals — nothing of this lives in the kit.
-- This file is schema version 1 and does not change any more: every later change is a migration in
-- src/db/migrations.ts, so an older database and a new one end up with the same shape.
-- The kit's source of truth is the machine itself (the doctor measures live); `kit_results` below is history,
-- never current state, and no code may answer a question about the cabinet from it.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,
  started_at       TEXT NOT NULL,
  ended_at         TEXT,
  model            TEXT,
  provider         TEXT,
  permission_level TEXT NOT NULL,
  api_version      TEXT,
  kit_version      TEXT,
  note             TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  created_at TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content    TEXT,
  tool_call_id TEXT,
  anonymized INTEGER NOT NULL DEFAULT 0
);

-- Every tool call the harness made, including the refused ones: the audit trail is the point.
CREATE TABLE IF NOT EXISTS tool_calls (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  created_at   TEXT NOT NULL,
  tool         TEXT NOT NULL,
  operation    TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('Read', 'Change', 'Refused')),
  parameters   TEXT NOT NULL,
  apply        INTEGER NOT NULL DEFAULT 0,
  approved     INTEGER NOT NULL DEFAULT 0,
  anonymize    INTEGER NOT NULL DEFAULT 0,
  stage        TEXT NOT NULL CHECK (stage IN ('refused', 'dry_run', 'apply', 'verify', 'read')),
  status       TEXT,
  exit_code    INTEGER,
  duration     REAL,
  argv         TEXT,
  message      TEXT,
  result_digest TEXT,
  error        TEXT
);

-- One plan = one dry run of one change operation, identified by the digest of operation + parameters + plan text.
CREATE TABLE IF NOT EXISTS plans (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  tool_call_id TEXT NOT NULL REFERENCES tool_calls(id),
  created_at  TEXT NOT NULL,
  operation   TEXT NOT NULL,
  parameters  TEXT NOT NULL,
  params_digest TEXT NOT NULL,
  plan_digest TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('proposed', 'shown', 'approved', 'declined', 'refused', 'applied', 'failed', 'skipped', 'expired')),
  message     TEXT NOT NULL DEFAULT '',
  steps       TEXT NOT NULL DEFAULT '[]',
  changes     TEXT NOT NULL DEFAULT '[]',
  backups     TEXT NOT NULL DEFAULT '[]',
  approvals   TEXT NOT NULL DEFAULT '[]',
  warnings    TEXT NOT NULL DEFAULT '[]',
  errors      TEXT NOT NULL DEFAULT '[]'
);

-- A person decides. A model never writes here: `decided_by` is CHECKed, and the only code path that can set a
-- decision is the human gateway in src/policy/human.ts.
CREATE TABLE IF NOT EXISTS approvals (
  id             TEXT PRIMARY KEY,
  plan_id        TEXT NOT NULL REFERENCES plans(id),
  session_id     TEXT NOT NULL REFERENCES sessions(id),
  requested_at   TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  decided_at     TEXT,
  decision       TEXT CHECK (decision IN ('yes', 'no')),
  decided_by     TEXT CHECK (decided_by IS NULL OR decided_by = 'human'),
  approval_texts TEXT NOT NULL DEFAULT '[]',
  consumed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_plans_digest ON plans(plan_digest, status);
CREATE INDEX IF NOT EXISTS idx_approvals_plan ON approvals(plan_id, decision);

-- Kit answers as history (what did the doctor say at 20:14). Answering "how is it now" from this table is a bug.
CREATE TABLE IF NOT EXISTS kit_results (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT REFERENCES sessions(id),
  operation    TEXT NOT NULL,
  observed_at  TEXT NOT NULL,
  api_version  TEXT,
  status       TEXT,
  anonymized   INTEGER NOT NULL DEFAULT 0,
  result_digest TEXT,
  result       TEXT NOT NULL
);
