# Configurating launch.json for C# debugging
The launch.json file is used to configure the debugger in Visual Studio Code.

Visual Studio Code generates a launch.json with almost all of the required information. To get started debugging you need to fill in the program field with the path to the executable you plan to debug. This must be specified for both the launch and attach (if you plan to attach to a running instance at any point) configurations.

The generated file contains two sections. One that configures debugging for launch and a second that configures debugging for attach.

If your workspace has only one launchable project, the C# extension will offer to automatically generate this file. If you missed this prompt, you can force the generation by executing the command `.NET: Generate Assets for Build and Debug` from the VS Code command pallet.

# Configurating VS Code's debugging behavior

## PreLaunchTask
The `preLaunchTask` field runs the associated taskName in tasks.json before debugging your program. You can get the default build prelaunch task by executing the command `Tasks: Configure Tasks Runner` from the VS Code command pallet.

This will create a task that runs `dotnet build`. You can read more about tasks at [https://code.visualstudio.com/docs/editor/tasks](https://code.visualstudio.com/docs/editor/tasks).

## Just My Code
You can optionally disable justMyCode by setting it to "false". You should disable Just My Code when you are trying to debug into a library that you pulled down which doesn't have symbols or is optimized.

    "justMyCode":false*

Just My Code is a set of features that makes it easier to focus on debugging your code by hiding some of the details of optimized libraries that you might be using, like the .NET Framework itself. The most important sub parts of this feature are --

* User-unhandled exceptions: automatically stop the debugger just before exceptions are about to be caught by the framework
* Just My Code stepping: when stepping, if framework code calls back to user code, automatically stop.

## Source File Map
You can optionally configure a file by file mapping by providing map following this schema:

    "sourceFileMap": {
        "C:\foo":"/home/me/foo"
    }

## Symbol Path
You can optionally provide paths to symbols following this schema:

    "symbolPath": [ "/Volumes/symbols" ]

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

## Stepping into properties and operators
The debugger steps over properties and operators in managed code by default. In most cases, this provides a better debugging experience. To change this and enable stepping into properties or operators add:

    "enableStepFiltering": false
