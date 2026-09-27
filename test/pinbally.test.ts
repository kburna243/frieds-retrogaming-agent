/**
 * PinballY through the harness (kit ApiVersion 1.2 and 1.3).
 *
 * Two operations, one picture: the read shows what a copied installation holds, the change gives its dead paths
 * the targets of this machine. What is tested here is that the harness treats them like every other read and
 * every other change — the same gate, the same refusal, no way around a person — and that the fake kit answers
 * the way `contract/API.md` says the kit does.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { buildTools } from '../src/kit/tools.ts';
import { cleanupAll, makeHarness, callTrace } from './helpers.ts';
import { PINBALLY_ROOT, handle, defaultState } from './kit/fake-kit.mjs';

afterEach(cleanupAll);

/** A map in the shape the kit asks for: pairs `Old=New`, both absolute. */
const MAP = [
  'C:\\Synthetic\\Pinball Arcade=D:\\Pinball\\Pinball Arcade',
  'C:\\Synthetic\\Scripts=D:\\Pinball\\Scripts',
  'C:\\Users\\Friedhelm\\Pinball Arcade=D:\\Pinball\\Pinball Arcade',
  // Its target does not exist on this synthetic machine: the row must stay a Warning, never a silent change.
  'C:\\Synthetic\\VPinMame=D:\\Pinball\\VPinMame',
];

const detectArgs = { Path: PINBALLY_ROOT };
const retargetArgs = { Path: PINBALLY_ROOT, Map: MAP };

/** `Data` is `Record<string, unknown> | null` in the fixture's own contract; a test naming a field means an answer that has one. */
function data(result: { Data: Record<string, unknown> | null }): Record<string, unknown> {
  expect(result.Data, 'the answer carries a Data object').not.toBeNull();
  return result.Data ?? {};
}

describe('pinbally.detect is a read', () => {
  it('describes the copied installation and puts the dead paths in Warnings', () => {
    const { result, exitCode } = handle({ operation: 'pinbally.detect', parameters: detectArgs });
    expect(result.Kind).toBe('Read');
    expect(result.Status).toBe('Ok');
    expect(result.Success).toBe(true);
    expect(result.Applied).toBe(false);
    expect(exitCode).toBe(0);
    // A read never asks for an approval, whatever it finds.
    expect(result.Approvals).toEqual([]);
    const foreign = data(result).ReferenceForeign as Array<{ Key: string; Status: string }>;
    expect(foreign.every((row) => row.Status === 'ForeignDrive')).toBe(true);
    expect(foreign.length).toBe(4);
    // Relative media that was never copied is Missing, not Foreign: no map can fix content.
    const missing = data(result).ReferenceMissing as Array<{ Kind: string }>;
    expect(missing.every((row) => row.Kind === 'relative')).toBe(true);
    expect(result.Warnings.length).toBe(foreign.length + missing.length);
  });

  it('names a folder that is not an installation instead of guessing one', () => {
    const { result, exitCode } = handle({ operation: 'pinbally.detect', parameters: { Path: 'D:\\Pinball\\somewhere-else' } });
    expect(result.Status).toBe('Failed');
    expect(result.Message).toMatch(/No PinballY installation/);
    expect(result.Success).toBe(false);
    expect(exitCode).toBe(1);
  });

  it('anonymizes the paths of the fake person inside the pinball answer', () => {
    const plain = JSON.stringify(handle({ operation: 'pinbally.detect', parameters: detectArgs }).result);
    expect(plain).toContain('Friedhelm');
    const anon = JSON.stringify(handle({ operation: 'pinbally.detect', parameters: detectArgs, anonymize: true }).result);
    expect(anon).not.toContain('Friedhelm');
    expect(anon).toContain('<USERPROFILE>');
  });

  it('is offered at the read-only level, and the retarget is not', async () => {
    const harness = await makeHarness({ level: 'read-only' });
    expect(harness.tools.some((tool) => tool.name === 'pinbally_detect')).toBe(true);
    expect(harness.tools.some((tool) => tool.name === 'pinbally_retarget')).toBe(false);
    const read = await harness.engine.handle({ tool: 'pinbally_detect', args: detectArgs });
    expect(read.stage).toBe('read');
    expect(read.ok).toBe(true);
    await harness.cleanup();
  });
});

describe('the retarget tool is shaped like every other change', () => {
  it('takes Path and Map, and Map is an array of strings', async () => {
    const harness = await makeHarness();
    const tool = harness.allTools.find((entry) => entry.name === 'pinbally_retarget');
    expect(tool?.kind).toBe('Change');
    expect(tool?.operations).toEqual(['pinbally.retarget']);
    expect(tool?.parameters.properties.Map).toEqual({ type: 'array', items: { type: 'string' } });
    expect(tool?.parameters.required).toEqual(['Path', 'Map']);
    expect(tool?.parameters.additionalProperties).toBe(false);
    await harness.cleanup();
  });

  it('offers no field that reads like permission', async () => {
    const harness = await makeHarness();
    const tool = harness.allTools.find((entry) => entry.name === 'pinbally_retarget');
    const names = Object.keys(tool?.parameters.properties ?? {}).map((name) => name.toLowerCase());
    expect(names).not.toContain('apply');
    expect(names).not.toContain('approved');
    // A model that tries to smuggle one is stopped by the schema the kit's own refusal mirrors.
    const answer = await harness.engine.handle({ tool: 'pinbally_retarget', args: { ...retargetArgs, Apply: true } as Record<string, unknown> });
    expect(answer.stage).toBe('refused');
    expect(callTrace(harness.requests)).toEqual(['operations']);
    await harness.cleanup();
  });
});

describe('pinbally.retarget goes through the gate', () => {
  it('dry run, plan, one yes for that plan, then -Apply with approved', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'pinbally_retarget', args: retargetArgs });
    expect(answer.stage).toBe('applied');
    expect(answer.ok).toBe(true);
    expect(callTrace(harness.requests)).toEqual(['operations', 'pinbally.retarget', 'pinbally.retarget:apply+approved']);

    // The human saw the plan, not a generic "may I change something".
    expect(harness.human.seen).toHaveLength(1);
    const shown = JSON.stringify(harness.human.seen[0]);
    expect(shown).toContain('Retarget plan');
    expect(shown).toContain('Settings.txt');
    expect(shown).toContain('pinemhi.ini');

    const payload = answer.payload as { changes: Array<{ Detail: string }> };
    expect(payload.changes).toHaveLength(4);
    expect(payload.changes.every((change) => /line \d+: .* -> .*/.test(change.Detail))).toBe(true);
    await harness.cleanup();
  });

  it('a person saying no means nothing is written', async () => {
    const harness = await makeHarness({ answers: [false] });
    const answer = await harness.engine.handle({ tool: 'pinbally_retarget', args: retargetArgs });
    expect(answer.stage).toBe('declined');
    expect(callTrace(harness.requests)).toEqual(['operations', 'pinbally.retarget']);
    expect(harness.requests.some((request) => request.apply)).toBe(false);
    await harness.cleanup();
  });

  it('read-only refuses before the kit is asked for a plan', async () => {
    const harness = await makeHarness({ level: 'read-only' });
    const answer = await harness.engine.handle({ tool: 'pinbally_retarget', args: retargetArgs });
    expect(answer.stage).toBe('refused');
    expect((answer.payload as { code: string }).code).toBe('LEVEL_READ_ONLY');
    expect(callTrace(harness.requests)).toEqual(['operations']);
    await harness.cleanup();
  });

  it('at the terminal the same gate holds, with no flag that means yes', async () => {
    const harness = await makeHarness({ answers: [true], verifyAfterApply: true });
    const answer = await harness.engine.runOperation('pinbally.retarget', { Path: PINBALLY_ROOT, Map: MAP });
    expect(answer.stage).toBe('applied');
    // The verify stage is the doctor; the pinball-specific check is pinbally.detect, which the model can call.
    expect(callTrace(harness.requests)).toEqual(['operations', 'pinbally.retarget', 'pinbally.retarget:apply+approved', 'status']);
    await harness.cleanup();
  });
});

describe('what the fake kit promises about the write', () => {
  it('answers a dry run with the plan, one approval per file, and nothing applied', () => {
    const { result, exitCode } = handle({ operation: 'pinbally.retarget', parameters: retargetArgs });
    expect(result.Status).toBe('WhatIf');
    expect(result.Success).toBe(true);
    expect(exitCode).toBe(0);
    expect(result.Applied).toBe(false);
    expect(result.Changes).toEqual([]);
    expect(result.Backups).toEqual([]);
    expect(result.Warnings).toEqual([]);
    // Two files hold dead values: the settings and the overlay INI, and each is named once for the yes.
    expect(result.Approvals).toHaveLength(2);
    expect(result.Approvals.join(' ')).toContain('Settings.txt');
    expect(result.Approvals.join(' ')).toContain('pinemhi.ini');
    expect((data(result).Ready as unknown[]).length).toBe(4);
    expect((data(result).Pending as unknown[]).length).toBe(0);
    expect((data(result).Plan as unknown[]).length).toBe(4);
  });

  it('plans nothing for a pair whose target does not exist here, and names it as a Warning', () => {
    const { result } = handle({
      operation: 'pinbally.retarget',
      parameters: { Path: PINBALLY_ROOT, Map: ['C:\\Synthetic\\VPinMame=D:\\Pinball\\no-such-folder'] },
    });
    const rows = data(result).Plan as Array<{ Key: string; Status: string; Reason: string; New: string }>;
    const row = rows.find((entry) => entry.Key === 'VP');
    expect(row?.Status).toBe('NoTarget');
    // What it WOULD become is named, so a person can create the folder and run again.
    expect(row?.New).toBe('');
    expect(row?.Reason).toMatch(/does not exist on this machine/);
    expect(result.Warnings.join(' ')).toMatch(/does not exist on this machine/);
    // The other three are unaffected by a pair that leads nowhere.
    expect(rows.filter((entry) => entry.Status === 'Ready').length).toBe(0);
  });

  it('does not write with -Apply alone: the plan needs the yes', () => {
    const { result, exitCode } = handle({ operation: 'pinbally.retarget', parameters: retargetArgs, apply: true });
    expect(result.Status).toBe('NeedsUser');
    expect(result.Success).toBe(false);
    expect(exitCode).toBe(1);
    expect(result.Changes).toEqual([]);
    expect(result.Approvals).toHaveLength(2);
  });

  it('leaves a value no pair covers as it is, and says which one', () => {
    const partial = ['C:\\Synthetic\\Scripts=D:\\Pinball\\Scripts'];
    const { result } = handle({ operation: 'pinbally.retarget', parameters: { Path: PINBALLY_ROOT, Map: partial } });
    const pending = data(result).Plan as Array<{ Key: string; Status: string }>;
    expect(pending.filter((row) => row.Status === 'NoMap').map((row) => row.Key).sort()).toEqual(['System10.Exe', 'System8.Exe', 'VP']);
    expect(pending.some((row) => row.Status === 'Ready')).toBe(true);
  });

  it('refuses a map that is not a pair of absolute paths', () => {
    for (const bad of [['C:\\Synthetic'], ['relative\\folder=D:\\Pinball\\x'], ['   '], []]) {
      const { result, exitCode } = handle({ operation: 'pinbally.retarget', parameters: { Path: PINBALLY_ROOT, Map: bad }, apply: true, approved: true });
      expect(result.Status, bad.join('|')).toBe('Failed');
      expect(result.Success).toBe(false);
      expect(exitCode).toBe(1);
    }
  });

  it('verifies itself: after the write the read shows fewer dead paths, and the second run answers Skipped', () => {
    // The fake keeps its cabinet in the second argument, exactly like the transport does: one state, several calls.
    const state = defaultState();
    const context = { state };
    const before = handle({ operation: 'pinbally.detect', parameters: detectArgs }, context);
    expect((data(before.result).ReferenceForeign as unknown[]).length).toBe(4);

    const applied = handle({ operation: 'pinbally.retarget', parameters: retargetArgs, apply: true, approved: true }, context);
    expect(applied.result.Status).toBe('Done');
    expect(applied.result.Backups).toHaveLength(1);
    expect(applied.result.Approvals).toEqual([]);

    const after = handle({ operation: 'pinbally.detect', parameters: detectArgs }, context);
    // Everything the map covered resolves now; the read is the measurement the write promised.
    expect((data(after.result).ReferenceForeign as unknown[]).length).toBe(0);

    const second = handle({ operation: 'pinbally.retarget', parameters: retargetArgs, apply: true, approved: true }, context);
    expect(second.result.Status).toBe('Skipped');
    expect(second.result.Success).toBe(true);
    expect(second.result.Changes).toEqual([]);
    expect(second.result.Backups).toEqual([]);
    expect(second.exitCode).toBe(0);
    // The relative media is still missing: a path operation cannot copy content that was never there.
    const still = (data(after.result).ReferenceMissing as unknown[]).length;
    expect(still).toBe(1);
  });

  it('maps a value at a path boundary and takes the more specific pair first', () => {
    const { result } = handle({
      operation: 'pinbally.retarget',
      parameters: {
        Path: PINBALLY_ROOT,
        Map: ['C:=D:', 'C:\\Synthetic\\Pinball Arcade=D:\\Pinball\\Pinball Arcade'],
      },
    });
    const rows = data(result).Plan as Array<{ Key: string; New: string }>;
    // The general pair alone would have moved the Arcade path to the drive root: the specific one wins.
    expect(rows.find((row) => row.Key === 'System8.Exe')?.New).toBe('D:\\Pinball\\Pinball Arcade\\TPA.exe');
  });
});
