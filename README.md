## C# for Visual Studio Code (powered by OmniSharp)

Welcome to the C# extension for Visual Studio Code! This extension provides the following features inside VS Code:

-   Lightweight development tools for [.NET Core](https://dotnet.github.io).
-   Great C# editing support, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.
-   Debugging support for .NET Core (CoreCLR). NOTE: Mono debugging is not supported. Desktop CLR debugging has [limited support](https://github.com/OmniSharp/omnisharp-vscode/wiki/Desktop-.NET-Framework).
-   Support for project.json and csproj projects on Windows, macOS and Linux.

The C# extension is powered by [OmniSharp](https://github.com/OmniSharp/omnisharp-roslyn).

### Get Started Writing C# in VS Code

-   [Documentation](https://code.visualstudio.com/docs/languages/csharp)
-   [Video Tutorial compiling with .NET Core](https://channel9.msdn.com/Blogs/dotnet/Get-started-VSCode-Csharp-NET-Core-Windows)

## Note about using .NET Core 3.1.40x SDKs

The .NET 3.1.40x SDKs require version 16.7 of MSBuild.

For MacOS and Linux users who have Mono installed, this means you will need to set `omnisharp.useGlobalMono` to `never` until a version of Mono ships with MSBuild 16.7.

## Note about using .NET 5 SDKs

The .NET 5 SDK requires version 16.8 of MSBuild.

For Windows users who have Visual Studio installed, this means you will need to be on the latest Visual Studio 16.8 Preview.
For MacOS and Linux users who have Mono installed, this means you will need to set `omnisharp.useGlobalMono` to `never` until a version of Mono ships with MSBuild 16.8.

## What's new in 1.23.10
- Support solution filters (*.slnf) (PR: [#4481](https://github.com/OmniSharp/omnisharp-vscode/pull/4481))
- Prompt user to install Blazor WASM companion extension if needed (PR: [#4392](https://github.com/OmniSharp/omnisharp-vscode/pull/4392))
- Add path to dotnet so child processes can use the CLI (PR: [#4459](https://github.com/OmniSharp/omnisharp-vscode/pull/4459))
- Give more information when Mono is missing or invalid. ([#4428](https://github.com/OmniSharp/omnisharp-vscode/issues/4428), PR: [#4431](https://github.com/OmniSharp/omnisharp-vscode/pull/4431))
- Revert incremental change forwarding (PR: [#4477](https://github.com/OmniSharp/omnisharp-vscode/pull/4477))
- Fixes to asset generation (PR: [#4402](https://github.com/OmniSharp/omnisharp-vscode/pull/4402))
- Add properties to blazorwasm debug configuration. ([dotnet/aspnetcore#30977](https://github.com/dotnet/aspnetcore/issues/30977), PR: [#4445](https://github.com/OmniSharp/omnisharp-vscode/pull/4445))
- Avoid white status bar items to ensure contrast ([#4384](https://github.com/OmniSharp/omnisharp-vscode/issues/4384), PR: [#4385](https://github.com/OmniSharp/omnisharp-vscode/pull/4385))
- Update OmniSharp to 1.37.8
  - Update Roslyn version to `3.10.0-1.21125.6` (PR: [omnisharp-roslyn#2105](https://github.com/OmniSharp/omnisharp-roslyn/pull/2105))
  - Update included build tools to closely match NET 6 Preview 1 SDK (PR: [omnisharp-roslyn#2103](https://github.com/OmniSharp/omnisharp-roslyn/pull/2103))
  - Improve custom error messages for MSB3644 (PR: [omnisharp-roslyn#2097](https://github.com/OmniSharp/omnisharp-roslyn/pull/2097))
  - Do not call FindReferencesAsync for null symbol ([omnisharp-roslyn#2054](https://github.com/OmniSharp/omnisharp-roslyn/issues/2054), PR: [omnisharp-roslyn#2089](https://github.com/OmniSharp/omnisharp-roslyn/pull/2089))
  - use an OmniSharp specific message for MSB3644 ([omnisharp-roslyn#2029](https://github.com/OmniSharp/omnisharp-roslyn/issues/2029), PR: [omnisharp-roslyn#2069](https://github.com/OmniSharp/omnisharp-roslyn/pull/2069))
  - changed the default RunFixAllRequest timeout to 10 seconds (PR: [omnisharp-roslyn#2066](https://github.com/OmniSharp/omnisharp-roslyn/pull/2066))
  - Support Solution filter (.slnf) (PR: [omnisharp-roslyn#2121](https://github.com/OmniSharp/omnisharp-roslyn/pull/2121))
  - updated to IL Spy 7.0.0.6372 (PR: [omnisharp-roslyn#2113](https://github.com/OmniSharp/omnisharp-roslyn/pull/2113))
  - Add sentinel file to MSBuild to enable workload resolver ([#4417](https://github.com/OmniSharp/omnisharp-vscode/issues/4417), PR: [omnisharp-roslyn#2111](https://github.com/OmniSharp/omnisharp-roslyn/pull/2111))
  - fixed CS8605 "Unboxing possibly null value" (PR: [omnisharp-roslyn#2108](https://github.com/OmniSharp/omnisharp-roslyn/pull/2108))
- Updated Razor support (PR: [#4470](https://github.com/OmniSharp/omnisharp-vscode/pull/4470))
  - Bug fixes

## What's new in 1.23.9
- Add option to organize imports during document formatting. (PR: [#4302](https://github.com/OmniSharp/omnisharp-vscode/pull/4302))
- Update to use zero based indexes (PR: [#4300](https://github.com/OmniSharp/omnisharp-vscode/pull/4300))
- Improve request queues to improve code completion performance (PR: [#4310](https://github.com/OmniSharp/omnisharp-vscode/pull/4310))
- Add setting to control whether to show the OmniSharp log on error ([#4102](https://github.com/OmniSharp/omnisharp-vscode/issues/4102), [#4330](https://github.com/OmniSharp/omnisharp-vscode/issues/4330), PR: [#4333](https://github.com/OmniSharp/omnisharp-vscode/pull/4333))
- Support building launch assets for NET6-NET9 projects ([#4346](https://github.com/OmniSharp/omnisharp-vscode/issues/4346), PR: [#4349](https://github.com/OmniSharp/omnisharp-vscode/pull/4349))
- Add debugger support for Concord extensions. See the [ConcordExtensibilitySamples wiki](https://github.com/microsoft/ConcordExtensibilitySamples/wiki/Support-for-cross-platform-.NET-scenarios) for more information.
- Update OmniSharp version to 1.37.6
  - Handle records in syntax highlighting ([#2048](https://github.com/OmniSharp/omnisharp-roslyn/issues/2048), PR: [#2049](https://github.com/OmniSharp/omnisharp-roslyn/pull/2049))
  - Remove formatting on new line (PR: [#2053](https://github.com/OmniSharp/omnisharp-roslyn/pull/2053))
  - Validate highlighting ranges in semantic highlighting requests (PR: [#2055](https://github.com/OmniSharp/omnisharp-roslyn/pull/2055))
  - Delay project system init to avoid solution update race (PR: [#2057](https://github.com/OmniSharp/omnisharp-roslyn/pull/2057))
  - Use "variable" kind for parameter completion ([#2060](https://github.com/OmniSharp/omnisharp-roslyn/issues/2060), PR: [#2061](https://github.com/OmniSharp/omnisharp-roslyn/pull/2061))
  - Log request when response fails ([#2064](https://github.com/OmniSharp/omnisharp-roslyn/pull/2064))

## What's new in 1.23.8
-   Updated Debugger support (PR: [#4281](https://github.com/OmniSharp/omnisharp-vscode/pull/4281))
    -   Updated the version of .NET that the debugger uses for running its own C# code to .NET 5
    -   Updated .NET debugging services loader to address problem with debugging after installing XCode12 ([dotnet/runtime/#42311](https://github.com/dotnet/runtime/issues/42311))
    -   Fixed integrated terminal on non-Windows ([#4203](https://github.com/OmniSharp/omnisharp-vscode/issues/4203))
-   Updated Razor support (PR: [#4278](https://github.com/OmniSharp/omnisharp-vscode/pull/4278))
    -   Bug fixes
-   Update OmniSharp version to 1.37.5 (PR: [#4299](https://github.com/OmniSharp/omnisharp-vscode/pull/4299))
    -   Update Roslyn version to 3.9.0-2.20570.24 (PR: [omnisharp-roslyn#2022](https://github.com/OmniSharp/omnisharp-roslyn/pull/2022))
    -   Editorconfig improvements - do not lose state, trigger re-analysis on change ([omnisharp-roslyn#1955](https://github.com/OmniSharp/omnisharp-roslyn/issues/1955), [#4165](https://github.com/OmniSharp/omnisharp-vscode/issues/4165), [#4184](https://github.com/OmniSharp/omnisharp-vscode/issues/4184), PR: [omnisharp-roslyn#2028](https://github.com/OmniSharp/omnisharp-roslyn/pull/2028))
    -   Add documentation comment creation to the FormatAfterKeystrokeService (PR: [omnisharp-roslyn#2023](https://github.com/OmniSharp/omnisharp-roslyn/pull/2023))
    -   Raise default GotoDefinitionRequest timeout from 2s to 10s ([#4260](https://github.com/OmniSharp/omnisharp-vscode/issues/4260), PR: [omnisharp-roslyn#2032](https://github.com/OmniSharp/omnisharp-roslyn/pull/2032))
    -   Workspace create file workaround (PR: [omnisharp-roslyn#2019](https://github.com/OmniSharp/omnisharp-roslyn/pull/2019))
    -   Added `msbuild:UseBundledOnly` option to force the usage of bundled MSBuild (PR: [omnisharp-roslyn#2038](https://github.com/OmniSharp/omnisharp-roslyn/pull/2038))
-   Support auto doc comment generation ([#8](https://github.com/OmniSharp/omnisharp-vscode/issues/8), PR: [#4261](https://github.com/OmniSharp/omnisharp-vscode/pull/4261))
-   Add schema support for appsettings.json ([#4279](https://github.com/OmniSharp/omnisharp-vscode/issues/4279), PR: [#4280](https://github.com/OmniSharp/omnisharp-vscode/pull/4280))
-   Add schema support for global.json (PR: [#4290](https://github.com/OmniSharp/omnisharp-vscode/pull/4290))
-   Update remoteProcessPickerScript windows ssh exit ([#3482](https://github.com/OmniSharp/omnisharp-vscode/issues/3482), PR: [#4225](https://github.com/OmniSharp/omnisharp-vscode/pull/4225))
-   Do not start OmniSharp server in Live Share scenarios ([#3910](https://github.com/OmniSharp/omnisharp-vscode/issues/3910), PR: [#4038](https://github.com/OmniSharp/omnisharp-vscode/pull/4038))
-   Suppress codelens for IEnumerable.GetEnumerator ([#4245](https://github.com/OmniSharp/omnisharp-vscode/issues/4245), PR: [#4246](https://github.com/OmniSharp/omnisharp-vscode/pull/4246))
-   Allow arm64 MacOS to debug dotnet projects ([#4277](https://github.com/OmniSharp/omnisharp-vscode/issues/4277), PR: [#4288](https://github.com/OmniSharp/omnisharp-vscode/pull/4288))

### Emmet support in Razor files

To enable emmet support, add the following to your settings.json:

```json
"emmet.includeLanguages": {
    "aspnetcorerazor": "html"
}
```

### Semantic Highlighting

The C# semantic highlighting support is in preview. To enable, set `editor.semanticHighlighting.enabled` and `csharp.semanticHighlighting.enabled` to `true` in your settings. Semantic highlighting is only provided for code files that are part of the active project.

To really see the difference, try the new Visual Studio 2019 Light and Dark themes with semantic colors that closely match Visual Studio 2019.

### Supported Operating Systems for Debugging

-   Currently, the C# debugger officially supports the following operating systems:

    -   X64 operating systems:
        -   Windows 7 SP1 and newer
        -   macOS 10.12 (Sierra) and newer
        -   Linux: see [.NET Core documentation](https://github.com/dotnet/core/blob/master/release-notes/2.2/2.2-supported-os.md#linux) for the list of supported distributions. Note that other Linux distributions will likely work as well as long as they include glibc and OpenSSL.
    -   ARM operating systems:
        -   Linux is supported as a remote debugging target

### Found a Bug?

To file a new issue to include all the related config information directly from vscode by entering the command pallette with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on macOS) and running `CSharp: Report an issue` command. This will open a browser window with all the necessary information related to the installed extensions, dotnet version, mono version, etc. Enter all the remaining information and hit submit. More information can be found on the [wiki](https://github.com/OmniSharp/omnisharp-vscode/wiki/Reporting-Issues).

Alternatively you could visit https://github.com/OmniSharp/omnisharp-vscode/issues and file a new one.

### Development

First install:

-   Node.js (8.11.1 or later)
-   Npm (5.6.0 or later)

To **run and develop** do the following:

-   Run `npm i`
-   Run `npm run compile`
-   Open in Visual Studio Code (`code .`)
-   _Optional:_ run `npm run watch`, make code changes
-   Press <kbd>F5</kbd> to debug

To **test** do the following: `npm run test` or <kbd>F5</kbd> in VS Code with the "Launch Tests" debug configuration.

### License

Copyright © .NET Foundation, and contributors.

The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).
The source code to this extension is available on [https://github.com/OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) and licensed under the [MIT license](LICENSE.txt).

## Code of Conduct

This project has adopted the code of conduct defined by the [Contributor Covenant](http://contributor-covenant.org/)
to clarify expected behavior in our community.
For more information see the [.NET Foundation Code of Conduct](http://www.dotnetfoundation.org/code-of-conduct).

## Contribution License Agreement

By signing the [CLA](https://cla.dotnetfoundation.org/OmniSharp/omnisharp-roslyn), the community is free to use your contribution to [.NET Foundation](http://www.dotnetfoundation.org) projects.

## .NET Foundation

This project is supported by the [.NET Foundation](http://www.dotnetfoundation.org).
