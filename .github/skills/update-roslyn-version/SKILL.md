---
name: update-roslyn-version
description: Update the Roslyn language server version in vscode-csharp. Use when asked to update Roslyn, bump the Roslyn version, or upgrade the language server version.
---

# Update the Roslyn language server

Update `defaults.roslyn` in `package.json` and add the user-facing changes to `CHANGELOG.md`. Keep the full upstream PR list in the update PR description.

## Check prerequisites

Locate a local clone of `dotnet/roslyn`. Check `C:\Users\<username>\source\repos\roslyn` or a directory next to the current repository. If you cannot find the clone, ask the user for its location.

Check that `dnx` and the GitHub CLI are available:

```powershell
dnx --help
gh auth status
```

`dnx` requires the .NET 10 SDK or later. Authenticate the GitHub CLI before you run Roslyn Tools.

Run the update commands from the current `vscode-csharp` checkout unless a step directs you to the Roslyn clone. Use paths relative to that checkout, not paths to another checkout.

## Choose the new version

If the user provides a Roslyn version, use that version and continue to Step 1.

Otherwise, find the latest successful `dotnet-roslyn-official` build on `main` as described below.

### Find the latest successful build

Install the [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) if `azd` is missing. Stop until it is available. Do not substitute another tool.

Run the discovery commands in Bash with `curl` and `jq` available. Authenticate:

```shell
azd auth login
```

Get an Azure DevOps token without printing it:

```shell
set -euo pipefail
TOKEN=$(azd auth token --scope "499b84ac-1321-427f-aa17-267ca6975798/.default" --output json | jq -er '.token')
```

Find the latest successful build of pipeline definition `327`, `dotnet-roslyn-official`:

```shell
BUILD_ID=$(curl -fsS -H "Authorization: Bearer $TOKEN" \
	'https://dnceng.visualstudio.com/internal/_apis/build/builds?definitions=327&branchName=refs/heads/main&statusFilter=completed&resultFilter=succeeded&$top=1&api-version=7.0' \
	| jq -er '.value[0].id')
```

Find the `Publish Assets` task log:

```shell
LOG_URL=$(curl -fsS -H "Authorization: Bearer $TOKEN" \
	"https://dnceng.visualstudio.com/internal/_apis/build/builds/$BUILD_ID/timeline?api-version=7.0" \
	| jq -er '[.records[] | select(.name == "Publish Assets" and .type == "Task") | .log.url | select(. != null)][0]')
```

Read the log and extract the NuGet package version:

```shell
VERSION=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$LOG_URL" \
	| jq -Rse 'capture("Microsoft\\.CodeAnalysis\\.(?<version>[0-9]+\\.[0-9]+\\.[0-9]+-[A-Za-z0-9_.]+)\\.nupkg").version')
echo "Discovered version: $VERSION"
```

Use the discovered value wherever the steps below show `<new-version>`.

## Update the extension

Replace the placeholders in commands with the selected version, paths, and commit SHAs.

### Step 1: Prepare the branch

If the session already has a dedicated feature branch, use it. Otherwise, create an update branch:

```powershell
git switch -c update/roslyn-<version>
```

Replace `<version>` with the new version, using dashes instead of dots. Do not reset an existing branch.

### Step 2: Update package.json

Record the current `defaults.roslyn` value as `<old-version>` before editing `package.json`.

Set `defaults.roslyn` to `<new-version>`.

### Step 3: Download and publish the packages

Run:

```powershell
npm run updateRoslynVersion
```

The task downloads the platform-specific Roslyn NuGet packages, saves them to the consumption Azure DevOps artifacts feed, and runs `installDependencies`.

If package authentication fails, follow [Resolve package authentication errors](#resolve-package-authentication-errors).

### Step 4: Get the previous Roslyn commit

Restore the old package into the local cache:

```powershell
dotnet restore "msbuild\server" /p:PackageName=roslyn-language-server.osx-arm64 /p:PackageVersion=<old-version> --interactive
```

Read its repository metadata:

```powershell
Get-Content "out\.nuget\roslyn-language-server.osx-arm64\<old-version>\roslyn-language-server.osx-arm64.nuspec" | Select-String -Pattern "commit"
```

Use the `commit` attribute of the `<repository>` element as `<old-commit-sha>`.

### Step 5: Get the new Roslyn commit

Read the metadata for the package downloaded in Step 3:

```powershell
Get-Content "out\.nuget\roslyn-language-server.osx-arm64\<new-version>\roslyn-language-server.osx-arm64.nuspec" | Select-String -Pattern "commit"
```

Use the `commit` attribute of the `<repository>` element as `<new-commit-sha>`.

Use the local `.nuspec` files for both commits. Do not rely on the artifacts feed web pages, which require authentication and may fail to load.

### Step 6: List the upstream PRs

Switch to the local `dotnet/roslyn` clone and fetch the latest commits:

```powershell
Set-Location "<path-to-roslyn-repo>"
git fetch origin
```

Run `pr-finder` through `dnx`. Pass the GitHub token with `--github-token`:

```powershell
dnx Microsoft.RoslynTools --prerelease --source https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-tools/nuget/v3/index.json -- pr-finder --github-token "$(gh auth token)" --start <old-commit-sha> --end <new-commit-sha> --format "o#"
```

Do not use a globally installed `roslyn-tools` executable.

Save the raw output, including the compare link and full PR list. Use it unchanged in the PR description in Step 10.

Return to the current `vscode-csharp` checkout before continuing.

### Step 7: Filter the changelog entries

Include only user-facing changes to the VS Code editor or language server.

For each candidate from Step 6, read the PR description and production diff. Confirm that the affected component ships in the packages updated by `defaults.roslyn`. Also confirm that the changed behavior applies to the VS Code extension or its language server.

Check host-specific services and capability guards for restrictions to Visual Studio. Check package ownership to distinguish components shipped by this update from separately shipped analyzers, SDKs, and tools.

A relevant PR title, an LSP or Razor file path, or an editor-visible diagnostic does not establish that a change belongs in the changelog.

Remove entries that describe:

- Infrastructure or build changes, including pipelines, build scripts, and Azure DevOps configuration.
- Features or fixes restricted to Visual Studio.
- Test infrastructure or test fixes that do not change production behavior.
- Internal tools that the language server does not use.
- Changes to separately shipped analyzer packages, SDKs, or tools that this update does not deliver.
- Documentation changes that do not document user-facing features.
- Compiler changes to language implementation, parsing, lowering, emit, code generation, APIs, or performance without a direct editor or language server effect.
- Razor compiler changes to parsing, lowering, code generation, or architecture without a direct VS Code editing effect.
- Internal refactoring, dependency updates, or performance work without a clear user-visible effect in VS Code.

After confirming that the changes ship in this update and affect VS Code, keep entries that describe:

- Language Server Protocol changes.
- Code analysis or diagnostic improvements visible in the editor.
- Completion, navigation, or refactoring features.
- Performance improvements to editor or language server responsiveness.
- Bug fixes to language server behavior.
- Razor editing features such as formatting, completion, navigation, or code actions.
- API changes that alter user-visible behavior in the VS Code extension or language server.

If you cannot confirm both delivery and VS Code applicability, omit the entry from `CHANGELOG.md`. Preserve the complete unfiltered output from Step 6 for the PR description.

### Step 8: Update CHANGELOG.md

Add an entry under the current version section in `CHANGELOG.md`. Include only the entries kept in Step 7. Preserve their PR links and formatting:

```markdown
* Update Roslyn to <new-version> (PR: [#](https://github.com/dotnet/vscode-csharp/pull/))
  * <PR title> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
```

Leave the update PR number blank as `[#]` until Step 11.

### Step 9: Commit and push

Commit the version and changelog changes:

```powershell
git add package.json CHANGELOG.md
git commit -m "Update Roslyn to <new-version>"
git push -u origin HEAD
```

### Step 10: Create the pull request

Create a PR targeting `main` in `dotnet/vscode-csharp`.

Use `Update roslyn to <new-version>` as the title.

Use the raw, unfiltered `pr-finder` output from Step 6 as the body. Include the compare link and full PR list exactly as the tool produced them. Do not apply the Step 7 changelog filtering to the PR description.

### Step 11: Add the PR number to the changelog

Replace the update entry's blank PR number and URL with the new PR's number and URL:

```markdown
* Update Roslyn to <new-version> (PR: [#<number>](https://github.com/dotnet/vscode-csharp/pull/<number>))
```

Commit and push:

```powershell
git add CHANGELOG.md
git commit -m "Update changelog with PR number"
git push
```

## Resolve package authentication errors

Install the [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows).

Run the failed command again and complete the authentication prompt.

## Resolve an empty PR list

In the Roslyn clone, run `git fetch origin`. Confirm that both commit SHAs exist locally.

Run `gh auth status` to check GitHub authentication. Confirm that `gh auth token` succeeds without printing or sharing the token.

Run Roslyn Tools through `dnx` and pass the token with `--github-token`, as shown in Step 6.
