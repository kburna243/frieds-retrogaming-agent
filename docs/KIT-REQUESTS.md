# Requests to the kit

Things this harness needs from [frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit) and
will not work around on its own side. Each one is written so it can be pasted as an issue into the kit's repository.
When an issue exists, put its link next to the heading; when the kit ships it, move the entry to the bottom.

## Open

### 4. A model changes before it measures — the kit could make reading cheaper

**Seen in:** M5 (`eval/`), run against two local models (`llama3.2:3b`, `qwen2.5:3b`) on the fake cabinet. Six runs,
no gate rule broken, no run on the ideal route. Every one of them asked for a change before or without reading
`status` and `components`, and every one of them named an operation the catalog does not contain —
`step.lightgun.04-trigger_test`, `step.pinball.05-run` — in prose, to a person, as a next step.

The harness cannot fix that and should not pretend to: the gate stops the damage, and a scenario that measures
"read first" belongs to the model and its prompt. What the kit *can* do is make the read cheap enough that a small
model does it.

**Ask, in order of usefulness:**

- `status` could carry a one-line `Summary` in `Data` ("ViGEmBus missing; RetroBat detected at C:\RetroBat"). A model
  that reads a sentence uses it; a model that reads eleven fields skims them.
- the catalog's `Description` is the only thing a model reads about a step. Where a step needs a parameter that has
  to come from an earlier step (detect before relocate), say so in the description: `needs step.pinball.01-detect
  first`. A wrong name in prose is a confusing answer; a wrong order in a plan is a refused call.
- `step.lightgun.09-verify` and `step.pinball.08-screens` are refused as interactive, which is right. A model that
  gets `NotAvailable` invents a neighbouring step. If the refusal said what to tell the person ("run the wizard"),
  the model would pass that on instead of improvising.

None of this is required for anything to work. It is written because M5 measured it.

## Done

### 3. MCP server: `apply` and `approved` could collide with a parameter name — [#23](https://github.com/kburna243/frieds-retrogaming-kit/issues/23) — shipped in 0.3.1

`api\Start-KitMcpServer.ps1` read the tool arguments `apply` and `approved` with PowerShell's `-eq`, which ignores
case, so a step parameter of that name would have been taken for the flag. **Ask was:** refuse such a parameter name
when the catalog is built.

Shipped: `API.md` now says `Apply` and `Approved` are refused as parameter names "in any spelling", and no operation
of the 0.3.1 catalog carries one. The harness keeps its half regardless — `schemaForParameters`
(`src/kit/tools.ts`) drops such a name whatever a catalog claims, and `test/contract.test.ts` pins both halves.

### 2. Report the kit's own version through the API — [#22](https://github.com/kburna243/frieds-retrogaming-kit/issues/22) — shipped in 0.3.1

The harness used to record `kitVersion: null` over stdio, because API v1 did not report it and reading `VERSION` from
the kit's folder would have crossed the boundary. Only the MCP server knew, from `serverInfo.version`.

Shipped: `KitVersion` is a top-level field of every result since ApiVersion 1.1. The harness reads it from the
document it already parses (`src/kit/client.ts` → `kitVersion`), so `fagent doctor` and the session row name the kit
version over *both* transports, and the boundary is intact: the number arrives through the API. Verified with the
fake cabinet behind a real PowerShell 5.1 wrapper — `transport mcp-stdio · kit 0.3.1` and `transport stdio · kit
0.3.1` from the same machine.

### 1. `ApiVersion` should be `1.1` since v0.3.0 — [#21](https://github.com/kburna243/frieds-retrogaming-kit/issues/21) — shipped in 0.3.1

v0.3.0 added `backup.remove` to the catalog and to `API.md` while `API.md`'s own versioning rule said a minor bump
was due; `ApiVersion` stayed `1.0`, so a client could not tell a 0.2.0 kit from a 0.3.0 one without reading the whole
catalog.

Shipped: `0ab1116` (tag `v0.3.1`) reports `1.1`, `API.md` has a version table naming what each minor added, and
`contract/` here is refreshed from it. Nothing broke on the way: the harness pins the *major*, so `1.1` was accepted
before the snapshot moved; only the field list needed `KitVersion`, and a kit older than 1.1 leaves it empty.
