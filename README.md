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

### **Important!** Breaking Changes as of 1.0.10

* The C# extension now only supports [.NET Core RC2](https://blogs.msdn.microsoft.com/dotnet/2016/05/16/announcing-net-core-rc2/). It no longer supports .NET Core RC1 or ASP .NET 5 RC1.
* **Support for .csproj projects has been temporarily disabled on OS X and Linux.** This will impact anyone doing .csproj development on OS X or Linux (e.g. Unity, Xamarin, etc.). Rest assured that this will be restored in the near future. However, for now, you can use the [Legacy C# Support extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.omnisharp).

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
