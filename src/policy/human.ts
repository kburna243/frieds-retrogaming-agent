/**
 * The human gate.
 *
 * This interface is the only way a decision enters the system. It is deliberately small:
 * one plan in, one decision out. There is no bulk method, no "approve all", no way for a caller other than
 * `PolicyEngine` to write an approval, and no implementation that a model can reach.
 */

import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type { PlanView } from './plan.ts';
import { formatPlanForHuman } from './plan.ts';

export type Decision = { approved: boolean; said: string };

export interface HumanGateway {
  /** Called once per change. Show the plan verbatim, wait for a clear yes. Anything else is a no. */
  confirm(plan: PlanView): Promise<Decision>;
}

/**
 * One reader on the terminal, shared by whoever needs a person.
 *
 * `fagent chat` reads what the user types *and* asks "Apply this exact change?". With two readers on one stdin the
 * question can steal the line that was meant for the chat, so the chat hands its interface to the gate instead.
 */
export interface Prompter {
  /** Write a prompt, wait for one line. Resolves empty when the input is closed. */
  ask(prompt: string): Promise<string>;
  /** Close the underlying interface. Only the owner of the terminal calls this. */
  dispose(): void;
}

export interface TerminalHumanOptions {
  /** How long the answer may take. After that the plan is dead and must be dry-run again. */
  answerTimeoutMs?: number;
  write?: (text: string) => void;
  /**
   * The reader to ask through. Given, this gateway shares one stdin with the chat; omitted, it opens one for this
   * question and closes it again — which is right for `fagent run`, where nothing else is reading.
   */
  prompter?: Prompter;
}

export class TerminalHumanGateway implements HumanGateway {
  readonly #write: (text: string) => void;
  readonly #timeoutMs: number;
  readonly #prompter: Prompter | null;

  constructor(options: TerminalHumanOptions = {}) {
    this.#write = options.write ?? ((text) => process.stdout.write(text));
    this.#timeoutMs = options.answerTimeoutMs ?? 300_000;
    this.#prompter = options.prompter ?? null;
  }

  async confirm(plan: PlanView): Promise<Decision> {
    this.#write(`\n${'─'.repeat(72)}\n${formatPlanForHuman(plan)}\n${'─'.repeat(72)}\n`);
    const prompt = 'Apply this exact change? Type yes to apply, anything else refuses. > ';
    const answer = this.#prompter
      ? await this.#prompter.ask(prompt)
      : await oneShotQuestion(prompt, this.#timeoutMs);
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

/**
 * A prompter over one readline interface. The chat owns it while it runs; `fagent run` makes a short-lived one.
 */
export function createPrompter(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Prompter & { interface: ReadlineInterface } {
  const rl = createInterface({ input, output, terminal: false });
  return {
    interface: rl,
    ask(prompt: string): Promise<string> {
      return new Promise((resolve) => {
        let settled = false;
        const done = (line: string) => {
          if (settled) return;
          settled = true;
          rl.off('close', onClose);
          resolve(line);
        };
        const onClose = () => done('');
        rl.once('close', onClose);
        rl.question(prompt, (line) => done(line));
      });
    },
    dispose: () => rl.close(),
  };
}

/** A question with nobody else reading stdin: open a line, answer it, close the line. */
async function oneShotQuestion(prompt: string, timeoutMs: number): Promise<string> {
  const prompter = createPrompter(process.stdin, process.stdout);
  try {
    const answer = await Promise.race([
      prompter.ask(prompt),
      new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve(''), timeoutMs);
        timer.unref?.();
      }),
    ]);
    return answer;
  } finally {
    prompter.dispose();
  }
}
