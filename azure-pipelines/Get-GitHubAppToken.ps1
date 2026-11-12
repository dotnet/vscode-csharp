[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $KeyVaultName,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string] $KeyName,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string] $AppIdSecretName,

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

function Get-GitHubAppIdFromKeyVault([string] $VaultName, [string] $SecretName) {
    if ($VaultName -notmatch '^[A-Za-z][A-Za-z0-9-]{1,22}[A-Za-z0-9]$' -or $VaultName.Contains('--')) {
        throw "KeyVaultName '$VaultName' is not a valid Azure Key Vault name."
    }
    $previousNativeCommandErrorPreference = $PSNativeCommandUseErrorActionPreference
    try {
        $PSNativeCommandUseErrorActionPreference = $false
        $accessToken = az account get-access-token `
            --resource https://vault.azure.net `
            --query accessToken `
            --output tsv `
            --only-show-errors
        $tokenExitCode = $LASTEXITCODE
    }
    finally {
        $PSNativeCommandUseErrorActionPreference = $previousNativeCommandErrorPreference
    }
    if ($tokenExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($accessToken)) {
        throw "'az account get-access-token' failed with exit code $tokenExitCode while acquiring an Azure Key Vault access token."
    }
    $escapedSecretName = [Uri]::EscapeDataString($SecretName)
    try {
        # Read only the ID value: CLI secret deserialization fails on year-9999 expiry metadata.
        $response = Invoke-RestMethod `
            -Uri "https://$VaultName.vault.azure.net/secrets/${escapedSecretName}?api-version=7.4" `
            -Headers @{ Authorization = "Bearer $accessToken" } `
            -Method Get
    }
    catch {
        throw "Failed to read App ID secret '$SecretName' from vault '$VaultName': $_. Verify the service connection can read this App-ID projection."
    }
    if ([string]::IsNullOrWhiteSpace($response.value)) {
        throw "App ID secret '$SecretName' in vault '$VaultName' is empty."
    }
    return [string] $response.value
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
    $previousNativeCommandErrorPreference = $PSNativeCommandUseErrorActionPreference
    try {
        # Only the digest leaves the agent; Key Vault retains the private key.
        $PSNativeCommandUseErrorActionPreference = $false
        $signature = az keyvault key sign `
            --vault-name $VaultName `
            --name $VaultKeyName `
            --algorithm RS256 `
            --digest $digestBase64 `
            --query signature `
            --output tsv `
            --only-show-errors
        $signExitCode = $LASTEXITCODE
    }
    finally {
        $PSNativeCommandUseErrorActionPreference = $previousNativeCommandErrorPreference
    }
    if ($signExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($signature)) {
        throw "'az keyvault key sign' failed with exit code $signExitCode for key '$VaultKeyName' in vault '$VaultName'. Verify the service connection has the Sign action on the key."
    }
    return $signature.Trim().TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$appId = Get-GitHubAppIdFromKeyVault $KeyVaultName $AppIdSecretName
$jwtHeader = [ordered]@{
    alg = 'RS256'
    typ = 'JWT'
}
$now = [System.DateTimeOffset]::UtcNow
$jwtPayload = [ordered]@{
    iat = $now.AddMinutes(-1).ToUnixTimeSeconds()
    exp = $now.AddMinutes(5).ToUnixTimeSeconds()
    iss = $appId
}

$headerEncoded = ConvertTo-Base64Url ([System.Text.Encoding]::UTF8.GetBytes(($jwtHeader | ConvertTo-Json -Compress)))
$payloadEncoded = ConvertTo-Base64Url ([System.Text.Encoding]::UTF8.GetBytes(($jwtPayload | ConvertTo-Json -Compress)))
$signingInput = "$headerEncoded.$payloadEncoded"

$signatureEncoded = New-GitHubAppSignatureFromKeyVaultKey $signingInput $KeyVaultName $KeyName

$jwt = "$signingInput.$signatureEncoded"
$headers = @{
    Authorization          = "Bearer $jwt"
    'X-GitHub-Api-Version' = '2022-11-28'
    Accept                 = 'application/vnd.github+json'
    'User-Agent'           = 'vscode-csharp-publisher'
}

Write-Host "Looking up the GitHub App installation for '$InstallationOwner'..."
$installations = [System.Collections.Generic.List[object]]::new()
$page = 1
do {
    $pageResponse = @(Invoke-RestMethod -Uri "https://api.github.com/app/installations?per_page=100&page=$page" -Headers $headers -Method Get)
    foreach ($installation in $pageResponse) {
        $installations.Add($installation)
    }
    $page++
} while ($pageResponse.Count -eq 100)
$matchingInstallations = @($installations | Where-Object { $_.account.login -ieq $InstallationOwner })
if ($matchingInstallations.Count -ne 1) {
    throw "Expected one GitHub App installation for '$InstallationOwner'; found $($matchingInstallations.Count)."
}
$installation = $matchingInstallations[0]

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
