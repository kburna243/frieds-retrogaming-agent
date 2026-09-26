/**
 * The fake kit in-process (a `KitTransport`), for unit tests that do not need a child process.
 *
 * The process variant next to it (`fake-kit-process.mjs`) is used when the transport itself is under test.
 */

import type { KitRawCall, KitRequest, KitTransport } from '../../src/kit/transport.ts';
import { buildKitArgv } from '../../src/kit/transport.ts';
import { defaultState, handle } from './fake-kit.mjs';

export interface FakeKitOptions {
  /** A cabinet with a different starting condition (e.g. everything already fine). */
  state?: Record<string, unknown>;
  /** Simulate a kit that speaks another ApiVersion. */
  apiVersion?: string;
  /** Simulate a kit that answers nonsense (contract violation). */
  breakJson?: boolean;
  /** Count every request, so a test can assert what actually reached the cabinet. */
  calls?: KitRequest[];
}

export class FakeKitTransport implements KitTransport {
  readonly label = 'fake';
  readonly state: Record<string, unknown>;
  readonly calls: KitRequest[];
  readonly argvs: string[][] = [];
  #apiVersion: string | undefined;
  #breakJson: boolean;

  constructor(options: FakeKitOptions = {}) {
    // Always start from a whole cabinet; a test overrides single fields, never replaces the state.
    this.state = { ...defaultState(), ...(options.state ?? {}) };
    this.calls = options.calls ?? [];
    this.#apiVersion = options.apiVersion;
    this.#breakJson = options.breakJson ?? false;
  }

  /** What the fake cabinet actually did — the assertions a policy test needs. */
  appliedOperations(): string[] {
    return this.calls.filter((call) => call.apply).map((call) => String(call.operation));
  }

  async call(request: KitRequest): Promise<KitRawCall> {
    this.calls.push(request);
    this.argvs.push([...buildKitArgv('C:\\fake-kit', request)]);
    if (this.#breakJson) {
      return { exitCode: 0, stdout: 'what if: nothing\nnot json at all', stderr: '', argv: this.argvs[this.argvs.length - 1] ?? [] };
    }
    const { result, exitCode } = handle({ ...request, list: request.operation === 'operations' && request.parameters?.__list === true }, { state: this.state });
    const payload = this.#apiVersion ? { ...result, ApiVersion: this.#apiVersion } : result;
    return { exitCode, stdout: JSON.stringify(payload), stderr: '', argv: this.argvs[this.argvs.length - 1] ?? [] };
  }
}
