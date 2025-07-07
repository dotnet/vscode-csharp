#!/usr/bin/env pwsh

Write-Host "`nStarting project setup..." -ForegroundColor Cyan

function Run-Command($cmd, $errorMsg) {
    try {
        Write-Host "Running: $cmd" -ForegroundColor Yellow
        Invoke-Expression $cmd
    } catch {
        Write-Host "$errorMsg" -ForegroundColor Red
        exit 1
    }
}

# 1. Install vsts-npm-auth globally
Run-Command "npm install -g vsts-npm-auth" "Failed to install vsts-npm-auth."

# 2. Authenticate with vsts-npm-auth
if (Test-Path ".npmrc") {
    try {
        Run-Command "vsts-npm-auth -config .npmrc" "Initial authentication failed."
    } catch {
        Write-Host "Trying with force (-f) flag..." -ForegroundColor DarkYellow
        Run-Command "vsts-npm-auth -config .npmrc -f" "Forced authentication failed."
    }
} else {
    Write-Host ".npmrc file not found in the current directory." -ForegroundColor Red
    exit 1
}

# 3. Install project dependencies
Run-Command "npm install" "Failed to install project dependencies."

# 4. Install gulp globally
Run-Command "npm install -g gulp" "Failed to install Gulp globally."

# 5. Run gulp task
Run-Command "gulp installDependencies" "Failed to run 'gulp installDependencies'."

Write-Host "`n✅ Setup complete." -ForegroundColor Green
