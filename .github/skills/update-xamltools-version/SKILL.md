---
name: update-xamltools-version
description: Guide for updating the xamlTools (Microsoft.VisualStudio.DesignToolsBase) component version in the vscode-csharp repository. Use this when asked to update xamlTools, bump the xamlTools version, or upgrade the XAML/DesignTools component.
---

# Update xamlTools Version

This skill describes how to update the `xamlTools` component version in the vscode-csharp repository.

Unlike Roslyn (which lives on GitHub at `dotnet/roslyn`), `xamlTools` lives entirely in Azure DevOps, in the VS source repository under the `src/Xaml` folder.

The general mechanism is the same as Roslyn: changes are merged into the VS repo, CI produces a NuGet package (`Microsoft.VisualStudio.DesignToolsBase`) that flows to the upstream feed, and updating vscode-csharp means bumping the version in `package.json`, refreshing the component, and adding a `CHANGELOG.md` entry via a PR.

Because there is no cross-repo tooling equivalent to `roslyn-tools pr-finder`, the update is generally **simpler** than the Roslyn update, but the changelog entries and (optionally) the feed lookup are done manually.

## Input Required

- **New xamlTools Version** (required): The `Microsoft.VisualStudio.DesignToolsBase` NuGet package version to update to (e.g., `18.9.11921.35`). Ask the user to provide it.
  - The user is responsible for ensuring that version has been **saved from upstream into the `msft_consumption` feed** (see [Ensure the Package Is Available in the Feed](#optional-ensure-the-package-is-available-in-the-feed)). If a version is not in the feed, restoring it will fail.
- **Changelog entries** (recommended): A short list of notable XAML/DesignTools changes between the previous and new version, with their AzDO PR numbers. These can be generated **fully automatically** from the VS repo via the Azure DevOps REST API — **no VS source enlistment is required** (see [Step 4](#step-4-gather-changelog-entries)). If you lack `az` access to that AzDO organization, ask the user to provide the list.

## Prerequisites

1. A local clone of `dotnet/vscode-csharp`.
2. The .NET SDK installed.
3. The [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) for interactive authentication when restoring packages from the feed.
4. For the automated changelog (Step 4): the [Azure CLI](https://learn.microsoft.com/cli/azure/) signed in (`az login`) with access to the Azure DevOps organization that hosts the VS source repo. The concrete org/project/repo coordinates are environment-specific — supply them from your own notes or parse them from a VS repo URL the user provides (see [Step 4](#step-4-gather-changelog-entries)); they are intentionally not hard-coded in this public skill. This is used to call the VS repo REST API — **no VS source enlistment is required**.

## (Optional) Ensure the Package Is Available in the Feed

This is normally the user's responsibility, but here is the full process to locate and save the package. vscode-csharp restores from the `msft_consumption` feed (see `NuGet.config`), which pulls versions from an upstream source. A new version must be present (and saved) in that feed before it can be restored.

1. After your changes merge into the VS repo, it may take **up to one day** for a NuGet package build to appear in the upstream feed.
   1. Find your merge commit's CloudBuild number in the AzDO CI.
   2. Open the package in Azure Artifacts: [Microsoft.VisualStudio.DesignToolsBase](https://dev.azure.com/azure-public/vside/_artifacts/feed/msft_consumption/NuGet/Microsoft.VisualStudio.DesignToolsBase). Switch to **"Upstream versions"** and search for your version.
   3. If it is there, click the three dots (`...`) on the right and select **"Save to feed"**.

**Note**: These Azure DevOps feed web pages require authentication and often fail to load in automated scenarios. If you cannot access them, ask the user to confirm the version has been saved to the feed and to provide the exact version string. Do not attempt to guess or fabricate a version.

## Process

### Step 1: Create a New Branch

Create a new git branch for the update:
```powershell
git checkout -B update/xamltools-<version>
```
Replace `<version>` with the new xamlTools version, using dashes instead of dots for the branch name (e.g., `update/xamltools-18-9-11921-35`).

### Step 2: Update package.json

Update the `defaults.xamlTools` field in `package.json`:

```json
"defaults": {
    ...
    "xamlTools": "<new-version>"
}
```

### Step 3: Acquire the Package

Refresh the local component and ensure the package is present in the consumption feed:

```powershell
npm run installDependencies
```

`xamlTools` (`Microsoft.VisualStudio.DesignToolsBase`) is a **non-platform-specific** package, so unlike Roslyn there is no dedicated `updateXamlToolsVersion` task and no per-platform acquisition. Running `installDependencies` downloads and installs xamlTools into `./.xamlTools/`; a successful restore validates that the requested version is available via the `msft_consumption` feed (if it isn’t, follow [Ensure the Package Is Available in the Feed](#optional-ensure-the-package-is-available-in-the-feed)).

**Note**: You may need the [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) for interactive authentication. If the restore fails with a "package not found" error, the version is likely not yet saved to the feed — see [Ensure the Package Is Available in the Feed](#optional-ensure-the-package-is-available-in-the-feed).

### Step 4: Gather Changelog Entries

Because xamlTools lives in Azure DevOps, there is no `pr-finder` equivalent. The change list can be generated **fully automatically from the VS repo via the Azure DevOps REST API — no VS source enlistment is required** (Option A). If you lack `az` access to that AzDO organization, fall back to a user-provided list (Option B). Each entry references its AzDO PR number rather than a GitHub PR link.

#### Option A (preferred): Generate from the VS repo automatically

The flow is: (1) resolve the exact VS-repo commit that produced each package version, (2) list the `/src/Xaml` commits between them, (3) map those commits to their PRs, (4) trim to user/developer-facing changes.

All REST calls target the VS source repo and need an Azure DevOps bearer token.

**Resolve the VS repo coordinates first.** The org/project/repo are intentionally not hard-coded in this public skill, so obtain them, in order of preference:
1. From your own private notes/environment if you have them (this is the expected path for maintainers), otherwise
2. Ask the user for the VS repo web URL and parse `<org>`/`<project>`/`<repo>` from it. Both AzDO URL shapes work:
   - `https://<org>.visualstudio.com/<project>/_git/<repo>`
   - `https://dev.azure.com/<org>/<project>/_git/<repo>`

Then set the coordinates (the REST API uses the `https://dev.azure.com/<org>` host form):
```powershell
# AzDO coordinates for the VS source repo. Fill these in from your notes or the URL the user provides.
$org  = '<azdo-org-url>'                                    # e.g. https://dev.azure.com/<org>
$repo = "$org/<project>/_apis/git/repositories/<vs-repo>"   # the repo that hosts src/Xaml
# 499b84ac-... is the well-known Azure DevOps application ID; `az login` must have access to that org.
$tok  = az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv
$hdr  = @{ Authorization = "Bearer $tok" }
```

##### 4.1 Resolve each version's VS-repo commit from the DLL (not from a build)

The `Microsoft.VisualStudio.DesignToolsBase` **package/nuspec does not embed a commit SHA**, but its **assemblies do**. `Microsoft.VisualStudio.DesignTools.Markup.dll` (stamped by Nerdbank.GitVersioning) carries the commit two ways:
- `ProductVersion` = `18.x.NNN+<short-10-char-sha>` — the short SHA.
- internal const `ThisAssembly.GitCommitId` — the **full 40-char SHA**, which is what the REST API requires (short SHAs are rejected with HTTP 400).

The **new** version's DLL is already in `./.xamlTools/` after Step 3. For the **old** version (the value in `package.json` *before* your Step 2 edit), restore it into a throwaway project first:
```powershell
$old   = '<old-version>'
$probe = Join-Path $env:TEMP 'xamlProbe'
New-Item -ItemType Directory -Force $probe | Out-Null
Copy-Item ./NuGet.config $probe -Force
@"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework><RestorePackagesPath>packages</RestorePackagesPath></PropertyGroup>
  <ItemGroup><PackageReference Include="Microsoft.VisualStudio.DesignToolsBase" Version="$old" /></ItemGroup>
</Project>
"@ | Set-Content (Join-Path $probe 'probe.csproj')
dotnet restore $probe --interactive | Out-Null
```
Read the full SHA from either DLL using an **isolated load context** (both DLLs share the same assembly identity, so a plain `Assembly.LoadFrom` of the second would just return the first):
```powershell
function Get-XamlCommit($dll) {
    $alc = [System.Runtime.Loader.AssemblyLoadContext]::new([string][guid]::NewGuid(), $true)
    try {
        $asm = $alc.LoadFromStream([System.IO.MemoryStream]::new([System.IO.File]::ReadAllBytes($dll)))
        $f = $asm.GetType('ThisAssembly').GetField('GitCommitId', [System.Reflection.BindingFlags]'NonPublic,Static,Public')
        [string]$f.GetRawConstantValue()
    } finally { $alc.Unload() }
}
$newCommit = Get-XamlCommit './.xamlTools/Microsoft.VisualStudio.DesignTools.Markup.dll'
$oldCommit = Get-XamlCommit (Get-ChildItem $probe -Recurse -Filter 'Microsoft.VisualStudio.DesignTools.Markup.dll' | Select-Object -First 1).FullName
```

##### 4.2 List the `/src/Xaml` commits between the two versions

Do **not** use the obvious "commits between two commits" query (`searchCriteria.compareVersion` + `itemVersion`): the two build source commits frequently live on **divergent branches**, so that query returns 0. Instead, walk `/src/Xaml` history back from the new commit and stop at the old build's most-recent `/src/Xaml` commit (the "boundary", already shipped in the previous version):
```powershell
function Get-XamlCommits($version, $top) {
    $q = @{ 'searchCriteria.itemPath'='/src/Xaml'; 'searchCriteria.itemVersion.version'=$version;
            'searchCriteria.itemVersion.versionType'='commit'; 'searchCriteria.$top'="$top"; 'api-version'='7.1' }
    (Invoke-RestMethod -Uri "$repo/commits" -Headers $hdr -Body $q -Method Get).value
}
$boundary = (Get-XamlCommits $oldCommit 1)[0].commitId
$range = New-Object System.Collections.Generic.List[object]
foreach ($c in (Get-XamlCommits $newCommit 1000)) { if ($c.commitId -eq $boundary) { break }; $range.Add($c) }
"in-range /src/Xaml commits: $($range.Count)"
```
Use the *list* API as above; the single-commit `GET /commits/{sha}` endpoint is flaky in scripts and best avoided.

##### 4.3 Map the in-range commits to PRs — cover **both** completion styles

Parsing `Merged PR <id>: <title>` out of commit messages only finds **squash-completed** PRs. **Merge-completed** PRs instead contribute their individual dev commits (whose messages are *not* `Merged PR ...`), and their merge commit doesn't change the path so it never shows up in the filtered list. Missing these is the single most common cause of an incomplete changelog — so combine both detections:
```powershell
# (a) squash-completed PRs — from "Merged PR <id>: <title>" commit messages
$squash = foreach ($c in $range) {
    $m = [regex]::Match($c.comment.Split([char]10)[0], '^Merged PR (\d+): (.*)$')
    if ($m.Success) { [pscustomobject]@{ Id = $m.Groups[1].Value; Title = $m.Groups[2].Value.Trim() } }
}
# (b) merge-completed PRs — map the in-range commit ids to their PRs
$body = @{ queries = @(@{ type = 'commit'; items = @($range.commitId) }) } | ConvertTo-Json -Depth 4
$res  = Invoke-RestMethod -Uri "$repo/pullRequestQuery?api-version=7.1" -Headers $hdr -Method Post -Body $body -ContentType 'application/json'
$merged = foreach ($p in $res.results[0].PSObject.Properties) { foreach ($pr in $p.Value) { [pscustomobject]@{ Id = "$($pr.pullRequestId)"; Title = $pr.title } } }
# union both, de-duplicated
@($squash + $merged) | Sort-Object Id -Unique | ForEach-Object { "  * $($_.Title) (PR: AzDO#$($_.Id))" }
```

##### 4.4 Trim to user/developer-facing changes

Keep features, fixes, telemetry, and Hot Reload behavior. **Drop** infrastructure noise — the `pullRequestQuery` step in particular sweeps in integration PRs that merely carried the commits along:
- branch-sync / integration PRs: `Merge main into ...`, `Sync vscode -> ...`, `Merge for <build>`;
- component insertions: `... Roslyn ... Insertion into main`;
- build/test/pipeline/localization churn and pure refactors.

#### Option B (fallback): User-provided list

If you cannot reach the VS repo (no `az` access to that AzDO organization) or cannot resolve the commits, ask the user for the list of notable XAML/DesignTools changes with their AzDO PR numbers.

#### (Alternative) Local VS enlistment

With a VS enlistment, `git log` is a convenient cross-check — but it does **not** replace step 4.3, because `--first-parent ... -- src/Xaml` only surfaces merge-commit PRs. Prefer the REST flow above as the source of truth.
```powershell
git log --first-parent "<old-commit>..<new-commit>" --pretty=format:"%s" -- src/Xaml |
    Select-String -Pattern '^Merged PR (\d+): (.*)$' |
    ForEach-Object { "  * $($_.Matches.Groups[2].Value) (PR: AzDO#$($_.Matches.Groups[1].Value))" }
```

#### (Optional) Confirm a specific PR shipped in a version

To check whether a given AzDO PR is part of a version, compare its **individual commits** against the `/src/Xaml` range (its *merge* commit will not appear in the range):
```powershell
$id        = <pr-id>
$pr        = Invoke-RestMethod -Uri "$repo/pullRequests/$id?api-version=7.1" -Headers $hdr          # status / targetRefName / closedDate
$last      = (Invoke-RestMethod -Uri "$repo/pullRequests/$id/iterations?api-version=7.1" -Headers $hdr).value[-1].id
$paths     = (Invoke-RestMethod -Uri "$repo/pullRequests/$id/iterations/$last/changes?api-version=7.1" -Headers $hdr).changeEntries.item.path
$prCommits = (Invoke-RestMethod -Uri "$repo/pullRequests/$id/commits?api-version=7.1" -Headers $hdr).value.commitId
$inRange   = $prCommits | Where-Object { $range.commitId -contains $_ }
"under /src/Xaml: $(@($paths | Where-Object { $_ -like '/src/Xaml*' }).Count)/$($paths.Count); in-range commits: $($inRange.Count)/$($prCommits.Count)"
```
It is **included** when at least one of its commits is in `$range` **and** it changed files under `/src/Xaml` (a PR that touches no `/src/Xaml` files is not part of the package build).

### Step 5: Update CHANGELOG.md

Add an entry to `CHANGELOG.md` under the current in-development version section (the top-most `# 2.x.x` header). Use the AzDO reference format for the child entries:

```markdown
* Update xamlTools to <new-version> (PR: [#](https://github.com/dotnet/vscode-csharp/pull/))
  * <change description> (PR: AzDO#<number>)
  * <change description> (PR: AzDO#<number>, AzDO#<number>)
```

Notes:
- Leave the vscode-csharp PR number blank initially (just `[#]`) — it is filled in after the PR is created (Step 8).
- Child entries use `AzDO#<number>` (the VS source repo PR/work item number), **not** a GitHub link, because those changes live in Azure DevOps. Multiple references are comma-separated, e.g. `(PR: AzDO#728266, AzDO#730837)`.

### Step 6: Commit and Push

```powershell
git add package.json CHANGELOG.md
git commit -m "Update xamlTools to <new-version>"
git push -u origin update/xamltools-<version>
```

### Step 7: Create Pull Request

Create a pull request on GitHub:
- Title: `Update xamlTools to <new-version>`
- Base: `main`
- Description: Summarize the bump (from `<old-version>` to `<new-version>`) and note that the `CHANGELOG.md` entry documents the notable XAML/DesignTools changes.

### Step 8: Update Changelog with PR Number

xamlTools update PRs have an "interesting" changelog flow: the vscode-csharp PR number isn't known until the PR exists, so it is backfilled after creation.

After the PR is created, note the PR number (e.g., `#9461`), then:

1. Update the `CHANGELOG.md` entry to include the actual PR number:
   ```markdown
   * Update xamlTools to <new-version> (PR: [#9461](https://github.com/dotnet/vscode-csharp/pull/9461))
   ```
   You can also try to guess the number ahead of time by inspecting the latest open/closed PRs and issues on GitHub, but backfilling after creation is the reliable approach.

2. Commit and push the update — either a follow-up commit, or amend and force-push:
   ```powershell
   git add CHANGELOG.md
   git commit -m "Update changelog with PR number"
   git push
   ```

## Example

For updating from `18.9.11909.33` to `18.9.11921.35` (see [PR #9461](https://github.com/dotnet/vscode-csharp/pull/9461)):

1. Branch: `update/xamltools-18-9-11921-35`
2. `package.json` change: `"xamlTools": "18.9.11921.35"`
3. Run `npm run installDependencies`
4. Add a `CHANGELOG.md` entry under the current version section:
   ```markdown
   * Update xamlTools to 18.9.11921.35 (PR: [#9461](https://github.com/dotnet/vscode-csharp/pull/9461))
     * MAUI Hot Reload exceptions reporting (PR: AzDO#749102)
     * C# XAML Expressions (XEXPR) support improvements and fixes (PR: AzDO#748362)
   ```
5. Create PR titled "Update xamlTools to 18.9.11921.35"
6. Backfill the PR number in the changelog

## Reference PR

See [PR #9461](https://github.com/dotnet/vscode-csharp/pull/9461) as an example of a xamlTools version update.

## Files Modified

- `package.json` - Update `defaults.xamlTools` version
- `CHANGELOG.md` - Add changelog entry with the xamlTools AzDO change list

## Troubleshooting

### Restore Fails With "Package Not Found"

The requested version is likely not yet available/saved in the `msft_consumption` feed. Either:
1. Wait (it can take up to a day after the VS repo merge for the upstream package to build), or
2. Save it from upstream to the feed (see [Ensure the Package Is Available in the Feed](#optional-ensure-the-package-is-available-in-the-feed)), then re-run `npm run installDependencies`.

### Authentication Issues with installDependencies

If you encounter authentication errors:
1. Install the [Azure Artifacts Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows).
2. Run `npm run installDependencies` again — it should prompt for interactive authentication.

### Can't Access the Azure Artifacts Feed Pages

The Azure DevOps feed web pages require authentication and may not load in automated scenarios. Ask the user to confirm the version has been saved to the feed and to provide the exact `Microsoft.VisualStudio.DesignToolsBase` version string. Do not guess a version.

### Commit REST Query Returns HTTP 400 or an Empty Range (Step 4)

- **HTTP 400 "object ID must be 40 characters"**: you passed a short SHA. The REST API needs the **full 40-char** commit id — take it from `ThisAssembly.GitCommitId` (Step 4.1), not from `ProductVersion` (which only has the short SHA).
- **`compareVersion`/`itemVersion` range returns 0**: the two build source commits are on **divergent branches**. Don't use the compare query; use the boundary-walk in Step 4.2 instead.

### Changelog Is Missing PRs (Step 4)

Almost always because only squash-completed PRs were detected. Re-run Step 4.3 and make sure you also run the `pullRequestQuery` (`type: commit`) mapping, which catches **merge-completed** PRs whose commits carry ordinary dev messages instead of `Merged PR ...`.
