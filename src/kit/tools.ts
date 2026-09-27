/**
 * Catalog -> tool definitions.
 *
 * The kit owns the list of things that can be done; the harness only reshapes it. Two rules are structural here
 * and are the reason the policy cannot be argued around:
 *
 *  1. **No tool has an `apply` or `approved` parameter.** A model can request a change; only the policy engine
 *     decides about dry run, human approval and `-Apply`, and only `src/policy` passes those flags to the client.
 *  2. **The step tools come from the catalog**, so a kit version that adds or renames a step changes the tool set
 *     without a single line changed here.
 *
 * The shape is OpenAI function-calling style on purpose: MCP's tool schema is the same, so the later transport
 * swap keeps these definitions untouched.
 */

import type { OperationSpec, ParameterSpec } from './types.ts';

export type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
  kind: 'Read' | 'Change';
  /** Kit operation(s) this tool maps to. `run_step` covers many, chosen per call. */
  operations: string[];
}

/** The fixed tools of the first harness release (handoff §4), plus the catalog-driven step tool. */
const FIXED_TOOLS: ReadonlyArray<{ name: string; operation: string; kind: 'Read' | 'Change'; summary: string }> = [
  { name: 'cabinet_operations', operation: 'operations', kind: 'Read', summary: 'The live operation catalog of this kit: every operation with kind, interactivity, availability and parameters. Ask it when unsure what exists.' },
  { name: 'cabinet_status', operation: 'status', kind: 'Read', summary: 'Live health of the cabinet: system, pinball, lightgun and security checks with OK/INFO/WARN/ERROR per area.' },
  { name: 'cabinet_components', operation: 'components', kind: 'Read', summary: 'What is detected on the machine: Windows, RetroBat, Gunmote, ViGEmBus, DolphinBar, Steam, pinball build (present, version, path).' },
  { name: 'list_backups', operation: 'backups.list', kind: 'Read', summary: 'The kit backups, newest first (kind, path, created, purpose, files, registry, size).' },
  { name: 'check_backup', operation: 'backup.check', kind: 'Read', summary: 'Checks one backup against its checksums or its original file.' },
  { name: 'restore_backup', operation: 'backup.restore', kind: 'Change', summary: 'Restores a backup. The current state is saved first. A zip backup additionally needs AllowedRoot.' },
  { name: 'support_bundle', operation: 'support.bundle', kind: 'Change', summary: 'Writes an anonymized support bundle (doctor report, environment, step states, logs).' },
  { name: 'export_profile', operation: 'profile.export', kind: 'Change', summary: 'Cabinet migration: export a cabinet profile (available from kit v0.3; reported NotAvailable before).' },
  { name: 'import_profile', operation: 'profile.import', kind: 'Change', summary: 'Cabinet migration: import a cabinet profile (available from kit v0.3; reported NotAvailable before).' },
  { name: 'pinbally_detect', operation: 'pinbally.detect', kind: 'Read', summary: 'Describe one PinballY installation: version, systems, table databases and which path references do not resolve on this machine. Reads only, so a copied install shows its dead paths without changing anything.' },
  { name: 'pinbally_retarget', operation: 'pinbally.retarget', kind: 'Change', summary: 'Give the dead absolute paths of a copied PinballY installation the targets of this machine, following pairs written as Old=New. Only values that do not resolve here and whose new path exists are planned; the plan is shown before anything is written.' },
];

/** Catalog type -> JSON schema type. The catalog only ever offers these six (pinned by the kit's contract tests). */
export function schemaForParameter(param: ParameterSpec): Record<string, unknown> {
  switch (param.Type) {
    case 'String':
      return { type: 'string' };
    case 'String[]':
      return { type: 'array', items: { type: 'string' } };
    case 'Int32':
    case 'Int64':
      return { type: 'number' };
    case 'Boolean':
    case 'switch':
      return { type: 'boolean' };
    default:
      // Unknown in a snapshot: stay open rather than promise something the kit may not accept.
      return { type: 'string' };
  }
}

/**
 * Names a tool must never offer, whatever a catalog claims.
 *
 * `-Apply` and `-Approved` are the API's own switches, and since ApiVersion 1.1 the kit refuses them as parameter
 * names too. The harness keeps its side of that rule: a model gets no schema field that reads like permission,
 * because permission is not something a model asks for.
 */
export const NEVER_A_PARAM = new Set(['apply', 'approved']);

export function schemaForParameters(parameters: ParameterSpec[]): JsonSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of parameters) {
    if (NEVER_A_PARAM.has(param.Name.toLowerCase())) continue;
    properties[param.Name] = schemaForParameter(param);
    if (param.Mandatory) required.push(param.Name);
  }
  const schema: JsonSchema = { type: 'object', properties, additionalProperties: false };
  if (required.length > 0) schema.required = required;
  return schema;
}

/** Steps the model may run: available, non-interactive. Interactive ones stay in the wizard. */
export function runnableSteps(catalog: OperationSpec[]): OperationSpec[] {
  return catalog.filter((op) => op.Name.startsWith('step.') && op.Kind === 'Change' && op.Available && !op.Interactive);
}

/** The tool set for a live catalog. `read-only` callers pass this through `filterReadTools`. */
export function buildTools(catalog: OperationSpec[]): ToolDefinition[] {
  const byName = new Map(catalog.map((op) => [op.Name, op]));
  const tools: ToolDefinition[] = [];

  for (const fixed of FIXED_TOOLS) {
    const spec = byName.get(fixed.operation);
    if (!spec) continue; // An older kit without this operation: no tool, no invented name.
    tools.push({
      name: fixed.name,
      description: `${fixed.summary} Operation ${spec.Name} (${spec.Kind}).`,
      parameters: schemaForParameters(spec.Parameters),
      kind: fixed.kind,
      operations: [spec.Name],
    });
  }

  const steps = runnableSteps(catalog);
  if (steps.length > 0) {
    tools.push({
      name: 'run_step',
      description:
        `Runs one wizard step of the kit as an operation. Choose the step from this list; the plan is shown before anything changes.\n` +
        steps.map((step) => `- ${step.Name}: ${step.Description}`).join('\n'),
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: steps.map((step) => step.Name) },
          parameters: {
            type: 'object',
            description:
              'The plain parameters of the chosen step (see each step in the catalog). Leave empty when the step needs none.',
            additionalProperties: true,
          },
        },
        required: ['operation'],
        additionalProperties: false,
      },
      kind: 'Change',
      operations: steps.map((step) => step.Name),
    });
  }

  return tools;
}

export function filterReadTools(tools: ToolDefinition[]): ToolDefinition[] {
  return tools.filter((tool) => tool.kind === 'Read');
}

export function findTool(tools: ToolDefinition[], name: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.name === name);
}
