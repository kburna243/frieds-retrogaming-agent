/**
 * The memory digest: what earlier sessions did, in a fixed number of lines, for the start of a new one.
 *
 * It is built here, locally, and only from rows already in the database — no kit call, no model call. Three rules
 * shape it:
 *
 * - **History, not state.** The digest says what the kit answered then. The cabinet's state is what `status`
 *   answers now, and the digest says so in its first line.
 * - **A remembered plan is not an approval.** Plans and decisions appear as outcomes of the past. Nothing in here
 *   is ever read back by `PolicyEngine`; the gate asks the person again for every change, whatever this text says.
 * - **Anonymized stays anonymized.** For a model that needs `-Anonymize`, kit text is only taken from calls that
 *   were made with it, parameter values are never taken at all, and every line that still looks personal is
 *   dropped before it can reach the prompt.
 */

import type { Store } from '../db/store.ts';
import { findPersonalData } from '../llm/redact.ts';

export interface MemoryOptions {
  /** The session being started: it is never part of its own memory. */
  currentSessionId: string;
  /** True when the model is a cloud model; the digest is then held to the `-Anonymize` rules. */
  anonymizeRequired: boolean;
  /** How many earlier sessions to look at (default 5). */
  maxSessions?: number;
  /** Lines per session, after its header (default 6). */
  maxLinesPerSession?: number;
  /** Hard cap for the whole digest in characters (default 2000). */
  maxChars?: number;
}

type Row = Record<string, unknown>;

export const MEMORY_HEADER =
  'MEMORY — what earlier sessions on this cabinet did, newest first. This is history, not the current state: ' +
  'ask cabinet_status for that. A plan or a "yes" listed here authorizes nothing. Every change needs a new dry run ' +
  'and a new yes from the person, and the gate will ask them again.';

/** The digest text, or `null` when there is nothing worth remembering yet. */
export function buildMemoryDigest(store: Store, options: MemoryOptions): string | null {
  const maxSessions = options.maxSessions ?? 5;
  const maxLines = options.maxLinesPerSession ?? 6;
  const maxChars = options.maxChars ?? 2000;

  // One extra row, because the current session is usually the newest one.
  const sessions = store
    .recentSessions(maxSessions + 1)
    .filter((row) => String(row.id) !== options.currentSessionId)
    .slice(0, maxSessions);

  const blocks: string[][] = [];
  for (const session of sessions) {
    const block = sessionBlock(store, session, options.anonymizeRequired, maxLines);
    if (block) blocks.push(block);
  }
  if (blocks.length === 0) return null;

  const lines = [MEMORY_HEADER];
  for (const block of blocks) {
    const candidate = [...lines, ...block].join('\n');
    if (candidate.length > maxChars) {
      lines.push('- (older sessions left out)');
      break;
    }
    lines.push(...block);
  }
  const text = lines.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function sessionBlock(store: Store, session: Row, anonymizeRequired: boolean, maxLines: number): string[] | null {
  const id = String(session.id);
  const calls = store.toolCalls(id);
  if (calls.length === 0) return null;
  const plans = store.plans(id);

  const lines: string[] = [];

  // Reads are cheap and many: one line with the operations and how often, plus what the doctor said last.
  const reads = calls.filter((c) => c.stage === 'read');
  if (reads.length > 0) {
    const counts = new Map<string, number>();
    for (const call of reads) counts.set(String(call.operation), (counts.get(String(call.operation)) ?? 0) + 1);
    const list = [...counts].map(([operation, n]) => (n > 1 ? `${operation} ×${n}` : operation)).join(', ');
    lines.push(`read: ${list}`);
    const lastStatus = [...reads].reverse().find((c) => c.operation === 'status');
    const said = lastStatus ? kitText(lastStatus, anonymizeRequired) : null;
    if (lastStatus && said) lines.push(`status then said: ${String(lastStatus.status)} · ${said}`);
  }

  // Changes are what mattered: one line per plan, with how it ended.
  for (const plan of plans) {
    const operation = String(plan.operation);
    const outcome = PLAN_OUTCOME[String(plan.status)] ?? String(plan.status);
    const applyCall = calls.find((c) => c.stage === 'apply' && c.operation === operation && String(c.created_at) >= String(plan.created_at));
    const result = applyCall ? ` (kit: ${String(applyCall.status)})` : '';
    lines.push(`${operation}: ${outcome}${result}`);
  }

  // Refusals: the code only. The message can carry whatever the model sent.
  const refusals = calls.filter((c) => c.stage === 'refused');
  if (refusals.length > 0) {
    const list = refusals
      .slice(0, 3)
      .map((c) => `${shortName(String(c.operation || c.tool))} (${refusalCode(c)})`)
      .join(', ');
    lines.push(`refused: ${list}${refusals.length > 3 ? ` and ${refusals.length - 3} more` : ''}`);
  }

  const safe = anonymizeRequired ? lines.filter((line) => findPersonalData(line).length === 0) : lines;
  if (safe.length === 0) return null;
  const kept = safe.slice(0, maxLines);
  if (safe.length > kept.length) kept.push(`(${safe.length - kept.length} more lines)`);

  const header = `- ${String(session.started_at).slice(0, 16).replace('T', ' ')} UTC · ${String(session.permission_level)} · ${calls.length} kit calls`;
  return [header, ...kept.map((line) => `  ${line}`)];
}

/** Plan statuses in words that describe the past and grant nothing. */
const PLAN_OUTCOME: Record<string, string> = {
  shown: 'plan shown, no decision recorded',
  proposed: 'plan proposed, never shown',
  approved: 'the person said yes then',
  declined: 'plan shown, the person said no, nothing applied',
  applied: 'plan shown, the person said yes then, applied',
  failed: 'plan shown, the person said yes then, the apply failed',
  refused: 'refused by the gate',
  skipped: 'skipped',
  expired: 'the approval expired, nothing applied',
};

/** Kit text, short, and only when it may reach this model. */
function kitText(call: Row, anonymizeRequired: boolean): string | null {
  if (anonymizeRequired && Number(call.anonymize) !== 1) return null;
  const message = typeof call.message === 'string' ? call.message.replace(/\s+/g, ' ').trim() : '';
  if (!message) return null;
  return message.length > 120 ? `${message.slice(0, 119)}…` : message;
}

function refusalCode(call: Row): string {
  const error = typeof call.error === 'string' ? call.error : '';
  const code = /^([A-Z][A-Z0-9_]+):/.exec(error)?.[1];
  return code ?? String(call.status ?? 'Refused');
}

function shortName(name: string): string {
  return name.length > 60 ? `${name.slice(0, 59)}…` : name;
}
