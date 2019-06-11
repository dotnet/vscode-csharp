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

### What's new in 1.20.0

* Updated the auto-generated launch.json to use new mechanism for starting web browser. For more information: https://aka.ms/VSCode-CS-LaunchJson-WebBrowser
* Improved support for .NET Core 3
* Updates to Razor support
* Made QuickInfo display more consistent with Visual Studio. ([#2610](https://github.com/OmniSharp/omnisharp-vscode/issues/2610))  (_Contributed by_ [@paladique](https://github.com/paladique))(PR: [#3090](https://github.com/OmniSharp/omnisharp-vscode/pull/3090/))
* Added support for fading unnecessary code and using statements [#2873](https://github.com/OmniSharp/omnisharp-vscode/pull/2873)

### What's new in 1.19.1

* Updated debugger to work correctly on Linux distributions with openssl 1.1 such as Ubuntu 19.04.
* Fixed OmniSharp hanging on wildcard Nuget package references.
* OmniSharp now uses correct 4.7.2 framework sku to prompt for installation of .NET 4.7.2 if missing.

### What's new in 1.19.0

* Improved support for .NET Core 3
* Added support for roslyn analyzers, code fixes and rulesets which can be enabled via`omnisharp.enableRoslynAnalyzers` setting.
* Improved Razor diagnostics
* Razor tooling support for tag helpers

See our [change log](https://github.com/OmniSharp/omnisharp-vscode/blob/v1.19.1/CHANGELOG.md) for more detail.

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
