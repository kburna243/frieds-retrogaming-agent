# Roadmap

The harness version is ours; the kit's contract is theirs. Nothing here asks the kit to move at our speed.

## Now (0.1)

Working: kit client, live-catalog tools, the policy gate, SQLite memory, CLI, model gateways with the anonymize
guard, the fake cabinet and 87 tests. Unreleased: memory read back into a new session (M1) and the MCP transport (M4). See `docs/HANDOFF.md` for the state in more honest detail.

## Next

| # | Milestone | What "done" means |
| --- | --- | --- |
| M2 | **Packaging** | `npm i -g .` then `fagent doctor` from any folder; `dist/` complete (schema.sql included); a `--version`; Windows `.cmd` shim not needed but checked. |
| M3 | **Better model UX in the terminal** | Streaming where the endpoint supports it, a token/round budget that is visible, `fagent chat --continue`, `--json` for every command. |
| M5 | **Scenarios** | A small eval folder: "gun does not work in game X", "pinball build to a second drive", "what changed since yesterday". Run against the fake cabinet with a real local model, asserting the *call order*, not the prose. |
| M6 | **Read-only report mode** | `fagent report --since 7d` builds a human summary from the audit trail (no kit writes), for the vault. |

## Later, if it earns it

- Multiple cabinets (one harness, several kit roots, chosen per session).
- A second culture pass: every harness-side string in German too, not only the kit's own messages.
- Long-running watch mode — but only for `Read` operations; a watcher that can change a cabinet is a bad idea.

## Not on this roadmap

- Anything that acquires games or content. Out of scope, permanently.
- Reading kit internals to "make a decision easier". The boundary is the design.
- A permission level without a human gate. See `docs/POLICY.md`.
- Cabinet behaviour that the kit does not offer. Those are requests for the kit, in its repository.
