/**
 * Schema migrations for the harness database.
 *
 * `schema.sql` is schema version 1 and stays that way: it is what a new database starts from. Every change after
 * it is a migration here, with the next number, applied in order, each in its own transaction. A database that
 * says it is newer than the newest migration was written by a newer harness and is refused, not guessed at.
 *
 * Rules for adding one:
 * - never edit a migration that shipped; add the next one,
 * - additive where possible (`ADD COLUMN`, a new table, a new index): an older harness must never be pointed at
 *   the result, so the version check below is the only guard needed,
 * - SQLite cannot change a CHECK constraint in place; `approvals.decided_by = 'human'` is meant to stay forever.
 */

export interface Migration {
  /** The schema version after this migration ran. Contiguous, starting at 2. */
  version: number;
  description: string;
  sql: string;
}

/** The version `schema.sql` describes. */
export const BASE_SCHEMA_VERSION = 1;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 2,
    description: 'sessions.transport: which transport reached the kit (stdio-one-shot, mcp-stdio, fake)',
    sql: 'ALTER TABLE sessions ADD COLUMN transport TEXT;',
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce((latest, m) => Math.max(latest, m.version), BASE_SCHEMA_VERSION);

/** Thrown when the database was written by a newer harness. Opening it would risk reading what we do not know. */
export class SchemaTooNewError extends Error {
  readonly found: number;
  readonly supported: number;

  constructor(found: number, supported: number) {
    super(
      `the harness database is at schema version ${found}, this harness knows up to ${supported}. ` +
        'Use the newer fagent that wrote it, or point --db at another file.',
    );
    this.name = 'SchemaTooNewError';
    this.found = found;
    this.supported = supported;
  }
}

/** Checks a migration list for gaps and duplicates: a missing number would silently skip a change. */
export function assertMigrationsContiguous(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    const expected = BASE_SCHEMA_VERSION + index + 1;
    if (migration.version !== expected) {
      throw new Error(`migration ${index + 1} has version ${migration.version}, expected ${expected}`);
    }
  });
}
