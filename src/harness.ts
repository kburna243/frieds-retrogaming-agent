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
import { McpKitTransport } from './kit/mcp-transport.ts';
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
  /** What the model is offered. At level read-only this is the read subset of `allTools`. */
  readonly tools: ToolDefinition[];
  /** Everything the catalog describes — what the engine checks against, and what `run` resolves a name from. */
  readonly allTools: ToolDefinition[];
  readonly catalog: OperationSpec[];
  readonly engine: PolicyEngine;
  readonly gateway: ModelGateway;
  /** The kit's version as the kit reports it (MCP `serverInfo`), else null. Never read from kit files. */
  readonly kitVersion: string | null;
  close(): void;
}

export async function createHarness(config: HarnessConfig, options: HarnessOptions = {}): Promise<Harness> {
  const level = options.level ?? config.level;
  const anonymize = config.anonymize || (options.gateway?.info.anonymizeRequired ?? false);
  const transport: KitTransport = options.transport ?? defaultTransport(config, level, anonymize);
  const client = new KitClient(transport);

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

  // A transport with a long-lived server starts it now, so a server that does not come up stops the start-up and
  // not the first tool call. The kit version is whatever the kit itself says, or nothing.
  await transport.connect?.();
  const kitVersion = transport.kitVersion ?? null;

  const allTools = buildTools(catalog);
  const tools = level === 'read-only' ? filterReadTools(allTools) : allTools;

  mkdirSync(dirname(config.dbPath), { recursive: true });
  const store = Store.open(config.dbPath);
  const session = store.startSession({
    permissionLevel: level,
    model: gateway.info.model,
    provider: gateway.info.provider,
    apiVersion: client.apiVersion,
    kitVersion,
    note: `tools=${tools.length} catalog=${catalog.length} transport=${transport.label}`,
  });

  const engine = new PolicyEngine({
    client,
    store,
    sessionId: session.id,
    level,
    human: options.human ?? new NeverApprovesGateway(),
    anonymize,
    // The engine sees every tool: the level is a rule it applies, not a set of tools it never hears about.
    tools: allTools,
    culture: config.culture,
  });

  return {
    config,
    client,
    store,
    sessionId: session.id,
    tools,
    allTools,
    catalog,
    engine,
    gateway,
    kitVersion,
    close: () => {
      store.endSession(session.id);
      store.close();
      void transport.close?.();
    },
  };
}

/** stdio is the reference. MCP is only used when asked for, and even then the catalog comes from `Invoke-KitApi.ps1`. */
function defaultTransport(config: HarnessConfig, level: PermissionLevel, anonymize: boolean): KitTransport {
  const stdio = new StdioKitTransport({ kitRoot: config.kitRoot });
  if (config.transport !== 'mcp') return stdio;
  return new McpKitTransport({
    kitRoot: config.kitRoot,
    catalogTransport: stdio,
    anonymize,
    // Defence in depth: at read-only the server itself offers no change tool.
    readOnly: level === 'read-only',
    culture: config.culture,
  });
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
