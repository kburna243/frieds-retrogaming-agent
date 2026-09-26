# Security

## What this program can do, stated plainly

It can change a cabinet — files and registry — through the kit, and it can send a cabinet's description to a language
model. Those are the two risks, and both have a person in the middle by construction.

## Threat model

| Threat | Where it is handled |
| --- | --- |
| A model asks to apply a change without showing it first | `apply` / `approved` are absent from every tool schema; `PolicyEngine` is the only writer. Enforced by tests. |
| A model smuggles `apply` as a *parameter* | `validateParameters()` in `src/kit/client.ts` refuses names the catalog does not list; the kit refuses again. |
| A model impersonates a human approval | `approvals.decided_by` has a CHECK constraint allowing `'human'`; the CLI's terminal gateway is the only writer in production; approvals are single-use and bound to a plan digest. |
| A model picks a blanket approval | Approvals are requested per plan and consumed on use; the plan text names the exact operation and parameters. There is no "approve all" and no `--yes`. |
| A model drives an interactive step (screen alignment, lightgun aiming) | `Interactive = true` is refused before any process starts, and such operations never appear as tools. |
| Cabinet data reaches a cloud provider un-anonymized | Every kit call in an anonymizing session passes `-Anonymize`, and `OpenAiCompatibleGateway` calls `assertSafeForCloud()` on the serialized body and refuses to send. |
| The pinned contract is quietly edited | `tools/check-repo-rules.mjs` compares `contract/API.md` against its recorded SHA-256 in CI. |
| A real machine is described by the repository | The same checker scans all text files for profile paths, private and CGNAT IPv4 ranges, SIDs, e-mails and token shapes. |
| The harness reaches the network on its own | Only `src/llm/` imports anything that can talk to a network; `test/acceptance.test.ts` scans the rest of `src/` and no transport call uses a shell. |
| Kit state read around the API (a back door into files, registry, other users) | The harness has no code path that opens a kit file, a registry key or a kit module. It is a client, and `docs/ARCHITECTURE.md` states why `kitVersion` stays `null`. |
| Prompt injection through a kit message | Kit texts are shown to the human verbatim, in a separate block. Model output is not executed; only catalog-listed operation names can be called, with validated plain parameters. |

## Levels, and why there is no third one

`read-only` (default) and `operator`. Both are subject to dry run and to the human gate. A level that skipped either
would make the flag the security boundary instead of the person, and the person is the point. If you think you need
such a level, the thing you actually want is a narrower kit operation.

## Secrets

Nothing in this repository holds a credential. A cloud API key comes from `FAGENT_CLOUD_API_KEY` (or
`OPENAI_API_KEY`) at run time, is sent only to the configured base URL, and is never logged, never stored in the
database, never part of an error message. `.env` is git-ignored; `.env.example` shows the shape.

The SQLite memory holds cabinet facts, tool calls and decisions — including, in an anonymizing session, only
anonymized text. The database lives under `%LOCALAPPDATA%\frieds-retrogaming-agent\` and is not encrypted; treat it
like a browser profile, and delete it to forget.

## Reporting

Open a private report through the repository's security contact or GitHub's private-vulnerability reporting. Do not
open a public issue for an approval-bypass: that is the one class of bug here that lets software change a cabinet a
person did not agree to.
