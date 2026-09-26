#!/usr/bin/env node
/**
 * fagent — the command line of the harness.
 *
 * There is deliberately **no `--yes` and no `--approve` flag anywhere.** A change is confirmed by a person typing
 * at the terminal, and the only code path that can record that is `TerminalHumanGateway`. A scripted run stops at
 * the plan; that is the feature, not a limitation.
 */

import process from 'node:process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import type { HarnessConfig } from './config.ts';
import { loadConfig, ConfigError } from './config.ts';
import { createHarness } from './harness.ts';
import { TerminalHumanGateway } from './policy/human.ts';
import { ScriptedModelGateway, type ScriptStep } from './llm/scripted-model.ts';
import { AgentLoop } from './agent/loop.ts';
import { formatPlanForHuman } from './policy/plan.ts';
import { ApiVersionMismatchError, KitContractError } from './kit/client.ts';
import { PolicyError } from './policy/errors.ts';
import { Store } from './db/store.ts';
import { parseArgs, printHelp, fail, type Flags } from './cli/args.ts';

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const { command, flags, positional, params, switches, unknown } = parseArgs(argv);
  if (unknown.length > 0) {
    fail(unknown.join('\n'));
    return 2;
  }
  if (!command || command === 'help' || flags.help === 'true') {
    printHelp((text) => process.stdout.write(text));
    return 0;
  }

  let config: HarnessConfig;
  try {
    config = loadConfig({ ...configOptions(flags), requireModel: command === 'chat' });
  } catch (error) {
    if (error instanceof ConfigError) {
      fail(error.message);
      return 2;
    }
    throw error;
  }

  try {
    switch (command) {
      case 'doctor':
        return await runDoctor(config, flags.json === 'true');
      case 'tools':
        return await runTools(config, flags, flags.json === 'true');
      case 'status':
        return await runStatus(config, flags.json === 'true');
      case 'run':
        return await runChange(config, positional[0], flags, params, switches);
      case 'chat':
        return await runChat(config, flags);
      case 'history':
        return runHistory(config, flags);
      default:
        fail(`unknown command "${command}" — fagent help shows what there is`);
        return 2;
    }
  } catch (error) {
    return reportError(error);
  }
}

function configOptions(flags: Flags) {
  const options: Record<string, string | boolean> = {};
  if (flags.kit) options.kitRoot = flags.kit;
  if (flags.db) options.db = flags.db;
  if (flags.level) options.level = flags.level;
  if (flags.culture) options.culture = flags.culture;
  if (flags.model) options.model = flags.model;
  if (flags.provider) options.provider = flags.provider;
  if (flags['base-url']) options.baseUrl = flags['base-url'];
  if (flags['no-anonymize'] === 'true') options.noAnonymize = true;
  return options;
}

async function runDoctor(config: HarnessConfig, json: boolean): Promise<number> {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  const rows: Array<{ area: string; level: 'OK' | 'INFO' | 'WARN' | 'ERROR'; detail: string }> = [
    { area: 'node', level: major >= 24 ? 'OK' : 'ERROR', detail: `${process.version} (node:sqlite needs >= 24)` },
    {
      area: 'platform',
      level: process.platform === 'win32' ? 'OK' : 'INFO',
      detail: `${process.platform} — the kit is reached over Windows PowerShell 5.1, so real calls run on the cabinet`,
    },
    { area: 'kit root', level: config.kitRoot ? 'OK' : 'ERROR', detail: config.kitRoot },
    { area: 'database', level: 'OK', detail: config.dbPath },
    { area: 'model', level: 'OK', detail: `${config.model.provider} · ${config.model.model} · ${config.model.baseUrl}` },
    {
      area: 'anonymization',
      level: config.anonymize ? 'OK' : 'INFO',
      detail: config.anonymize ? 'every kit call uses -Anonymize' : 'off (local model, real paths stay on this PC)',
    },
    { area: 'level', level: config.level === 'operator' ? 'INFO' : 'OK', detail: config.level },
  ];

  let ok = true;
  try {
    const harness = await createHarness(config, { gateway: new ScriptedModelGateway() });
    rows.push({
      area: 'kit api',
      level: 'OK',
      detail: `ApiVersion ${harness.client.apiVersion} · ${harness.catalog.length} operations · ${harness.tools.length} tools at this level`,
    });
    const wizardOnly = harness.catalog.filter((op) => op.Interactive).map((op) => op.Name);
    if (wizardOnly.length > 0) rows.push({ area: 'wizard-only', level: 'INFO', detail: wizardOnly.join(', ') });
    const unavailable = harness.catalog.filter((op) => !op.Available && !op.Interactive).map((op) => op.Name);
    if (unavailable.length > 0) rows.push({ area: 'not available', level: 'INFO', detail: unavailable.join(', ') });
    harness.close();
  } catch (error) {
    ok = false;
    rows.push({ area: 'kit api', level: 'ERROR', detail: error instanceof Error ? error.message : String(error) });
  }

  if (json) process.stdout.write(`${JSON.stringify({ ok, rows }, null, 2)}\n`);
  else for (const row of rows) process.stdout.write(`${row.level.padEnd(5)} ${row.area.padEnd(15)} ${row.detail}\n`);
  return ok ? 0 : 1;
}

async function runTools(config: HarnessConfig, flags: Flags, json: boolean): Promise<number> {
  const harness = await createHarness(config, { gateway: new ScriptedModelGateway() });
  const tools = flags.kind ? harness.tools.filter((tool) => tool.kind === flags.kind) : harness.tools;
  if (json) {
    process.stdout.write(`${JSON.stringify({ apiVersion: harness.client.apiVersion, tools, catalog: harness.catalog }, null, 2)}\n`);
  } else {
    process.stdout.write(
      `ApiVersion ${harness.client.apiVersion} · ${harness.catalog.length} operations in the kit · ${harness.tools.length} tools at level ${config.level}\n\n`,
    );
    for (const tool of tools) {
      const properties = tool.parameters.properties as Record<string, { type?: string }>;
      const params = Object.entries(properties)
        .map(([name, spec]) => `${name}:${spec.type ?? '?'}`)
        .join(' ');
      process.stdout.write(`${tool.kind.padEnd(6)} ${tool.name.padEnd(20)} → ${tool.operations.length > 4 ? `${tool.operations.length} steps` : tool.operations.join('|')}${params ? `  (${params})` : ''}\n`);
    }
  }
  harness.close();
  return 0;
}

async function runStatus(config: HarnessConfig, json: boolean): Promise<number> {
  const harness = await createHarness(config, { gateway: new ScriptedModelGateway() });
  const outcome = await harness.engine.read('status');
  const result = outcome.result;
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const summary = (result.Data?.Summary ?? {}) as Record<string, unknown>;
    process.stdout.write(`${result.Message}\nlevel ${summary.Level} · ok ${summary.Ok} · info ${summary.Info} · warn ${summary.Warn} · error ${summary.Error}\n\n`);
    const checks = (result.Data?.Checks ?? []) as Array<Record<string, unknown>>;
    const loud = checks.filter((check) => check.Level === 'Warn' || check.Level === 'Error');
    for (const check of loud) process.stdout.write(`${String(check.Level).padEnd(5)} [${check.Area}] ${check.Name}: ${check.Detail}\n`);
    if (loud.length === 0) process.stdout.write('nothing to look at: every check is OK\n');
    else process.stdout.write(`\n${checks.length - loud.length} of ${checks.length} checks are OK (--json shows all)\n`);
  }
  harness.close();
  return result.Success ? 0 : 1;
}

/** One operation through the whole gate, no model involved — the way to rehearse the flow by hand. */
async function runChange(config: HarnessConfig, operation: string | undefined, flags: Flags, params: readonly string[], switches: readonly string[]): Promise<number> {
  if (!operation) {
    fail('usage: fagent run <operation> [--param Name=Value ...] [--flag Name] [--kit <path>] [--level operator]');
    return 2;
  }
  const human = new TerminalHumanGateway();
  const harness = await createHarness(config, { human, gateway: new ScriptedModelGateway() });
  const spec = await harness.client.findOperation(operation);
  if (!spec) {
    fail(`the kit has no operation "${operation}". fagent tools lists what exists.`);
    harness.close();
    return 2;
  }
  const tool = harness.tools.find((candidate) => candidate.operations.includes(operation));
  const parameters = collectParameters(params, switches);
  const answer = await harness.engine.handle({
    tool: tool?.name ?? 'run_step',
    args: tool?.name === 'run_step' || operation.startsWith('step.') ? { operation, parameters } : parameters,
  });

  if (flags.json === 'true') process.stdout.write(`${JSON.stringify(answer, null, 2)}\n`);
  else if (answer.plan && answer.stage !== 'applied') process.stdout.write(`${formatPlanForHuman(answer.plan)}\n`);

  if (answer.stage === 'applied') {
    const verification = answer.payload.verification as Record<string, unknown> | undefined;
    process.stdout.write(
      `applied: ${String(answer.payload.status)} — ${String(answer.payload.message)}\n` +
        `verification: ${String(verification?.status ?? 'skipped')}${verification?.message ? ` — ${String(verification.message)}` : ''}\n`,
    );
  } else if (answer.stage === 'declined') {
    process.stdout.write(`not applied: you declined ("${String(answer.payload.reason)}"). Nothing changed.\n`);
  } else if (!answer.ok) {
    process.stdout.write(`refused (${String(answer.payload.code)}): ${String(answer.payload.error)}\n`);
    if (answer.payload.hint) process.stdout.write(`hint: ${String(answer.payload.hint)}\n`);
  }
  harness.close();
  return answer.ok ? 0 : answer.stage === 'declined' ? 1 : 2;
}

async function runChat(config: HarnessConfig, flags: Flags): Promise<number> {
  const human = new TerminalHumanGateway();
  const scripted = flags.demo === 'true' ? demoScript(config) : undefined;
  const harness = await createHarness(config, { human, gateway: scripted ?? new ScriptedModelGateway([{ text: '' }]) });
  const gateway = scripted ?? harness.gateway;

  const loop = new AgentLoop({
    gateway: gateway as never,
    engine: harness.engine,
    tools: harness.tools,
    store: harness.store,
    sessionId: harness.sessionId,
    culture: config.culture,
    apiVersion: harness.client.apiVersion,
    kitVersion: harness.kitVersion,
    onEvent: (event) => {
      if (flags.json === 'true') return;
      if (event.type === 'assistant' && event.text) process.stdout.write(`\n${event.text}\n`);
      if (event.type === 'tool-call') process.stdout.write(`\n→ ${event.tool} ${JSON.stringify(event.args)}\n`);
      if (event.type === 'tool-answer') process.stdout.write(`  [${event.stage}${event.ok ? '' : ' · refused'}] ${event.summary}\n`);
      if (event.type === 'round-limit') process.stdout.write(`\nstopped after ${event.rounds} rounds\n`);
    },
  });

  const print = (text: string): void => {
    if (flags.json !== 'true') process.stdout.write(`${text}\n`);
  };

  if (flags.message) {
    const run = await loop.ask(String(flags.message));
    if (flags.json === 'true') process.stdout.write(`${JSON.stringify({ session: harness.sessionId, ...run }, null, 2)}\n`);
    print(`\n(${run.rounds} rounds · ${run.toolCalls} tool calls · ${run.refused} refused · audit: ${config.dbPath})`);
    harness.close();
    return 0;
  }

  print(`fagent chat · level ${config.level} · model ${config.model.provider}:${config.model.model} · kit ${config.kitRoot}`);
  print('a change is always shown as a plan and confirmed by you at this terminal. Ctrl+D ends.\n');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const line = await new Promise<string>((resolve) => rl.question('you > ', resolve));
    const text = line.trim();
    if (!text) break;
    const run = await loop.ask(text);
    if (run.answer) process.stdout.write(`\n${run.answer.startsWith('\n') ? run.answer.slice(1) : run.answer}\n`);
  }
  rl.close();
  print(`\n(session ${harness.sessionId} · audit: ${config.dbPath})`);
  harness.close();
  return 0;
}

/** `--demo`: no model, no network — a scripted one runs the read-only diagnosis order so you can watch the flow. */
function demoScript(config: HarnessConfig): ScriptedModelGateway {
  const steps: ScriptStep[] = [
    { call: { name: 'cabinet_status' } },
    { call: { name: 'cabinet_components' } },
    {
      text:
        config.culture === 'de-DE'
          ? 'Das ist der gemessene Zustand. Für eine Änderung nenne ich den Operationsschritt; der Plan wird dir gezeigt und nur du bestätigst ihn.'
          : 'That is the measured state. For a change I name the operation; the plan is shown to you and only you confirm it.',
    },
  ];
  return new ScriptedModelGateway(steps, { model: 'demo-script', provider: config.model.provider });
}

function runHistory(config: HarnessConfig, flags: Flags): number {
  const store = Store.open(config.dbPath);
  const limit = Number(flags.last ?? 20);
  const rows = store.recentToolCalls(Number.isFinite(limit) ? limit : 20);
  if (rows.length === 0) {
    process.stdout.write(`nothing logged yet in ${config.dbPath}\n`);
    store.close();
    return 0;
  }
  for (const row of rows) {
    const detail = row.error ?? row.status ?? '';
    process.stdout.write(
      `${String(row.created_at)}  ${String(row.stage).padEnd(7)} ${String(row.tool).padEnd(18)} ${String(row.operation).padEnd(30)} ${String(detail).slice(0, 80)}\n`,
    );
  }
  process.stdout.write(`\n${store.countApprovals()} approval records · ${store.countToolCalls()} tool calls in ${config.dbPath}\n`);
  store.close();
  return 0;
}

function collectParameters(params: readonly string[], switches: readonly string[]): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const pair of params) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const key = pair.slice(0, index);
    const raw = pair.slice(index + 1);
    if (raw === 'true' || raw === 'false') out[key] = raw === 'true';
    else if (/^-?\d+$/.test(raw)) out[key] = Number(raw);
    else if (Array.isArray(out[key])) (out[key] as string[]).push(raw);
    else out[key] = raw;
  }
  for (const name of switches) out[name] = true;
  return out;
}

function reportError(error: unknown): number {
  if (error instanceof ApiVersionMismatchError) {
    fail(`${error.message}\n\nThe harness refuses to run any tool against a kit that speaks another major ApiVersion. Update one of the two.`);
    return 3;
  }
  if (error instanceof KitContractError) {
    fail(`kit contract (${error.code}): ${error.message}`);
    return 3;
  }
  if (error instanceof PolicyError) {
    fail(`refused (${error.code}): ${error.message}`);
    return 2;
  }
  fail(error instanceof Error ? error.message : String(error));
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
