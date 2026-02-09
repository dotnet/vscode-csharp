---
name: update-roslyn-version
description: Guide for updating the Roslyn language server version in the vscode-csharp repository. Use this when asked to update Roslyn, bump the Roslyn version, or upgrade the language server version.
---

# Update Roslyn Version

This skill describes how to update the Roslyn language server version in the vscode-csharp repository.

## Prerequisites

1. You must have a local clone of the `dotnet/roslyn` repository (commonly at `C:\Users\<username>\source\repos\roslyn`)
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

- **New Roslyn Version**: The new version to update to (e.g., `5.5.0-2.26080.10`)

## Process

### Step 1: Create a New Branch

Create a new git branch for the update:
```powershell
git checkout -B update/roslyn-<version>
```
Replace `<version>` with the new Roslyn version, using dashes instead of dots for the branch name.

### Step 2: Update package.json

Update the `defaults.roslyn` field in `package.json`:

```json
"defaults": {
    "roslyn": "<new-version>",
    ...
}
```

### Step 3: Run gulp updateRoslynVersion

This step acquires the new Roslyn packages and ensures they are in the proper feeds:

```powershell
gulp updateRoslynVersion
```

This task:
- Downloads all platform-specific Roslyn nuget packages
- Ensures packages are saved to the consumption AzDo artifacts feed
- Runs `installDependencies` to update local dependencies

**Note**: You may need to install the [Azure Artifacts NuGet Credential Provider](https://github.com/microsoft/artifacts-credprovider#installation-on-windows) for interactive authentication.

### Step 4: Get the Previous Roslyn Commit SHA

The commit SHAs are stored in the `.nuspec` files inside the downloaded NuGet packages. After running `gulp updateRoslynVersion`, the new version's package will be cached locally, but you need to explicitly download the old version to get its commit SHA.

**To get the old version's commit SHA:**

1. First, find the old version number from the current `package.json` (before your edit) - look at the `defaults.roslyn` value
2. Download the old version's package to the local cache:
   ```powershell
   dotnet restore "C:\Users\<username>\source\repos\vscode-csharp\msbuild\server" /p:PackageName=roslyn-language-server.osx-arm64 /p:PackageVersion=<old-version> --interactive
   ```
3. Extract the commit SHA from the nuspec file:
   ```powershell
   Get-Content "C:\Users\<username>\source\repos\vscode-csharp\out\.nuget\roslyn-language-server.osx-arm64\<old-version>\roslyn-language-server.osx-arm64.nuspec" | Select-String -Pattern "commit"
   ```
   This will show output like:
   ```
   <repository type="git" url="https://github.com/dotnet/roslyn" branch="main" commit="0e21a3cb684db6ab02646541a780b3278f53d19e" />
   ```

### Step 5: Get the New Roslyn Commit SHA

After running `gulp updateRoslynVersion`, the new version's package is already cached. Extract the commit SHA:

```powershell
Get-Content "C:\Users\<username>\source\repos\vscode-csharp\out\.nuget\roslyn-language-server.osx-arm64\<new-version>\roslyn-language-server.osx-arm64.nuspec" | Select-String -Pattern "commit"
```

**Note**: The Azure DevOps artifacts feed web pages require authentication and may not load properly in automated scenarios. Always use the nuspec files from the local package cache.

### Step 6: Generate Changelog Entries Using PR Finder

First, locate the local `dotnet/roslyn` repository. Common locations include:
- `C:\Users\<username>\source\repos\roslyn`
- `C:\repos\roslyn`

Navigate to the roslyn repository, fetch the latest, and run the pr-finder tool:

```powershell
cd <path-to-roslyn-repo>
git fetch origin
roslyn-tools pr-finder --start <old-commit-sha> --end <new-commit-sha> --format "o#"
```

**Important**: The tool is invoked as `roslyn-tools` (a global tool), NOT `dotnet roslyn-tools`.

This will output a list of PRs in the format needed for the changelog:
```
  * <PR title> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
```

### Step 7: Update CHANGELOG.md

Add an entry to `CHANGELOG.md` under the current version section (e.g., `# 2.121.x`):
Copy the results from the previous step (should already be formatted correctly).

```markdown
* Update Roslyn to <new-version> (PR: [#](https://github.com/dotnet/vscode-csharp/pull/))
  * <PR title 1> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
  * <PR title 2> (PR: [#<number>](https://github.com/dotnet/roslyn/pull/<number>))
  ...
```

Note: Leave the PR number blank initially (just `[#]`) - it will be updated after the PR is created.

### Step 8: Filter Changelog Entries

Review the changelog entries and remove any PRs that obviously don't affect VS Code. Remove entries that are:

- **Infrastructure/Build changes**: CI/CD pipelines, build scripts, Azure DevOps configurations
- **Visual Studio-only changes**: Features or fixes specific to Visual Studio IDE (not VS Code)
- **Test-only changes**: Test infrastructure, test fixes that don't affect production code
- **Internal tooling**: Changes to internal tools not used by the language server
- **Documentation-only**: README updates, internal docs (unless they document user-facing features)

Keep entries that are:
- Language server protocol (LSP) changes
- Code analysis/diagnostics improvements
- Completion, navigation, refactoring features
- Performance improvements
- Bug fixes that affect language server behavior
- API changes that could affect VS Code extension

### Step 9: Commit and Push

```powershell
git add package.json CHANGELOG.md
git commit -m "Update Roslyn to <new-version>"
git push -u origin update/roslyn-<version>
```

### Step 10: Create Pull Request

Create a pull request on GitHub:
- Title: `Update roslyn to <new-version>`
- Base: `main`

### Step 11: Update Changelog with PR Number

After the PR is created, note the PR number (e.g., `#8941`), then:

1. Update the CHANGELOG.md entry to include the actual PR number:
   ```markdown
   * Update Roslyn to <new-version> (PR: [#8941](https://github.com/dotnet/vscode-csharp/pull/8941))
   ```

2. Commit and push the update:
   ```powershell
   git add CHANGELOG.md
   git commit -m "Update changelog with PR number"
   git push
   ```

## Example

For updating from `5.4.0-2.26077.7` to `5.5.0-2.26080.10`:

1. Branch: `update/roslyn-5-5-0-2-26080-10`
2. package.json change: `"roslyn": "5.5.0-2.26080.10"`
3. Find old commit from package metadata for version `5.4.0-2.26077.7`
4. Find new commit from package metadata for version `5.5.0-2.26080.10`
5. Run pr-finder in roslyn repo
6. Update CHANGELOG.md with the output
7. Run `gulp updateRoslynVersion`
8. Create PR titled "Update roslyn to 5.5.0-2.26080.10"
9. Update changelog with PR number

## Reference PR

See [PR #8941](https://github.com/dotnet/vscode-csharp/pull/8941) as an example of a Roslyn version update.

## Files Modified

- `package.json` - Update `defaults.roslyn` version
- `CHANGELOG.md` - Add changelog entry with Roslyn PR list

## Troubleshooting

### Authentication Issues with gulp updateRoslynVersion

If you encounter authentication errors:
1. Install Azure Artifacts Credential Provider
2. Run the command again - it should prompt for interactive authentication

### pr-finder Returns Empty Results

Ensure:
1. You have fetched the latest from origin in the roslyn repo: `git fetch origin`
2. Both commit SHAs exist in your local repo
3. You have authenticated with `roslyn-tools authenticate`
4. You are invoking the tool correctly as `roslyn-tools pr-finder` (not `dotnet roslyn-tools`)

### Finding Commit SHAs

The commit SHAs are embedded in the nuspec files inside the downloaded NuGet packages:

1. After running `gulp updateRoslynVersion`, packages are cached in `out/.nuget/`
2. To get the old version's commit, you may need to explicitly download it first:
   ```powershell
   dotnet restore "msbuild\server" /p:PackageName=roslyn-language-server.osx-arm64 /p:PackageVersion=<old-version> --interactive
   ```
3. Then read the nuspec file:
   ```powershell
   Get-Content "out\.nuget\roslyn-language-server.osx-arm64\<version>\roslyn-language-server.osx-arm64.nuspec" | Select-String -Pattern "commit"
   ```

**Note**: The Azure DevOps artifacts feed web pages require authentication and often fail to load in automated scenarios. Always use the local nuspec files instead.
