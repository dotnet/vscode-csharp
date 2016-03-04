#Instructions for setting up the .NET Core debugger - PREVIEW
*Updated on  March 1st 2016 - setup works for Linux & Mac.*

***Currently working within Microsoft Corp-Net only.***

Thank you for taking the time to try out our bits. 
This page gives you detailed instructions on how to get your system running. 
It will be updated on a regulary basis to always reflect the latest behaviour. Now let's get started.​

####Your Feedback​

Please place your feedback [here](https://github.com/OmniSharp/omnisharp-vscode/issues). 

####Prerequisites / Known Issues / Notes
* X64 only
* Basic Debugging Setup successfully validated on Ubuntu Linux and Mac
* Currently NOT working on Windows
* In case you get this error on F5: *"No task runner configured -  Tasks.json could not be found"*, see the 'once for each project' section below. 
* If you don’t have mono installed you won't get IntelliSense. 
* **Hint:** Setup for Debugging CLR on OSX changed fundamentally end of February 2016. For existing projects please make sure to update your launch.json file according to these steps.​

###First Time setup
1. Get Visual Studio Code
    * Install Visual Studio Code. Pick the latest insider version from here: https://code.visualstudio.com/insiders
    * **Hint:** While we are in a pre-release phase vscode might ask you to install a C# extension from the marketplace. DO NOT INSTALL IT! This extension doesn't contain debugger bits yet and might bring your system in a weird state.   
2. Install Dotnet CLI
 * Install Dotnet CLI following the instructions here:  http://dotnet.github.io/getting-started  
 * **Hint for Mac**: Dotnet CLI requires openSSL to work. Don't forget this! Execute: `brew install openssl`
3. Install C# Extension for VS Code
 * Get the .vsix file from here: \\\\vsdbgqa\x-plat\vscode-extension\csharp . 
 * Open "omnisharp-0.3.2.vsix" from within VSC to install the extension. VSC will show a message that the extension has been installed and it will restart. 
4. Trigger download of platform specific binaries
 * After the extension is installed, open any C# file in VSC. 
 * In the background a process is triggered to get required bits. You can follow that process in the output window of VSC. Wait to finish that process.
5. Install Mono 
 * To be able to auto-create a tasks.json for every project you'll currently need Mono. You could skip this step, but then you need to create the file manually.
 * Follow the instructions [how to install mono here](http://www.mono-project.com/docs/getting-started/install/). Make sure the version you have installed is >=4.0.1 .
 

###Once for each project
The following steps have to executed for every project. 
* Whenever you want to start debugging (e.g. by pressing the debugger-play button) a .NET Core app select '.NET Core"  for debug environment in the command pallette when VS code first asks for it. 
* This will create a launch.json file. Enter the name of the executable in 'program' field (including the path). This could be something like *"${workspaceRoot}/bin/Debug/dnxcore50/osx.10.11-x64/HelloWorld"*. 
* For attach scenarios modify the processName attribute of launch.json
* If you want 'compile' support for F5 you need to create a tasks.json file . There are multiple ways to do this.
  * You can get it [here](https://github.com/OmniSharp/omnisharp-vscode/blob/dev/template-tasks.json) and put it manually next to your launch.json file 
  * Or you can open the command pallette in VSC (F1) and run the command *"Debugger: Add tasks.json"* (Make sure you have installed Mono to be able to do so, see above. If you don't have Mono installed you might get an error saying *Omnisharp not running*.)
  * Or if you just want debugging, you can comment out 'preCompileTask' field​
  * Modify your project.json to reference "NETStandard.Library":"1.0.0-rc3-*"
   * Currently dotnet new creates a project.json that references a version that's too old. You should also get a hint to modify this.
   * Afterwards run *dotnet restore*.
* In case you get a restore error due to lack of a NuGet.Config file, just create this file in the root directory of your project. You can find a sample [here](https://github.com/Microsoft/MIEngine/blob/abeebec39221c654bd69a0d2bcadca6a4a0d0392/tools/InstallToVSCode/CLRDependencies/NuGet.Config). 

####Debugging Code compiled on another computer
* The target app binaries must be built with Portable PDBs for symbol loading to work. 
* If the target binary is built on Linux / OSX, dotnet CLI will produce portable pdbs by default so no action is necessary. 
* If the target binary is built on windows, the pdb needs to be converted: [How to convert Windows PDBs to Portable](https://microsoft.sharepoint.com/teams/DD_VSPlat/Diagnostics/_layouts/15/WopiFrame.aspx?sourcedoc={872c5298-6f17-4960-a5a0-acc4f215e730}&action=edit&wd=target%28%2F%2FMDD%2FXPlat%20CLR.one%7C1b640b59-6617-4452-b360-c24e9d5cad48%2FHow%20to%20convert%20Windows%20PDBs%20to%20Portable%7C49651c0c-f5a0-4d77-9478-9a233f0bf345%2F%29)

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


