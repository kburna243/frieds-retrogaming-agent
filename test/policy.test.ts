/**
 * The rules, one by one.
 *
 * acceptance.test.ts proves the gate holds end to end. This file pins each individual rule, so a failure says which
 * rule broke instead of which journey no longer works.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { formatPlanForHuman, buildPlanView } from '../src/policy/plan.ts';
import { NeverApprovesGateway } from '../src/policy/human.ts';
import { digestOf } from '../src/db/store.ts';
import type { OperationResult } from '../src/kit/types.ts';
import { cleanupAll, makeHarness, callTrace } from './helpers.ts';

afterEach(cleanupAll);

const change = { tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } };

describe('level', () => {
  it('read-only refuses a change without calling the kit at all', async () => {
    const harness = await makeHarness({ level: 'read-only' });
    const answer = await harness.engine.handle(change);
    expect(answer.stage).toBe('refused');
    expect(answer.payload.code).toBe('LEVEL_READ_ONLY');
    expect(callTrace(harness.requests)).toEqual(['operations']);
    await harness.cleanup();
  });

  it('read-only still allows every read', async () => {
    const harness = await makeHarness({ level: 'read-only' });
    const reads = harness.tools.filter((t) => t.kind === 'Read');
    expect(reads.length).toBeGreaterThanOrEqual(5);
    for (const tool of reads) {
      const answer = await harness.engine.handle({ tool: tool.name, args: tool.name === 'check_backup' ? { Path: 'C:\\RetroBat\\state.json.bak_x' } : {} });
      expect(answer.stage, tool.name).not.toBe('refused');
    }
    await harness.cleanup();
  });

  it('an interactive step is not offered at operator level either', async () => {
    const harness = await makeHarness({ level: 'operator' });
    const stepTool = harness.tools.find((tool) => tool.name === 'run_step');
    const operations = (stepTool?.parameters.properties?.operation as { enum?: string[] })?.enum ?? [];
    expect(operations).not.toContain('step.pinball.08-screens');
    expect(operations).not.toContain('step.lightgun.09-verify');
    await harness.cleanup();
  });
});

describe('the dry run', () => {
  it('is always the first call of a change, and never carries apply or approved', async () => {
    const harness = await makeHarness({ answers: [true] });
    await harness.engine.handle(change);
    const [catalog, dryRun, apply] = harness.requests.slice(-3);
    expect(catalog?.operation).toBe('operations');
    expect(dryRun?.operation).toBe('step.lightgun.03-vigembus');
    expect(dryRun?.apply).toBeFalsy();
    expect(dryRun?.approved).toBeFalsy();
    expect(apply?.apply).toBe(true);
    await harness.cleanup();
  });

  it('a kit that answers with no plan at all is not applied', async () => {
    const harness = await makeHarness({ answers: [true], state: { dryRunFails: true } });
    const answer = await harness.engine.handle(change);
    expect(answer.stage).toBe('refused');
    expect(answer.payload.code).toBe('DRY_RUN_NOT_SHOWNABLE');
    expect(harness.transport.appliedOperations()).toEqual([]);
    await harness.cleanup();
  });

  it('the human is asked after the dry run, and sees the dry run', async () => {
    const harness = await makeHarness({ answers: [true] });
    await harness.engine.handle(change);
    const seen = harness.human.seen[0];
    expect(harness.requests.filter((r) => r.operation === 'step.lightgun.03-vigembus' && !r.apply)).toHaveLength(1);
    expect(String(seen?.message)).toMatch(/ViGEmBus/);
    await harness.cleanup();
  });
});

describe('the human decision', () => {
  it('a no means nothing is applied and the plan records the refusal', async () => {
    const harness = await makeHarness({ answers: [false] });
    const answer = await harness.engine.handle(change);
    expect(answer.stage).toBe('declined');
    expect(harness.transport.appliedOperations()).toEqual([]);
    const plans = harness.store.plans(harness.sessionId);
    expect(plans[0]?.status).toBe('declined');
    await harness.cleanup();
  });

  it('a gateway that never approves is the same as a no', async () => {
    const harness = await makeHarness({ noHuman: true });
    const answer = await harness.engine.handle(change);
    expect(answer.stage).toBe('declined');
    expect(harness.transport.appliedOperations()).toEqual([]);
    await harness.cleanup();
  });

  it('every change asks again: the yes before is not the yes now', async () => {
    const harness = await makeHarness({ answers: [true, true] });
    await harness.engine.handle(change);
    await harness.engine.handle(change);
    expect(harness.human.seen).toHaveLength(2);
    expect(harness.store.approvals(harness.sessionId)).toHaveLength(2);
    await harness.cleanup();
  });

  it('the plan shown to the human carries the kit approval texts verbatim', async () => {
    const harness = await makeHarness({ answers: [true] });
    await harness.engine.handle(change);
    const text = formatPlanForHuman(harness.human.seen[0]!);
    expect(text).toMatch(/THIS NEEDS YOUR EXPLICIT OKAY/i);
    expect(text).toMatch(/verbatim from the kit/i);
    const plan = harness.human.seen[0]!;
    expect(plan!.approvals.length).toBeGreaterThan(0);
    for (const approval of plan!.approvals) expect(text).toContain(approval);
    await harness.cleanup();
  });
});

describe('parameters', () => {
  it('an unknown parameter is refused before the kit is called', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({
      tool: 'run_step',
      args: { operation: 'step.lightgun.01-detect', parameters: { Nope: 'x' } },
    });
    expect(answer.payload.code).toBe('UNKNOWN_PARAMETER');
    expect(harness.requests.filter((r) => r.operation === 'step.lightgun.01-detect')).toHaveLength(0);
    await harness.cleanup();
  });

  it('a missing mandatory parameter is refused with the kit wording', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.01-detect' } });
    expect(answer.payload.code).toBe('MISSING_PARAMETER');
    expect(String(answer.payload.error)).toMatch(/missing parameter: RetroBatRoot/);
    await harness.cleanup();
  });

  it('a structured value is refused: the API takes plain values', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({
      tool: 'run_step',
      args: { operation: 'step.lightgun.01-detect', parameters: { RetroBatRoot: { nested: true } } },
    });
    expect(answer.payload.code).toBe('PARAM_NOT_PLAIN');
    await harness.cleanup();
  });

  it('a denied parameter never reaches the kit, whatever the catalog says', async () => {
    const harness = await makeHarness({ answers: [true] });
    for (const denied of ['StatePath', 'TrustedOwner', 'WhatIf', 'Confirm', 'RegistryRoots']) {
      const answer = await harness.engine.handle({
        tool: 'run_step',
        args: { operation: 'step.lightgun.01-detect', parameters: { RetroBatRoot: 'C:\\RetroBat', [denied]: 'x' } },
      });
      expect(answer.payload.code, denied).toBe('UNKNOWN_PARAMETER');
    }
    await harness.cleanup();
  });
});

describe('interactive steps', () => {
  it('refused with the wizard hint, and the kit is never asked', async () => {
    const harness = await makeHarness({ answers: [true] });
    for (const step of ['step.pinball.08-screens', 'step.lightgun.09-verify']) {
      const answer = await harness.engine.handle({ tool: 'run_step', args: { operation: step } });
      expect(answer.payload.code, step).toBe('INTERACTIVE_STEP');
      expect(String(answer.payload.hint), step).toMatch(/wizard/i);
    }
    expect(harness.requests.filter((r) => r.operation.includes('screens') || r.operation.includes('09-verify'))).toHaveLength(0);
    await harness.cleanup();
  });
});

describe('digests', () => {
  it('canonical JSON: key order and whitespace do not change a plan', () => {
    const a = digestOf({ operation: 'x', parameters: { b: 2, a: [1, 'z'] } });
    const b = digestOf({ parameters: { a: [1, 'z'], b: 2 }, operation: 'x' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('one character in a parameter makes a different digest', () => {
    const a = digestOf({ operation: 'x', parameters: { Path: 'C:\\RetroBat\\a.cfg' } });
    const b = digestOf({ operation: 'x', parameters: { Path: 'C:\\RetroBat\\b.cfg' } });
    expect(a).not.toBe(b);
  });

  it('a plan view carries both digests and the human sees the operation and parameters', () => {
    const dryRun: OperationResult = {
      ApiVersion: '1.0', Operation: 'step.x', Kind: 'Change', Success: true, Status: 'WhatIf', Applied: false,
      Message: 'would do', Warnings: [], Errors: [], Changes: [{ Kind: 'File', Target: 'a.cfg', Detail: '' }],
      Backups: [], Approvals: [], Duration: 0, StartedAt: 'now', Data: { Steps: [] },
    };
    const view = buildPlanView({
      planId: 'p', operation: 'step.x', parameters: { A: '1' }, paramsDigest: 'pd', planDigest: 'gd',
      dryRun, anonymized: true,
    });
    expect(view.paramsDigest).toBe('pd');
    expect(view.planDigest).toBe('gd');
    const text = formatPlanForHuman(view);
    expect(text).toContain('step.x');
    expect(text).toContain('A=1');
    expect(text).toMatch(/anonymized/);
  });
});

describe('verify after apply', () => {
  it('reads the status again once a change went through', async () => {
    const harness = await makeHarness({ answers: [true], verifyAfterApply: true });
    const answer = await harness.engine.handle(change);
    expect(answer.stage).toBe('applied');
    expect(callTrace(harness.requests).slice(-2)).toEqual(['step.lightgun.03-vigembus:apply+approved', 'status']);
    expect((answer.payload.verification as { status?: string }).status).toBe('Ok');
    await harness.cleanup();
  });

  it('does nothing extra when the change was declined', async () => {
    const harness = await makeHarness({ answers: [false], verifyAfterApply: true });
    await harness.engine.handle(change);
    expect(harness.requests.filter((r) => r.operation === 'status')).toHaveLength(0);
    await harness.cleanup();
  });
});
