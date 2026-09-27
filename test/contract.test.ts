/**
 * Contract-level tests: the shapes API.md pins, the argument vector the kit expects, and what the catalog is
 * allowed to turn into a tool.
 */

import { describe, expect, it } from 'vitest';
import { parseKitResult, readCatalog, RESULT_FIELDS, SUPPORTED_API_MAJOR, apiMajor } from '../src/kit/types.ts';
import { buildKitArgv, kitApiScript, windowsPowerShellPath, type KitRequest } from '../src/kit/transport.ts';
import { buildTools, filterReadTools, runnableSteps, schemaForParameters } from '../src/kit/tools.ts';
import { validateParameters } from '../src/kit/client.ts';
import { makeHarness } from './helpers.ts';
import { catalog as fakeCatalog, handle, KIT_VERSION } from './kit/fake-kit.mjs';
import snapshot from '../contract/catalog-v1.json' with { type: 'json' };

describe('the JSON document of the kit', () => {
  it('carries exactly the documented fields, and nothing else counts', () => {
    const { result } = handle({ operation: 'status' });
    expect(Object.keys(result)).toEqual(RESULT_FIELDS);
    expect(parseKitResult(JSON.stringify(result)).Status).toBe('Ok');
  });

  it('refuses a truncated or double document instead of guessing', () => {
    expect(() => parseKitResult('')).toThrow(/nothing/);
    expect(() => parseKitResult('What if: x\nnot json')).toThrow(/not one JSON document/);
    expect(() => parseKitResult('[1,2]')).toThrow(/not a JSON object/);
  });

  it('normalizes single values into arrays the way PowerShell sometimes emits them', () => {
    const loose = { ...handle({ operation: 'status' }).result, Warnings: 'one warning', Changes: { Kind: 'File', Target: 'x', Detail: '' } };
    const parsed = parseKitResult(JSON.stringify(loose));
    expect(parsed.Warnings).toEqual(['one warning']);
    expect(parsed.Changes).toHaveLength(1);
  });

  it('pins the major version and accepts every 1.x', () => {
    expect(apiMajor('1.0')).toBe(SUPPORTED_API_MAJOR);
    expect(apiMajor('1.9')).toBe(SUPPORTED_API_MAJOR);
    expect(apiMajor('2.0')).toBe(2);
    expect(apiMajor('')).toBe(-1);
    expect(apiMajor(undefined)).toBe(-1);
  });

  it('reads the kit version out of the result, and stays quiet about a kit that has none', () => {
    // ApiVersion 1.1 added KitVersion. An older kit is not a contract violation, it just does not know the field.
    const withVersion = parseKitResult(JSON.stringify(handle({ operation: 'status' }).result));
    expect(withVersion.KitVersion).toBe('0.4.0');

    const before = { ...handle({ operation: 'status' }).result } as Record<string, unknown>;
    delete before.KitVersion;
    const older = parseKitResult(JSON.stringify(before));
    expect(older.KitVersion).toBe('');
    expect(older.ApiVersion).toBe('1.3');
  });

  it('never puts -Apply or -Approved where a parameter could sit', () => {
    // The kit refuses those names as parameters since 1.1. The harness does not offer them either, whatever a
    // catalog claims — a model must not be able to spell permission.
    const schema = schemaForParameters([
      { Name: 'Path', Type: 'String', Mandatory: true },
      { Name: 'Apply', Type: 'switch', Mandatory: false },
      { Name: 'approved', Type: 'switch', Mandatory: true },
    ]);
    expect(Object.keys(schema.properties)).toEqual(['Path']);
    expect(schema.required).toEqual(['Path']);
  });

  it('the fake kit refuses Apply as a parameter, in any spelling', () => {
    // API.md since 1.1: the switch names of the API are never step parameters. A refusal is `Failed` with exit 2 —
    // there is no "Refused" status, that is the exit code's job.
    for (const name of ['Apply', 'apply', 'APPROVED']) {
      const { result, exitCode } = handle({ operation: 'components', parameters: { [name]: true } });
      expect(result.Success, name).toBe(false);
      expect(exitCode, name).toBe(2);
      expect(result.Errors.join(' ')).toMatch(/Unknown parameter or not allowed/);
    }
  });
});

describe('the argument vector (API.md §2)', () => {
  it('is exactly the documented call', () => {
    const request: KitRequest = { operation: 'backup.restore', parameters: { Path: 'C:\\RetroBat\\a.cfg.bak_x' }, apply: true, approved: true, anonymize: true, culture: 'de-DE' };
    const argv = buildKitArgv('D:\\cabinet\\frieds-retrogaming-kit', request);
    expect(argv.slice(0, 6)).toEqual(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', kitApiScript('D:\\cabinet\\frieds-retrogaming-kit'), '-Operation']);
    expect(argv[6]).toBe('backup.restore');
    expect(argv).toContain('-Apply');
    expect(argv).toContain('-Approved');
    expect(argv).toContain('-Anonymize');
    expect(argv).toContain('-Culture');
    expect(argv[argv.indexOf('-ParametersJson') + 1]).toBe('{"Path":"C:\\\\RetroBat\\\\a.cfg.bak_x"}');
  });

  it('omits -ParametersJson when there is nothing to pass, and never omits -Operation', () => {
    const argv = buildKitArgv('D:\\kit', { operation: 'status' });
    expect(argv).not.toContain('-ParametersJson');
    expect(argv).toContain('status');
  });

  it('uses the full Windows PowerShell 5.1 path, like the kit’s own launchers', () => {
    expect(windowsPowerShellPath({ SystemRoot: 'C:\\WINDOWS' } as NodeJS.ProcessEnv)).toBe('C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(windowsPowerShellPath({} as NodeJS.ProcessEnv)).toMatch(/^C:\\Windows\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/);
  });
});

describe('the catalog, and only the catalog, decides what is a tool', () => {
  it('the pinned snapshot matches the shape the fake kit reports', () => {
    const snapshotNames = (snapshot.Operations as Array<{ Name: string }>).map((op) => op.Name);
    const fakeNames = fakeCatalog().map((op) => op.Name);
    // The snapshot is the real kit; the fake is a subset. Everything the fake claims must exist in the real one.
    for (const name of fakeNames) expect(snapshotNames).toContain(name);
    expect(snapshotNames).toContain('step.pinball.05-relocate');
    // PinballY came with 1.2 and 1.3 and is answered by the fake, so the subset is no longer missing it.
    expect(fakeNames).toContain('pinbally.detect');
    expect(fakeNames).toContain('pinbally.retarget');
    expect(snapshot.ApiVersion).toBe('1.3');
    // The fake answers as the kit version the snapshot was taken from. If this fails, one of the two was edited alone.
    expect((snapshot.Source as { kitVersion: string }).kitVersion).toBe(KIT_VERSION);
  });

  it('every operation the fake offers has the real kind, availability and parameters', () => {
    // A fake that answers with other parameters than the kit would let a test pass that fails on the cabinet.
    type Spec = { Name: string; Kind: string; Interactive: boolean; Available: boolean; Parameters: Array<{ Name: string; Type: string; Mandatory: boolean }> };
    const shape = (op: Spec) => ({
      Kind: op.Kind,
      Interactive: op.Interactive,
      Available: op.Available,
      Parameters: op.Parameters.map((p) => `${p.Name}:${p.Type}${p.Mandatory ? '*' : ''}`).sort(),
    });
    const real = new Map((snapshot.Operations as Spec[]).map((op) => [op.Name, op]));
    for (const op of fakeCatalog()) {
      const pinned = real.get(op.Name);
      expect(pinned, op.Name).toBeDefined();
      expect(shape(op), op.Name).toEqual(shape(pinned!));
    }
  });

  it('the snapshot never exposes a denied parameter or a non-plain type', () => {
    const denied = new Set(['Approve', 'StatePath', 'Culture', 'KitUserSid', 'TrustedOwner', 'TaskPrefix', 'AutomationDir', 'LayersKey', 'RegistryRoots', 'AppCompatRoots', 'AnswerFile', 'WhatIf', 'Confirm', 'Devices', 'Monitors', 'Tasks', 'XInputReader']);
    const allowedTypes = /^(String|String\[\]|Int32|Int64|Boolean|switch)$/;
    for (const operation of snapshot.Operations as Array<{ Parameters: Array<{ Name: string; Type: string }> }>) {
      for (const parameter of operation.Parameters) {
        expect(denied.has(parameter.Name), parameter.Name).toBe(false);
        expect(parameter.Type).toMatch(allowedTypes);
      }
    }
  });

  it('interactive steps are not offered, unavailable ones are', async () => {
    const harness = await makeHarness();
    expect(runnableSteps(harness.catalog).some((step) => step.Interactive)).toBe(false);
    const interactive = harness.catalog.filter((op) => op.Interactive).map((op) => op.Name);
    expect(interactive).toEqual(['step.lightgun.09-verify', 'step.pinball.08-screens']);
    const tools = buildTools(harness.catalog);
    const runStep = tools.find((tool) => tool.name === 'run_step');
    for (const name of interactive) expect(runStep?.operations).not.toContain(name);
    await harness.cleanup();
  });

  it('a tool schema is built from the catalog types and rejects parameters the kit does not know', () => {
    const restore = fakeCatalog().find((op) => op.Name === 'backup.restore')!;
    const schema = schemaForParameters(restore.Parameters);
    expect(schema.properties.Path).toEqual({ type: 'string' });
    expect(schema.properties.AllowedRoot).toEqual({ type: 'array', items: { type: 'string' } });
    expect(schema.required).toEqual(['Path']);

    expect(validateParameters(restore, { Path: 'x' })).toEqual([]);
    expect(validateParameters(restore, {})).toEqual(['missing parameter: Path']);
    expect(validateParameters(restore, { Path: 'x', KitUserSid: 'S-1-5-18' })).toEqual(['unknown parameter: KitUserSid']);
  });

  it('read-only keeps only the read tools', () => {
    const tools = buildTools(fakeCatalog());
    const reads = filterReadTools(tools);
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((tool) => tool.kind === 'Read')).toBe(true);
    expect(reads.some((tool) => tool.name === 'run_step')).toBe(false);
  });
});
