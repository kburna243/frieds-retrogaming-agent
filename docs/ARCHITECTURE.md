# Architecture

## The boundary, and why it is drawn there

The kit is a PowerShell tool for a person standing at a cabinet. The harness is a program that wants to help that
person. They meet at exactly one place: `api\Invoke-KitApi.ps1`, one process, one JSON document on stdout, one exit
code. Everything to the left of that line is this repository; everything to the right is the kit's.

```
┌─────────────────────────────────────────┐
│  model (Ollama / OpenAI-compatible)     │  knows tools and words, nothing about Windows
├─────────────────────────────────────────┤
│  AgentLoop        src/agent/            │  prompt, rounds, tool-call plumbing
├─────────────────────────────────────────┤
│  PolicyEngine     src/policy/           │  THE GATE: dry run → plan → human → apply → verify
├─────────────────────────────────────────┤
│  KitClient        src/kit/              │  catalog, ApiVersion pin, parameter validation
│  KitTransport     src/kit/              │  seam: stdio (reference) or MCP
├─────────────────────────────────────────┤
│  Store            src/db/               │  sessions, messages, tool calls, plans, approvals, results
└─────────────────────────────────────────┘
                    │  argv + one JSON document
                    ▼
        <kit>\api\Invoke-KitApi.ps1     (Windows PowerShell 5.1, the cabinet)
```

Three consequences the code keeps re-proving:

- **The harness never reads kit files or kit state.** It has no path to `state\`, no import of a `.psm1`, no
  registry access. `status` is a tool because it is an operation, not because a file could be parsed. This is why a
  session row stores `kitVersion: null` — API v1 does not report it, and guessing from a file would cross the line.
- **The model cannot reach the flags.** `apply` and `approved` are fields of `KitRequest`, not of a tool schema. The
  only writer is `PolicyEngine`, and only after a human decision. A test asserts the schema of every tool contains
  neither word; a test asserts that a parameter named `apply` is refused as `UNKNOWN_PARAMETER`.
- **Transport is a seam.** `KitTransport.call(request)` returns `{argv, stdout, stderr, exitCode, result}`. Swapping
  `StdioKitTransport` for an MCP client changes no tool definition, no policy code, no test helper.

## Layers

### `src/kit/`

| File | Job |
| --- | --- |
| `types.ts` | the wire contract as types: `OperationResult` (16 PascalCase fields), `OperationSpec`, `CatalogOutcome`, plus the strict parser |
| `transport.ts` | `buildKitArgv()` — the pure function that turns a request into the exact PowerShell argv |
| `mcp-transport.ts` | the kit's MCP server as a second transport: `operations` still via stdio, `apply`/`approved` filled from `KitRequest` only, reserved argument names refused, anonymizing fixed at server start |
| `stdio-transport.ts` | `execFile` with no shell, a 32 MB buffer, a 10-minute cap, and one JSON document out |
| `client.ts` | `KitClient`: catalog cache, `ApiVersion` pin, `validateParameters()` against the live spec |
| `tools.ts` | catalog → model-facing tool definitions; the nine fixed tools plus `run_step` |

`parseKitResult()` is deliberately strict: a kit reply missing one of the sixteen fields is a contract error, not an
`undefined` travelling into a policy decision. Fields it does not know are ignored rather than rejected, so the kit
may add to v1 without breaking the client; `Data` is passed through untyped on purpose, because its shape belongs to
the kit and not to this repository.

### `src/policy/`

`engine.ts` is the state machine in [POLICY.md](POLICY.md). `plan.ts` builds the text a human reads — including the
kit's approval questions, verbatim, under a heading that says so. `human.ts` has three gateways: `TerminalHumanGateway`
(one line, `yes|ja|ok|apply|anwenden`, five minutes), `ScriptedHumanGateway` (tests) and `NeverApprovesGateway`
(used when nobody is at the keyboard).

### `src/db/`

`schema.sql` (schema version 1, frozen) + `migrations.ts` (every later change, applied in order on open, one
transaction each) + a thin `Store`. `node:sqlite`, no ORM. The last table
matters conceptually: `kit_results` is **history, not state**. The current state of the cabinet is what `status`
answers right now; a cached read here would be a bug waiting to happen.

### `src/llm/`

`gateway.ts` defines the interface and converts tool definitions to the OpenAI shape. `openai-compatible.ts` covers
Ollama and any OpenAI-compatible endpoint, and calls `assertSafeForCloud()` on the serialized body before a cloud
request leaves. `redact.ts` holds the rules that make that check real (profile paths, SIDs, private and CGNAT IPv4
ranges, e-mails, key-shaped strings) with an allowlist for CI service accounts so the checker does not fire on
`runneradmin`. `scripted-model.ts` is a model made of a list, for tests.

### `src/agent/`

`prompt.ts` is the system prompt with the hard rules; `memory.ts` builds the digest of earlier sessions that is
appended to it (history in a fixed number of lines, built only from the database, never read by the gate — a
remembered yes is not an approval); `loop.ts` is eight rounds of "model asks, gate answers", with
every message and every tool call logged. It ends when the model answers without a tool call, or when the round
budget runs out — never when a change was applied, because applying is not the same as being done.

### `src/report.ts`

`fagent report` builds a summary of a period from the database alone: sessions, calls by stage, one line per plan
with how it ended, refusal codes, the last doctor reading. It imports the store and the memory wording and nothing
from `src/kit/`, so it cannot call the kit; `history` and `report` need no kit root.

### `src/cli.ts` and `src/harness.ts`

`createHarness()` wires the layers and is the only place that decides which transport exists. The CLI is the same
surface the tests use, which is why `fagent doctor` output is worth reading on the cabinet.

## The fake cabinet, and what it proves

`test/kit/fake-kit.mjs` implements the API contract in plain JS: the catalog, WhatIf dry runs, approvals, `NeedsUser`
for unmet preconditions, `NotAvailable` for interactive and missing operations, the denied parameter list, the exit
code rule, and `-Anonymize` with the same six placeholders as the kit. It is not a mock — it is a second
implementation of a specification, and both sides are tested against that specification (`test/contract.test.ts`
cross-checks the fake catalog against the pinned snapshot).

This is what makes the repository finishable in a cloud session: the kit needs Windows PowerShell 5.1, so the tests
cannot run on Linux — but the policy, the parsing, the gate order, the digests and the CLI all can, and the only
thing left for the cabinet is `tools/Start-SmokeTest.ps1`.

## Deliberate gaps

- **MCP is a second transport, not the reference.** `src/kit/mcp-transport.ts` talks to the kit's server, but the
  catalog still comes from `Invoke-KitApi.ps1`, because the server leaves out `operations` and with it `Interactive`
  and the catalog's `ApiVersion`. The model never sees the server's tools; the harness builds its own from the catalog.
- **No `apply`/`approved` in any public API on purpose.** There is no exported function that takes a boolean to
  skip the gate. If someone adds one, `tools/check-repo-rules.mjs` and the acceptance tests are the reviewers.
- **Migrations only go forward.** A database written by a newer harness is refused, never read half-understood.
- **`support.bundle` is a `Change`** because the kit says so, which means it needs a human yes. That is correct and
  slightly annoying; leave it.
