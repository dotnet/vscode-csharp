[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $KeyVaultName,

    [Parameter(Mandatory = $false)]
    [string] $KeyName,

    [Parameter(Mandatory = $false)]
    [string] $AppClientId,

    [Parameter(Mandatory = $false)]
    [string] $AppIdSecretName,

    [Parameter(Mandatory = $false)]
    [string] $AppPrivateKeySecretName,

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

function Get-KeyVaultSecret(
    [string] $VaultName,
    [string] $SecretName,
    [string] $AccessToken
) {
    $escapedSecretName = [Uri]::EscapeDataString($SecretName)
    $secretUri = "https://$VaultName.vault.azure.net/secrets/$escapedSecretName`?api-version=7.4"
    $authorizationHeader = 'Bearer ' + $AccessToken
    $response = Invoke-RestMethod `
        -Uri $secretUri `
        -Headers @{ Authorization = $authorizationHeader } `
        -Method Get
    if ([string]::IsNullOrWhiteSpace($response.value)) {
        throw "Secret '$SecretName' in vault '$VaultName' is empty."
    }

    return [string] $response.value
}

function New-GitHubAppSignatureFromPrivateKey(
    [string] $SigningInput,
    [string] $PrivateKey,
    [string] $PrivateKeySecretName
) {
    Write-Host 'Signing GitHub App JWT with the private key secret...'
    $rsa = [System.Security.Cryptography.RSA]::Create()
    try {
        try {
            $rsa.ImportFromPem($PrivateKey)
        }
        catch {
            throw "Secret '$PrivateKeySecretName' must contain a PEM-encoded RSA private key: $_"
        }

        return ConvertTo-Base64Url $rsa.SignData(
            [System.Text.Encoding]::UTF8.GetBytes($SigningInput),
            [System.Security.Cryptography.HashAlgorithmName]::SHA256,
            [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    }
    finally {
        $rsa.Dispose()
    }
}

function New-GitHubAppSignatureFromKeyVaultKey(
    [string] $SigningInput,
    [string] $VaultName,
    [string] $VaultKeyName
) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $digestBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($SigningInput))
    }
    finally {
        $sha256.Dispose()
    }
    $digestBase64 = [Convert]::ToBase64String($digestBytes)

    Write-Host "Signing GitHub App JWT with key '$VaultKeyName' in vault '$VaultName'..."
    $signResponseJson = az keyvault key sign `
        --vault-name $VaultName `
        --name $VaultKeyName `
        --algorithm RS256 `
        --digest $digestBase64 `
        --output json
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($signResponseJson)) {
        throw "'az keyvault key sign' failed with exit code $LASTEXITCODE for key '$VaultKeyName' in vault '$VaultName'."
    }

    $signResponse = $signResponseJson | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($signResponse.signature)) {
        throw "Key Vault returned an empty signature for key '$VaultKeyName' in vault '$VaultName'."
    }

    return $signResponse.signature.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$usesKeyVaultKey = -not [string]::IsNullOrWhiteSpace($KeyName) -and -not [string]::IsNullOrWhiteSpace($AppClientId)
$usesPrivateKeySecret = -not [string]::IsNullOrWhiteSpace($AppIdSecretName) -and
    -not [string]::IsNullOrWhiteSpace($AppPrivateKeySecretName)

if ($usesKeyVaultKey -eq $usesPrivateKeySecret) {
    throw 'Specify either KeyName and AppClientId, or AppIdSecretName and AppPrivateKeySecretName.'
}

if ($usesPrivateKeySecret) {
    $previousNativeCommandErrorPreference = $PSNativeCommandUseErrorActionPreference
    try {
        # Azure CLI can emit non-fatal Python warnings to stderr.
        $PSNativeCommandUseErrorActionPreference = $false
        $keyVaultAccessToken = az account get-access-token `
            --resource https://vault.azure.net `
            --query accessToken `
            --output tsv `
            --only-show-errors
        $tokenExitCode = $LASTEXITCODE
    }
    finally {
        $PSNativeCommandUseErrorActionPreference = $previousNativeCommandErrorPreference
    }

    if ($tokenExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($keyVaultAccessToken)) {
        throw "'az account get-access-token' failed with exit code $tokenExitCode for vault '$KeyVaultName'."
    }

    Write-Host "Reading GitHub App credentials from vault '$KeyVaultName'..."
    $AppClientId = (Get-KeyVaultSecret $KeyVaultName $AppIdSecretName $keyVaultAccessToken).Trim()
    $privateKey = Get-KeyVaultSecret $KeyVaultName $AppPrivateKeySecretName $keyVaultAccessToken
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

$signatureEncoded = if ($usesPrivateKeySecret) {
    New-GitHubAppSignatureFromPrivateKey $signingInput $privateKey $AppPrivateKeySecretName
}
else {
    New-GitHubAppSignatureFromKeyVaultKey $signingInput $KeyVaultName $KeyName
}

$jwt = "$signingInput.$signatureEncoded"
$headers = @{
    Authorization          = "Bearer $jwt"
    'X-GitHub-Api-Version' = '2022-11-28'
    Accept                 = 'application/vnd.github+json'
    'User-Agent'           = 'vscode-csharp-publisher'
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
