# AGENTS.md — frieds-retrogaming-agent

For any agent CLI working in this folder (Codex, Gemini, Aider, Zed, …). Claude Code additionally reads `CLAUDE.md`.
**Read `docs/HANDOFF.md` before you change anything** — it is the current state of the work.

## What this is

A client of the Kit API. It wraps a model and a SQLite memory around `api\Invoke-KitApi.ps1` of
[frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit). TypeScript on Node ≥ 24, zero runtime
dependencies, tests on any OS.

## Non-negotiable

1. Never read kit files, kit state, the registry or a kit module. Only operations, over stdio.
2. Never add an `apply` / `approved` parameter to a tool, a flag, or a public function. Only `src/policy/engine.ts`
   sets them.
3. A change is: dry run → plan → **a human says yes to that exact plan** → `-Apply` → verify. No shortcuts, no
   blanket approval, no "apply all".
4. `Interactive = true` operations are never offered and never called.
5. Anything sent to a cloud model goes through the kit's `-Anonymize`; `assertSafeForCloud()` stays in the path.
6. `ApiVersion` major 1 only; a different major refuses every tool.
7. `contract/API.md` and `contract/catalog-v1.json` are snapshots. Do not hand-edit — run
   `tools/Update-ContractSnapshot.ps1` from a kit checkout.

## Commands

```bash
npm install
npm run check      # typecheck + tests + repo rules: the bar for "done"
npm run test
npm run build
node --no-warnings src/cli.ts --help
```

## Conventions

- Relative imports end in `.ts`; `verbatimModuleSyntax` + `erasableSyntaxOnly` are on (no enums, no constructor
  parameter properties).
- New kit-facing behaviour → extend `test/kit/fake-kit.mjs` to match `contract/API.md`, then test through
  `test/helpers.ts` (`makeHarness`). Do not stub the client.
- Assert the sequence of kit calls when you test the gate (`callTrace()`), not only the final status.
- English code and comments; user-visible text English first, the kit's own German comes from `-Culture de-DE`.
- No real paths, host names, users, IPs, tokens or e-mails anywhere in the repo. Synthetic only:
  `D:\cabinet\frieds-retrogaming-kit`, `D:\Pinball`, `C:\RetroBat`, `Friedhelm` (fake). Enforced by
  `tools/check-repo-rules.mjs`.
- Destructive or system-wide actions: propose, then wait for a named yes — per item. That includes `git push
  --force`, `reset --hard`, deleting files, and of course anything that touches a cabinet.
- Verify, do not believe: nothing is "done" before `npm run check` passed and you read the output.

## Out of scope

ROMs, game downloads, and anything that acquires content. Cabinet behaviour belongs in the kit; a missing operation
is an issue on the kit repository, not a workaround here.
