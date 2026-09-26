/**
 * The second transport: the kit's MCP server over stdio (`api\Start-KitMcpServer.ps1`, kit v0.3.0, API.md).
 *
 * One long-lived Windows PowerShell process instead of one per call, JSON-RPC 2.0 with one message per line, no
 * port. It sits behind the same `KitTransport` seam as the one-shot transport, so nothing above it changes: the
 * tool definitions still come from the catalog, and the gate still decides.
 *
 * Three things are different from the one-shot call, and each is handled here rather than papered over:
 *
 * - **The catalog is not an MCP tool.** The server leaves out `operations` (and with it `Interactive` and the
 *   `ApiVersion` of the catalog). So `operations` goes to the reference transport, `Invoke-KitApi.ps1`, and every
 *   other operation goes over MCP. Nothing is reconstructed from `tools/list`.
 * - **`apply` and `approved` are tool arguments there.** The model never sees these tools: `KitRequest.apply` and
 *   `.approved` (set only by `PolicyEngine`) become the two arguments here, and a parameter whose name collides with
 *   them — in any case, because the server compares like PowerShell does — is refused before anything is sent.
 * - **Anonymizing is a property of the server, not of the call.** The server is started with or without
 *   `-NoAnonymize` once. A request that asks for `-Anonymize` from a server that does not anonymize is refused;
 *   it never falls back to real paths.
 *
 * There are no exit codes over MCP. This transport reports 0 when the result succeeded, 1 when it did not and 2 for
 * `NotAvailable`, so the audit trail reads the same for both transports. A request it will not send (a reserved
 * parameter name, an anonymize mismatch, a tool the server does not offer, a JSON-RPC error) is thrown as a
 * `KitContractError` with code `MCP_REFUSED`, which the gate turns into a refusal the model can read.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { KitRawCall, KitRequest, KitTransport } from './transport.ts';
import { windowsPowerShellPath } from './transport.ts';
import type { KitCulture } from './types.ts';
import { KitContractError } from './client.ts';

/** Protocol versions the kit's server supports (API.md); the first is what we ask for. */
export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

/** Tool arguments the server reads as `-Apply` / `-Approved`. Compared without regard to case, like PowerShell. */
const RESERVED_ARGUMENTS = new Set(['apply', 'approved']);

export interface McpTransportOptions {
  kitRoot: string;
  /** Answers `operations` (the catalog and its ApiVersion). In production the one-shot stdio transport. */
  catalogTransport: KitTransport;
  /** Start the server without `-NoAnonymize`. Must be true for a cloud model. */
  anonymize: boolean;
  /** Start the server with `-ReadOnly`: it then offers the read tools only. */
  readOnly: boolean;
  culture?: KitCulture;
  /** Tests only: the executable and what goes in front of the server's argument vector. */
  executable?: string;
  prependArgs?: readonly string[];
  /** Milliseconds per request; a wizard step's dry run can take a while. */
  timeoutMs?: number;
  allowNonWindows?: boolean;
}

/** The server's argument vector, as a pure function so it can be tested anywhere. */
export function buildMcpServerArgv(kitRoot: string, options: { anonymize: boolean; readOnly: boolean; culture?: KitCulture }): string[] {
  const argv = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${kitRoot.replace(/[\\/]+$/, '')}\\api\\Start-KitMcpServer.ps1`];
  if (options.readOnly) argv.push('-ReadOnly');
  if (!options.anonymize) argv.push('-NoAnonymize');
  if (options.culture) argv.push('-Culture', options.culture);
  return argv;
}

/** `backup.restore` → `backup_restore`, `step.lightgun.10-teknoparrot` → `step_lightgun_10-teknoparrot` (API.md). */
export function mcpToolName(operation: string): string {
  return operation.replace(/[^A-Za-z0-9_-]/g, '_');
}

interface Pending {
  resolve: (message: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

export class McpKitTransport implements KitTransport {
  readonly label = 'mcp-stdio';
  readonly #o: McpTransportOptions;
  readonly #executable: string;
  readonly #argv: string[];
  #child: ChildProcessWithoutNullStreams | null = null;
  #connecting: Promise<void> | null = null;
  #nextId = 1;
  readonly #pending = new Map<number, Pending>();
  #stderr = '';
  #tools = new Set<string>();
  #kitVersion: string | null = null;
  #protocolVersion: string | null = null;
  #closed = false;

  constructor(options: McpTransportOptions) {
    if (!options.kitRoot) throw new Error('kitRoot is required: the harness needs the path of the kit checkout');
    if (process.platform !== 'win32' && !options.allowNonWindows) {
      throw new Error(
        `the kit's MCP server runs on the cabinet (Windows): this transport needs Windows, got ${process.platform}. ` +
          'Test against test/kit/fake-kit-mcp.mjs instead.',
      );
    }
    this.#o = options;
    this.#executable = options.executable ?? windowsPowerShellPath();
    this.#argv = [...(options.prependArgs ?? []), ...buildMcpServerArgv(options.kitRoot, options)];
  }

  /** What the server said about itself in `initialize`. The only place the kit's own version reaches the harness. */
  get kitVersion(): string | null {
    return this.#kitVersion;
  }

  get protocolVersion(): string | null {
    return this.#protocolVersion;
  }

  /** Tools the server offers, by MCP name. */
  get toolNames(): ReadonlySet<string> {
    return this.#tools;
  }

  /** Starts the server and does the handshake once. Safe to call more than once. */
  connect(): Promise<void> {
    if (this.#closed) return Promise.reject(new Error('the MCP transport is closed'));
    this.#connecting ??= this.#start();
    return this.#connecting;
  }

  async call(request: KitRequest): Promise<KitRawCall> {
    if (request.operation === 'operations') return this.#o.catalogTransport.call(request);

    const tool = mcpToolName(request.operation);
    const args: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request.parameters ?? {})) {
      if (RESERVED_ARGUMENTS.has(key.toLowerCase())) {
        return refusal([tool], `parameter ${key} would reach the kit's MCP server as the ${key.toLowerCase()} flag; refused`);
      }
      args[key] = value;
    }
    if (request.anonymize && !this.#o.anonymize) {
      return refusal([tool], 'this call must be anonymized, but the MCP server was started with -NoAnonymize; refused');
    }
    if (request.culture && this.#o.culture && request.culture !== this.#o.culture) {
      return refusal([tool], `the MCP server speaks ${this.#o.culture}, the call asked for ${request.culture}; refused`);
    }
    // Only the gate sets these two, and only after a human said yes to the plan they belong to.
    if (request.apply) args.apply = true;
    if (request.approved) args.approved = true;

    const audit = ['mcp', 'tools/call', tool, JSON.stringify(args)];
    try {
      await this.connect();
    } catch (error) {
      return { exitCode: -1, stdout: '', stderr: `could not start the kit's MCP server: ${messageOf(error)}${this.#stderrTail()}`, argv: audit };
    }
    if (!this.#tools.has(tool)) {
      const why = this.#o.readOnly ? ' (the server runs with -ReadOnly)' : '';
      return refusal(audit, `the kit's MCP server does not offer ${tool}${why}`);
    }

    let response: JsonRpcResponse;
    try {
      response = await this.#request('tools/call', { name: tool, arguments: args });
    } catch (error) {
      return { exitCode: -1, stdout: '', stderr: `${messageOf(error)}${this.#stderrTail()}`, argv: audit };
    }
    if (response.error) {
      return refusal(audit, `JSON-RPC error ${response.error.code}: ${response.error.message}`);
    }
    const text = firstText(response.result);
    if (text === null) {
      return { exitCode: -1, stdout: '', stderr: 'the MCP result had no text content', argv: audit };
    }
    return { exitCode: exitCodeFor(text, response.result?.isError === true), stdout: text, stderr: '', argv: audit };
  }

  async close(): Promise<void> {
    this.#closed = true;
    const child = this.#child;
    this.#child = null;
    this.#failAll(new Error('the MCP transport was closed'));
    await this.#o.catalogTransport.close?.();
    if (!child) return;
    // The server ends when its standard input closes; a stuck one is killed.
    child.stdin.end();
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    const timer = setTimeout(() => child.kill(), 2000);
    await exited;
    clearTimeout(timer);
  }

  async #start(): Promise<void> {
    const child = spawn(this.#executable, this.#argv, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.#child = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      this.#stderr = (this.#stderr + chunk).slice(-4000);
    });
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => this.#onLine(line));
    child.on('error', (error) => this.#failAll(error));
    child.on('exit', (code) => this.#failAll(new Error(`the kit's MCP server exited (code ${String(code)})`)));

    const init = await this.#request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSIONS[0],
      capabilities: {},
      clientInfo: { name: 'frieds-retrogaming-agent', version: '0' },
    });
    if (init.error) throw new Error(`initialize failed: ${init.error.message}`);
    const result = init.result ?? {};
    const protocol = String(result.protocolVersion ?? '');
    if (!(MCP_PROTOCOL_VERSIONS as readonly string[]).includes(protocol)) {
      throw new Error(`the server answered with protocol ${protocol || 'nothing'}; supported: ${MCP_PROTOCOL_VERSIONS.join(', ')}`);
    }
    this.#protocolVersion = protocol;
    const info = result.serverInfo as { version?: unknown } | undefined;
    this.#kitVersion = typeof info?.version === 'string' && info.version ? info.version : null;
    this.#notify('notifications/initialized');

    const listed = await this.#request('tools/list', {});
    if (listed.error) throw new Error(`tools/list failed: ${listed.error.message}`);
    const tools = (listed.result?.tools ?? []) as Array<{ name?: unknown }>;
    this.#tools = new Set(tools.map((tool) => String(tool.name)));
  }

  #request(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
    const child = this.#child;
    if (!child) return Promise.reject(new Error('the kit MCP server is not running'));
    const id = this.#nextId++;
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`the kit's MCP server did not answer ${method} within ${this.#o.timeoutMs ?? 600_000} ms`));
      }, this.#o.timeoutMs ?? 600_000);
      this.#pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  #notify(method: string): void {
    this.#child?.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  }

  #onLine(line: string): void {
    if (!line.trim()) return;
    let message: JsonRpcResponse;
    try {
      message = JSON.parse(line) as JsonRpcResponse;
    } catch {
      // Standard output belongs to the protocol; anything else there is the server's bug, kept for the error text.
      this.#stderr = `${this.#stderr}\n[stdout, not JSON] ${line.slice(0, 200)}`.slice(-4000);
      return;
    }
    if (typeof message.id !== 'number') return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }

  #failAll(error: Error): void {
    for (const [id, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.#pending.delete(id);
    }
  }

  #stderrTail(): string {
    const tail = this.#stderr.trim().slice(-400);
    return tail ? ` · stderr: ${tail}` : '';
  }
}

/** A request this transport will not send. Thrown, so the gate refuses it with the reason and not a parse error. */
function refusal(_argv: readonly string[], reason: string): never {
  throw new KitContractError('MCP_REFUSED', reason);
}

function firstText(result: Record<string, unknown> | undefined): string | null {
  const content = result?.content;
  if (!Array.isArray(content)) return null;
  const text = content.find((item): item is { type: 'text'; text: string } => item?.type === 'text' && typeof item.text === 'string');
  return text ? text.text : null;
}

function exitCodeFor(text: string, isError: boolean): number {
  try {
    const status = (JSON.parse(text) as { Status?: unknown }).Status;
    if (status === 'NotAvailable') return 2;
  } catch {
    // The client parses and reports it; the exit code does not matter then.
  }
  return isError ? 1 : 0;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
