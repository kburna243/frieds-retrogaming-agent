/**
 * Public surface of the harness, for embedding (a desktop app, a web bridge, a test).
 *
 * Everything a caller needs to do the right thing — and nothing that lets it do the wrong thing: there is no
 * export that takes an `apply` flag from a caller other than `PolicyEngine`.
 */

export { loadConfig, defaultDbPath, ConfigError, type HarnessConfig, type ModelConfig } from './config.ts';
export { createHarness, type Harness, type HarnessOptions } from './harness.ts';

export { KitClient, KitContractError, ApiVersionMismatchError, validateParameters, type KitCallOutcome } from './kit/client.ts';
export { StdioKitTransport, type StdioTransportOptions } from './kit/stdio-transport.ts';
export {
  buildKitArgv,
  kitApiScript,
  windowsPowerShellPath,
  type KitRawCall,
  type KitRequest,
  type KitTransport,
} from './kit/transport.ts';
export {
  RESULT_FIELDS,
  SUPPORTED_API_MAJOR,
  KitExitCode,
  apiMajor,
  isPlainValue,
  parseKitResult,
  readCatalog,
  readSteps,
  type ChangeRecord,
  type KitCulture,
  type OperationKind,
  type OperationResult,
  type OperationSpec,
  type OperationStatus,
  type ParameterBag,
  type ParameterSpec,
  type PlainValue,
  type StepRecord,
} from './kit/types.ts';
export { buildTools, filterReadTools, findTool, runnableSteps, schemaForParameters, type JsonSchema, type ToolDefinition } from './kit/tools.ts';

export { PolicyEngine, type PermissionLevel, type PolicyEngineOptions, type ToolAnswer, type ToolCallRequest } from './policy/engine.ts';
export { PolicyCode, PolicyError } from './policy/errors.ts';
export { buildPlanView, formatPlanForHuman, type PlanView } from './policy/plan.ts';
export {
  NeverApprovesGateway,
  ScriptedHumanGateway,
  TerminalHumanGateway,
  type Decision,
  type HumanGateway,
} from './policy/human.ts';

export { Store, digestOf, type ApprovalRecord, type PlanRecord, type SessionRow, type ToolCallRecord } from './db/store.ts';

export { OpenAiCompatibleGateway, type OpenAiCompatibleOptions } from './llm/openai-compatible.ts';
export { ScriptedModelGateway, callThenText, type ScriptStep } from './llm/scripted-model.ts';
export { toOpenAiTools, type ChatMessage, type ChatToolCall, type Completion, type ModelGateway, type ModelInfo } from './llm/gateway.ts';
export { assertSafeForCloud, findPersonalData, type PersonalDataFinding } from './llm/redact.ts';

export { AgentLoop, type AgentEvent, type AgentLoopOptions, type AgentRun } from './agent/loop.ts';
export { systemPrompt } from './agent/prompt.ts';
export { main } from './cli.ts';
