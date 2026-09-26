/**
 * Types for the JavaScript fake kit, so the TypeScript tests get real checking without duplicating the shapes.
 * The implementation is `fake-kit.mjs`; this file is the contract of the *fixture*, not of the kit.
 */

export interface FakeParameterSpec {
  Name: string;
  Type: string;
  Mandatory: boolean;
}

export interface FakeOperationSpec {
  Name: string;
  Kind: 'Read' | 'Change';
  Suite: string;
  Interactive: boolean;
  Available: boolean;
  Description: string;
  Parameters: FakeParameterSpec[];
}

export interface FakeRequest {
  operation?: string;
  parameters?: Record<string, unknown>;
  apply?: boolean;
  approved?: boolean;
  anonymize?: boolean;
  culture?: string;
  list?: boolean;
}

export interface FakeResult {
  ApiVersion: string;
  /** The kit's own version, part of the result since ApiVersion 1.1. */
  KitVersion: string;
  Operation: string;
  Kind: 'Read' | 'Change';
  Success: boolean;
  Status: string;
  Applied: boolean;
  Message: string;
  Warnings: string[];
  Errors: string[];
  Changes: Array<{ Kind: string; Target: string; Detail: string }>;
  Backups: string[];
  Approvals: string[];
  Duration: number;
  StartedAt: string;
  Data: Record<string, unknown> | null;
}

export declare const API_VERSION: string;
export declare const KIT_VERSION: string;
export declare const FAKE_PERSON: { user: string; profile: string; computer: string; sid: string; ip: string; email: string };
export declare const SYNTH_RETROBAT: string;
export declare function catalog(): FakeOperationSpec[];
export declare function defaultState(): Record<string, unknown>;
export declare function handle(request: FakeRequest, context?: { state?: Record<string, unknown> }): { result: FakeResult; exitCode: number };
export declare function exitCodeFor(result: FakeResult): number;
export declare function anonymizeDeep<T>(value: T): T;
export declare function parsePowerShellArgv(argv: readonly string[]): FakeRequest & { parametersJsonError?: string };
