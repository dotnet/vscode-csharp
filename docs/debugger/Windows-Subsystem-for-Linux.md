With the Windows 10 Creators Update (Windows version 10.0.15063), you can use Visual Studio Code to debug .NET core applications on [Windows Subsystem for Linux (WSL)](https://msdn.microsoft.com/en-us/commandline/wsl/about).

This page will walk you through the steps required to debug a .NET core application on WSL.

## Prerequisites
* Windows 10 Creators Update or newer with [Windows Subsystem for Linux](https://msdn.microsoft.com/en-us/commandline/wsl/install_guide) and Bash installed.
* .NET Core on WSL
* Visual Studio Code 
* Microsoft C# extension for VSCode. 

Go to [.NET Core SDK Linux install instructions](https://dotnet.microsoft.com/learn/dotnet/hello-world-tutorial/install?initial-os=linux) for steps to install the .NET Core SDK into WSL. Change the 'Linux Distribution' drop down to the version you have installed.

## Install the debugger
You can download a copy of the debugger with:

```
sudo apt-get install unzip
curl -sSL https://aka.ms/getvsdbgsh | bash /dev/stdin -v latest -l ~/vsdbg
```

This will download and install the debugger at `~/vsdbg/vsdbg`. This will be used later as the `debuggerPath`.

## Configuring debugging

VS Code uses json files to configure how your application is debugged (both for launch and attach) as well as built. There are two files that we need to configure --
* \<your-open-folder\>/.vscode/launch.json: This provides an array of different configurations you can use to launch your application. There is a drop down in the Debug view for selecting which configuration is active.
* \<your-open-folder\>/.vscode/tasks.json: This provides an array of different tasks, like building your application, that you can execute. Debug configurations can link to one of these tasks through the `preLaunchTask` property.

The rest of this page will provide examples of how launch.json and tasks.json should be configured to support WSL.

## Sample launch.json configuration for launch

```json
        {
           "name": ".NET Core WSL Launch",
           "type": "coreclr",
           "request": "launch",
           "preLaunchTask": "publish",
           "program": "/mnt/c/temp/dotnetapps/wslApp/bin/publish/wslApp.dll",
           "args": [],
           "cwd": "/mnt/c/temp/dotnetapps/wslApp",
           "stopAtEntry": false,
           "console": "internalConsole",
           "pipeTransport": {
               "pipeCwd": "${workspaceRoot}",
               "pipeProgram": "bash.exe",
               "pipeArgs": [ "-c" ],
               "debuggerPath": "~/vsdbg/vsdbg"
           }
       }
```

## Sample 'publish' task for tasks.json (needed for launching)

```json
{
    "version": "2.0.0",
    "tasks": [
        ...,
        {
            "label": "publish",
            "command": "dotnet",
            "type": "process",
            "args": [
                "publish",
                "${workspaceFolder}/wslApp.csproj",
                "/property:GenerateFullPaths=true",
                "/consoleloggerparameters:NoSummary",
                "-o",
                "${workspaceFolder}/bin/publish"
            ]
        }
    ]
}
```

The sample application shown here was created in the Windows path `C:\temp\dotnetapps\wslApp`. WSL by default allows windows paths to be accessible through `/mnt/<driveletter>/<path>`, so the path above is accessible as `/mnt/c/temp/dotnetapps/wslApp` from WSL. 

Notes:
1. `preLaunchTask` executes ```dotnet publish```, which builds the project on Windows. Since coreclr is cross-platform, the binary can be executed on WSL without any extra work.
2. `pipeProgram` is set to bash.exe. 
3. `debuggerPath` points to vsdbg, the coreclr debugger.
4. This will not support programs that want to read from the console.

## Sample launch.json configuration for attach

```json
       {
           "name": ".NET Core WSL Attach",
           "type": "coreclr",
           "request": "attach",
           "processId": "${command:pickRemoteProcess}",
           "pipeTransport": {
               "pipeCwd": "${workspaceRoot}",
               "pipeProgram": "bash.exe",
               "pipeArgs": [ "-c" ],
               "debuggerPath": "~/vsdbg/vsdbg",
               "quoteArgs": true
           }
       }
```
Notes: 
1. `"processId": "${command:pickRemoteProcess}"` lists the processes running on WSL using the pipe program. 
2. `quoteArgs` will quote any arguments and debugger commands with spaces if set to `true`. 
3. Use `sourceFileMap` to map sources if they are available in a different location than where they were built. If you build your project in Linux, make sure to add a map from the /mnt drive letters. Example: `"sourceFileMap": { "/mnt/c/": "c:\\" }`
4. File and paths are case sensitive in Linux.

## Also see
[Configuring C# Launch.json](https://github.com/OmniSharp/omnisharp-vscode/blob/master/debugger-launchjson.md)

[C++ debugging in WSL with VSCode C++ Extensions.](https://github.com/Microsoft/vscode-cpptools/blob/master/Documentation/Debugger/gdb/Windows%20Subsystem%20for%20Linux.md)