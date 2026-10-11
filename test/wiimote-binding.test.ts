/**
 * Wiimote binding through the harness (kit ApiVersion 1.8).
 *
 * `controllers.wiimote_bind` saves which Wiimote is which player, by Bluetooth address. Its dry run names itself
 * with a `PlanId`; an apply that brings that id writes only the plan the person saw. What is tested here: the gate
 * order stays dry run → human → apply, the engine passes the id from its own dry run, no caller can set it, and the
 * addresses do not leave the PC when the session is anonymized.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanupAll, makeHarness, callTrace } from './helpers.ts';
import { FAKE_WIIMOTES, defaultState, handle } from './kit/fake-kit.mjs';

afterEach(cleanupAll);

const [first, second] = FAKE_WIIMOTES;
/** Swapped on purpose: the second Wiimote to connect is meant to be player 1. */
const BINDING = `${second.Mac}=1,${first.Mac}=2`;

describe('the fake kit answers controllers.wiimote_bind as API.md 1.8 says', () => {
  it('plans a chosen binding with a PlanId and refuses an apply whose plan is stale', () => {
    const state = defaultState();
    const plan = handle({ operation: 'controllers.wiimote_bind', parameters: { Binding: BINDING } }, { state }).result;
    expect(plan.Status).toBe('WhatIf');
    const planId = (plan.Data as { PlanId: string }).PlanId;
    expect(planId).toMatch(/^[0-9a-f]{64}$/);
    expect(state.wiimoteLedger).toBe('');

    const done = handle({ operation: 'controllers.wiimote_bind', parameters: { Binding: BINDING, PlanId: planId }, apply: true }, { state }).result;
    expect(done.Status).toBe('Done');
    // The same id again: the ledger it was made for is gone.
    const stale = handle({ operation: 'controllers.wiimote_bind', parameters: { Binding: `${first.Mac}=1`, PlanId: planId }, apply: true }, { state }).result;
    expect(stale.Status).toBe('Failed');
    expect(stale.Message).toMatch(/changed since this plan/);
  });

  it('refuses a player or a MAC named twice', () => {
    for (const bad of [`${first.Mac}=1,${second.Mac}=1`, `${first.Mac}=1,${first.Mac}=2`, 'nonsense']) {
      expect(handle({ operation: 'controllers.wiimote_bind', parameters: { Binding: bad } }).result.Status).toBe('Failed');
    }
  });
});

describe('the harness applies a Wiimote binding only with the kit plan id', () => {
  it('dry run, a yes, then the apply carrying the PlanId of that dry run; the order then reads Ok', async () => {
    const harness = await makeHarness({ answers: [true] });
    const answer = await harness.engine.handle({ tool: 'wiimote_bind', args: { Binding: BINDING } });
    expect(answer.stage).toBe('applied');
    expect(answer.ok).toBe(true);
    expect(callTrace(harness.requests).filter((c) => c.startsWith('controllers.'))).toEqual([
      'controllers.wiimote_bind',
      'controllers.wiimote_bind:apply',
    ]);
    const [dry, apply] = harness.requests.filter((r) => r.operation === 'controllers.wiimote_bind');
    expect(dry?.parameters?.PlanId).toBeUndefined();
    expect(apply?.parameters?.PlanId).toMatch(/^[0-9a-f]{64}$/);
    expect(apply?.parameters?.PlanId).toBe((answer.payload.data as { PlanId: string }).PlanId);

    const order = await harness.engine.handle({ tool: 'wiimote_order', args: {} });
    // Bound swapped against the connection order: the kit says so and names the order to switch them on in.
    expect((order.payload.data as { State: string }).State).toBe('Swapped');
    await harness.cleanup();
  });

  it('a no stops before the apply', async () => {
    const harness = await makeHarness({ answers: [false] });
    const answer = await harness.engine.handle({ tool: 'wiimote_bind', args: {} });
    expect(answer.stage).toBe('declined');
    expect(callTrace(harness.requests)).not.toContain('controllers.wiimote_bind:apply');
    await harness.cleanup();
  });

  it('nobody but the engine sets PlanId: not the model, not a person at the CLI, not the tool schema', async () => {
    const harness = await makeHarness({ answers: [true, true] });
    const tool = harness.tools.find((t) => t.name === 'wiimote_bind');
    expect(Object.keys((tool?.parameters as { properties: Record<string, unknown> }).properties)).toEqual(['Binding']);
    const byModel = await harness.engine.handle({ tool: 'wiimote_bind', args: { Binding: BINDING, PlanId: 'a'.repeat(64) } });
    expect(byModel.stage).toBe('refused');
    const byPerson = await harness.engine.runOperation('controllers.wiimote_bind', { planid: 'a'.repeat(64) });
    expect(byPerson.stage).toBe('refused');
    expect(harness.requests.some((r) => r.operation === 'controllers.wiimote_bind')).toBe(false);
    await harness.cleanup();
  });

  it('an anonymized session never sends a Bluetooth address on, but still binds the plan', async () => {
    const harness = await makeHarness({ answers: [true], anonymize: true });
    const answer = await harness.engine.handle({ tool: 'wiimote_bind', args: {} });
    expect(answer.stage).toBe('applied');
    const text = JSON.stringify(answer);
    for (const wiimote of FAKE_WIIMOTES) expect(text).not.toContain(wiimote.Mac);
    expect(text).toContain('<MAC>');
    await harness.cleanup();
  });
});
