/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const yaml = require('js-yaml');

const pipelinePath = path.join(__dirname, '..', '..', 'azure-pipelines');
const load = (name) => yaml.load(fs.readFileSync(path.join(pipelinePath, name), 'utf8'));
const tagScript = load('create-release-tags.yml').steps[0].pwsh;
const tokenScript = load('get-github-app-token.yml').steps[0].inputs.inlineScript;
const releaseCommit = 'a'.repeat(40);
const roslynCommit = 'b'.repeat(40);

function runPowerShell(script, env = {}) {
    const result = spawnSync(
        'pwsh',
        ['-NoProfile', '-NonInteractive', '-Command', '& ([scriptblock]::Create([Console]::In.ReadToEnd()))'],
        {
            input: script,
            encoding: 'utf8',
            env: { ...process.env, ...env },
        }
    );
    assert.ifError(result.error);
    return result;
}

function runTags(env = {}) {
    return runPowerShell(
        `
$ErrorActionPreference = 'Stop'
$script:writes = @()
function Invoke-RestMethod($Uri, $Headers, $Method, $ContentType, $Body, $StatusCodeVariable) {
    if ($Uri -like 'https://dev.azure.com/*') {
        if ($env:CASE -eq 'source-error') { throw 'Mirror access denied' }
        if ($Uri -notlike '*versionDescriptor.version=${releaseCommit}&versionDescriptor.versionType=commit&includeContent=true*') {
            throw "Wrong source revision: $Uri"
        }
        if ($Headers.Authorization -ne 'Bearer test-ado') { throw 'Wrong mirror token' }
        if ($env:CASE -eq 'missing-content') { return @{} }
        if ($env:CASE -eq 'missing-version') { return @{ content = '{"defaults":{}}' } }
        return @{ content = '{"defaults":{"roslyn":"5.0.0-older-build"}}' }
    }
    if ($Uri -like 'https://pkgs.dev.azure.com/*') {
        return @{ resources = @(@{ '@type' = 'PackageBaseAddress/3.0.0'; '@id' = 'https://feed.test/flat2/' }) }
    }
    if ($Uri -notlike 'https://api.github.com/repos/dotnet/*/git/tags' -or $Method -ne 'Post') {
        throw "Unexpected REST request: $Method $Uri"
    }
    if ($Headers.Authorization -ne 'Bearer test-github') { throw 'Wrong GitHub token' }
    if ($env:CASE -eq 'tag-error') { throw 'Tag creation denied' }
    Set-Variable -Name $StatusCodeVariable -Value 201 -Scope 1
    $script:writes += @{ uri = $Uri; body = ($Body | ConvertFrom-Json) }
}
function Invoke-WebRequest($Uri, $Headers, $Method, $ContentType, $Body, [switch] $SkipHttpErrorCheck) {
    if ($Uri -eq 'https://feed.test/flat2/roslyn-language-server.linux-x64/5.0.0-older-build/roslyn-language-server.linux-x64.nuspec') {
        if ($env:CASE -eq 'nuspec-error') { throw 'Nuspec not found' }
        $commit = if ($env:CASE -eq 'missing-commit') { '' } else { '${roslynCommit}' }
        return @{ Content = ([char] 0xFEFF).ToString() + '<?xml version="1.0"?><package xmlns="http://schemas.microsoft.com/packaging/2012/06/nuspec.xsd"><metadata><repository type="git" url="https://github.com/dotnet/roslyn" commit="' + $commit + '" /></metadata></package>' }
    }
    if ($Uri -notlike 'https://api.github.com/repos/dotnet/*/git/refs' -or $Method -ne 'Post' -or -not $SkipHttpErrorCheck) {
        throw "Unexpected web request: $Method $Uri"
    }
    $script:writes += @{ uri = $Uri; body = ($Body | ConvertFrom-Json) }
    if ($env:CASE -eq 'existing-ref') { return @{ StatusCode = 422; Content = '{"message":"Reference already exists"}' } }
    if ($env:CASE -eq 'invalid-ref') { return @{ StatusCode = 422; Content = '{"message":"Validation Failed"}' } }
    if ($env:CASE -eq 'ref-error') { return @{ StatusCode = 403; Content = '{"message":"Forbidden"}' } }
    return @{ StatusCode = 201; Content = '{}' }
}
try {
    & {
${tagScript}
    }
    Write-Output ('RESULT:' + (ConvertTo-Json -InputObject @($script:writes) -Depth 10 -Compress))
} catch {
    Write-Output ('ERROR:' + $_.Exception.Message)
    Write-Output ('WRITES:' + $script:writes.Count)
    exit 1
}
`,
        {
            RELEASE_VERSION: '2.100.7',
            RELEASE_COMMIT: releaseCommit,
            PRERELEASE: 'false',
            DRY_RUN: 'false',
            SYSTEM_ACCESSTOKEN: 'test-ado',
            GITHUB_TOKEN: 'test-github',
            CASE: '',
            ...env,
        }
    );
}

test('release tagging uses only checkout-free templates and shares token acquisition with localization', () => {
    const release = load('release.yml');
    const jobs = release.extends.parameters.stages.find((stage) => stage.stage === 'TagRelease').jobs;
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].templateContext.type, 'releaseJob');
    assert.deepEqual(jobs[0].uses.repositories, ['self']);
    assert.deepEqual(jobs[0].steps[0], { checkout: 'none' });
    assert.equal(jobs[0].dependsOn, undefined);
    assert.equal(jobs[0].templateContext.inputs, undefined);
    const tokenStep = jobs[0].steps.find((step) => step.template?.includes('get-github-app-token.yml'));
    assert.equal(tokenStep.parameters.azureSubscription, 'dnceng-dotnet-vscode-csharp-release-githubapp');
    const tagStep = jobs[0].steps.find((step) => step.template?.includes('create-release-tags.yml'));
    assert.equal(tagStep.parameters.releaseCommit, '$(resources.pipeline.officialBuildCI.sourceCommit)');
    assert.equal(tagStep.parameters.releaseVersion, '$(resources.pipeline.officialBuildCI.runName)');
    assert.equal(tagStep.parameters.prerelease, '$(isPrerelease)');
    assert.equal(tagStep.parameters.dryRun, '${{ parameters.test }}');
    const locSteps = load('loc.yml').extends.parameters.stages[0].jobs[0].steps;
    assert.equal(
        locSteps.find((step) => step.template?.includes('get-github-app-token.yml')).parameters.azureSubscription,
        'dnceng-oneloc-githubapp'
    );
});

for (const prerelease of [false, true]) {
    test(`creates the existing ${prerelease ? 'prerelease' : 'stable'} tags from the selected build metadata`, () => {
        const result = runTags({ PRERELEASE: String(prerelease) });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const writes = JSON.parse(result.stdout.split('RESULT:')[1].trim());
        const suffix = prerelease ? '-prerelease' : '';
        assert.deepEqual(
            writes.map((write) => write.body),
            [
                {
                    tag: `VSCode-CSharp-2.100.7${suffix}`,
                    message: `2.100.7 VSCode C# extension ${suffix}`,
                    object: roslynCommit,
                    type: 'commit',
                },
                { ref: `refs/tags/VSCode-CSharp-2.100.7${suffix}`, sha: roslynCommit },
                { tag: `v2.100.7${suffix}`, message: '2.100.7', object: releaseCommit, type: 'commit' },
                { ref: `refs/tags/v2.100.7${suffix}`, sha: releaseCommit },
            ]
        );
        assert.match(writes[0].uri, /\/dotnet\/roslyn\/git\/tags$/);
        assert.match(writes[2].uri, /\/dotnet\/vscode-csharp\/git\/tags$/);
    });
}

test('dry run resolves metadata without any GitHub writes', () => {
    const result = runTags({ DRY_RUN: 'True', PRERELEASE: 'True' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /VSCode-CSharp-2.100.7-prerelease/);
    assert.match(result.stdout, /RESULT:\[\]/);
});

test('an existing reference warns and continues tagging the extension', () => {
    const result = runTags({ CASE: 'existing-ref' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /task.logissue type=warning/);
    assert.equal(JSON.parse(result.stdout.split('RESULT:')[1].trim()).length, 4);
});

for (const scenario of ['source-error', 'missing-content', 'missing-version', 'nuspec-error', 'missing-commit']) {
    test(`${scenario} fails before any tags are written`, () => {
        const result = runTags({ CASE: scenario });
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout, /ERROR:/);
        assert.match(result.stdout, /WRITES:0/);
    });
}

for (const scenario of ['tag-error', 'invalid-ref', 'ref-error']) {
    test(`${scenario} fails rather than treating the request as an existing reference`, () => {
        const result = runTags({ CASE: scenario });
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout, /ERROR:/);
        assert.doesNotMatch(result.stdout, /task.logissue type=warning/);
    });
}

test('the token template signs a JWT and exports the installation token as a secret', () => {
    const result = runPowerShell(
        `
$ErrorActionPreference = 'Stop'
$script:rsa = [System.Security.Cryptography.RSA]::Create(2048)
function az { $global:LASTEXITCODE = 0; return 'test-vault-token' }
function Invoke-RestMethod($Uri, $Headers, $Method, $ContentType) {
    if ($Uri -like 'https://EngKeyVault.vault.azure.net/secrets/*') {
        if ($Headers.Authorization -ne 'Bearer test-vault-token') { throw 'Wrong vault token' }
        if ($Uri -like '*/app-id?*') { return @{ value = '12345' } }
        return @{ value = $script:rsa.ExportRSAPrivateKeyPem() }
    }
    if ($Uri -eq 'https://api.github.com/app/installations') {
        $parts = $Headers.Authorization.Substring(7).Split('.')
        $signature = $parts[2].Replace('-', '+').Replace('_', '/')
        $signature = $signature.PadRight([int]([Math]::Ceiling($signature.Length / 4.0) * 4), '=')
        if (-not $script:rsa.VerifyData([Text.Encoding]::UTF8.GetBytes("$($parts[0]).$($parts[1])"), [Convert]::FromBase64String($signature), [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)) {
            throw 'Invalid JWT signature'
        }
        return @(@{ id = 1; account = @{ login = 'another-owner' } }, @{ id = 2; account = @{ login = 'dotnet' } })
    }
    if ($Uri -ne 'https://api.github.com/app/installations/2/access_tokens' -or $Method -ne 'Post') {
        throw "Unexpected request: $Method $Uri"
    }
    return @{ token = 'test-installation-token'; expires_at = '2026-11-11T00:00:00Z' }
}
try {
    & {
${tokenScript}
    }
} catch {
    Write-Output $_
    exit 1
} finally {
    $script:rsa.Dispose()
}
`,
        {
            KEY_VAULT_NAME: 'EngKeyVault',
            APP_ID_SECRET_NAME: 'app-id',
            APP_PRIVATE_KEY_SECRET_NAME: 'app-key',
            INSTALLATION_OWNER: 'dotnet',
            OUTPUT_VARIABLE_NAME: 'GitHubAppInstallationToken',
        }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /variable=GitHubAppInstallationToken;issecret=true]test-installation-token/);
});
