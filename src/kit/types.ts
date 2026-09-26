/**
 * The Kit API wire format (contract/API.md, ApiVersion 1.1).
 *
 * Everything in this file is *the kit's* shape, not ours: PowerShell serializes PascalCase properties, so the
 * harness speaks PascalCase on the wire and never rewrites keys. Only `src/policy` and above use camelCase.
 *
 * Do not "improve" a field here. A field that changes meaning or disappears is a new major ApiVersion.
 */

/** Values a client may pass as an operation parameter (contract rule 3: plain parameters only). */
export type PlainValue = string | number | boolean | string[];

export type ParameterBag = Record<string, PlainValue>;

export type OperationKind = 'Read' | 'Change';

/** `Status` of an OperationResult. `Success` is `Ok | Done | Skipped | WhatIf`. */
export type OperationStatus =
  | 'Ok'
  | 'Done'
  | 'Skipped'
  | 'WhatIf'
  | 'NeedsUser'
  | 'Failed'
  | 'NotAvailable';

export type KitCulture = 'en-US' | 'de-DE';

/** One parameter of an operation, as the catalog reports it. */
export interface ParameterSpec {
  Name: string;
  /** `String`, `String[]`, `Int32`, `Int64`, `Boolean`, `switch` — nothing else is ever offered. */
  Type: string;
  Mandatory: boolean;
}

/** One entry of the operation catalog (`Get-KitOperation` / `-List`). */
export interface OperationSpec {
  Name: string;
  Kind: OperationKind;
  Suite: string;
  Interactive: boolean;
  Available: boolean;
  Description: string;
  Parameters: ParameterSpec[];
}

/** A single change an operation made or would make. */
export interface ChangeRecord {
  Kind: string;
  Target: string;
  Detail: string;
}

/** One step result inside `Data.Steps` of a step operation. */
export interface StepRecord {
  Name: string;
  Status: string;
  WhatIf: boolean;
  Message: string;
  Duration: number;
}

/** The single document `api\Invoke-KitApi.ps1` writes to standard output. */
export interface OperationResult {
  ApiVersion: string;
  /** The kit's own version, added in ApiVersion 1.1. Empty when an older kit answers. */
  KitVersion: string;
  Operation: string;
  Kind: OperationKind;
  Success: boolean;
  Status: OperationStatus;
  Applied: boolean;
  Message: string;
  Warnings: string[];
  Errors: string[];
  Changes: ChangeRecord[];
  Backups: string[];
  Approvals: string[];
  Duration: number;
  StartedAt: string;
  Data: Record<string, unknown> | null;
}

/** The exact field set the kit's contract tests pin (API.md "Result"). */
export const RESULT_FIELDS: readonly string[] = [
  'ApiVersion',
  'KitVersion',
  'Operation',
  'Kind',
  'Success',
  'Status',
  'Applied',
  'Message',
  'Warnings',
  'Errors',
  'Changes',
  'Backups',
  'Approvals',
  'Duration',
  'StartedAt',
  'Data',
];

/** Exit codes of `api\Invoke-KitApi.ps1`. */
export const KitExitCode = {
  Success: 0,
  NotSucceeded: 1,
  Refused: 2,
} as const;

/** The major ApiVersion this harness is built for. A different major refuses every tool. */
export const SUPPORTED_API_MAJOR = 1;

/** `1.0` -> `1`. Anything unparseable is `-1` and therefore unsupported. */
export function apiMajor(apiVersion: string | undefined): number {
  if (!apiVersion) return -1;
  const major = Number.parseInt(String(apiVersion).split('.')[0] ?? '', 10);
  return Number.isFinite(major) ? major : -1;
}

export function isPlainValue(value: unknown): value is PlainValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Parses the one JSON document the kit writes to standard output.
 *
 * Strict on purpose: an unexpected shape is a contract violation, not a thing to guess about.
 * Single-element arrays are normalized because PowerShell may serialize `@('a')` as a bare value in some paths.
 */
export function parseKitResult(stdout: string): OperationResult {
  const text = stdout.trim();
  if (!text) throw new Error('the kit wrote nothing to standard output');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    throw new Error(`standard output of the kit is not one JSON document: ${String(cause)}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('the kit result is not a JSON object');
  }
  const record = raw as Record<string, unknown>;
  const result: OperationResult = {
    ApiVersion: String(record.ApiVersion ?? ''),
    // Added in 1.1; a kit that predates it simply has no such field, which is not a contract violation.
    KitVersion: String(record.KitVersion ?? ''),
    Operation: String(record.Operation ?? ''),
    Kind: record.Kind === 'Change' ? 'Change' : 'Read',
    Success: Boolean(record.Success),
    Status: (record.Status ?? 'Failed') as OperationStatus,
    Applied: Boolean(record.Applied),
    Message: String(record.Message ?? ''),
    Warnings: toStringArray(record.Warnings),
    Errors: toStringArray(record.Errors),
    Changes: toObjectArray<ChangeRecord>(record.Changes),
    Backups: toStringArray(record.Backups),
    Approvals: toStringArray(record.Approvals),
    Duration: Number(record.Duration ?? 0),
    StartedAt: String(record.StartedAt ?? ''),
    Data:
      typeof record.Data === 'object' && record.Data !== null && !Array.isArray(record.Data)
        ? (record.Data as Record<string, unknown>)
        : null,
  };
  return result;
}

function toStringArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v) => v !== null && v !== undefined).map((v) => String(v));
}

function toObjectArray<T>(value: unknown): T[] {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v) => typeof v === 'object' && v !== null) as T[];
}

/** The catalog inside the `operations` result (`Data.Operations`). */
export function readCatalog(result: OperationResult): OperationSpec[] {
  const raw = result.Data?.Operations;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const o = entry as Record<string, unknown>;
    return {
      Name: String(o.Name ?? ''),
      Kind: o.Kind === 'Change' ? 'Change' : 'Read',
      Suite: String(o.Suite ?? ''),
      Interactive: Boolean(o.Interactive),
      Available: Boolean(o.Available),
      Description: String(o.Description ?? ''),
      Parameters: (Array.isArray(o.Parameters) ? o.Parameters : []).map((p) => {
        const spec = p as Record<string, unknown>;
        return { Name: String(spec.Name ?? ''), Type: String(spec.Type ?? ''), Mandatory: Boolean(spec.Mandatory) };
      }),
    } satisfies OperationSpec;
  });
}

/** `Data.Steps` of a step operation, if present. */
export function readSteps(result: OperationResult): StepRecord[] {
  const raw = result.Data?.Steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const s = entry as Record<string, unknown>;
    return {
      Name: String(s.Name ?? ''),
      Status: String(s.Status ?? ''),
      WhatIf: Boolean(s.WhatIf),
      Message: String(s.Message ?? ''),
      Duration: Number(s.Duration ?? 0),
    };
  });
}
