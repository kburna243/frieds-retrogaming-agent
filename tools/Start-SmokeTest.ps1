<#
.SYNOPSIS
    Runs the harness against the real kit on a real Windows machine.

.DESCRIPTION
    The whole test suite runs everywhere because it talks to a fake cabinet (test/kit/). That proves the logic.
    This script proves the wiring: Windows PowerShell 5.1, the quoting of -ParametersJson, the exit codes, the
    -Anonymize flag and the human gate - on the cabinet itself.

    Read-only by default. Nothing here applies a change; the one Change operation it runs is declined on purpose
    (with no console answer the gate refuses, and a plan that is not answered stays unapplied).

    Steps 7 to 10 cover the commands a cloud session cannot test: the second transport, the JSON documents a
    script is supposed to read, and the report that comes out of the harness database.

    Run it on the cabinet:  powershell -NoProfile -ExecutionPolicy Bypass -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit
    With a local model too: add -Model llama3.2:3b  (the chat step then runs at level read-only: it can look, not change)
    Without touching your audit trail: add -Database <scratch path>. That is what a run against the fake cabinet uses.
    (It is called -Database and not -Db: PowerShell already aliases -db to the common -Debug parameter, and a
    script whose parameter collides with that does not even start.)
#>
[CmdletBinding()]
param(
    [string] $KitRoot = '',
    [string] $NodeExe = 'node',
    [string] $Model = '',
    [string] $Database = '',
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
$mcpApi = Join-Path $KitRoot 'api\Start-KitMcpServer.ps1'
$hasMcp = Test-Path -LiteralPath $mcpApi

function Step([string] $name, [string[]] $argv, [int] $expect = 0) {
    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    Write-Host ("$name`n  $NodeExe " + ($argv -join ' ')) -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    $global:LASTEXITCODE = 0
    # Out-Host, not the pipeline: what the command printed belongs on the screen. Returned through the pipeline it
    # would land in the result table next to the exit code, which is how this script once managed to "fail" a step
    # whose own output ended up in front of the number.
    & $NodeExe @argv | Out-Host
    $code = $global:LASTEXITCODE
    if ($code -eq $expect) { Write-Host ('  -> exit {0}, as expected' -f $code) -ForegroundColor Green }
    else { Write-Host ('  -> exit {0}, expected {1}' -f $code, $expect) -ForegroundColor Red }
    return $code
}

# --json must mean exactly one JSON document on standard output. Nothing proves that like parsing it here.
function StepJson([string] $name, [string[]] $argv, [string] $expectProperty) {
    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    Write-Host ("$name`n  $NodeExe " + ($argv -join ' ')) -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    $global:LASTEXITCODE = 0
    $raw = & $NodeExe @argv 2>$null | Out-String
    $code = $global:LASTEXITCODE
    try {
        $parsed = $raw | ConvertFrom-Json
        if ($expectProperty -and -not $parsed.PSObject.Properties[$expectProperty]) {
            Write-Host ("  -> parsed, but no {0} in it" -f $expectProperty) -ForegroundColor Yellow
            return 90
        }
        Write-Host ("  -> exit {0}, one JSON document, {1} present" -f $code, $expectProperty) -ForegroundColor Green
        return $code
    } catch {
        Write-Host '  -> standard output is not one JSON document' -ForegroundColor Red
        Write-Host ('     ' + (($raw -split "`n")[0..2] -join ' | ')) -ForegroundColor DarkGray
        return 91
    }
}

$results = [ordered] @{}
# The exit code each step must produce. 2 is the kit's "refused", which several steps here want on purpose.
$expectations = [ordered] @{}

$cli = Join-Path $repo 'src\cli.ts'
$common = @('--no-warnings', $cli, '--kit', $KitRoot)
if ($Database) { $common = $common + @('--db', $Database) }

function Run([string] $key, [string] $name, [string[]] $argv, [int] $expect, [string] $property = '') {
    $script:expectations[$key] = $expect
    if ($property) { $script:results[$key] = StepJson $name $argv $property }
    else { $script:results[$key] = Step $name $argv $expect }
}

Run 'tools'  '1/10 the tool set, built from the live catalog' @($common + @('tools', '--level', 'operator')) 0
Run 'status' '2/10 read the cabinet (no model needed)' @($common + @('status')) 0
Run 'anonym' '3/10 a read through -Anonymize' @($common + @('run', 'status')) 0
Run 'readonly' '4/10 a change at level read-only must be refused' @($common + @('run', 'support.bundle', '--level', 'read-only')) 2
Run 'declined' '5/10 a change at level operator: plan shown, then refused by nobody answering' @($common + @('run', 'support.bundle', '--level', 'operator')) 0
Run 'history' '6/10 the audit trail of everything above' @($common + @('history', '--last', '12')) 0
Run 'version' '7/10 version as one JSON document' @($common + @('version', '--json')) 0 'version'
Run 'statusjson' '8/10 status as one JSON document (the field a script reads: Data)' @($common + @('status', '--json')) 0 'Data'
Run 'report' '9/10 the report over the last day, from the harness database' @($common + @('report', '--since', '1d')) 0

if ($hasMcp) {
    Run 'mcp' '10/10 the second transport: doctor over the kit MCP server' @($common + @('doctor', '--transport', 'mcp')) 0
} else {
    Write-Host ''
    Write-Host ("  skip 10/10: no api\Start-KitMcpServer.ps1 in {0} - the kit is older than 0.3.0" -f $KitRoot) -ForegroundColor Yellow
}

if ($Model) {
    # One question, at level read-only: a model may look at the cabinet here and cannot change it.
    Run 'chat' "extra: one chat turn with the local model ($Model), read-only" @($common + @('chat', '--model', $Model, '--level', 'read-only', '--message', 'what is the state of the cabinet, in two sentences?', '--max-rounds', '4')) 0
    Run 'resume' 'extra: continue the newest conversation, and the memory it reads' @($common + @('chat', '--model', $Model, '--level', 'read-only', '--continue', '--message', 'and what would you check next?', '--max-rounds', '3')) 0
}

Write-Host ''
Write-Host ('=' * 78) -ForegroundColor DarkGray
Write-Host 'SMOKE RESULT' -ForegroundColor Cyan
$surprises = 0
foreach ($key in $results.Keys) {
    $code = $results[$key]
    $want = $expectations[$key]
    $label = if ($code -eq $want) { "exit $code as expected" } else { "exit $code, expected $want" }
    if ($code -ne $want) {
        $surprises += 1
        Write-Host ("  {0,-12} {1}" -f $key, $label) -ForegroundColor Red
    } else {
        Write-Host ("  {0,-12} {1}" -f $key, $label) -ForegroundColor Green
    }
}
Write-Host ''
if ($surprises -gt 0) {
    Write-Host ("{0} step(s) did something other than expected. Read the output above; this is a wiring problem." -f $surprises) -ForegroundColor Red
    Write-Host 'Report it with the kit version (fagent doctor) and the step number.' -ForegroundColor Yellow
    exit 1
}
Write-Host 'Every step did what it was told to do. The wiring to the real kit holds.' -ForegroundColor Green
Write-Host ''
Write-Host 'Now the human part, on purpose:' -ForegroundColor Yellow
Write-Host ("  {0} run support.bundle --kit {1} --level operator" -f 'node --no-warnings src/cli.ts', $KitRoot)
Write-Host '  Type yes at the prompt, then check the file the kit wrote and fagent history.'
Write-Host ''
Write-Host ("  {0} report --since 1d" -f 'node --no-warnings src/cli.ts')
Write-Host '  It must list the change you just confirmed, and say that it is history and not the state of the cabinet.'
Write-Host ''
Write-Host 'If every line above looked sane, the harness is wired to the real kit.' -ForegroundColor Green
exit 0
