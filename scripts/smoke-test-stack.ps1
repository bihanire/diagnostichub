param(
    [string]$BackendUrl = "http://127.0.0.1:8000",
    [string]$FrontendUrl = "http://127.0.0.1:3000",
    [string]$DatabaseUrl = ""
)

$ErrorActionPreference = "Stop"

function Get-ProcessLog {
    param(
        [hashtable]$Runner,
        [int]$TailLines = 40
    )

    $sections = @()

    if ($Runner -and (Test-Path $Runner.StdOut)) {
        $stdout = Get-Content $Runner.StdOut -Tail $TailLines -ErrorAction SilentlyContinue
        if ($stdout) {
            $sections += "stdout:`n$($stdout -join "`n")"
        }
    }

    if ($Runner -and (Test-Path $Runner.StdErr)) {
        $stderr = Get-Content $Runner.StdErr -Tail $TailLines -ErrorAction SilentlyContinue
        if ($stderr) {
            $sections += "stderr:`n$($stderr -join "`n")"
        }
    }

    if ($sections.Count -eq 0) {
        return "No process logs were captured."
    }

    return $sections -join "`n`n"
}

function New-LoggedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )

    $logPrefix = Join-Path ([System.IO.Path]::GetTempPath()) ("rel-encyclopedia-$Name-" + [guid]::NewGuid().ToString("N"))
    $stdoutPath = "$logPrefix.out.log"
    $stderrPath = "$logPrefix.err.log"
    $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    return @{
        Name = $Name
        Process = $process
        StdOut = $stdoutPath
        StdErr = $stderrPath
    }
}

function Remove-ProcessLogs {
    param(
        [hashtable]$Runner
    )

    foreach ($path in @($Runner.StdOut, $Runner.StdErr)) {
        if ($path -and (Test-Path $path)) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [hashtable]$Runner,
        [int]$Attempts = 30,
        [int]$DelaySeconds = 1
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        if ($Runner -and $Runner.Process) {
            $Runner.Process.Refresh()
            if ($Runner.Process.HasExited) {
                throw "$($Runner.Name) exited before $Url became available.`n`n$(Get-ProcessLog -Runner $Runner)"
            }
        }

        try {
            return Invoke-WebRequest -Uri $Url -UseBasicParsing
        }
        catch {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "Timed out waiting for $Url.`n`n$(Get-ProcessLog -Runner $Runner)"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$venvPython = Join-Path $projectRoot "venv\Scripts\python.exe"
$nodeDir = "C:\Program Files\nodejs"
$npmCmdPath = Join-Path $nodeDir "npm.cmd"
$npmCommand = $null
$envFile = Join-Path $backendDir ".env"
$databaseScheme = "unknown"

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

if (-not (Test-Path $venvPython)) {
    throw "Python virtual environment not found at $venvPython"
}

if (-not $npmCommand) {
    throw "npm was not found. Install Node.js first."
}

if (Test-Path $envFile) {
    $databaseLine = Get-Content $envFile | Where-Object { $_ -like "DATABASE_URL=*" } | Select-Object -First 1
    if ($databaseLine) {
        $databaseUrl = $databaseLine.Substring("DATABASE_URL=".Length)
        if ($databaseUrl -match "^(?<scheme>[^:]+)://") {
            $databaseScheme = $Matches.scheme
        }
    }
}

if ($DatabaseUrl) {
    $env:DATABASE_URL = $DatabaseUrl
    if ($DatabaseUrl -match "^(?<scheme>[^:]+)://") {
        $databaseScheme = $Matches.scheme
    }
}

Write-Host "Smoke test starting..."
Write-Host "Configured backend database scheme: $databaseScheme"

$backend = $null
$frontend = $null

try {
    $backend = New-LoggedProcess -Name "backend" -FilePath $venvPython -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") -WorkingDirectory $backendDir
    $null = Wait-ForHttp -Url "$BackendUrl/health" -Runner $backend

    $frontend = New-LoggedProcess -Name "frontend" -FilePath $npmCommand.Source -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000") -WorkingDirectory $frontendDir
    $frontendResponse = Wait-ForHttp -Url $FrontendUrl -Runner $frontend -Attempts 45

    $health = Invoke-RestMethod -Uri "$BackendUrl/health" -Method Get
    if ($health.status -ne "ok") {
        throw "Backend health endpoint did not return ok."
    }

    $searchBody = @{ query = "phone not turning on but vibrates" } | ConvertTo-Json
    $search = Invoke-RestMethod -Uri "$BackendUrl/search" -Method Post -ContentType "application/json" -Body $searchBody
    if (-not $search.best_match) {
        throw "Search smoke test did not return a best_match."
    }

    $startBody = @{ procedure_id = $search.best_match.id } | ConvertTo-Json
    $triageStart = Invoke-RestMethod -Uri "$BackendUrl/triage/start" -Method Post -ContentType "application/json" -Body $startBody
    if ($triageStart.status -ne "question" -and $triageStart.status -ne "complete") {
        throw "Unexpected triage start status: $($triageStart.status)"
    }

    $triageNextStatus = "skipped"
    if ($triageStart.current_node) {
        $nextBody = @{ node_id = $triageStart.current_node.id; answer = "yes" } | ConvertTo-Json
        $triageNext = Invoke-RestMethod -Uri "$BackendUrl/triage/next" -Method Post -ContentType "application/json" -Body $nextBody
        $triageNextStatus = $triageNext.status
    }

    Write-Host ""
    Write-Host "Smoke test passed"
    Write-Host "Backend health:" $health.status
    Write-Host "Search match:" $search.best_match.title
    Write-Host "Search confidence:" $search.confidence
    Write-Host "Triage start:" $triageStart.status
    Write-Host "Triage next:" $triageNextStatus
    Write-Host "Frontend status:" $frontendResponse.StatusCode
}
finally {
    if ($backend -and $backend.Process) {
        Stop-Process -Id $backend.Process.Id -Force -ErrorAction SilentlyContinue
        Remove-ProcessLogs -Runner $backend
    }

    if ($frontend -and $frontend.Process) {
        Stop-Process -Id $frontend.Process.Id -Force -ErrorAction SilentlyContinue
        Remove-ProcessLogs -Runner $frontend
    }
}
