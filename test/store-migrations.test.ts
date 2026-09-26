/**
 * The database schema can move without losing a cabinet's history.
 *
 * `schema.sql` is version 1; everything after it is a migration. These tests open a database the way an older
 * harness left it and prove the runner brings it forward, refuses a newer one, and never stops half-way.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { Store } from '../src/db/store.ts';
import { LATEST_SCHEMA_VERSION, MIGRATIONS, SchemaTooNewError, assertMigrationsContiguous, type Migration } from '../src/db/migrations.ts';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function dbPath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'fagent-db-'));
  directories.push(directory);
  return join(directory, 'harness.db');
}

/** A database exactly as harness 0.1.0 left it: schema.sql, schema_version 1, one session. */
function versionOneDatabase(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', '1');
  db.prepare("INSERT INTO sessions (id, started_at, permission_level) VALUES ('old-session', '2026-09-01T20:14:00.000Z', 'read-only')").run();
  db.close();
}

function columns(path: string, table: string): string[] {
  const db = new DatabaseSync(path);
  const names = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
  db.close();
  return names;
}

describe('schema migrations', () => {
  it('the shipped migrations are contiguous and the latest version is what a new database gets', () => {
    expect(() => assertMigrationsContiguous(MIGRATIONS)).not.toThrow();
    const store = Store.open(dbPath());
    expect(store.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    store.close();
  });

  it('brings a version 1 database forward and keeps its history', () => {
    const path = dbPath();
    versionOneDatabase(path);
    expect(columns(path, 'sessions')).not.toContain('transport');

    const store = Store.open(path);
    expect(store.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(store.recentSessions(5).map((s) => s.id)).toContain('old-session');
    const row = store.startSession({ permissionLevel: 'operator', transport: 'mcp-stdio' });
    expect(store.recentSessions(5).find((s) => s.id === row.id)?.transport).toBe('mcp-stdio');
    store.close();
    expect(columns(path, 'sessions')).toContain('transport');
  });

  it('opening twice changes nothing the second time', () => {
    const path = dbPath();
    Store.open(path).close();
    const again = Store.open(path);
    expect(again.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    again.close();
  });

  it('refuses a database written by a newer harness instead of guessing', () => {
    const path = dbPath();
    Store.open(path).close();
    const db = new DatabaseSync(path);
    db.prepare("UPDATE meta SET value = '99' WHERE key = 'schema_version'").run();
    db.close();
    expect(() => Store.open(path)).toThrow(SchemaTooNewError);
    expect(() => Store.open(path)).toThrow(/schema version 99/);
  });

  it('a failing migration rolls back and leaves the file at the last good version', () => {
    const path = dbPath();
    versionOneDatabase(path);
    const broken: Migration[] = [
      ...MIGRATIONS,
      { version: LATEST_SCHEMA_VERSION + 1, description: 'adds a table', sql: 'CREATE TABLE extra (id INTEGER);' },
      { version: LATEST_SCHEMA_VERSION + 2, description: 'broken on purpose', sql: 'CREATE TABLE half (id INTEGER); THIS IS NOT SQL;' },
    ];
    expect(() => Store.open(path, broken)).toThrow(/migration to schema version .* failed/);

    const db = new DatabaseSync(path);
    const version = (db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string }).value;
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((t) => t.name);
    db.close();
    expect(Number(version)).toBe(LATEST_SCHEMA_VERSION + 1);
    expect(tables).toContain('extra');
    expect(tables).not.toContain('half');
  });

  it('a migration list with a gap is a programming error, caught before anything runs', () => {
    expect(() => assertMigrationsContiguous([{ version: 3, description: 'skips 2', sql: '' }])).toThrow(/expected 2/);
  });

  it('the human-only CHECK on approvals survives every migration', () => {
    const path = dbPath();
    versionOneDatabase(path);
    const store = Store.open(path);
    const session = store.startSession({ permissionLevel: 'operator' });
    store.execForTests(
      "INSERT INTO tool_calls (id, session_id, created_at, tool, operation, kind, parameters, stage) VALUES ('t', ?, '2026-09-26', 'x', 'x', 'Change', '{}', 'dry_run')",
      session.id,
    );
    store.execForTests(
      "INSERT INTO plans (id, session_id, tool_call_id, created_at, operation, parameters, params_digest, plan_digest, status) VALUES ('p', ?, 't', '2026-09-26', 'x', '{}', 'd', 'd', 'shown')",
      session.id,
    );
    expect(() =>
      store.execForTests(
        "INSERT INTO approvals (id, plan_id, session_id, requested_at, expires_at, decision, decided_by) VALUES ('a', 'p', ?, '2026-09-26', '2026-09-27', 'yes', 'model')",
        session.id,
      ),
    ).toThrow(/CHECK/);
    store.close();
  });
});
