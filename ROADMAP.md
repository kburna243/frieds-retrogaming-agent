# Roadmap

The harness version is ours; the kit's contract is theirs. Nothing here asks the kit to move at our speed.

## Now (0.2)

Released as 0.2.0 once the tag is pushed: the kit client, live-catalog tools, the policy gate, SQLite memory with
migrations, the CLI, model gateways with the anonymize guard, the fake cabinet, memory read back into a new session
(M1), packaging (M2), terminal UX with streaming and `chat --continue` (M3), the MCP transport (M4, verified on the
cabinet), the report mode (M6) and the scenarios (M5). 138 tests, no network, no Windows needed. `docs/HANDOFF.md`
has the state in more honest detail.

## Next

| # | Milestone | What "done" means |
| --- | --- | --- |
| M5 | **Scenarios** | Done. Three cabinet problems in `eval/`, each a message, a fake-kit state and the expected *sequence* of kit calls, never the prose. The ideal scripts run in CI, a real local model with `FAGENT_EVAL_MODEL`. Measured with `llama3.2:3b` and `qwen2.5:3b`: the gate held in all six runs, neither model reached the ideal route. |
| 1.0 | **Release** | What is left is a person's, all of it in "Until 1.0" of `docs/HANDOFF.md`: run the smoke test on the cabinet, one change with a typed yes over MCP, two evenings with the local model. Then `git tag v0.2.0`, and decide whether the next number is 1.0. |

## Later, if it earns it

- Multiple cabinets (one harness, several kit roots, chosen per session).
- A second culture pass: every harness-side string in German too, not only the kit's own messages.
- Long-running watch mode — but only for `Read` operations; a watcher that can change a cabinet is a bad idea.

## Not on this roadmap

- Anything that acquires games or content. Out of scope, permanently.
- Reading kit internals to "make a decision easier". The boundary is the design.
- A permission level without a human gate. See `docs/POLICY.md`.
- Cabinet behaviour that the kit does not offer. Those are requests for the kit, in its repository.
