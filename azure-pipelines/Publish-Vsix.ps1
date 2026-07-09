<#
.SYNOPSIS
    Publishes signed VSIX packages in this folder to the Visual Studio Marketplace using vsce.

.DESCRIPTION
    For every *.vsix in the target directory, this script locates the matching
    .manifest and .signature.p7s files and publishes the package with vsce (run via
    npx @vscode/vsce), passing --packagePath, --manifestPath and --signaturePath.

    Publishing is tolerant of failures: duplicate-package responses are treated as
    successful, transient failures are retried, and the script continues with the
    remaining packages. A summary is printed at the end and the script exits with a
    non-zero code only if at least one package failed.

.PARAMETER Path
    Directory containing the .vsix/.manifest/.signature.p7s files. Defaults to the
    script's own directory.

.PARAMETER PreRelease
    Publish the packages as pre-release versions.

.PARAMETER WhatIf
    Show the vsce commands that would run without actually publishing.

.PARAMETER DryRun
    Enables WhatIf behavior and verifies Marketplace credentials without publishing.

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
    [switch]$PreRelease,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$publisher = 'ms-dotnettools'

if ($DryRun) {
    $WhatIfPreference = $true
}

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
$npx = $npxCmd.Source
$vscePrefixArgs = @('--yes', '@vscode/vsce')
$vsceVersionPattern = 'v[0-9.]+(?:-[0-9a-z.]+)*'
$vscePackagePattern = '[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*(?:\s+\([^)]+\))?'

function Test-AlreadyPublishedFailure {
    param(
        [string[]]$CommandOutputLines
    )

    if ($null -eq $CommandOutputLines -or $CommandOutputLines.Length -eq 0) {
        return $false
    }

    foreach ($commandOutputLine in $CommandOutputLines) {
        if ($commandOutputLine -match "^\s*ERROR\s+$vscePackagePattern\s+$vsceVersionPattern\s+already exists\.\s*$") {
            return $true
        }
    }

    return $false
}

function Get-LastOutputExcerpt {
    param(
        [string[]]$CommandOutputLines
    )

    $lastNonEmptyOutputLine = $CommandOutputLines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 1
    if ([string]::IsNullOrWhiteSpace($lastNonEmptyOutputLine)) {
        return 'No output captured from vsce.'
    }

    if ($lastNonEmptyOutputLine.Length -gt 200) {
        return $lastNonEmptyOutputLine.Substring(0, 200) + '...'
    }

    return $lastNonEmptyOutputLine
}

function Invoke-Vsce {
    param(
        [string[]]$Arguments
    )

    $commandOutputLines = & $npx @Arguments 2>&1 | Out-String -Stream
    $exitCode = $LASTEXITCODE

    if ($null -ne $commandOutputLines -and $commandOutputLines.Length -gt 0) {
        Write-Host ($commandOutputLines -join [Environment]::NewLine)
    }

    return @{
        OutputLines = $commandOutputLines
        ExitCode = $exitCode
    }
}

function Invoke-VscePublish {
    param(
        [string[]]$Arguments
    )

    $retryDelaysInMinutes = @(1, 3, 5)
    $maxAttempts = $retryDelaysInMinutes.Length + 1

    for ($attemptIndex = 0; $attemptIndex -lt $maxAttempts; $attemptIndex++) {
        $attempt = $attemptIndex + 1
        Write-Host "Publish attempt $attempt of $maxAttempts."
        $publishResult = Invoke-Vsce -Arguments $Arguments
        $publishOutputLines = $publishResult.OutputLines
        $exitCode = $publishResult.ExitCode

        if ($exitCode -eq 0) {
            Write-Host 'vsce publish succeeded.'
            return @{
                Status = 'Published'
                Detail = ''
            }
        }

        if (Test-AlreadyPublishedFailure -CommandOutputLines $publishOutputLines) {
            Write-Warning 'vsce publish reported that the package version already exists. Treating this duplicate-package result as successful.'
            return @{
                Status = 'AlreadyPublished'
                Detail = ''
            }
        }

        $lastOutputExcerpt = Get-LastOutputExcerpt -CommandOutputLines $publishOutputLines
        if ($attempt -lt $maxAttempts) {
            $delayMinutes = $retryDelaysInMinutes[$attemptIndex]
            Write-Warning "vsce publish failed with exit code $exitCode on attempt $attempt of $maxAttempts. Last output: $lastOutputExcerpt. Retrying in $delayMinutes minute(s)."
            Start-Sleep -Seconds ($delayMinutes * 60)
            continue
        }

        return @{
            Status = 'Failed'
            Detail = "vsce publish failed after $maxAttempts attempts. Last output: $lastOutputExcerpt"
        }
    }
}

if ($WhatIfPreference) {
    Write-Host "Dry run mode enabled. Verifying Marketplace credentials."
    $verifyArgs = @($vscePrefixArgs + @('verify-pat', '--azure-credential', $publisher))
    Write-Host "##[command]$npx $($verifyArgs -join ' ')"
    $verifyResult = Invoke-Vsce -Arguments $verifyArgs
    if ($verifyResult.ExitCode -ne 0) {
        throw "Marketplace credential verification failed with exit code $($verifyResult.ExitCode)."
    }
}

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
    $vsixBaseName = [System.IO.Path]::GetFileNameWithoutExtension($vsix.Name)
    $manifestPath = Join-Path $vsix.DirectoryName "$vsixBaseName.manifest"
    $signaturePath = Join-Path $vsix.DirectoryName "$vsixBaseName.signature.p7s"

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
        Write-Host "DryRun: $npx $($displayArgs -join ' ')"
        $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'WhatIf'; Detail = '' })
        continue
    }

    try {
        $publishResult = Invoke-VscePublish -Arguments $vsceArgs
        if ($publishResult.Status -eq 'Published') {
            Write-Host "Published $($vsix.Name)" -ForegroundColor Green
            $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'Published'; Detail = '' })
        }
        elseif ($publishResult.Status -eq 'AlreadyPublished') {
            Write-Host "$($vsix.Name) was already published" -ForegroundColor Yellow
            $results.Add([pscustomobject]@{ Package = $vsix.Name; Status = 'AlreadyPublished'; Detail = '' })
        }
        else {
            $reason = $publishResult.Detail
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
