/**
 * Shared test wiring: an in-memory harness against the fake kit.
 *
 * Every test that needs "a cabinet" gets one from here, so no test can accidentally talk to a real machine and
 * no test needs Windows.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KitClient } from '../src/kit/client.ts';
import { buildTools, filterReadTools } from '../src/kit/tools.ts';
import type { OperationSpec } from '../src/kit/types.ts';
import type { KitRequest } from '../src/kit/transport.ts';
import { Store } from '../src/db/store.ts';
import { PolicyEngine, type PermissionLevel } from '../src/policy/engine.ts';
import { ScriptedHumanGateway, NeverApprovesGateway } from '../src/policy/human.ts';
import { ScriptedModelGateway, type ScriptStep } from '../src/llm/scripted-model.ts';
import { FakeKitTransport } from './kit/fake-kit-transport.ts';

export interface HarnessFixture {
  client: KitClient;
  store: Store;
  engine: PolicyEngine;
  transport: FakeKitTransport;
  /** What the model is offered: read tools only at the read-only level. */
  tools: ReturnType<typeof buildTools>;
  /** What the engine checks against: the full catalog, whatever the level. */
  allTools: ReturnType<typeof buildTools>;
  catalog: OperationSpec[];
  sessionId: string;
  human: ScriptedHumanGateway;
  dbPath: string;
  requests: KitRequest[];
  cleanup(): Promise<void>;
}

export interface FixtureOptions {
  level?: PermissionLevel;
  /** Answers the scripted human gives, in order (default: yes once). */
  answers?: Array<boolean | { approved: boolean; said: string }>;
  /** Use the refusing gateway instead of a scripted one. */
  noHuman?: boolean;
  anonymize?: boolean;
  state?: Record<string, unknown>;
  apiVersion?: string;
  verifyAfterApply?: boolean;
  /** Reuse an existing database: a second session on the same cabinet memory. */
  dbPath?: string;
}

const directories: string[] = [];

export async function makeHarness(options: FixtureOptions = {}): Promise<HarnessFixture> {
  const directory = mkdtempSync(join(tmpdir(), 'fagent-test-'));
  directories.push(directory);
  const dbPath = options.dbPath ?? join(directory, 'harness.db');

  const transport = new FakeKitTransport({
    ...(options.state ? { state: options.state } : {}),
    ...(options.apiVersion ? { apiVersion: options.apiVersion } : {}),
  });
  const client = new KitClient(transport);
  const anonymize = options.anonymize ?? false;
  const catalog = await client.catalog({ anonymize });
  const engineTools = buildTools(catalog);
  const level = options.level ?? 'operator';
  const tools = level === 'read-only' ? filterReadTools(engineTools) : engineTools;

  const store = Store.open(dbPath);
  const session = store.startSession({ permissionLevel: level, model: 'test', provider: 'local' });
  const human = options.noHuman ? new NeverApprovesGateway() : new ScriptedHumanGateway(options.answers ?? [true]);

  const engine = new PolicyEngine({
    client,
    store,
    sessionId: session.id,
    level,
    human,
    anonymize,
    tools: engineTools,
    verifyAfterApply: options.verifyAfterApply ?? false,
  });

  return {
    client,
    store,
    engine,
    transport,
    tools,
    /** Same list under the name `createHarness` uses, so a test can read like production code. */
    allTools: engineTools,
    catalog,
    sessionId: session.id,
    human: human as ScriptedHumanGateway,
    dbPath,
    requests: transport.calls,
    cleanup,
  };

  async function cleanup(): Promise<void> {
    store.close();
    removeQuietly(directory);
  }
}

export function makeModel(steps: ScriptStep[]): ScriptedModelGateway {
  return new ScriptedModelGateway(steps);
}

export async function cleanupAll(): Promise<void> {
  for (const directory of directories.splice(0)) removeQuietly(directory);
}

/** Windows keeps a file handle open a moment after SQLite closes; a temp dir must never fail a test run. */
function removeQuietly(directory: string): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      rmSync(directory, { recursive: true, force: true });
      return;
    } catch {
      // best effort: the OS reclaims the temp folder
    }
  }
}

/** The order of kit calls, as `operation:apply/approved` — the shape most policy assertions need. */
export function callTrace(requests: readonly KitRequest[]): string[] {
  return requests.map((request) => `${request.operation}${request.apply ? ':apply' : ''}${request.approved ? '+approved' : ''}`);
}

/** Paths from `readdirSync(recursive)` use `\` on Windows; assertions are written with `/`. */
export function toPosix(path: string): string {
  return path.split('\\').join('/');
}

/** Runs a CLI call and keeps what it wrote, so a test can check stdout and stderr apart. */
export async function captureOutput(run: () => Promise<number>): Promise<{ code: number; out: string; err: string }> {
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
