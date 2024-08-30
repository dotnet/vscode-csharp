# C# with NetCoreDbg

The debugger included in the official C# extension is [proprietary](https://aka.ms/VSCode-DotNet-DbgLicense) and is licensed to only work with Microsoft versions of vscode.

This extension replaces it with Samsung's [MIT-licensed](https://github.com/Samsung/netcoredbg/blob/master/LICENSE) alternative, [NetCoreDbg](https://github.com/Samsung/netcoredbg).

This extension is always kept up to date by applying a series of patches to the [official C# extension](https://github.com/dotnet/vscode-csharp) when changes are detected in their repository.

Patches originally based on changes made in [free-vscode-csharp](https://github.com/muhammadsammy/free-vscode-csharp).


#### Download this extension

- Download the vsix file from the [latest release assets](https://github.com/blipk/vscodium-csharp/releases/latest).

- Download the extension vsix from [latest CI run artifacts](https://github.com/blipk/vscodium-csharp/actions/workflows/ci.yml).

- This extension is NOT YET published at [Open VSX](https://open-vsx.org/extension/blipk/vscodium-csharp).

#### Install this extension

Open the command pallete (`Ctrl+Shift+P`) then run `Extensions: Install from VSIX`

Alternatively go to the extensions tab and click the `...` and select `Install from VSIX`

Either option will prompt you to choose the vsix file you downloaded for your platform

#### Post-Installation

1. You must disable the official C# extension for this to work
2. You may be prompted to download/install extension assets, this is to download NetCoreDbg
3. If you don't have a launch.json set up: from the debugging tab click `create a launch.json file` then click the suggested .NET debugger, then select your .csproj file
4. You can now debug C# from the debugging tab, which will use NetCoreDbg

Because some other extensions (Auto-Using for C#, C# Dev Kit) depend on the official C# extension they won't be available while using this extension.

PR's to fork and patch those to depend on this extension instead are welcome.



##### Build from source

```bash
git clone https://github.com/blipk/vscodium-csharp.git
cd vscodium-csharp
npm install
npm run vscode:prepublish
npx gulp 'vsix:release:neutral'
```

