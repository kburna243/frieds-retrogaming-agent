/**
 * M3: the terminal. Streaming, a visible round budget, `chat --continue`, and `--json` that is one JSON document.
 *
 * None of it may move the gate: a streamed tool call reaches the engine only whole, a continued conversation carries
 * words and never approvals, and a JSON run still waits for a person before anything is applied.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OpenAiCompatibleGateway } from '../src/llm/openai-compatible.ts';
import { ScriptedModelGateway, type ScriptStep } from '../src/llm/scripted-model.ts';
import { ScriptedHumanGateway } from '../src/policy/human.ts';
import { AgentLoop, type AgentEvent } from '../src/agent/loop.ts';
import { resumeConversation } from '../src/agent/resume.ts';
import { Store } from '../src/db/store.ts';
import { main } from '../src/cli.ts';
import { createHarness } from '../src/harness.ts';
import { loadConfig } from '../src/config.ts';
import { FakeKitTransport } from './kit/fake-kit-transport.ts';
import { FAKE_PERSON } from './kit/fake-kit.mjs';
import { callTrace, captureOutput, cleanupAll, makeHarness } from './helpers.ts';

const directories: string[] = [];
afterEach(async () => {
  await cleanupAll();
  for (const directory of directories.splice(0)) {
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // best effort, as in test/helpers.ts
    }
  }
});

function dbPath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'fagent-ux-'));
  directories.push(directory);
  return join(directory, 'harness.db');
}

/** An SSE response cut at awkward places, the way a real socket delivers it. */
function sse(events: unknown[], cut = 7): Response {
  const text = `${events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')}data: [DONE]\n\n`;
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += cut) controller.enqueue(bytes.slice(i, i + cut));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

function gatewayWith(respond: (body: Record<string, unknown>) => Response, provider: 'local' | 'cloud' = 'local') {
  const bodies: Array<Record<string, unknown>> = [];
  const gateway = new OpenAiCompatibleGateway({
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'test-model',
    provider,
    fetchImpl: (async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      bodies.push(body);
      return respond(body);
    }) as unknown as typeof fetch,
  });
  return { gateway, bodies };
}

const cli = (db: string, ...args: string[]) => ['--kit', 'D:\\cabinet\\frieds-retrogaming-kit', '--db', db, '--model', 'scripted', ...args];

describe('streaming from an OpenAI-compatible endpoint', () => {
  it('passes text on as it arrives and assembles tool calls whole, even when cut mid-line', async () => {
    const { gateway, bodies } = gatewayWith(() =>
      sse([
        { choices: [{ delta: { content: 'Let me ' } }] },
        { choices: [{ delta: { content: 'look.' } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'run_step', arguments: '{"opera' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'tion":"step.lightgun.03-vigembus"}' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 1, id: 'c2', function: { name: 'cabinet_status', arguments: '{}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      ]),
    );
    const pieces: string[] = [];
    const completion = await gateway.complete({ messages: [{ role: 'user', content: 'hi' }], tools: [], onText: (d) => pieces.push(d) });

    expect(bodies[0]?.stream).toBe(true);
    expect(pieces).toEqual(['Let me ', 'look.']);
    expect(completion.streamed).toBe(true);
    expect(completion.message.content).toBe('Let me look.');
    expect(completion.message.toolCalls).toEqual([
      { id: 'c1', name: 'run_step', arguments: { operation: 'step.lightgun.03-vigembus' } },
      { id: 'c2', name: 'cabinet_status', arguments: {} },
    ]);
    expect(completion.finishReason).toBe('tool_calls');
  });

  it('asks for a stream only when someone listens, and reads a plain JSON answer from an endpoint that ignores it', async () => {
    const json = () => Response.json({ choices: [{ message: { content: 'plain' }, finish_reason: 'stop' }] });
    const { gateway, bodies } = gatewayWith(json);
    await gateway.complete({ messages: [{ role: 'user', content: 'a' }], tools: [] });
    expect(bodies[0]?.stream).toBeUndefined();

    const pieces: string[] = [];
    const answer = await gateway.complete({ messages: [{ role: 'user', content: 'b' }], tools: [], onText: (d) => pieces.push(d) });
    expect(bodies[1]?.stream).toBe(true);
    expect(answer.message.content).toBe('plain');
    expect(answer.streamed).toBeUndefined();
    expect(pieces).toEqual([]);
  });

  it('a cloud request that looks personal is refused before the socket opens, streaming or not', async () => {
    const { gateway, bodies } = gatewayWith(() => sse([]), 'cloud');
    await expect(
      gateway.complete({ messages: [{ role: 'user', content: `files in ${FAKE_PERSON.profile}` }], tools: [], onText: () => {} }),
    ).rejects.toThrow(/refusing to send/);
    expect(bodies).toEqual([]);
  });
});

describe('the loop with streaming and a round budget', () => {
  it('streams the text, marks it streamed, and the gate still gets the whole call', async () => {
    const harness = await makeHarness({ answers: [{ approved: false, said: 'no' }] });
    const model = new ScriptedModelGateway([
      { call: { name: 'run_step', arguments: { operation: 'step.lightgun.03-vigembus' } } },
      { text: 'You said no, so nothing changed.' },
    ]);
    const events: AgentEvent[] = [];
    const loop = new AgentLoop({
      gateway: model, engine: harness.engine, tools: harness.tools, store: harness.store, sessionId: harness.sessionId,
      culture: 'en-US', stream: true, maxRounds: 4, onEvent: (e) => events.push(e),
    });
    const run = await loop.ask('fix the gun');

    const text = events.filter((e): e is Extract<AgentEvent, { type: 'text' }> => e.type === 'text').map((e) => e.delta).join('');
    expect(text).toBe('You said no, so nothing changed.');
    expect(events.find((e) => e.type === 'assistant')).toMatchObject({ streamed: true });
    expect(events.filter((e) => e.type === 'round').map((e) => (e as { round: number }).round)).toEqual([1, 2]);
    expect(run.maxRounds).toBe(4);
    expect(callTrace(harness.requests)).toEqual(['operations', 'step.lightgun.03-vigembus']);
    await harness.cleanup();
  });
});

describe('fagent chat in the terminal', () => {
  it('prints the answer once, with the round budget on every tool call', async () => {
    const db = dbPath();
    const model = new ScriptedModelGateway([{ call: { name: 'cabinet_status' } }, { text: 'Everything reads fine.' }]);
    const result = await captureOutput(() => main(cli(db, 'chat', '--message', 'how is it?'), { transport: new FakeKitTransport(), gateway: model }));
    expect(result.code).toBe(0);
    expect(result.out.split('Everything reads fine.').length - 1).toBe(1);
    expect(result.out).toContain('→ [1/8] cabinet_status');
    expect(result.out).toContain('(2 of 8 rounds');
  });

  it('--max-rounds is visible when it stops, and a nonsense value is refused', async () => {
    const db = dbPath();
    const looping = new ScriptedModelGateway(Array.from({ length: 5 }, () => ({ call: { name: 'cabinet_status' } }) as ScriptStep));
    const stopped = await captureOutput(() => main(cli(db, 'chat', '--message', 'x', '--max-rounds', '2'), { transport: new FakeKitTransport(), gateway: looping }));
    expect(stopped.out).toContain('stopped after 2 of 2 rounds');
    const bad = await captureOutput(() => main(cli(db, 'chat', '--message', 'x', '--max-rounds', 'lots'), { transport: new FakeKitTransport(), gateway: looping }));
    expect(bad.code).toBe(2);
  });

  it('--json prints one document, and needs --message', async () => {
    const db = dbPath();
    const model = new ScriptedModelGateway([{ text: 'fine' }]);
    const result = await captureOutput(() => main(cli(db, 'chat', '--message', 'hi', '--json'), { transport: new FakeKitTransport(), gateway: model }));
    const parsed = JSON.parse(result.out) as { answer: string; maxRounds: number; continuedFrom: string | null };
    expect(parsed).toMatchObject({ answer: 'fine', maxRounds: 8, continuedFrom: null });
    const bad = await captureOutput(() => main(cli(db, 'chat', '--json'), { transport: new FakeKitTransport(), gateway: model }));
    expect(bad.code).toBe(2);
  });
});

describe('the chat talks to the configured model', () => {
  it('without an injected model the harness builds the OpenAI-compatible gateway from the config (fixed on the cabinet)', async () => {
    const config = loadConfig({ kitRoot: 'D:\\cabinet\\frieds-retrogaming-kit', db: dbPath(), model: 'llama3.2:3b' }, {});
    const harness = await createHarness(config, { transport: new FakeKitTransport() });
    expect(harness.gateway).toBeInstanceOf(OpenAiCompatibleGateway);
    expect(harness.gateway.info).toMatchObject({ provider: 'local', model: 'llama3.2:3b' });
    harness.close();
  });
});

describe('fagent chat --continue', () => {
  it('carries the words of the last conversation, and an old "yes" still grants nothing', async () => {
    const db = dbPath();
    const first = new ScriptedModelGateway([{ text: 'ViGEmBus is missing. Say yes and I will plan the install.' }]);
    await captureOutput(() => main(cli(db, 'chat', '--message', 'my gun does not work in game X'), { transport: new FakeKitTransport(), gateway: first }));

    const transport = new FakeKitTransport();
    const human = new ScriptedHumanGateway([{ approved: false, said: 'not tonight' }]);
    const second = new ScriptedModelGateway([
      { call: { name: 'run_step', arguments: { operation: 'step.lightgun.03-vigembus' } } },
      { text: 'You declined at the terminal, so nothing was installed.' },
    ]);
    const result = await captureOutput(() =>
      main(cli(db, 'chat', '--continue', '--level', 'operator', '--message', 'yes'), { transport, gateway: second, human }),
    );
    expect(result.code).toBe(0);
    expect(result.out).toContain('continuing session');

    // The scripted model keeps the live history; its first four entries are what the model saw on its first turn.
    const seen = (second.prompts[0]?.messages ?? []).slice(0, 4);
    expect(seen.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(seen[3]?.content).toBe('yes');
    expect(seen[1]?.content).toBe('my gun does not work in game X');
    expect(seen[2]?.content).toContain('Say yes');
    // The "yes" is a word in the conversation. The gate still asked, heard no, and applied nothing.
    expect(human.seen).toHaveLength(1);
    expect(callTrace(transport.calls)).toEqual(['operations', 'step.lightgun.03-vigembus']);

    const store = Store.open(db);
    const [latest] = store.recentSessions(1);
    expect(latest?.continued_from).toBeTruthy();
    store.close();
  });

  it('nothing to continue is said plainly', async () => {
    const result = await captureOutput(() =>
      main(cli(dbPath(), 'chat', '--continue', '--message', 'hi'), { transport: new FakeKitTransport(), gateway: new ScriptedModelGateway([{ text: 'x' }]) }),
    );
    expect(result.code).toBe(2);
    expect(result.err).toMatch(/no earlier conversation/);
  });

  it('a cloud model gets only what was recorded anonymized, and nothing that looks personal', async () => {
    const store = Store.open(dbPath());
    const local = store.startSession({ permissionLevel: 'read-only' });
    store.addMessage({ sessionId: local.id, role: 'user', content: `the tables are under ${FAKE_PERSON.profile}`, anonymized: false });
    store.addMessage({ sessionId: local.id, role: 'assistant', content: 'I see them.', anonymized: false });
    const cloud = store.startSession({ permissionLevel: 'read-only' });
    store.addMessage({ sessionId: cloud.id, role: 'user', content: 'and the gun?', anonymized: true });
    store.addMessage({ sessionId: cloud.id, role: 'assistant', content: `it belongs to ${FAKE_PERSON.email}`, anonymized: true });
    const current = store.startSession({ permissionLevel: 'read-only' });

    const fromLocal = resumeConversation(store, { currentSessionId: current.id, sessionId: local.id, anonymizeRequired: true });
    expect(fromLocal).toMatchObject({ messages: [], withheld: 2 });
    const fromCloud = resumeConversation(store, { currentSessionId: current.id, sessionId: cloud.id, anonymizeRequired: true });
    expect(fromCloud.messages).toEqual([{ role: 'user', content: 'and the gun?' }]);
    expect(fromCloud.withheld).toBe(1);
    // A local model may have its own words back.
    expect(resumeConversation(store, { currentSessionId: current.id, sessionId: local.id, anonymizeRequired: false }).messages).toHaveLength(2);
    store.close();
  });
});

describe('--json for every command', () => {
  it('each command prints exactly one JSON document on stdout', async () => {
    const db = dbPath();
    const transport = () => new FakeKitTransport();
    const runs: Array<[string, string[]]> = [
      ['version', ['version', '--json']],
      ['doctor', cli(db, 'doctor', '--json')],
      ['tools', cli(db, 'tools', '--json')],
      ['status', cli(db, 'status', '--json')],
      ['run (read)', cli(db, 'run', 'backups.list', '--json')],
      ['run (change, declined)', cli(db, 'run', 'support.bundle', '--level', 'operator', '--json')],
      ['history', cli(db, 'history', '--json')],
      ['report', cli(db, 'report', '--json')],
    ];
    for (const [name, argv] of runs) {
      const result = await captureOutput(() => main(argv, { transport: transport(), human: new ScriptedHumanGateway([false]) }));
      expect(() => JSON.parse(result.out), `${name}: ${result.out.slice(0, 120)}`).not.toThrow();
    }
  });
});
