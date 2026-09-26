/**
 * The human gate.
 *
 * This interface is the only way a decision enters the system. It is deliberately small:
 * one plan in, one decision out. There is no bulk method, no "approve all", no way for a caller other than
 * `PolicyEngine` to write an approval, and no implementation that a model can reach.
 */

import { createInterface } from 'node:readline';
import type { PlanView } from './plan.ts';
import { formatPlanForHuman } from './plan.ts';

export type Decision = { approved: boolean; said: string };

export interface HumanGateway {
  /** Called once per change. Show the plan verbatim, wait for a clear yes. Anything else is a no. */
  confirm(plan: PlanView): Promise<Decision>;
}

export interface TerminalHumanOptions {
  /** How long the answer may take. After that the plan is dead and must be dry-run again. */
  answerTimeoutMs?: number;
  write?: (text: string) => void;
}

export class TerminalHumanGateway implements HumanGateway {
  readonly #write: (text: string) => void;
  readonly #timeoutMs: number;

  constructor(options: TerminalHumanOptions = {}) {
    this.#write = options.write ?? ((text) => process.stdout.write(text));
    this.#timeoutMs = options.answerTimeoutMs ?? 300_000;
  }

  async confirm(plan: PlanView): Promise<Decision> {
    this.#write(`\n${'─'.repeat(72)}\n${formatPlanForHuman(plan)}\n${'─'.repeat(72)}\n`);
    this.#write('Apply this exact change? Type yes to apply, anything else refuses. > ');
    const answer = await readLineWithTimeout(this.#timeoutMs);
    const said = answer.trim();
    const approved = /^(ja|yes|y|ok|okay|apply|anwenden)$/i.test(said);
    if (!approved) this.#write(`refused ("${said || 'no answer'}") — nothing was changed\n`);
    return { approved, said: said || '(no answer)' };
  }
}

/**
 * A scripted gate for tests and non-interactive runs.
 *
 * It is *not* wired to the model: only `PolicyEngine` may call it, and the test suite uses it to prove the flow —
 * never to skip a stage.
 */
export class ScriptedHumanGateway implements HumanGateway {
  readonly seen: PlanView[] = [];
  readonly #script: Array<boolean | Decision>;
  #index = 0;

  constructor(script: Array<boolean | Decision> = []) {
    this.#script = script;
  }

  async confirm(plan: PlanView): Promise<Decision> {
    this.seen.push(plan);
    const step = this.#script[this.#index];
    this.#index += 1;
    if (step === undefined) return { approved: false, said: '(script exhausted: default no)' };
    if (typeof step === 'boolean') return { approved: step, said: step ? 'yes (scripted)' : 'no (scripted)' };
    return step;
  }
}

/** A gate that always refuses. The default when nobody is sitting at the terminal. */
export class NeverApprovesGateway implements HumanGateway {
  async confirm(plan: PlanView): Promise<Decision> {
    return { approved: false, said: `(no human present: plan ${plan.planId})` };
  }
}

async function readLineWithTimeout(timeoutMs: number): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  try {
    return await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve(''), timeoutMs);
      rl.once('line', (line) => {
        clearTimeout(timer);
        resolve(line);
      });
      rl.once('close', () => {
        clearTimeout(timer);
        resolve('');
      });
    });
  } finally {
    rl.close();
  }
}
