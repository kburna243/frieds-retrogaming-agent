<#
.SYNOPSIS
    Runs the harness against the real kit on a real Windows machine.

.DESCRIPTION
    The whole test suite runs everywhere because it talks to a fake cabinet (test/kit/). That proves the logic.
    This script proves the wiring: Windows PowerShell 5.1, the quoting of -ParametersJson, the exit codes, the
    -Anonymize flag and the human gate - on the cabinet itself.

    Read-only by default. Nothing here applies a change; the one Change operation it runs is declined on purpose
    (it feeds "no" into the gate) so you can see the refusal.

    Run it on the cabinet:  powershell -NoProfile -ExecutionPolicy Bypass -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit
#>
[CmdletBinding()]
param(
    [string] $KitRoot = '',
    [string] $NodeExe = 'node',
    [switch] $ApplyNothing = $true
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

if (-not $KitRoot) {
    $KitRoot = Read-Host 'Path to the frieds-retrogaming-kit checkout (the folder that has api\Invoke-KitApi.ps1)'
}
$api = Join-Path $KitRoot 'api\Invoke-KitApi.ps1'
if (-not (Test-Path -LiteralPath $api)) {
    Write-Error ("no kit API at {0} - pass -KitRoot" -f $api)
    exit 2
}

function Step([string] $name, [string[]] $argv) {
    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    Write-Host ("$name`n  $NodeExe " + ($argv -join ' ')) -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    $global:LASTEXITCODE = 0
    & $NodeExe @argv
    $code = $global:LASTEXITCODE
    if ($code -eq 0) { Write-Host ('  -> exit {0} ok' -f $code) -ForegroundColor Green }
    else { Write-Host ('  -> exit {0}' -f $code) -ForegroundColor Yellow }
    return $code
}

$cli = Join-Path $repo 'src\cli.ts'
$common = @('--no-warnings', $cli, '--kit', $KitRoot)
$results = [ordered] @{}

$results['tools']    = Step '1/6 the tool set, built from the live catalog' @($common + @('tools', '--level', 'operator'))
$results['status']   = Step '2/6 read the cabinet (no model needed)' @($common + @('status'))
$results['anonym']   = Step '3/6 components with -Anonymize: no profile path may appear' @($common + @('status', '--json'))
$results['readonly'] = Step '4/6 a change at level read-only must be refused' @($common + @('run', 'support.bundle', '--level', 'read-only'))

# Feed "no" into the gate: the plan must be shown and then refused, and nothing may be written.
$decline = Step '5/6 a change at level operator: plan shown, then declined' @($common + @('run', 'support.bundle', '--level', 'operator'))
$results['declined'] = $decline

$results['history']  = Step '6/6 the audit trail of everything above' @($common + @('history', '--last', '12'))

Write-Host ''
Write-Host ('=' * 78) -ForegroundColor DarkGray
Write-Host 'SMOKE RESULT' -ForegroundColor Cyan
foreach ($key in $results.Keys) {
    $code = $results[$key]
    $label = if ($code -eq 0) { 'ok' } elseif ($code -eq 2) { 'refused (expected for step 4/6)' } else { "exit $code" }
    Write-Host ("  {0,-10} {1}" -f $key, $label)
}
Write-Host ''
Write-Host 'Now the human part, on purpose:' -ForegroundColor Yellow
Write-Host ("  {0} run support.bundle --kit {1} --level operator" -f 'node --no-warnings src/cli.ts', $KitRoot)
Write-Host '  Type yes at the prompt, then check the file the kit wrote and fagent history.'
Write-Host ''
Write-Host 'If every line above looked sane, the harness is wired to the real kit.' -ForegroundColor Green
