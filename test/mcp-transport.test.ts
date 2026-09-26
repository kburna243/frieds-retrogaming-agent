/**
 * M4: the kit's MCP server as a second transport, against the fake server as a real child process.
 *
 * What has to stay true when the transport changes: the catalog and its ApiVersion still come from
 * `Invoke-KitApi.ps1`, the model still never holds `apply`/`approved`, the gate order is the same, and a call that
 * must be anonymized is never answered with real paths.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { McpKitTransport, buildMcpServerArgv, mcpToolName } from '../src/kit/mcp-transport.ts';
import { KitClient, ApiVersionMismatchError } from '../src/kit/client.ts';
import { buildTools } from '../src/kit/tools.ts';
import { Store } from '../src/db/store.ts';
import { PolicyEngine } from '../src/policy/engine.ts';
import { ScriptedHumanGateway } from '../src/policy/human.ts';
import { createHarness } from '../src/harness.ts';
import { loadConfig } from '../src/config.ts';
import { ScriptedModelGateway } from '../src/llm/scripted-model.ts';
import { FakeKitTransport } from './kit/fake-kit-transport.ts';
import { FAKE_PERSON } from './kit/fake-kit.mjs';

const FAKE_SERVER = fileURLToPath(new URL('./kit/fake-kit-mcp.mjs', import.meta.url));
const open: McpKitTransport[] = [];
const stores: Store[] = [];
const directories: string[] = [];

afterEach(async () => {
  for (const transport of open.splice(0)) await transport.close();
  // Windows keeps the folder locked while SQLite has the file open.
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) {
    // Best effort, as in test/helpers.ts: Windows can hold a handle a moment after SQLite or a child closed it.
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // the OS reclaims the temp folder
    }
  }
});

interface Setup {
  transport: McpKitTransport;
  catalog: FakeKitTransport;
  directory: string;
  /** What reached the MCP server, in order. */
  calls(): Array<{ tool: string; operation: string; parameters: Record<string, unknown>; apply: boolean; approved: boolean }>;
}

function setup(options: { anonymize?: boolean; readOnly?: boolean; apiVersion?: string } = {}): Setup {
  const directory = mkdtempSync(join(tmpdir(), 'fagent-mcp-'));
  directories.push(directory);
  const callsFile = join(directory, 'calls.jsonl');
  const catalog = new FakeKitTransport(options.apiVersion ? { apiVersion: options.apiVersion } : {});
  const transport = new McpKitTransport({
    kitRoot: 'C:\\synthetic\\frieds-retrogaming-kit',
    catalogTransport: catalog,
    anonymize: options.anonymize ?? true,
    readOnly: options.readOnly ?? false,
    executable: process.execPath,
    prependArgs: [FAKE_SERVER, '--state', join(directory, 'state.json'), '--calls', callsFile],
    allowNonWindows: true,
    timeoutMs: 10_000,
  });
  open.push(transport);
  return {
    transport,
    catalog,
    directory,
    calls: () =>
      existsSync(callsFile)
        ? readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as ReturnType<Setup['calls']>[number])
        : [],
  };
}

async function gate(s: Setup, answers: Array<boolean | { approved: boolean; said: string }>, anonymize = true) {
  const client = new KitClient(s.transport);
  const catalog = await client.catalog({ anonymize });
  const store = Store.open(join(s.directory, 'harness.db'));
  stores.push(store);
  const session = store.startSession({ permissionLevel: 'operator', model: 'test', provider: 'local' });
  const human = new ScriptedHumanGateway(answers);
  const engine = new PolicyEngine({
    client, store, sessionId: session.id, level: 'operator', human, anonymize, tools: buildTools(catalog), verifyAfterApply: true,
  });
  return { engine, store, human, client };
}

describe('MCP transport: the pure parts', () => {
  it('starts the server with the flags API.md documents', () => {
    expect(buildMcpServerArgv('D:\\cabinet\\frieds-retrogaming-kit\\', { anonymize: true, readOnly: true, culture: 'de-DE' })).toEqual([
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'D:\\cabinet\\frieds-retrogaming-kit\\api\\Start-KitMcpServer.ps1',
      '-ReadOnly', '-Culture', 'de-DE',
    ]);
    expect(buildMcpServerArgv('D:\\kit', { anonymize: false, readOnly: false })).toContain('-NoAnonymize');
    expect(buildMcpServerArgv('D:\\kit', { anonymize: true, readOnly: false })).not.toContain('-NoAnonymize');
  });

  it('names tools the way the server does', () => {
    expect(mcpToolName('backup.restore')).toBe('backup_restore');
    expect(mcpToolName('step.lightgun.10-teknoparrot')).toBe('step_lightgun_10-teknoparrot');
  });

  it('refuses to start the real server anywhere but on Windows unless told otherwise', () => {
    if (process.platform === 'win32') return;
    expect(() => new McpKitTransport({ kitRoot: 'D:\\kit', catalogTransport: new FakeKitTransport(), anonymize: true, readOnly: true })).toThrow(/needs Windows/);
  });
});

describe('MCP transport against the fake server process', () => {
  it('does the handshake and learns the kit version from the kit itself', async () => {
    const s = setup();
    await s.transport.connect();
    expect(s.transport.protocolVersion).toBe('2025-06-18');
    expect(s.transport.kitVersion).toBe('0.3.1');
    expect(s.transport.toolNames.has('status')).toBe(true);
    expect(s.transport.toolNames.has('operations')).toBe(false);
    // Interactive steps are not offered by the server either.
    expect(s.transport.toolNames.has('step_pinball_08-screens')).toBe(false);
  });

  it('takes the catalog from Invoke-KitApi.ps1, so the ApiVersion pin still holds', async () => {
    const s = setup();
    const client = new KitClient(s.transport);
    const catalog = await client.catalog();
    expect(catalog.some((op) => op.Interactive)).toBe(true); // only the reference catalog carries Interactive
    expect(s.catalog.calls.map((c) => c.operation)).toEqual(['operations']);
    expect(s.calls()).toEqual([]);

    const wrong = setup({ apiVersion: '2.0' });
    await expect(new KitClient(wrong.transport).catalog()).rejects.toBeInstanceOf(ApiVersionMismatchError);
  });

  it('runs the whole gate over MCP: dry run → human yes → apply with approved → verify', async () => {
    const s = setup();
    const { engine, human } = await gate(s, [true]);
    const answer = await engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } });

    expect(answer.stage).toBe('applied');
    expect(human.seen).toHaveLength(1);
    expect(s.calls().map((c) => `${c.operation}${c.apply ? ':apply' : ''}${c.approved ? '+approved' : ''}`)).toEqual([
      'step.lightgun.03-vigembus',
      'step.lightgun.03-vigembus:apply+approved',
      'status',
    ]);
    // The server kept its state: the verification measured the installed driver.
    expect((answer.payload.verification as { summary: { Level: string } }).summary.Level).toBe('Warn');
  });

  it('a no at the terminal sends nothing with apply to the server', async () => {
    const s = setup();
    const { engine } = await gate(s, [{ approved: false, said: 'no' }]);
    const answer = await engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } });
    expect(answer.stage).toBe('declined');
    expect(s.calls().map((c) => c.apply)).toEqual([false]);
  });

  it('a parameter called Apply never becomes the apply flag', async () => {
    const s = setup();
    await expect(s.transport.call({ operation: 'step.lightgun.07-retrobatsettings', parameters: { Apply: true } })).rejects.toThrow(/Apply.*apply flag/);
    await expect(s.transport.call({ operation: 'support.bundle', parameters: { APPROVED: true } })).rejects.toThrow(/approved flag/);
    expect(s.calls()).toEqual([]);
  });

  it('results are anonymized, and an anonymized call is refused by a server that does not anonymize', async () => {
    const s = setup({ anonymize: true });
    const status = await s.transport.call({ operation: 'status', anonymize: true });
    expect(status.stdout).not.toContain(FAKE_PERSON.computer);
    expect(status.stdout).toContain('<COMPUTER>');

    const local = setup({ anonymize: false });
    await expect(local.transport.call({ operation: 'status', anonymize: true })).rejects.toThrow(/-NoAnonymize/);
    const real = await local.transport.call({ operation: 'status', anonymize: false });
    expect(real.stdout).toContain(FAKE_PERSON.computer);
  });

  it('a read-only server offers no change tool, and the transport says so instead of calling it', async () => {
    const s = setup({ readOnly: true });
    await s.transport.connect();
    expect([...s.transport.toolNames].every((name) => !name.startsWith('step_') && name !== 'support_bundle')).toBe(true);
    await expect(s.transport.call({ operation: 'support.bundle' })).rejects.toThrow(/does not offer support_bundle.*-ReadOnly/);
    expect(s.calls()).toEqual([]);
  });

  it('keeps the exit code rule readable in the audit trail', async () => {
    const s = setup();
    expect((await s.transport.call({ operation: 'status' })).exitCode).toBe(0);
    expect((await s.transport.call({ operation: 'step.lightgun.03-vigembus', apply: true })).exitCode).toBe(1); // NeedsUser
  });
});

describe('harness with the MCP transport', () => {
  it('stdio stays the default; mcp is chosen explicitly and nothing else is accepted', () => {
    const kitRoot = 'D:\\cabinet\\frieds-retrogaming-kit';
    expect(loadConfig({ kitRoot, requireModel: false }, {}).transport).toBe('stdio');
    expect(loadConfig({ kitRoot, requireModel: false }, { FAGENT_TRANSPORT: 'mcp' }).transport).toBe('mcp');
    expect(() => loadConfig({ kitRoot, requireModel: false, transport: 'http' }, {})).toThrow(/stdio or mcp/);
  });

  it('records the kit version in the session row, from the result rather than only the handshake', async () => {
    const s = setup();
    const config = loadConfig({ kitRoot: 'D:\\cabinet\\frieds-retrogaming-kit', db: join(s.directory, 'h.db'), requireModel: false }, {});
    const harness = await createHarness(config, { transport: s.transport, gateway: new ScriptedModelGateway() });
    // Since ApiVersion 1.1 the kit names its version inside every result, so the MCP path and the plain stdio path
    // report the same number. The fake keeps both from one constant, so this cannot pass by accident.
    expect(harness.kitVersion).toBe('0.3.1');
    const session = harness.store.recentSessions(1)[0];
    expect(session?.kit_version).toBe('0.3.1');
    expect(session?.transport).toBe('mcp-stdio');
    harness.store.close();
  });
});
