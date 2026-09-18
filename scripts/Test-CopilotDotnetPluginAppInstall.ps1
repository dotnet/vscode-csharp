#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Manually tests C# extension plugin installation through the GitHub Copilot App runtime.

.DESCRIPTION
    Builds the extension, hides standalone Copilot CLI executables from PATH, and launches
    an isolated Extension Development Host for manual verification.

.PARAMETER SkipBuild
    Skips npm run packageDev when the extension has already been built.

.PARAMETER ValidateOnly
    Validates App discovery and PATH isolation without building or launching VS Code.

.PARAMETER UseExistingCopilotHome
    Uses the current Copilot profile instead of a disposable COPILOT_HOME. This may modify
    the plugins visible in the GitHub Copilot App.

.EXAMPLE
    ./scripts/Test-CopilotDotnetPluginAppInstall.ps1

.EXAMPLE
    ./scripts/Test-CopilotDotnetPluginAppInstall.ps1 -SkipBuild

.EXAMPLE
    ./scripts/Test-CopilotDotnetPluginAppInstall.ps1 -ValidateOnly
#>
[CmdletBinding()]
param(
    [switch] $SkipBuild,
    [switch] $ValidateOnly,
    [switch] $UseExistingCopilotHome
)

$ErrorActionPreference = 'Stop'

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    throw 'This script currently tests the Windows GitHub Copilot App install paths.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$standaloneNames = @('copilot.exe', 'copilot.cmd', 'copilot.bat')

function Get-PathDirectories {
    param([string] $PathValue)

    return @(
        $PathValue -split ';' |
            ForEach-Object { $_.Trim().Trim('"') } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}

function Get-StandaloneCopilotExecutables {
    param([string] $PathValue)

    $executables = foreach ($directory in Get-PathDirectories $PathValue) {
        if (-not [System.IO.Path]::IsPathRooted($directory)) {
            continue
        }

        foreach ($name in $standaloneNames) {
            $candidate = Join-Path $directory $name
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $candidate
            }
        }
    }

    return @($executables)
}

function Get-PathWithoutStandaloneCopilot {
    param([string] $PathValue)

    $directories = foreach ($directory in Get-PathDirectories $PathValue) {
        $containsStandaloneCli = $false
        if ([System.IO.Path]::IsPathRooted($directory)) {
            foreach ($name in $standaloneNames) {
                if (Test-Path -LiteralPath (Join-Path $directory $name) -PathType Leaf) {
                    $containsStandaloneCli = $true
                    break
                }
            }
        }

        if (-not $containsStandaloneCli) {
            $directory
        }
    }

    return $directories -join ';'
}

function Find-GitHubCopilotAppRuntime {
    param([string] $PathValue)

    if (-not [System.IO.Path]::IsPathRooted($env:LOCALAPPDATA)) {
        throw 'LOCALAPPDATA must be an absolute path to locate the GitHub Copilot App CLI cache.'
    }

    $roots = [System.Collections.Generic.List[string]]::new()
    $roots.Add((Join-Path $env:LOCALAPPDATA 'Programs\GitHub Copilot'))
    foreach ($programFilesRoot in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ([System.IO.Path]::IsPathRooted($programFilesRoot)) {
            $roots.Add((Join-Path $programFilesRoot 'GitHub Copilot'))
        }
    }
    foreach ($directory in Get-PathDirectories $PathValue) {
        if ([System.IO.Path]::IsPathRooted($directory)) {
            $roots.Add($directory)
        }
    }

    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($root in $roots) {
        if (-not $seen.Add($root)) {
            continue
        }

        $appExecutable = Join-Path $root 'github.exe'
        $metadataPath = Join-Path $root 'copilot-sdk\cliVersion.d.ts'
        if (-not (Test-Path -LiteralPath $appExecutable -PathType Leaf) -or
            -not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
            continue
        }

        $metadata = Get-Content -LiteralPath $metadataPath -Raw
        $versionMatch = [regex]::Match(
            $metadata,
            'const COPILOT_CLI_VERSION\s*=\s*"(\d+\.\d+\.\d+[\w.+-]*)";'
        )
        if (-not $versionMatch.Success) {
            continue
        }

        $version = $versionMatch.Groups[1].Value
        $cacheVersion = [regex]::Replace($version, '[^a-zA-Z0-9._-]', '_')
        $runtime = Join-Path $env:LOCALAPPDATA "github-copilot-sdk\cli\$cacheVersion\copilot.exe"
        if (Test-Path -LiteralPath $runtime -PathType Leaf) {
            return [pscustomobject]@{
                AppRoot = $root
                Version = $version
                Runtime = $runtime
            }
        }
    }

    throw 'A complete GitHub Copilot App installation was not found. Open the App once so it can extract its CLI, then retry.'
}

$codeCommand = Get-Command code.cmd -ErrorAction SilentlyContinue
if (-not $codeCommand) {
    $codeCommand = Get-Command code -ErrorAction SilentlyContinue
}
if (-not $codeCommand) {
    throw 'The VS Code command-line launcher was not found on PATH.'
}
$codeExecutable = Join-Path (Split-Path (Split-Path $codeCommand.Source -Parent) -Parent) 'Code.exe'
if (-not (Test-Path -LiteralPath $codeExecutable -PathType Leaf)) {
    throw "The VS Code executable was not found at $codeExecutable."
}

$originalPath = $env:PATH
$filteredPath = Get-PathWithoutStandaloneCopilot $originalPath
$standaloneBefore = Get-StandaloneCopilotExecutables $originalPath
$standaloneAfter = Get-StandaloneCopilotExecutables $filteredPath
if ($standaloneAfter.Count -ne 0) {
    throw "Failed to hide standalone Copilot CLI executables:`n$($standaloneAfter -join [Environment]::NewLine)"
}

$app = Find-GitHubCopilotAppRuntime $filteredPath

Write-Host 'GitHub Copilot App-only test environment is valid.' -ForegroundColor Green
Write-Host "  App root:                 $($app.AppRoot)"
Write-Host "  App CLI version:          $($app.Version)"
Write-Host "  App CLI runtime:          $($app.Runtime)"
Write-Host "  Standalone CLIs hidden:   $($standaloneBefore.Count)"
Write-Host "  Standalone CLIs remaining: $($standaloneAfter.Count)"

if ($ValidateOnly) {
    return
}

if (-not $SkipBuild) {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npmCommand) {
        $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
    }
    if (-not $npmCommand) {
        throw 'npm was not found on PATH.'
    }

    Write-Host "`nBuilding the extension with npm run packageDev..." -ForegroundColor Cyan
    Push-Location $repoRoot
    try {
        & $npmCommand.Source run packageDev
        if ($LASTEXITCODE -ne 0) {
            throw "npm run packageDev failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "vscode-csharp-copilot-app-$([guid]::NewGuid().ToString('N'))"
$userDataDirectory = Join-Path $testRoot 'vscode-user'
$copilotHome = Join-Path $testRoot 'copilot-home'
New-Item -ItemType Directory -Path $userDataDirectory -Force | Out-Null
if (-not $UseExistingCopilotHome) {
    New-Item -ItemType Directory -Path $copilotHome -Force | Out-Null
}

$hadCopilotHome = Test-Path Env:COPILOT_HOME
$originalCopilotHome = $env:COPILOT_HOME

try {
    $env:PATH = $filteredPath
    if (-not $UseExistingCopilotHome) {
        $env:COPILOT_HOME = $copilotHome
    }

    Write-Host "`nLaunching an isolated Extension Development Host." -ForegroundColor Cyan
    Write-Host '1. Trust the workspace if prompted.'
    Write-Host '2. Open View > Output and select C#.'
    Write-Host '3. Confirm "Copilot .NET plugin result: installed" and the installation notification.'
    Write-Host "`nTemporary test root: $testRoot"

    $codeArguments = @(
        '--new-window'
        "--user-data-dir=`"$userDataDirectory`""
        '--disable-extension=github.copilot'
        '--disable-extension=github.copilot-chat'
        '--log=ms-dotnettools.csharp:trace'
        "--extensionDevelopmentPath=`"$repoRoot`""
        "`"$repoRoot`""
    ) -join ' '
    Start-Process -FilePath $codeExecutable -ArgumentList $codeArguments
    Write-Host 'VS Code launched. Complete the checks in that window.' -ForegroundColor Green
}
finally {
    $env:PATH = $originalPath
    if ($hadCopilotHome) {
        $env:COPILOT_HOME = $originalCopilotHome
    }
    else {
        Remove-Item Env:COPILOT_HOME -ErrorAction SilentlyContinue
    }

    Write-Host "Test data is retained at $testRoot."
}