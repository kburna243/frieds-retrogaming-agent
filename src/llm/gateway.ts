/**
 * The model gateway.
 *
 * One interface, two kinds of backend: a local model on this PC (Ollama, llama.cpp server, …) and a cloud provider
 * (anything OpenAI-compatible). The difference that matters is not the API — it is `anonymizeRequired`: a model
 * that is not on this machine may only ever see results the kit produced with `-Anonymize`.
 */

import type { ToolDefinition } from '../kit/tools.ts';
import type { PlainValue } from '../kit/types.ts';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  /** Assistant only. */
  toolCalls?: ChatToolCall[];
  /** `role: 'tool'` only: which call this answer belongs to. */
  toolCallId?: string;
}

export interface ModelInfo {
  /** `local` runs on this PC · `cloud` runs somewhere else. */
  provider: 'local' | 'cloud';
  baseUrl: string;
  model: string;
  /** True for every `cloud` model. The policy then forces `-Anonymize` on all kit calls. */
  anonymizeRequired: boolean;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  temperature?: number;
  signal?: AbortSignal;
  /**
   * Streaming: called with each piece of assistant text as it arrives. Only text is streamed. Tool calls are
   * assembled whole and come back in the `Completion`, so the gate never sees half a call.
   */
  onText?: (delta: string) => void;
}

export interface Completion {
  message: ChatMessage;
  /** `tool_calls` | `stop` — whatever the backend reported. */
  finishReason: string;
  /** True when the text of `message` already went out through `onText`. */
  streamed?: boolean;
}

export interface ModelGateway {
  readonly info: ModelInfo;
  complete(request: CompletionRequest): Promise<Completion>;
}

/** The wire shape both a local Ollama and any cloud provider speak. */
export interface OpenAiToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export function toOpenAiTools(tools: ToolDefinition[]): OpenAiToolSpec[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters as unknown as Record<string, unknown> },
  }));
}

export function plainValueToString(value: PlainValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value);
}
