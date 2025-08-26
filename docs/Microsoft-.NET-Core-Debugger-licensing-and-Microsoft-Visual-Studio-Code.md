This Wiki page contains information for the following error:

> .NET Debugging is supported only in Microsoft versions of VS Code. See https://aka.ms/VSCode-DotNet-DbgLicense for more information.

## What does this error mean?

The C# extension for Visual Studio Code includes the Microsoft .NET Core Debugger (vsdbg). Unlike VS Code, and most other parts of the .NET Core ecosystem, vsdbg is not an open source product but rather is a proprietary part of Visual Studio. It is licensed to work only with IDEs from Microsoft -- Visual Studio Code, Visual Studio, or Visual Studio for Mac. Visual Studio Code has an official version distributed by Microsoft but it is also an open source project, so anyone can build and distribute their own version. The C# extension itself along with the C# and Razor language services will work correctly with a VS Code distribution based on the OSS project. However, the debugger is only licensed to work with the Microsoft-distributed version of Visual Studio Code.

## How to resolve the issue

If you installed the OSS version of VS Code, you can uninstall it and reinstall the Microsoft version from [https://code.visualstudio.com/download](https://code.visualstudio.com/download).

If you believe you have the Microsoft version installed and you are still seeing this problem, you can [open an issue](https://github.com/omnisharp/omnisharp-vscode/issues) in this repo.
