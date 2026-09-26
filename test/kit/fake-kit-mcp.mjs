#!/usr/bin/env node
/**
 * The fake kit as an MCP server — the stand-in for `api\Start-KitMcpServer.ps1` (kit v0.3.0, API.md "MCP server").
 *
 * Same rules as the real one, so the MCP transport can be tested on any platform:
 *
 * - JSON-RPC 2.0 over stdio, one message per line, UTF-8; log lines go to standard error only.
 * - Tools are every available operation of the catalog except `operations`; `.` becomes `_`. Interactive and not
 *   yet available operations are not listed. `-ReadOnly` lists only the read tools.
 * - Change tools take `apply` and `approved` (booleans) with the meaning of `-Apply` / `-Approved`; read tools
 *   ignore both. Like the real server, the names are matched without regard to case.
 * - The result is the OperationResult as JSON text; `isError` is true when `Success` is false. Unknown tools and
 *   methods, and unreadable lines, are JSON-RPC errors (-32602, -32601, -32700).
 * - Results are anonymized unless started with `-NoAnonymize`.
 *
 *   node test/kit/fake-kit-mcp.mjs -NoProfile -ExecutionPolicy Bypass -File <ignored> [-ReadOnly] [-NoAnonymize] [-Culture de-DE]
 *
 * `--state <file>` keeps the cabinet's state in a file (the harness passes it through `prependArgs`), and
 * `--calls <file>` appends every tool call as one JSON line, so a test can see exactly what reached the server.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { catalog, defaultState, handle } from './fake-kit.mjs';

const FAKE_KIT_VERSION = '0.3.0';
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const argv = process.argv.slice(2);
const takeOption = (name) => {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  argv.splice(index, 2);
  return value;
};
const statePath = takeOption('--state');
const callsPath = takeOption('--calls');
const switches = new Set(argv.filter((token) => token.startsWith('-')).map((token) => token.toLowerCase()));
const readOnly = switches.has('-readonly');
const anonymize = !switches.has('-noanonymize');
const cultureIndex = argv.findIndex((token) => token.toLowerCase() === '-culture');
const culture = cultureIndex >= 0 ? argv[cultureIndex + 1] : 'en-US';

const loadState = () => (statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : defaultState());
let state = loadState();

const SCHEMA_TYPES = {
  'String[]': { type: 'array', items: { type: 'string' } },
  Int32: { type: 'integer' },
  Int64: { type: 'integer' },
  Boolean: { type: 'boolean' },
  switch: { type: 'boolean' },
};

const tools = new Map();
for (const op of catalog()) {
  if (!op.Available || op.Name === 'operations') continue;
  if (readOnly && op.Kind !== 'Read') continue;
  const properties = {};
  const required = [];
  for (const p of op.Parameters) {
    properties[p.Name] = SCHEMA_TYPES[p.Type] ?? { type: 'string' };
    if (p.Mandatory) required.push(p.Name);
  }
  if (op.Kind === 'Change') {
    properties.apply = { type: 'boolean', description: 'Apply the change. Without it the call is a dry run.' };
    properties.approved = { type: 'boolean', description: 'The user approved the plans listed in Approvals of the dry run.' };
  }
  const name = op.Name.replace(/[^A-Za-z0-9_-]/g, '_');
  tools.set(name, {
    operation: op.Name,
    kind: op.Kind,
    schema: {
      name,
      title: op.Name,
      description: op.Kind === 'Change' ? `${op.Description} Changes the cabinet: dry run unless apply=true.` : op.Description,
      inputSchema: { type: 'object', properties, required, additionalProperties: false },
      annotations: { readOnlyHint: op.Kind === 'Read', destructiveHint: op.Kind === 'Change', idempotentHint: false, openWorldHint: false },
    },
  });
}
process.stderr.write(`[kit-mcp] ${tools.size} tools, read-only=${readOnly}, anonymize=${anonymize}\n`);

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const sendResult = (id, result) => send({ jsonrpc: '2.0', id, result });
const sendError = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    sendError(null, -32700, 'Parse error');
    return;
  }
  if (!('id' in message)) return; // notifications: nothing to answer
  const { id, method, params } = message;
  switch (method) {
    case 'initialize': {
      const asked = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '';
      sendResult(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'frieds-retrogaming-kit', title: "Fried's Retrogaming Kit", version: FAKE_KIT_VERSION },
        instructions: 'Local tools of the fake cabinet. Change tools are dry runs unless apply=true.',
      });
      return;
    }
    case 'ping':
      sendResult(id, {});
      return;
    case 'tools/list':
      sendResult(id, { tools: [...tools.values()].map((tool) => tool.schema) });
      return;
    case 'tools/call': {
      const tool = tools.get(String(params?.name ?? ''));
      if (!tool) {
        sendError(id, -32602, `Unknown tool: ${String(params?.name ?? '')}`);
        return;
      }
      const parameters = {};
      let apply = false;
      let approved = false;
      for (const [key, value] of Object.entries(params?.arguments ?? {})) {
        // PowerShell's -eq ignores case: an argument called "Apply" is the flag, not a parameter.
        if (key.toLowerCase() === 'apply') { apply = Boolean(value); continue; }
        if (key.toLowerCase() === 'approved') { approved = Boolean(value); continue; }
        parameters[key] = value;
      }
      if (tool.kind !== 'Change') { apply = false; approved = false; }
      if (callsPath) appendFileSync(callsPath, `${JSON.stringify({ tool: params.name, operation: tool.operation, parameters, apply, approved })}\n`);
      state = loadState();
      const { result } = handle({ operation: tool.operation, parameters, apply, approved, anonymize, culture }, { state });
      if (statePath) writeFileSync(statePath, JSON.stringify(state), 'utf8');
      sendResult(id, { content: [{ type: 'text', text: JSON.stringify(result) }], isError: !result.Success });
      return;
    }
    default:
      sendError(id, -32601, `Method not found: ${String(method)}`);
  }
});
