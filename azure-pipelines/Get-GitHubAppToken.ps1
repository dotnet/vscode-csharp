[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $KeyVaultName,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string] $KeyName,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
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
