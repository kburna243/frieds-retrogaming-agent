# Requests to the kit

Things this harness needs from [frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit) and
will not work around on its own side. Each one is written so it can be pasted as an issue into the kit's repository.
When an issue exists, put its link next to the heading; when the kit ships it, move the entry to the bottom.

## Open

### 1. `ApiVersion` should be `1.1` since v0.3.0

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

### 2. Report the kit's own version through the API

The harness records `kitVersion: null` in every session, because API v1 does not report it and reading `VERSION`
from the kit's folder would cross the boundary. The MCP server added in v0.3.0 already reads `VERSION` and sends it
as `serverInfo.version`, so the value exists on the kit's side.

**Ask:** add `KitVersion` (string, e.g. `0.3.0`) to the result of `operations` — in `Data` or as a top-level field
next to `ApiVersion`. That is an additive change for a minor version (see request 1). The harness would then fill
`kitVersion` from the catalog read it already makes, and the system prompt would name the version.

## Done

Nothing yet.
