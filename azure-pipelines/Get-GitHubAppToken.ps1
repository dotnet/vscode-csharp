[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $KeyVaultName,

    [Parameter(Mandatory = $true)]
    [string] $KeyName,

    [Parameter(Mandatory = $true)]
    [string] $AppClientId,

    [Parameter(Mandatory = $true)]
    [string] $InstallationOwner,

    [Parameter(Mandatory = $true)]
    [string] $OutputVariableName
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

function ConvertTo-Base64Url([byte[]] $bytes) {
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$jwtHeader = [ordered]@{
    alg = 'RS256'
    typ = 'JWT'
}
$now = [System.DateTimeOffset]::UtcNow
$jwtPayload = [ordered]@{
    iat = $now.AddMinutes(-1).ToUnixTimeSeconds()
    exp = $now.AddMinutes(5).ToUnixTimeSeconds()
    iss = $AppClientId
}

$headerEncoded = ConvertTo-Base64Url ([System.Text.Encoding]::UTF8.GetBytes(($jwtHeader | ConvertTo-Json -Compress)))
$payloadEncoded = ConvertTo-Base64Url ([System.Text.Encoding]::UTF8.GetBytes(($jwtPayload | ConvertTo-Json -Compress)))
$signingInput = "$headerEncoded.$payloadEncoded"

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$digestBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($signingInput))
$digestBase64 = [Convert]::ToBase64String($digestBytes)

Write-Host "Signing GitHub App JWT with key '$KeyName' in vault '$KeyVaultName'..."
$signResponseJson = az keyvault key sign `
    --vault-name $KeyVaultName `
    --name $KeyName `
    --algorithm RS256 `
    --digest $digestBase64 `
    --output json
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($signResponseJson)) {
    throw "'az keyvault key sign' failed with exit code $LASTEXITCODE for key '$KeyName' in vault '$KeyVaultName'."
}

$signResponse = $signResponseJson | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($signResponse.signature)) {
    throw "Key Vault returned an empty signature for key '$KeyName' in vault '$KeyVaultName'."
}

$signatureEncoded = $signResponse.signature.TrimEnd('=').Replace('+', '-').Replace('/', '_')
$jwt = "$signingInput.$signatureEncoded"
$headers = @{
    Authorization          = "Bearer $jwt"
    'X-GitHub-Api-Version' = '2022-11-28'
    Accept                 = 'application/vnd.github+json'
    'User-Agent'           = 'vscode-csharp-onelocbuild'
}

Write-Host "Looking up the GitHub App installation for '$InstallationOwner'..."
$installations = Invoke-RestMethod -Uri 'https://api.github.com/app/installations' -Headers $headers -Method Get
$installation = $installations | Where-Object { $_.account.login -eq $InstallationOwner } | Select-Object -First 1
if (-not $installation) {
    throw "No GitHub App installation found for '$InstallationOwner'."
}

$tokenResponse = Invoke-RestMethod `
    -Uri "https://api.github.com/app/installations/$($installation.id)/access_tokens" `
    -Headers $headers `
    -Method Post `
    -ContentType 'application/json'
if ([string]::IsNullOrWhiteSpace($tokenResponse.token)) {
    throw "GitHub returned an empty installation token for '$InstallationOwner'."
}

Write-Host "Got an installation token for '$InstallationOwner' that expires at $($tokenResponse.expires_at)."
Write-Host "##vso[task.setvariable variable=$OutputVariableName;issecret=true]$($tokenResponse.token)"
