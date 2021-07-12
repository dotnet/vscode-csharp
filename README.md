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

## What's new in 1.23.13
- Fixes Razor editing support (PR: [#4642](https://github.com/OmniSharp/omnisharp-vscode/pull/4642))
- Use new CompletionItem label API ([#4640](https://github.com/OmniSharp/omnisharp-vscode/issues/4640), PR: [#4648](https://github.com/OmniSharp/omnisharp-vscode/pull/4648))
- Support V2 version of GoToDefinition, which can show more than one location for partial types and show source-generated file information (PR: [#4581](https://github.com/OmniSharp/omnisharp-vscode/pull/4581))
- Add command 'listRemoteDockerProcess' and variable 'pickRemoteDockerProcess' ([#4607](https://github.com/OmniSharp/omnisharp-vscode/issues/4607), PR: [#4617](https://www.github.com/OmniSharp/omnisharp-vscode/pull/4617))
- Ensure we only start one instance of OmniSharp server (PR: [#4612](https://www.github.com/OmniSharp/omnisharp-vscode/pull/4612))
- Set the names of status bar items (PR: [#4621](https://github.com/OmniSharp/omnisharp-vscode/pull/4621))
- Add Debugger Languages (PR: [#4626](https://github.com/OmniSharp/omnisharp-vscode/pull/4626))
- Use temporary directory for debug sockets on NIX systems (PR: [#4637](https://github.com/OmniSharp/omnisharp-vscode/pull/4637))
- Update OmniSharp version to 1.37.12
  - Include timing info in logged responses (PR: [omnisharp-roslyn#2173](https://www.github.com/omnisharp/omnisharp-roslyn/pull/2173))
  - Defend against null value in BuildErrorEventArgs ([omnisharp-roslyn#2171](https://github.com/OmniSharp/omnisharp-roslyn/issues/2171), PR: [omnisharp-roslyn#2172](https://www.github.com/omnisharp/omnisharp-roslyn/pull/2172))
  - Updated to all the latest .NET SDKs (PR: [omnisharp-roslyn#2166](https://www.github.com/omnisharp/omnisharp-roslyn/pull/2166))
  - Add support for GoToDefinition on source-generated files (PR: [omnisharp-roslyn#2170](https://www.github.com/omnisharp/omnisharp-roslyn/pull/2170))
  - Add V2 version of GotoDefinitionService (PR: [omnisharp-roslyn#2168](https://www.github.com/omnisharp/omnisharp-roslyn/pull/2168))
  - avoid NRE when document is null (PR: [omnisharp-roslyn#2163](https://www.github.com/omnisharp/omnisharp-roslyn/pull/2163)))
  - Update Roslyn to 4.0.0-2.21322.50 (PR: [omnisharp-roslyn#2183](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2183))
  - Added support for diagnostic suppressors ([omnisharp-roslyn#1711](https://github.com/OmniSharp/omnisharp-roslyn/issues/1711), PR: [omnisharp-roslyn#2182](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2182))
  - Use the Microsoft.Build.Locator package for discovery (PR: [omnisharp-roslyn#2181](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2181))
  - Update build tools to match NET 6 Preview 5 (PR: [omnisharp-roslyn#2175](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2175))

## What's new in 1.23.12
- Support experimental async completion (PR: [#4116](https://www.github.com/OmniSharp/omnisharp-vscode/pull/4116))
- Add option to to exclude custom symbols from codelens ([#4335](https://github.com/OmniSharp/omnisharp-vscode/issues/4335), PR: [#4418](https://www.github.com/OmniSharp/omnisharp-vscode/pull/4418))
- Handle ProcessPicker via resolveDebugConfiguration (PR: [#4509](https://www.github.com/OmniSharp/omnisharp-vscode/pull/4509))
- Update OmniSharp version to 1.37.10
  - Update included toolset to match .NET 6 preview4 (PR: [omnisharp-roslyn#2159](https://github.com/OmniSharp/omnisharp-roslyn/pull/2159))
  - Add async completion support (PR: [omnisharp-roslyn#1986](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/1986))
  - Only subscribe to AppDomain.AssemblyResolve once (PR: [omnisharp-roslyn#2149](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2149))
  - Update build tools to match .NET 6 Preview 3 SDK. (PR: [omnisharp-roslyn#2134](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2134))
  - Do not return null responses from BlockStructureService and CodeStructureService (PR: [omnisharp-roslyn#2148](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2148))
  - Strong-name sign OmniSharp assemblies (PR: [omnisharp-roslyn#2143](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2143))
  - Updated IL Spy to 7.0.0 stable (PR: [omnisharp-roslyn#2142](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2142))
  - Do not crash on startup when configuration is invalid (PR: [omnisharp-roslyn#2140](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2140))
  - Bump System.Text.Encodings.Web from 4.7.1 to 4.7.2 in /tools (PR: [omnisharp-roslyn#2137](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2137))
  - Correctly set compilation platform of the project (PR: [omnisharp-roslyn#2135](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2135))
  - Fix typo (PR: [omnisharp-roslyn#2098](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2098))
  - Rework completion resolution ([omnisharp-roslyn#2123](https://github.com/OmniSharp/omnisharp-roslyn/issues/2123), PR: [omnisharp-roslyn#2126](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2126))
  - Report back the solution filter name in workspace updated event (PR: [omnisharp-roslyn#2130](https://www.github.com/OmniSharp/omnisharp-roslyn/pull/2130))
- Debugger changes:
  - Added support for osx-arm64 debugging ([#4390](https://github.com/OmniSharp/omnisharp-vscode/issues/4390))
  - Added support for exception conditions. See [documentation](https://aka.ms/VSCode-CS-ExceptionSettings) for more information ([#4356](https://github.com/OmniSharp/omnisharp-vscode/issues/4356)).
  - Fixed an issue with character encoding for multi-byte characters written to the debug console ([#4398](https://github.com/OmniSharp/omnisharp-vscode/issues/4398))
- Fixed a bug where Blazor WASM debugging would fail to launch correctly ([dotnet/aspnetcore#31653](https://github.com/dotnet/aspnetcore/issues/31653))

## What's new in 1.23.11
- Move the global Mono check to the correct place ([#4489](https://github.com/OmniSharp/omnisharp-vscode/issues/4489), PR: [#4492](https://github.com/OmniSharp/omnisharp-vscode/pull/4492))

## What's new in 1.23.10
- Support solution filters (*.slnf) (PR: [#4481](https://github.com/OmniSharp/omnisharp-vscode/pull/4481))
- Prompt user to install Blazor WASM companion extension if needed (PR: [#4392](https://github.com/OmniSharp/omnisharp-vscode/pull/4392))
- Add path to dotnet so child processes can use the CLI (PR: [#4459](https://github.com/OmniSharp/omnisharp-vscode/pull/4459))
- Give more information when Mono is missing or invalid. ([#4428](https://github.com/OmniSharp/omnisharp-vscode/issues/4428), PR: [#4431](https://github.com/OmniSharp/omnisharp-vscode/pull/4431))
- Revert incremental change forwarding (PR: [#4477](https://github.com/OmniSharp/omnisharp-vscode/pull/4477))
- Fixes to asset generation (PR: [#4402](https://github.com/OmniSharp/omnisharp-vscode/pull/4402))
- Add properties to blazorwasm debug configuration. ([dotnet/aspnetcore#30977](https://github.com/dotnet/aspnetcore/issues/30977), PR: i[#4445](https://github.com/OmniSharp/omnisharp-vscode/pull/4445))
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
