# Roadmap

The harness version is ours; the kit's contract is theirs. Nothing here asks the kit to move at our speed.

## Now (0.1)

Working: kit client, live-catalog tools, the policy gate, SQLite memory, CLI, model gateways with the anonymize
guard, the fake cabinet and 128 tests. Unreleased: memory read back into a new session (M1), packaging (M2), terminal UX with streaming and `chat --continue` (M3), the MCP transport (M4, verified on the cabinet), the report mode (M6) and schema migrations. See `docs/HANDOFF.md` for the state in more honest detail.

## Next

| # | Milestone | What "done" means |
| --- | --- | --- |
| M5 | **Scenarios** | A small eval folder: "gun does not work in game X", "pinball build to a second drive", "what changed since yesterday". Run against the fake cabinet with a real local model, asserting the *call order*, not the prose. |
| 1.0 | **Release** | M5 has run against a real local model on the cabinet, the smoke test covers the new commands, the interactive chat has one input reader, and a tagged release with checksums exists. The checklist is "Until 1.0" in `docs/HANDOFF.md`. |

## Later, if it earns it

- Multiple cabinets (one harness, several kit roots, chosen per session).
- A second culture pass: every harness-side string in German too, not only the kit's own messages.
- Long-running watch mode — but only for `Read` operations; a watcher that can change a cabinet is a bad idea.

## Not on this roadmap

- Anything that acquires games or content. Out of scope, permanently.
- Reading kit internals to "make a decision easier". The boundary is the design.
- A permission level without a human gate. See `docs/POLICY.md`.
- Cabinet behaviour that the kit does not offer. Those are requests for the kit, in its repository.
