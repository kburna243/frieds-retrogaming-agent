/**
 * The scenarios as a test.
 *
 * Part one runs always, offline: the ideal script must produce exactly the trace the scenario documents. That keeps
 * the expectations honest — a trace nobody can reach is not a specification.
 *
 * Part two runs only when FAGENT_EVAL_MODEL names a local model. Then a real model gets the same prompt, on the same
 * fake cabinet, and is judged on the gate rules rather than on the route it chose.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { BEHAVIOUR_CHECKS, GATE_INVARIANTS, SCENARIOS, type GateContext, type Scenario } from '../eval/scenarios.ts';
import { idealModel, runScenario } from '../eval/run.ts';

const EVAL_MODEL = process.env.FAGENT_EVAL_MODEL ?? '';

/** The scenarios are a fixed list; a test that names one should say so rather than index blindly. */
function scenarioById(id: string): Scenario {
  const found = SCENARIOS.find((scenario) => scenario.id === id);
  if (!found) throw new Error(`no scenario named ${id}`);
  return found;
}

afterAll(() => {
  // Nothing to close: each run builds its own temporary database and removes it.
});

describe('scenarios — the ideal run, offline', () => {
  it.each(SCENARIOS)('$id', async (scenario) => {
    const result = await runScenario({ scenario, gateway: idealModel(scenario), expectExactTrace: true });
    const detail = `${result.scenario}\ntrace: ${result.trace.join(' → ')}`;
    expect(result.gate, detail).toEqual([]);
    // The ideal script is the reference: if it misses the behaviour checks, the checks are wrong, not the script.
    expect(result.behaviour, detail).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('every scenario names a trace that its own ideal script can produce', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.expectedTrace[0], scenario.id).toBe('operations');
      expect(scenario.requiredOperations.length, scenario.id).toBeGreaterThan(0);
      expect(scenario.forbiddenOperations, scenario.id).toContain('step.pinball.08-screens');
    }
  });

  it('the rules are stated in words a person can check, and gate rules are separated from good taste', () => {
    expect(GATE_INVARIANTS.length).toBeGreaterThanOrEqual(4);
    expect(BEHAVIOUR_CHECKS.length).toBeGreaterThanOrEqual(3);
    for (const rule of [...GATE_INVARIANTS, ...BEHAVIOUR_CHECKS]) {
      expect(rule.id).toMatch(/^[a-z-]+$/);
      expect(rule.description.length).toBeGreaterThan(15);
    }
    expect(GATE_INVARIANTS.every((rule) => rule.level === 'gate')).toBe(true);
    expect(BEHAVIOUR_CHECKS.every((rule) => rule.level === 'behaviour')).toBe(true);
  });

  it('each gate rule fires on a run that breaks it, so the eval is not vacuous', () => {
    const scenario = scenarioById('gun-does-not-work');
    const context = (over: Partial<GateContext>): GateContext => ({
      trace: [],
      calls: [],
      plansShown: 0,
      yeses: 0,
      scenario,
      answer: '',
      knownOperations: ['status', 'components', 'step.lightgun.03-vigembus'],
      ...over,
    });

    const rule = (id: string) => {
      const found = GATE_INVARIANTS.find((invariant) => invariant.id === id);
      if (!found) throw new Error(`no gate rule named ${id}`);
      return found;
    };

    // An apply that never had a dry run.
    expect(rule('no-apply-without-dry-run').check(context({ calls: [{ operation: 'step.lightgun.03-vigembus', apply: true }] }))).toContain('without a dry run');
    // More changes than the person approved.
    expect(rule('no-more-applies-than-yeses').check(context({
      calls: [{ operation: 'step.lightgun.03-vigembus' }, { operation: 'step.lightgun.03-vigembus', apply: true }, { operation: 'support.bundle', apply: true }],
      plansShown: 1,
      yeses: 1,
    }))).toContain('after 1 human yes');
    // An interactive step reaching the kit.
    expect(rule('never-interactive').check(context({ trace: ['operations', 'step.pinball.08-screens'] }))).toContain('interactive');
    // -Approved on a call that is not an apply.
    expect(rule('no-apply-without-an-approval-needed').check(context({ calls: [{ operation: 'status', approved: true }] }))).toContain('-Approved');

    // And the same rules stay quiet on the honest run.
    for (const invariant of GATE_INVARIANTS) {
      expect(invariant.check(context({
        trace: ['operations', 'status', 'step.lightgun.03-vigembus', 'step.lightgun.03-vigembus:apply+approved'],
        calls: [{ operation: 'status' }, { operation: 'step.lightgun.03-vigembus' }, { operation: 'step.lightgun.03-vigembus', apply: true, approved: true }],
        plansShown: 1,
        yeses: 1,
        answer: 'ViGEmBus was missing; it is installed now.',
      })), invariant.id).toBeNull();
    }
  });

  it('a model that names an operation the kit does not have is caught', () => {
    const scenario = scenarioById('gun-does-not-work');
    const invented = BEHAVIOUR_CHECKS.find((check) => check.id === 'only-real-operations-named');
    if (!invented) throw new Error('the check is gone');
    const verdict = invented.check({
      trace: [],
      calls: [],
      plansShown: 0,
      yeses: 0,
      scenario,
      answer: 'Run step.lightgun.04-trigger_test in the wizard.',
      knownOperations: ['step.lightgun.03-vigembus'],
    });
    expect(verdict).toContain('step.lightgun.04-trigger_test');
  });
});

describe.skipIf(!EVAL_MODEL)('scenarios — against a real local model', () => {
  it.each(SCENARIOS)('$id', async (scenario) => {
    const { realModel } = await import('../eval/run.ts');
    const result = await runScenario({ scenario, gateway: realModel(EVAL_MODEL), maxRounds: 12 });
    // Only the gate is asserted here. The route is the model's, and a small model may take a poor one —
    // `behaviour` is printed for the record, which is exactly what M5 is for.
    // eslint-disable-next-line no-console
    console.log(`[eval ${scenario.id}] ${EVAL_MODEL}\n  trace: ${result.trace.join(' → ')}\n  behaviour: ${result.behaviour.join('\n  behaviour: ') || 'clean'}`);
    expect(result.gate, `model: ${result.model}\ntrace: ${result.trace.join(' → ')}\nanswer: ${result.answer}`).toEqual([]);
  }, 300_000);
});
