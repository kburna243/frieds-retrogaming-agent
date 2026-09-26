/**
 * The composition root: config in, wired harness out.
 *
 * This is the only place that decides which transport and which model are used. If the kit's MCP server arrives,
 * the transport is swapped here and nowhere else.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HarnessConfig } from './config.ts';
import { KitClient, ApiVersionMismatchError } from './kit/client.ts';
import type { KitTransport } from './kit/transport.ts';
import { StdioKitTransport } from './kit/stdio-transport.ts';
import { buildTools, filterReadTools, type ToolDefinition } from './kit/tools.ts';
import type { OperationSpec } from './kit/types.ts';
import { Store } from './db/store.ts';
import { PolicyEngine, type PermissionLevel } from './policy/engine.ts';
import type { HumanGateway } from './policy/human.ts';
import { NeverApprovesGateway } from './policy/human.ts';
import type { ModelGateway } from './llm/gateway.ts';
import { OpenAiCompatibleGateway } from './llm/openai-compatible.ts';

export interface HarnessOptions {
  /** Injected in tests (the fake kit) and later for the MCP transport. */
  transport?: KitTransport;
  human?: HumanGateway;
  gateway?: ModelGateway;
  /** Overrides the config level; used by `--dry-run-only`. */
  level?: PermissionLevel;
}

export interface Harness {
  readonly config: HarnessConfig;
  readonly client: KitClient;
  readonly store: Store;
  readonly sessionId: string;
  readonly tools: ToolDefinition[];
  readonly catalog: OperationSpec[];
  readonly engine: PolicyEngine;
  readonly gateway: ModelGateway;
  /** The kit's version is not part of API v1 — only `ApiVersion` is pinned. Never read from kit files. */
  readonly kitVersion: string | null;
  close(): void;
}

export async function createHarness(config: HarnessConfig, options: HarnessOptions = {}): Promise<Harness> {
  const transport: KitTransport = options.transport ?? new StdioKitTransport({ kitRoot: config.kitRoot });
  const client = new KitClient(transport);
  const level = options.level ?? config.level;
  const anonymize = config.anonymize || (options.gateway?.info.anonymizeRequired ?? false);

  const gateway =
    options.gateway ??
    new OpenAiCompatibleGateway({
      baseUrl: config.model.baseUrl,
      model: config.model.model,
      provider: config.model.provider,
      ...(config.model.apiKey ? { apiKey: config.model.apiKey } : {}),
    });

  // The catalog decides what exists. A wrong ApiVersion major leaves the harness with no tools at all.
  let catalog: OperationSpec[];
  try {
    catalog = await client.catalog({ anonymize });
  } catch (error) {
    if (error instanceof ApiVersionMismatchError) {
      store_failure(config, level, gateway, error.message);
      throw error;
    }
    throw error;
  }

  const allTools = buildTools(catalog);
  const tools = level === 'read-only' ? filterReadTools(allTools) : allTools;

  mkdirSync(dirname(config.dbPath), { recursive: true });
  const store = Store.open(config.dbPath);
  const session = store.startSession({
    permissionLevel: level,
    model: gateway.info.model,
    provider: gateway.info.provider,
    apiVersion: client.apiVersion,
    kitVersion: null,
    note: `tools=${tools.length} catalog=${catalog.length}`,
  });

  const engine = new PolicyEngine({
    client,
    store,
    sessionId: session.id,
    level,
    human: options.human ?? new NeverApprovesGateway(),
    anonymize,
    tools,
    culture: config.culture,
  });

  return {
    config,
    client,
    store,
    sessionId: session.id,
    tools,
    catalog,
    engine,
    gateway,
    kitVersion: null,
    close: () => {
      store.endSession(session.id);
      store.close();
      transport.close?.();
    },
  };
}

/** A refused start-up is still an event worth finding in the database later. */
function store_failure(config: HarnessConfig, level: PermissionLevel, gateway: ModelGateway, reason: string): void {
  try {
    mkdirSync(dirname(config.dbPath), { recursive: true });
    const store = Store.open(config.dbPath);
    const session = store.startSession({ permissionLevel: level, model: gateway.info.model, provider: gateway.info.provider, note: 'startup refused' });
    store.recordToolCall({
      sessionId: session.id,
      tool: '(startup)',
      operation: 'operations',
      kind: 'Refused',
      parameters: {},
      apply: false,
      approved: false,
      anonymize: false,
      stage: 'refused',
      status: 'ApiVersionMismatch',
      exitCode: null,
      duration: null,
      argv: null,
      message: null,
      resultDigest: null,
      error: reason,
    });
    store.endSession(session.id);
    store.close();
  } catch {
    // The audit log must never be the reason a refusal is not reported.
  }
}
