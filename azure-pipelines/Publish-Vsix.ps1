<#
.SYNOPSIS
    Publishes signed VSIX packages using the Publish-Vsix.cs file-based app.

.DESCRIPTION
    This compatibility wrapper remains in the build artifact while release pipelines
    transition to the .NET implementation. Older artifacts contain the original
    PowerShell implementation, so release.yml must continue invoking this script.
#>
[CmdletBinding(SupportsShouldProcess = $false)]
param(
    [string]$Path = $PSScriptRoot,
    [switch]$PreRelease,
    [switch]$DryRun,
    [switch]$CI
)

$ErrorActionPreference = 'Stop'

$dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetCommand) {
    throw 'The .NET 10 SDK was not found on PATH. Install it from https://aka.ms/dotnet/download, then try again.'
}

$appPath = Join-Path $PSScriptRoot 'Publish-Vsix.cs'
if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
    throw "The VSIX publisher app was not found at '$appPath'."
}

$appArguments = @('run', '--file', $appPath, '--', '--path', $Path)
if ($PreRelease) {
    $appArguments += '--pre-release'
}
if ($DryRun) {
    $appArguments += '--dry-run'
}
if ($CI) {
    $appArguments += '--ci'
}

Write-Host "##[command]& $($dotnetCommand.Source) $($appArguments -join ' ')"
& $dotnetCommand.Source @appArguments
exit $LASTEXITCODE
