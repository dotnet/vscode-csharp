# Configurating launch.json for C# debugging
The launch.json file is used to configure the debugger in Visual Studio Code.

Visual Studio Code generates a launch.json with almost all of the required information. 
If your workspace has only one launchable project, the C# extension will offer to automatically generate this file. 
If you missed this prompt, you can force the generation by executing the command `.NET: Generate Assets for Build and Debug` from the VS Code command palette.
The generated file contains two sections. One that configures debugging for launch and a second that configures debugging for attach.

If you have more than one launchable project, then you will need to modify your launch.json file by hand. 
Visual Studio Code will still generate a basic template, but you will need to fill in the 'program' field to point at the executable dll that you would like to debug.


# Configurating VS Code's debugging behavior

## PreLaunchTask
The `preLaunchTask` field runs the associated taskName in tasks.json before debugging your program. You can get the default build prelaunch task by executing the command `Tasks: Configure Tasks Runner` from the VS Code command palette.

This will create a task that runs `dotnet build`. You can read more about tasks at [https://code.visualstudio.com/docs/editor/tasks](https://code.visualstudio.com/docs/editor/tasks).

## Program
The program field is set to the path of the application dll or .NET Core host executable to launch.

This property normally takes the form: "${workspaceFolder}/bin/Debug/\<target-framework\>/\<project-name.dll\>".

Example: `"${workspaceFolder}/bin/Debug/netcoreapp1.1/MyProject.dll"`

Where:

* \<target-framework\> is the framework that the debugged project is being built for. This is normally found in the project file as the 'TargetFramework' property.
* \<project-name.dll\> is the name of debugged project's build output dll. This is normally the same as the project file name but with a '.dll' extension.

## Cwd
The working directory of the target process.

## Args
These are the arguments that will be passed to your program.

## Stop at Entry
If you need to stop at the entry point of the target, you can optionally set `stopAtEntry` to be "true".

## Launch Browser
The launch browser field can be optionally added if you need to launch with a web browser.
If there are web server dependencies in your project.json, the auto generated launch file will add launch 
browser for you. It will open with the default program to handle URLs.

## Environment variables
Environment variables may be passed to your program using this schema:

    "env": {
        "myVariableName":"theValueGoesHere"
    }

## Console (terminal) window
By default, processes are launched with their console output (stdout/stderr) going to the VS Code Debugger Console. This is useful for executables that take their input from the network, files, etc. But this does NOT work for applications that want to read from the console (ex: `Console.ReadLine`). For these applications, use a setting such as the following:

    "console": "integratedTerminal"

When this is set to `integratedTerminal` the target process will run inside [VS Code's integrated terminal](https://code.visualstudio.com/docs/editor/integrated-terminal). Click the 'Terminal' tab in the tab group beneath the editor to interact with your application.

When this is set to `externalTerminal` the target process will run in a separate terminal.

## Source File Map
You can optionally configure a file by file mapping by providing map following this schema:

    "sourceFileMap": {
        "C:\\foo":"/home/me/foo"
    }

## Symbol Path
You can optionally provide paths to symbols following this schema:

    "symbolPath": [ "/Volumes/symbols" ]

## Just My Code
You can optionally disable `justMyCode` by setting it to "false". You should disable Just My Code when you are trying to debug into a library that you pulled down which doesn't have symbols or is optimized.

    "justMyCode":false*

Just My Code is a set of features that makes it easier to focus on debugging your code by hiding some of the details of optimized libraries that you might be using, like the .NET Framework itself. The most important sub parts of this feature are --

* User-unhandled exceptions: automatically stop the debugger just before exceptions are about to be caught by the framework
* Just My Code stepping: when stepping, if framework code calls back to user code, automatically stop.

## Require Exact Source
The debugger requires the pdb and source code to be exactly the same. To change this and disable the sources to be the same add:

    "requireExactSource": false

## Stepping into properties and operators
The debugger steps over properties and operators in managed code by default. In most cases, this provides a better debugging experience. To change this and enable stepping into properties or operators add:

    "enableStepFiltering": false

## Logging
You can optionally enable or disable messages that should be logged to the output window. The flags in the logging field are: 'exceptions', 'moduleLoad', 'programOutput', 'engineLogging', and 'browserStdOut'.

## PipeTransport
If you need to have the debugger to connect to a remote computer using another executable to relay standard input and output bewteen VS Code and the .NET Core debugger backend (vsdbg), 
then add the pipeTransport field folloing this schema:

    "pipeTransport": {
        "pipeProgram": "ssh",
        "pipeArgs": [ "-T", "ExampleAccount@ExampleTargetComputer" ],
        "debuggerPath": "~/vsdbg/vsdbg",
        "pipeCwd": "${workspaceFolder}",
        "quoteArgs": true
    }

More information about pipe transport can be found [here](https://github.com/OmniSharp/omnisharp-vscode/wiki/Attaching-to-remote-processes).

You can find information on configuring pipe transport for [Windows Subsystem for Linux](https://msdn.microsoft.com/en-us/commandline/wsl/about) (WSL) [here](https://github.com/OmniSharp/omnisharp-vscode/wiki/Windows-Subsystem-for-Linux).

## Operating System Specific Configurations
If there specific commands that need to be changed per operating system, you can use the fields: 'windows', 'osx', or 'linux'. 
You can replace any of the fields mentioned above for the specific operating system.

