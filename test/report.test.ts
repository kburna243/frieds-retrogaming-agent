/**
 * M6: `fagent report` — a summary of a period, from the audit trail only.
 *
 * What has to hold: it reads the database and nothing else (no kit root needed, no kit module imported), it counts
 * what the gate recorded, it says it is history, and it does not suggest a change.
 */

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReport, formatReport, parseSince, REPORT_NOTE } from '../src/report.ts';
import { Store } from '../src/db/store.ts';
import { main } from '../src/cli.ts';
import { cleanupAll, makeHarness } from './helpers.ts';

afterEach(cleanupAll);

const KIT_BACKUP = 'D:\\Pinball\\backups\\kit_20260101-100000-000.zip';

/** One evening at the cabinet: a read, one change applied, one declined, two refusals. Returns the db path. */
async function evening(): Promise<string> {
  const harness = await makeHarness({ answers: [true, { approved: false, said: 'no' }], verifyAfterApply: true });
  await harness.engine.handle({ tool: 'cabinet_status', args: {} });
  await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } });
  await harness.engine.handle({ tool: 'support_bundle', args: {} });
  await harness.engine.handle({ tool: 'run_step', args: { operation: 'backup.remove', parameters: { Path: KIT_BACKUP } } });
  await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.99-magic' } });
  harness.store.close();
  return harness.dbPath;
}

async function capture(run: () => Promise<number>): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const write = { out: process.stdout.write.bind(process.stdout), err: process.stderr.write.bind(process.stderr) };
  process.stdout.write = ((chunk: string) => (out.push(String(chunk)), true)) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => (err.push(String(chunk)), true)) as typeof process.stderr.write;
  try {
    const code = await run();
    return { code, out: out.join(''), err: err.join('') };
  } finally {
    process.stdout.write = write.out;
    process.stderr.write = write.err;
  }
}

describe('fagent report (M6)', () => {
  it('counts what the gate recorded, change by change', async () => {
    const store = Store.open(await evening());
    const report = buildReport(store, parseSince('1d')!);
    store.close();

    expect(report.sessions.count).toBe(1);
    expect(report.sessions.byLevel).toEqual({ operator: 1 });
    expect(report.calls).toEqual({ total: 7, reads: 1, dryRuns: 2, applies: 1, verifications: 1, refused: 2 });
    expect(report.changes.map((c) => [c.operation, c.status, c.kitStatus])).toEqual([
      ['step.lightgun.03-vigembus', 'applied', 'Done'],
      ['support.bundle', 'declined', null],
    ]);
    expect(report.refusals.map((r) => r.code).sort()).toEqual(['NOT_OFFERED', 'UNKNOWN_OPERATION']);
    expect(report.lastStatus?.message).toMatch(/^doctor: 0 error\(s\)/); // the verification after the install
  });

  it('only looks at the period asked for', async () => {
    const path = await evening();
    const store = Store.open(path);
    store.execForTests("UPDATE tool_calls SET created_at = '2026-01-01T00:00:00.000Z'");
    store.execForTests("UPDATE plans SET created_at = '2026-01-01T00:00:00.000Z'");
    store.execForTests("UPDATE sessions SET started_at = '2026-01-01T00:00:00.000Z'");
    const report = buildReport(store, parseSince('7d')!);
    store.close();
    expect(report.sessions.count).toBe(0);
    expect(report.calls.total).toBe(0);
    expect(report.changes).toEqual([]);
    expect(formatReport(report)).toContain('none: nothing was planned in this period');
  });

  it('says it is history and does not tell anyone what to change', async () => {
    const store = Store.open(await evening());
    const text = formatReport(buildReport(store, parseSince('1d')!));
    store.close();
    expect(text).toContain(REPORT_NOTE);
    expect(text).toContain('step.lightgun.03-vigembus');
    expect(text).not.toMatch(/you should|recommend|we suggest|next step|fagent run /i);
  });

  it('runs from the CLI without a kit root, as text and as JSON', async () => {
    const path = await evening();
    const saved = { kit: process.env.FAGENT_KIT_ROOT, legacy: process.env.KIT_ROOT };
    delete process.env.FAGENT_KIT_ROOT;
    delete process.env.KIT_ROOT;
    try {
      const text = await capture(() => main(['report', '--db', path, '--since', '1d']));
      expect(text.code).toBe(0);
      expect(text.out).toContain('Sessions: 1 (1 operator)');

      const json = await capture(() => main(['report', '--db', path, '--json']));
      expect(json.code).toBe(0);
      const parsed = JSON.parse(json.out) as { note: string; calls: { applies: number } };
      expect(parsed.note).toBe(REPORT_NOTE);
      expect(parsed.calls.applies).toBe(1);

      const bad = await capture(() => main(['report', '--db', path, '--since', 'last tuesday-ish']));
      expect(bad.code).toBe(2);
      expect(bad.err).toMatch(/--since must look like/);

      const history = await capture(() => main(['history', '--db', path]));
      expect(history.code).toBe(0);
    } finally {
      if (saved.kit !== undefined) process.env.FAGENT_KIT_ROOT = saved.kit;
      if (saved.legacy !== undefined) process.env.KIT_ROOT = saved.legacy;
    }
  });

  it('the report module can not reach the kit: it imports the store and the memory wording, nothing else', () => {
    for (const file of ['../src/report.ts', '../src/agent/memory.ts']) {
      const imports = [...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
      for (const specifier of imports) expect(specifier, `${file} imports ${specifier}`).not.toMatch(/kit\/|harness|transport|policy|child_process/);
    }
  });

  it('reads --since as days, hours, minutes or a date', () => {
    const now = new Date('2026-09-26T12:00:00.000Z');
    expect(parseSince('7d', now)).toBe('2026-09-19T12:00:00.000Z');
    expect(parseSince('24h', now)).toBe('2026-09-25T12:00:00.000Z');
    expect(parseSince('90m', now)).toBe('2026-09-26T10:30:00.000Z');
    expect(parseSince('2026-09-01', now)).toBe('2026-09-01T00:00:00.000Z');
    expect(parseSince('soon', now)).toBeNull();
  });
});
