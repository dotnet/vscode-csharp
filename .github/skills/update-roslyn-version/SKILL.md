---
name: update-roslyn-version
description: Guide for updating the Roslyn language server version and paired Razor extension version in the vscode-csharp repository. Use this when asked to update Roslyn, bump the Roslyn version, or upgrade the language server version.
---

# Update Roslyn Version

This skill describes how to update the Roslyn language server version and paired Razor extension version in the vscode-csharp repository.

The Roslyn official build used by this workflow also produces the Razor extension package consumed by this repo, so this process updates **both** `defaults.roslyn` and `defaults.razor` in the same PR. The paired packages share the same commit range, so `pr-finder` only needs to run once; split that one result set into separate Roslyn and Razor changelog entries.

## Prerequisites

1. You must have a local clone of the `dotnet/roslyn` repository. Common locations for this include:
  - `C:\Users\<username>\source\repos\roslyn`
  - Next to the current repo directory, e.g. `<current-repo-root>/../roslyn`
  - If unable to find local roslyn repo, ask the user for its location.
2. The `roslyn-tools` CLI tool must be installed as a global .NET tool:
   ```powershell
   dotnet tool install -g Microsoft.RoslynTools --prerelease --add-source https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-eng/nuget/v3/index.json
   ```
   **Note**: After installation, the tool is invoked as `roslyn-tools` (not `dotnet roslyn-tools`)
3. You must have authenticated with GitHub for `roslyn-tools`:
   ```powershell
   roslyn-tools authenticate
   ```

## Input Required

- **New Roslyn Version** (optional): The new Roslyn version to update to (for example, `5.5.0-2.26080.10`). If not provided, the version will be auto-discovered from the latest passing `dotnet-roslyn-official` pipeline build on main. See [Version Auto-Discovery](#version-auto-discovery) below.
- **New Razor Version** (optional): The paired Razor version from the same Roslyn build. If not provided, it should be auto-discovered from that same build.

These versions should normally come from the same Roslyn build. If the user does not provide both versions, auto-discover both from the same build rather than mixing versions from different sources.

## Version Auto-Discovery

If the user does not provide both versions, follow these steps to discover the latest versions from the official Roslyn build pipeline.

### Prerequisites

1. The Azure Developer CLI (`azd`) must be installed. See https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd for platform-specific instructions.
    - If `azd` is missing, don't look for an alternative. Instead, stop and assist the user with installing it.
2. You must be authenticated:
   ```shell
   azd auth login
   ```

### Discovery Steps

1. **Get an Azure DevOps bearer token:**
   ```shell
   TOKEN=$(azd auth token --scope "499b84ac-1321-427f-aa17-267ca6975798/.default" --output json | jq -r '.token')
   ```

2. **Find the latest passing main build** (pipeline definition ID `327` = `dotnet-roslyn-official`):
   ```shell
   BUILD_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
     "https://dnceng.visualstudio.com/internal/_apis/build/builds?definitions=327&branchName=refs/heads/main&statusFilter=completed&resultFilter=succeeded&\$top=1&api-version=7.0" \
     | jq '.value[0].id')
   ```

3. **Find the "Publish Assets" task log URL from the build timeline:**
   ```shell
   LOG_URL=$(curl -s -H "Authorization: Bearer $TOKEN" \
     "https://dnceng.visualstudio.com/internal/_apis/build/builds/$BUILD_ID/timeline?api-version=7.0" \
     | jq -r '.records[] | select(.name == "Publish Assets" and .type == "Task") | .log.url')
   ```

4. **Fetch the log and extract the NuGet package versions:**
   ```shell
   ROSLYN_VERSION=$(curl -s -H "Authorization: Bearer $TOKEN" "$LOG_URL" \
     | grep -oP 'Microsoft\.CodeAnalysis\.\K\d+\.\d+\.\d+-[\w.]+(?=\.nupkg)' \
     | head -1)
   RAZOR_VERSION=$(curl -s -H "Authorization: Bearer $TOKEN" "$LOG_URL" \
     | grep -oP 'Microsoft\.VisualStudioCode\.RazorExtension\.\K\d+\.\d+\.\d+-[\w.]+(?=\.nupkg)' \
     | head -1)
   echo "Discovered Roslyn version: $ROSLYN_VERSION"
   echo "Discovered Razor version: $RAZOR_VERSION"
   ```

The extracted versions are the values to use as the new Roslyn and Razor versions for the rest of the process.

**Important**:
- The build number (for example, `20260426.5`) is **not** the package version.
- If `RAZOR_VERSION` is empty, the selected build predates the combined Roslyn/Razor build. Do not guess a Razor version; fall back to the separate Razor workflow instead.

## Process

### Step 1: Determine the New Versions

If the user provided both versions, use them. Otherwise, use the [Version Auto-Discovery](#version-auto-discovery) flow above to discover both from the same Roslyn build.

### Step 2: Sync to the Canonical Base Branch

Always anchor the update branch to the latest `main` from whichever remote points at `github.com/dotnet/vscode-csharp` before making any changes. Do **not** create the update branch from the current checkout, since the current branch may already be stale or may contain a previous failed attempt at the same update.

```powershell
# Find the canonical vscode-csharp remote (for example, origin or upstream)
$canonicalRemote = git remote -v |
    Select-String 'github\.com[:/]dotnet/vscode-csharp(\.git)?\s+\(fetch\)$' |
    ForEach-Object { ($_ -split '\s+')[0] } |
    Select-Object -First 1

if (-not $canonicalRemote) {
    git remote add upstream https://github.com/dotnet/vscode-csharp.git
    $canonicalRemote = 'upstream'
}

git fetch $canonicalRemote
git checkout -B update/roslyn-<roslyn-version> "$canonicalRemote/main"
```

Replace `<roslyn-version>` with the new Roslyn version, using dashes instead of dots for the branch name.

**Important**:
- Capture the old Roslyn version and old Razor version from the canonical remote's `main` `package.json` before editing `package.json`
- Update the changelog section that exists on the latest canonical remote `main`, not one from an older local branch
- If a remote branch with the same name already exists from a previous attempt, inspect it before force-pushing. Do not blindly overwrite unexpected remote commits

### Step 3: Update package.json

Update the `defaults.roslyn` and `defaults.razor` fields in `package.json`:

```json
"defaults": {
    "roslyn": "<new-roslyn-version>",
    "razor": "<new-razor-version>",
    ...
}
```

### Step 4: Run updateRoslynVersion and updateRazorVersion

This step acquires all of the updated Roslyn and Razor packages and ensures they are in the proper feeds:

```powershell
npm run updateRoslynVersion
npm run updateRazorVersion
```

This pair of tasks:
- Downloads all platform-specific Roslyn language server NuGet packages
- Downloads the Roslyn Dev Kit NuGet package
- Downloads the `Microsoft.VisualStudioCode.RazorExtension` NuGet package
- Runs `installDependencies` to update local dependencies

**Important**: Run both commands. `updateRoslynVersion` explicitly acquires the Roslyn packages, and `updateRazorVersion` explicitly acquires the Razor extension package before each command refreshes dependencies.

**Note**: You may need to install the [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) for interactive authentication.

### Step 5: Get the Previous Shared Commit SHA

The commit SHAs are stored in the `.nuspec` files inside the downloaded NuGet packages. Because the Roslyn and Razor packages come from the same combined build, they should point at the same old and new commits. Use the Roslyn package as the source of truth for the shared commit range.

**To get the old shared commit SHA:**

1. First, find the old Roslyn version from the canonical remote's `main` `package.json` (before your edit) - look at the `defaults.roslyn` value
2. Download the old version's package to the local cache:
   ```powershell
   dotnet restore "C:\Users\<username>\source\repos\vscode-csharp\msbuild\server" /p:PackageName=roslyn-language-server.win-x64 /p:PackageVersion=<old-roslyn-version> --interactive
   ```
3. Extract the commit SHA from the nuspec file:
   ```powershell
   Get-Content "C:\Users\<username>\source\repos\vscode-csharp\out\.nuget\roslyn-language-server.win-x64\<old-roslyn-version>\roslyn-language-server.win-x64.nuspec" | Select-String -Pattern "commit"
   ```
   This will show output like:
   ```
   <repository type="git" url="https://github.com/dotnet/roslyn" branch="main" commit="0e21a3cb684db6ab02646541a780b3278f53d19e" />
   ```

**Note**:
- Any platform-specific `roslyn-language-server` package should contain the same repository metadata; the examples use `win-x64`
- NuGet package names are lower case in the `.nuget` folder, so use `roslyn-language-server.win-x64` in the path
- If you want a sanity check, inspect the matching Razor package nuspec and confirm it points at the same commit, but you do not need a separate commit range for Razor

### Step 6: Get the New Shared Commit SHA

After running `npm run updateRoslynVersion`, the new version's package is already cached. Extract the commit SHA:

```powershell
Get-Content "C:\Users\<username>\source\repos\vscode-csharp\out\.nuget\roslyn-language-server.win-x64\<new-roslyn-version>\roslyn-language-server.win-x64.nuspec" | Select-String -Pattern "commit"
```

If desired, you can inspect the matching `Microsoft.VisualStudioCode.RazorExtension` nuspec as a sanity check and confirm it points at the same commit.

**Note**: The Azure DevOps artifacts feed web pages require authentication and may not load properly in automated scenarios. Always use the nuspec files from the local package cache.

### Step 7: Generate Changelog Data Using PR Finder

First, locate the local `dotnet/roslyn` repository. Common locations include:
- `C:\Users\<username>\source\repos\roslyn`
- `C:\repos\roslyn`
- Next to the vscode-csharp repo directory, e.g. `<current-repo-root>\..\roslyn`

Navigate to the Roslyn repository, fetch the latest, and run `pr-finder` once for the shared commit range.

```powershell
cd <path-to-roslyn-repo>
git fetch origin
roslyn-tools pr-finder --start <old-shared-commit> --end <new-shared-commit> --format "o#"
```

**Important**:
- The tool is invoked as `roslyn-tools` (a global tool), NOT `dotnet roslyn-tools`
- Save the full raw output from this one command before filtering so it can be used in the PR description later

This will output a list of PRs in the format needed for the changelog:

```text
  * <PR title> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
```

### Step 8: Update CHANGELOG.md

Add **two** entries to `CHANGELOG.md` under the current version section from the latest canonical remote `main` (for example, `# 2.141.x`): one Roslyn entry and one Razor entry. Start from the single `pr-finder` output and split it into the Roslyn and Razor sections.

```markdown
* Update Roslyn to <new-roslyn-version> (PR: [#](https://github.com/dotnet/vscode-csharp/pull/))
  * <Roslyn PR title 1> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
  * <Roslyn PR title 2> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
  ...
* Update Razor to <new-razor-version> (PR: [#](https://github.com/dotnet/vscode-csharp/pull/))
  * <Razor PR title 1> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
  * <Razor PR title 2> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
  ...
```

Note: Leave the PR number blank initially (just `[#]`) - it will be updated after the PR is created.

### Step 9: Filter and Split Changelog Entries

Review the single `pr-finder` output and split it into Roslyn and Razor changelog entries **independently**. Do not copy the raw output into both sections unchanged.

Remove entries that are:
- **Infrastructure/Build changes**: CI/CD pipelines, build scripts, Azure DevOps configurations
- **Visual Studio-only changes**: Features or fixes specific to Visual Studio IDE (not VS Code)
- **Test-only changes**: Test infrastructure, test fixes that do not affect production code
- **Internal tooling**: Changes to internal tools not used by the language servers or extension
- **Documentation-only**: README updates, internal docs (unless they document user-facing features)
- **Razor compiler-only changes**: Compiler changes that do not affect the shipped language server or Razor extension behavior in VS Code

Keep Roslyn entries that are:
- Language server protocol (LSP) changes
- Code analysis/diagnostics improvements
- Completion, navigation, refactoring features
- Performance improvements
- Bug fixes that affect language server behavior
- API changes that could affect VS Code extension

Keep Razor entries that are:
- Razor formatting, completion, navigation, or refactoring changes
- Razor diagnostics and code analysis improvements
- Cohost and Razor document synchronization changes
- Performance improvements
- Bug fixes that affect Razor language server or VS Code Razor behavior
- API changes that affect the Razor extension loaded by vscode-csharp

If a PR makes sense to appear in both entries, err on the side of including it in Razor only.

### Step 10: Commit and Push

```powershell
git add package.json CHANGELOG.md
git commit -m "Bump Roslyn to <new-roslyn-version> and Razor to <new-razor-version>"
git push -u origin update/roslyn-<roslyn-version>
```

If you are retrying an existing PR branch, prefer `git push --force-with-lease` after you have inspected the remote branch and confirmed it is safe to replace.

### Step 11: Create Pull Request

Create a pull request on GitHub:
- Title: `Bump Roslyn to <new-roslyn-version> and Razor to <new-razor-version>`
- Base: `main`

### Step 12: Update PR Description

After creating the PR, update its description with the **full raw output** from the one `roslyn-tools pr-finder` command (the unfiltered version, before splitting it into Roslyn and Razor changelog entries). This gives reviewers a complete view of the changes included in the version bump.

```powershell
$prBody = @"
## Combined Roslyn/Razor pr-finder output
<full raw pr-finder output>
"@
gh pr edit <pr-number> --repo dotnet/vscode-csharp --body $prBody
```

The body should include the `[View Complete Diff of Changes]` link and all PR entries exactly as output by `pr-finder`.

### Step 13: Update Changelog with PR Number

After the PR is created, note the PR number (for example, `#9240`), then:

1. Update the `CHANGELOG.md` entries to include the actual PR number:
   ```markdown
   * Update Roslyn to <new-roslyn-version> (PR: [#9240](https://github.com/dotnet/vscode-csharp/pull/9240))
   * Update Razor to <new-razor-version> (PR: [#9240](https://github.com/dotnet/vscode-csharp/pull/9240))
   ```
2. Commit and push the update:
   ```powershell
   git add CHANGELOG.md
   git commit -m "Update changelog with PR number"
   git push
   ```

## Example

For updating from `5.7.0-1.26220.12` and `10.0.0-preview.26217.1` to paired Roslyn and Razor versions from the same Roslyn build:

1. Discover the latest Roslyn and Razor versions from the official Roslyn build (or use both user-provided versions)
2. Branch: `update/roslyn-<new-roslyn-version-with-dashes>`
3. package.json changes: `"roslyn": "<new-roslyn-version>"` and `"razor": "<new-razor-version>"`
4. Run `npm run updateRoslynVersion`
5. Run `npm run updateRazorVersion`
6. Find the shared old and new commits from `roslyn-language-server.win-x64`
7. Run `pr-finder` once in the Roslyn repo
8. Split that single output into Roslyn and Razor changelog entries
9. Create a PR titled `Bump Roslyn to <new-roslyn-version> and Razor to <new-razor-version>`
10. Update the PR description with the raw `pr-finder` output
11. Update both changelog entries with the PR number

## Reference PRs

See [PR #8941](https://github.com/dotnet/vscode-csharp/pull/8941) for the Roslyn-only flow and [PR #8914](https://github.com/dotnet/vscode-csharp/pull/8914) for the Razor-only flow. The combined workflow in this skill merges those two patterns into one PR.

## Files Modified

- `package.json` - Update `defaults.roslyn` and `defaults.razor`
- `CHANGELOG.md` - Add separate changelog entries for Roslyn and Razor

## Troubleshooting

### Authentication Issues with updateRoslynVersion or updateRazorVersion

If you encounter authentication errors:
1. Install Azure Artifacts Credential Provider
2. Run the command again - it should prompt for interactive authentication

### pr-finder Returns Empty Results

Ensure:
1. You have fetched the latest from origin in the Roslyn repo: `git fetch origin`
2. Both shared commit SHAs exist in your local repo
3. You have authenticated with `roslyn-tools authenticate`
4. You are invoking the tool correctly as `roslyn-tools pr-finder` (not `dotnet roslyn-tools`)

### Finding Commit SHAs

The commit SHAs are embedded in the nuspec files inside the downloaded NuGet packages:

1. After running `npm run updateRoslynVersion` and `npm run updateRazorVersion`, packages are cached in `out\.nuget\`
2. To get the shared old commit, explicitly download the old `roslyn-language-server.win-x64` package first
3. Then read the corresponding `.nuspec` file and inspect the `commit` attribute
4. If you want a sanity check, inspect the matching `Microsoft.VisualStudioCode.RazorExtension` nuspec and confirm it points at the same commit

**Note**: The Azure DevOps artifacts feed web pages require authentication and often fail to load in automated scenarios. Always use the local nuspec files instead.
