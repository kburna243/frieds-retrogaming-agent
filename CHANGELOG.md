# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/); the version in `VERSION` and `package.json` is the
harness version, independent of the kit's.

## Unreleased

### Added

- **Memory is read back (M1)** (`src/agent/memory.ts`): a new `chat` session starts from a digest of up to five
  earlier sessions, appended to the system prompt. It is built locally from the database only: which reads ran, what
  the last `status` said, one line per plan with how it ended, and the codes of refused calls. Fixed-size (lines per
  session and a character cap), never a transcript. For a cloud model it only takes kit text from calls made with
  `-Anonymize`, never parameter values, and drops any line that still looks personal. `fagent chat --no-memory`
  starts without it. `test/memory.test.ts`: a second session sees what the first did; a remembered yes for the very
  same plan digest, put back to unspent, still grants nothing.
- **Packaging (M2):** `npm i -g .` builds (`prepare`) and installs `fagent`; `fagent --version` / `fagent version`;
  `package.json` `files` limits a pack to `dist/` and the docs. The bin is `dist/bin.js`, a launcher that hides only
  the SQLite experimental warning. CI installs it globally on Linux and Windows (`fagent.cmd`) and runs it from
  another folder.
- **Terminal UX (M3):**
  - Streaming: assistant text appears as it arrives (`text` events; `--no-stream` turns it off). The
    OpenAI-compatible gateway reads server-sent events and falls back to a plain JSON answer from an endpoint that
    ignores `stream`. Tool calls are assembled whole before the gate sees them; `assertSafeForCloud()` still checks
    the body before the socket opens.
  - A visible round budget: every tool call shows `[round/max]`, `--max-rounds` (1–50) sets it, the summary says
    `n of max rounds`.
  - `fagent chat --continue` (the newest conversation) or `--session <id>`: the words of an earlier conversation,
    user and assistant text only, at most 20 messages. Tool answers stay behind, approvals never travel in messages,
    and for a cloud model only anonymized messages that do not look personal come along (`src/agent/resume.ts`).
    Migration 3 records `sessions.continued_from`.
  - `--json` on every command prints exactly one JSON document on stdout; questions to the person go to stderr.
    `history --json` and `version --json` are new; `chat --json` needs `--message`.
  - `main(argv, deps)` takes an injected transport, model and person, so the CLI itself is tested against the fake
    cabinet. `test/terminal-ux.test.ts` (12 tests).
- **MCP transport (M4)** (`src/kit/mcp-transport.ts`): the kit's `api\Start-KitMcpServer.ps1` (kit ≥ 0.3.0) as a
  second `KitTransport`, chosen with `--transport mcp` or `FAGENT_TRANSPORT=mcp`; stdio stays the default. The
  catalog and its ApiVersion still come from `Invoke-KitApi.ps1`. `apply`/`approved` are filled from `KitRequest`
  only; a parameter named `apply`/`approved` in any case is refused; a call that must be anonymized is refused by a
  server started with `-NoAnonymize`; at level `read-only` the server runs with `-ReadOnly`. The kit version from
  `serverInfo` is recorded in the session row and shown by `fagent doctor`. Verified on the cabinet
  (`docs/LIVE-RUN-REPORT.md`).
- **Report mode (M6):** `fagent report [--since 7d|24h|90m|<date>] [--json]` summarizes a period from the audit
  trail: sessions, calls by stage, one line per plan with how it ended, refusal codes, the last doctor reading. It
  says it is history and suggests no change. `src/report.ts` imports only the store and the memory wording.
  `history` and `report` no longer need a kit root.
- **Schema migrations** (`src/db/migrations.ts`): `schema.sql` is frozen as version 1; later changes are numbered
  migrations, applied in order on open, one transaction each. A database with a newer schema version is refused
  (`SchemaTooNewError`); `fagent doctor` shows the version.
- **The fake cabinet speaks kit 0.3.0:** `backup.remove` (only kit backups, recognized in the dry run too),
  `profile.export` (the plan is the call) and `profile.import` (rows, `NeedsUser` stops the plan, `AutoInstall` asks
  through `Approvals`), and the step parameters as the snapshot has them. A contract test fails when an operation of
  the fake differs from the snapshot in kind, availability or parameters. `test/kit/fake-kit-mcp.mjs` is its MCP
  server.
- `docs/KIT-REQUESTS.md`: what this repository needs from the kit, filed as kit issues #21–#23.
- Repo rule: an absolute Windows path must start at a synthetic root (`D:\cabinet`, `D:\Pinball`, `C:\RetroBat`, …).

### Changed

- **`NOT_OFFERED`:** a model reaches only the operations its tools name. `run_step` used to accept any catalog
  operation (still gated), so a model could reach `backup.export` or `backup.remove` without being offered them.
  `fagent run` goes through `PolicyEngine.runOperation`, the same gate for a person, not limited to the tools.
- A refused dry run (`DRY_RUN_NOT_SHOWNABLE`) carries the kit's `Warnings` and `Errors` to the model.
- `README.md` / `README.de.md` follow the layout of the kit's README.
- The contract snapshot is kit 0.3.0 (`b5df22f`), 34 operations.

### Fixed

- `fagent chat` without `--demo` talked to an empty scripted model instead of the configured endpoint (found and
  fixed on the cabinet); a test now holds the harness to the OpenAI-compatible gateway.
- `fagent chat` printed every answer twice (once from the event, once after the run). With `--message` since the fix
  above, and in the interactive loop before it.
- `fagent run --json` wrote text lines and the question to the person after the JSON document.
- A globally installed `fagent` printed nothing: npm starts it through a symlink, and the "am I the entry point"
  check compared the link with the real path. Both are resolved now (`isEntryPoint`).
- `test/agent-loop.test.ts` imported `afterEach` from `node:test` instead of vitest.
- `tools/Update-ContractSnapshot.ps1` asks the kit for its catalog (`Invoke-KitApi.ps1 -Operation operations` in a
  temporary git worktree of the pinned commit) instead of rebuilding it from a hand-written list, which had missed
  `backup.remove` and the `profile.*` parameters of kit 0.3.0. `-KitRoot` is now mandatory; the old default was a
  real local path.

### Known gaps

- M5 (scenarios as an eval folder) is open. A single chat with a real local model worked on the cabinet
  (`docs/LIVE-RUN-REPORT.md`), but there is no repeatable eval yet.

## 0.1.0 — first release of the harness

The client side of the handoff, working end to end against a real kit.

### Added

- **Kit client over stdio** (`src/kit/`): `api\Invoke-KitApi.ps1` as one process per call, one JSON document out.
  Strict `OperationResult` parsing, exit codes per contract, `buildKitArgv()` as a pure function.
- **Live catalog → tool set** (`src/kit/tools.ts`): the nine fixed operations plus a catalog-driven `run_step`. Tool
  schemas carry no `apply` and no `approved`.
- **Policy gate** (`src/policy/`): level → catalog → parameters → **dry run** → plan → **human yes** → `-Apply` →
  verify. Interactive steps refused before anything starts; approvals verbatim from the kit; digest-bound,
  single-use, human-only.
- **Memory** (`src/db/`): SQLite via `node:sqlite` — sessions, messages, tool calls, plans, approvals, kit results,
  all timestamped. `approvals.decided_by` has a CHECK constraint that only allows `'human'`.
- **Model gateways** (`src/llm/`): OpenAI-compatible for local Ollama and cloud endpoints; `assertSafeForCloud()`
  refuses an un-anonymized body on a cloud route; scripted gateway for tests.
- **CLI** (`fagent`): `doctor`, `tools`, `status`, `run`, `chat`, `history`. Default level `read-only`. No `--yes`.
- **Fake cabinet** (`test/kit/`): the API contract as a second implementation, so the whole suite runs without
  Windows. 47 tests, including the seven acceptance criteria from the handoff.
- **Pinned contract** (`contract/`) with provenance, plus `tools/Update-ContractSnapshot.ps1`,
  `tools/Test-ContractDrift.ps1` and `tools/Start-SmokeTest.ps1` for the Windows side.
- **Repo rules checker** (`tools/check-repo-rules.mjs`): no personal data, contract hash intact, no scripted
  approval flag, `.ps1` BOM rule, version parity. Runs in CI.

### Known gaps

- No MCP transport: the kit has not published a server yet (`docs/HANDOFF.md` M4).
- Cross-session memory is stored but not yet read back into the prompt (M1).
- The kit's API v1 does not report its own version, so a session records `kitVersion: null`.
