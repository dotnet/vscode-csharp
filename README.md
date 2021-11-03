## C# for Visual Studio Code (powered by OmniSharp)

Welcome to the C# extension for Visual Studio Code! This extension provides the following features inside VS Code:

* Lightweight development tools for [.NET Core](https://dotnet.github.io).
* Great C# editing support, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.
* Debugging support for .NET Core (CoreCLR). NOTE: Mono debugging is not supported. Desktop CLR debugging has [limited support](https://github.com/OmniSharp/omnisharp-vscode/wiki/Desktop-.NET-Framework).
* Support for project.json and csproj projects on Windows, macOS and Linux.

The C# extension is powered by [OmniSharp](https://github.com/OmniSharp/omnisharp-roslyn).

### Get Started Writing C# in VS Code

* [Documentation](https://code.visualstudio.com/docs/languages/csharp)
* [Video Tutorial compiling with .NET Core](https://channel9.msdn.com/Blogs/dotnet/Get-started-VSCode-Csharp-NET-Core-Windows)

## Note about using .NET Core 3.1.40x SDKs

The .NET 3.1.40x SDKs require version 16.7 of MSBuild.

For MacOS and Linux users who have Mono installed, this means you will need to set `omnisharp.useGlobalMono` to `never` until a version of Mono ships with MSBuild 16.7.

## Note about using .NET 5 SDKs

The .NET 5 SDK requires version 16.8 of MSBuild.

For Windows users who have Visual Studio installed, this means you will need to be on the latest Visual Studio 16.8 Preview.
For MacOS and Linux users who have Mono installed, this means you will need to set `omnisharp.useGlobalMono` to `never` until a version of Mono ships with MSBuild 16.8.

## What's new in 1.23.17
* Greatly improved download experience: when the C# extension is downloaded from the VS Code Marketplace, it will include all of its dependencies already ([#4775](https://github.com/OmniSharp/omnisharp-vscode/issues/4775))
* Fix decompilation authorization check ([#4817](https://github.com/OmniSharp/omnisharp-vscode/issues/4817), PR: [#4821](https://github.com/OmniSharp/omnisharp-vscode/pull/4821))
* Fix typo in Readme.md (PR: [#4819](https://github.com/OmniSharp/omnisharp-vscode/pull/4819))
* Fix indentation level and spacing for xUnit fact snippet. (PR: [#4831](https://github.com/OmniSharp/omnisharp-vscode/pull/4831))
* Support relative paths with omnisharp.testRunSettings (PR: [#4860](https://github.com/OmniSharp/omnisharp-vscode/pull/4860)) (PR: [#4849](https://github.com/OmniSharp/omnisharp-vscode/pull/4849))
* Add `CimAttachItemsProvider` to replace `WmicAttachItemsProvider` (PR: [#4848](https://github.com/OmniSharp/omnisharp-vscode/pull/4848))       
* Enhance sourceFileMap documentation (PR: [#4844](https://github.com/OmniSharp/omnisharp-vscode/pull/4844))
* Update the indentation level and spacing for the '"xUnit Test" fact' snippet. (PR: [#4831](https://github.com/OmniSharp/omnisharp-vscode/pull/4831))

* Debugger changes:
  * The debugger itself runs on .NET 6 RC2
  * Enhanced support for launchSettings.json ([#3121](https://github.com/OmniSharp/omnisharp-vscode/issues/3121))
  * Fixed process listing on Windows 11 (PR: [#4848](https://github.com/OmniSharp/omnisharp-vscode/pull/4848)) _(Many thanks to [@eternalphane](https://github.com/eternalphane))_
  * Update debugger to 1.23.17 (PR: [#4855](https://github.com/OmniSharp/omnisharp-vscode/pull/4855))
  * Update Debugger Labels (PR: [#4798](https://github.com/OmniSharp/omnisharp-vscode/pull/4798))
  * Add Debug Welcome View (PR: [#4797](https://github.com/OmniSharp/omnisharp-vscode/pull/4797))

* Update OmniSharp version to 1.37.17:
  * Update versions to match dotnet SDK 6.0.1xx (PR: [omnisharp-roslyn#2262](https://github.com/OmniSharp/omnisharp-roslyn/pull/2262))
  * Remove all completion commit characters in suggestion mode. ([omnisharp-roslyn#1974](https://github.com/OmniSharp/omnisharp-vscode/issues/1974), [omnisharp-roslyn#3219](https://github.com/OmniSharp/omnisharp-vscode/issues/3219), [omnisharp-roslyn#3647](https://github.com/OmniSharp/omnisharp-vscode/issues/3647), [omnisharp-roslyn#4833](https://github.com/OmniSharp/omnisharp-vscode/issues/4833), PR: [omnisharp-roslyn#2253](https://github.com/OmniSharp/omnisharp-roslyn/pull/2253))
  * fixed logging interpolation in ProjectManager (PR: [omnisharp-roslyn#2246](https://github.com/OmniSharp/omnisharp-roslyn/pull/2246))
  * Support signature help for implicit object creation ([omnisharp-roslyn#2243](https://github.com/OmniSharp/omnisharp-roslyn/issues/2243), PR: [omnisharp-roslyn#2244](https://github.com/OmniSharp/omnisharp-roslyn/pull/2244))
  * Implement /v2/gotodefinition for Cake ([omnisharp-roslyn#2209](https://github.com/OmniSharp/omnisharp-roslyn/issues/2209), PR: [omnisharp-roslyn#2212](https://github.com/OmniSharp/omnisharp-roslyn/pull/2212))

## What's new in 1.23.16
* Show decompilation authorization once per install. ([#3982](https://github.com/OmniSharp/omnisharp-vscode/issues/3982), PR: [#4760](https://github.com/OmniSharp/omnisharp-vscode/pull/4760))
* Launch with first Folder or Solution target found (PR: [#4780](https://github.com/OmniSharp/omnisharp-vscode/pull/4780))
* Update Debugger Labels (PR: [#4798](https://github.com/OmniSharp/omnisharp-vscode/pull/4798))
* Add Debug Welcome View (PR: [#4797](https://github.com/OmniSharp/omnisharp-vscode/pull/4797))
* Update OmniSharp version to 1.37.16:
  * Update included Build Tools to match .NET SDK 6 (PR: [omnisharp-roslyn#2239](https://github.com/OmniSharp/omnisharp-roslyn/pull/2239))
  * Add Custom .NET CLI support to OmniSharp (PR: [omnisharp-roslyn#2227](https://github.com/OmniSharp/omnisharp-roslyn/pull/2227))
  * Handle .editorconfig changes without running a new design time build ([omnisharp-roslyn#2112](https://github.com/OmniSharp/omnisharp-roslyn/issues/2112) PR: [omnisharp-roslyn#2234](https://github.com/OmniSharp/omnisharp-roslyn/pull/2234))
  * Do not return nulls when getting documents by path ([omnisharp-roslyn#2125](https://github.com/OmniSharp/omnisharp-roslyn/issues/2125) PR: [omnisharp-roslyn#2233](https://github.com/OmniSharp/omnisharp-roslyn/pull/2233))
  * handle RecordStructName in semantic highlighting classification ([omnisharp-roslyn#2228](https://github.com/OmniSharp/omnisharp-roslyn/issues/2228) PR: [omnisharp-roslyn#2232](https://github.com/OmniSharp/omnisharp-roslyn/pull/2232))
  * Update CodeStructureService with FileScoped Namespace support ([omnisharp-roslyn#2225](https://github.com/OmniSharp/omnisharp-roslyn/issues/2225) PR: [omnisharp-roslyn#2226](https://github.com/OmniSharp/omnisharp-roslyn/pull/2226))

## What's new in 1.23.15
* Restore launch target for workspace root when no solution present ([#4691](https://github.com/OmniSharp/omnisharp-vscode/issues/4691), PR: [#4695](https://github.com/OmniSharp/omnisharp-vscode/pull/4695))
* Don't create launch.json for no select process ([omnisharp-roslyn#4696](https://github.com/OmniSharp/omnisharp-roslyn/issues/4696), PR: [#4699](https://github.com/OmniSharp/omnisharp-vscode/pull/4699))
* Support inserting outside code when texts are selected (PR: [#4715](https://github.com/OmniSharp/omnisharp-vscode/pull/4715))
* Fix autoFix on save ([#4401](https://github.com/OmniSharp/omnisharp-roslyn/issues/4401), PR: [#4717](https://github.com/OmniSharp/omnisharp-vscode/pull/4717))

* Update OmniSharp version to 1.37.15:
    * Update Roslyn to 4.0.0-4.21427.11 (PR: [omnisharp-roslyn#2220](https://github.com/OmniSharp/omnisharp-roslyn/pull/2220))
    * Update NuGet to 5.10.0 ([omnisharp-roslyn#2027](https://github.com/OmniSharp/omnisharp-roslyn/issues/2027), PR: [omnisharp-roslyn#2034](https://github.com/OmniSharp/omnisharp-roslyn/pull/2034))
    * Remove .NET Core 2.1 (PR: [omnisharp-roslyn#2219](https://github.com/OmniSharp/omnisharp-roslyn/pull/2219))
    * Update versions to match .NET SDK 6 RC1 (PR: [omnisharp-roslyn#2217](https://github.com/OmniSharp/omnisharp-roslyn/pull/2217))
    * Use FullPaths for Locations that are returned with relative paths. ([omnisharp-roslyn#2215](https://github.com/OmniSharp/omnisharp-roslyn/issues/2215), PR: [omnisharp-roslyn#2216](https://github.com/OmniSharp/omnisharp-roslyn/pull/2216))
    * Improved logging in project manager (PR: [omnisharp-roslyn#2203](https://github.com/OmniSharp/omnisharp-roslyn/pull/2203))
    * Log a warning when external features path has no assemblies ([omnisharp-roslyn#2201](https://github.com/OmniSharp/omnisharp-roslyn/issues/2201), PR: [omnisharp-roslyn#2202](https://github.com/OmniSharp/omnisharp-roslyn/pull/2202))

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

Currently, the C# debugger officially supports the following operating systems:

* X64 operating systems:
    * Windows 7 SP1 and newer
    * macOS 10.12 (Sierra) and newer
    * Linux: see [.NET Core documentation](https://github.com/dotnet/core/blob/master/release-notes/2.2/2.2-supported-os.md#linux) for the list of supported distributions. Note that other Linux distributions will likely work as well as long as they include glibc and OpenSSL.
* ARM operating systems:
    * Linux is supported as a remote debugging target

### Found a Bug?

To file a new issue to include all the related config information directly from vscode by entering the command pallette with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on macOS) and running `CSharp: Report an issue` command. This will open a browser window with all the necessary information related to the installed extensions, dotnet version, mono version, etc. Enter all the remaining information and hit submit. More information can be found on the [wiki](https://github.com/OmniSharp/omnisharp-vscode/wiki/Reporting-Issues).

Alternatively you could visit https://github.com/OmniSharp/omnisharp-vscode/issues and file a new one.

### Development

First install:

* Node.js (8.11.1 or later)
* Npm (5.6.0 or later)

To **run and develop** do the following:

* Run `npm i`
* Run `npm run compile`
* Open in Visual Studio Code (`code .`)
* _Optional:_ run `npm run watch`, make code changes
* Press <kbd>F5</kbd> to debug

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
