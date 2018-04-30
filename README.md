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

### What's New in 1.14.0

* Support for C# 7.2
* Debugger support for extracting source files embedded in PDBs
* Preliminary support for Linux ARM debugging
* Improved Symbol/Documentation text display
* Addressed problems with projects not being refreshed by OmniSharp after a package restore
* Added option to disable warning about project.json deprecation
* Many other bug fixes!

See our [change log](https://github.com/OmniSharp/omnisharp-vscode/blob/v1.14.0/CHANGELOG.md) for all of the updates.

### Supported Operating Systems for Debugging

* Currently, the C# debugger officially supports the following operating systems:

  * Windows (64-bit only)
  * macOS 10.12 (Sierra) and newer
  * Ubuntu 14.04+ (and distros based on it)
  * Debian 8.7+
  * Red Hat Enterprise Linux (RHEL) / CentOS / Oracle Linux 7.3+
  * Fedora 23 / 24 / 25
  * OpenSUSE 42.2+

This list is currently the same as the x64 .NET Core 2.0 operating systems (see [.NET Core list](https://github.com/dotnet/core/blob/master/roadmap.md#net-core-20---supported-os-versions)). Note that other Linux distributions will likely work as well as long as they include glibc, OpenSSL 1.0, and libunwind.

### Found a Bug?
Please file any issues at https://github.com/OmniSharp/omnisharp-vscode/issues.

### Debugging
The C# extension now supports basic debugging capabilities! See http://aka.ms/vscclrdebugger for details.

### Development

First install:
* Node.js (newer than 4.3.1)
* Npm (newer 2.14.12)

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
