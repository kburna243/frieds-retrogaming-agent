# Handoff

What is built, what is left until 1.0, and how to continue — including in a cloud session without Windows and
without the cabinet.

## State (measured, not intended)

| Thing | Status |
| --- | --- |
| Kit client over stdio (`api\Invoke-KitApi.ps1`, one process, one JSON document) | works, verified on the cabinet |
| MCP transport (M4): the kit's `Start-KitMcpServer.ps1` behind `KitTransport`, `--transport mcp` | works against the fake MCP server and on the cabinet (`doctor`, `status`, a declined change; see [LIVE-RUN-REPORT.md](LIVE-RUN-REPORT.md)). Catalog still via `Invoke-KitApi.ps1` |
| Live catalog → tool definitions (11 fixed + `run_step`) | works: 37 operations, 12 tools at `operator`, 6 reads at `read-only`; a model reaches only the operations its tools name (`NOT_OFFERED`) |
| Policy gate: level → catalog → parameters → dry run → plan → human → `-Apply` → verify | works, each stage pinned by a test; `fagent run` uses the same gate through `PolicyEngine.runOperation` |
| Interactive steps never callable | works, refused before any process starts |
| SQLite memory (`node:sqlite`, no ORM, no runtime deps) | works; schema CHECKs `decided_by = 'human'`; migrations up to schema version 3, a newer database is refused |
| Memory read back (M1): digest of earlier sessions in the system prompt | works; fixed-size, local, anonymized for a cloud model, grants nothing |
| Model gateways: local OpenAI-compatible (Ollama) + cloud with a hard `-Anonymize` guard | works; streaming with a JSON fallback; the cloud refusal is tested; a local model (`llama3.2:3b`) answered on the cabinet |
| CLI `fagent`: `doctor`, `tools`, `status`, `run`, `chat`, `history`, `report`, `version` | works; `--json` on every command, exit 0/1/2/3, no `--yes` anywhere |
| Terminal (M3): streaming, `[round/max]`, `--max-rounds`, `chat --continue` / `--session` | works in tests; a continued conversation carries words and never approvals. **Not yet used on the cabinet** |
| Report mode (M6): `fagent report [--since 7d] [--json]` | works; reads the database only, needs no kit root, suggests nothing |
| Scenarios (M5): `eval/` — three cabinet problems, judged on the order of kit calls | works. Offline the ideal scripts must reproduce the documented trace exactly; with `--model`/`FAGENT_EVAL_MODEL` a real local model gets the same prompts on the fake cabinet and is judged on the gate rules only. Measured with `llama3.2:3b` and `qwen2.5:3b`: no gate rule broke in any run, neither model reached the ideal route |
| One reader on the terminal: chat input and the plan question | works; the chat owns a `Prompter` and hands it to `TerminalHumanGateway`, so no second `readline` opens on one stdin |
| Packaging (M2): `npm i -g .`, `fagent --version` | works; CI installs it globally on Linux and Windows; a `v*` tag publishes a tarball with `SHA256SUMS.txt` |
| Fake cabinet (`test/kit/`) — the API contract as a second implementation, with an MCP server | works; every operation it offers has the kind, availability and parameters of the pinned snapshot (tested); its two version sources are one constant |
| Tests | **155 passed**, 3 skipped (the real-model scenarios), 14 files, no network, no Windows, ~4 s |
| Typecheck (`tsc --noEmit`, strict) and build to `dist/` | clean |
| Repo rule checker (personal data incl. non-synthetic drive roots, contract hash, no scripted approval, `.ps1` BOM, version parity) | green, 87 files |
| Pinned contract (`contract/`) | kit commit `849548a…` (kit v0.4.0), ApiVersion 1.3, 37 operations (the step 15 USB lightgun route with Gun4IR, OpenFIRE, AimTrak, Retro Shooter and Sinden came in clean); made by the updater that asks the kit |
| Website (`website/`) | published to GitHub Pages by `.github/workflows/deploy-pages.yml` |

## Until 1.0: what is left

Every milestone on the roadmap is built: M1 to M6, the migrations, and the scenarios. What stands between `main` and
a 1.0 is below, sorted by who can do it. A box is ticked when the thing was measured, not when it was written.

### A cloud session can do these

- [x] **M5: scenarios.** Three cabinet problems as repeatable evals — "my gun does not work in game X", "move the
  pinball build to a second drive", "what changed since yesterday". Each is a user message, a fake-kit state and the
  expected *sequence* of kit calls (`callTrace()`), never the prose. They run against the fake cabinet with a real
  local model when `FAGENT_EVAL_MODEL` is set and are skipped otherwise, so `npm run check` stays offline.
  In `eval/scenarios.ts` (the three and the rules) and `eval/run.ts` (the runner, `--model`, `--only`). One addition
  to the brief: the rules are split. **Gate** rules are the harness's own promise and a violation decides the exit
  code — no apply without a dry run of that operation, no more applies than human yeses, never an interactive step,
  no `-Approved` without `-Apply`. **Behaviour** rules describe a good run and are a score — measured before
  changing, reached the operations the problem is about, named only operations the catalog has. A 3B model that
  changes before it measures is a measurement; a build that lets a model apply without a dry run is a bug.
- [x] **Interactive chat and the plan question share one input.** The chat owns one `Prompter` (`src/policy/human.ts`)
  and hands it to `TerminalHumanGateway`, so no second `readline` ever opens on the same stdin. `fagent run` still
  makes a short-lived one, because there nothing else is reading.
- [x] **Smoke test for the new commands.** Ten steps, plus two chat steps when `-Model` is given: `doctor
  --transport mcp`, `version --json` and `status --json` parsed as documents, `report --since 1d`, `history`. Each
  step says which exit code it wants, and the script exits non-zero when one surprises you — before, a refusal that
  was the point of a step looked exactly like a failure of it. `-Database <scratch>` keeps the run out of your
  audit trail (it is not `-Db`: PowerShell already aliases `-db` to the common `-Debug` parameter).
- [x] **Release preparation.** `VERSION` and `package.json` say 0.2.0, the CHANGELOG has that section, and
  `.github/workflows/release.yml` builds, packs, writes `SHA256SUMS.txt`, installs the tarball and publishes on a
  `v*` tag — refusing a tag that disagrees with `package.json`. Verified here by packing and installing: the
  installed `fagent --version` and `fagent report --json` came out of the tarball, not the checkout.
- [x] **Contract re-pinned to kit 0.4.0 (2026-09-27).** `tools\Update-ContractSnapshot.ps1` asked the kit at its
  release commit and rewrote the snapshot: 37 operations, ApiVersion 1.3. The new `step.lightgun.15-adapter`
  (USB lightguns with Gun4IR, OpenFIRE, AimTrak, Retro Shooter and **Sinden**) is clean against the catalog rules —
  its `-Devices` is filtered by the API, `StatePath` / `Culture` / `Approved` stay refused — so the harness needed
  no code change; its tools come from the catalog. The fake cabinet now reports kit 0.4.0, the version the
  snapshot was taken from. Harness release: 0.3.0.

### Only a person at the cabinet can do these

- [ ] **One change with a yes over MCP:** `fagent run support.bundle --transport mcp --level operator`, type `yes`,
  then check `fagent history` and what the kit wrote. Over stdio this was done for 0.1.0; over MCP only a *no* was
  tried.
- [ ] **Two evenings with the local model:** `fagent chat --model llama3.2:3b` on the first, `fagent chat --continue`
  on the second. The second should know what the first did, and a change must still ask again.
- [ ] **Run M5 against the cabinet's model.** `FAGENT_EVAL_MODEL=<model> node --no-warnings eval/run.ts` on the
  cabinet, or `FAGENT_EVAL_MODEL=<model> npm test`. It ran here against `llama3.2:3b` and `qwen2.5:3b` and the
  honest result is in the CHANGELOG: no gate rule broke in any of the six runs, neither model reached the ideal
  route. That is a statement about 3B models, not about the cabinet's, and "does it help" is still yours to judge.
- [ ] **The smoke test**, now ten steps and a verdict per step:
  `powershell -NoProfile -ExecutionPolicy Bypass -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit`
  It ran end to end here against a PowerShell stand-in for the kit (12 of 12 steps as expected, the MCP transport
  included), which proves the wiring of the script and nothing about the real cabinet. Step 10 needs a kit of 0.3.0
  or newer; older kits say so and skip it.
- [ ] **Push the tag** when the run above is boring in the right way: `git tag v0.2.0 && git push origin v0.2.0`.
  The release workflow does the rest; nothing is published without that push.
- [ ] **After every kit release:** `tools\Test-ContractDrift.ps1`, and `tools\Update-ContractSnapshot.ps1` when it
  drifted. Then a cloud session brings the fake cabinet along.

### Decisions only a person can make

- [x] **The version number: 0.2.0.** M5 ran against real local models and the gate held in every run, so 1.0 was
  arguable. It is 0.2.0 because the extended smoke test has not been run on the cabinet yet, and that run is the
  difference between "tested against a fake" and "works on the machine". Pushing the tag stays a person's act.
- [ ] **Publish to npm or not.** Today the install is `npm i -g .` from a checkout. Publishing needs a package name
  and an npm account; it is not required for 1.0.
- [ ] **The first real conversation.** Which problem should the harness solve first on the cabinet? Everything above
  is plumbing for that question, and M5's scenarios should come from it.

### Waiting on the kit

Nothing. Kit 0.3.1 shipped all three requests and this repository absorbed them
([KIT-REQUESTS.md](KIT-REQUESTS.md) has the entries under *Done*):

- [#21](https://github.com/kburna243/frieds-retrogaming-kit/issues/21) `ApiVersion` is `1.1`.
- [#22](https://github.com/kburna243/frieds-retrogaming-kit/issues/22) `KitVersion` is a field in every result, so
  `fagent doctor` names the kit over plain stdio too and the harness never reads a kit file to learn it.
- [#23](https://github.com/kburna243/frieds-retrogaming-kit/issues/23) `Apply` / `Approved` are refused as parameter
  names in any spelling; `schemaForParameters` in this repository refuses to offer them whatever a catalog claims.
- Kit PR #27 (`pinbally.detect`, API 1.2) and PR #28 (`pinbally.retarget`, API 1.3) were absorbed in kit API 1.3,
  adding PinballY detection and retargeting with 17 dedicated tests.

The next one to file, from M5: a small local model changes before it measures. The system prompt says to read first
and the model does not always listen. A harness can refuse that — show a plan only after a read happened in this
session — but that is a rule about the product and not a bug, so it is a decision and not a task. It is written in
`eval/scenarios.ts` as a behaviour rule so the day something changes about it, the score says so.

## Decisions worth knowing before you change something

- **The catalog always comes from `Invoke-KitApi.ps1`,** also with `--transport mcp`: the MCP server leaves out
  `operations`, and with it `Interactive` and the catalog's `ApiVersion`. Rebuilding them from `tools/list` would be
  inventing protocol.
- **`apply`/`approved` over MCP are filled by the transport from `KitRequest`,** which only `PolicyEngine` sets. A
  parameter named `apply` or `approved` in any case is refused before anything is sent.
- **Anonymizing over MCP is fixed when the server starts.** A call that must be anonymized is refused by a server
  started with `-NoAnonymize`. At level `read-only` the server runs with `-ReadOnly`.
- **`backup.remove` and `backup.export` are not model tools.** A person runs them with `fagent run`. A model that
  asks for them through `run_step` gets `NOT_OFFERED` and the command to hand on.
- **`profile.export` has no dry run of its own,** so its plan is the call. A `NeedsUser` row from `profile.import`
  (a missing driver without `AutoInstall`) means no plan, and the model gets the kit's warning.
- **A continued chat carries words only.** Tool answers stay behind (they are history), approvals never travel in
  messages, and a cloud model only gets messages that were recorded anonymized.
- **The memory digest is history, not state,** and the gate never reads it. A remembered yes grants nothing.

## The acceptance criteria, and where they are proven

All seven are `test/acceptance.test.ts`, and all seven pass on Windows and on Linux in CI.

1. **Works offline with a local model.** No module outside `src/llm/` may import anything that reaches a network; a
   test scans the sources and the suite runs with a scripted model.
2. **Every change shows dry run → plan → yes → `-Apply` → verify, and a model cannot skip it.** Proven by asserting
   the *sequence* of kit calls, by refusing an `apply` smuggled in as a parameter, and by showing that `-Approved`
   appears only when the kit really asked for an approval.
3. **A cloud provider only ever sees `-Anonymize` results.** The fake cabinet carries an invented person; the test
   asserts the un-anonymized call *does* leak, that an anonymizing session does not, and that a cloud gateway refuses
   to send an un-anonymized body at all.
4. **A different ApiVersion major refuses every tool.** `2.0` is turned down during the very first catalog read,
   before a session exists; `1.x` is accepted.
5. **Every tool call and approval is logged with a timestamp.** Reads, dry runs, applies, decisions and refusals all
   land in the database, and the database itself rejects a decision that did not come from a human.
6. **Reads are free, interactive steps are never callable.**
7. **"My gun does not work in game X" works end to end:** `operations` (once, at start) → `status` → `components` →
   dry run → apply → `status`.

## What is deliberately unfinished

Not oversights — decisions, each with its reason. None of them blocks 1.0.

- **MCP is off by default.** stdio is the reference; MCP is there for a long-lived kit process and a kit version in
  the session row.
- **Memory is a digest, not a search.** There is no retrieval by topic and no memory tool for the model; add one only
  if a real conversation shows the digest is not enough.
- **No shell completion.** `fagent help` lists everything.
- **Harness-side strings are English.** The kit's own messages come in German with `--culture de-DE`, and the model
  is told to answer in German; the harness's own lines are a later pass (ROADMAP, "Later").
- **Migrations only go forward.** A database touched by a newer harness is refused by an older one
  (`SchemaTooNewError`). Keep a copy of the `.db` file before trying a pre-release.

## How to work on this in a cloud session

The cabinet is a Windows 11 machine with Windows PowerShell 5.1, and the kit does not run on Linux. **That is fine and
by design:** everything in this repository is testable against `test/kit/`, which speaks the same contract.

```bash
npm install          # dev deps only: typescript, vitest, @types/node
npm run check        # typecheck + 155 tests + repo rules — this is the bar
```

Rules for the work itself (they are in `CLAUDE.md` / `AGENTS.md` too):

- Do not add a runtime dependency. Node 24 gives SQLite and type stripping; that is the whole platform.
- Do not read kit files, kit state or the registry. Only operations.
- Do not add `apply`/`approved` to any tool schema, CLI flag or exported function. `PolicyEngine` is the only writer.
- Do not hand-edit `contract/`. It is a snapshot with a hash that CI verifies.
- No real paths, users, host names, IPs or tokens in files, tests, docs or commit messages. Synthetic only:
  `D:\cabinet\frieds-retrogaming-kit`, `D:\Pinball`, `C:\RetroBat`, the invented `Friedhelm` in `test/kit/`.
- When you change a gate, change its test in the same commit and assert the call sequence (`callTrace()`).
- The CLI is tested through `main(argv, deps)` with the fake cabinet, a scripted model and a scripted person.

### Paste this into Claude Code (cloud session)

```text
Work in the repository frieds-retrogaming-agent. It is an agent harness that drives a retro arcade cabinet
through the API of another project (frieds-retrogaming-kit) over JSON-on-stdio. You cannot reach the cabinet
from here and you do not need to: test/kit/ is a second implementation of the same contract, and all 155 tests
run against it on any OS.

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

Run `npm install && npm run check` first and make sure you see 155 passing and 3 skipped. If anything fails, fix
that before you start.

Then pick one item from "Until 1.0" in docs/HANDOFF.md. The ones a cloud session can still do are the open ones
under that heading; the honest description of each is in the file, not here. If you touch a scenario, remember the
split: a broken gate rule is a harness bug and must fail the run, a missed behaviour rule is a measurement and must
only be reported.

Finish by ticking the box, updating the state table and CHANGELOG.md in the same commit, then `npm run check`
again. Report which commands you ran and what they printed, and do not push.
```

For a milestone that is not yet written as an item, the paragraph before "Finish by" is the one to replace; the rest
of the block is the standing brief and stays.

## Who owns what

| Question | Answer |
| --- | --- |
| What can the cabinet do? | The kit. Ask for an operation there; never work around it here. |
| When may it be changed? | This repository, and only through `src/policy/`. |
| What does the model get to see? | This repository (`src/agent/`, `src/llm/`). |
| What is the truth about the cabinet right now? | The kit's answer to `status` — never our cache (`kit_results` is history). |
