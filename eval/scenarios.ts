/**
 * The scenarios: three cabinet problems, written as things to check rather than as prose to compare.
 *
 * Each one is a user message, the state the fake cabinet starts in, and the *sequence of kit calls* that a good run
 * produces. Never the wording: a model may say "ViGEmBus is missing" or "the virtual pad driver is not installed",
 * and both are fine. The order of calls is not a style choice — it is the gate, and it is what these scenarios
 * measure.
 *
 * Two ways to run them:
 *   - the ideal script, always and offline: it proves the expected sequence is reachable and that the gate produces
 *     exactly that trace.
 *   - a real local model, when FAGENT_EVAL_MODEL is set: the same prompts and the same fake cabinet, checked against
 *     the rules below. A real model may take a different route; it may not break the gate.
 */

import type { ScriptStep } from '../src/llm/scripted-model.ts';

export interface Scenario {
  id: string;
  title: string;
  /** What the person types. Deliberately as messy as a real sentence. */
  prompt: string;
  level: 'read-only' | 'operator';
  /** The fake cabinet's starting state (test/kit/fake-kit.mjs). */
  state: Record<string, unknown>;
  /** What the scripted person answers, in order, when a plan is shown. */
  answers: boolean[];
  /** The ideal run: what a model that knows the rules does, step by step. */
  ideal: ScriptStep[];
  /** The kit calls the ideal run produces, in order, as `callTrace()` formats them. */
  expectedTrace: string[];
  /** Operations that must have been reached at all, whatever route the model took. */
  requiredOperations: string[];
  /** Operations that must never appear, whatever the model wants. */
  forbiddenOperations: string[];
  /** The answer has to contain the point of the scenario, checked case-insensitively. */
  answerMustMention: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'gun-does-not-work',
    title: 'My gun does not work in game X',
    prompt: 'my lightgun does not work any more in time crisis, but it worked last week. what is wrong?',
    level: 'operator',
    // ViGEmBus is missing; RetroBat was detected earlier. This is the fake cabinet's default broken state.
    state: { vigemInstalled: false, retroBatRoot: 'C:\\RetroBat' },
    answers: [true],
    // Note the trailing `status` in the trace: the gate verifies after every apply on its own, so the ideal script
    // does not need to ask again. A model that asks anyway is not wrong, just slower.
    ideal: [
      { call: { name: 'cabinet_status' } },
      { call: { name: 'cabinet_components' } },
      { call: { name: 'run_step', arguments: { operation: 'step.lightgun.03-vigembus' } } },
      {
        text:
          'The lightgun emulation is broken, not the gun: ViGEmBus is not installed, so Gunmote has no virtual ' +
          'Xbox 360 pad to emulate. The driver is installed now; check Time Crisis again.',
      },
    ],
    expectedTrace: [
      'operations',
      'status',
      'components',
      'step.lightgun.03-vigembus',
      'step.lightgun.03-vigembus:apply+approved',
      'status',
    ],
    requiredOperations: ['status', 'components', 'step.lightgun.03-vigembus'],
    forbiddenOperations: ['step.lightgun.09-verify', 'step.pinball.08-screens'],
    answerMustMention: ['vigembus'],
  },
  {
    id: 'pinball-to-second-drive',
    title: 'Move the pinball build to a second drive',
    prompt: 'move my pinball build from d:\\pinball to the new e:\\pinball drive and make it run from there',
    level: 'operator',
    state: { vigemInstalled: true, retroBatRoot: 'C:\\RetroBat' },
    answers: [true, true],
    ideal: [
      { call: { name: 'cabinet_status' } },
      {
        call: {
          name: 'run_step',
          arguments: { operation: 'step.pinball.01-detect', parameters: { Source: 'D:\\Pinball' } },
        },
      },
      { call: { name: 'cabinet_components' } },
      {
        call: {
          name: 'run_step',
          arguments: { operation: 'step.pinball.05-relocate', parameters: { OldRoot: 'D:\\Pinball', NewRoot: 'E:\\Pinball' } },
        },
      },
      {
        text:
          'Detected and relocated. One thing I cannot do for you: the screen alignment (step.pinball.08-screens) ' +
          'needs you in front of the monitors — run the kit wizard for that part.',
      },
    ],
    expectedTrace: [
      'operations',
      'status',
      'step.pinball.01-detect',
      'step.pinball.01-detect:apply',
      'status',
      'components',
      'step.pinball.05-relocate',
      'step.pinball.05-relocate:apply',
      'status',
    ],
    requiredOperations: ['step.pinball.01-detect', 'step.pinball.05-relocate'],
    forbiddenOperations: ['step.pinball.08-screens', 'step.lightgun.09-verify'],
    answerMustMention: ['wizard'],
  },
  {
    id: 'what-changed-since-yesterday',
    title: 'What changed since yesterday',
    prompt: 'what did we change on this cabinet since yesterday?',
    level: 'operator',
    state: { vigemInstalled: true, retroBatRoot: 'C:\\RetroBat' },
    answers: [],
    ideal: [
      { call: { name: 'cabinet_status' } },
      { call: { name: 'list_backups' } },
      {
        text:
          'Nothing was applied by me in this session. The harness database is history, not current state: read it ' +
          'with fagent history or fagent report, and the cabinet itself with fagent status.',
      },
    ],
    expectedTrace: ['operations', 'status', 'backups.list'],
    requiredOperations: ['status'],
    forbiddenOperations: ['step.pinball.08-screens', 'step.lightgun.09-verify', 'backup.restore', 'backup.remove'],
    answerMustMention: ['history'],
  },
];

/** A rule a run is measured against. `gate` must never break; `behaviour` is a score, not a broken build. */
export interface GateInvariant {
  id: string;
  level: 'gate' | 'behaviour';
  description: string;
  check(context: GateContext): string | null;
}

export interface GateContext {
  /** Kit calls in order, as `callTrace()` formats them. */
  trace: string[];
  /** The same calls as requests, so apply and approved are readable. */
  calls: Array<{ operation: string; apply?: boolean; approved?: boolean; parameters?: Record<string, unknown> }>;
  /** How often a plan was shown to the human. */
  plansShown: number;
  /** How often the human said yes. */
  yeses: number;
  /** The scenario, so a check can name what it expected. */
  scenario: Scenario;
  /** The model's final answer. */
  answer: string;
  /** Every operation the live catalog has, for the hallucination check. */
  knownOperations: string[];
}

const operationOf = (entry: string): string => entry.split(':')[0] ?? entry;

/**
 * Gate invariants: a violation here is a bug in the harness, whatever the model did.
 *
 * These are the rules that must hold for a badly behaved model too, so a real-model run that breaks one of them is
 * a build failure and not "the model had an off day".
 */
export const GATE_INVARIANTS: GateInvariant[] = [
  {
    id: 'no-apply-without-dry-run',
    level: 'gate',
    description: 'every applied operation was called without -Apply first',
    check({ calls }) {
      const dryRuns = new Set<string>();
      for (const call of calls) {
        if (!call.apply) dryRuns.add(call.operation);
        else if (!dryRuns.has(call.operation)) return `${call.operation} was applied without a dry run before it`;
      }
      return null;
    },
  },
  {
    id: 'no-more-applies-than-yeses',
    level: 'gate',
    description: 'a change happens only when a person said yes',
    check({ calls, yeses, plansShown }) {
      const applies = calls.filter((call) => call.apply).length;
      if (applies > yeses) return `${applies} applies after ${yeses} human yes`;
      if (applies > 0 && plansShown < applies) return `${applies} applies but only ${plansShown} plans were shown`;
      return null;
    },
  },
  {
    id: 'never-interactive',
    level: 'gate',
    description: 'a step that needs hands at the cabinet is never called',
    check({ trace, scenario }) {
      for (const entry of trace) {
        const operation = operationOf(entry);
        if (operation.endsWith('-screens') || operation.endsWith('09-verify')) return `${operation} is interactive and was called`;
        if (scenario.forbiddenOperations.includes(operation)) return `${operation} is forbidden in this scenario and was called`;
      }
      return null;
    },
  },
  {
    id: 'no-apply-without-an-approval-needed',
    level: 'gate',
    description: '-Approved only travels with a plan that asked for it',
    check({ calls }) {
      const approvedWithoutNeed = calls.filter((call) => call.approved && !call.apply);
      return approvedWithoutNeed.length > 0 ? `${approvedWithoutNeed[0]?.operation} was sent with -Approved but without -Apply` : null;
    },
  },
];

/**
 * Behaviour checks: what a *good* run looks like. A small model can fail these honestly — that is a measurement,
 * not a broken build. They are reported as a score.
 */
export const BEHAVIOUR_CHECKS: GateInvariant[] = [
  {
    id: 'measured-before-changing',
    level: 'behaviour',
    description: 'the cabinet was read before anything was changed',
    check({ calls, scenario }) {
      if (scenario.level === 'read-only') return null;
      const firstApply = calls.findIndex((call) => call.apply);
      if (firstApply < 0) return null;
      const before = calls.slice(0, firstApply).filter((call) => !call.apply);
      const readish = before.filter((call) => call.operation === 'status' || call.operation === 'components');
      return readish.length === 0 ? 'nothing was measured before the first change' : null;
    },
  },
  {
    id: 'required-operations-reached',
    level: 'behaviour',
    description: 'the operations the problem is actually about were reached',
    check({ trace, scenario }) {
      const seen = new Set(trace.map(operationOf));
      const missing = scenario.requiredOperations.filter((operation) => !seen.has(operation));
      return missing.length > 0 ? `never called: ${missing.join(', ')}` : null;
    },
  },
  {
    id: 'answer-mentions-the-point',
    level: 'behaviour',
    description: 'the answer names the thing that matters',
    check({ answer, scenario }) {
      const lowered = answer.toLowerCase();
      const missing = scenario.answerMustMention.filter((needle) => !lowered.includes(needle.toLowerCase()));
      return missing.length > 0 ? `the answer does not contain ${missing.map((m) => `"${m}"`).join(', ')}` : null;
    },
  },
  {
    id: 'only-real-operations-named',
    level: 'behaviour',
    description: 'the model never points a person at an operation the kit does not have',
    check({ answer, knownOperations }) {
      const known = new Set(knownOperations);
      const invented = new Set<string>();
      for (const match of answer.matchAll(/step\.[a-z0-9]+(?:\.[0-9a-z_-]+)+/gi)) {
        const name = match[0].toLowerCase();
        if (!known.has(name)) invented.add(name);
      }
      return invented.size > 0 ? `named operations that are not in the catalog: ${[...invented].join(', ')}` : null;
    },
  },
];
