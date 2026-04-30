$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot "venv\Scripts\python.exe"
$backendDir = Join-Path $projectRoot "backend"

if (-not (Test-Path $venvPython)) {
    throw "Python virtual environment was not found at $venvPython"
}

Push-Location $backendDir
try {
    $previousPythonWarnings = $env:PYTHONWARNINGS
    # Python 3.14+ surfaces an upstream FastAPI routing deprecation warning
    # that is unrelated to app behavior. Keep CI/local test output readable.
    $env:PYTHONWARNINGS = "ignore::DeprecationWarning:fastapi.routing"
    & $venvPython -m unittest discover -s tests -v
}
finally {
    if ($null -eq $previousPythonWarnings) {
        Remove-Item Env:PYTHONWARNINGS -ErrorAction SilentlyContinue
    }
    else {
        $env:PYTHONWARNINGS = $previousPythonWarnings
    }
    Pop-Location
}
