param(
    [switch]$VerifyDatabase
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot "venv\Scripts\python.exe"
$backendEnv = Join-Path $projectRoot "backend\.env"
$frontendEnv = Join-Path $projectRoot "frontend\.env.local"
$nodeDir = "C:\Program Files\nodejs"
$npmCmdPath = Join-Path $nodeDir "npm.cmd"
$npmCommand = $null
$databaseScheme = "unknown"
$databaseUrl = ""

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

Write-Host "Local development check"
Write-Host "-----------------------"

if (Test-Path $venvPython) {
    Write-Host "Python:" (& $venvPython --version)
}
else {
    Write-Host "Python: missing venv executable"
}

if ($npmCommand) {
    Write-Host "npm:" (& $npmCommand.Source --version)
}
else {
    Write-Host "npm: not installed"
}

if (Test-Path $backendEnv) {
    $databaseLine = Get-Content $backendEnv | Where-Object { $_ -like "DATABASE_URL=*" } | Select-Object -First 1
    if ($databaseLine) {
        $databaseUrl = $databaseLine.Substring("DATABASE_URL=".Length)
        if ($databaseUrl -match "^(?<scheme>[^:]+)://") {
            $databaseScheme = $Matches.scheme
        }
    }
}

Write-Host "backend database scheme:" $databaseScheme
Write-Host "backend\.env:" (Test-Path $backendEnv)
Write-Host "frontend\.env.local:" (Test-Path $frontendEnv)

if ($VerifyDatabase) {
    if (-not (Test-Path $venvPython)) {
        Write-Host "database verification: skipped because Python virtual environment is missing"
    }
    elseif (-not $databaseUrl) {
        Write-Host "database verification: skipped because DATABASE_URL is not configured"
    }
    elseif ($databaseScheme -like "sqlite*") {
        Write-Host "database verification: SQLite configured locally"
    }
    else {
        $connectionProbe = @'
import os
import sys
from sqlalchemy import create_engine, text

database_url = os.environ.get("DATABASE_URL")

try:
    engine = create_engine(database_url, future=True, pool_pre_ping=True)
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
except Exception as exc:
    print("database verification: failed")
    print(str(exc))
    raise SystemExit(1)

print("database verification: connection ok")
'@

        $env:DATABASE_URL = $databaseUrl
        $probeOutput = $connectionProbe | & $venvPython - 2>&1
        foreach ($line in $probeOutput) {
            Write-Host $line
        }
    }
}
