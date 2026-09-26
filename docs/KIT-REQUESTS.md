# Requests to the kit

Things this harness needs from [frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit) and
will not work around on its own side. Each one is written so it can be pasted as an issue into the kit's repository.
When an issue exists, put its link next to the heading; when the kit ships it, move the entry to the bottom.

## Open

### 1. `ApiVersion` should be `1.1` since v0.3.0 — [#21](https://github.com/kburna243/frieds-retrogaming-kit/issues/21)

**Seen in:** kit v0.3.0 (`7e7d546`, "release: v0.3.0"), compared with v0.2.0 (`c019818`, the harness's pinned
snapshot).

v0.3.0 adds the operation `backup.remove` to the catalog and to `API.md`. `API.md` says under *Versioning*:
"`ApiVersion` changes its minor version when fields or operations are added". `api\RetroCabinetKit.Api.psm1` still
sets `$script:ApiVersion = '1.0'`.

Why it matters to a client: `ApiVersion` is the only thing a client can pin. With `1.0` on both sides, a client
cannot tell a v0.2.0 kit (no `backup.remove`) from a v0.3.0 kit (with it) without reading the whole catalog, and a
contract snapshot taken from either looks equally current.

**Ask:** set `ApiVersion` to `1.1` in the next release and add a line to the CHANGELOG. No client breaks: a major
of `1` is all the harness checks.

### 2. Report the kit's own version through the API — [#22](https://github.com/kburna243/frieds-retrogaming-kit/issues/22)

The harness records `kitVersion: null` in every session, because API v1 does not report it and reading `VERSION`
from the kit's folder would cross the boundary. The MCP server added in v0.3.0 already reads `VERSION` and sends it
as `serverInfo.version`, so the value exists on the kit's side.

Since M4 the harness records it when it runs over MCP (`--transport mcp`); over stdio, the reference transport, it
is still `null`.

**Ask:** add `KitVersion` (string, e.g. `0.3.0`) to the result of `operations` — in `Data` or as a top-level field
next to `ApiVersion`. That is an additive change for a minor version (see request 1). The harness would then fill
`kitVersion` from the catalog read it already makes, and the system prompt would name the version.

### 3. MCP server: `apply` and `approved` can collide with a parameter name — [#23](https://github.com/kburna243/frieds-retrogaming-kit/issues/23)

`api\Start-KitMcpServer.ps1` reads the tool arguments `apply` and `approved` with PowerShell's `-eq`, which ignores
case. A step or command parameter called `Apply` or `Approved` would be taken as the flag instead of being passed
on. No operation of the 0.3.0 catalog has
such a parameter today, so nothing is wrong yet.

**Ask:** refuse such a parameter name when the catalog is built (or name the flags so they cannot collide, e.g.
`_apply`), so the collision cannot appear silently with a new step. The harness refuses these names on its side
anyway.

## Done

Nothing yet.
