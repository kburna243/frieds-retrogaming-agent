/**
 * A tiny argument parser: no dependency for something this small, and strict enough that a typo in a flag is a
 * refusal instead of a silently ignored option. Flags that approve changes do not exist, so they cannot be
 * misspelled into existence either.
 */

export interface Flags {
  [key: string]: string | undefined;
}

export interface Parsed {
  command?: string;
  positional: string[];
  flags: Flags;
  /** Repeatable `--param Name=Value`. */
  params: string[];
  /** Repeatable `--flag Name` (a switch parameter of a kit step). */
  switches: string[];
  unknown: string[];
}

/** Flags that never take a value. */
const BOOLEAN = new Set(['json', 'help', 'demo', 'no-anonymize', 'no-memory', 'verbose']);

export function parseArgs(argv: readonly string[]): Parsed {
  const flags: Flags = {};
  const positional: string[] = [];
  const unknown: string[] = [];
  const params: string[] = [];
  const switches: string[] = [];
  let command: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';
    if (token.startsWith('--')) {
      const withoutDashes = token.slice(2);
      const equals = withoutDashes.indexOf('=');
      const name = equals >= 0 ? withoutDashes.slice(0, equals) : withoutDashes;
      let value: string;
      if (equals >= 0) value = withoutDashes.slice(equals + 1);
      else if (BOOLEAN.has(name)) value = 'true';
      else {
        const next = argv[index + 1];
        if (next === undefined || next.startsWith('--')) {
          unknown.push(`--${name} needs a value`);
          index += 1;
          continue;
        }
        value = next;
        index += 1;
      }
      if (name === 'param') params.push(value);
      else if (name === 'flag') switches.push(value);
      else flags[name] = value;
      continue;
    }
    if (command === undefined) command = token;
    else positional.push(token);
  }

  return { command, positional, flags, params, switches, unknown };
}

export function printHelp(write: (text: string) => void): void {
  write(HELP);
}

export function fail(message: string): void {
  process.stderr.write(`${message}\n`);
}

const HELP = `fagent — the agent harness for Fried's Retrogaming Kit

The harness is a client of the kit and nothing else: every call goes to <kit>\\api\\Invoke-KitApi.ps1 as one JSON
document over stdio. It never reads kit files, never opens a port and never changes the cabinet on its own.

Usage
  fagent doctor                          what can be reached, and which ApiVersion the kit speaks
  fagent tools [--kind Read|Change]      the tool set built from the kit's live catalog
  fagent status [--json]                 the doctor, read-only, no model needed
  fagent run <operation> [--param K=V] [--flag K]   one operation through the full gate (dry run → plan → your yes → apply → verify)
  fagent chat [--message "..."] [--demo] talk to the cabinet with a model
  fagent history [--last 20]             what this harness did, from its own database

Common flags
  --kit <path>        root of the frieds-retrogaming-kit checkout   (env FAGENT_KIT_ROOT)
  --db <path>         harness SQLite file                          (env FAGENT_DB)
  --level read-only|operator                                       (env FAGENT_LEVEL, default read-only)
  --culture en-US|de-DE                                            (env FAGENT_CULTURE)
  --provider local|cloud                                           (env FAGENT_PROVIDER, default local)
  --model <name>                                                 (env FAGENT_MODEL / FAGENT_CLOUD_MODEL)
  --base-url <url>                                               (env FAGENT_OLLAMA_URL / FAGENT_CLOUD_BASE_URL)
  --no-anonymize    local model only: keep real paths in the plan (default: always -Anonymize)
  --no-memory       chat only: start without the digest of earlier sessions
  --json            machine-readable output
  --demo            no model at all: a scripted one runs the diagnosis order so you can see the flow

There is no --yes and no --approve. A change is confirmed by you, at this terminal, per plan — that is the whole
point of the harness. Example:

  fagent run step.lightgun.01-detect --kit D:\\cabinet\\frieds-retrogaming-kit --level operator \\
       --param RetroBatRoot=C:\\retrobat
`;
