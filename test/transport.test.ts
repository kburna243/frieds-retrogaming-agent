/**
 * The real transport, end to end, against the fake kit as a real child process.
 *
 * This is the test that makes the "you can finish this in a cloud session" promise true: it exercises
 * argv building, process spawn, stdout parsing, exit codes and state — everywhere, without Windows.
 * On the cabinet the same code path runs against `api\Invoke-KitApi.ps1` (tools/Start-SmokeTest.ps1).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StdioKitTransport } from '../src/kit/stdio-transport.ts';
import { KitClient } from '../src/kit/client.ts';

const FAKE_PROCESS = fileURLToPath(new URL('./kit/fake-kit-process.mjs', import.meta.url));

function transport(stateFile?: string): StdioKitTransport {
  return new StdioKitTransport({
    kitRoot: 'C:\\synthetic\\frieds-retrogaming-kit',
    executable: process.execPath,
    ...(stateFile ? { prependArgs: [FAKE_PROCESS, '--state', stateFile] } : { prependArgs: [FAKE_PROCESS] }),
    allowNonWindows: true,
  });
}

describe('StdioKitTransport against a child process', () => {
  it('reads the catalog over a real stdout, as one JSON document', async () => {
    const client = new KitClient(transport());
    const outcome = await client.call({ operation: 'operations', anonymize: true });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.result.ApiVersion).toBe('1.3');
    // The version of the kit is in the document itself since 1.1, so a stdio call knows it without a handshake.
    expect(outcome.result.KitVersion).toBe('0.4.0');
    expect(client.kitVersion).toBe('0.4.0');
    expect((outcome.result.Data?.Operations as unknown[]).length).toBeGreaterThan(10);
  });

  it('maps the exit codes the way API.md says: 0 success, 1 not succeeded, 2 refused', async () => {
    const client = new KitClient(transport());
    expect((await client.call({ operation: 'status' })).exitCode).toBe(0);
    expect((await client.call({ operation: 'backup.check' })).exitCode).toBe(2); // missing parameter
    expect((await client.call({ operation: 'no.such.thing' })).exitCode).toBe(2); // unknown operation
    expect((await client.call({ operation: 'step.lightgun.03-vigembus', apply: true })).exitCode).toBe(1); // NeedsUser
  });

  it('the -File path in the argv is the kit script, so the same code talks to PowerShell on the cabinet', async () => {
    const call = await transport().call({ operation: 'status' });
    // The fake runs as `node <script> <powershell argv...>`, so look at the part after the injected prefix.
    const start = call.argv.indexOf('-NoProfile');
    expect(start).toBeGreaterThan(0);
    expect(call.argv.slice(start, start + 4)).toEqual(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File']);
    expect(call.argv[start + 5]).toBe('-Operation');
    expect(call.argv[start + 6]).toBe('status');
    const fileIndex = call.argv.indexOf('-File');
    expect(call.argv[fileIndex + 1]).toBe('C:\\synthetic\\frieds-retrogaming-kit\\api\\Invoke-KitApi.ps1');
  });

  it('state survives between one-shot processes, so apply → verify measures a change', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fagent-proc-'));
    try {
      const stateFile = join(directory, 'state.json');
      const client = new KitClient(transport(stateFile));
      const before = await client.call({ operation: 'status' });
      expect((before.result.Data?.Summary as { Level: string }).Level).toBe('Error');

      const applied = await client.call({ operation: 'step.lightgun.03-vigembus', apply: true, approved: true });
      expect(applied.result.Status).toBe('Done');

      const after = await client.call({ operation: 'status' });
      expect((after.result.Data?.Summary as { Level: string }).Level).toBe('Warn');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('a dead executable is reported as a transport error, never as a silent success', async () => {
    const broken = new StdioKitTransport({
      kitRoot: 'C:\\synthetic\\kit',
      executable: process.execPath,
      prependArgs: [join(process.cwd(), 'test', 'kit', 'does-not-exist.mjs')],
      allowNonWindows: true,
    });
    const call = await broken.call({ operation: 'status' });
    expect(call.stdout).toBe('');
    await expect(new KitClient(broken).call({ operation: 'status' })).rejects.toThrow(/not return one JSON document/);
  });
});
