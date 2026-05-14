param(
    [int]$Port = 3015,
    [string[]]$Routes = @("/", "/families/display", "/triage", "/result", "/ops/login", "/insights")
)

$ErrorActionPreference = "Stop"

function Get-ProcessLog {
    param(
        [string]$StdOut,
        [string]$StdErr,
        [int]$TailLines = 40
    )

    $sections = @()
    if (Test-Path $StdOut) {
        $stdoutLines = Get-Content -LiteralPath $StdOut -Tail $TailLines -ErrorAction SilentlyContinue
        if ($stdoutLines) {
            $sections += "stdout:`n$($stdoutLines -join "`n")"
        }
    }
    if (Test-Path $StdErr) {
        $stderrLines = Get-Content -LiteralPath $StdErr -Tail $TailLines -ErrorAction SilentlyContinue
        if ($stderrLines) {
            $sections += "stderr:`n$($stderrLines -join "`n")"
        }
    }
    if ($sections.Count -eq 0) {
        return "No process logs were captured."
    }
    return $sections -join "`n`n"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $projectRoot "frontend"
$serverPath = Join-Path $frontendDir ".next\standalone\server.js"

if (-not (Test-Path $serverPath)) {
    throw "Standalone build was not found at $serverPath. Run npm run build in frontend first."
}

$logPrefix = Join-Path ([System.IO.Path]::GetTempPath()) ("diagnostichub-frontend-routes-" + [guid]::NewGuid().ToString("N"))
$stdoutPath = "$logPrefix.out.log"
$stderrPath = "$logPrefix.err.log"
$previousPort = $env:PORT
$process = $null

try {
    $env:PORT = "$Port"
    $process = Start-Process -FilePath "node.exe" -ArgumentList @(".next\standalone\server.js") -WorkingDirectory $frontendDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $ready = $false
    for ($attempt = 1; $attempt -le 40; $attempt++) {
        $process.Refresh()
        if ($process.HasExited) {
            throw "Frontend server exited before becoming ready.`n`n$(Get-ProcessLog -StdOut $stdoutPath -StdErr $stderrPath)"
        }

        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $ready) {
        throw "Frontend server did not become ready on port $Port.`n`n$(Get-ProcessLog -StdOut $stdoutPath -StdErr $stderrPath)"
    }

    foreach ($route in $Routes) {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$route" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -ne 200) {
            throw "Route $route returned HTTP $($response.StatusCode)."
        }
        [PSCustomObject]@{
            Route = $route
            Status = $response.StatusCode
        }
    }

    Write-Host "Frontend route smoke passed on port $Port"
}
finally {
    if ($process) {
        $process.Refresh()
        if (-not $process.HasExited) {
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                & taskkill.exe /PID $process.Id /T /F | Out-Null
            }
            else {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }

    if ($null -eq $previousPort) {
        Remove-Item Env:\PORT -ErrorAction SilentlyContinue
    }
    else {
        $env:PORT = $previousPort
    }

    foreach ($path in @($stdoutPath, $stderrPath)) {
        if (Test-Path $path) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }
}
