param(
    [string]$Path = "docs\sop-import-template",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$python = Join-Path $repoRoot "venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "Python interpreter not found at $python"
}

$resolvedPackPath = Resolve-Path (Join-Path $repoRoot $Path)
$qualityReportPath = Join-Path $resolvedPackPath "quality-report.md"
$benchmarkPath = Join-Path $resolvedPackPath "search-benchmark.csv"
$benchmarkReportPath = Join-Path $resolvedPackPath "search-benchmark-report.md"

Push-Location $backendDir
try {
    Write-Host "Running SOP audit..."
    & $python -m app.db.audit_sop --path $resolvedPackPath --markdown $qualityReportPath --fail-on-warnings | Out-Null
    Write-Host "Audit passed. Report written to $qualityReportPath"

    Write-Host "Running import dry run..."
    & $python -m app.db.import_sop --path $resolvedPackPath --dry-run

    Write-Host "Running search benchmark..."
    & $python -m app.db.search_benchmark --path $benchmarkPath --markdown $benchmarkReportPath --fail-on-mismatch | Out-Null
    Write-Host "Search benchmark passed. Report written to $benchmarkReportPath"

    if ($Apply) {
        Write-Host "Applying SOP pack to the configured database..."
        & $python -m app.db.import_sop --path $resolvedPackPath --replace
    }
}
finally {
    Pop-Location
}
