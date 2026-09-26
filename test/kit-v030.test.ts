/**
 * Kit 0.3.0 against the gate: backup.remove, profile.export and profile.import, and the rule that a model reaches
 * only the operations its tools name.
 *
 * Every test asserts the sequence of kit calls, because the order is the product: nothing with -Apply unless a dry
 * run produced a plan and a person said yes to it.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { callTrace, cleanupAll, makeHarness } from './helpers.ts';

afterEach(cleanupAll);

const KIT_BACKUP = 'D:\\Pinball\\backups\\kit_20260101-100000-000.zip';
const PROFILE = 'E:\\Old Build\\cabinet-profile-lightgun_20260926.zip';

describe('a model reaches only the operations its tools name', () => {
  it('backup.remove and backup.export exist in the kit but are not offered, so run_step refuses them before any call', async () => {
    const harness = await makeHarness({ answers: [true, true] });
    for (const operation of ['backup.remove', 'backup.export']) {
      const answer = await harness.engine.handle({ tool: 'run_step', args: { operation, parameters: { Path: KIT_BACKUP, Destination: 'E:\\Old Build' } } });
      expect(answer.stage).toBe('refused');
      expect(answer.payload.code).toBe('NOT_OFFERED');
      expect(String(answer.payload.error)).toContain(`fagent run ${operation}`);
    }
    expect(callTrace(harness.requests)).toEqual(['operations']);
    expect(harness.human.seen).toHaveLength(0);
    await harness.cleanup();
  });

  it('no tool of the model maps to backup.remove', async () => {
    const harness = await makeHarness();
    expect(harness.allTools.some((tool) => tool.operations.includes('backup.remove'))).toBe(false);
    await harness.cleanup();
  });
});

describe('backup.remove through fagent run (a person typed the name)', () => {
  it('dry run → plan → yes → -Apply → verify, and the backup is gone from the list', async () => {
    const harness = await makeHarness({ answers: [true], verifyAfterApply: true });
    const answer = await harness.engine.runOperation('backup.remove', { Path: KIT_BACKUP });

    expect(answer.stage).toBe('applied');
    expect(harness.human.seen).toHaveLength(1);
    expect(harness.human.seen[0]?.message).toContain('would delete the backup');
    expect(callTrace(harness.requests)).toEqual(['operations', 'backup.remove', 'backup.remove:apply', 'status']);

    const list = await harness.engine.runOperation('backups.list');
    const paths = ((list.payload.data as { Backups: Array<{ Path: string }> }).Backups).map((b) => b.Path);
    expect(paths).not.toContain(KIT_BACKUP);
    await harness.cleanup();
  });

  it('a no leaves the backup where it is', async () => {
    const harness = await makeHarness({ answers: [{ approved: false, said: 'keep it' }] });
    const answer = await harness.engine.runOperation('backup.remove', { Path: KIT_BACKUP });
    expect(answer.stage).toBe('declined');
    expect(harness.transport.appliedOperations()).toEqual([]);
    await harness.cleanup();
  });

  it('a path that is not a kit backup gets no plan, so nobody is asked and nothing is deleted', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.runOperation('backup.remove', { Path: 'D:\\Pinball\\Tables\\Attack.vpx' });
    expect(answer.payload.code).toBe('DRY_RUN_NOT_SHOWNABLE');
    expect(harness.human.seen).toHaveLength(0);
    expect(callTrace(harness.requests)).toEqual(['operations', 'backup.remove']);
    await harness.cleanup();
  });

  it('at level read-only a change is refused even when a person typed it; a read is not', async () => {
    const harness = await makeHarness({ level: 'read-only', answers: [true] });
    const change = await harness.engine.runOperation('backup.remove', { Path: KIT_BACKUP });
    expect(change.payload.code).toBe('LEVEL_READ_ONLY');
    const read = await harness.engine.runOperation('backups.list');
    expect(read.stage).toBe('read');
    expect(callTrace(harness.requests)).toEqual(['operations', 'backups.list']);
    await harness.cleanup();
  });

  it('runOperation checks the parameters of a read against the catalog too', async () => {
    const harness = await makeHarness();
    const answer = await harness.engine.runOperation('backup.check', { Path: KIT_BACKUP, StatePath: 'C:\\RetroBat\\x' });
    expect(answer.payload.code).toBe('UNKNOWN_PARAMETER');
    expect(callTrace(harness.requests)).toEqual(['operations']);
    await harness.cleanup();
  });
});

describe('profile.export (no dry run of its own: the plan is the call)', () => {
  it('shows the call as the plan, applies only after yes', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'export_profile', args: { Suite: 'Lightgun', Destination: 'E:\\Old Build' } });
    expect(answer.stage).toBe('applied');
    expect(harness.human.seen[0]?.message).toContain('Export-KitCabinetProfile');
    expect(callTrace(harness.requests)).toEqual(['operations', 'profile.export', 'profile.export:apply']);
    expect(String(answer.payload.message)).toContain('cabinet-profile-lightgun');
    await harness.cleanup();
  });

  it('a suite the command does not know gets no plan', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'export_profile', args: { Suite: 'Everything', Destination: 'E:\\Old Build' } });
    expect(answer.payload.code).toBe('DRY_RUN_NOT_SHOWNABLE');
    expect(harness.human.seen).toHaveLength(0);
    await harness.cleanup();
  });
});

describe('profile.import (rows that need a person stop the plan)', () => {
  it('a missing driver without AutoInstall: no plan, the model gets the row, nobody is asked', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'import_profile', args: { Path: PROFILE } });
    expect(answer.payload.code).toBe('DRY_RUN_NOT_SHOWNABLE');
    expect(answer.payload.warnings).toEqual(['ViGEmBus: driver missing; install it in the lightgun wizard or import with AutoInstall']);
    expect(harness.human.seen).toHaveLength(0);
    expect(callTrace(harness.requests)).toEqual(['operations', 'profile.import']);
    await harness.cleanup();
  });

  it('with AutoInstall the installer question is in the plan, and -Approved goes only with the yes', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'import_profile', args: { Path: PROFILE, AutoInstall: true } });
    expect(answer.stage).toBe('applied');
    expect(harness.human.seen[0]?.approvals[0]).toContain('Install ViGEmBus 2.4.0');
    expect(callTrace(harness.requests)).toEqual(['operations', 'profile.import', 'profile.import:apply+approved']);
    await harness.cleanup();
  });

  it('with AutoInstall and a no, nothing is imported and nothing installed', async () => {
    const harness = await makeHarness({ answers: [{ approved: false, said: 'not now' }] });
    const answer = await harness.engine.handle({ tool: 'import_profile', args: { Path: PROFILE, AutoInstall: true } });
    expect(answer.stage).toBe('declined');
    expect(callTrace(harness.requests)).toEqual(['operations', 'profile.import']);
    expect(harness.transport.state.vigemInstalled).toBe(false);
    await harness.cleanup();
  });
});
