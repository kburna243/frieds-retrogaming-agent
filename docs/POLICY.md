# Policy

The whole point of this harness is one sentence: **the model proposes, the gate decides, a human approves.**
Everything in `src/policy/` exists to make that un-bypassable — by the model, by the CLI, and by a future
contributor who thinks a flag would be convenient.

## The gate, stage by stage

`PolicyEngine.handle()` is the only path to a change. It runs in a fixed order and returns a stage instead of
throwing, so a refusal is an answer the model can read.

| # | Stage | What happens | What cannot happen |
| --- | --- | --- | --- |
| 1 | level | the configured level must allow this tool's kind | a `Change` at level `read-only` |
| 2 | catalog | the operation must exist, be `Available`, not be `Interactive`, and — for a model — be named by one of its tools | a guess, a step the kit does not list, or a kit operation the model is not offered |
| 3 | parameters | plain values only, names from the catalog, mandatory ones present | `StatePath`, `Culture`, `TrustedOwner`, … (denied by the kit) |
| 4 | **dry run** | call the operation with no `-Apply`, with `-Anonymize` if the session uses it | an apply flag anywhere in this call |
| 5 | plan | build the plan the human reads: message, changes, warnings, approvals, digests | a plan from a kit that refused to show one |
| 6 | **human** | one plan in, one decision out (`HumanGateway.confirm`) | a model, a script or a flag answering here |
| 7 | apply | `-Apply`, plus `-Approved` if and only if the plan contained approvals | a second apply reusing an old approval |
| 8 | verify | read `status` again and report what changed | — |

**Who may name an operation.** A model reaches exactly the operations its tools name; `run_step` names the runnable
wizard steps and nothing else. An operation that exists in the kit but is not offered (today `backup.remove` and
`backup.export`) is refused with `NOT_OFFERED` before any kit call, and the answer tells the model which
`fagent run` command to give the person. `fagent run <operation>` is the person's own path
(`PolicyEngine.runOperation`): any catalog operation, through the same stages 1–8, with no apply or approved flag.

A "no" at stage 6 stops everything: the plan row says `declined`, no kit call with `-Apply` is ever made, and the
answer the model gets is the human's own words.

## The rules this file is not allowed to drift from

These come from the kit's own contract (pinned in `contract/API.md`):

- A `Change` without `-Apply` is a dry run: it changes nothing and answers in `WhatIf` form.
- Approvals inside `Approvals[]` are **declined unless `-Approved` is given**. The kit does not have a "yes" of its
  own; the yes comes from a person, once, for one plan.
- `Interactive = true` means a person at the cabinet. Such operations are never offered as tools and are refused
  before anything is started.
- Parameters through the API are plain values. The API has no objects, no paths of trust, no overrides — and the
  harness's tool schemas have no `apply`/`approved` fields for the model to fill in.
- `-Anonymize` replaces profile paths, user and computer names, SIDs, private IPs and e-mails with
  `<USERPROFILE> <USER> <COMPUTER> <SID> <IP> <EMAIL>`. Anything heading to a cloud model uses it.
- `ApiVersion` major must be `1`. A kit that speaks another major gets every tool refused with a message that says
  why, before a single operation runs.

## Levels

| Level | May call | Still must |
| --- | --- | --- |
| `read-only` (default) | `Read` operations only | — |
| `operator` | `Read` + catalog-listed `Change` steps | dry run, plan, human yes, verify |

There is no level that skips the dry run or the human. That is deliberate: the two things the kit cannot undo are a
written file and a registry key, and neither is worth a faster prompt. A `model` level would mean "the model decides
when to touch the cabinet", which is the sentence this whole project exists to avoid.

## Approvals are bound, single-use and human

`approvals` rows carry the plan (and through it the plan digest, SHA-256 over canonical JSON), an expiry, the
verbatim kit texts, the decision, and `decided_by`. The schema's CHECK constraint allows only `'human'` there, and
the repository rule checker fails a build that writes anything else. Applying flips `consumed_at`; a second lookup
for the same digest returns nothing (`usableApprovals` filters on `consumed_at IS NULL`), so an apply always needs a
fresh yes. `consumeApproval` returns false if the row was already spent — the engine refuses on that.

## What the model is told

`src/agent/prompt.ts` states the same rules in the model's own terms — diagnose before changing, one change at a
time, never ask for `apply`, hand interactive steps to the wizard, never suggest a ROM download — and, importantly,
that a refusal from the gate is information, not a wall to argue with.
