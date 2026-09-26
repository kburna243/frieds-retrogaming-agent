# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/); the version in `VERSION` and `package.json` is the
harness version, independent of the kit's.

## Unreleased

### Added

- **Memory is read back (M1)** (`src/agent/memory.ts`): a new `chat` session starts from a digest of up to five
  earlier sessions, appended to the system prompt. It is built locally from the database only: which reads ran, what
  the last `status` said, one line per plan with how it ended, and the codes of refused calls. Fixed-size (lines per
  session and a character cap), never a transcript. For a cloud model it only takes kit text from calls made with
  `-Anonymize`, never parameter values, and drops any line that still looks personal.
- `fagent chat --no-memory` starts without the digest.
- `test/memory.test.ts`: a second session sees what the first did; a remembered yes for the very same plan digest,
  put back to unspent, still grants nothing (the gate asks again, a no applies nothing); the digest stays within its
  size; the cloud digest carries nothing personal.
- `docs/KIT-REQUESTS.md`: what this repository needs from the kit, written as issues for the kit's repository.
- **MCP transport (M4)** (`src/kit/mcp-transport.ts`): the kit's `api\Start-KitMcpServer.ps1` (kit ≥ 0.3.0) as a
  second `KitTransport`, chosen with `--transport mcp` or `FAGENT_TRANSPORT=mcp`; stdio stays the default. The
  catalog and its ApiVersion still come from `Invoke-KitApi.ps1`. `apply`/`approved` are filled from `KitRequest`
  only; a parameter named `apply`/`approved` in any case is refused; a call that must be anonymized is refused by a
  server started with `-NoAnonymize`; at level `read-only` the server runs with `-ReadOnly`. The kit version from
  `serverInfo` is recorded in the session row and shown by `fagent doctor`.
- `test/kit/fake-kit-mcp.mjs`, the MCP server of the fake cabinet, and `test/mcp-transport.test.ts` (13 tests,
  including the full gate order over MCP).
- **Packaging (M2):** `npm i -g .` builds (`prepare`) and installs `fagent`; `fagent --version` / `fagent version`;
  `package.json` `files` limits a pack to `dist/` and the docs. The bin is `dist/bin.js`, a launcher that hides only
  the SQLite experimental warning. CI installs it globally on Linux and Windows (`fagent.cmd`) and runs it from
  another folder.
- **Schema migrations** (`src/db/migrations.ts`): `schema.sql` is frozen as version 1; later changes are numbered
  migrations, applied in order on open, one transaction each. Migration 2 adds `sessions.transport`. A database with
  a newer schema version is refused (`SchemaTooNewError`); `fagent doctor` shows the version.
- `test/packaging.test.ts` and `test/store-migrations.test.ts` (10 tests).
- Repo rule: an absolute Windows path must start at a synthetic root (`D:\cabinet`, `D:\Pinball`, `C:\RetroBat`, …).

### Changed

- `README.md` / `README.de.md` follow the layout of the kit's README: header, badges, status note, feature status,
  quickstart, safety principles, documentation index.
- Test counts in `CLAUDE.md`, `ROADMAP.md` and `docs/HANDOFF.md` brought up to date (97).

### Fixed

- A globally installed `fagent` printed nothing: npm starts it through a symlink, and the "am I the entry point"
  check compared the link with the real path. Both are resolved now (`isEntryPoint`).
- `test/agent-loop.test.ts` imported `afterEach` from `node:test` instead of vitest, so its temp folders were never
  cleaned up.
- `tools/Update-ContractSnapshot.ps1` asks the kit for its catalog (`Invoke-KitApi.ps1 -Operation operations` in a
  temporary git worktree of the pinned commit) instead of rebuilding it from a hand-written list, which had missed
  `backup.remove` and the `profile.*` parameters of kit 0.3.0. `-KitRoot` is now mandatory; the old default was a
  real local path.
- The acceptance test that allows only the kit transports to start a process now names both of them.

### Known gaps

- `contract/catalog-v1.json` for kit 0.3.0 is incomplete (made by the old updater). Re-run the fixed
  `tools\Update-ContractSnapshot.ps1` on the cabinet; then the fake cabinet learns `backup.remove` and `profile.*`.
- The MCP transport has not run against the real kit yet.

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
