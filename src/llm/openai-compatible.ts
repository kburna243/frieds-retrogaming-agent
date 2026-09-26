/**
 * OpenAI-compatible chat backend — covers Ollama (`http://127.0.0.1:11434/v1`), llama.cpp's server and every cloud
 * provider with the same shape. One exception: for `provider: 'cloud'` the body is checked before it is sent, so a
 * forgotten `-Anonymize` becomes a refusal instead of a leak.
 *
 * The API key is read here and nowhere else; it is never logged, never stored, never part of an error message.
 */

import type { ChatMessage, Completion, CompletionRequest, ModelGateway, ModelInfo } from './gateway.ts';
import { toOpenAiTools } from './gateway.ts';
import { assertSafeForCloud } from './redact.ts';

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  model: string;
  provider: 'local' | 'cloud';
  /** Read from the environment by `src/config.ts`; this module never touches `process.env`. */
  apiKey?: string;
  timeoutMs?: number;
  /**
   * Ask for a streamed answer when the caller wants text as it arrives (default true). An endpoint that ignores
   * `stream` and answers with one JSON document still works: the gateway reads whichever it gets.
   */
  stream?: boolean;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

interface WireMessage {
  role: string;
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

export class OpenAiCompatibleGateway implements ModelGateway {
  readonly info: ModelInfo;
  readonly #baseUrl: string;
  readonly #model: string;
  readonly #apiKey: string | undefined;
  readonly #timeoutMs: number;
  readonly #stream: boolean;
  readonly #fetch: typeof fetch;

  constructor(options: OpenAiCompatibleOptions) {
    if (!options.baseUrl) throw new Error('baseUrl is required (e.g. http://127.0.0.1:11434/v1 for Ollama)');
    if (!options.model) throw new Error('model is required (e.g. qwen2.5:7b for Ollama)');
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.#model = options.model;
    this.#apiKey = options.apiKey;
    this.#timeoutMs = options.timeoutMs ?? 180_000;
    this.#stream = options.stream ?? true;
    this.#fetch = options.fetchImpl ?? fetch;
    this.info = {
      provider: options.provider,
      baseUrl: this.#baseUrl,
      model: options.model,
      anonymizeRequired: options.provider === 'cloud',
    };
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    const body: Record<string, unknown> = {
      model: this.#model,
      messages: request.messages.map(toWireMessage),
      temperature: request.temperature ?? 0.2,
    };
    if (request.tools.length > 0) body.tools = toOpenAiTools(request.tools);
    const streaming = this.#stream && typeof request.onText === 'function';
    if (streaming) body.stream = true;

    const serialized = JSON.stringify(body);
    if (this.info.anonymizeRequired) {
      // Fail closed: a cloud request that still looks personal is refused here, before the socket opens.
      assertSafeForCloud(serialized, `chat completion for ${this.info.model}`);
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.#apiKey) headers.authorization = `Bearer ${this.#apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    request.signal?.addEventListener('abort', () => controller.abort());
    try {
      let response: Response;
      try {
        response = await this.#fetch(`${this.#baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: serialized,
          signal: controller.signal,
        });
      } catch (error) {
        throw new Error(
          `model ${this.info.model} at ${this.#baseUrl} is not reachable (${error instanceof Error ? error.message : String(error)}). ` +
            'For a local model check that Ollama runs; the kit itself needs no network.',
        );
      }

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 400);
        throw new Error(`model ${this.info.model} answered ${response.status}: ${detail || response.statusText}`);
      }

      const isStream = (response.headers.get('content-type') ?? '').includes('text/event-stream');
      if (streaming && isStream && response.body && request.onText) {
        return await readStream(response.body, request.onText);
      }
      return await readJson(response);
    } finally {
      // The timeout covers the whole answer, a streamed one included.
      clearTimeout(timer);
    }
  }
}

/** One JSON document: the non-streamed answer, or an endpoint that ignored `stream`. */
async function readJson(response: Response): Promise<Completion> {
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: WireToolCall[] }; finish_reason?: string }>;
  };
  const choice = json.choices?.[0];
  const message = choice?.message;
  const toolCalls = (message?.tool_calls ?? []).map((call) => ({
    id: call.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
    name: call.function?.name ?? '',
    arguments: safeParse(call.function?.arguments),
  }));

  return {
    finishReason: choice?.finish_reason ?? (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
    message: {
      role: 'assistant',
      content: typeof message?.content === 'string' && message.content.length > 0 ? message.content : null,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    },
  };
}

interface StreamChunk {
  error?: { message?: string };
  choices?: Array<{
    delta?: { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> };
    finish_reason?: string | null;
  }>;
}

/**
 * Server-sent events, one `data:` line per chunk, `[DONE]` at the end. Text deltas go straight to `onText`; tool
 * call pieces (id, name, argument text) are collected per index and parsed only once the stream has ended.
 */
async function readStream(body: ReadableStream<Uint8Array>, onText: (delta: string) => void): Promise<Completion> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let finishReason = '';
  const calls = new Map<number, { id?: string; name: string; args: string }>();

  const handleLine = (raw: string): void => {
    const line = raw.trim();
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(data) as StreamChunk;
    } catch {
      return; // a keep-alive or a broken line: the rest of the stream still counts
    }
    if (chunk.error) throw new Error(`the model stream reported an error: ${chunk.error.message ?? 'unknown'}`);
    const choice = chunk.choices?.[0];
    if (!choice) return;
    const delta = choice.delta ?? {};
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      content += delta.content;
      onText(delta.content);
    }
    for (const piece of delta.tool_calls ?? []) {
      const last = calls.get(calls.size - 1);
      // Without an index, a new id starts a new call; anything else continues the last one.
      const index = piece.index ?? (piece.id && last?.id && last.id !== piece.id ? calls.size : Math.max(0, calls.size - 1));
      const entry = calls.get(index) ?? { name: '', args: '' };
      if (piece.id) entry.id = piece.id;
      if (piece.function?.name) entry.name += piece.function.name;
      if (piece.function?.arguments) entry.args += piece.function.arguments;
      calls.set(index, entry);
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
  }
  buffer += decoder.decode();
  if (buffer) handleLine(buffer);

  const toolCalls = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => ({ id: call.id ?? `call_${Math.random().toString(36).slice(2, 10)}`, name: call.name, arguments: safeParse(call.args) }));
  return {
    finishReason: finishReason || (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
    streamed: true,
    message: {
      role: 'assistant',
      content: content.length > 0 ? content : null,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    },
  };
}

interface WireToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

function toWireMessage(message: ChatMessage): WireMessage {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.toolCallId };
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

function safeParse(text: string | undefined): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    // A model that writes broken JSON gets its own error back as the tool answer, not a crash here.
    return { __unparsable: text.slice(0, 200) };
  }
}
