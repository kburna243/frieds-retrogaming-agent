#!/usr/bin/env node
/**
 * The fake kit as a process — the stand-in for `api\Invoke-KitApi.ps1`.
 *
 * It takes the *same argument vector* the harness builds for Windows PowerShell (the `-File <path>` form), writes
 * exactly one JSON document to standard output and exits 0 / 1 / 2 like the real script. That way the transport,
 * the argument builder, the JSON parsing and the exit-code rules are all tested with a real child process on any
 * platform, without Windows and without the cabinet.
 *
 *   node test/kit/fake-kit-process.mjs -NoProfile -ExecutionPolicy Bypass -File <ignored> -Operation status -Anonymize
 *
 * State survives between calls when `--state <file>` is given (the harness passes it via `prependArgs`).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { defaultState, handle, parsePowerShellArgv } from './fake-kit.mjs';

const argv = process.argv.slice(2);
const stateIndex = argv.findIndex((token) => token === '--state');
let statePath;
if (stateIndex >= 0) {
  statePath = argv[stateIndex + 1];
  argv.splice(stateIndex, 2);
}

const request = parsePowerShellArgv(argv);
const state = statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : defaultState();

if (request.parametersJsonError) {
  // Same shape the real script produces for a broken -ParametersJson: a Failed result and exit 2.
  const message = request.parametersJsonError;
  process.stdout.write(
    `${JSON.stringify({
      ApiVersion: '1.0', Operation: String(request.operation ?? ''), Kind: 'Read', Success: false, Status: 'Failed',
      Applied: false, Message: message, Warnings: [], Errors: [message], Changes: [], Backups: [], Approvals: [],
      Duration: 0, StartedAt: new Date().toISOString(), Data: null,
    })}\n`,
  );
  process.exit(2);
}

const { result, exitCode } = handle(request, { state });
if (statePath) writeFileSync(statePath, JSON.stringify(state), 'utf8');
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(exitCode);
