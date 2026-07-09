<#
.SYNOPSIS
    Publishes signed VSIX packages in this folder to the Visual Studio Marketplace using vsce.

.DESCRIPTION
    For every *.vsix in the script directory, this script locates the matching
    .manifest and .signature.p7s files and publishes the package with vsce (run via
    npx @vscode/vsce), passing --packagePath, --manifestPath and --signaturePath.

    Publishing is tolerant of failures: if one package fails (for example because it
    has already been published), the error is recorded and the script continues with
    the remaining packages. A summary is printed at the end and the script exits with a
    non-zero code only if at least one package failed.

.PARAMETER Path
    Directory containing the .vsix/.manifest/.signature.p7s files. Defaults to the
    script's own directory.

.PARAMETER PreRelease
    Publish the packages as pre-release versions.

.PARAMETER WhatIf
    Show the vsce commands that would run without actually publishing.

.NOTES
    Authentication uses Azure credentials (vsce --azure-credential). You must have the
    Azure CLI (az) installed and be logged in (run 'az login') before publishing.

.EXAMPLE
    az login
    ./Publish-Vsix.ps1 -PreRelease
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = $PSScriptRoot,
    [switch]$PreRelease
)

$ErrorActionPreference = 'Stop'

# Publishing authenticates with Azure credentials, so the Azure CLI must be installed
# and a user must be signed in (az login).
$azCmd = Get-Command az -ErrorAction SilentlyContinue
if (-not $azCmd) {
    throw "The Azure CLI (az) was not found on PATH. Install it from https://aka.ms/azcli and run 'az login', then try again."
}

az account show 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "You are not logged in to the Azure CLI. Run 'az login' and try again."
}

# Run vsce via npx so no global install is required. npx will fetch @vscode/vsce
# on demand (and reuse it from the cache on subsequent runs).
$npxCmd = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxCmd) {
    throw "npx was not found on PATH. Install Node.js (which includes npx) and try again."
}
$vsce = $npxCmd.Source
$vscePrefixArgs = @('--yes', '@vscode/vsce')

if (-not (Test-Path -LiteralPath $Path)) {
    throw "Path '$Path' does not exist."
}

$vsixFiles = Get-ChildItem -LiteralPath $Path -Filter '*.vsix' -File | Sort-Object Name
if (-not $vsixFiles) {
    Write-Warning "No .vsix files found in '$Path'. Nothing to publish."
    return
}

$results = New-Object System.Collections.Generic.List[object]

foreach ($vsix in $vsixFiles) {
    $base         = [System.IO.Path]::GetFileNameWithoutExtension($vsix.Name)
    $manifestPath = Join-Path $vsix.DirectoryName "$base.manifest"
    $signaturePath = Join-Path $vsix.DirectoryName "$base.signature.p7s"

    Write-Host ""
    Write-Host "=== Publishing $($vsix.Name) ===" -ForegroundColor Cyan

    # Verify the companion files exist before attempting to publish.
    $missing = @()
    if (-not (Test-Path -LiteralPath $manifestPath))  { $missing += "manifest ($manifestPath)" }
    if (-not (Test-Path -LiteralPath $signaturePath)) { $missing += "signature ($signaturePath)" }
    if ($missing.Count -gt 0) {
        $reason = "Missing companion file(s): $($missing -join ', ')"
        Write-Warning $reason
        $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'Skipped'; Detail = $reason })
        continue
    }

    $vsceArgs = @(
        $vscePrefixArgs
        'publish'
        '--packagePath',   $vsix.FullName
        '--manifestPath',  $manifestPath
        '--signaturePath', $signaturePath
    )
    if ($PreRelease) { $vsceArgs += '--pre-release' }
    $vsceArgs += '--azure-credential'

    if (-not $PSCmdlet.ShouldProcess($vsix.Name, "vsce publish")) {
        $displayArgs = $vsceArgs | Where-Object { $_ }
        Write-Host "WhatIf: $vsce $($displayArgs -join ' ')"
        $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'WhatIf'; Detail = '' })
        continue
    }

    try {
        & $vsce @vsceArgs
        $exit = $LASTEXITCODE
        if ($exit -eq 0) {
            Write-Host "Published $($vsix.Name)" -ForegroundColor Green
            $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'Published'; Detail = '' })
        }
        else {
            $reason = "vsce exited with code $exit (may already be published)."
            Write-Warning $reason
            $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'Failed'; Detail = $reason })
        }
    }
    catch {
        Write-Warning "Error publishing $($vsix.Name): $($_.Exception.Message)"
        $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'Failed'; Detail = $_.Exception.Message })
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -eq 'Failed' })
if ($failed.Count -gt 0) {
    Write-Warning "$($failed.Count) package(s) failed to publish. See summary above."
    exit 1
}
