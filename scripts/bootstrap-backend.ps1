$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot "venv\Scripts\python.exe"
$venvPip = Join-Path $projectRoot "venv\Scripts\pip.exe"
$backendDir = Join-Path $projectRoot "backend"
$envExample = Join-Path $backendDir ".env.example"
$envFile = Join-Path $backendDir ".env"

if (-not (Test-Path $venvPython)) {
    throw "Python virtual environment was not found at $venvPython"
}

if ((Test-Path $envExample) -and -not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "Created backend\.env from .env.example"
}

Write-Host "Installing backend dependencies..."
& $venvPip install -r (Join-Path $backendDir "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    throw "Backend dependency installation failed."
}

Write-Host "Bootstrap complete."
