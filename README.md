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

### What's New in 1.5.2

* Ensure diagnostics are cleared in files when they are no longer needed. ([#858](https://github.com/OmniSharp/omnisharp-vscode/issues/858))
* Enqueue requests for diagnostics in visible editors when the extension starts up. ([#843](https://github.com/OmniSharp/omnisharp-vscode/issues/843))
* Provide fallback URLs for debugger downloads. ([#930](https://github.com/OmniSharp/omnisharp-vscode/issues/930))
* Properly require .NET Framework 4.6 in the OmniSharp.exe.config file to ensure that the user is displayed a dialog on Windows machines that don't have .NET Framework 4.6 installed. ([#937](https://github.com/OmniSharp/omnisharp-vscode/issues/937))  
* Fix issue with installing on non-English installations of Windows. ([#938](https://github.com/OmniSharp/omnisharp-vscode/issues/938))
* Display platform information when acquiring runtime dependencies. ([#948](https://github.com/OmniSharp/omnisharp-vscode/issues/948))

### What's New in 1.5.1

* Fix to properly support `http.proxy` and `http.proxyStrictSSL` settings. ([#930](https://github.com/OmniSharp/omnisharp-vscode/issues/930))

### What's New in 1.5

#### Initial support for C# 7

* New C# 7 features like pattern-matching and tuples are now supported in VS Code editor. Note: To use tuples, you will need a reference to [this NuGet package](https://www.nuget.org/packages/System.ValueTuple).

#### Initial support for CSProj .NET Core Projects

* With the .NET Core SDK moving to embrace MSBuild and .csproj files over project.json, we've made sure the C# extension can handle the new format. This support is preliminary and there are still several features coming to smooth out the experience.

#### Broader OS Support for C# Code Editing

* This release dramatically changes the runtime that OmniSharp runs on, which allows it to be run an many more operating systems than before:

  * Windows: OmniSharp runs on the installed .NET Framework. In addition, OmniSharp now runs on 32-bit Windows!
  * macOS/Linux: OmniSharp runs on a custom embedded Mono runtime. Note: Mono does not need to be installed on the system for this to work.

#### Debugger

* Remote debugging is now supported for attach by using the `pipeTransport` launch.json option.
* Resolved issue with setting breakpoints when there are multple files with the same name (e.g. two 'Program.cs' files).

#### New Dependency Acquisition System

* This improves the acquisition and reliability of platform-specific OmniSharp and debugger dependencies.

#### New Settings

Several new settings have been added:

* `csharp.suppressDotnetRestoreNotification`: Suppress the notification window to perform a 'dotnet restore' when dependencies can't be resolved.
* `omnisharp.projectLoadTimeout`: The time Visual Studio Code will wait for the OmniSharp server to start. Time is expressed in seconds. _(Contributed by [@wjk](https://github.com/wjk))_

#### Colorizer

* A new unit testing framework for testing the colorizer grammer ([#742](https://github.com/OmniSharp/omnisharp-vscode/pull/742)) _(Contributed by [@ivanz](https://github.com/ivanz))_
* Single-line comments after preprocessor directives ([#762](https://github.com/OmniSharp/omnisharp-vscode/pull/762)) _(Contributed by [@damieng](https://github.com/damieng))_

#### Performance

* Major improvements have been made to editor performance. The communication with the OmniSharp server has been rewritten to allow long-running operations (such as gathering all errors and warnings) to queue while high priority operations (such as text buffer changes) run serially. ([#902](https://github.com/OmniSharp/omnisharp-vscode/pull/902)) _(Thanks to [@david-driscoll](https://github.com/david-driscoll) for his help with this change!)_ 

#### Other Improvements

* The prompt to generate assets for building and debugging can now be dismissed for a workspace permanently. In addition, a new `dotnet.generateAssets` command has been added to force regeneration of the assets. ([#635](https://github.com/OmniSharp/omnisharp-vscode/issues/635))
* Fix "running forever" issue for folder with multple .NET Core projects. ([#735](https://github.com/OmniSharp/omnisharp-vscode/issues/735)) _(Contributed by [@eamodio](https://github.com/eamodio))_
* `ctor` snippet is now more consistent with other code snippets. ([#849](https://github.com/OmniSharp/omnisharp-vscode/pull/849)) _(Contibuted by [@Eibx](https://github.com/Eibx))_
* Ampersands in file paths are now properly escaped on Windows ([#909](https://github.com/OmniSharp/omnisharp-vscode/pull/909)) _(Contributed by [@filipw](https://github.com/filipw))_

### Supported Operating Systems for Debugging

* Currently, the C# debugger supports the following operatings systems:

  * Windows (64-bit only)
  * macOS
  * Ubuntu 14.04 / Linux Mint 17 / Linux Mint 18 / Elementary OS 0.3
  * Ubuntu 16.04 / Elementary OS 0.4
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
