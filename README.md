# frieds-retrogaming-agent

The agent harness for [frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit). It plans,
remembers and acts on a retro arcade cabinet — and it is a **client of the kit API, nothing else**.

It does not know how to install ViGEmBus. It does not know where RetroBat lives. It does not read kit files, kit
state or the registry. It asks the kit what exists, and it calls those operations. The cabinet's behaviour is
defined in the kit; this repository only wraps a model and a memory around it.

```
model (local Ollama or an OpenAI-compatible endpoint)
   │  tool calls: cabinet_status, run_step, …
   ▼
PolicyEngine  ── dry run → plan → a human says yes → -Apply → verify
   │  one JSON document over stdio
   ▼
<kit>\api\Invoke-KitApi.ps1        ← the only door into the cabinet
```

## What is here

| Path | What it is |
| --- | --- |
| `src/kit/` | the API client: argv building, one-shot stdio transport, `OperationResult` parsing, catalog → tool schemas |
| `src/policy/` | the gate: dry run first, plan, one human yes, then `-Apply`, then verify; every rule lives here |
| `src/db/` | SQLite memory (sessions, messages, tool calls, plans, approvals, kit results) via `node:sqlite` |
| `src/llm/` | model gateways (OpenAI-compatible), the anonymization guard, a scripted model for tests |
| `src/agent/` | the loop and the system prompt |
| `src/cli.ts` | `fagent` — doctor, tools, status, run, chat, history |
| `contract/` | pinned snapshot of the kit API, with provenance |
| `test/kit/` | **the fake cabinet** — the kit API reimplemented in plain JS, so the whole suite runs anywhere |
| `tools/` | contract snapshot updater, drift test, repo-rule checker, Windows smoke test |
| `docs/` | architecture, policy, and the handoff for whoever continues this |

No runtime dependencies. Node 24 gives us `node:sqlite`, so the install is `typescript`, `vitest`, `@types/node`.

## Quick start

Needs Node ≥ 24 (the tests need nothing else, and no Windows).

```bash
npm install
npm run check          # typecheck + tests + repo rules
```

To talk to a real cabinet (Windows, PowerShell 5.1, a kit checkout):

```bash
export FAGENT_KIT_ROOT='D:\cabinet\frieds-retrogaming-kit'
node --no-warnings src/cli.ts tools --level operator
node --no-warnings src/cli.ts status
node --no-warnings src/cli.ts run step.lightgun.01-detect --param RetroBatRoot=C:\RetroBat
node --no-warnings src/cli.ts chat --model qwen2.5:3b
```

The full Windows check, on the cabinet: `powershell -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit`.

## The three rules that shape all the code

1. **A change is a dry run first.** The model never sees an `apply` or `approved` parameter; only `PolicyEngine`
   sets them, and only after the kit's own WhatIf output became a plan and a person said yes to that exact plan.
2. **Interactive steps are not offered.** `step.pinball.08-screens` and `step.lightgun.09-verify` need hands at the
   cabinet. The wizard does those; the harness refuses them before anything is started.
3. **Nothing personal leaves the machine.** Everything sent to a cloud model goes through the kit's `-Anonymize`,
   and the gateway refuses to send a body that still contains a profile path, a user name, a SID or a private IP.

Details: [docs/POLICY.md](docs/POLICY.md). Level `read-only` is the default. There is no `--yes`.

## Status

See [docs/HANDOFF.md](docs/HANDOFF.md) for what is done, what is deliberately open, and the prompt to hand this to
a coding agent. Short version: the gate, the client, the memory, the CLI and the whole test suite work and run
against the real kit; the MCP transport and the packaging are open.

## License

MIT — see [LICENSE](LICENSE).
