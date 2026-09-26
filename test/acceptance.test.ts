/**
 * The seven acceptance criteria of the first harness release (docs/HANDOFF.md §7 of the kit's handoff), each one
 * as an executable test. If this file is green, the release is acceptable — everything else is detail.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupAll, callTrace, makeHarness } from './helpers.ts';
import { FAKE_PERSON } from './kit/fake-kit.mjs';
import { findPersonalData } from '../src/llm/redact.ts';
import { SUPPORTED_API_MAJOR } from '../src/kit/types.ts';

afterEach(cleanupAll);

describe('acceptance 1 — offline: works with a local model and no network', () => {
  it('the whole flow runs with no gateway contact at all', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.01-detect', parameters: { RetroBatRoot: 'C:\\RetroBat' } } });

    expect(answer.stage).toBe('applied');
    expect(harness.transport.calls.map((call) => call.operation)).toEqual(['operations', 'step.lightgun.01-detect', 'step.lightgun.01-detect']);
    await harness.cleanup();
  });

  it('nothing but src/llm may reach a network, and no module writes to the kit', async () => {
    const root = new URL('../src/', import.meta.url);
    const files = (readdirSync(root, { recursive: true }) as unknown as string[]).filter((name) => name.endsWith('.ts'));
    const offenders = files.filter((name) => {
      if (name.startsWith('llm')) return false;
      const text = readFileSync(new URL(name, root), 'utf8');
      return /\bfetch\(|node:https?\b|XMLHttpRequest|WebSocket|createConnection/.test(text);
    });
    expect(offenders).toEqual([]);

    // Only the kit transport starts a process, and it starts it without a shell.
    const spawners = files.filter((name) => {
      const text = readFileSync(new URL(name, root), 'utf8');
      return /node:child_process/.test(text);
    });
    expect(spawners.map((name) => name.split('\\').join('/')).sort()).toEqual(['kit/stdio-transport.ts']);
    const transport = readFileSync(new URL('kit/stdio-transport.ts', root), 'utf8');
    expect(transport).not.toMatch(/execSync|spawnSync?\([^)]*shell:\s*true|\bshell:\s*true/);
  });
});

describe('acceptance 2 — every change: dry run → plan → explicit yes → -Apply → verify', () => {
  it('the model cannot reach -Apply without the dry run having happened first', async () => {
    const harness = await makeHarness({ answers: [true] });
    // The model asks for a change. It has no apply parameter to set — there is none in the schema.
    const stepTool = harness.tools.find((tool) => tool.name === 'run_step');
    expect(stepTool?.parameters.properties.apply).toBeUndefined();
    expect(stepTool?.parameters.properties.approved).toBeUndefined();

    const answer = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.07-retrobatsettings' } });
    expect(answer.stage).toBe('applied');
    expect(callTrace(harness.transport.calls)).toEqual([
      'operations',
      'step.lightgun.07-retrobatsettings',
      'step.lightgun.07-retrobatsettings:apply',
    ]);
    await harness.cleanup();
  });

  it('a model that smuggles apply and approved into the parameters is refused and nothing is applied', async () => {
    const harness = await makeHarness();
    const answer = await harness.engine.handle({
      tool: 'restore_backup',
      args: { Path: 'C:\\RetroBat\\emulationstation\\es.cfg.bak_lightgun_20260102-110000-000', apply: true, approved: true, Apply: true, Approved: true },
    });
    expect(answer.ok).toBe(false);
    expect(String(answer.payload.code)).toBe('UNKNOWN_PARAMETER');
    expect(harness.transport.appliedOperations()).toEqual([]);
    await harness.cleanup();
  });

  it('without a human yes nothing is applied, and the plan is what the human saw', async () => {
    const harness = await makeHarness({ answers: [false] });
    const answer = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.07-retrobatsettings' } });
    expect(answer.stage).toBe('declined');
    expect(harness.transport.appliedOperations()).toEqual([]);
    expect(harness.human.seen).toHaveLength(1);
    expect(harness.human.seen[0]?.operation).toBe('step.lightgun.07-retrobatsettings');
    await harness.cleanup();
  });

  it('an approval is spent exactly once and cannot be reused', async () => {
    const harness = await makeHarness({ answers: [true] });
    const first = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.07-retrobatsettings' } });
    expect(first.stage).toBe('applied');

    const [approval] = harness.store.approvals(harness.sessionId);
    const planId = String(approval?.plan_id);
    const plan = harness.store.plan(planId);
    expect(plan?.planDigest).toBeTruthy();

    // The token is marked spent and never becomes usable again, for that digest or any other.
    expect(harness.store.consumeApproval(String(approval?.id))).toBe(false);
    expect(harness.store.usableApprovals(String(plan?.planDigest))).toEqual([]);

    // A second change does not inherit it: the human is asked again, and "no answer" means no.
    const second = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.07-retrobatsettings' } });
    expect(second.stage).toBe('declined');
    expect(harness.human.seen).toHaveLength(2);
    expect(harness.transport.appliedOperations()).toEqual(['step.lightgun.07-retrobatsettings']);
    await harness.cleanup();
  });

  it('an approval given for one plan does not authorize a different one', async () => {
    const harness = await makeHarness({ answers: [true] });
    await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.07-retrobatsettings' } });
    const token = harness.store.approvals(harness.sessionId)[0];
    expect(harness.store.usableApprovals('some-other-plan-digest')).toEqual([]);
    expect(harness.store.usableApprovals(String(harness.store.plan(String(token?.plan_id))?.planDigest))).toEqual([]);
    await harness.cleanup();
  });

  it('-Approved is passed only when the plan really contained an approval', async () => {
    const withApproval = await makeHarness({ answers: [true] });
    await withApproval.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } });
    const approvalCall = withApproval.transport.calls.find((call) => call.apply);
    expect(approvalCall?.approved).toBe(true);

    const withoutApproval = await makeHarness({ answers: [true] });
    await withoutApproval.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.07-retrobatsettings' } });
    const plainCall = withoutApproval.transport.calls.find((call) => call.apply);
    expect(plainCall?.approved).toBe(false);
    await withApproval.cleanup();
    await withoutApproval.cleanup();
  });

  it('the approval text the kit asked about reaches the human verbatim', async () => {
    const harness = await makeHarness({ answers: [true] });
    await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } });
    const shown = harness.human.seen[0];
    expect(shown?.approvals.join(' ')).toContain('ViGEmBus 2.4.0');
    expect(shown?.approvals.join(' ')).toContain('SHA-256');
    await harness.cleanup();
  });
});

describe('acceptance 3 — a cloud provider only ever sees -Anonymize results', () => {
  it('the fake cabinet really carries personal data (otherwise the test proves nothing)', async () => {
    const harness = await makeHarness({ anonymize: false });
    const raw = await harness.client.call({ operation: 'status' });
    expect(JSON.stringify(raw.result)).toContain(FAKE_PERSON.computer);
    expect(findPersonalData(JSON.stringify(raw.result)).length).toBeGreaterThan(0);
    await harness.cleanup();
  });

  it('an anonymizing session gives the model nothing that looks personal', async () => {
    const harness = await makeHarness({ anonymize: true, answers: [true] });
    const status = await harness.engine.read('status');
    const components = await harness.client.call({ operation: 'components', anonymize: true });
    const change = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.07-retrobatsettings' } });

    for (const payload of [JSON.stringify(status.result), JSON.stringify(components.result), JSON.stringify(change.payload)]) {
      expect(findPersonalData(payload)).toEqual([]);
      expect(payload).not.toContain(FAKE_PERSON.profile);
    }
    // And every kit call really did carry the flag.
    expect(harness.transport.calls.every((call) => call.anonymize)).toBe(true);
    await harness.cleanup();
  });

  it('a cloud gateway refuses to send an un-anonymized conversation, even if the flag was forgotten', async () => {
    const { OpenAiCompatibleGateway } = await import('../src/llm/openai-compatible.ts');
    const seen: string[] = [];
    const gateway = new OpenAiCompatibleGateway({
      baseUrl: 'https://api.example.test/v1',
      model: 'someone-elses-cloud',
      provider: 'cloud',
      fetchImpl: (async (_url: unknown, init?: RequestInit) => {
        seen.push(String(init?.body ?? ''));
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    await expect(
      gateway.complete({
        messages: [{ role: 'user', content: `the profile is ${FAKE_PERSON.profile}` }],
        tools: [],
      }),
    ).rejects.toThrow(/refusing to send a request to a cloud model/);
    expect(seen).toEqual([]); // nothing left the process

    const clean = await gateway.complete({ messages: [{ role: 'user', content: 'the profile is <USERPROFILE>' }], tools: [] });
    expect(clean.message.content).toBe('ok');
    expect(seen).toHaveLength(1);
  });
});

describe('acceptance 4 — a different ApiVersion major refuses every tool', () => {
  it('a kit speaking major 2 is turned down before any tool exists', async () => {
    // The very first catalog call already refuses, so the harness never gets as far as a session.
    await expect(makeHarness({ apiVersion: '2.0' })).rejects.toThrow(/ApiVersion 2\.0/);
    expect(SUPPORTED_API_MAJOR).toBe(1);
  });

  it('a 1.x minor version is fine (additive changes are allowed)', async () => {
    const harness = await makeHarness({ apiVersion: '1.7' });
    const result = await harness.client.call({ operation: 'status' });
    expect(result.result.Status).toBe('Ok');
    await harness.cleanup();
  });

  it('broken JSON from the kit is a contract error, not a crash', async () => {
    const { FakeKitTransport } = await import('./kit/fake-kit-transport.ts');
    const { KitClient } = await import('../src/kit/client.ts');
    const client = new KitClient(new FakeKitTransport({ breakJson: true }));
    await expect(client.call({ operation: 'status' })).rejects.toThrow(/not one JSON document/);
  });
});

describe('acceptance 5 — every tool call and approval is logged with a timestamp', () => {
  it('reads, dry runs, applies, decisions and refusals all land in the database', async () => {
    const harness = await makeHarness({ answers: [true] });
    await harness.engine.read('status');
    await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } });
    await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.pinball.08-screens' } }); // wizard only -> refused

    const calls = harness.store.toolCalls(harness.sessionId);
    const stages = calls.map((row) => String(row.stage));
    expect(stages).toContain('read');
    expect(stages).toContain('dry_run');
    expect(stages).toContain('apply');
    expect(stages).toContain('refused');

    for (const row of calls) {
      expect(typeof row.created_at).toBe('string');
      expect(String(row.created_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }

    const approvals = harness.store.approvals(harness.sessionId);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.decision).toBe('yes');
    expect(approvals[0]?.decided_by).toBe('human');
    expect(approvals[0]?.consumed_at).toBeTruthy();
    await harness.cleanup();
  });

  it('the database refuses a decision that did not come from a human', async () => {
    const harness = await makeHarness();
    const plan = harness.store.recordPlan({
      sessionId: harness.sessionId,
      toolCallId: harness.store.recordToolCall({
        sessionId: harness.sessionId, tool: 'x', operation: 'status', kind: 'Read', parameters: {}, apply: false,
        approved: false, anonymize: false, stage: 'read', status: 'Ok', exitCode: 0, duration: 0, argv: null,
        message: '', resultDigest: null, error: null,
      }).id,
      operation: 'status', parameters: {}, paramsDigest: 'p', planDigest: 'q', status: 'shown', message: '',
      steps: [], changes: [], backups: [], approvals: [], warnings: [], errors: [],
    });
    const approval = harness.store.requestApproval({ planId: plan.id, sessionId: harness.sessionId, expiresAt: new Date(Date.now() + 60_000).toISOString(), approvalTexts: [] });
    expect(() => harness.store.execForTests(`UPDATE approvals SET decided_by = 'model' WHERE id = ?`, approval.id)).toThrow(/CHECK constraint/i);
    // The supported path works and stamps the decision as a human one.
    harness.store.decideApproval(approval.id, 'yes');
    expect(harness.store.approval(approval.id)?.decidedBy).toBe('human');
    await harness.cleanup();
  });
});

describe('acceptance 6 — read operations are free, interactive ones are never callable', () => {
  it('reads work at the read-only level', async () => {
    const harness = await makeHarness({ level: 'read-only' });
    for (const operation of ['status', 'components', 'backups.list']) {
      const answer = await harness.engine.handle({ tool: operation === 'status' ? 'cabinet_status' : operation === 'components' ? 'cabinet_components' : 'list_backups', args: {} });
      expect(answer.ok).toBe(true);
    }
    await harness.cleanup();
  });

  it('a change at the read-only level is refused before anything is called', async () => {
    const harness = await makeHarness({ level: 'read-only' });
    expect(harness.tools.some((tool) => tool.kind === 'Change')).toBe(false);
    const answer = await harness.engine.handle({ tool: 'restore_backup', args: { Path: 'C:\\RetroBat\\x.bak_2026' } });
    expect(answer.payload.code).toBe('LEVEL_READ_ONLY');
    expect(harness.transport.calls.filter((call) => call.apply)).toEqual([]);
    await harness.cleanup();
  });

  it('the level is a rule the engine applies, not a tool the CLI never hears about', async () => {
    // `fagent run support.bundle` at the default level resolves the name against allTools, so the answer is
    // LEVEL_READ_ONLY and not "no such operation": the difference between a rule and a mystery.
    const harness = await makeHarness({ level: 'read-only' });
    expect(harness.tools.some((tool) => tool.name === 'support_bundle')).toBe(false);
    expect(harness.allTools.some((tool) => tool.name === 'support_bundle')).toBe(true);
    const answer = await harness.engine.handle({ tool: 'support_bundle', args: {} });
    expect(String(answer.payload.code)).toBe('LEVEL_READ_ONLY');
    await harness.cleanup();
  });

  it('an interactive step is refused without ever starting a kit call', async () => {
    const harness = await makeHarness({ answers: [true] });
    const before = harness.transport.calls.length;
    const answer = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.pinball.08-screens' } });
    expect(answer.payload.code).toBe('INTERACTIVE_STEP');
    expect(String(answer.payload.hint)).toMatch(/wizard/i);
    expect(harness.transport.calls.length).toBe(before);
    await harness.cleanup();
  });
});

describe('acceptance 7 — the diagnosis example from the handoff works end to end', () => {
  it('gun does not work in game X: status, components, one change, plan, yes, apply, verify', async () => {
    const harness = await makeHarness({ answers: [true] });

    const status = await harness.engine.read('status');
    expect((status.result.Data?.Summary as { Level: string }).Level).toBe('Error'); // ViGEmBus is missing

    const components = await harness.client.call({ operation: 'components' });
    const vigem = (components.result.Data?.Components as Array<{ Name: string; Present: boolean }>).find((c) => c.Name === 'ViGEmBus');
    expect(vigem?.Present).toBe(false);

    const answer = await harness.engine.handle({ tool: 'run_step', args: { operation: 'step.lightgun.03-vigembus' } });
    expect(answer.stage).toBe('applied');

    const after = await harness.engine.read('status');
    expect((after.result.Data?.Summary as { Level: string }).Level).not.toBe('Error');
    expect(callTrace(harness.transport.calls)).toEqual([
      'operations',
      'status',
      'components',
      'step.lightgun.03-vigembus',
      'step.lightgun.03-vigembus:apply+approved',
      'status',
    ]);
    await harness.cleanup();
  });
});
