# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/); the version in `VERSION` and `package.json` is the
harness version, independent of the kit's.

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
- Cross-session memory is stored but not yet read back into the prompt (M3).
- The kit's API v1 does not report its own version, so a session records `kitVersion: null`.
