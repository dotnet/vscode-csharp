## C# for Visual Studio Code (powered by OmniSharp)

|Master|Release|
|:--:|:--:|
|[![Master Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=master)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|[![Release Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=release)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|

[![Wallaby.js](https://img.shields.io/badge/wallaby.js-configured-green.svg)](https://wallabyjs.com)

Welcome to the C# extension for Visual Studio Code! This extension provides the following features inside VS Code:

* Lightweight development tools for [.NET Core](https://dotnet.github.io).
* Great C# editing support, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.
* Debugging support for .NET Core (CoreCLR). NOTE: Mono debugging is not supported. Desktop CLR debugging has [limited support](https://github.com/OmniSharp/omnisharp-vscode/wiki/Desktop-.NET-Framework).
* Support for project.json and csproj projects on Windows, macOS and Linux.

The C# extension is powered by [OmniSharp](https://github.com/OmniSharp/omnisharp-roslyn).

### Get Started Writing C# in VS Code

* [Documentation](https://code.visualstudio.com/docs/languages/csharp)
* [Video Tutorial compiling with .NET Core](https://channel9.msdn.com/Blogs/dotnet/Get-started-VSCode-Csharp-NET-Core-Windows)

## What's new in 1.21.15
* Fixed freezing and unresponsiveness when opening folder with many nested sub-folders (PR: [#3681](https://github.com/OmniSharp/omnisharp-vscode/pull/3681))
* Fixed handling of dismiss response to assets prompt (PR: [3678](https://github.com/OmniSharp/omnisharp-vscode/pull/3678))

## What's new in 1.21.14
* Fixed an issue where Razor formatting fails in the presence of @using directives
* Added support for `annotations` value of `Nullable` csproj property ([omnisharp-roslyn/#1721](https://github.com/OmniSharp/omnisharp-roslyn/issues/1721), PR: [omnisharp-roslyn/#1722](https://github.com/OmniSharp/omnisharp-roslyn/pull/1722))
* Added ability to specify custom RunSettings for tests (PR: [#3573](https://github.com/OmniSharp/omnisharp-vscode/pull/3573), PR: [omnisharp-roslyn/#1710](https://github.com/OmniSharp/omnisharp-roslyn/pull/1710))

## What's new in 1.21.13
* Change Marketplace publisher for the C# extension from ms-vscode to ms-dotnettools
* Ignore diagnostics from virtual files ([aspnetcore/#18927](https://github.com/dotnet/aspnetcore/issues/18927), PR: [#3592](https://github.com/OmniSharp/omnisharp-vscode/pull/3592))
* Detect and create Blazor WASM launch and debug settings ([aspnetcore/#17549](https://github.com/dotnet/aspnetcore/issues/17549), PR: [#3593](https://github.com/OmniSharp/omnisharp-vscode/pull/3593))
* Updated Razor support (PR:[3594](https://github.com/OmniSharp/omnisharp-vscode/pull/3594))
  * Support for @code/@functions block formatting
  * Updated Razor's TextMate grammar to include full syntactic colorization
  * Several bug fixes

## What's new in 1.21.12
* Fixed out of bounds exception in line mapping ([#3485](https://github.com/OmniSharp/omnisharp-vscode/issues/3485), PR: [omnisharp-roslyn/#1707](https://github.com/OmniSharp/omnisharp-roslyn/pull/1707))
* Added support for aliases in project references ([omnisharp-roslyn/#1685](https://github.com/OmniSharp/omnisharp-roslyn/issues/1685), PR: [omnisharp-roslyn/#1701](https://github.com/OmniSharp/omnisharp-roslyn/pull/1701))
* Raised the lowest discovered VS2019 version to 16.3 ([omnisharp-roslyn/#1700](https://github.com/OmniSharp/omnisharp-roslyn/issues/1700), PR: (#1713)(https://github.com/OmniSharp/omnisharp-roslyn/pull/1713))
* Fixed a bug where organizing usings clashed with other formatting settings (PR: [omnisharp-roslyn/#1715](https://github.com/OmniSharp/omnisharp-roslyn/pull/1713))

## What's new in 1.21.11
* Updated the bundled to Mono 6.8.0 and MSBuild to be copied from Mono 6.8.0 ([omnisharp-roslyn/#1693](https://github.com/OmniSharp/omnisharp-roslyn/issues/1693), PR: [omnisharp-roslyn/#1697](https://github.com/OmniSharp/omnisharp-roslyn/pull/1697))
* Included NugetSDKResolver in the minimal MSBuild, which introduces support for Nuget based project SDKs like Arcade ([omnisharp-roslyn/#1678](https://github.com/OmniSharp/omnisharp-roslyn/issues/1678), PR: [omnisharp-roslyn/#1696](https://github.com/OmniSharp/omnisharp-roslyn/pull/1696))
* Added option (`csharp.supressBuildAssetsNotification`) to surpress missing build asset notifications (PR:[#3538](https://github.com/OmniSharp/omnisharp-vscode/pull/3538))
* The minimum Mono version required to run OmniSharp on has been increased to 6.4.0

### Supported Operating Systems for Debugging

* Currently, the C# debugger officially supports the following operating systems:

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
* *Optional:* run `npm run watch`, make code changes
* Press <kbd>F5</kbd> to debug

To **test** do the following: `npm run test` or <kbd>F5</kbd> in VS Code with the "Launch Tests" debug configuration.

### License
The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).
The source code to this extension is available on [https://github.com/OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) and licensed under the [MIT license](LICENSE.txt).
