<#
.SYNOPSIS
    Push environment variables from .env.vercel to Vercel project.

.DESCRIPTION
    Reads key=value pairs from the specified .env file and upserts each
    variable in Vercel for all target environments (production, preview,
    development) using the Vercel CLI.

.PARAMETER EnvFile
    Path to the .env file to read. Defaults to .env.vercel in current directory.

.PARAMETER Environments
    Vercel environments to set variables in. Defaults to production, preview,
    and development.

.EXAMPLE
    .\scripts\push-env-to-vercel.ps1

.EXAMPLE
    .\scripts\push-env-to-vercel.ps1 -EnvFile .env.vercel -Environments production
#>

param(
    [string]$EnvFile = ".env.vercel",
    [string[]]$Environments = @("production", "preview", "development")
)

$ErrorActionPreference = "Stop"

# --- Verify Vercel CLI is available ---
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERROR: Vercel CLI not found." -ForegroundColor Red
    Write-Host "Install it with: npm install -g vercel" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# --- Verify env file exists ---
$envFilePath = Join-Path $PSScriptRoot "..\$EnvFile"
if (-not (Test-Path $envFilePath)) {
    Write-Host ""
    Write-Host "ERROR: Env file not found: $EnvFile" -ForegroundColor Red
    Write-Host "Copy .env.vercel.example to .env.vercel and fill in your values." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Reading from: $envFilePath" -ForegroundColor Cyan
Write-Host "Target environments: $($Environments -join ', ')" -ForegroundColor Cyan
Write-Host ""

$lines = Get-Content $envFilePath
$pushed = 0

foreach ($line in $lines) {
    # Skip blank lines and comments.
    if ($line -match '^\s*$' -or $line -match '^\s*#') {
        continue
    }

    # Parse KEY=VALUE.
    if ($line -notmatch '^([^=]+)=(.+)$') {
        Write-Host "  Skipping malformed line: $line" -ForegroundColor DarkGray
        continue
    }

    $key = $Matches[1].Trim()
    $value = $Matches[2].Trim()

    if (-not $key -or -not $value -or $value -like "*your-*") {
        Write-Host "  Skipping placeholder: $key" -ForegroundColor DarkYellow
        continue
    }

    Write-Host "Setting $key ..." -ForegroundColor White

    foreach ($env in $Environments) {
        # Remove existing variable silently (ignore errors if it doesn't exist).
        try {
            $null = vercel env rm $key $env --yes 2>&1
        } catch {
            # Ignore - variable simply didn't exist yet.
        }

        # Add the new value by piping it to vercel env add.
        $value | vercel env add $key $env

        if ($LASTEXITCODE -ne 0) {
            Write-Host "  FAILED for env: $env" -ForegroundColor Red
        } else {
            Write-Host "  Set in $env" -ForegroundColor Green
        }
    }

    $pushed++
}

Write-Host ""
if ($pushed -eq 0) {
    Write-Host "No variables were pushed (all were placeholders or invalid)." -ForegroundColor Yellow
    Write-Host "Edit .env.vercel with your real Railway URLs and run this script again." -ForegroundColor Yellow
} else {
    Write-Host "$pushed variable(s) pushed to Vercel successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Redeploy your Vercel project to apply the changes:" -ForegroundColor Cyan
    Write-Host "  vercel --prod" -ForegroundColor White
}

Write-Host ""
