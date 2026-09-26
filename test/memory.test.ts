/**
 * M1: memory that is read back, and that cannot be mistaken for an approval.
 *
 * Two sessions share one database, as two evenings at the same cabinet would. The second one must know what the
 * first one did — and must still go through dry run → plan → human for every change, whatever the first one was
 * told.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { AgentLoop } from '../src/agent/loop.ts';
import { buildMemoryDigest, MEMORY_HEADER } from '../src/agent/memory.ts';
import { findPersonalData } from '../src/llm/redact.ts';
import { callTrace, cleanupAll, makeHarness, makeModel } from './helpers.ts';
import { FAKE_PERSON } from './kit/fake-kit.mjs';

afterEach(cleanupAll);

type Fixture = Awaited<ReturnType<typeof makeHarness>>;

function loop(harness: Fixture, model: ReturnType<typeof makeModel>, memory?: boolean) {
  return new AgentLoop({
    gateway: model,
    engine: harness.engine,
    tools: harness.tools,
    store: harness.store,
    sessionId: harness.sessionId,
    culture: 'en-US',
    apiVersion: '1.0',
    ...(memory === undefined ? {} : { memory }),
  });
}

function systemText(model: ReturnType<typeof makeModel>): string {
  return String(model.prompts[0]?.messages[0]?.content ?? '');
}

/** Session one: read, fix the gun with a human yes, and have one call refused. */
async function firstEvening(): Promise<string> {
  const first = await makeHarness({ answers: [true] });
  const model = makeModel([
    { call: { name: 'cabinet_status' } },
    { call: { name: 'run_step', arguments: { operation: 'step.lightgun.03-vigembus' } } },
    { call: { name: 'run_step', arguments: { operation: 'step.lightgun.99-magic' } } },
    { text: 'ViGEmBus is installed.' },
  ]);
  await loop(first, model).ask('my gun does not work in game X');
  expect(callTrace(first.requests)).toContain('step.lightgun.03-vigembus:apply+approved');
  first.store.endSession(first.sessionId);
  first.store.close();
  return first.dbPath;
}

describe('memory (M1)', () => {
  it('a first session starts without a memory section', async () => {
    const harness = await makeHarness();
    const model = makeModel([{ text: 'hello' }]);
    await loop(harness, model).ask('hi');
    expect(systemText(model)).not.toContain('MEMORY');
    await harness.cleanup();
  });

  it('a second session sees what the first one did', async () => {
    const dbPath = await firstEvening();

    const second = await makeHarness({ dbPath });
    const model = makeModel([{ text: 'Last time ViGEmBus was installed.' }]);
    await loop(second, model).ask('what did we do last time?');

    const system = systemText(model);
    expect(system).toContain(MEMORY_HEADER);
    expect(system).toContain('read: status');
    expect(system).toContain('step.lightgun.03-vigembus: plan shown, the person said yes then, applied (kit: Done)');
    expect(system).toContain('refused: step.lightgun.99-magic (UNKNOWN_OPERATION)');
    // The memory is in the system prompt, not a transcript: none of the first evening's words are replayed.
    expect(system).not.toContain('my gun does not work in game X');
    expect(system).not.toContain('ViGEmBus is installed.');
    // One system message, not one message per remembered row.
    expect(model.prompts[0]?.messages.filter((m) => m.role === 'system')).toHaveLength(1);
    await second.cleanup();
  });

  it('a remembered approval grants nothing: the gate asks again and applies nothing on a no', async () => {
    const dbPath = await firstEvening();

    // Make it as tempting as possible: the old yes is for the very same plan digest and is put back to unspent.
    const second = await makeHarness({ dbPath, answers: [{ approved: false, said: 'no, not tonight' }] });
    second.store.execForTests("UPDATE approvals SET consumed_at = NULL WHERE decision = 'yes'");
    expect(second.store.approvals().filter((a) => a.decision === 'yes' && a.consumed_at === null)).toHaveLength(1);

    const model = makeModel([
      { call: { name: 'run_step', arguments: { operation: 'step.lightgun.03-vigembus' } } },
      { text: 'You declined, nothing was changed.' },
    ]);
    const run = await loop(second, model).ask('do what you did last time');

    expect(systemText(model)).toContain('the person said yes then');
    // The sequence is the proof: one dry run, no apply, and the human was asked.
    expect(callTrace(second.requests)).toEqual(['operations', 'step.lightgun.03-vigembus']);
    expect(second.transport.appliedOperations()).toEqual([]);
    expect(second.human.seen).toHaveLength(1);
    expect(run.answer).toBe('You declined, nothing was changed.');
    const plans = second.store.plans(second.sessionId);
    expect(plans.map((p) => p.status)).toEqual(['declined']);
    await second.cleanup();
  });

  it('memory can be switched off for a session', async () => {
    const dbPath = await firstEvening();
    const second = await makeHarness({ dbPath });
    const model = makeModel([{ text: 'fresh start' }]);
    await loop(second, model, false).ask('hi');
    expect(systemText(model)).not.toContain('MEMORY');
    await second.cleanup();
  });

  // Eight evenings of it, because the claim is about size and not about time. This is the slowest test in the
  // repository: ~0.6 s alone, ~1.6 s with the suite, and on the Windows CI runner it timed out at the 5 s default
  // twice (2026-09-26, runs 36219927511 and 36221260917; the Linux jobs passed the same minute). A budget for this
  // one test rather than a raised global timeout, so a test that genuinely hangs is still a fast failure.
  it('is fixed-size, however much history there is', async () => {
    let dbPath: string | undefined;
    for (let evening = 0; evening < 8; evening += 1) {
      const harness = await makeHarness({ ...(dbPath ? { dbPath } : {}), level: 'read-only' });
      const model = makeModel([
        ...Array.from({ length: 6 }, () => ({ call: { name: 'cabinet_status' } })),
        ...Array.from({ length: 6 }, (_, i) => ({ call: { name: 'run_step', arguments: { operation: `step.nope.${evening}-${i}` } } })),
        { text: 'done' },
      ]);
      await loop(harness, model, false).ask('again');
      dbPath = harness.dbPath;
      harness.store.close();
    }
    const last = await makeHarness({ dbPath: dbPath! });
    const digest = buildMemoryDigest(last.store, { currentSessionId: last.sessionId, anonymizeRequired: false, maxChars: 1200 });
    expect(digest).not.toBeNull();
    expect(digest!.length).toBeLessThanOrEqual(1200);
    // Five sessions at most, whatever the database holds.
    expect(digest!.split('\n').filter((line) => line.startsWith('- 2')).length).toBeLessThanOrEqual(5);
    await last.cleanup();
  }, 20_000);

  it('for a cloud model it only carries anonymized kit text and nothing that looks personal', async () => {
    const first = await makeHarness();
    // A local evening without -Anonymize: the kit's own words may carry real paths and names.
    first.store.recordToolCall({
      sessionId: first.sessionId, tool: 'cabinet_status', operation: 'status', kind: 'Read', parameters: {},
      apply: false, approved: false, anonymize: false, stage: 'read', status: 'Ok', exitCode: 0, duration: 0.1, argv: null,
      message: `doctor on ${FAKE_PERSON.computer} for ${FAKE_PERSON.profile}`, resultDigest: null, error: null,
    });
    first.store.recordToolCall({
      sessionId: first.sessionId, tool: 'run_step', operation: `${FAKE_PERSON.profile}\\evil`, kind: 'Refused', parameters: {},
      apply: false, approved: false, anonymize: false, stage: 'refused', status: 'Refused', exitCode: null, duration: null, argv: null,
      message: null, resultDigest: null, error: 'UNKNOWN_OPERATION: nope',
    });
    const dbPath = first.dbPath;
    first.store.close();

    const second = await makeHarness({ dbPath });
    const local = buildMemoryDigest(second.store, { currentSessionId: second.sessionId, anonymizeRequired: false });
    const cloud = buildMemoryDigest(second.store, { currentSessionId: second.sessionId, anonymizeRequired: true });

    // Locally the words stay useful; for the cloud they are left out.
    expect(local).toContain(FAKE_PERSON.computer);
    expect(cloud).not.toBeNull();
    expect(cloud).toContain('read: status');
    for (const value of [FAKE_PERSON.computer, FAKE_PERSON.profile, FAKE_PERSON.user]) expect(cloud).not.toContain(value);
    expect(findPersonalData(cloud!)).toEqual([]);
    await second.cleanup();
  });
});
