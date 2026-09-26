/**
 * The plan a person has to decide about.
 *
 * It is built from the dry run of the kit and nothing else: `Message`, `Data.Steps`, `Changes`, `Warnings`,
 * `Approvals`. The texts are shown verbatim — the harness does not paraphrase what the cabinet is about to do.
 */

import type { ChangeRecord, OperationResult, ParameterBag, StepRecord } from '../kit/types.ts';
import { readSteps } from '../kit/types.ts';

export interface PlanView {
  planId: string;
  operation: string;
  parameters: ParameterBag;
  /** Digest of operation + parameters + plan text. An approval is bound to exactly this. */
  planDigest: string;
  paramsDigest: string;
  message: string;
  steps: StepRecord[];
  changes: ChangeRecord[];
  /** Verbatim plans the kit wants a person to confirm (installers, scheduled tasks, …). */
  approvals: string[];
  warnings: string[];
  errors: string[];
  anonymized: boolean;
}

export function buildPlanView(input: {
  planId: string;
  operation: string;
  parameters: ParameterBag;
  paramsDigest: string;
  planDigest: string;
  dryRun: OperationResult;
  anonymized: boolean;
}): PlanView {
  const { dryRun } = input;
  return {
    planId: input.planId,
    operation: input.operation,
    parameters: input.parameters,
    planDigest: input.planDigest,
    paramsDigest: input.paramsDigest,
    message: dryRun.Message,
    steps: readSteps(dryRun),
    changes: dryRun.Changes,
    approvals: [...dryRun.Approvals],
    warnings: [...dryRun.Warnings],
    errors: [...dryRun.Errors],
    anonymized: input.anonymized,
  };
}

/** What the person at the terminal sees. One screen, no truncation of the approval texts. */
export function formatPlanForHuman(view: PlanView): string {
  const lines: string[] = [];
  lines.push(`Operation : ${view.operation}`);
  const parameterText = Object.entries(view.parameters);
  lines.push(`Parameters: ${parameterText.length ? parameterText.map(([k, v]) => `${k}=${formatValue(v)}`).join('  ') : '(none)'}`);
  if (view.message) lines.push(`Kit says  : ${view.message}`);
  if (view.steps.length > 0) {
    lines.push('Steps:');
    for (const step of view.steps) lines.push(`  - ${step.Name} [${step.Status}]${step.Message ? ` ${step.Message}` : ''}`);
  }
  if (view.changes.length > 0) {
    lines.push('Planned changes:');
    for (const change of view.changes) lines.push(`  - ${change.Kind}: ${change.Target}${change.Detail ? ` (${change.Detail})` : ''}`);
  }
  if (view.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of view.warnings) lines.push(`  ! ${warning}`);
  }
  if (view.approvals.length > 0) {
    lines.push('THIS NEEDS YOUR EXPLICIT OKAY (verbatim from the kit):');
    for (const approval of view.approvals) lines.push(`  > ${approval}`);
  }
  if (view.anonymized) lines.push('(paths and names in this plan are anonymized: -Anonymize was used)');
  return lines.join('\n');
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => String(v)).join(', ')}]`;
  return String(value);
}
