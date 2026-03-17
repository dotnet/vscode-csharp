---
name: update-razor-version
description: Guide for updating the Razor extension version in the vscode-csharp repository. Use this when asked to update Razor, bump the Razor version, or upgrade the Razor language server version.
---

# Update Razor Version

This skill describes how to update the Razor extension version in the vscode-csharp repository.

## Prerequisites

1. You must have a local clone of the `dotnet/razor` repository (commonly at `C:\Users\<username>\source\repos\razor`)
2. The `roslyn-tools` CLI tool must be installed as a global .NET tool:
   ```powershell
   dotnet tool install -g Microsoft.RoslynTools --prerelease --add-source https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-eng/nuget/v3/index.json
   ```
   **Note**: After installation, the tool is invoked as `roslyn-tools` (not `dotnet roslyn-tools`)
3. You must have authenticated with GitHub for `roslyn-tools`:
   ```powershell
   roslyn-tools authenticate
   ```
4. The Azure CLI (`az`) must be installed and you must be logged in to Azure DevOps:
   ```powershell
   az login
   ```
   This is needed to automatically discover the latest Razor version from the official build pipeline.

## Input Required

- **New Razor Version** (optional): If not provided, the latest successful build version will be automatically discovered from the official Razor build pipeline.

## Process

### Step 1: Determine the New Version

If the user provided a specific version, use that. Otherwise, query the latest successful build from the official Razor build pipeline (definition ID 262 in the `dnceng/internal` project) and extract the package version from the BlobArtifacts.

The build number (e.g., `20260214.1`) is **not** the package version. The actual NuGet package version must be extracted from the build artifacts.

```powershell
# Get an Azure DevOps access token
$token = az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798" --query "accessToken" -o tsv
$headers = @{ "Authorization" = "Bearer $token" }

# Get the latest successful build ID from the main branch
$buildsUrl = "https://dev.azure.com/dnceng/internal/_apis/build/builds?definitions=262&resultFilter=succeeded&branchName=refs/heads/main&`$top=1&api-version=7.1"
$buildId = (Invoke-RestMethod -Uri $buildsUrl -Headers $headers).value[0].id

# Get the BlobArtifacts container ID
$artifactUrl = "https://dev.azure.com/dnceng/internal/_apis/build/builds/$buildId/artifacts?artifactName=BlobArtifacts&api-version=7.1"
$containerId = ((Invoke-RestMethod -Uri $artifactUrl -Headers $headers).resource.data -replace '^#/(\d+)/.*', '$1')

# List files and extract the version from the RazorExtension package filename
$containerUrl = "https://dev.azure.com/dnceng/_apis/resources/Containers/$containerId/BlobArtifacts?itemType=file&api-version=7.1-preview.4"
$files = (Invoke-RestMethod -Uri $containerUrl -Headers $headers).value
$razorFile = ($files.path | Where-Object { $_ -match 'Microsoft\.VisualStudioCode\.RazorExtension\.' }) | Select-Object -First 1
$version = $razorFile -replace '.*Microsoft\.VisualStudioCode\.RazorExtension\.(.+?)(\.symbols)?\.nupkg$', '$1'
Write-Host "Latest Razor version: $version"
```

This returns the NuGet package version (e.g., `10.0.0-preview.26114.1`).

**Note**: If authentication fails, run `az login` first and ensure you have access to the `dnceng/internal` project.

### Step 2: Create a New Branch

Create a new git branch for the update:
```powershell
git checkout -B update/razor-<version>
```
Replace `<version>` with the new Razor version, using dashes instead of dots for the branch name.

### Step 3: Update package.json

Update the `defaults.razor` field in `package.json`:

```json
"defaults": {
    "razor": "<new-version>",
    ...
}
```

### Step 4: Run gulp updateRazorVersion

This step acquires the new Razor extension package and ensures it is in the proper feeds:

```powershell
gulp updateRazorVersion
```

This task:
- Downloads the `Microsoft.VisualStudioCode.RazorExtension` NuGet package
- Runs `installDependencies` to update local dependencies

**Note**: You may need to install the [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) for interactive authentication.

### Step 5: Get the Previous Razor Commit SHA

The commit SHAs are stored in the `.nuspec` files inside the downloaded NuGet packages. After running `gulp updateRazorVersion`, the new version's package will be cached locally, but you need to explicitly download the old version to get its commit SHA.

**To get the old version's commit SHA:**

1. First, find the old version number from the current `package.json` (before your edit) - look at the `defaults.razor` value
2. Download the old version's package to the local cache:
   ```powershell
   dotnet restore "C:\Users\<username>\source\repos\vscode-csharp\msbuild\server" /p:PackageName=Microsoft.VisualStudioCode.RazorExtension /p:PackageVersion=<old-version> --interactive
   ```
3. Extract the commit SHA from the nuspec file:
   ```powershell
   Get-Content "C:\Users\<username>\source\repos\vscode-csharp\out\.nuget\microsoft.visualstudiocode.razorextension\<old-version>\microsoft.visualstudiocode.razorextension.nuspec" | Select-String -Pattern "commit"
   ```
   This will show output like:
   ```
   <repository type="git" url="https://github.com/dotnet/razor" branch="main" commit="b13d3cc91216d84453559c1fa6c723528195f58a" />
   ```

**Note**: NuGet package names are always lower case in the `.nuget` folder, so use `microsoft.visualstudiocode.razorextension` (all lowercase) in the path.

### Step 6: Get the New Razor Commit SHA

After running `gulp updateRazorVersion`, the new version's package is already cached. Extract the commit SHA:

```powershell
Get-Content "C:\Users\<username>\source\repos\vscode-csharp\out\.nuget\microsoft.visualstudiocode.razorextension\<new-version>\microsoft.visualstudiocode.razorextension.nuspec" | Select-String -Pattern "commit"
```

**Note**: The Azure DevOps artifacts feed web pages require authentication and may not load properly in automated scenarios. Always use the nuspec files from the local package cache.

### Step 7: Generate Changelog Entries Using PR Finder

First, locate the local `dotnet/razor` repository. Common locations include:
- `C:\Users\<username>\source\repos\razor`
- `C:\repos\razor`

Navigate to the razor repository, fetch the latest, and run the pr-finder tool:

```powershell
cd <path-to-razor-repo>
git fetch origin
roslyn-tools pr-finder --start <old-commit-sha> --end <new-commit-sha> --format "o#"
```

**Important**: The tool is invoked as `roslyn-tools` (a global tool), NOT `dotnet roslyn-tools`.

This will output a list of PRs in the format needed for the changelog:
```
  * <PR title> (PR: [#<number>](https://github.com/dotnet/razor/pull/<number>))
```

### Step 8: Update CHANGELOG.md

Add an entry to `CHANGELOG.md` under the current version section (e.g., `# 2.121.x`):
Copy the results from the previous step (should already be formatted correctly).

```markdown
* Update Razor to <new-version> (PR: [#](https://github.com/dotnet/vscode-csharp/pull/))
  * <PR title 1> (PR: [#<number>](https://github.com/dotnet/razor/pull/<number>))
  * <PR title 2> (PR: [#<number>](https://github.com/dotnet/razor/pull/<number>))
  ...
```

Note: Leave the PR number blank initially (just `[#]`) - it will be updated after the PR is created.

### Step 9: Filter Changelog Entries

Review the changelog entries and remove any PRs that obviously don't affect VS Code. Remove entries that are:

- **Infrastructure/Build changes**: CI/CD pipelines, build scripts, Azure DevOps configurations
- **Visual Studio-only changes**: Features or fixes specific to Visual Studio IDE (not VS Code)
- **Test-only changes**: Test infrastructure, test fixes that don't affect production code
- **Internal tooling**: Changes to internal tools not used by the language server
- **Documentation-only**: README updates, internal docs (unless they document user-facing features)
- **Compiler-only changes**: Changes to the Razor compiler that don't affect the language server or VS Code extension

Keep entries that are:
- Language server protocol (LSP) changes
- Razor formatting, completion, navigation, or refactoring features
- Diagnostics and code analysis improvements
- Performance improvements
- Bug fixes that affect language server behavior
- API changes that could affect VS Code extension

### Step 10: Commit and Push

```powershell
git add package.json CHANGELOG.md
git commit -m "Bump Razor to <new-version>"
git push -u origin update/razor-<version>
```

### Step 11: Create Pull Request

Create a pull request on GitHub:
- Title: `Bump Razor to <new-version>`
- Base: `main`

### Step 12: Update PR Description

After creating the PR, update its description with the **full raw output** from the `roslyn-tools pr-finder` command (the unfiltered version, before removing infrastructure/test entries). This provides reviewers with a complete view of all changes included in the version bump.

```powershell
gh pr edit <pr-number> --repo dotnet/vscode-csharp --body "<full pr-finder output>"
```

The body should include the `[View Complete Diff of Changes]` link and all PR entries exactly as output by `pr-finder`.

### Step 13: Update Changelog with PR Number

After the PR is created, note the PR number (e.g., `#8914`), then:

1. Update the CHANGELOG.md entry to include the actual PR number:
   ```markdown
   * Bump Razor to <new-version> (PR: [#8914](https://github.com/dotnet/vscode-csharp/pull/8914))
   ```

2. Commit and push the update:
   ```powershell
   git add CHANGELOG.md
   git commit -m "Update changelog with PR number"
   git push
   ```

## Example

For updating from `10.0.0-preview.26075.11` to `10.0.0-preview.26081.1`:

1. Discover latest version via `az pipelines build list` (or use a provided version)
2. Branch: `update/razor-10-0-0-preview-26081-1`
3. package.json change: `"razor": "10.0.0-preview.26081.1"`
4. Run `gulp updateRazorVersion`
5. Find old commit from nuspec for version `10.0.0-preview.26075.11`
6. Find new commit from nuspec for version `10.0.0-preview.26081.1`
7. Run pr-finder in razor repo
8. Filter changelog entries
9. Update CHANGELOG.md with the output
10. Create PR titled "Bump Razor to 10.0.0-preview.26081.1"
11. Update PR description with full pr-finder output
12. Update changelog with PR number

## Reference PR

See [PR #8914](https://github.com/dotnet/vscode-csharp/pull/8914) as an example of a Razor version update.

## Files Modified

- `package.json` - Update `defaults.razor` version
- `CHANGELOG.md` - Add changelog entry with Razor PR list

## Troubleshooting

### Authentication Issues with gulp updateRazorVersion

If you encounter authentication errors:
1. Install Azure Artifacts Credential Provider
2. Run the command again - it should prompt for interactive authentication

### pr-finder Returns Empty Results

Ensure:
1. You have fetched the latest from origin in the razor repo: `git fetch origin`
2. Both commit SHAs exist in your local repo
3. You have authenticated with `roslyn-tools authenticate`
4. You are invoking the tool correctly as `roslyn-tools pr-finder` (not `dotnet roslyn-tools`)

### Finding Commit SHAs

The commit SHAs are embedded in the nuspec files inside the downloaded NuGet packages:

1. After running `gulp updateRazorVersion`, packages are cached in `out/.nuget/`
2. To get the old version's commit, you may need to explicitly download it first:
   ```powershell
   dotnet restore "msbuild\server" /p:PackageName=Microsoft.VisualStudioCode.RazorExtension /p:PackageVersion=<old-version> --interactive
   ```
3. Then read the nuspec file:
   ```powershell
   Get-Content "out\.nuget\microsoft.visualstudiocode.razorextension\<version>\microsoft.visualstudiocode.razorextension.nuspec" | Select-String -Pattern "commit"
   ```

**Note**: The Azure DevOps artifacts feed web pages require authentication and often fail to load in automated scenarios. Always use the local nuspec files instead.
