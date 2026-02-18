#!/usr/bin/env pwsh

Write-Host "`nStarting init..." -ForegroundColor Cyan

# Cross-platform command execution with error checking
function Run-Command($command, $arguments, $errorMsg) {
    Write-Host "Running: $command $($arguments -join ' ')" -ForegroundColor Yellow

    # Check if command exists first
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command is not available on this system. Please ensure you have the command installed globally and it's available in your PATH."
    }

    & $command @arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$errorMsg (Exit code: $LASTEXITCODE)"
    }
}

Push-Location $PSScriptRoot

try {
    Write-Host "`n[1/3] Installing ado-npm-auth globally..." -ForegroundColor Cyan
    Run-Command "npm" @("install", "-g", "ado-npm-auth") "Failed to install ado-npm-auth."

    Write-Host "`n[2/3] Authenticating with Azure DevOps..." -ForegroundColor Cyan
    if (Test-Path ".npmrc") {
        Run-Command "ado-npm-auth" @("-c", ".npmrc") "Authentication failed."
    } else {
        Write-Host ".npmrc file not found in the current directory." -ForegroundColor Red
        throw ".npmrc file not found in the current directory."
    }

    Write-Host "`n[3/3] Installing project dependencies..." -ForegroundColor Cyan
    Run-Command "npm" @("ci") "Failed to install project dependencies."

    Write-Host "`n✅ Setup complete." -ForegroundColor Green
}
catch {
    Write-Host "`n❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}


