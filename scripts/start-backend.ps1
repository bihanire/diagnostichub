param(
    [string]$DatabaseUrl = "",
    [int]$Port = 8010
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot "venv\Scripts\python.exe"
$backendDir = Join-Path $projectRoot "backend"
$envExample = Join-Path $backendDir ".env.example"
$envFile = Join-Path $backendDir ".env"
$databaseScheme = "unknown"

if (-not (Test-Path $venvPython)) {
    throw "Python virtual environment was not found at $venvPython"
}

if ((Test-Path $envExample) -and -not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "Created backend\.env from .env.example"
}

if ($DatabaseUrl) {
    $env:DATABASE_URL = $DatabaseUrl
    if ($DatabaseUrl -match "^(?<scheme>[^:]+)://") {
        $databaseScheme = $Matches.scheme
    }
    Write-Host "Using DATABASE_URL override for this run."
}
elseif (Test-Path $envFile) {
    $databaseLine = Get-Content $envFile | Where-Object { $_ -like "DATABASE_URL=*" } | Select-Object -First 1
    if ($databaseLine) {
        $configuredDatabaseUrl = $databaseLine.Substring("DATABASE_URL=".Length)
        if ($configuredDatabaseUrl -match "^(?<scheme>[^:]+)://") {
            $databaseScheme = $Matches.scheme
        }
    }
}

Write-Host "Starting backend with database scheme:" $databaseScheme "on port" $Port

Push-Location $backendDir
try {
    & $venvPython -m uvicorn app.main:app --host 0.0.0.0 --port $Port
}
finally {
    Pop-Location
}
