### Introduction

On both ARM64 Windows and ARM64 macOS, it is possible to run .NET code in an x64 process. This page provides instructions on how to do so.

### Steps

1. Install the ARM64 version of the .NET SDK so that the Language Service can be fully functional
2. Obtain an x64 version of the .NET Runtime for the target process to run on top of. This can either be installed as the shared framework (see [downloads](https://dotnet.microsoft.com/en-us/download/dotnet)), or you could change build tasks to publish the target app as a self-contained application (see [documentation](https://learn.microsoft.com/en-us/dotnet/core/deploying/#publish-self-contained)).
3. Install the C# Extension, and optionally, the C# Dev Kit
4. Open a folder containing code you would like to debug.
5. If you don't already have a launch.json, generate one by opening the VS Code command pallet (press F1) and run ".NET: Generate Assets for Build and Debug"
5. Open your .vscode/launch.json file
6. You should see the path to your project's dll file in `program`. Move that to the first element of the args array.
Change program to be the path to the x64 dotnet executable (example: /usr/local/share/dotnet/x64/dotnet). If your project is hosted in some sort of other executable, you could also use that.
7. Add `"targetArchitecture": "x86_64"`

Example launch.json configuration:
```jsonc
        {
            // Use IntelliSense to find out which attributes exist for C# debugging
            // Use hover for the description of the existing attributes
            // For further information visit https://github.com/dotnet/vscode-csharp/blob/main/debugger-launchjson.md
            "name": ".NET Core Launch (console)",
            "type": "coreclr",
            "request": "launch",
            "preLaunchTask": "build",
            "cwd": "${workspaceFolder}",
            "program": "/usr/local/share/dotnet/x64/dotnet",
            "args": "${workspaceFolder}/bin/Debug/net8.0/ExampleProject.dll",
            "targetArchitecture": "x86_64"
        }
```