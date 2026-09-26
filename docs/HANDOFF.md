# Handoff

What is built, what is deliberately not, and how to continue — including in a cloud session without Windows and
without the cabinet.

## State (measured, not intended)

| Thing | Status |
| --- | --- |
| Kit client over stdio (`api\Invoke-KitApi.ps1`, one process, one JSON document) | works, verified against a real kit |
| Live catalog → tool definitions (9 fixed + `run_step`) | works: 33 operations, 23 steps, 21 callable, 10 tools at `operator`, 5 reads at `read-only` |
| Policy gate: level → catalog → parameters → dry run → plan → human → `-Apply` → verify | works, each stage pinned by a test |
| Interactive steps never callable | works, refused before any process starts |
| SQLite memory (`node:sqlite`, no ORM, no runtime deps) | works; schema CHECKs `decided_by = 'human'` |
| Terminal UX (M3): streaming, `[round/max]`, `--max-rounds`, `chat --continue` / `--session`, `--json` on every command | works; tool calls reach the gate whole, a continued conversation carries words and never approvals, the CLI itself is tested through `main(argv, deps)` |
| Report mode (M6): `fagent report [--since 7d] [--json]` | works; `src/report.ts` imports only the store and the memory wording, needs no kit root, says it is history and suggests nothing (tested) |
| Schema migrations (`src/db/migrations.ts`) | works: a v1 database is brought to v2 (`sessions.transport`) on open, each step in a transaction; a newer database is refused |
| Packaging (M2): `npm i -g .`, `fagent --version` | works; the bin link starts `dist/bin.js`, which hides only the SQLite experimental warning; CI installs it globally on Linux and Windows |
| Memory read back (M1): digest of earlier sessions in the system prompt | works; fixed-size, local, anonymized for a cloud model, grants nothing (tested) |
| MCP transport (M4): the kit's `Start-KitMcpServer.ps1` behind `KitTransport`, `--transport mcp` | works against the fake MCP server and **on the cabinet** (`doctor --transport mcp`: `mcp-stdio · kit 0.3.0`, 34 operations; see [LIVE-RUN-REPORT.md](LIVE-RUN-REPORT.md)). Catalog still via `Invoke-KitApi.ps1`; kit version from `serverInfo` |
| Model gateways: local OpenAI-compatible (Ollama) + cloud with a hard `-Anonymize` guard | works; the cloud refusal is tested |
| CLI: `doctor`, `tools`, `status`, `run`, `chat`, `history` | works; exit 0/1/2/3, no `--yes` anywhere; `chat --no-memory` |
| Fake cabinet (`test/kit/`) — the API contract as a second implementation | works; every operation it offers has exactly the kind, availability and parameters of the pinned snapshot (tested), including `backup.remove` and `profile.*` of kit 0.3.0 |
| Tests | **128 passed**, 12 files, no network, no Windows, ~2 s |
| Typecheck (`tsc --noEmit`, strict) and build to `dist/` | clean |
| Repo rule checker (personal data incl. non-synthetic drive roots, contract hash, no scripted approval, `.ps1` BOM, version parity) | green, 63 files |
| Pinned contract (`contract/`) | kit 0.3.0, commit `b5df22f4…`, ApiVersion 1.0, 34 operations; made by the fixed updater (asks the kit) |

Checked on a real Windows machine against a real kit: `status` read the doctor live; a step whose precondition was not
met came back `NeedsUser` and the gate refused to show a plan (`DRY_RUN_NOT_SHOWNABLE`) instead of asking to apply;
`support.bundle` produced a plan, was declined by typing `no`, applied nothing, and both calls are in `history`. Typing
`yes` instead wrote the bundle, reported `applied: Done` and verified with a fresh `status` — which is also how the
read-only bug in the table above was found: the refusal was safe but said `UNKNOWN_OPERATION`, and a rule should never
sound like a missing feature.

## The kit moved: v0.3.0

Compared by reading the kit's repository (not the cabinet), between `c019818` (the old snapshot) and `7e7d546`
(release v0.3.0):

- **New operation `backup.remove`** (Change, `Path`). In the fake cabinet; **not offered to the model** (it deletes
  something), only a person runs it with `fagent run backup.remove --param Path=…`. The same holds for
  `backup.export`, which never had a tool.
- **`profile.import` / `profile.export` are available** with their commands' parameters. `profile.export` has no
  dry run of its own, so its plan is the call. `profile.import`'s rows count: a `NeedsUser` row (a missing driver
  without `AutoInstall`) means no plan, and the gate passes the kit's warning to the model. With `AutoInstall` the
  installer question is part of the plan and `-Approved` goes out only with the yes. All in `test/kit-v030.test.ts`.
- **An MCP server** (`api\Start-KitMcpServer.ps1`, stdio, JSON-RPC 2.0). M4 is built on it, see below.
- **`ApiVersion` is still `1.0`** although an operation was added. That is the kit's to fix; the issue text is in
  [KIT-REQUESTS.md](KIT-REQUESTS.md).

The first refresh to 0.3.0 missed part of the catalog, because `tools/Update-ContractSnapshot.ps1` rebuilt it from a
hand-written list. It now asks the kit at the pinned commit (a temporary git worktree runs its own
`Invoke-KitApi.ps1 -Operation operations`), and the snapshot on `main` was made that way.

## M4: the MCP transport

`src/kit/mcp-transport.ts`, switched on with `--transport mcp` or `FAGENT_TRANSPORT=mcp`; stdio stays the default
and the reference. Decisions, each tested in `test/mcp-transport.test.ts` against `test/kit/fake-kit-mcp.mjs` (the
server as a real child process):

- **The catalog still comes from `Invoke-KitApi.ps1`.** The server leaves out `operations`, and with it `Interactive`
  and the catalog's `ApiVersion`. Reconstructing them from `tools/list` would be inventing protocol, so the MCP
  transport hands `operations` to the stdio transport. The ApiVersion pin works exactly as before.
- **`apply`/`approved` are filled by the transport from `KitRequest`**, which only `PolicyEngine` sets. A parameter
  whose name is `apply` or `approved` in any case is refused before anything is sent: the server compares like
  PowerShell does, so a step parameter `Apply` would otherwise become the flag.
- **Anonymizing is fixed when the server starts.** A call that must be anonymized is refused by a server started with
  `-NoAnonymize`; it never falls back to real paths.
- **At level `read-only` the server is started with `-ReadOnly`**, so it has no change tool at all.
- **The kit version comes from the kit:** `serverInfo.version` in `initialize` lands in the session row. With stdio
  it stays `null`.
- There are no exit codes over MCP. The transport reports 0 / 1 / 2 from the result, so `history` reads the same.

Run on the cabinet on 2026-09-26: `doctor` and `status` over MCP, and `support.bundle` through the gate with a no ([LIVE-RUN-REPORT.md](LIVE-RUN-REPORT.md)). Still worth doing once: a change with a yes over MCP.

## The acceptance criteria from the handoff, and where they are proven

All seven are `test/acceptance.test.ts`, and all seven pass here on Windows and on Linux in CI.

1. **Works offline with a local model.** No module outside `src/llm/` may import anything that reaches a network; a
   test scans the sources and the suite runs with a scripted model.
2. **Every change shows dry run → plan → yes → `-Apply` → verify, and a model cannot skip it.** Proven by asserting
   the *sequence* of kit calls, by refusing an `apply` smuggled in as a parameter, and by showing that `-Approved`
   appears only when the kit really asked for an approval.
3. **A cloud provider only ever sees `-Anonymize` results.** The fake cabinet deliberately carries an invented
   person; the test asserts the un-anonymized call *does* leak, that an anonymizing session does not, and that a
   cloud gateway refuses to send an un-anonymized body at all.
4. **A different ApiVersion major refuses every tool.** `2.0` is turned down during the very first catalog read,
   before a session exists; `1.x` is accepted.
5. **Every tool call and approval is logged with a timestamp.** Reads, dry runs, applies, decisions and refusals all
   land in the database, and the database itself rejects a decision that did not come from a human.
6. **Reads are free, interactive steps are never callable.**
7. **"My gun does not work in game X" works end to end.** The trace the handoff describes, in order:
   `operations` (once, at start) → `status` → `components` → dry run → apply → `status`.

## What is deliberately unfinished

Not oversights — decisions, each with its reason.

- **MCP is off by default.** stdio is the reference until the MCP transport has run on the cabinet. Even with
  `--transport mcp`, one `Invoke-KitApi.ps1` process answers the catalog at start.
- **Memory is a digest, not a search.** `src/agent/memory.ts` summarizes the last five sessions into the system
  prompt (M1). There is no retrieval by topic and no memory tool for the model; add one only if a real conversation
  shows the digest is not enough. `recentToolCalls()` is still unused — the digest reads per session.
- **No shell completion and no npm publish.** `npm i -g .` from a checkout is the install. Publishing to the npm
  registry is a decision for a person, not a milestone.
- **`kitVersion` is `null` in a session row over stdio.** API v1 does not report it, and reading `VERSION` from the
  kit's folder would cross the boundary. Over MCP the server says it. The request to the kit is written up in [KIT-REQUESTS.md](KIT-REQUESTS.md) — do
  not work around it here.
- **Migrations only go forward.** There is no downgrade: a database touched by a newer harness is refused by an older
  one (`SchemaTooNewError`). Keep a copy of the `.db` file before trying a pre-release.

## How to work on this in a cloud session

The cabinet is a Windows 11 machine with Windows PowerShell 5.1. The kit does not run on Linux. **That is fine and
by design:** everything in this repository is testable against `test/kit/`, which speaks the same contract.

```bash
npm install          # dev deps only: typescript, vitest, @types/node
npm run check        # typecheck + 128 tests + repo rules — this is the bar
```

Rules for the work itself (they are in `CLAUDE.md` / `AGENTS.md` too):

- Do not add a runtime dependency. Node 24 gives SQLite and type stripping; that is the whole platform.
- Do not read kit files, kit state or the registry. Only operations.
- Do not add `apply`/`approved` to any tool schema, CLI flag or exported function. `PolicyEngine` is the only writer.
- Do not hand-edit `contract/`. It is a snapshot with a hash that CI verifies.
- No real paths, users, host names, IPs or tokens in files, tests, docs or commit messages. Synthetic only:
  `D:\cabinet\frieds-retrogaming-kit`, `D:\Pinball`, `C:\RetroBat`, the invented `Friedhelm` in `test/kit/`.
- When you change a gate, change its test in the same commit and assert the call sequence (`callTrace()`).

### Paste this into Claude Code (cloud session)

```text
Work in the repository frieds-retrogaming-agent. It is an agent harness that drives a retro arcade cabinet
through the API of another project (frieds-retrogaming-kit) over JSON-on-stdio. You cannot reach the cabinet
from here and you do not need to: test/kit/ is a second implementation of the same contract, and all 128 tests
run against it on Linux.

Before writing any code, read in this order: CLAUDE.md, docs/POLICY.md, docs/ARCHITECTURE.md, docs/HANDOFF.md,
contract/API.md. Those files are the specification; the code follows them, not the other way round.

Non-negotiable, and each one is already enforced by a test:
1. The harness is a client of the kit. Never read kit files, kit state or the registry.
2. The model never sees an apply or approved parameter. Only src/policy/engine.ts sets them, and only after a
   dry run produced a plan and a human said yes to that exact plan.
3. Interactive operations (Interactive = true) are never offered and never called.
4. Anything sent to a cloud model goes through the kit's -Anonymize, and assertSafeForCloud() stays in the path.
5. ApiVersion major 1 only.
6. contract/API.md and contract/catalog-v1.json are pinned snapshots; do not hand-edit them.
7. No runtime npm dependencies. Node 24 only (node:sqlite, type stripping).
8. No real paths, user names, host names, IPs, tokens or e-mails anywhere in the repository.

Run `npm install && npm run check` first and make sure you see 128 passing tests. If anything fails, fix that
before you start.

Then do milestone M5 from ROADMAP.md: scenarios. An eval folder with three cases — "my gun does not work in game
X", "move the pinball build to a second drive", "what changed since yesterday" — each a user message, a fake-kit
state and the expected *sequence* of kit calls (callTrace()), never the prose. They run against the fake cabinet
with a real local model when FAGENT_EVAL_MODEL is set, and are skipped otherwise, so `npm run check` stays offline.
A scenario passes when the call order matches and nothing was applied without the scripted person's yes.

Finish by updating docs/HANDOFF.md (state table, and move M5 out of "next") and CHANGELOG.md, then
`npm run check` again. Report which commands you ran and what they printed. Do not push.
```

M1 (memory), M2 (packaging), M3 (terminal UX), M4 (MCP transport) and M6 (report) are done, and the database has a
migration runner. M5 is the last milestone of this roadmap.

## What only a human can do

Neither here nor in any cloud session:

1. Run the smoke test on the cabinet:
   `powershell -NoProfile -ExecutionPolicy Bypass -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit`
2. Run one change through the gate for real, type `yes`, and look at what the kit wrote and at `fagent history`.
3. Run `tools\Test-ContractDrift.ps1` after the kit releases, and refresh `contract/` with
   `tools\Update-ContractSnapshot.ps1` when it drifted.
4. Run one change with a yes over MCP (`fagent run … --transport mcp --level operator`), and try `fagent chat
   --continue` with the local model: the second evening should start where the first one stopped.
5. Watch the kit issues #21–#23 ([KIT-REQUESTS.md](KIT-REQUESTS.md)) and move them to *Done* when the kit ships them.
6. Decide what the first chat conversation should be. Everything above is plumbing for that one question.

## Who owns what

| Question | Answer |
| --- | --- |
| What can the cabinet do? | The kit. Ask for an operation there; never work around it here. |
| When may it be changed? | This repository, and only through `src/policy/`. |
| What does the model get to see? | This repository (`src/agent/`, `src/llm/`). |
| What is the truth about the cabinet right now? | The kit's answer to `status` — never our cache (`kit_results` is history). |
