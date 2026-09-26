/** Why the harness refused to act. Codes are stable: tests, logs and the CLI all key on them. */
export const PolicyCode = {
  LevelReadOnly: 'LEVEL_READ_ONLY',
  UnknownOperation: 'UNKNOWN_OPERATION',
  NotOffered: 'NOT_OFFERED',
  UnavailableOperation: 'UNAVAILABLE_OPERATION',
  InteractiveStep: 'INTERACTIVE_STEP',
  ParamNotPlain: 'PARAM_NOT_PLAIN',
  UnknownParameter: 'UNKNOWN_PARAMETER',
  MissingParameter: 'MISSING_PARAMETER',
  ApiVersion: 'API_VERSION',
  KitCall: 'KIT_CALL',
  DryRunNotShownable: 'DRY_RUN_NOT_SHOWNABLE',
  Declined: 'DECLINED',
  ApprovalExpired: 'APPROVAL_EXPIRED',
  ApprovalMissing: 'APPROVAL_MISSING',
  ApprovalAlreadyUsed: 'APPROVAL_ALREADY_USED',
  ApprovalWithoutHuman: 'APPROVAL_WITHOUT_HUMAN',
  ApplyWithoutDryRun: 'APPLY_WITHOUT_DRY_RUN',
  CloudWithoutAnonymize: 'CLOUD_WITHOUT_ANONYMIZE',
} as const;

export type PolicyCodeValue = (typeof PolicyCode)[keyof typeof PolicyCode];

export class PolicyError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PolicyError';
    this.code = code;
    this.details = details;
  }

  /** What the model sees. A refusal is an answer, not an exception that kills the loop. */
  asToolError(): { error: string; code: string; hint: string } {
    return { error: this.message, code: this.code, hint: HINTS[this.code] ?? 'see docs/POLICY.md' };
  }
}

const HINTS: Record<string, string> = {
  [PolicyCode.LevelReadOnly]: 'this session is read-only; start with --level operator to allow changes',
  [PolicyCode.UnknownOperation]: 'pick an operation from the tool description or from cabinet_operations',
  [PolicyCode.NotOffered]: 'this operation is not one of your tools; tell the user the fagent run command instead of calling it',
  [PolicyCode.UnavailableOperation]: 'the kit reports this operation as not available in its current version',
  [PolicyCode.InteractiveStep]: 'this step needs a person at the cabinet — tell the user to run it in the kit wizard',
  [PolicyCode.ParamNotPlain]: 'only strings, numbers, booleans and arrays of strings are accepted',
  [PolicyCode.DryRunNotShownable]: 'explain the kit message to the user instead of asking to apply',
  [PolicyCode.ApprovalWithoutHuman]: 'approvals come from a person at the terminal; the model has no way to set one',
  [PolicyCode.ApplyWithoutDryRun]: 'the engine always dry-runs first; there is no path around it',
  [PolicyCode.CloudWithoutAnonymize]: 'everything that goes to a cloud model must come from an -Anonymize call',
};
