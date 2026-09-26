# CLAUDE.md — working in this repository

You are working on **frieds-retrogaming-agent**, the agent harness that drives a retro arcade cabinet through the
`frieds-retrogaming-kit` API. Read `docs/HANDOFF.md` first: it says what is done, what is open and what not to break.

## The rules, in the order they matter

1. **This is a client of the kit, not part of it.** Never read kit files, kit state, the registry or a kit module.
   The only door is `api\Invoke-KitApi.ps1` — one process, one JSON document. If you find yourself wanting a kit
   path, that is a signal to add an operation request to the kit instead, not to read around it.
2. **Never add an `apply` or `approved` parameter to a tool, a CLI flag, or an exported function.** The model
   proposes; `PolicyEngine` decides; a human approves. That order is the product.
3. **Every change goes dry run → plan → human yes → `-Apply` → verify.** No level, no flag and no test convenience
   may skip a stage. `docs/POLICY.md` is the specification; `test/acceptance.test.ts` is the proof.
4. **Interactive steps are never callable.** `step.pinball.08-screens` and `step.lightgun.09-verify` need hands at
   the cabinet; the wizard does them.
5. **Anything sent to a cloud model must be `-Anonymize`d** and the gateway keeps its `assertSafeForCloud()` check.
6. **Pin the contract.** `ApiVersion` major 1 only. `contract/API.md` is a verbatim snapshot — do not edit it,
   re-run `tools/Update-ContractSnapshot.ps1` instead (it rewrites the provenance hash too).

## Commands

```bash
npm install          # dev deps only; there are no runtime dependencies
npm run check        # typecheck + vitest + repo rule checker — this is the bar
npm run test         # vitest run (47 tests, no network, no Windows needed)
npm run typecheck    # tsc -p tsconfig.json (noEmit)
npm run build        # tsc -p tsconfig.build.json + copy db/schema.sql to dist/
npm run lint         # node tools/check-repo-rules.mjs
npm run cli -- tools # run the CLI from source (Node ≥ 24 strips types)
```

There is no formatter or linter dependency in this repo; `npm run lint` is our own rule checker. Do not add a
runtime npm dependency without a very good reason — `node:sqlite` and `--experimental-strip-types` are the whole
platform here.

## Layout you need to know

| Where | What goes there |
| --- | --- |
| `src/kit/` | wire types, argv building, transports, catalog → tools |
| `src/policy/` | the gate: `engine.ts`, `plan.ts`, `human.ts`, `errors.ts` |
| `src/db/` | `schema.sql` + `store.ts` (SQLite via `node:sqlite`) |
| `src/llm/` | gateways, `redact.ts`, `scripted-model.ts` |
| `src/agent/` | system prompt and the loop |
| `test/kit/` | **the fake cabinet** — a second implementation of the API spec, used by every test |
| `contract/` | pinned snapshot of the kit API, with provenance |

## Testing rules

- Tests run on Linux and macOS. Anything that needs Windows PowerShell belongs in `tools/Start-SmokeTest.ps1`, not
  in a test.
- New behaviour against the kit means extending `test/kit/fake-kit.mjs` **to match the contract**, then a test that
  uses it. Do not mock the client in unit tests; the fake kit is the seam.
- A policy change needs an acceptance test that proves the gate order — assert the *sequence* of kit calls, not just
  the final answer. `callTrace()` in `test/helpers.ts` is there for that.
- Keep the suite network-free. `test/acceptance.test.ts` scans `src/` for network imports and will fail you.

## Style that fits this codebase

- Comments and identifiers in English; user-facing strings in English with the kit's own German available through
  `-Culture de-DE`. Docs exist in both languages (`README.md` / `README.de.md`).
- Import specifiers end in `.ts` (TypeScript strips them; Node 24 runs the source directly). `verbatimModuleSyntax`
  and `erasableSyntaxOnly` are on, so no parameter properties and no enums.
- Errors that a model must read are returned as payloads with a `code` and often a `hint`; errors that mean "this
  install is wrong" are thrown.
- Sentences in docs and messages sound like a person wrote them. No marketing, no exclamation marks, no "leverage".

## Depersonalization

No real paths, user names, machine names, private IPs, tokens or e-mails in this repository — files, tests, docs,
commit messages. Synthetic examples use `D:\cabinet\frieds-retrogaming-kit`, `D:\Pinball`, `C:\RetroBat`, and the
invented person in `test/kit/fake-kit.mjs`. `tools/check-repo-rules.mjs` enforces it; it runs in CI.

## Where the real machine lives

The kit is at `https://github.com/kburna243/frieds-retrogaming-kit`. Its `API.md` is the contract; our snapshot in
`contract/` says which commit it came from. The cabinet is a Windows 11 machine with PowerShell 5.1 — you cannot
reach it from a cloud session, which is exactly why `test/kit/` exists. When you finish a milestone, update
`docs/HANDOFF.md` and `CHANGELOG.md` in the same commit.
