$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot "venv\Scripts\python.exe"
$backendDir = Join-Path $projectRoot "backend"

if (-not (Test-Path $venvPython)) {
    throw "Python virtual environment was not found at $venvPython"
}

Push-Location $backendDir
try {
    & $venvPython -m unittest discover -s tests -v
}
finally {
    Pop-Location
}
