#Instructions for setting up the .NET Core debugger - EXPERIMENTAL PREVIEW
Thank you for taking the time to try out our bits. 
This page gives you detailed instructions on how to get your system running. 

####Your Feedback​
Please place your feedback [here](https://github.com/OmniSharp/omnisharp-vscode/issues). 

####Prerequisites / Known Issues / Notes
* Requires .NET Core rc3-23829 or newer. These are daily builds of .NET Core that can be downloaded from the https://www.myget.org/F/dotnet-core/api/v3/index.json nuget feed. These are really daily builds of .NET Core and associated tools. So please continue if you want to dig in and have fun playing with new bits. But don't expect to go to production with those.
* X64 only
* Supports Windows, OSX, and Ubuntu 14.04
* In case you get this error on F5: *"No task runner configured -  Tasks.json could not be found"*, see the 'once for each project' section below. 
* If you don’t have mono installed you won't get IntelliSense. 

###First Time setup
1. Get Visual Studio Code
 * Install Visual Studio Code (VSC). Pick the latest VSC version from here: https://code.visualstudio.com Make sure it is at least 0.10.10.       
2. Install Dotnet CLI
 * Install Dotnet CLI following the instructions here:  http://dotnet.github.io/getting-started  
 * **Hint for Mac**: Dotnet CLI requires openSSL to work. Don't forget this! Execute: `brew install openssl`
 * **Hint for Windows**: To be able to create portable PDBs you need a newer version of dotnet CLI. See [here](https://github.com/OmniSharp/omnisharp-vscode/wiki/Portable-PDBs#downloading-a-net-cli-which-supports-debugtype-option) for more information.
3. Install C# Extension for VS Code
 * Open the command palette in VSC (F1) and type "ext install C#" to trigger the installation of the extension.
 * VSC will show a message that the extension has been installed and it will restart. 
4. Trigger download of platform specific binaries
 * After the extension is installed, open any C# file in VSC. 
 * In the background a process is triggered to get required bits. You can follow that process in the output window of VSC. Wait to finish that process.
5. Install Mono (Linux/OSX)
 * To be able to auto-create a tasks.json for every project you'll currently need Mono. You could skip this step, but then you need to create the file manually.
 * Follow the instructions [how to install mono here](http://www.mono-project.com/docs/getting-started/install/). Make sure the version you have installed is >=4.0.1 .


###Once for each project
The following steps have to executed for every project. 
* Whenever you want to start debugging a .NET Core app (e.g. by pressing the debugger-play button) select '.NET Core"  for debug environment in the command palette when VS code first asks for it. 
* This will create a launch.json file. Enter the name of the executable in 'program' field (including the path). This could be something like *"${workspaceRoot}/bin/Debug/dnxcore50/osx.10.11-x64/HelloWorld"*. On Ubuntu, replace the 'osx...' folder with 'ubuntu.14.04-x64', on Windows, use 'win7-x64'. If are aren't sure, drop to the command line, do a 'dotnet build' and look for the built executable file (**NOT** .dll) under the 'bin/Debug' directory.
* For attach scenarios modify the processName attribute of launch.json
* If you want 'compile' support for F5 you need to create a tasks.json file . There are multiple ways to do this.
  * You can get it [here](https://github.com/OmniSharp/omnisharp-vscode/blob/dev/template-tasks.json) and put it manually next to your launch.json file 
  * Or you can open the command palette in VSC (F1) and run the command *"Debugger: Add tasks.json"* (Make sure you have installed Mono to be able to do so, see above. If you don't have Mono installed you might get an error saying *Omnisharp not running*.)
  * Or if you just want debugging, you can comment out 'preCompileTask' field​ in launch.json.
* Modify your project.json to reference "NETStandard.Library":"1.0.0-rc3-*"
   * Currently *dotnet new* creates a project.json that references a version that's too old. You should also get a hint to modify this.
   * Afterwards run *dotnet restore*.
* In case you get a restore error due to lack of a NuGet.Config file, just create this file in the root directory of your project. You can find a sample [here](https://github.com/Microsoft/MIEngine/blob/abeebec39221c654bd69a0d2bcadca6a4a0d0392/tools/InstallToVSCode/CLRDependencies/NuGet.Config). 

###Debugging Code compiled on another computer
* If the target binary is built on Linux / OSX, dotnet CLI will produce portable pdbs by default so no action is necessary.   
* On Windows, you will need to take additional steps to build [portable PDBs](https://github.com/OmniSharp/omnisharp-vscode/wiki/Portable-PDBs#downloading-a-net-cli-which-supports-debugtype-option).

####More things to configure In launch.json
#####Just My Code
You can optionally disable justMyCode by setting it to "false".
>*"justMyCode":false*

#####Source File Map
You can optionally configure a file by file mapping by providing map following this schema:

>"sourceFileMap":  {
    "C:\foo":"/home/me/foo"
    }

#####Symbol Path
You can optionally provide paths to symbols following this schema:
>"symbolPath":"[ \"/Volumes/symbols\"]"


###Debugging ASP.NET Core
In case you want to debug ASP.NET Core applications you can find [samples to get started](https://github.com/caslan/cli-samples) here. 
To be able to run the samples on Linux using Kestrel as Webserver, follow the [setup instructions "Install libuv" here](http://docs.asp.net/en/latest/getting-started/installing-on-linux.html#install-libuv). 
Currently this page also contains other steps which were required earlier only. Those other sections can be ignored. 
