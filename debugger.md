## .NET Debugging in Visual Studio Code

While it is possible to use the C# extension as a standalone extension, we highly recommend using [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csharp). When using C# Dev Kit, the [official C# debugger documentation](https://code.visualstudio.com/docs/csharp/debugging) and the [official getting started guide](https://code.visualstudio.com/docs/csharp/getting-started) should be used instead of this page.

## Getting started debugging without C# Dev Kit

This guide provides information on getting started with .NET debugging when using the C# extension without C# Dev Kit.

### First Time setup
##### 1: Get Visual Studio Code
Install Visual Studio Code (VS Code). Pick the latest VS Code version from here: https://code.visualstudio.com

##### 2: Install .NET command line tools
Install the .NET command line tools (CLI) by following the installation part of the instructions here: https://dotnet.microsoft.com/download

##### 3: Install C# Extension for VS Code
Open the command palette in VS Code (press <kbd>F1</kbd>) and run `Extensions: Install Extensions`. Enter `C#` in the search box and press `Enter`. Select the extension and click on `Install`.

If you have previously installed the C# extension, make sure that you have a recent version. You can check this by opening the command palette (press <kbd>F1</kbd>) and running `Extensions: Show Installed Extensions`.

### Once for each project
The following steps have to be executed for every project. 
##### 1: Get a project
You can start from scratch by creating an empty console project with `dotnet new`. Begin by opening the terminal in Visual Studio Code (`View->Integrated Terminal`) and type these commands:

    cd ~
    mkdir MyApplication
    cd MyApplication
    dotnet new console
    
See `dotnet new --list` for a list of all the available project templates.

##### 2: Open the directory in VS Code
Go to `File->Open Folder` (`File->Open` on macOS) and open the directory in Visual Studio Code. If this is the first time that the C# extension has been activated, it will now download additional platform-specific dependencies.

##### 3: Add VS Code configuration files to the workspace
VS Code needs to be configured so it understands how to build your project and debug it. For this there are two files which need to be added -- `.vscode/tasks.json` and `.vscode/launch.json`. 

* Tasks.json is used to configure what command line command is executed to build your project, and launch.json configures the type of debugger you want to use, and what program should be run under that debugger. 
* Launch.json configures VS Code to run the build task from tasks.json so that your program is automatically up-to-date each time you go to debug it.

If you open the folder containing your project, the C# extension can automatically generate these files for you if you have a basic project. When you open a project and the C# extension is installed, you should see the following prompt in VS Code:

![Info: Required assets to build and debug are missing from your project. Add them? Yes | Close](https://raw.githubusercontent.com/wiki/dotnet/vscode-csharp/images/info-bar-add-required-assets.png)

Clicking `Yes` on this prompt should add these resources.

**Creating configuration files manually**

If your code has multiple projects or you would rather generate these files by hand, here is how --

**.vscode/tasks.json**: Start with [this example](https://raw.githubusercontent.com/wiki/dotnet/vscode-csharp/ExampleCode/tasks.json) which configures VS Code to launch `dotnet build`. Update the `cwd` property if your project isn't in the root of the open folder. If you don't want to build from VS Code at all, you can skip this file. If you do this, you will need to comment out the `preLaunchTask` from .vscode/launch.json when you create it.

**.vscode/launch.json**: When you want to start debugging, press the debugger play button (or press <kbd>F5</kbd>) as you would normally do. VS Code will provide a list of templates to select from. Pick ".NET Core" from this list and the edit the `program` property to indicate the path to the application dll or .NET Core host executable to launch. For example:

	"configurations": [
		{
			...
			"program": "${workspaceFolder}/MyLaunchingProject/bin/Debug/netcoreapp1.0/MyLaunchingProject.dll",

##### 4: Start debugging
Your project is now all set. Set a breakpoint or two where you want to stop, click the debugger play button (or press <kbd>F5</kbd>) and you are off.

### Debugging Code compiled on another computer
If your code was built on a different computer from where you would like to run in there are a few things to keep in mind --

* **Source Maps**: Unless your local source code is at exactly the same path as where the code was originally built you will need to add a [sourceFileMap](https://github.com/dotnet/vscode-csharp/blob/main/debugger-launchjson.md#source-file-map) to launch.json.
* **Portable PDBs**: If the code was built on Windows, it might have been built using Windows PDBs instead of portable PDBs, but the C# extension only supports portable PDBs. See the [portable PDB documentation](https://github.com/dotnet/vscode-csharp/wiki/Portable-PDBs#how-to-generate-portable-pdbs) for more information.
* **Debug vs. Release**: It is much easier to debug code which has been compiled in the `Debug` configuration. So unless the issue you are looking at only reproduces with optimizations, it is much better to use Debug bits. If you do need to debug optimized code, you will need to disable [justMyCode](https://github.com/dotnet/vscode-csharp/blob/main/debugger-launchjson.md#just-my-code) in launch.json.

#### [Configurating launch.json for C# Debugging](debugger-launchjson.md)

#### Attach Support

See the [official documentation](https://code.visualstudio.com/docs/csharp/debugging#_attaching-to-a-process).

#### Remote Debugging

The debugger supports remotely launching or attaching to processes. See [Attaching to remote processes](https://github.com/dotnet/vscode-csharp/wiki/Attaching-to-remote-processes) in the wiki for more information.

#### Exception Settings

See the [official documentation](https://code.visualstudio.com/docs/csharp/debugging#_stopping-on-exceptions).
