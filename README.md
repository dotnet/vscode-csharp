# C# with NetCoreDbg

The debugger included in the official C# extension is [proprietary](https://aka.ms/VSCode-DotNet-DbgLicense) and is licensed to only work with Microsoft versions of vscode.

This extension replaces it with Samsung's [MIT-licensed](https://github.com/Samsung/netcoredbg/blob/master/LICENSE) alternative, [NetCoreDbg](https://github.com/Samsung/netcoredbg).

This extension is always kept up to date by applying a series of patches to the [official C# extension](https://github.com/dotnet/vscode-csharp) when changes are detected in their repository.

Patches originally based on changes made in [free-vscode-csharp](https://github.com/muhammadsammy/free-vscode-csharp).


#### Download this extension

- Download the vsix file from the [latest release assets](https://github.com/blipk/vscodium-csharp/releases/latest).

- Download the extension vsix from [latest CI run artifacts](https://github.com/blipk/vscodium-csharp/actions/workflows/ci-build.yml).

- This extension is published at [Open VSX](https://open-vsx.org/extension/blipk/csharp).

#### Install this extension

Open the command pallete (`Ctrl+Shift+P`) then run `Extensions: Install from VSIX`

Alternatively go to the extensions tab and click the `...` and select `Install from VSIX`

Either option will prompt you to choose the vsix file you downloaded for your platform

#### Post-Installation

1. You must disable the official C# extension for this to work
2. You may be prompted to download/install extension assets, this is to download NetCoreDbg
3. If you don't have a launch.json set up: from the debugging tab click `create a launch.json file` then click the suggested .NET debugger, then select your .csproj file
4. You can now debug C# from the debugging tab, which will use NetCoreDbg

Some other extensions (C# Dev Kit) depend on the official C# extension and will have to be disabled with it.

To avoid this limitation you can use the python script in `_patches/_scripts/disable_official.py` which changes extension dependencies from the official extension to this one.




<details>
<summary>Development notes</summary>

##### Build from source locally

```bash
git clone https://github.com/blipk/vscodium-csharp.git
cd vscodium-csharp
npm install
npm run vscode:prepublish
npx gulp 'vsix:release:package:neutral-clean'
```

##### CI Notes (GitHub Actions)

A series of GitHub Action workflows are run to apply the patches and build the release.

1. apply-patches.yml:
    - first it merges changes from the official C# extension upstream
    - then it runs any `.sh` files in the _patches directory - these are how patches are applied
    - it is run whenever pushing to main, or at midnight every night
    - it won't run if it doesnt detect any changes upstream, or if the last `ci-build.yml` failed
    - to force it to run push a commit with `[force-ci]` in its message
2. ci-build.yml: this installs all dependencies and builds the `.vsix` files for each platform
3. ci-release.yml: this creates a github release and uploads the `.vsix` files from the previous workflow to it - it will also eventually upload them to Open VSX

###### Other notes

- The packages are versioned by the date and time they were created at

</details>