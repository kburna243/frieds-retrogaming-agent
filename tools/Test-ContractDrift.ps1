<#
.SYNOPSIS
    Compares the live kit catalog against this repository's pinned snapshot.

.DESCRIPTION
    contract/catalog-v1.json is a snapshot, not a source of truth. The live kit always wins - the harness builds its
    tools from the live catalog on every start. This script only tells you that the snapshot drifted, so you can
    re-run tools\Update-ContractSnapshot.ps1 and keep the fake cabinet in test/kit honest.

    Exit 0 = snapshot still describes the live kit. Exit 1 = drifted. Exit 2 = could not ask the kit.

    Run it on Windows, next to a kit checkout:
      powershell -NoProfile -ExecutionPolicy Bypass -File tools\Test-ContractDrift.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $KitRoot,
    [string] $NodeExe = 'node'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$api = Join-Path $KitRoot 'api\Invoke-KitApi.ps1'
$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path -LiteralPath $api)) { Write-Error "no kit API at $api"; exit 2 }

$live = & $powerShell -NoProfile -ExecutionPolicy Bypass -File $api -Operation operations
$code = $global:LASTEXITCODE
if ($code -ne 0) { Write-Error "the kit refused the catalog call (exit $code)"; exit 2 }

# The kit writes UTF-8; PowerShell hands it over as an array of lines.
$json = ($live -join "`n")
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('fagent-live-catalog-' + [guid]::NewGuid().ToString('N') + '.json')
[System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))

$script = @'
const fs = require('fs');
const live = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const snap = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
if (!live.Success) { console.error('live catalog call failed: ' + live.Message); process.exit(2); }
const norm = (ops) => ops.slice().map((o) => [
  o.Name, o.Kind, o.Interactive ? 'I' : '-', o.Available ? 'A' : '-',
  (o.Parameters || []).map((p) => p.Name + ':' + p.Type + (p.Mandatory ? '*' : '')).sort().join(','),
].join('|')).sort();
const a = norm(live.Data.Operations);
const b = norm(snap.Operations);
const gone = b.filter((x) => !a.includes(x));
const added = a.filter((x) => !b.includes(x));
console.log('live ' + a.length + ' operations, ApiVersion ' + live.ApiVersion + ' | snapshot ' + b.length + ' (kit ' + (snap.Source && snap.Source.kitVersion) + ', commit ' + String(snap.Source && snap.Source.commit).slice(0, 8) + ')');
if (live.ApiVersion.split('.')[0] !== snap.ApiVersion.split('.')[0]) {
  console.error('ApiVersion major differs: live ' + live.ApiVersion + ' vs snapshot ' + snap.ApiVersion);
  process.exit(1);
}
if (gone.length) { console.error('in the snapshot but not live:'); gone.forEach((x) => console.error('  - ' + x)); }
if (added.length) { console.error('live but not in the snapshot:'); added.forEach((x) => console.error('  + ' + x)); }
if (gone.length || added.length) {
  console.error('DRIFTED - re-run tools\\Update-ContractSnapshot.ps1, then update test/kit/fake-kit.mjs and its tests.');
  process.exit(1);
}
console.log('snapshot matches the live catalog');
'@

$scriptFile = Join-Path ([System.IO.Path]::GetTempPath()) 'fagent-drift.cjs'
[System.IO.File]::WriteAllText($scriptFile, $script, (New-Object System.Text.UTF8Encoding($false)))

try {
    & $NodeExe $scriptFile $tmp (Join-Path $repo 'contract\catalog-v1.json')
    $code = $global:LASTEXITCODE
} finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $scriptFile -ErrorAction SilentlyContinue
}
exit $code
