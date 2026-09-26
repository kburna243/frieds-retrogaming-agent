/**
 * The real transport: one Windows PowerShell process per call, JSON over stdio.
 *
 * This is the only file in the harness that starts a process for the cabinet, and the only place that knows the
 * kit is reached that way. It never reads kit files, never imports kit modules, never opens a port.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { KitRawCall, KitRequest, KitTransport } from './transport.ts';
import { buildKitArgv, windowsPowerShellPath } from './transport.ts';

const execFileAsync = promisify(execFile);

export interface StdioTransportOptions {
  /** Root of the `frieds-retrogaming-kit` checkout, e.g. `D:\cabinet\frieds-retrogaming-kit`. */
  kitRoot: string;
  /** Override the executable in tests only; production always uses the full Windows PowerShell 5.1 path. */
  executable?: string;
  /**
   * Put in front of the built argument vector. Tests use it to run the fake kit process with its own flags;
   * production leaves it empty, so the argv is exactly what API.md documents.
   */
  prependArgs?: readonly string[];
  /** Milliseconds. A dry run of a wizard step can take a while; 10 minutes is the kit's own comfort zone. */
  timeoutMs?: number;
  /** Refuse to start anything that is not Windows unless this is explicitly overridden (tests). */
  allowNonWindows?: boolean;
}

export class StdioKitTransport implements KitTransport {
  readonly label = 'stdio-one-shot';
  readonly #kitRoot: string;
  readonly #executable: string;
  readonly #prependArgs: readonly string[];
  readonly #timeoutMs: number;

  constructor(options: StdioTransportOptions) {
    if (!options.kitRoot) throw new Error('kitRoot is required: the harness needs the path of the kit checkout');
    if (process.platform !== 'win32' && !options.allowNonWindows) {
      throw new Error(
        `the kit lives on the cabinet (Windows): this transport needs Windows, got ${process.platform}. ` +
          'Develop and test against the fake kit (test/kit/fake-kit.ts) and run the real calls with tools/Start-SmokeTest.ps1.',
      );
    }
    this.#kitRoot = options.kitRoot;
    this.#executable = options.executable ?? windowsPowerShellPath();
    this.#prependArgs = options.prependArgs ?? [];
    this.#timeoutMs = options.timeoutMs ?? 600_000;
  }

  async call(request: KitRequest): Promise<KitRawCall> {
    const argv = [...this.#prependArgs, ...buildKitArgv(this.#kitRoot, request)];
    try {
      // No shell: the argument vector goes straight to powershell.exe, so a parameter can never become a command.
      const { stdout, stderr } = await execFileAsync(this.#executable, argv, {
        maxBuffer: 32 * 1024 * 1024,
        timeout: this.#timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
      });
      return { exitCode: 0, stdout, stderr, argv };
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & { code?: number | string; stdout?: string; stderr?: string };
      if (typeof failure.code === 'number') {
        // The kit signals with the exit code; stdout still carries the JSON document.
        return { exitCode: failure.code, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '', argv };
      }
      const message = failure instanceof Error ? failure.message : String(failure);
      return { exitCode: -1, stdout: '', stderr: `could not start ${this.#executable}: ${message}`, argv };
    }
  }
}
