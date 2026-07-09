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

.PARAMETER DryRun
    Enables DryRun behavior and verifies Marketplace credentials without publishing.

.PARAMETER CI
    Skips az credentials check when running in CI.

.NOTES
    Authentication uses Azure credentials (vsce --azure-credential). You must have the
    Azure CLI (az) installed and be logged in (run 'az login') before publishing.

.EXAMPLE
    az login
    ./Publish-Vsix.ps1 -PreRelease
#>
[CmdletBinding(SupportsShouldProcess = $false)]
param(
    [string]$Path = $PSScriptRoot,
    [switch]$PreRelease,
    [switch]$DryRun,
    [switch]$CI
)

$ErrorActionPreference = 'Stop'
$publisher = 'ms-dotnettools'
$maxOutputExcerptLength = 200
$retryDelaysInMinutes = @(1, 3, 5)
$secondsPerMinute = 60
$vscePackage = '@vscode/vsce'

if (-not $CI) {
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
}

# Run vsce via npx so no global install is required. npx will fetch @vscode/vsce
# on demand (and reuse it from the cache on subsequent runs).
$npxCmd = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxCmd) {
    throw "npx was not found on PATH. Install Node.js (which includes npx) and try again."
}

$npx = $npxCmd.Source

$vsceVersionPattern = 'v[0-9.]+(?:-[0-9a-z.]+)*'
$vscePackageNamePattern = '[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*(?:\s+\([^)]+\))?'

# Keep this regex aligned with the duplicate-package error format emitted by vsce in release pipeline logs.
$alreadyPublishedRegex = [regex]"^\s*ERROR\s+$vscePackageNamePattern\s+$vsceVersionPattern\s+already exists\.\s*$"

function Test-AlreadyPublishedFailure {
    param(
        [string[]]$CommandOutputLines
    )

    if ($null -eq $CommandOutputLines -or $CommandOutputLines.Length -eq 0) {
        return $false
    }

    foreach ($commandOutputLine in $CommandOutputLines) {
        if ($alreadyPublishedRegex.IsMatch($commandOutputLine)) {
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

    if ($lastNonEmptyOutputLine.Length -gt $maxOutputExcerptLength) {
        return $lastNonEmptyOutputLine.Substring(0, $maxOutputExcerptLength) + '...'
    }

    return $lastNonEmptyOutputLine
}

function Invoke-Vsce {
    param(
        [string[]]$Arguments,
        [switch]$DryRun
    )

    $commandArgs = @(@('--yes', '--package', $vscePackage, 'vsce') + $Arguments)

    if ($DryRun) {
        Write-Host "DryRun: $npx $($commandArgs -join ' ')"
        return @{
            OutputLines = @()
            ExitCode = 0
        }
    }

    Write-Host "##[command]$npx $($commandArgs -join ' ')"
    $commandOutputLines = & $npx @commandArgs 2>&1 | Out-String -Stream
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
        [string]$PackagePath,
        [string]$ManifestPath,
        [string]$SignaturePath
    )

    $vsceArgs = @(
        'publish',
        '--packagePath',   $PackagePath
        '--manifestPath',  $ManifestPath
        '--signaturePath', $SignaturePath
    )
    if ($PreRelease) {
        # Use the Marketplace CLI pre-release channel flag when publishing pre-release VSIX packages.
        $vsceArgs += '--pre-release'
    }
    $vsceArgs += '--azure-credential'

    if ($DryRun) {
        Invoke-Vsce -Arguments $vsceArgs -DryRun | Out-Null
        return @{
            Status = 'DryRun'
            Detail = ''
        }
    }

    $totalAttempts = $retryDelaysInMinutes.Length + 1

    for ($attemptIndex = 0; $attemptIndex -lt $totalAttempts; $attemptIndex++) {
        $attempt = $attemptIndex + 1
        Write-Host "Publish attempt $attempt of $totalAttempts."

        $publishResult = Invoke-Vsce -Arguments $vsceArgs
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
        if ($attempt -lt $totalAttempts) {
            $delayMinutes = $retryDelaysInMinutes[$attemptIndex]
            Write-Warning "vsce publish failed with exit code $exitCode on attempt $attempt of $totalAttempts. Last output: $lastOutputExcerpt. Retrying in $delayMinutes minute(s)."
            Start-Sleep -Seconds ($delayMinutes * $secondsPerMinute)
            continue
        }

        return @{
            Status = 'Failed'
            Detail = "vsce publish failed after $totalAttempts attempts. Last output: $lastOutputExcerpt"
        }
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

Write-Host "Verifying companion files for all packages..."
$packages = [System.Collections.Generic.List[object]]::new()
$missingCompanionFiles = @()
foreach ($vsix in $vsixFiles) {
    $vsixBaseName = [System.IO.Path]::GetFileNameWithoutExtension($vsix.Name)
    $manifestPath = Join-Path $vsix.DirectoryName "$vsixBaseName.manifest"
    $signaturePath = Join-Path $vsix.DirectoryName "$vsixBaseName.signature.p7s"

    if (-not (Test-Path -LiteralPath $manifestPath))  { $missingCompanionFiles += "manifest ($manifestPath)" }
    if (-not (Test-Path -LiteralPath $signaturePath)) { $missingCompanionFiles += "signature ($signaturePath)" }

    $packages.Add([pscustomobject]@{
        PackagePath   = $vsix.FullName
        PackageName   = $vsix.Name
        ManifestPath  = $manifestPath
        SignaturePath = $signaturePath
    })
}
if ($missingCompanionFiles.Count -gt 0) {
    throw "Verification check failed. Missing companion file(s):`n  $($missingCompanionFiles -join "`n  ")`nNo packages were published."
}
Write-Host "All companion files present." -ForegroundColor Green

if ($DryRun) {
    Write-Host "Dry run mode enabled. Verifying Marketplace credentials."
    $verifyArgs = @('verify-pat', '--azure-credential', $publisher)
    $verifyResult = Invoke-Vsce -Arguments $verifyArgs
    if ($verifyResult.ExitCode -ne 0) {
        throw "Marketplace credential verification failed with exit code $($verifyResult.ExitCode)."
    }
}

$results = New-Object System.Collections.Generic.List[object]

foreach ($package in $packages) {
    Write-Host ""
    Write-Host "=== Publishing $($package.PackageName) ===" -ForegroundColor Cyan

    try {
        $publishResult = Invoke-VscePublish -PackagePath $package.PackagePath -ManifestPath $package.ManifestPath -SignaturePath $package.SignaturePath
        if ($publishResult.Status -eq 'Published') {
            Write-Host "Published $($package.PackageName)" -ForegroundColor Green
            $results.Add([pscustomobject]@{ Package = $package.PackageName; Status = 'Published'; Detail = '' })
        }
        elseif ($publishResult.Status -eq 'AlreadyPublished') {
            Write-Host "$($package.PackageName) was already published" -ForegroundColor Yellow
            $results.Add([pscustomobject]@{ Package = $package.PackageName; Status = 'AlreadyPublished'; Detail = '' })
        }
        elseif ($publishResult.Status -eq 'DryRun') {
            $results.Add([pscustomobject]@{ Package = $package.PackageName; Status = 'DryRun'; Detail = '' })
        }
        else {
            $reason = $publishResult.Detail
            Write-Warning $reason
            $results.Add([pscustomobject]@{ Package = $package.PackageName; Status = 'Failed'; Detail = $reason })
        }
    }
    catch {
        Write-Warning "Error publishing $($package.PackageName): $($_.Exception.Message)"
        $results.Add([pscustomobject]@{ Package = $package.PackageName; Status = 'Failed'; Detail = $_.Exception.Message })
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

exit 0
