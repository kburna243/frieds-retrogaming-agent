/**
 * The transport seam.
 *
 * `KitTransport` is the only thing between the harness and the cabinet. Today it is a one-shot process
 * (`api\Invoke-KitApi.ps1`, JSON over stdio, no port). When the kit ships its MCP server on top of the same API,
 * a second implementation replaces this one and **nothing above changes**: the tool definitions come from the
 * catalog, not from the transport.
 */

import type { KitCulture, ParameterBag } from './types.ts';

/** One request to the kit. `apply`/`approved` are set by the policy engine — never by the model. */
export interface KitRequest {
  operation: string;
  parameters?: ParameterBag;
  apply?: boolean;
  approved?: boolean;
  anonymize?: boolean;
  culture?: KitCulture;
}

/** What the process returned: the raw document plus the exit code, before any interpretation. */
export interface KitRawCall {
  /** 0 success · 1 did not succeed · 2 refused (API.md). Other numbers mean the process itself failed. */
  exitCode: number;
  stdout: string;
  stderr: string;
  /** The exact argument vector used (or, for another transport, the message sent). Logged for the audit trail. */
  argv: readonly string[];
}

export interface KitTransport {
  /** `stdio-one-shot` | `mcp-stdio` | `fake`. Only for logging. */
  readonly label: string;
  call(request: KitRequest): Promise<KitRawCall>;
  close?(): void | Promise<void>;
}

/** Windows PowerShell 5.1 — the same launcher the kit's own `.cmd` files use, always by full path. */
export function windowsPowerShellPath(env: NodeJS.ProcessEnv = process.env): string {
  const systemRoot = env.SystemRoot ?? env.windir ?? 'C:\\Windows';
  return `${systemRoot.replace(/\\+$/, '')}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
}

/** The entry script of the kit API, given a kit root. */
export function kitApiScript(kitRoot: string): string {
  return `${kitRoot.replace(/[\\/]+$/, '')}\\api\\Invoke-KitApi.ps1`;
}

/**
 * The argument vector of one call, as a pure function so it can be tested on any platform.
 *
 * `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <kit>\api\Invoke-KitApi.ps1
 *   -Operation <name> [-ParametersJson <json object>] [-Apply] [-Approved] [-Anonymize] [-Culture <c>]`
 */
export function buildKitArgv(kitRoot: string, request: KitRequest): string[] {
  const argv = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    kitApiScript(kitRoot),
    '-Operation',
    request.operation,
  ];
  const parameters = request.parameters ?? {};
  if (Object.keys(parameters).length > 0) {
    argv.push('-ParametersJson', JSON.stringify(parameters));
  }
  if (request.apply) argv.push('-Apply');
  if (request.approved) argv.push('-Approved');
  if (request.anonymize) argv.push('-Anonymize');
  if (request.culture) argv.push('-Culture', request.culture);
  return argv;
}
