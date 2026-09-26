/**
 * The policy engine — the only component that ever sets `apply` or `approved`, and the only one that may talk to
 * a human.
 *
 * The state machine for every `Change`, in this order and no other:
 *
 *   validate → DRY RUN → show plan (+ approvals verbatim) → human yes → APPLY (-Approved only if the plan
 *   contained approvals) → VERIFY with `status`
 *
 * Two properties make this un-bypassable rather than merely documented:
 *
 *  - the model-facing tool schemas have no `apply` and no `approved` parameter at all, and
 *  - `#apply` is private and consumes an approval row that only `HumanGateway` can produce (the database CHECKs
 *    `decided_by = 'human'`), single-use and bound to the digest of the exact plan that was shown.
 */

import type { KitClient } from '../kit/client.ts';
import { ApiVersionMismatchError, KitContractError, validateParameters } from '../kit/client.ts';
import type { ToolDefinition } from '../kit/tools.ts';
import { findTool } from '../kit/tools.ts';
import type { KitCulture, OperationResult, ParameterBag, PlainValue } from '../kit/types.ts';
import { readSteps } from '../kit/types.ts';
import { digestOf, type Store } from '../db/store.ts';
import type { HumanGateway } from './human.ts';
import { PolicyCode, PolicyError } from './errors.ts';
import { buildPlanView, type PlanView } from './plan.ts';

export type PermissionLevel = 'read-only' | 'operator';

export interface PolicyEngineOptions {
  client: KitClient;
  store: Store;
  sessionId: string;
  level: PermissionLevel;
  human: HumanGateway;
  /**
   * True when the conversation may leave this PC (any cloud provider): every kit call is then made with
   * `-Anonymize`, so nothing with real names or paths can be forwarded. A local model may run with it off, so
   * the person at the terminal sees the real paths of their own machine.
   */
  anonymize: boolean;
  tools: ToolDefinition[];
  culture?: KitCulture;
  /** How long a yes stays valid. Default 15 minutes. */
  approvalTtlMs?: number;
  /** Skip the post-apply `status` call (tests only). */
  verifyAfterApply?: boolean;
}

export interface ToolCallRequest {
  tool: string;
  args: Record<string, unknown>;
}

/** What goes back to the model as the tool result. A refusal is an answer, never an exception. */
export interface ToolAnswer {
  ok: boolean;
  stage: 'read' | 'dry_run' | 'applied' | 'declined' | 'refused';
  payload: Record<string, unknown>;
  plan?: PlanView;
}

interface StageResult {
  result: OperationResult;
  toolCallId: string;
}

export class PolicyEngine {
  readonly #client: KitClient;
  readonly #store: Store;
  readonly #sessionId: string;
  readonly #level: PermissionLevel;
  readonly #human: HumanGateway;
  readonly #anonymize: boolean;
  readonly #tools: ToolDefinition[];
  readonly #culture: KitCulture;
  readonly #approvalTtlMs: number;
  readonly #verifyAfterApply: boolean;

  constructor(options: PolicyEngineOptions) {
    this.#client = options.client;
    this.#store = options.store;
    this.#sessionId = options.sessionId;
    this.#level = options.level;
    this.#human = options.human;
    this.#anonymize = options.anonymize;
    this.#tools = options.tools;
    this.#culture = options.culture ?? 'en-US';
    this.#approvalTtlMs = options.approvalTtlMs ?? 15 * 60_000;
    this.#verifyAfterApply = options.verifyAfterApply ?? true;
  }

  get level(): PermissionLevel {
    return this.#level;
  }

  get anonymizeOutbound(): boolean {
    return this.#anonymize;
  }

  /** Entry point for everything a model asks for. Never throws. */
  async handle(request: ToolCallRequest): Promise<ToolAnswer> {
    try {
      return await this.#dispatch(request);
    } catch (error) {
      return this.#refusal(request, error);
    }
  }

  /** A read operation, callable in every permission level (status, components, backups.list, backup.check). */
  async read(operation: string, parameters: ParameterBag = {}): Promise<StageResult> {
    return this.#call({ operation, parameters, anonymize: this.#anonymize }, 'read', 'read');
  }

  async #dispatch(request: ToolCallRequest): Promise<ToolAnswer> {
    const tool = findTool(this.#tools, request.tool);
    if (!tool) throw new PolicyError(PolicyCode.UnknownOperation, `there is no tool named ${request.tool}`);

    if (tool.kind === 'Read') {
      const operation = tool.operations[0];
      if (!operation) throw new PolicyError(PolicyCode.UnknownOperation, `tool ${tool.name} maps to no operation`);
      const parameters = tool.name === 'run_step' ? plainArgs(request.args.parameters) : plainArgs(request.args);
      const read = await this.#call({ operation, parameters, anonymize: this.#anonymize }, 'read', request.tool);
      return {
        ok: read.result.Success,
        stage: 'read',
        payload: resultPayload(read.result, operation),
      };
    }

    // ---- Change: five stages, in order -------------------------------------------------
    if (this.#level === 'read-only') {
      throw new PolicyError(PolicyCode.LevelReadOnly, `this session may only read; ${request.tool} would change the cabinet`);
    }

    const operation = tool.name === 'run_step' ? String(request.args.operation ?? '') : tool.operations[0];
    if (!operation) throw new PolicyError(PolicyCode.UnknownOperation, `tool ${tool.name} maps to no operation`);
    const parameters = tool.name === 'run_step' ? plainArgs(request.args.parameters) : plainArgs(request.args);
    // A model reaches exactly the operations its tools name. run_step names the runnable steps, nothing else.
    return this.#change(request.tool, operation, parameters, tool.operations);
  }

  /**
   * One operation by name, for a person at the terminal (`fagent run`). The same gate as for a model — level,
   * catalog, parameters, dry run, plan, human, apply, verify — but not limited to the operations offered as tools,
   * because the person typing the name is the one who decides. It takes no apply or approved flag. Never throws.
   */
  async runOperation(operation: string, parameters: ParameterBag = {}): Promise<ToolAnswer> {
    const label = 'fagent run';
    try {
      const spec = await this.#client.findOperation(operation);
      if (!spec) throw new PolicyError(PolicyCode.UnknownOperation, `the kit has no operation ${operation}`);
      const plain = plainArgs(parameters);
      if (spec.Kind === 'Read') {
        const problems = validateParameters(spec, plain);
        if (problems.length > 0) throw new PolicyError(PolicyCode.UnknownParameter, `${operation}: ${problems.join('; ')}`);
        const read = await this.#call({ operation, parameters: plain, anonymize: this.#anonymize }, 'read', label);
        return { ok: read.result.Success, stage: 'read', payload: resultPayload(read.result, operation) };
      }
      if (this.#level === 'read-only') {
        throw new PolicyError(PolicyCode.LevelReadOnly, `this session may only read; ${operation} would change the cabinet`);
      }
      return await this.#change(label, operation, plain, null);
    } catch (error) {
      return this.#refusal({ tool: label, args: { operation, parameters } }, error);
    }
  }

  /** Stages 1–5 for one change. `offered` limits a model to its tools' operations; `null` is a person at the CLI. */
  async #change(label: string, operation: string, parameters: ParameterBag, offered: readonly string[] | null): Promise<ToolAnswer> {
    const spec = await this.#client.findOperation(operation);
    if (!spec) throw new PolicyError(PolicyCode.UnknownOperation, `the kit has no operation ${operation}`);
    if (spec.Interactive) {
      throw new PolicyError(
        PolicyCode.InteractiveStep,
        `${operation} needs a person at the cabinet and is never callable by an agent — tell the user to run it in the kit wizard`,
      );
    }
    if (!spec.Available) {
      throw new PolicyError(PolicyCode.UnavailableOperation, `${operation} is not available in this kit version`);
    }
    if (offered && !offered.includes(operation)) {
      throw new PolicyError(
        PolicyCode.NotOffered,
        `${operation} exists in the kit but is not one of your tools; a person can run it with: fagent run ${operation}`,
      );
    }
    const problems = validateParameters(spec, parameters);
    if (problems.length > 0) {
      const hasUnknown = problems.some((p) => p.startsWith('unknown'));
      throw new PolicyError(hasUnknown ? PolicyCode.UnknownParameter : PolicyCode.MissingParameter, `${operation}: ${problems.join('; ')}`, {
        allowed: spec.Parameters.map((p) => `${p.Name}:${p.Type}${p.Mandatory ? ' (mandatory)' : ''}`),
      });
    }

    // Stage 1 — dry run. Always first, always without -Apply, always decided here and not by the model.
    const dry = await this.#call({ operation, parameters, anonymize: this.#anonymize }, 'dry_run', label);
    if (!dry.result.Success) {
      throw new PolicyError(
        PolicyCode.DryRunNotShownable,
        `the kit produced no plan for ${operation}: ${dry.result.Message || dry.result.Errors.join(' ')}`,
        // What the kit says needs a person or failed, verbatim: the model has to pass the reason on, not guess it.
        { status: dry.result.Status, warnings: dry.result.Warnings, errors: dry.result.Errors },
      );
    }

    // Stage 2 — the plan, verbatim, for a person.
    const paramsDigest = digestOf({ operation, parameters });
    const planDigest = digestOf({ operation, parameters, message: dry.result.Message, steps: readSteps(dry.result), changes: dry.result.Changes });
    const stored = this.#store.recordPlan({
      sessionId: this.#sessionId,
      toolCallId: dry.toolCallId,
      operation,
      parameters,
      paramsDigest,
      planDigest,
      status: 'shown',
      message: dry.result.Message,
      steps: readSteps(dry.result),
      changes: dry.result.Changes,
      backups: dry.result.Backups,
      approvals: dry.result.Approvals,
      warnings: dry.result.Warnings,
      errors: dry.result.Errors,
    });
    const plan = buildPlanView({
      planId: stored.id,
      operation,
      parameters,
      paramsDigest,
      planDigest,
      dryRun: dry.result,
      anonymized: this.#anonymize,
    });

    // Stage 3 — the human. One plan in, one answer out; there is no other way in.
    const approval = this.#store.requestApproval({
      planId: plan.planId,
      sessionId: this.#sessionId,
      expiresAt: new Date(Date.now() + this.#approvalTtlMs).toISOString(),
      approvalTexts: plan.approvals,
    });
    const decision = await this.#human.confirm(plan);
    this.#store.decideApproval(approval.id, decision.approved ? 'yes' : 'no');

    if (!decision.approved) {
      // 'declined' (a person said no) and 'refused' (a rule stopped it) are different audit facts.
      this.#store.setPlanStatus(plan.planId, 'declined');
      return {
        ok: true,
        stage: 'declined',
        plan,
        payload: { declined: true, reason: decision.said, operation, plan: { message: plan.message, steps: plan.steps.map((s) => `${s.Name}:${s.Status}`) } },
      };
    }

    // Stage 4 — apply. Needs an approval that is granted, unused, unexpired and for this exact plan digest.
    if (this.#store.usableApprovals(planDigest).length === 0) {
      this.#store.setPlanStatus(plan.planId, 'expired');
      throw new PolicyError(PolicyCode.ApprovalExpired, `the approval for ${operation} is no longer usable (expired or already spent)`);
    }
    if (!this.#store.consumeApproval(approval.id)) {
      throw new PolicyError(PolicyCode.ApprovalAlreadyUsed, `the approval for ${operation} was already spent`);
    }

    const applied = await this.#call(
      { operation, parameters, apply: true, approved: plan.approvals.length > 0, anonymize: this.#anonymize },
      'apply',
      label,
    );
    this.#store.setPlanStatus(plan.planId, applied.result.Success ? 'applied' : 'failed');

    // Stage 5 — verify. Only the doctor measures live, so this is the answer to "did it work".
    let verification: Record<string, unknown> = { skipped: true };
    if (this.#verifyAfterApply) {
      const after = await this.#call({ operation: 'status', parameters: {}, anonymize: this.#anonymize }, 'verify', `${label}:verify`);
      verification = { status: after.result.Status, summary: after.result.Data?.Summary ?? null, message: after.result.Message };
    }

    return {
      ok: applied.result.Success,
      stage: 'applied',
      plan,
      payload: {
        ...resultPayload(applied.result, operation),
        applied: true,
        approval: { id: approval.id, grantedAt: new Date().toISOString() },
        verification,
      },
    };
  }

  async #call(
    args: { operation: string; parameters?: ParameterBag; apply?: boolean; approved?: boolean; anonymize: boolean },
    stage: 'read' | 'dry_run' | 'apply' | 'verify',
    tool: string,
  ): Promise<StageResult> {
    const parameters = args.parameters ?? {};
    try {
      const outcome = await this.#client.call({
        operation: args.operation,
        parameters,
        apply: args.apply,
        approved: args.approved,
        anonymize: args.anonymize,
        culture: this.#culture,
      });
      const record = this.#store.recordToolCall({
        sessionId: this.#sessionId,
        tool,
        operation: args.operation,
        kind: outcome.result.Kind,
        parameters,
        apply: Boolean(args.apply),
        approved: Boolean(args.approved),
        anonymize: args.anonymize,
        stage,
        status: outcome.result.Status,
        exitCode: outcome.exitCode,
        duration: outcome.result.Duration,
        argv: outcome.argv,
        message: outcome.result.Message,
        resultDigest: digestOf(outcome.result),
        error: null,
      });
      this.#store.recordKitResult({ sessionId: this.#sessionId, result: outcome.result, anonymized: args.anonymize });
      return { result: outcome.result, toolCallId: record.id };
    } catch (error) {
      this.#store.recordToolCall({
        sessionId: this.#sessionId,
        tool,
        operation: args.operation,
        kind: 'Refused',
        parameters,
        apply: Boolean(args.apply),
        approved: Boolean(args.approved),
        anonymize: args.anonymize,
        stage: 'refused',
        status: error instanceof ApiVersionMismatchError ? 'ApiVersionMismatch' : 'TransportError',
        exitCode: null,
        duration: null,
        argv: null,
        message: null,
        resultDigest: null,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof PolicyError || error instanceof KitContractError) throw error;
      throw new PolicyError(PolicyCode.KitCall, `could not reach the kit: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  #refusal(request: ToolCallRequest, error: unknown): ToolAnswer {
    const policyError =
      error instanceof PolicyError
        ? error
        : new PolicyError(
            error instanceof ApiVersionMismatchError ? PolicyCode.ApiVersion : PolicyCode.KitCall,
            error instanceof Error ? error.message : String(error),
          );
    this.#store.recordToolCall({
      sessionId: this.#sessionId,
      tool: request.tool,
      operation: typeof request.args.operation === 'string' ? request.args.operation : '',
      kind: 'Refused',
      parameters: safePlainArgs(request.args.parameters ?? request.args),
      apply: false,
      approved: false,
      anonymize: this.#anonymize,
      stage: 'refused',
      status: 'Refused',
      exitCode: null,
      duration: null,
      argv: null,
      message: null,
      resultDigest: null,
      error: `${policyError.code}: ${policyError.message}`,
    });
    return { ok: false, stage: 'refused', payload: { refused: true, ...policyError.asToolError(), ...policyError.details } };
  }
}

function resultPayload(result: OperationResult, operation: string): Record<string, unknown> {
  return {
    operation,
    status: result.Status,
    kind: result.Kind,
    applied: result.Applied,
    message: result.Message,
    data: result.Data,
    changes: result.Changes,
    backups: result.Backups,
    approvals: result.Approvals,
    warnings: result.Warnings,
    errors: result.Errors,
    duration: result.Duration,
  };
}

/** Anything the kit could not accept (nested objects, script blocks) is refused here, before a process starts. */
function plainArgs(value: unknown): ParameterBag {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new PolicyError(PolicyCode.ParamNotPlain, 'parameters must be an object of plain values');
  }
  const out: Record<string, PlainValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') out[key] = item;
    else if (Array.isArray(item) && item.every((v) => typeof v === 'string')) out[key] = item as string[];
    else throw new PolicyError(PolicyCode.ParamNotPlain, `parameter ${key} is not a plain value (string, number, boolean or string[])`);
  }
  return out;
}

function safePlainArgs(value: unknown): ParameterBag {
  try {
    return plainArgs(value);
  } catch {
    return {};
  }
}
