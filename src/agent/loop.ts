/**
 * The agent loop: model → tool calls → policy engine → tool answers → model.
 *
 * The loop has no privileged path to the kit. Everything a model asks for goes through
 * `PolicyEngine.handle()`, which means every change carries the dry run, the plan, the human and the verification
 * with it. The loop also decides which messages may be built at all: for a cloud model every kit answer it puts
 * back into the conversation comes from a call that was made with `-Anonymize`.
 */

import type { ModelGateway, ChatMessage } from '../llm/gateway.ts';
import type { ToolDefinition } from '../kit/tools.ts';
import type { PolicyEngine } from '../policy/engine.ts';
import { systemPrompt } from './prompt.ts';
import { buildMemoryDigest } from './memory.ts';
import type { Store } from '../db/store.ts';

export interface AgentLoopOptions {
  gateway: ModelGateway;
  engine: PolicyEngine;
  tools: ToolDefinition[];
  store: Store;
  sessionId: string;
  culture: 'en-US' | 'de-DE';
  kitVersion?: string | null;
  apiVersion?: string | null;
  maxRounds?: number;
  /** Start from a digest of earlier sessions (default true). `false` starts with no memory at all. */
  memory?: boolean;
  /** Pass assistant text on as it arrives (`text` events). Tool calls still reach the gate only when complete. */
  stream?: boolean;
  /**
   * An earlier conversation to carry on (`fagent chat --continue`): user and assistant text only, see
   * `src/agent/resume.ts`. It is put after the system prompt, once, and recorded in this session too.
   */
  resume?: ChatMessage[];
  /** Called for every assistant text and every tool answer, so the CLI can show what is happening. */
  onEvent?: (event: AgentEvent) => void;
}

export type AgentEvent =
  | { type: 'round'; round: number; maxRounds: number }
  | { type: 'text'; delta: string }
  | { type: 'assistant'; text: string; streamed: boolean }
  | { type: 'tool-call'; tool: string; args: Record<string, unknown> }
  | { type: 'tool-answer'; tool: string; ok: boolean; stage: string; summary: string }
  | { type: 'plan'; operation: string; text: string }
  | { type: 'round-limit'; rounds: number };

export interface AgentRun {
  answer: string;
  rounds: number;
  maxRounds: number;
  toolCalls: number;
  refused: number;
}

export class AgentLoop {
  readonly #o: AgentLoopOptions;
  readonly #history: ChatMessage[] = [];
  #started = false;

  constructor(options: AgentLoopOptions) {
    this.#o = options;
  }

  get history(): readonly ChatMessage[] {
    return this.#history;
  }

  async ask(userText: string): Promise<AgentRun> {
    if (!this.#started) {
      this.#history.push({
        role: 'system',
        content: systemPrompt({
          model: this.#o.gateway.info,
          level: this.#o.engine.level,
          culture: this.#o.culture,
          kitVersion: this.#o.kitVersion,
          apiVersion: this.#o.apiVersion,
          memory:
            this.#o.memory === false
              ? null
              : buildMemoryDigest(this.#o.store, {
                  currentSessionId: this.#o.sessionId,
                  anonymizeRequired: this.#o.gateway.info.anonymizeRequired,
                }),
        }),
      });
      this.#o.store.addMessage({ sessionId: this.#o.sessionId, role: 'system', content: this.#history[0]?.content ?? null, anonymized: this.#o.gateway.info.anonymizeRequired });
      for (const message of this.#o.resume ?? []) {
        this.#history.push(message);
        this.#o.store.addMessage({ sessionId: this.#o.sessionId, role: message.role, content: message.content, anonymized: this.#o.gateway.info.anonymizeRequired });
      }
      this.#started = true;
    }
    this.#history.push({ role: 'user', content: userText });
    this.#o.store.addMessage({ sessionId: this.#o.sessionId, role: 'user', content: userText, anonymized: this.#o.gateway.info.anonymizeRequired });

    const maxRounds = this.#o.maxRounds ?? 8;
    let rounds = 0;
    let toolCalls = 0;
    let refused = 0;
    let answer = '';

    while (rounds < maxRounds) {
      rounds += 1;
      this.#o.onEvent?.({ type: 'round', round: rounds, maxRounds });
      const onText = this.#o.stream ? (delta: string) => this.#o.onEvent?.({ type: 'text', delta }) : undefined;
      const completion = await this.#o.gateway.complete({
        messages: this.#history,
        tools: this.#o.tools,
        ...(onText ? { onText } : {}),
      });
      const message = completion.message;
      this.#history.push(message);
      this.#o.store.addMessage({
        sessionId: this.#o.sessionId,
        role: 'assistant',
        content: message.content,
        anonymized: this.#o.gateway.info.anonymizeRequired,
      });
      if (message.content) {
        this.#o.onEvent?.({ type: 'assistant', text: message.content, streamed: completion.streamed === true });
        answer = message.content;
      }
      const calls = message.toolCalls ?? [];
      if (calls.length === 0) return { answer, rounds, maxRounds, toolCalls, refused };

      for (const call of calls) {
        toolCalls += 1;
        this.#o.onEvent?.({ type: 'tool-call', tool: call.name, args: call.arguments });
        const outcome = await this.#o.engine.handle({ tool: call.name, args: call.arguments });
        if (outcome.plan) this.#o.onEvent?.({ type: 'plan', operation: outcome.plan.operation, text: outcome.plan.message });
        this.#o.onEvent?.({
          type: 'tool-answer',
          tool: call.name,
          ok: outcome.ok,
          stage: outcome.stage,
          summary: summarize(outcome.payload),
        });
        if (!outcome.ok) refused += 1;
        this.#history.push({ role: 'tool', content: JSON.stringify(outcome.payload), toolCallId: call.id });
        this.#o.store.addMessage({
          sessionId: this.#o.sessionId,
          role: 'tool',
          content: JSON.stringify(outcome.payload),
          toolCallId: call.id,
          anonymized: this.#o.gateway.info.anonymizeRequired,
        });
      }
    }

    this.#o.onEvent?.({ type: 'round-limit', rounds });
    return { answer: answer || 'I stopped after too many rounds without an answer.', rounds, maxRounds, toolCalls, refused };
  }
}

function summarize(payload: Record<string, unknown>): string {
  const status = typeof payload.status === 'string' ? payload.status : '';
  const message = typeof payload.message === 'string' ? payload.message : '';
  const code = typeof payload.code === 'string' ? payload.code : '';
  return [status, code, message].filter(Boolean).join(' · ').slice(0, 200) || '(no status)';
}
