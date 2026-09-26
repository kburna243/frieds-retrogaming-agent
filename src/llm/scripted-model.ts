/**
 * A scripted stand-in model: deterministic, offline, no endpoint.
 *
 * It exists for two reasons. The test suite needs a "model" that asks for a specific tool call (so the policy can
 * be proven), and `fagent chat --demo` should show the whole flow on a machine with no local model installed.
 * Nothing about it touches the cabinet: its tool calls go through the same `PolicyEngine` as any real model's.
 */

import type { ChatMessage, Completion, CompletionRequest, ModelGateway, ModelInfo } from './gateway.ts';

export type ScriptStep =
  | { text: string }
  | { call: { name: string; arguments?: Record<string, unknown>; id?: string } }
  | { calls: Array<{ name: string; arguments?: Record<string, unknown>; id?: string }> };

export class ScriptedModelGateway implements ModelGateway {
  readonly info: ModelInfo = { provider: 'local', baseUrl: 'script://', model: 'scripted', anonymizeRequired: false };
  readonly #script: ScriptStep[];
  #index = 0;

  constructor(script: ScriptStep[] = [], info?: Partial<ModelInfo>) {
    this.#script = script;
    this.info = { ...this.info, ...info };
  }

  /** Every prompt the "model" saw — how a test proves that nothing un-anonymized reached it. */
  readonly prompts: CompletionRequest[] = [];

  async complete(request: CompletionRequest): Promise<Completion> {
    this.prompts.push(request);
    const step = this.#script[this.#index];
    this.#index += 1;
    if (!step) return { finishReason: 'stop', message: { role: 'assistant', content: '(script exhausted)' } };
    if ('text' in step) {
      // Streams word by word when asked, so the terminal path is tested the same way a real endpoint drives it.
      if (request.onText) {
        for (const piece of step.text.match(/\S+\s*|\s+/g) ?? []) request.onText(piece);
        return { finishReason: 'stop', message: { role: 'assistant', content: step.text }, streamed: true };
      }
      return { finishReason: 'stop', message: { role: 'assistant', content: step.text } };
    }
    const calls = 'call' in step ? [step.call] : step.calls;
    const message: ChatMessage = {
      role: 'assistant',
      content: null,
      toolCalls: calls.map((call, i) => ({ id: call.id ?? `call_${this.#index}_${i}`, name: call.name, arguments: call.arguments ?? {} })),
    };
    return { finishReason: 'tool_calls', message };
  }
}

/** Answers "call this tool, then stop". The shape most tests need. */
export function callThenText(call: { name: string; arguments?: Record<string, unknown> }, text: string): ScriptStep[] {
  return [{ call }, { text }];
}
