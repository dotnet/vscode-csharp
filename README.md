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

## Using .NET 6 builds of OmniSharp

Starting with C# extension version 1.24.0, there is now an option to use build of OmniSharp that runs on the .NET 6 SDK. This build requires that the .NET 6 SDK be installed and does not use Visual Studio MSBuild tools or Mono. It only supports newer SDK-style projects that are buildable with `dotnet build`. Unity projects and other Full Framework projects are not supported.

To use the .NET 6 build, set `omnisharp.useModernNet` to `true` in your VS Code settings and restart OmniSharp.

## Note about using .NET Core 3.1.4xx SDKs

The .NET 3.1.4xx SDKs require version 16.7 of MSBuild.

For MacOS and Linux users who have Mono installed, this means you will need to set `omnisharp.useGlobalMono` to `never` until a version of Mono ships with MSBuild 16.7.

You can also use the .NET 6 build of OmniSharp which runs on the .NET 6 SDK. See instructions above.

## Note about using .NET 5 SDKs

The .NET 5 SDK requires version 16.8 of MSBuild.

For Windows users who have Visual Studio installed, this means you will need to be on the latest Visual Studio 16.8 Preview.

For MacOS and Linux users who have Mono installed, this means you will need to set `omnisharp.useGlobalMono` to `never` until a version of Mono ships with MSBuild 16.8.

You can also use the .NET 6 build of OmniSharp which runs on the .NET 6 SDK. See instructions above.

## Note about using .NET 6 SDKs

The .NET 6 SDK requires version 16.10 of MSBuild.

For Windows users who have Visual Studio installed, this means you will need to have Visual Studio 16.11 or newer installed.

For MacOS and Linux users who have Mono installed, this means you will need to set `omnisharp.useGlobalMono` to `never` until a version of Mono ships with MSBuild 16.10.

You can also use the .NET 6 build of OmniSharp which runs on the .NET 6 SDK. See instructions above.

## What's new in 1.24.1
* Only semantically highlight documents from uri.scheme 'file' (PR: [#5059](https://github.com/OmniSharp/omnisharp-vscode/pull/5059))
* Filter packages to install by framework before attempting install ([#5032](https://github.com/OmniSharp/omnisharp-vscode/issues/5032), PR: [#5041](https://github.com/OmniSharp/omnisharp-vscode/pull/5041))
* Update Razor's TextMate to latest. (PR: [#5012](https://github.com/OmniSharp/omnisharp-vscode/pull/5012))
* Upgrade OmniSharp to 1.38.1:
  * Reuse Roslyn's analyzer assembly loader (PR: [omnisharp-roslyn#2236](https://github.com/OmniSharp/omnisharp-roslyn/pull/2236))
  * Pass Completion, Rename and Block Structure options directly instead of updating the Workspace (PR: [omnisharp-roslyn#2306](https://github.com/OmniSharp/omnisharp-roslyn/pull/2306))
  * Update included build tool to match the current 6.0.200 sdk (PR: [omnisharp-roslyn#2329](https://github.com/OmniSharp/omnisharp-roslyn/pull/2329))
  * Fix concurrency issue in CSharpDiagnosticWorker (PR: [omnisharp-roslyn#2333](https://github.com/OmniSharp/omnisharp-roslyn/pull/2333))
  * run analyzers on multiple threads if allowed to (PR: [omnisharp-roslyn#2285](https://github.com/OmniSharp/omnisharp-roslyn/pull/2285))
  * Add MSBuild project to solution and apply the change to Roslyn workspace as a unit (PR: [omnisharp-roslyn#2314](https://github.com/OmniSharp/omnisharp-roslyn/pull/2314))
  * Updated to Roslyn 4.0.1 (PR: [omnisharp-roslyn#2323](https://github.com/OmniSharp/omnisharp-roslyn/pull/2323))
  * Enable OmniSharp.Cake tests for .NET 6 (PR: [omnisharp-roslyn#2307](https://github.com/OmniSharp/omnisharp-roslyn/pull/2307))
  * Handle completions with trailing whitespace on previous lines (PR: [omnisharp-roslyn#2319](https://github.com/OmniSharp/omnisharp-roslyn/pull/2319))
  * Update build bools to match .NET SDK 6.0.200 (PR: [omnisharp-roslyn#2347](https://github.com/OmniSharp/omnisharp-roslyn/pull/2347))

## What's new in 1.24.0
* Upgrade OmniSharp to 1.38.0 (PR: [#4961](https://github.com/OmniSharp/omnisharp-vscode/issues/4961))
  * Build OmniSharp servers that run on .NET 6 SDK (PR: [omnisharp-roslyn#2291](https://github.com/OmniSharp/omnisharp-roslyn/pull/2291))
  * Allow net6 build of O# to load newer .NET SDKs (PR: [omnisharp-roslyn#2308](https://github.com/OmniSharp/omnisharp-roslyn/pull/2308))
  * Allow alternate versions of documents to be Semantically Highlighted (PR: [omnisharp-roslyn#2304](https://github.com/OmniSharp/omnisharp-roslyn/pull/2304))
  * Pass the logger for loading projects. So errors occur in loading projects can be printed out. ([#4832](https://github.com/OmniSharp/omnisharp-vscode/issues/4832), PR: [omnisharp-roslyn#2288](https://github.com/OmniSharp/omnisharp-roslyn/pull/2288))
  * Update OmniSharp.Cake dependencies (PR: [omnisharp-roslyn#2280](https://github.com/OmniSharp/omnisharp-roslyn/pull/2280))
  * Ensure each published platform uses matching hostfxr library (PR: [omnisharp-roslyn#2272](https://github.com/OmniSharp/omnisharp-roslyn/pull/2272))
  * Produce an Arm64 build for Linux (PR: [omnisharp-roslyn#2271](https://github.com/OmniSharp/omnisharp-roslyn/pull/2271))
  * Use 6.0.100 SDK for building (PR: [omnisharp-roslyn#2269](https://github.com/OmniSharp/omnisharp-roslyn/pull/2269))
  * Added Code of Conduct (PR: [omnisharp-roslyn#2266](https://github.com/OmniSharp/omnisharp-roslyn/pull/2266))
  * Improved Cake/CSX info messages (PR: [omnisharp-roslyn#2264](https://github.com/OmniSharp/omnisharp-roslyn/pull/2264))
* Send document buffer when semantically highlighting old document versions (PR: [#4915](https://github.com/OmniSharp/omnisharp-vscode/pull/4915))
* Improved Regex syntax highlighting (PR: [#4902](https://github.com/OmniSharp/omnisharp-vscode/pull/4902))
* .NET 6 bug fixes ([#4931](https://github.com/OmniSharp/omnisharp-vscode/issues/4931), PR: [#4950](https://github.com/OmniSharp/omnisharp-vscode/pull/4950))
* Add File-scoped namespace snippet (PR: [#4948](https://github.com/OmniSharp/omnisharp-vscode/pull/4948))
* Add searchNuGetOrgSymbolServer documentation (PR: [#4939](https://github.com/OmniSharp/omnisharp-vscode/pull/4939))
* Fix 'watch' Task (PR: [#4932](https://github.com/OmniSharp/omnisharp-vscode/pull/4932))
* Support using .NET 6 OmniSharp (PR: [#4926](https://github.com/OmniSharp/omnisharp-vscode/pull/4926))
* Rename LaunchTarget.kind to not conflict with VSCode separators. ([#4907](https://github.com/OmniSharp/omnisharp-vscode/issues/4907), PR: [#4914](https://github.com/OmniSharp/omnisharp-vscode/pull/4914))
* Label optional dependencies as external (PR: [#4905](https://github.com/OmniSharp/omnisharp-vscode/pull/4905))
* Provide a friendly name for the Razor language (PR: [#4904](https://github.com/OmniSharp/omnisharp-vscode/pull/4904))
* Update Debugger to 1.23.19 (PR: [4899](https://github.com/OmniSharp/omnisharp-vscode/pull/4899))
* Add targetArch to Attach and documentation ([#4900](https://github.com/OmniSharp/omnisharp-vscode/pull/4900), PR: [#4901](https://github.com/OmniSharp/omnisharp-vscode/pull/4901))
* Allow Linux Arm64 users to run the experimental O# build (PR: [#4892](https://github.com/OmniSharp/omnisharp-vscode/pull/4892))
* Always send document text when Semantic Highlighting (PR: [#5003](https://github.com/OmniSharp/omnisharp-vscode/pull/5003))
* Remove obsolete settings checks for Blazor debugging (PR: [#4964](https://github.com/OmniSharp/omnisharp-vscode/pull/4964))
* Explicitly install vscode-nls as a dependency (PR: [#4980](https://github.com/OmniSharp/omnisharp-vscode/pull/4980))
* Modernize code action provider (PR: [#4988](https://github.com/OmniSharp/omnisharp-vscode/pull/4988))
* Fix OmnisharpDownloader tests (PR: [#4989](https://github.com/OmniSharp/omnisharp-vscode/pull/4989))

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
