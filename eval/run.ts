/**
 * The scenario runner: a scenario and a model in, a verdict out.
 *
 * It always runs against the fake cabinet (`test/kit/`), never against a real machine — an eval that could change a
 * cabinet is not an eval. With the ideal script it checks the exact call sequence; with a real model it checks the
 * gate invariants, which a model may satisfy by any route it likes.
 *
 * Run directly:  node --no-warnings eval/run.ts --model llama3.2:3b
 * In CI:         test/scenarios.test.ts (ideal scripts only, offline)
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentLoop } from '../src/agent/loop.ts';
import { KitClient } from '../src/kit/client.ts';
import { buildTools, filterReadTools } from '../src/kit/tools.ts';
import { Store } from '../src/db/store.ts';
import { PolicyEngine } from '../src/policy/engine.ts';
import { ScriptedHumanGateway } from '../src/policy/human.ts';
import { ScriptedModelGateway } from '../src/llm/scripted-model.ts';
import { OpenAiCompatibleGateway } from '../src/llm/openai-compatible.ts';
import type { ModelGateway } from '../src/llm/gateway.ts';
import { FakeKitTransport } from '../test/kit/fake-kit-transport.ts';
import { callTrace } from '../test/helpers.ts';
import { BEHAVIOUR_CHECKS, GATE_INVARIANTS, SCENARIOS, type GateContext, type Scenario } from './scenarios.ts';

export interface ScenarioResult {
  scenario: string;
  model: string;
  /** True when no gate rule broke and, if asked, when the trace matched exactly. */
  ok: boolean;
  /** Broken gate rules. With a real model, these are harness bugs. */
  gate: string[];
  /** What a good run would have done differently. A small model may fail these honestly. */
  behaviour: string[];
  trace: string[];
  answer: string;
  rounds: number;
}

export interface RunOptions {
  scenario: Scenario;
  gateway: ModelGateway;
  /** Check the exact sequence. Only meaningful for the ideal script; a real model may take another route. */
  expectExactTrace?: boolean;
  maxRounds?: number;
}

export async function runScenario(options: RunOptions): Promise<ScenarioResult> {
  const { scenario, gateway } = options;
  const directory = mkdtempSync(join(tmpdir(), 'fagent-eval-'));

  try {
    const transport = new FakeKitTransport({ state: { ...scenario.state } });
    const client = new KitClient(transport);
    const catalog = await client.catalog({ anonymize: false });
    const allTools = buildTools(catalog);
    const tools = scenario.level === 'read-only' ? filterReadTools(allTools) : allTools;

    const store = Store.open(join(directory, 'eval.db'));
    const session = store.startSession({ permissionLevel: scenario.level, model: gateway.info.model, provider: gateway.info.provider });
    const human = new ScriptedHumanGateway(scenario.answers);
    const engine = new PolicyEngine({
      client, store, sessionId: session.id, level: scenario.level, human, anonymize: false, tools: allTools,
    });

    const loop = new AgentLoop({
      gateway,
      engine,
      tools,
      store,
      sessionId: session.id,
      culture: 'en-US',
      maxRounds: options.maxRounds ?? 8,
      memory: false,
    });

    const run = await loop.ask(scenario.prompt);
    const trace = callTrace(transport.calls);
    const context: GateContext = {
      trace,
      calls: transport.calls,
      plansShown: human.seen.length,
      // The scripted person answered in order; only the answers actually reached count as yeses.
      yeses: scenario.answers.slice(0, human.seen.length).filter(Boolean).length,
      scenario,
      answer: run.answer,
      knownOperations: catalog.map((entry) => entry.Name),
    };

    const gate: string[] = [];
    const behaviour: string[] = [];
    for (const rule of [...GATE_INVARIANTS, ...BEHAVIOUR_CHECKS]) {
      const violation = rule.check(context);
      if (!violation) continue;
      (rule.level === 'gate' ? gate : behaviour).push(`${rule.id}: ${violation} (${rule.description})`);
    }

    if (options.expectExactTrace) {
      const expected = scenario.expectedTrace.join(' → ');
      const actual = trace.join(' → ');
      if (expected !== actual) gate.push(`trace: expected [${expected}], got [${actual}]`);
    }
    if (run.rounds >= (options.maxRounds ?? 8) && !run.answer) behaviour.push('rounds: the loop ended without an answer');

    store.close();
    return { scenario: scenario.id, model: gateway.info.model, ok: gate.length === 0, gate, behaviour, trace, answer: run.answer, rounds: run.rounds };
  } finally {
    removeQuietly(directory);
  }
}

function removeQuietly(directory: string): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      rmSync(directory, { recursive: true, force: true });
      return;
    } catch {
      // best effort: Windows may still hold the database handle
    }
  }
}

export function idealModel(scenario: Scenario): ModelGateway {
  return new ScriptedModelGateway(scenario.ideal, { model: 'ideal-script' });
}

export function realModel(model: string, baseUrl?: string): ModelGateway {
  return new OpenAiCompatibleGateway({
    baseUrl: baseUrl ?? process.env.FAGENT_OLLAMA_URL ?? 'http://127.0.0.1:11434/v1',
    model,
    provider: 'local',
  });
}

export interface Report {
  results: ScenarioResult[];
  ok: boolean;
}

export async function runAll(gatewayFor: (scenario: Scenario) => ModelGateway, expectExactTrace: boolean): Promise<Report> {
  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario({ scenario, gateway: gatewayFor(scenario), expectExactTrace }));
  }
  return { results, ok: results.every((result) => result.ok) };
}

/** `node --no-warnings eval/run.ts [--model llama3.2:3b] [--only gun]` — the report a person reads. */
async function main(argv: string[]): Promise<number> {
  const model = value(argv, '--model') ?? process.env.FAGENT_EVAL_MODEL;
  const only = value(argv, '--only');
  const scenarios = only ? SCENARIOS.filter((scenario) => scenario.id.includes(only)) : SCENARIOS;

  if (scenarios.length === 0) {
    console.error(`no scenario matches "${only}". known: ${SCENARIOS.map((scenario) => scenario.id).join(', ')}`);
    return 2;
  }

  if (!model) {
    console.log('ideal scripts only. Set --model or FAGENT_EVAL_MODEL to run the same scenarios against a real local model.\n');
  }

  let gateBroken = false;
  let solved = 0;
  for (const scenario of scenarios) {
    const gateway = model ? realModel(model) : idealModel(scenario);
    const result = await runScenario({ scenario, gateway, expectExactTrace: !model, ...(model ? { maxRounds: 12 } : {}) });
    gateBroken ||= result.gate.length > 0;
    if (result.behaviour.length === 0) solved += 1;

    console.log(`${result.gate.length > 0 ? 'GATE FAIL' : result.behaviour.length === 0 ? 'pass' : 'model gap'}  ${result.scenario}  (${result.model}, ${result.rounds} rounds)`);
    console.log(`      trace: ${result.trace.join(' → ')}`);
    for (const problem of result.gate) console.log(`      gate: ${problem}`);
    for (const problem of result.behaviour) console.log(`      behaviour: ${problem}`);
    if (result.gate.length > 0) console.log(`      said: ${result.answer.slice(0, 300).replace(/\s+/g, ' ')}`);
  }
  console.log(`\n${scenarios.length} scenario(s): ${solved} met the ideal route, ${gateBroken ? 'at least one broke a gate rule' : 'no gate rule was broken'}`);
  return gateBroken ? 1 : 0;
}

function value(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
