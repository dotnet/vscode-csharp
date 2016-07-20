## C# for Visual Studio Code (powered by OmniSharp)

|Master|Dev|
|:--:|:--:|
|[![Master Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=master)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|[![Dev Build Status](https://travis-ci.org/OmniSharp/omnisharp-vscode.svg?branch=dev)](https://travis-ci.org/OmniSharp/omnisharp-vscode)|

Welcome to the C# extension for Visual Studio Code! This preview provides the following features inside VS Code:

* Lightweight development tools for [.NET Core](https://dotnet.github.io).
* Great C# editing support, including Syntax Highlighting, IntelliSense, Go to Definition, Find All References, etc.
* Debugging support for .NET Core (CoreCLR). NOTE: Mono and Desktop CLR debugging is not supported.
* Support for project.json projects on Windows, OS X and Linux, and csproj projects on Windows.

The C# extension is powered by [OmniSharp](https://github.com/OmniSharp/omnisharp-roslyn).

### What's New in 1.3

* Support for Unity and Mono development on macOS and Linux has been restored! This release brings back support for the Mono version of OmniSharp, which is used to provide *much* better support for .csproj/.sln projects. Please note that Mono version 4.0.1 or newer is required.
* Generation of tasks.json and launch.json files can now properly handle nested projects. [#170](https://github.com/OmniSharp/omnisharp-vscode/issues/170)
* Duplicate warnings and errors should no longer accumulate in Unity projects [#447](https://github.com/OmniSharp/omnisharp-vscode/issues/447)

### Supported Operating Systems

* Currently, the C# extension supports the following operatings systems:
  * Windows (64-bit only)
  * macOS
  * Ubuntu 14.04 / Linux Mint 17
  * Ubuntu 16.04
  * Debian 8.2
  * CentOS 7.1 / Oracle Linux 7
  * Red Hat Enterprise Linux (RHEL)
  * Fedora 23
  * OpenSUSE 13.2

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
* Open in Visual Studio Code (`code .`)
* *Optional:* run `tsc -w`, make code changes (on Windows, try `start node ".\node_modules\typescript\bin\tsc -w"`)
* Press F5 to debug

### License
The Microsoft C# extension is subject to [these license terms](RuntimeLicenses/license.txt).  
The source code to this extension is available on [https://github.com/OmniSharp/omnisharp-vscode](https://github.com/OmniSharp/omnisharp-vscode) and licensed under the [MIT license](LICENSE.txt).  
