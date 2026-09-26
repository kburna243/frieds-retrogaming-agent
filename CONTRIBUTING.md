# Contributing

Start with `CLAUDE.md` (or `AGENTS.md`) — it holds the rules that are not negotiable — and `docs/HANDOFF.md` for the
current state.

## The bar

```bash
npm install
npm run check     # typecheck + vitest + tools/check-repo-rules.mjs
```

All three, on every commit. CI runs them on Linux with Node 24, so anything that needs Windows belongs in
`tools/Start-SmokeTest.ps1` instead of a test.

## How to add something that touches the cabinet

1. Check the live catalog: `fagent tools --level operator`. If the operation is not there, it belongs in the kit, and
   the change here is nothing.
2. If you changed the contract, refresh `contract/` (`tools/Update-ContractSnapshot.ps1`) and fix
   `test/kit/fake-kit.mjs` so it answers the same way `contract/API.md` describes.
3. Write the test at the highest useful level: `test/acceptance.test.ts` for gate order, `test/policy.test.ts` for a
   rule, `test/transport.test.ts` for argv and exit codes.
4. Never make a stage of the gate optional to reach a test green. Give the test a scripted human instead.

## Style

Small modules, plain TypeScript, no runtime dependencies. Comments say why, not what. User-facing text is a sentence,
not a code: "not applied: you declined" rather than "status: DECLINED". Error payloads carry a `code` and a `hint` a
model can act on.

## Pull requests

Describe what a reviewer can check: the command you ran and what it printed. If you touched `src/policy/`, include
the call trace from `test/acceptance.test.ts` in the description — it is the most direct answer to "does this still
ask a human?".
