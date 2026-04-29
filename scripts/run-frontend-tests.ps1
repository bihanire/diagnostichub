$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $projectRoot "frontend"
$nodeDir = "C:\Program Files\nodejs"
$npmCmdPath = Join-Path $nodeDir "npm.cmd"
$npmCommand = $null

if ((Test-Path $nodeDir) -and ($env:Path -notlike "*$nodeDir*")) {
    $env:Path = "$nodeDir;$env:Path"
}

if (Test-Path $npmCmdPath) {
    $npmCommand = @{ Source = $npmCmdPath }
}
else {
    $resolvedNpm = Get-Command npm -ErrorAction SilentlyContinue
    if ($resolvedNpm) {
        $npmCommand = @{ Source = $resolvedNpm.Source }
    }
}

if (-not $npmCommand) {
    throw "npm was not found in PATH. Install Node.js first, then rerun this script."
}

Push-Location $frontendDir
try {
    & $npmCommand.Source test
}
finally {
    Pop-Location
}
