# The pinned contract

Two files, both generated, neither a source of truth.

| File | Content | Provenance |
| --- | --- | --- |
| `API.md` | verbatim copy of the kit's `API.md` | first line block names kit commit, branch, kit version, fetch date, SHA-256 |
| `catalog-v1.json` | the `operations` answer as it looked then | same block, in `Source` |

**Why pin at all, if the harness always reads the live catalog?** Because two things need a fixed text to be
testable: the `OperationResult` field set (parsed strictly in `src/kit/types.ts`) and the fake cabinet in `test/kit/`,
which is a second implementation of this contract. When the contract moves and the fake does not, tests stop meaning
anything. At run time the live kit always wins — see `KitClient.catalog()`.

## Refresh after the kit changed

On Windows, next to a kit checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\Update-ContractSnapshot.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit
```

It reads `API.md` from git (`git show origin/main:API.md`) and asks the kit for its catalog at the same commit: a
temporary git worktree of that commit runs its own `api\Invoke-KitApi.ps1 -Operation operations` and is removed
again. Nothing comes from a working tree, so an uncommitted kit checkout cannot silently enter the contract, and
nothing is re-implemented here. It rewrites both files and the provenance block.

Then check the drift, which compares the snapshot against what a live kit answers today:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\Test-ContractDrift.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit
```

If operations or parameters appeared, extend `test/kit/fake-kit.mjs` to answer them the way `API.md` says, and add a
test. Run `npm run check`.

## If the drift is in a major version

`ApiVersion` major 2 means the kit may change shape, and `SUPPORTED_API_MAJOR` in `src/kit/types.ts` says what this
harness accepts: `1`. A 2.x kit is refused at start with every tool turned off — that is correct behaviour, not a
bug to work around. Porting to a new major is a deliberate piece of work: read the new `API.md`, adjust the parser,
the fake, the tests, then the constant.

## Do not

- Do not edit `API.md` by hand. `tools/check-repo-rules.mjs` compares its SHA-256 with the recorded one and fails the
  build if they disagree.
- Do not make `catalog-v1.json` the source for a decision in code. It is a fixture; the live catalog is the answer.
- Do not add an operation here that the kit does not have. Ask the kit for it.
