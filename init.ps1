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
    Write-Host "`n[1/5] Installing vsts-npm-auth globally..." -ForegroundColor Cyan
    Run-Command "npm" @("install", "-g", "vsts-npm-auth") "Failed to install vsts-npm-auth."

    Write-Host "`n[2/5] Authenticating with Azure DevOps..." -ForegroundColor Cyan
    if (Test-Path ".npmrc") {
        try {
            Run-Command "vsts-npm-auth" @("-config", ".npmrc") "Initial authentication failed."
        }
        catch {
            Write-Host "Initial authentication failed. Trying with force (-f) flag..." -ForegroundColor DarkYellow
            Run-Command "vsts-npm-auth" @("-config", ".npmrc", "-f") "Forced authentication failed."
        }
    } else {
        Write-Host ".npmrc file not found in the current directory." -ForegroundColor Red
        throw ".npmrc file not found in the current directory."
    }

    Write-Host "`n[3/5] Installing project dependencies..." -ForegroundColor Cyan
    Run-Command "npm" @("install") "Failed to install project dependencies."

    Write-Host "`n[4/5] Installing Gulp globally..." -ForegroundColor Cyan
    Run-Command "npm" @("install", "-g", "gulp") "Failed to install Gulp globally."

    Write-Host "`n[5/5] Running gulp installDependencies..." -ForegroundColor Cyan
    Run-Command "gulp" @("installDependencies") "Failed to run 'gulp installDependencies'."

    Write-Host "`n✅ Setup complete." -ForegroundColor Green
}
catch {
    Write-Host "`n❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}


