## C# for Visual Studio Code (powered by OmniSharp)

|Master|Release|
|:--:|:--:|
|[![Master Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=master)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|[![Release Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=release)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|

Welcome to the C# extension for Visual Studio Code! This preview provides the following features inside VS Code:

* Lightweight development tools for [.NET Core](https://dotnet.github.io).
* Great C# editing support, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.
* Debugging support for .NET Core (CoreCLR). NOTE: Mono and Desktop CLR debugging is not supported.
* Support for project.json and csproj projects on Windows, macOS and Linux.

The C# extension is powered by [OmniSharp](https://github.com/OmniSharp/omnisharp-roslyn).

### Get Started Writing C# in VS Code

* [Documentation](https://code.visualstudio.com/docs/languages/csharp)
* [Video Tutorial compiling with .NET Core](https://channel9.msdn.com/Blogs/dotnet/Get-started-with-VS-Code-using-CSharp-and-NET-Core)

### What's New in 1.6.0

* Better support for .NET Core .csproj projects, including .NET Core projects created with [Visual Studio 2017 RC](https://www.visualstudio.com/vs/visual-studio-2017-rc/).
* Improved debugger performance and support for debugging on more Linux distros.
* Roslyn scripting support with CSX files.
* Lot's more!

See our [change log](https://github.com/OmniSharp/omnisharp-vscode/blob/master/CHANGELOG.md) for all of the updates.

### Supported Operating Systems for Debugging

* Currently, the C# debugger supports the following operatings systems:

  * Windows (64-bit only)
  * macOS
  * Ubuntu 14.04 / Linux Mint 17 / Linux Mint 18 / Elementary OS 0.3
  * Ubuntu 16.04 / Elementary OS 0.4 / Arch
  * Ubuntu 16.10
  * Debian 8.2
  * CentOS 7.1 / Oracle Linux 7
  * Red Hat Enterprise Linux (RHEL)
  * Fedora 23 / 24
  * OpenSUSE 13 / 42

### Found a Bug?
Please file any issues at https://github.com/OmniSharp/omnisharp-vscode/issues.

### Debugging
The C# extension now supports basic debugging capabilities! See http://aka.ms/vscclrdebugger for details.

### Development

First install:
* Node.js (newer than 4.3.1)
* Npm (newer 2.14.12)

In case you get a *node-gyp* error [follow the instrutions here](https://github.com/nodejs/node-gyp/blob/master/README.md) to fix it. The *vscode-textmate* package pulls in a native node dependency and those instructions will set up the node build tool which deals with those.

To **run and develop** do the following:

* Run `npm i`
* Run `npm run compile`
* Open in Visual Studio Code (`code .`)
* *Optional:* run `tsc -w`, make code changes (on Windows, try `start node ".\node_modules\typescript\bin\tsc -w"`)
* Press <kbd>F5</kbd> to debug

To **test** do the following: `npm run test`

### License
The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).
The source code to this extension is available on [https://github.com/OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) and licensed under the [MIT license](LICENSE.txt).
