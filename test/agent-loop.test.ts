/**
 * The loop: a model that asks for tools, the gate in between, and the audit trail that comes out.
 *
 * The scripted model plays both parts a real model has to play: it reads, it proposes a change, and it gets the
 * refusal or the plan answer back. The point of these tests is that the model never finds a shortcut.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { AgentLoop } from '../src/agent/loop.ts';
import { systemPrompt } from '../src/agent/prompt.ts';
import { loadConfig } from '../src/config.ts';
import { cleanupAll, makeHarness, makeModel } from './helpers.ts';
import { FAKE_PERSON } from './kit/fake-kit.mjs';

afterEach(cleanupAll);

function buildLoop(harness: Awaited<ReturnType<typeof makeHarness>>, model: ReturnType<typeof makeModel>) {
  return new AgentLoop({
    gateway: model,
    engine: harness.engine,
    tools: harness.tools,
    store: harness.store,
    sessionId: harness.sessionId,
    culture: 'en-US',
    apiVersion: '1.0',
    kitVersion: null,
  });
}

describe('the agent loop', () => {
  it('runs read → answer and logs both messages', async () => {
    const harness = await makeHarness();
    const model = makeModel([{ call: { name: 'cabinet_status' } }, { text: 'ViGEmBus is missing.' }]);
    const run = await buildLoop(harness, model).ask('my gun does not work');

    expect(run.answer).toBe('ViGEmBus is missing.');
    expect(run.toolCalls).toBe(1);
    const messages = harness.store.messages(harness.sessionId).map((m) => String(m.role));
    expect(messages).toEqual(['system', 'user', 'assistant', 'tool', 'assistant']);
    await harness.cleanup();
  });

  it('a change through the loop still goes past the human', async () => {
    const harness = await makeHarness({ answers: [true] });
    const model = makeModel([
      { call: { name: 'run_step', arguments: { operation: 'step.lightgun.03-vigembus' } } },
      { text: 'Installed and verified.' },
    ]);
    const run = await buildLoop(harness, model).ask('fix the gun');

    expect(run.toolCalls).toBe(1);
    expect(harness.human.seen).toHaveLength(1);
    expect(harness.transport.appliedOperations()).toEqual(['step.lightgun.03-vigembus']);
    await harness.cleanup();
  });

  it('a tool call for something that is not in the catalog is answered, not fatal', async () => {
    const harness = await makeHarness();
    const model = makeModel([
      { call: { name: 'run_step', arguments: { operation: 'step.lightgun.99-magic' } } },
      { text: 'That operation does not exist.' },
    ]);
    const run = await buildLoop(harness, model).ask('do magic');
    expect(run.refused).toBe(1);
    expect(run.answer).toBe('That operation does not exist.');
    expect(harness.transport.appliedOperations()).toEqual([]);
    await harness.cleanup();
  });

  it('stops at the round limit instead of looping forever', async () => {
    const harness = await makeHarness();
    const model = makeModel(Array.from({ length: 12 }, () => ({ call: { name: 'cabinet_status' } })));
    const loop = new AgentLoop({
      gateway: model, engine: harness.engine, tools: harness.tools, store: harness.store, sessionId: harness.sessionId,
      culture: 'en-US', maxRounds: 3,
    });
    const run = await loop.ask('loop');
    expect(run.rounds).toBe(3);
    await harness.cleanup();
  });

  it('every prompt the model sees is answer-only or anonymized when the session demands it', async () => {
    const harness = await makeHarness({ anonymize: true });
    const model = makeModel([{ call: { name: 'cabinet_components' } }, { call: { name: 'cabinet_status' } }, { text: 'done' }]);
    await buildLoop(harness, model).ask('what is installed');

    expect(model.prompts).toHaveLength(3);
    const serialized = JSON.stringify(model.prompts);
    expect(serialized).not.toContain(FAKE_PERSON.computer);
    expect(serialized).not.toContain(FAKE_PERSON.profile);
    await harness.cleanup();
  });

  it('the prompt tells the model where the apply flag is, and that it does not own it', () => {
    const text = systemPrompt({ model: { provider: 'cloud', baseUrl: 'https://x', model: 'm', anonymizeRequired: true }, level: 'operator', culture: 'en-US', apiVersion: '1.0', kitVersion: null });
    expect(text).toMatch(/never see or set "apply" or "approved"/i);
    expect(text).toMatch(/interactive/i);
    expect(text).toMatch(/anonymized/);
    expect(text).not.toMatch(/--yes/);
  });
});

describe('config', () => {
  it('refuses to start without a kit root and defaults to read-only, local and anonymized', () => {
    expect(() => loadConfig({}, {})).toThrow(/no kit root/);
    const config = loadConfig({ kitRoot: 'D:\\cabinet\\frieds-retrogaming-kit' }, { FAGENT_MODEL: 'qwen2.5:3b' });
    expect(config.level).toBe('read-only');
    expect(config.anonymize).toBe(true);
    expect(config.model.provider).toBe('local');
    expect(config.model.baseUrl).toBe('http://127.0.0.1:11434/v1');
  });

  it('forces -Anonymize for a cloud model even when someone asks not to', () => {
    const config = loadConfig({ kitRoot: 'D:\\kit', provider: 'cloud', model: 'someone', noAnonymize: true }, { FAGENT_CLOUD_API_KEY: 'x' });
    expect(config.anonymize).toBe(true);
    expect(config.model.provider).toBe('cloud');
  });

  it('only knows the two permission levels and the two cultures', () => {
    const env = { FAGENT_MODEL: 'qwen2.5:3b' };
    expect(() => loadConfig({ kitRoot: 'D:\\kit', level: 'admin' }, env)).toThrow(/--level must be/);
    expect(() => loadConfig({ kitRoot: 'D:\\kit', culture: 'fr-FR' }, env)).toThrow(/--culture must be/);
    expect(() => loadConfig({ kitRoot: 'D:\\kit', provider: 'carrier-pigeon' }, env)).toThrow(/must be local or cloud/);
  });
});
