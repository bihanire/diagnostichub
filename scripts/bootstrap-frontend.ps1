$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $projectRoot "frontend"
$envExample = Join-Path $frontendDir ".env.example"
$envFile = Join-Path $frontendDir ".env.local"
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

if ((Test-Path $envExample) -and -not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "Created frontend\.env.local from .env.example"
}

Push-Location $frontendDir
try {
    & $npmCommand.Source install
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend dependency installation failed."
    }
}
finally {
    Pop-Location
}
