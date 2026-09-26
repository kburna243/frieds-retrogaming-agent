/**
 * `fagent report` (M6): what the harness did in a period, for a person — built from the audit trail only.
 *
 * This module knows the `Store` and nothing else: no kit client, no transport, no model. It cannot call the kit
 * and cannot change the cabinet, and a test holds it to that. What it prints is history. It never suggests a
 * change: the next action is a person's to decide, with `fagent status` for how the cabinet is now.
 */

import type { Store } from './db/store.ts';
import { PLAN_OUTCOME } from './agent/memory.ts';

export interface Report {
  from: string;
  to: string;
  sessions: { count: number; byLevel: Record<string, number>; models: string[]; transports: string[] };
  /** `total` is every recorded call; `refused` ones never reached the kit. */
  calls: { total: number; reads: number; dryRuns: number; applies: number; verifications: number; refused: number };
  changes: Array<{ at: string; operation: string; status: string; outcome: string; kitStatus: string | null }>;
  refusals: Array<{ code: string; count: number; lastOperation: string }>;
  lastStatus: { at: string; status: string; message: string } | null;
}

export const REPORT_NOTE =
  'History from the harness database, not the state of the cabinet. For how it is now: fagent status.';

/** `7d`, `24h`, `90m`, or a date/time the platform can parse. Returns the ISO start, or null if unreadable. */
export function parseSince(value: string, now: Date = new Date()): string | null {
  const relative = /^(\d+)\s*([dhm])$/i.exec(value.trim());
  if (relative) {
    const amount = Number(relative[1]);
    const unit = (relative[2] ?? 'd').toLowerCase();
    const ms = amount * (unit === 'd' ? 86_400_000 : unit === 'h' ? 3_600_000 : 60_000);
    return new Date(now.getTime() - ms).toISOString();
  }
  const absolute = new Date(value);
  return Number.isNaN(absolute.getTime()) ? null : absolute.toISOString();
}

export function buildReport(store: Store, since: string, now: Date = new Date()): Report {
  const sessions = store.sessionsSince(since);
  const calls = store.toolCallsSince(since);
  const plans = store.plansSince(since);

  const byLevel: Record<string, number> = {};
  for (const session of sessions) {
    const level = String(session.permission_level);
    byLevel[level] = (byLevel[level] ?? 0) + 1;
  }
  const distinct = (values: unknown[]) => [...new Set(values.filter((v) => v !== null && v !== undefined && v !== '').map(String))];

  const count = (stage: string) => calls.filter((call) => call.stage === stage).length;

  const changes = plans.map((plan) => {
    const operation = String(plan.operation);
    const status = String(plan.status);
    const apply = calls.find((call) => call.stage === 'apply' && call.operation === operation && String(call.created_at) >= String(plan.created_at));
    return {
      at: String(plan.created_at),
      operation,
      status,
      outcome: PLAN_OUTCOME[status] ?? status,
      kitStatus: apply ? String(apply.status) : null,
    };
  });

  const refusalCounts = new Map<string, { count: number; lastOperation: string }>();
  for (const call of calls.filter((c) => c.stage === 'refused')) {
    const error = typeof call.error === 'string' ? call.error : '';
    const code = /^([A-Z][A-Z0-9_]+):/.exec(error)?.[1] ?? String(call.status ?? 'Refused');
    const entry = refusalCounts.get(code) ?? { count: 0, lastOperation: '' };
    entry.count += 1;
    entry.lastOperation = String(call.operation || call.tool);
    refusalCounts.set(code, entry);
  }

  const statusCall = [...calls].reverse().find((call) => call.operation === 'status' && (call.stage === 'read' || call.stage === 'verify'));

  return {
    from: since,
    to: now.toISOString(),
    sessions: {
      count: sessions.length,
      byLevel,
      models: distinct(sessions.map((s) => (s.provider && s.model ? `${String(s.provider)}:${String(s.model)}` : null))),
      transports: distinct(sessions.map((s) => s.transport)),
    },
    calls: {
      total: calls.length,
      reads: count('read'),
      dryRuns: count('dry_run'),
      applies: count('apply'),
      verifications: count('verify'),
      refused: count('refused'),
    },
    changes,
    refusals: [...refusalCounts].map(([code, entry]) => ({ code, ...entry })).sort((a, b) => b.count - a.count),
    lastStatus: statusCall
      ? { at: String(statusCall.created_at), status: String(statusCall.status ?? ''), message: String(statusCall.message ?? '') }
      : null,
  };
}

/** Plain text for a person or a notes vault. Short lines, no colours, no advice. */
export function formatReport(report: Report): string {
  const day = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  const lines: string[] = [];
  lines.push(`fagent report · ${day(report.from)} → ${day(report.to)} UTC`);
  lines.push(REPORT_NOTE);
  lines.push('');

  const levels = Object.entries(report.sessions.byLevel).map(([level, n]) => `${n} ${level}`).join(', ');
  lines.push(`Sessions: ${report.sessions.count}${levels ? ` (${levels})` : ''}`);
  if (report.sessions.models.length > 0) lines.push(`Models: ${report.sessions.models.join(', ')}`);
  if (report.sessions.transports.length > 0) lines.push(`Transports: ${report.sessions.transports.join(', ')}`);
  const c = report.calls;
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  lines.push(
    `Calls: ${c.total} recorded · ${n(c.total - c.refused, 'reached', 'reached')} the kit ` +
      `(${n(c.reads, 'read', 'reads')}, ${n(c.dryRuns, 'dry run', 'dry runs')}, ${n(c.applies, 'apply', 'applies')}, ` +
      `${n(c.verifications, 'verification', 'verifications')}) · ${c.refused} refused before the kit`,
  );

  lines.push('');
  lines.push('Changes');
  if (report.changes.length === 0) lines.push('  none: nothing was planned in this period');
  const width = Math.max(0, ...report.changes.map((change) => change.operation.length));
  for (const change of report.changes) {
    const kit = change.kitStatus ? ` (kit: ${change.kitStatus})` : '';
    lines.push(`  ${day(change.at)}  ${change.operation.padEnd(width)}  ${change.outcome}${kit}`);
  }

  lines.push('');
  lines.push('Refusals');
  if (report.refusals.length === 0) lines.push('  none');
  for (const refusal of report.refusals) {
    lines.push(`  ${refusal.code} ×${refusal.count} (last: ${refusal.lastOperation})`);
  }

  lines.push('');
  lines.push(
    report.lastStatus
      ? `Last doctor reading in this period (${day(report.lastStatus.at)}): ${report.lastStatus.status} · ${report.lastStatus.message}`
      : 'No doctor reading in this period.',
  );
  return `${lines.join('\n')}\n`;
}
