/**
 * Kit client: transport in front, typed contract behind.
 *
 * Responsibilities, and nothing else:
 *  - call the transport, parse the one JSON document,
 *  - pin the ApiVersion major (API.md: a different major is a breaking change -> refuse every tool),
 *  - cache the catalog for the process lifetime (it is the kit's, we do not invent operations),
 *  - refuse requests that are not plain parameters or not in the catalog, before a process is started.
 */

import type { KitRequest, KitTransport } from './transport.ts';
import {
  SUPPORTED_API_MAJOR,
  apiMajor,
  isPlainValue,
  parseKitResult,
  readCatalog,
  type OperationResult,
  type OperationSpec,
  type ParameterBag,
} from './types.ts';

export class KitContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'KitContractError';
    this.code = code;
  }
}

/** The ApiVersion major is not the one this harness was built for: refuse everything, say why. */
export class ApiVersionMismatchError extends KitContractError {
  readonly found: string;

  constructor(found: string) {
    super(
      'API_VERSION',
      `the kit speaks ApiVersion ${found || 'nothing'}; this harness is pinned to major ${SUPPORTED_API_MAJOR} — refusing to run any tool`,
    );
    this.found = found;
  }
}

export class KitCallError extends Error {
  readonly result: OperationResult;
  readonly exitCode: number;
  readonly argv: readonly string[];
  readonly stderr: string;

  constructor(result: OperationResult, exitCode: number, argv: readonly string[], stderr: string) {
    super(`kit operation ${result.Operation} returned ${result.Status}: ${result.Message || '(no message)'}`);
    this.name = 'KitCallError';
    this.result = result;
    this.exitCode = exitCode;
    this.argv = argv;
    this.stderr = stderr;
  }
}

export interface KitCallOutcome {
  result: OperationResult;
  exitCode: number;
  argv: readonly string[];
  /** True for `Status = Ok | Done | Skipped | WhatIf` (API.md), independent of the exit code. */
  succeeded: boolean;
}

export class KitClient {
  readonly transport: KitTransport;
  #catalog: OperationSpec[] | null = null;
  #apiVersion: string | null = null;
  #kitVersion: string | null = null;

  constructor(transport: KitTransport) {
    this.transport = transport;
  }

  /** The last seen ApiVersion, once a call happened. */
  get apiVersion(): string | null {
    return this.#apiVersion;
  }

  /**
   * The kit's own version, once a call happened — `KitVersion` in every result since ApiVersion 1.1.
   *
   * This is the only way the harness learns it without reading anything of the kit: no file, no VERSION, no registry.
   * Over MCP the server handshake reports the same number; here it comes from the document itself, so both
   * transports agree. `null` until the first call, empty string from a kit older than 1.1.
   */
  get kitVersion(): string | null {
    return this.#kitVersion;
  }

  /**
   * The live operation catalog. Throws `ApiVersionMismatchError` on a different major — the caller then surfaces
   * the reason and offers no tools at all.
   */
  async catalog(options: { anonymize?: boolean; force?: boolean } = {}): Promise<OperationSpec[]> {
    if (this.#catalog && !options.force) return this.#catalog;
    const outcome = await this.call({ operation: 'operations', anonymize: options.anonymize });
    const specs = readCatalog(outcome.result);
    this.#catalog = specs;
    return specs;
  }

  async findOperation(name: string): Promise<OperationSpec | undefined> {
    const specs = await this.catalog();
    return specs.find((spec) => spec.Name === name);
  }

  /** Every request goes through here. Plain parameters and a known shape are checked before a process starts. */
  async call(request: KitRequest): Promise<KitCallOutcome> {
    if (!request.operation) throw new KitContractError('NO_OPERATION', 'no operation given');
    for (const [key, value] of Object.entries(request.parameters ?? {})) {
      if (!isPlainValue(value)) {
        throw new KitContractError(
          'PARAM_NOT_PLAIN',
          `parameter ${key} is not a plain value (string, number, boolean or string[]) — the kit refuses those anyway`,
        );
      }
    }

    const raw = await this.transport.call(request);
    let result: OperationResult;
    try {
      result = parseKitResult(raw.stdout);
    } catch (cause) {
      throw new KitContractError(
        'BAD_JSON',
        `the kit did not return one JSON document (exit ${raw.exitCode}): ${cause instanceof Error ? cause.message : String(cause)}${raw.stderr ? ` · stderr: ${raw.stderr.slice(0, 400)}` : ''}`,
      );
    }

    this.#apiVersion = result.ApiVersion;
    if (result.KitVersion) this.#kitVersion = result.KitVersion;
    if (apiMajor(result.ApiVersion) !== SUPPORTED_API_MAJOR) throw new ApiVersionMismatchError(result.ApiVersion);

    return { result, exitCode: raw.exitCode, argv: raw.argv, succeeded: result.Success };
  }
}

/** Parameters of an operation as a plain bag, validated against the catalog. */
export function validateParameters(spec: OperationSpec, parameters: ParameterBag): string[] {
  const problems: string[] = [];
  const allowed = new Map(spec.Parameters.map((p) => [p.Name, p]));
  for (const key of Object.keys(parameters)) {
    if (!allowed.has(key)) problems.push(`unknown parameter: ${key}`);
  }
  for (const param of spec.Parameters) {
    if (param.Mandatory && !(param.Name in parameters)) problems.push(`missing parameter: ${param.Name}`);
  }
  return problems;
}
