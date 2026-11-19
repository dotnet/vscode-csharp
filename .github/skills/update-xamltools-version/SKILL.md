---
name: update-xamltools-version
description: Guide for updating the xamlTools (Microsoft.VisualStudio.DesignToolsBase) component version in the vscode-csharp repository. Use this when asked to update xamlTools, bump the xamlTools version, or upgrade the XAML/DesignTools component.
---

# Update xamlTools Version

This skill describes how to update the `xamlTools` component version in the vscode-csharp repository.

Unlike Roslyn (which lives on GitHub at `dotnet/roslyn`), `xamlTools` lives entirely in Azure DevOps, in the VS source repository under the `src/Xaml` folder.

The general mechanism is the same as Roslyn: changes are merged into the VS repo, CI produces a NuGet package (`Microsoft.VisualStudio.DesignToolsBase`) that flows to the upstream feed, and updating vscode-csharp means bumping the version in `package.json`, refreshing the component, and adding a `CHANGELOG.md` entry via a PR.

Because there is no cross-repo tooling equivalent to `roslyn-tools pr-finder`, the update is generally **simpler** than the Roslyn update, but the changelog still requires a manual review/trim step (even if the raw PR list is generated via the REST API).

## Input Required

- **New xamlTools Version** (required): The `Microsoft.VisualStudio.DesignToolsBase` NuGet package version to update to (e.g., `18.9.11921.35`). Ask the user to provide it.
  - The user is responsible for ensuring that version has been **saved from upstream into the `msft_consumption` feed** (see [Ensure the Package Is Available in the Feed](#optional-ensure-the-package-is-available-in-the-feed)). If a version is not in the feed, restoring it will fail.
- **Changelog entries** (recommended): A short list of notable XAML/DesignTools changes between the previous and new version, with their AzDO PR numbers. Candidate PRs can be gathered from the VS repo via the Azure DevOps REST API without a VS source enlistment, but their inclusion in the shipped assemblies requires verification (see [Step 4](#step-4-gather-changelog-entries)). If you lack `az` access to that AzDO organization, ask the user to provide the list.

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

Because xamlTools lives in Azure DevOps, there is no `pr-finder` equivalent. Candidate changes can be gathered from the VS repo via the Azure DevOps REST API without a VS source enlistment, then verified and curated manually (Option A). If you lack `az` access to that AzDO organization, fall back to a user-provided list (Option B). Each entry references its AzDO PR number rather than a GitHub PR link.

#### Option A (preferred): Generate from the VS repo automatically

The flow is: (1) inventory the shipped assemblies and resolve each assembly's VS-repo commit in both package versions, (2) compare the histories for each distinct old/new assembly-commit pair, (3) map candidate commits to PRs, and (4) verify that each relevant change actually ships in the updated assembly before writing the changelog.

**A package can contain assemblies built from different commits.** Never use the markup assembly's commit as a proxy for the entire package. In particular, inspect the CodeAnalysis.Diagnostics, DiagnosticsBase, DiagnosticsMobile, and nested Hot Reload runtime assemblies independently so MAUI Hot Reload changes are not missed. A single PR list from one assembly or a single package-wide boundary is not sufficient.

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

##### 4.1 Inventory assembly provenance in both packages

The `Microsoft.VisualStudio.DesignToolsBase` **package/nuspec does not embed a single authoritative commit SHA**. Its DesignTools assemblies carry their own build commit: `ProductVersion` contains a short SHA, and the internal `ThisAssembly.GitCommitId` contains the **full 40-char SHA** required by the REST API. Assemblies in the same package may have different SHAs.

The **new** package content is in `./.xamlTools/` after Step 3. Restore the **old** version (the value in `package.json` *before* Step 2) into an isolated throwaway project:
```powershell
$old   = '<old-version>'
$probe = Join-Path $env:TEMP ("xamlProbe-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force $probe | Out-Null
Copy-Item ./NuGet.config $probe -Force
@"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework><RestorePackagesPath>packages</RestorePackagesPath></PropertyGroup>
  <ItemGroup><PackageReference Include="Microsoft.VisualStudio.DesignToolsBase" Version="$old" /></ItemGroup>
</Project>
"@ | Set-Content (Join-Path $probe 'probe.csproj')
dotnet restore (Join-Path $probe 'probe.csproj') --interactive
if ($LASTEXITCODE -ne 0) { throw 'Failed to restore the previous xamlTools package.' }
$oldRoot = Join-Path $probe "packages/microsoft.visualstudio.designtoolsbase/$old/content"
$newRoot = (Resolve-Path './.xamlTools').Path
```

Inventory the package **recursively**, not just the root directory: Hot Reload components are also shipped under `runtime/` and `MSBuild/`. The following reads each DesignTools or Hot Reload DLL's full SHA from the bytes and cross-checks it against `ProductVersion`. It works in Windows PowerShell 5.1 as well as PowerShell 7, without loading assemblies with conflicting identities. Satellite resource DLLs are excluded from this provenance comparison.

Some native or independently built DLLs may not have a commit suffix. The script explicitly lists these as unresolved; investigate their provenance and changes separately. Do not silently omit them or claim a complete changelog until they are accounted for.
```powershell
function Get-XamlCommit([string]$dll) {
    $item = Get-Item -LiteralPath $dll
    if ($item.VersionInfo.ProductVersion -notmatch '\+([0-9a-fA-F]{10})') {
        throw "Missing ProductVersion commit in $dll"
    }
    $short = $Matches[1].ToLowerInvariant()
    $bytes = [System.IO.File]::ReadAllBytes($item.FullName)
    $byteText = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)
    $candidates = @([regex]::Matches($byteText, '(?:[0-9a-fA-F]\x00){40}') |
        ForEach-Object { $_.Value.Replace("`0", '').ToLowerInvariant() } |
        Where-Object { $_.StartsWith($short) } | Sort-Object -Unique)
    if ($candidates.Count -ne 1) {
        throw "Could not uniquely resolve the full commit in $dll (found $($candidates.Count))."
    }
    $candidates[0]
}

function Get-XamlAssemblyMap([string]$root) {
    $rootPath = (Resolve-Path -LiteralPath $root).Path.TrimEnd([char[]]@('\', '/'))
    $files = @(Get-ChildItem -LiteralPath $rootPath -File -Recurse -Filter '*.dll' |
        Where-Object { $_.Name -notlike '*.resources.dll' -and
            ($_.Name -like 'Microsoft.VisualStudio.DesignTools*.dll' -or
             $_.Name -like 'Microsoft.VisualStudio.HotReload*.dll' -or
             $_.Name -like 'Microsoft.Maui.Controls.HotReload*.dll') })
    if ($files.Count -eq 0) { throw "No DesignTools or Hot Reload assemblies found in $rootPath" }
    $map = @{}
    $unresolved = [System.Collections.Generic.List[string]]::new()
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($rootPath.Length).TrimStart([char[]]@('\', '/'))
        if ($file.VersionInfo.ProductVersion -notmatch '\+([0-9a-fA-F]{10})') {
            $unresolved.Add($relative)
        } else {
            $map[$relative] = Get-XamlCommit $file.FullName
        }
    }
    return [pscustomobject]@{ Resolved = $map; Unresolved = $unresolved.ToArray() }
}
$oldInventory = Get-XamlAssemblyMap $oldRoot
$newInventory = Get-XamlAssemblyMap $newRoot
$oldMap = $oldInventory.Resolved
$newMap = $newInventory.Resolved
"Previous package unresolved: $($oldInventory.Unresolved -join ', ')"
"New package unresolved: $($newInventory.Unresolved -join ', ')"
foreach ($name in @($oldMap.Keys + $newMap.Keys | Sort-Object -Unique)) {
    [pscustomobject]@{ Assembly = $name; OldCommit = $oldMap[$name]; NewCommit = $newMap[$name] }
}
```

Inspect other shipped DLLs too: identify any additional XAML/Hot Reload components with different names and add their relative paths and verified VS source commits to `$oldMap` and `$newMap` if applicable. Third-party dependencies and independently sourced components must not be assigned a VS commit by assumption. For unresolved components, either add independently verified VS source commits to both maps or document the separate comparison used to account for them. If an assembly was added, removed, renamed, or lacks usable provenance, investigate its source and package contents separately; do not treat it as unchanged or claim a complete changelog until it is accounted for.

##### 4.2 Compare `/src/Xaml` history for every assembly-commit pair

Group matching assembly names by their **old and new** SHAs. For each distinct pair, enumerate the reachable `/src/Xaml` history at both SHAs, then subtract the old history from the new history. Keep the assembly names associated with each pair for the shipping check in Step 4.4. Do not stop at the first old boundary: merged or divergent branches can interleave history and hide commits. Do not rely on the `compareVersion`/`itemVersion` query alone; it can return an empty range for divergent branches.

The REST list API can be paged with `$skip`; the example reads both histories to exhaustion rather than assuming that a fixed-size first page is complete. This can be expensive in a large repository. Cache history by SHA and report any API or pagination failure rather than treating a truncated result as complete.
```powershell
function Get-XamlHistory($version) {
    $commits = [System.Collections.Generic.List[object]]::new()
    $seen = @{}
    $skip = 0
    while ($true) {
        $q = @{ 'searchCriteria.itemPath'='/src/Xaml'; 'searchCriteria.itemVersion.version'=$version;
                'searchCriteria.itemVersion.versionType'='commit'; 'searchCriteria.$top'='1000';
                'searchCriteria.$skip'="$skip"; 'api-version'='7.1' }
        $page = @((Invoke-RestMethod -Uri "$repo/commits" -Headers $hdr -Body $q -Method Get -ErrorAction Stop).value |
            Where-Object { $null -ne $_ })
        if ($page.Count -eq 0) { break }
        foreach ($commit in $page) {
            if ($seen.ContainsKey($commit.commitId)) { throw "Duplicate commit while paging history for $version" }
            $seen[$commit.commitId] = $true
            $commits.Add($commit)
        }
        $skip += $page.Count
    }
    return $commits.ToArray()
}

$historyCache = @{}
$pairs = @{}
foreach ($name in $newMap.Keys) {
    if (-not $oldMap.ContainsKey($name)) { throw "New assembly needs separate investigation: $name" }
    $oldCommit = $oldMap[$name]
    $newCommit = $newMap[$name]
    $key = "$oldCommit/$newCommit"
    if (-not $pairs.ContainsKey($key)) {
        $pairs[$key] = [pscustomobject]@{ OldCommit = $oldCommit; NewCommit = $newCommit; Assemblies = @() }
    }
    $pairs[$key].Assemblies += $name
}
foreach ($name in $oldMap.Keys) {
    if (-not $newMap.ContainsKey($name)) { throw "Removed assembly needs separate investigation: $name" }
}

$ranges = @{}
foreach ($key in $pairs.Keys) {
    $pair = $pairs[$key]
    foreach ($sha in @($pair.OldCommit, $pair.NewCommit)) {
        if (-not $historyCache.ContainsKey($sha)) { $historyCache[$sha] = @(Get-XamlHistory $sha) }
    }
    $oldIds = @{}
    foreach ($commit in $historyCache[$pair.OldCommit]) { $oldIds[$commit.commitId] = $true }
    $ranges[$key] = @($historyCache[$pair.NewCommit] | Where-Object { -not $oldIds.ContainsKey($_.commitId) })
    "Assemblies: $($pair.Assemblies -join ', '); candidate commits: $($ranges[$key].Count)"
}
```
An empty or suspicious range is not proof that nothing changed. Check the assembly inventory, source histories, and actual package content; investigate newly introduced or partially merged changes separately. Use the *list* API above; the single-commit `GET /commits/{sha}` endpoint is flaky in scripts and best avoided.

##### 4.3 Map the in-range commits to PRs — cover **both** completion styles

For **each** range in `$ranges`, parse squash-completed PRs from commit messages and query PR associations for the individual commits. Merge-completed PRs can contribute individual dev commits whose messages are not `Merged PR ...`; their merge commit may not appear in the path-filtered list. Retain the pair key and assembly names alongside each candidate PR so it can be checked against the correct shipped assembly. Batch large `pullRequestQuery` requests and deduplicate only after recording all associated pairs.

For example, for one nonempty range:
```powershell
$key = '<old-sha>/<new-sha>' # one of $ranges.Keys
$range = @($ranges[$key])
$squash = foreach ($c in $range) {
    $m = [regex]::Match($c.comment.Split([char]10)[0], '^Merged PR (\d+): (.*)$')
    if ($m.Success) { [pscustomobject]@{ Id = $m.Groups[1].Value; Title = $m.Groups[2].Value.Trim() } }
}
$merged = for ($offset = 0; $offset -lt $range.Count; $offset += 100) {
    $batch = @($range | Select-Object -Skip $offset -First 100)
    $body = @{ queries = @(@{ type = 'commit'; items = @($batch.commitId) }) } | ConvertTo-Json -Depth 4
    $res = Invoke-RestMethod -Uri "$repo/pullRequestQuery?api-version=7.1" -Headers $hdr -Method Post -Body $body -ContentType 'application/json' -ErrorAction Stop
    foreach ($p in $res.results[0].PSObject.Properties) {
        foreach ($pr in $p.Value) { [pscustomobject]@{ Id = "$($pr.pullRequestId)"; Title = $pr.title } }
    }
}
@($squash) + @($merged) | Sort-Object Id -Unique |
    ForEach-Object { "  * $($_.Title) (PR: AzDO#$($_.Id)); assemblies: $($pairs[$key].Assemblies -join ', ')" }
```

##### 4.4 Verify shipped changes and trim to user/developer-facing entries

PRs returned by the history query are **candidates**, not proof that the full PR shipped. Review their changed paths, individual commits, and the project/assembly each change belongs to. Confirm the relevant change is reachable from the new commit for its **own** shipped assembly, absent from that assembly's old version, and actually part of its packaged content. In particular, do not claim Visual Studio-only changes shipped in VS Code merely because another assembly was built from the same repo commit. For partial merges or squash commits, inspect the actual source or package contents; if inclusion cannot be verified, explicitly report the uncertainty rather than guessing.

Keep features, fixes, telemetry, and Hot Reload behavior. **Drop** infrastructure noise — the `pullRequestQuery` step in particular sweeps in integration PRs that merely carried the commits along:
- branch-sync / integration PRs: `Merge main into ...`, `Sync vscode -> ...`, `Merge for <build>`;
- component insertions: `... Roslyn ... Insertion into main`;
- build/test/pipeline/localization churn and pure refactors.

#### Option B (fallback): User-provided list

If you cannot reach the VS repo (no `az` access to that AzDO organization) or cannot resolve the commits, ask the user for the list of notable XAML/DesignTools changes with their AzDO PR numbers.

#### (Alternative) Local VS enlistment

With a complete VS enlistment, Git can enumerate commits reachable from each new assembly SHA but not its old SHA. Repeat for every distinct pair and still map both squash and merge PRs as in Step 4.3. A shallow or incomplete enlistment cannot establish a complete range.
```powershell
git -C <vs-enlistment> rev-list <new-commit> ^<old-commit> -- src/Xaml
```

#### (Optional) Confirm a specific PR shipped in a version

To check a specific AzDO PR, compare its **individual commits** against the range for the assembly that contains the change, then verify its changed paths and packaged assembly as in Step 4.4. The example uses one `$key` from `$ranges`:
```powershell
$id        = <pr-id>
$range     = @($ranges[$key])
$pr        = Invoke-RestMethod -Uri "$repo/pullRequests/$id?api-version=7.1" -Headers $hdr          # status / targetRefName / closedDate
$last      = (Invoke-RestMethod -Uri "$repo/pullRequests/$id/iterations?api-version=7.1" -Headers $hdr).value[-1].id
$paths     = (Invoke-RestMethod -Uri "$repo/pullRequests/$id/iterations/$last/changes?api-version=7.1" -Headers $hdr).changeEntries.item.path
$prCommits = (Invoke-RestMethod -Uri "$repo/pullRequests/$id/commits?api-version=7.1" -Headers $hdr).value.commitId
$inRange   = $prCommits | Where-Object { $range.commitId -contains $_ }
"under /src/Xaml: $(@($paths | Where-Object { $_ -like '/src/Xaml*' }).Count)/$($paths.Count); in-range commits: $($inRange.Count)/$($prCommits.Count)"
```
A matching commit and XAML path identify a candidate, not proof that every PR change is included: the PR may span multiple assemblies or contain VS-only changes. Squash completions also require checking the resulting merged commit or actual file contents.

### Step 5: Update CHANGELOG.md

Add an entry to `CHANGELOG.md` under the current in-development version section (the top-most `# 2.x.x` header). Use the AzDO reference format for the child entries:

~~~markdown
* Update xamlTools to <new-version> (PR: [#](https://github.com/dotnet/vscode-csharp/pull/))
  * <change description> (PR: AzDO#<number>)
  * <change description> (PR: AzDO#<number>, AzDO#<number>)
~~~

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

- **HTTP 400 "object ID must be 40 characters"**: you passed a short SHA. The REST API needs the **full 40-char** commit id from the assembly (Step 4.1), not just the short `ProductVersion` suffix.
- **`compareVersion`/`itemVersion` range returns 0**: the two build source commits may be on **divergent branches**. Compare their complete reachable histories as in Step 4.2 instead.

### Changelog Is Missing PRs (Step 4)

Check every shipped assembly's provenance first: a package can combine older markup binaries with newer Hot Reload binaries. Re-run Steps 4.1-4.4 for every distinct old/new pair, including the `pullRequestQuery` (`type: commit`) mapping for **merge-completed** PRs. Verify the changed paths and the relevant packaged assembly rather than assuming a match in an unrelated assembly's history means the change shipped.
