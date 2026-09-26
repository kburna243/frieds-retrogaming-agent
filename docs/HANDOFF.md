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
| Model gateways: local OpenAI-compatible (Ollama) + cloud with a hard `-Anonymize` guard | works; the cloud refusal is tested |
| CLI: `doctor`, `tools`, `status`, `run`, `chat`, `history` | works; exit 0/1/2/3, no `--yes` anywhere |
| Fake cabinet (`test/kit/`) — the API contract as a second implementation | works, cross-checked against the pinned snapshot |
| Tests | **67 passed**, 5 files, no network, no Windows, ~2 s |
| Typecheck (`tsc --noEmit`, strict) and build to `dist/` | clean |
| Repo rule checker (personal data, contract hash, no scripted approval, `.ps1` BOM, version parity) | green, 56 files |
| Pinned contract (`contract/`) | kit 0.2.0, commit `c0198187…`, ApiVersion 1.0; identical to the live catalog when compared with `tools/Test-ContractDrift.ps1` |

Checked on a real Windows machine against a real kit: `status` read the doctor live; a step whose precondition was not
met came back `NeedsUser` and the gate refused to show a plan (`DRY_RUN_NOT_SHOWNABLE`) instead of asking to apply;
`support.bundle` produced a plan, was declined by typing `no`, applied nothing, and both calls are in `history`.

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

- **No MCP server.** The kit's roadmap lists it as not done. The seam exists (`KitTransport`), so `src/kit/mcp-transport.ts`
  is an addition, not a refactor. Do not invent a protocol on this side.
- **Memory is written but not read back.** `Store.recentSessions()` and `recentToolCalls()` exist; nothing feeds them
  into a prompt yet. That is M1 below and it is the most valuable open piece.
- **No packaging yet.** `dist/` builds and `fagent` works from source; an installed global command, `--version`, and
  completion are M2.
- **`kitVersion` is always `null` in a session row.** API v1 does not report it, and reading `VERSION` from the kit's
  folder would cross the boundary. If you want it, open an issue on the kit asking `status` or `operations` to carry
  it — do not work around it here.
- **No schema migrations.** One schema, one version. Add the migration runner before a second cabinet installs an
  older database.

## How to work on this in a cloud session

The cabinet is a Windows 11 machine with Windows PowerShell 5.1. The kit does not run on Linux. **That is fine and
by design:** everything in this repository is testable against `test/kit/`, which speaks the same contract.

```bash
npm install          # dev deps only: typescript, vitest, @types/node
npm run check        # typecheck + 67 tests + repo rules — this is the bar
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
from here and you do not need to: test/kit/ is a second implementation of the same contract, and all 67 tests
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

Run `npm install && npm run check` first and make sure you see 67 passing tests. If anything fails, fix that
before you start.

Then do milestone M1 from docs/HANDOFF.md: make the stored memory useful. A new session should start from a
compact digest of the previous sessions and the tool calls that mattered — Store.recentSessions() and
Store.recentToolCalls() already exist and are unused. Requirements: the digest is built locally and only ever
from what is already in the database (anonymized text stays anonymized), it is a fixed-size summary rather than
a transcript, it goes into the system prompt or a single extra message, and it must not smuggle a
recommendation past the gate: a remembered plan is not an approval. Add tests: one that proves a second session
sees what the first one did, one that proves a remembered approval grants nothing.

Finish by updating docs/HANDOFF.md (state table, and move M1 out of "next") and CHANGELOG.md, then
`npm run check` again. Report which commands you ran and what they printed. Do not push.
```

Repeat the last paragraph with a different milestone (M2 packaging, M3 terminal UX, M4 MCP transport once the kit
ships its server, M5 scenarios, M6 report mode) and the same block works again.

## What only a human can do

Neither here nor in any cloud session:

1. Run the smoke test on the cabinet:
   `powershell -NoProfile -ExecutionPolicy Bypass -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit`
2. Run one change through the gate for real, type `yes`, and look at what the kit wrote and at `fagent history`.
3. Run `tools\Test-ContractDrift.ps1` after the kit releases, and refresh `contract/` with
   `tools\Update-ContractSnapshot.ps1` when it drifted.
4. Decide what the first chat conversation should be. Everything above is plumbing for that one question.

## Who owns what

| Question | Answer |
| --- | --- |
| What can the cabinet do? | The kit. Ask for an operation there; never work around it here. |
| When may it be changed? | This repository, and only through `src/policy/`. |
| What does the model get to see? | This repository (`src/agent/`, `src/llm/`). |
| What is the truth about the cabinet right now? | The kit's answer to `status` — never our cache (`kit_results` is history). |
