/**
 * The harness memory: one SQLite file, owned by the harness.
 *
 * Everything that happened is here with a timestamp — sessions, messages, every tool call (including the refused
 * ones), every plan and every human decision. The kit is never written to for this.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { OperationResult, ParameterBag } from '../kit/types.ts';
import { BASE_SCHEMA_VERSION, MIGRATIONS, SchemaTooNewError, assertMigrationsContiguous, type Migration } from './migrations.ts';

const SCHEMA = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');

export function nowIso(): string {
  return new Date().toISOString();
}

export interface SessionRow {
  id: string;
  startedAt: string;
  permissionLevel: string;
  model: string | null;
  provider: string | null;
  apiVersion: string | null;
  kitVersion: string | null;
  transport: string | null;
}

export interface ToolCallRecord {
  id: string;
  sessionId: string;
  createdAt: string;
  tool: string;
  operation: string;
  kind: 'Read' | 'Change' | 'Refused';
  parameters: ParameterBag;
  apply: boolean;
  approved: boolean;
  anonymize: boolean;
  stage: 'refused' | 'dry_run' | 'apply' | 'verify' | 'read';
  status: string | null;
  exitCode: number | null;
  duration: number | null;
  argv: readonly string[] | null;
  message: string | null;
  resultDigest: string | null;
  error: string | null;
}

export interface PlanRecord {
  id: string;
  sessionId: string;
  toolCallId: string;
  createdAt: string;
  operation: string;
  parameters: ParameterBag;
  paramsDigest: string;
  planDigest: string;
  status: string;
  message: string;
  steps: unknown[];
  changes: unknown[];
  backups: string[];
  approvals: string[];
  warnings: string[];
  errors: string[];
}

export interface ApprovalRecord {
  id: string;
  planId: string;
  sessionId: string;
  requestedAt: string;
  expiresAt: string;
  decidedAt: string | null;
  decision: 'yes' | 'no' | null;
  decidedBy: string | null;
  approvalTexts: string[];
  consumedAt: string | null;
}

export class Store {
  readonly #db: DatabaseSync;
  #schemaVersion: number;

  /**
   * Opens the schema: `schema.sql` (version 1) for a new file, then every migration the file has not seen yet.
   * `migrations` is a parameter only so a test can prove the runner; product code always uses `MIGRATIONS`.
   */
  constructor(db: DatabaseSync, migrations: readonly Migration[] = MIGRATIONS) {
    this.#db = db;
    assertMigrationsContiguous(migrations);
    db.exec(SCHEMA);
    db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run('schema_version', String(BASE_SCHEMA_VERSION));
    this.#schemaVersion = this.#readSchemaVersion();

    const latest = migrations.at(-1)?.version ?? BASE_SCHEMA_VERSION;
    if (this.#schemaVersion > latest) {
      db.close();
      throw new SchemaTooNewError(this.#schemaVersion, latest);
    }
    for (const migration of migrations) {
      if (migration.version <= this.#schemaVersion) continue;
      // One transaction per migration: a failed one leaves the file at the last good version, never in between.
      db.exec('BEGIN');
      try {
        db.exec(migration.sql);
        db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(String(migration.version), 'schema_version');
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        db.close();
        throw new Error(`migration to schema version ${migration.version} (${migration.description}) failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.#schemaVersion = migration.version;
    }
  }

  static open(path: string, migrations?: readonly Migration[]): Store {
    return new Store(new DatabaseSync(path), migrations);
  }

  /** The schema version of this database after opening (and migrating) it. */
  get schemaVersion(): number {
    return this.#schemaVersion;
  }

  #readSchemaVersion(): number {
    const row = this.#db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    const version = Number.parseInt(row?.value ?? '', 10);
    if (!Number.isInteger(version) || version < BASE_SCHEMA_VERSION) {
      throw new Error(`the harness database has an unreadable schema_version (${String(row?.value)})`);
    }
    return version;
  }

  close(): void {
    this.#db.close();
  }

  /**
   * Test seam: run raw SQL against the database. It exists so a test can prove the schema's own constraints bite
   * (a decision that did not come from a human is rejected by the database, not only by our code). Never call
   * this from product code — there is none.
   */
  execForTests(sql: string, ...params: Array<string | number | bigint | null>): void {
    this.#db.prepare(sql).run(...params);
  }

  startSession(input: {
    permissionLevel: string;
    model?: string | null;
    provider?: string | null;
    apiVersion?: string | null;
    kitVersion?: string | null;
    transport?: string | null;
    note?: string | null;
  }): SessionRow {
    const row: SessionRow = {
      id: randomUUID(),
      startedAt: nowIso(),
      permissionLevel: input.permissionLevel,
      model: input.model ?? null,
      provider: input.provider ?? null,
      apiVersion: input.apiVersion ?? null,
      kitVersion: input.kitVersion ?? null,
      transport: input.transport ?? null,
    };
    this.#db
      .prepare(
        `INSERT INTO sessions (id, started_at, permission_level, model, provider, api_version, kit_version, transport, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.startedAt, row.permissionLevel, row.model, row.provider, row.apiVersion, row.kitVersion, row.transport, input.note ?? null);
    return row;
  }

  endSession(id: string): void {
    this.#db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(nowIso(), id);
  }

  addMessage(input: {
    sessionId: string;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    toolCallId?: string | null;
    anonymized?: boolean;
  }): number {
    const result = this.#db
      .prepare('INSERT INTO messages (session_id, created_at, role, content, tool_call_id, anonymized) VALUES (?, ?, ?, ?, ?, ?)')
      .run(input.sessionId, nowIso(), input.role, input.content, input.toolCallId ?? null, input.anonymized ? 1 : 0);
    return Number(result.lastInsertRowid);
  }

  messages(sessionId: string) {
    return this.#db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id')
      .all(sessionId) as Array<Record<string, unknown>>;
  }

  recordToolCall(input: Omit<ToolCallRecord, 'id' | 'createdAt'> & { id?: string }): ToolCallRecord {
    const row: ToolCallRecord = { ...input, id: input.id ?? randomUUID(), createdAt: nowIso() };
    this.#db
      .prepare(
        `INSERT INTO tool_calls
         (id, session_id, created_at, tool, operation, kind, parameters, apply, approved, anonymize, stage,
          status, exit_code, duration, argv, message, result_digest, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.sessionId,
        row.createdAt,
        row.tool,
        row.operation,
        row.kind,
        JSON.stringify(row.parameters),
        row.apply ? 1 : 0,
        row.approved ? 1 : 0,
        row.anonymize ? 1 : 0,
        row.stage,
        row.status,
        row.exitCode,
        row.duration,
        row.argv ? JSON.stringify(row.argv) : null,
        row.message,
        row.resultDigest,
        row.error,
      );
    return row;
  }

  toolCalls(sessionId: string): Array<Record<string, unknown>> {
    return this.#db
      .prepare('SELECT * FROM tool_calls WHERE session_id = ? ORDER BY created_at, rowid')
      .all(sessionId) as Array<Record<string, unknown>>;
  }

  /** The audit trail, newest first, across sessions. */
  recentToolCalls(limit: number): Array<Record<string, unknown>> {
    return this.#db
      .prepare('SELECT * FROM tool_calls ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;
  }

  /** Everything logged since a point in time, oldest first — the raw material of `fagent report`. */
  sessionsSince(since: string): Array<Record<string, unknown>> {
    return this.#db.prepare('SELECT * FROM sessions WHERE started_at >= ? ORDER BY started_at').all(since) as Array<Record<string, unknown>>;
  }

  toolCallsSince(since: string): Array<Record<string, unknown>> {
    return this.#db
      .prepare('SELECT * FROM tool_calls WHERE created_at >= ? ORDER BY created_at, rowid')
      .all(since) as Array<Record<string, unknown>>;
  }

  plansSince(since: string): Array<Record<string, unknown>> {
    return this.#db.prepare('SELECT * FROM plans WHERE created_at >= ? ORDER BY created_at').all(since) as Array<Record<string, unknown>>;
  }

  recentSessions(limit: number): Array<Record<string, unknown>> {
    return this.#db
      .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;
  }

  plans(sessionId?: string): Array<Record<string, unknown>> {
    return sessionId
      ? (this.#db.prepare('SELECT * FROM plans WHERE session_id = ? ORDER BY created_at').all(sessionId) as Array<Record<string, unknown>>)
      : (this.#db.prepare('SELECT * FROM plans ORDER BY created_at').all() as Array<Record<string, unknown>>);
  }

  approvals(sessionId?: string): Array<Record<string, unknown>> {
    return sessionId
      ? (this.#db.prepare('SELECT * FROM approvals WHERE session_id = ? ORDER BY requested_at').all(sessionId) as Array<Record<string, unknown>>)
      : (this.#db.prepare('SELECT * FROM approvals ORDER BY requested_at').all() as Array<Record<string, unknown>>);
  }

  recordPlan(input: Omit<PlanRecord, 'id' | 'createdAt'> & { id?: string }): PlanRecord {
    const row: PlanRecord = { ...input, id: input.id ?? randomUUID(), createdAt: nowIso() };
    this.#db
      .prepare(
        `INSERT INTO plans
         (id, session_id, tool_call_id, created_at, operation, parameters, params_digest, plan_digest, status,
          message, steps, changes, backups, approvals, warnings, errors)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.sessionId,
        row.toolCallId,
        row.createdAt,
        row.operation,
        JSON.stringify(row.parameters),
        row.paramsDigest,
        row.planDigest,
        row.status,
        row.message,
        JSON.stringify(row.steps),
        JSON.stringify(row.changes),
        JSON.stringify(row.backups),
        JSON.stringify(row.approvals),
        JSON.stringify(row.warnings),
        JSON.stringify(row.errors),
      );
    return row;
  }

  setPlanStatus(id: string, status: string): void {
    this.#db.prepare('UPDATE plans SET status = ? WHERE id = ?').run(status, id);
  }

  plan(id: string): PlanRecord | undefined {
    const row = this.#db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? toPlan(row) : undefined;
  }

  requestApproval(input: { planId: string; sessionId: string; expiresAt: string; approvalTexts: string[] }): ApprovalRecord {
    const row: ApprovalRecord = {
      id: randomUUID(),
      planId: input.planId,
      sessionId: input.sessionId,
      requestedAt: nowIso(),
      expiresAt: input.expiresAt,
      decidedAt: null,
      decision: null,
      decidedBy: null,
      approvalTexts: input.approvalTexts,
      consumedAt: null,
    };
    this.#db
      .prepare(
        `INSERT INTO approvals (id, plan_id, session_id, requested_at, expires_at, approval_texts)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.planId, row.sessionId, row.requestedAt, row.expiresAt, JSON.stringify(row.approvalTexts));
    return row;
  }

  /**
   * The one and only way a decision enters the database. `decidedBy` is fixed to `human` in the SQL, so a model
   * that somehow reaches this code still cannot write its own approval.
   */
  decideApproval(id: string, decision: 'yes' | 'no'): void {
    const result = this.#db
      .prepare(`UPDATE approvals SET decided_at = ?, decision = ?, decided_by = 'human' WHERE id = ? AND decided_at IS NULL`)
      .run(nowIso(), decision, id);
    if (result.changes === 0) throw new Error(`approval ${id} is already decided or unknown`);
  }

  approval(id: string): ApprovalRecord | undefined {
    const row = this.#db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? toApproval(row) : undefined;
  }

  /** Marks a granted approval as used, so it can never authorize a second change. */
  consumeApproval(id: string): boolean {
    const result = this.#db
      .prepare('UPDATE approvals SET consumed_at = ? WHERE id = ? AND decision = ? AND consumed_at IS NULL')
      .run(nowIso(), id, 'yes');
    return result.changes === 1;
  }

  /** Approvals that are granted, not yet used, not expired and belong to exactly this plan. */
  usableApprovals(planDigest: string): ApprovalRecord[] {
    const rows = this.#db
      .prepare(
        `SELECT a.* FROM approvals a JOIN plans p ON p.id = a.plan_id
         WHERE p.plan_digest = ? AND a.decision = 'yes' AND a.consumed_at IS NULL AND a.expires_at > ?`,
      )
      .all(planDigest, nowIso()) as Array<Record<string, unknown>>;
    return rows.map(toApproval);
  }

  countToolCalls(): number {
    const row = this.#db.prepare('SELECT COUNT(*) AS n FROM tool_calls').get() as { n: number };
    return Number(row.n);
  }

  countApprovals(): number {
    const row = this.#db.prepare('SELECT COUNT(*) AS n FROM approvals').get() as { n: number };
    return Number(row.n);
  }

  /** Kit answers as history. The doctor still measures live; this is what it said at a point in time. */
  recordKitResult(input: {
    sessionId: string | null;
    result: OperationResult;
    anonymized: boolean;
    argv?: readonly string[];
  }): void {
    this.#db
      .prepare(
        `INSERT INTO kit_results (session_id, operation, observed_at, api_version, status, anonymized, result_digest, result)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.sessionId,
        input.result.Operation,
        nowIso(),
        input.result.ApiVersion,
        input.result.Status,
        input.anonymized ? 1 : 0,
        digestOf(input.result),
        JSON.stringify(input.result),
      );
  }

  kitResults(operation?: string): Array<Record<string, unknown>> {
    return operation
      ? (this.#db.prepare('SELECT * FROM kit_results WHERE operation = ? ORDER BY id').all(operation) as Array<Record<string, unknown>>)
      : (this.#db.prepare('SELECT * FROM kit_results ORDER BY id').all() as Array<Record<string, unknown>>);
  }
}

export function digestOf(value: unknown): string {
  // A short, stable fingerprint of a request or result, so a plan and its approval are provably the same thing.
  return simpleHash(JSON.stringify(canonical(value)));
}

/** Stable JSON: object keys sorted, so {"a":1,"b":2} and {"b":2,"a":1} digest the same. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** SHA-256, hex. The plan digest binds an approval to exactly one operation + parameters + plan text. */
export function simpleHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function toPlan(row: Record<string, unknown>): PlanRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    toolCallId: String(row.tool_call_id),
    createdAt: String(row.created_at),
    operation: String(row.operation),
    parameters: JSON.parse(String(row.parameters)) as ParameterBag,
    paramsDigest: String(row.params_digest),
    planDigest: String(row.plan_digest),
    status: String(row.status),
    message: String(row.message),
    steps: JSON.parse(String(row.steps)) as unknown[],
    changes: JSON.parse(String(row.changes)) as unknown[],
    backups: JSON.parse(String(row.backups)) as string[],
    approvals: JSON.parse(String(row.approvals)) as string[],
    warnings: JSON.parse(String(row.warnings)) as string[],
    errors: JSON.parse(String(row.errors)) as string[],
  };
}

function toApproval(row: Record<string, unknown>): ApprovalRecord {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    sessionId: String(row.session_id),
    requestedAt: String(row.requested_at),
    expiresAt: String(row.expires_at),
    decidedAt: row.decided_at ? String(row.decided_at) : null,
    decision: row.decision ? (String(row.decision) as 'yes' | 'no') : null,
    decidedBy: row.decided_by ? String(row.decided_by) : null,
    approvalTexts: JSON.parse(String(row.approval_texts ?? '[]')) as string[],
    consumedAt: row.consumed_at ? String(row.consumed_at) : null,
  };
}
