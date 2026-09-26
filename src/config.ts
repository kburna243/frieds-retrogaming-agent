/**
 * Configuration, from flags and the environment — never from a file inside the kit.
 *
 * Defaults are the cautious ones: read-only, anonymized, local model. Everything that loosens one of them has to
 * be said out loud on the command line.
 */

import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { KitCulture } from './kit/types.ts';
import type { PermissionLevel } from './policy/engine.ts';

export interface ModelConfig {
  provider: 'local' | 'cloud';
  baseUrl: string;
  model: string;
  /** Only ever read from the environment; never logged, never stored. */
  apiKey?: string;
}

export interface HarnessConfig {
  /** Root of the kit checkout on this machine. The harness only ever calls `<kitRoot>\api\Invoke-KitApi.ps1`. */
  kitRoot: string;
  dbPath: string;
  level: PermissionLevel;
  culture: KitCulture;
  /** Send `-Anonymize` with every kit call. Forced true for a cloud model. */
  anonymize: boolean;
  /** `stdio` (one `Invoke-KitApi.ps1` process per call, the reference) or `mcp` (the kit's MCP server, kit ≥ 0.3.0). */
  transport: 'stdio' | 'mcp';
  model: ModelConfig;
}

export class ConfigError extends Error {}

export interface LoadOptions extends Partial<Record<keyof HarnessConfig, unknown>> {
  kitRoot?: string;
  db?: string;
  level?: string;
  culture?: string;
  anonymize?: boolean;
  noAnonymize?: boolean;
  provider?: string;
  model?: string;
  baseUrl?: string;
  transport?: string;
  /** `history` and `report` only read the harness database; they work without a kit root. */
  requireKitRoot?: boolean;
  /** Only `chat` needs a model; doctor, tools, status and run work without one. */
  requireModel?: boolean;
}

const DEFAULT_OLLAMA = 'http://127.0.0.1:11434/v1';

export function defaultDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const localAppData = env.LOCALAPPDATA ?? (env.HOME ? join(env.HOME, '.local', 'share') : tmpdir());
  return join(localAppData, 'frieds-retrogaming-agent', 'harness.db');
}

export function loadConfig(options: LoadOptions = {}, env: NodeJS.ProcessEnv = process.env): HarnessConfig {
  const kitRoot = options.kitRoot ?? env.FAGENT_KIT_ROOT ?? env.KIT_ROOT ?? '';
  if (!kitRoot && options.requireKitRoot !== false) {
    throw new ConfigError(
      'no kit root. Point the harness at the kit checkout: --kit D:\\cabinet\\frieds-retrogaming-kit or FAGENT_KIT_ROOT. ' +
        'Nothing else works without it — the harness is a client of the kit, not a copy of it.',
    );
  }

  const provider = (options.provider ?? env.FAGENT_PROVIDER ?? 'local') as ModelConfig['provider'];
  if (provider !== 'local' && provider !== 'cloud') {
    throw new ConfigError(`FAGENT_PROVIDER must be local or cloud, got ${provider}`);
  }

  const level = (options.level ?? env.FAGENT_LEVEL ?? 'read-only') as PermissionLevel;
  if (level !== 'read-only' && level !== 'operator') {
    throw new ConfigError(`--level must be read-only or operator, got ${level}`);
  }

  const culture = (options.culture ?? env.FAGENT_CULTURE ?? 'en-US') as KitCulture;
  if (culture !== 'en-US' && culture !== 'de-DE') {
    throw new ConfigError(`--culture must be en-US or de-DE, got ${culture}`);
  }

  const transport = options.transport ?? env.FAGENT_TRANSPORT ?? 'stdio';
  if (transport !== 'stdio' && transport !== 'mcp') {
    throw new ConfigError(`--transport must be stdio or mcp, got ${transport}`);
  }

  const baseUrl =
    options.baseUrl ??
    (provider === 'cloud' ? env.FAGENT_CLOUD_BASE_URL ?? env.OPENAI_BASE_URL : env.FAGENT_OLLAMA_URL ?? DEFAULT_OLLAMA);
  const model =
    options.model ??
    (provider === 'cloud' ? env.FAGENT_CLOUD_MODEL ?? env.OPENAI_MODEL : env.FAGENT_MODEL ?? env.OLLAMA_MODEL);
  if (!model && options.requireModel !== false) {
    throw new ConfigError(
      provider === 'cloud'
        ? 'no cloud model given (FAGENT_CLOUD_MODEL). Prefer a local model: the cabinet works offline, the agent should too.'
        : 'no local model given (FAGENT_MODEL). `ollama list` shows what you have; nothing here pulls a model by itself.',
    );
  }

  const anonymize = provider === 'cloud' ? true : options.noAnonymize !== true && options.anonymize !== false;

  return {
    kitRoot,
    dbPath: options.db ?? env.FAGENT_DB ?? defaultDbPath(env),
    level,
    culture,
    anonymize,
    transport,
    model: {
      provider,
      baseUrl: baseUrl ?? DEFAULT_OLLAMA,
      model: model ?? '(no model: this command does not need one)',
      ...(provider === 'cloud' ? { apiKey: env.FAGENT_CLOUD_API_KEY ?? env.OPENAI_API_KEY } : {}),
    },
  };
}
