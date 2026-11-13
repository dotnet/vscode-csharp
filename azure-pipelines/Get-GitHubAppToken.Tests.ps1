BeforeAll {
    $script:helperPath = if ($env:GITHUB_APP_TOKEN_HELPER) {
        $env:GITHUB_APP_TOKEN_HELPER
    }
    else {
        $lines = Get-Content (Join-Path $PSScriptRoot 'get-github-app-token.yml')
        $start = [Array]::IndexOf($lines, '    inlineScript: |') + 1
        $end = [Array]::IndexOf($lines, '  env:')
        if ($start -eq 0 -or $end -le $start) {
            throw 'Cannot locate the inline GitHub App helper in the pipeline template.'
        }
        $inline = ($lines[$start..($end - 1)] | ForEach-Object {
            if ($_.Length) { $_.Substring(6) } else { '' }
        }) -join "`n"
        $bindings = @'
param($KeyVaultName, $KeyName, $AppIdSecretName, $InstallationOwner, $OutputVariableName)
$env:KEY_VAULT_NAME = $KeyVaultName
$env:KEY_NAME = $KeyName
$env:APP_ID_SECRET_NAME = $AppIdSecretName
$env:INSTALLATION_OWNER = $InstallationOwner
$env:OUTPUT_VARIABLE_NAME = $OutputVariableName
'@
        $path = Join-Path $TestDrive 'Inline-GitHubAppToken.ps1'
        Set-Content $path -Value ($bindings + "`n" + $inline) -Encoding utf8
        $path
    }

    function az {
        param([Parameter(ValueFromRemainingArguments = $true)][string[]] $Arguments)
        throw 'Azure CLI must be mocked.'
    }

    function Invoke-TokenHelper {
        try {
            $output = & $script:helperPath -KeyVaultName TestVault -KeyName test-app-key `
                -AppIdSecretName test-app-app-id -InstallationOwner dotnet -OutputVariableName TestToken *>&1
            [pscustomobject]@{ Success = ($LASTEXITCODE -eq 0); Output = ($output | Out-String) }
        }
        catch {
            [pscustomobject]@{ Success = $false; Output = $_.Exception.Message }
        }
    }

    function ConvertFrom-Base64Url([string] $value) {
        $value = $value.Replace('-', '+').Replace('_', '/')
        [Convert]::FromBase64String($value.PadRight($value.Length + (4 - $value.Length % 4) % 4, '='))
    }
}

Describe 'GitHub App Key Vault signing' {
    BeforeEach {
        $global:LASTEXITCODE = 0
        $global:GitHubAppSigningTestState = @{
            Rsa = [System.Security.Cryptography.RSA]::Create(2048)
            SignArguments = $null
            Jwt = $null
            AppId = 'projected-app-id'
        }
        Mock az {
            if (($Arguments[0..1] -join ' ') -eq 'account get-access-token') {
                $global:LASTEXITCODE = 0
                return 'mock-vault-access-token'
            }
            $global:GitHubAppSigningTestState.SignArguments = $Arguments
            if (($Arguments[0..2] -join ' ') -ne 'keyvault key sign') {
                throw "Forbidden Azure CLI command: $($Arguments -join ' '). Only App-ID access and digest-only signing are permitted."
            }
            $digestIndex = [Array]::IndexOf($Arguments, '--digest') + 1
            $digest = [Convert]::FromBase64String($Arguments[$digestIndex])
            $global:LASTEXITCODE = 0
            [Convert]::ToBase64String($global:GitHubAppSigningTestState.Rsa.SignHash($digest,
                [System.Security.Cryptography.HashAlgorithmName]::SHA256,
                [System.Security.Cryptography.RSASignaturePadding]::Pkcs1))
        }
        Mock Invoke-RestMethod {
            if ($Method -eq 'Get' -and $Uri -eq 'https://TestVault.vault.azure.net/secrets/test-app-app-id?api-version=7.4') {
                $Headers.Authorization | Should -Be 'Bearer mock-vault-access-token'
                return @{ value = $global:GitHubAppSigningTestState.AppId; attributes = @{ exp = 253402300799 } }
            }
            if ($Method -eq 'Get' -and $Uri -like 'https://api.github.com/app/installations*') {
                $global:GitHubAppSigningTestState.Jwt = $Headers.Authorization.Substring('Bearer '.Length)
                return @([pscustomobject]@{ id = 42; account = @{ login = 'dotnet' } })
            }
            if ($Uri -eq 'https://api.github.com/app/installations/42/access_tokens') {
                return @{ token = 'mock-installation-token'; expires_at = '2030-01-01T00:00:00Z' }
            }
            throw "Unexpected network request: $Uri"
        }
    }

    AfterEach {
        $global:GitHubAppSigningTestState.Rsa.Dispose()
        Remove-Variable GitHubAppSigningTestState -Scope Global
    }

    It 'reads the configured App ID <AppId>, signs remotely and masks the token' -TestCases @(
        @{ AppId = 'Iv23configured-client-id' }
        @{ AppId = '1234567' }
    ) {
        param($AppId)
        $global:GitHubAppSigningTestState.AppId = $AppId
        $result = Invoke-TokenHelper
        $result.Success | Should -BeTrue -Because $result.Output
        ($global:GitHubAppSigningTestState.SignArguments[0..2] -join ' ') | Should -Be 'keyvault key sign'
        $global:GitHubAppSigningTestState.SignArguments | Should -Contain 'RS256'
        $global:GitHubAppSigningTestState.SignArguments | Should -Contain 'test-app-key'
        $parts = $global:GitHubAppSigningTestState.Jwt.Split('.')
        $payload = [Text.Encoding]::UTF8.GetString((ConvertFrom-Base64Url $parts[1])) | ConvertFrom-Json
        $payload.iss | Should -Be $AppId
        ($payload.exp - $payload.iat) | Should -Be 360
        $global:GitHubAppSigningTestState.Rsa.VerifyData([Text.Encoding]::UTF8.GetBytes("$($parts[0]).$($parts[1])"),
            (ConvertFrom-Base64Url $parts[2]), [Security.Cryptography.HashAlgorithmName]::SHA256,
            [Security.Cryptography.RSASignaturePadding]::Pkcs1) | Should -BeTrue
        $result.Output | Should -Match 'variable=TestToken;issecret=true'
        $result.Output | Should -Not -Match 'mock-vault-access-token'
        Should -Invoke az -Times 2 -Exactly
        Should -Invoke Invoke-RestMethod -Times 1 -Exactly -ParameterFilter {
            $Method -eq 'Get' -and $Uri -eq 'https://TestVault.vault.azure.net/secrets/test-app-app-id?api-version=7.4'
        }
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Uri -like '*private-key*' }
    }

    It 'stops when App-ID token acquisition returns exit <Code> and token <Token>' -TestCases @(
        @{ Code = 1; Token = 'not-a-successful-token' }
        @{ Code = 0; Token = '' }
    ) {
        param($Code, $Token)
        $global:GitHubAppSigningTestState.TokenExitCode = $Code
        $global:GitHubAppSigningTestState.AccessToken = $Token
        Mock az {
            $global:LASTEXITCODE = $global:GitHubAppSigningTestState.TokenExitCode
            $global:GitHubAppSigningTestState.AccessToken
        } -ParameterFilter { ($Arguments[0..1] -join ' ') -eq 'account get-access-token' }
        (Invoke-TokenHelper).Success | Should -BeFalse
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly
        Should -Invoke az -Times 0 -Exactly -ParameterFilter { ($Arguments[0..2] -join ' ') -eq 'keyvault key sign' }
    }

    It 'surfaces an App-ID secret read failure without signing or contacting GitHub' {
        Mock Invoke-RestMethod { throw 'App-ID read denied' } -ParameterFilter { $Uri -like '*vault.azure.net*' }
        $result = Invoke-TokenHelper
        $result.Success | Should -BeFalse
        $result.Output | Should -Match 'App-ID read denied'
        Should -Invoke az -Times 0 -Exactly -ParameterFilter { ($Arguments[0..2] -join ' ') -eq 'keyvault key sign' }
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Uri -like 'https://api.github.com/*' }
    }

    It 'rejects an empty App-ID projection without signing' {
        Mock Invoke-RestMethod { @{ value = '' } } -ParameterFilter { $Uri -like '*vault.azure.net*' }
        (Invoke-TokenHelper).Success | Should -BeFalse
        Should -Invoke az -Times 0 -Exactly -ParameterFilter { ($Arguments[0..2] -join ' ') -eq 'keyvault key sign' }
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Uri -like 'https://api.github.com/*' }
    }

    It 'finds the requested installation after a full first page' {
        Mock Invoke-RestMethod {
            1..100 | ForEach-Object { [pscustomobject]@{ id = $_; account = @{ login = "other-$_" } } }
        } -ParameterFilter { $Uri -like '*per_page=100&page=1' }
        Mock Invoke-RestMethod {
            @([pscustomobject]@{ id = 42; account = @{ login = 'DOTNET' } })
        } -ParameterFilter { $Uri -like '*per_page=100&page=2' }
        $result = Invoke-TokenHelper
        $result.Success | Should -BeTrue -Because $result.Output
        Should -Invoke Invoke-RestMethod -Times 1 -Exactly -ParameterFilter { $Uri -like '*page=2' }
    }

    It 'stops before GitHub when signing fails' {
        Mock az { $global:LASTEXITCODE = 1; 'not-a-successful-signature' } -ParameterFilter { ($Arguments[0..2] -join ' ') -eq 'keyvault key sign' }
        (Invoke-TokenHelper).Success | Should -BeFalse
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Uri -like 'https://api.github.com/*' }
    }

    It 'rejects an empty signing response' {
        Mock az { $global:LASTEXITCODE = 0; '' } -ParameterFilter { ($Arguments[0..2] -join ' ') -eq 'keyvault key sign' }
        (Invoke-TokenHelper).Success | Should -BeFalse
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Uri -like 'https://api.github.com/*' }
    }

    It 'does not fall back when the signing operation throws' {
        Mock az { throw 'Signing denied' } -ParameterFilter { ($Arguments[0..2] -join ' ') -eq 'keyvault key sign' }
        (Invoke-TokenHelper).Success | Should -BeFalse
        Should -Invoke az -Times 2 -Exactly
        Should -Invoke Invoke-RestMethod -Times 1 -Exactly
        Should -Invoke az -Times 1 -Exactly -ParameterFilter { ($Arguments[0..2] -join ' ') -eq 'keyvault key sign' }
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Uri -like 'https://api.github.com/*' }
    }

    It 'does not mint a token when the owner is absent' {
        Mock Invoke-RestMethod { @() } -ParameterFilter { $Method -eq 'Get' -and $Uri -like 'https://api.github.com/*' }
        (Invoke-TokenHelper).Success | Should -BeFalse
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Method -eq 'Post' }
    }

    It 'does not pick an arbitrary duplicate installation' {
        Mock Invoke-RestMethod {
            @([pscustomobject]@{ id = 42; account = @{ login = 'dotnet' } },
              [pscustomobject]@{ id = 43; account = @{ login = 'dotnet' } })
        } -ParameterFilter { $Method -eq 'Get' -and $Uri -like 'https://api.github.com/*' }
        (Invoke-TokenHelper).Success | Should -BeFalse
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Method -eq 'Post' }
    }

    It 'does not publish an empty installation token' {
        Mock Invoke-RestMethod { @{ token = '' } } -ParameterFilter { $Method -eq 'Post' }
        $result = Invoke-TokenHelper
        $result.Success | Should -BeFalse
        $result.Output | Should -Not -Match 'task.setvariable'
    }

    It 'surfaces GitHub installation lookup errors without minting a token' {
        Mock Invoke-RestMethod { throw 'GitHub unavailable' } -ParameterFilter { $Method -eq 'Get' -and $Uri -like 'https://api.github.com/*' }
        $result = Invoke-TokenHelper
        $result.Success | Should -BeFalse
        $result.Output | Should -Match 'GitHub unavailable'
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly -ParameterFilter { $Method -eq 'Post' }
    }
}
