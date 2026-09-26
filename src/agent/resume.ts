/**
 * `fagent chat --continue`: pick up an earlier conversation.
 *
 * What comes back is the words, not the machinery: user and assistant text only. Tool answers stay behind, because
 * they are kit results from then (history, not state) and because the model has to ask the kit again anyway. A
 * "yes" in the old conversation is only a word here: approvals never travel in messages, and the gate asks the
 * person again for every change.
 *
 * For a model that needs `-Anonymize`, only messages that were recorded for such a model come along, and any that
 * still looks personal is left out. The gateway's `assertSafeForCloud()` stays behind all of this.
 */

import type { Store } from '../db/store.ts';
import type { ChatMessage } from '../llm/gateway.ts';
import { findPersonalData } from '../llm/redact.ts';

export interface ResumeOptions {
  currentSessionId: string;
  /** A specific session; without it, the newest one in which a person wrote something. */
  sessionId?: string;
  anonymizeRequired: boolean;
  /** At most this many messages, the newest ones (default 20). */
  maxMessages?: number;
}

export interface Resumed {
  fromSessionId: string;
  messages: ChatMessage[];
  /** Messages left out because they may not reach this model. */
  withheld: number;
}

/** Nothing to continue, or a session that does not exist: the person has to know, not a model. */
export class ResumeError extends Error {}

export function resumeConversation(store: Store, options: ResumeOptions): Resumed {
  const fromSessionId = options.sessionId ?? store.lastConversation(options.currentSessionId);
  if (!fromSessionId) throw new ResumeError('there is no earlier conversation to continue');
  if (fromSessionId === options.currentSessionId || !store.session(fromSessionId)) {
    throw new ResumeError(`no earlier session ${fromSessionId} in this database`);
  }

  let withheld = 0;
  const messages: ChatMessage[] = [];
  for (const row of store.messages(fromSessionId)) {
    const role = String(row.role);
    const content = typeof row.content === 'string' ? row.content : '';
    if ((role !== 'user' && role !== 'assistant') || content.trim() === '') continue;
    if (options.anonymizeRequired && (Number(row.anonymized) !== 1 || findPersonalData(content).length > 0)) {
      withheld += 1;
      continue;
    }
    messages.push({ role, content });
  }

  const kept = messages.slice(-(options.maxMessages ?? 20));
  // A conversation starts with the person, never with an answer to a question that is no longer there.
  while (kept.length > 0 && kept[0]?.role !== 'user') kept.shift();
  return { fromSessionId, messages: kept, withheld };
}
