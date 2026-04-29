param(
    [string]$BackendEnvPath = "backend\.env.production.example",
    [string]$ComposeEnvPath = ".env.compose.production.example"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendEnvFile = Join-Path $projectRoot $BackendEnvPath
$composeEnvFile = Join-Path $projectRoot $ComposeEnvPath

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Env file not found: $Path"
    }

    $values = @{}
    foreach ($line in Get-Content $Path) {
        if (-not $line -or $line.TrimStart().StartsWith("#") -or $line -notmatch "=") {
            continue
        }

        $pair = $line.Split("=", 2)
        $values[$pair[0].Trim()] = $pair[1].Trim()
    }

    return $values
}

function Add-Finding {
    param(
        [System.Collections.Generic.List[string]]$Bucket,
        [string]$Message
    )

    $Bucket.Add($Message) | Out-Null
}

function Test-PlaceholderValue {
    param([string]$Value)

    if (-not $Value) {
        return $true
    }

    return (
        $Value -match "^replace-with" -or
        $Value -match "^change-me" -or
        $Value -match "<.+>" -or
        $Value -eq "ops-password"
    )
}

$backendEnv = Read-EnvFile -Path $backendEnvFile
$composeEnv = Read-EnvFile -Path $composeEnvFile

$errors = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

Write-Host "Rollout environment check"
Write-Host "-------------------------"
Write-Host "backend env:" $backendEnvFile
Write-Host "compose env:" $composeEnvFile

foreach ($requiredKey in @(
    "DATABASE_URL",
    "CORS_ORIGINS",
    "OPS_SHARED_PASSWORD",
    "OPS_SESSION_SECRET",
    "OPS_COOKIE_SECURE"
)) {
    if (-not $backendEnv.ContainsKey($requiredKey)) {
        Add-Finding -Bucket $errors -Message "Backend env is missing $requiredKey."
    }
}

foreach ($requiredKey in @(
    "BACKEND_CORS_ORIGINS",
    "OPS_SHARED_PASSWORD",
    "OPS_SESSION_SECRET",
    "OPS_COOKIE_SECURE",
    "FRONTEND_PUBLIC_API_BASE_URL"
)) {
    if (-not $composeEnv.ContainsKey($requiredKey)) {
        Add-Finding -Bucket $errors -Message "Compose env is missing $requiredKey."
    }
}

if ($backendEnv.ContainsKey("DATABASE_URL")) {
    $databaseUrl = $backendEnv["DATABASE_URL"]
    if ($databaseUrl -match "^sqlite") {
        Add-Finding -Bucket $errors -Message "Backend DATABASE_URL still points to SQLite. Production should use PostgreSQL."
    }
    elseif ($databaseUrl -notmatch "^postgresql\+psycopg://") {
        Add-Finding -Bucket $warnings -Message "Backend DATABASE_URL is not using the expected postgresql+psycopg scheme."
    }
}

if ($backendEnv.ContainsKey("CORS_ORIGINS") -and $backendEnv["CORS_ORIGINS"] -notmatch "^https://") {
    Add-Finding -Bucket $warnings -Message "Backend CORS_ORIGINS is not HTTPS. This is only acceptable for local HTTP testing."
}

if ($composeEnv.ContainsKey("BACKEND_CORS_ORIGINS") -and $composeEnv["BACKEND_CORS_ORIGINS"] -notmatch "^https://") {
    Add-Finding -Bucket $errors -Message "Compose BACKEND_CORS_ORIGINS should be HTTPS for rollout."
}

if ($composeEnv.ContainsKey("FRONTEND_PUBLIC_API_BASE_URL") -and $composeEnv["FRONTEND_PUBLIC_API_BASE_URL"] -notmatch "^https://") {
    Add-Finding -Bucket $errors -Message "Compose FRONTEND_PUBLIC_API_BASE_URL should be HTTPS for rollout."
}

foreach ($field in @("OPS_SHARED_PASSWORD", "OPS_SESSION_SECRET")) {
    if ($backendEnv.ContainsKey($field) -and (Test-PlaceholderValue -Value $backendEnv[$field])) {
        Add-Finding -Bucket $errors -Message "Backend $field still uses a placeholder or weak default."
    }
    if ($composeEnv.ContainsKey($field) -and (Test-PlaceholderValue -Value $composeEnv[$field])) {
        Add-Finding -Bucket $errors -Message "Compose $field still uses a placeholder or weak default."
    }
}

if ($backendEnv.ContainsKey("OPS_SHARED_PASSWORD") -and $backendEnv["OPS_SHARED_PASSWORD"].Length -lt 20) {
    Add-Finding -Bucket $warnings -Message "Backend OPS_SHARED_PASSWORD is shorter than 20 characters."
}

foreach ($envName in @("backend", "compose")) {
    $source = if ($envName -eq "backend") { $backendEnv } else { $composeEnv }
    if ($source.ContainsKey("OPS_SESSION_SECRET") -and $source["OPS_SESSION_SECRET"].Length -lt 64) {
        Add-Finding -Bucket $warnings -Message "$envName OPS_SESSION_SECRET is shorter than 64 characters."
    }
}

if ($backendEnv.ContainsKey("OPS_COOKIE_SECURE") -and $backendEnv["OPS_COOKIE_SECURE"].ToLowerInvariant() -ne "true") {
    Add-Finding -Bucket $warnings -Message "Backend OPS_COOKIE_SECURE is not true. That is only acceptable for local HTTP use."
}

if ($composeEnv.ContainsKey("OPS_COOKIE_SECURE") -and $composeEnv["OPS_COOKIE_SECURE"].ToLowerInvariant() -ne "true") {
    Add-Finding -Bucket $errors -Message "Compose OPS_COOKIE_SECURE must be true for HTTPS rollout."
}

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "Result: rollout env looks clean."
    exit 0
}

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Errors:"
    foreach ($message in $errors) {
        Write-Host "- $message"
    }
}

if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Warnings:"
    foreach ($message in $warnings) {
        Write-Host "- $message"
    }
}

if ($errors.Count -gt 0) {
    exit 1
}

exit 0
