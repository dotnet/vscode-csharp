# Configuring launch.json for C# debugging
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

## Starting a Web Browser

The default launch.json template (as of C# extension v1.20.0) for ASP.NET Core projects will use the following to configure VS Code to launch a web browser when ASP.NET starts:

```json
    "serverReadyAction": {
        "action": "openExternally",
        "pattern": "\\bNow listening on:\\s+(https?://\\S+)"
    }
```

Notes about this:
1. If you do **NOT** want the browser to automatically start, you can just delete this element 
    (and a `launchBrowser` element if your launch.json has that instead).
2. This pattern will launch the web browser using the URL that ASP.NET Core writes 
    to the console. If you want to modify the URL see [specifying the browser's URL](#specifying-the-browsers-url).
    This may be useful if the target application is running on another machine or container, 
    or if `applicationUrl` has a special host name (example: `"applicationUrl": "http://*:1234/"`).
3. `serverReadyAction` is a new feature from VS Code. It is recommended over the previous 
    `launchBrowser` feature that is built into the C# extension's debugger as it can work when
    the C# extension is running on a remote machine, it uses the default browser configured for VS 
    Code, and it also allows using a script debugger. You can continue using `launchBrowser` instead 
    if none of those features are important to you. You also can continue to use `launchBrowser` if
    you want to run a specific program instead of starting the default browser.
4. More documentation for `serverReadyAction` can be found in the [Visual Studio Code February 2019 release notes](https://code.visualstudio.com/updates/v1_32#_automatically-open-a-uri-when-debugging-a-server-program).
5. The way this works is that VS Code will scrape the output which is set to the console. If a line 
    matches the pattern, it will launch a browser against the URL which was 'captured' by the pattern.
    Here is an explanation of what the pattern does:
    * `\\b` : Matches on a word boundery. Note that `\b` indicates a word boundary, but because this is in a json string, the `\` needs to be escaped, hence `\\b`.
    * `Now listening on:` : This is a string literal, meaning that the next text must be `Now listening on:`.
    * `\\s+` : Matches one or more space characters.
    * `(` : This is the beginning of a 'capture group' -- this indicates which region of text will be saved and used to launch the browser.
    * `http` : String literal.
    * `s?` : Either the character `s` or nothing.
    * `://` : String literal.
    * `\\S+` : One or more non-whitespace characters.
    * `)` : The end of the capture group.
6. Both forms of browser launch require `"console": "internalConsole"`, as the browser launcher scrapes 
    the standard output of the target process to know when the web server has initialized itself.

### Specifying the browser's URL

If you want to ignore the URL from the console output, you can remove the 
`(` and `)` from the pattern, and the set `uriFormat` to what you want to launch. Example:

```json
    "serverReadyAction": {
        "action": "openExternally",
        "pattern": "\\bNow listening on:\\s+https?://\\S",
        "uriFormat": "http://localhost:1234"
    }
```

If you want to use the port number from the console output, but not the host name, you can also use something like this:

```json
    "serverReadyAction": {
        "action": "openExternally",
        "pattern": "\\bNow listening on:\\s+http://\\S+:([0-9]+)",
        "uriFormat": "http://localhost:%s"
    }
```

## Environment variables
Environment variables may be passed to your program using this schema:

    "env": {
        "myVariableName":"theValueGoesHere"
    }

## Console (terminal) window

The `"console"` setting controls what console (terminal) window the target app is launched into. It can be set to any of these values --

`"internalConsole"` (default) : the target process's console output (stdout/stderr) goes to the VS Code Debug Console. This is useful for executables that take their input from the network, files, etc. But this does **NOT** work for applications that want to read from the console (ex: `Console.ReadLine`). 

`"integratedTerminal"` : the target process will run inside [VS Code's integrated terminal](https://code.visualstudio.com/docs/editor/integrated-terminal). Click the 'Terminal' tab in the tab group beneath the editor to interact with your application. Alternatively add `"internalConsoleOptions": "neverOpen"` to make it so that the default foreground tab is the terminal tab.

`"externalTerminal"`: the target process will run inside its own external terminal.

## launchSettings.json support

In addition to launch.json, launch options can be configured through a launchSettings.json file. The advantage of 
launchSettings.json is that it allows settings to be shared between Visual Studio Code, full Visual Studio, and `dotnet run`.

To configure which launchSettings.json profile to use (or to prevent it from being used), set the `launchSettingsProfile` option:

    "launchSettingsProfile": "ProfileNameGoesHere"

Which would then, for example, use `myVariableName` from this example launchSettings.json file:

```json
{
  "profiles": {
    "ProfileNameGoesHere": {
      "commandName": "Project",
      "environmentVariables": {
        "myVariableName":"theValueGoesHere"
      }
    }
  }
}
```

If `launchSettingsProfile` is NOT specified, the first profile with `"commandName": "Project"` will be used.

If `launchSettingsProfile` is set to null/an empty string, then Properties/launchSettings.json will be ignored.

By default, the debugger will search for launchSettings.json in {cwd}/Properties/launchSettings.json. To customize this path, set `launchSettingsFilePath`:

   "launchSettingsFilePath": "${workspaceFolder}/<Relative-Path-To-Project-Directory/Properties/launchSettings.json"

Restrictions:
1. Only profiles with `"commandName": "Project"` are supported.
2. Only `environmentVariables`, `applicationUrl` and `commandLineArgs` properties are supported
3. Settings in launch.json will take precedence over settings in launchSettings.json, so for example, if `args` 
is already set to something other than an empty string/array in `launch.json` then the launchSettings.json 
content will be ignored.

## Source File Map
You can optionally configure how source files are opened by providing a map using this form:

    "sourceFileMap": {
        "C:\\foo":"/home/me/foo"
    }

In this example:
* `C:\foo` is the original location for one or more source files (example: `program.cs`) when a module (example: MyCode.dll) was compiled. It can either be a directory that has source files under it, or a complete path to a source file (example: `c:\foo\program.cs`). It doesn't need to exist either on the computer running Visual Studio Code, or if you are remote debugging, on the remote machine. The debugger will read the path to the source file from the .pdb (symbol) file, and it will transform it using this map.
* `/home/me/foo` is the path where the source file can now be found by Visual Studio Code.


## Just My Code
You can optionally disable `justMyCode` by setting it to "false". You should disable Just My Code when you are trying to debug into a library that you pulled down which doesn't have symbols or is optimized.

    "justMyCode":false

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

### Operating System Specific Configurations
If there specific commands that need to be changed per operating system, you can use the fields: 'windows', 'osx', or 'linux'. 
You can replace any of the fields mentioned above for the specific operating system.

## Suppress JIT Optimizations

The .NET Debugger supports the following option. If true, when an optimized module (.dll compiled in the Release configuration) loads in the target process, the debugger will ask the Just-In-Time compiler to generate code with optimizations disabled. The option defaults to false.

```
    "suppressJITOptimizations": true
```

**How optimizations work in .NET:** If you are trying to debug code, it is easier when that code is **NOT** optimized. This is because when code is optimized, the compiler and runtime will make changes to the emitted CPU code so that it runs faster, but has a less direct mapping to original source code. This means that debuggers are frequently unable to tell you the value of local variables, and code stepping and breakpoints might not work as you expect.

Normally the Release build configuration creates optimized code and the Debug build configuration does not. The `Optimize` MSBuild property controls whether the compiler is told to optimize code.

In the .NET ecosystem, code is turned from source to CPU instructions in a two-step process: first, the C# compiler converts the text you type in to an intermediate binary form called MSIL and writes this out to .dll files. Later, the .NET Runtime converts this MSIL to CPU instructions. Both steps can optimize to some degree, but the second step performed by the .NET Runtime performs the more significant optimizations.

**What does the option do:** This option controls what happens when a DLL that was compiled with optimizations enabled loads inside of the target process. If this option is false (the default value), then when the .NET Runtime compiles the MSIL code into CPU code, it leaves the optimizations enabled. If the option is true, then the debugger requests that optimizations be disabled.

**When should you use this option:** This option should be used when you have downloaded dlls from another source, such as a nuget package, and you want to debug the code in this DLL. In order for this to work you must also find the symbol (.pdb) file for this DLL.

If you are only interested in debugging code you are building locally, it is best to leave this option false, as, in some cases, enabling this option will significantly slow down debugging. There are two reason for this slow down --

* Optimized code runs faster. If you are turning off optimizations for lots of code the time can add up.
* If you have Just My Code enabled, the debugger will not even try and load symbols for dlls which are optimized. Finding symbols can take a long time.

**Limitations of this option:** There are two situations where this option will **NOT** work:

1: In situations where you are attaching the debugger to an already running process, this option will have no effect on modules that were already loaded at the time the debugger was attached.

2: This option has no effect on dlls that have been pre-compiled (a.k.a ngen'ed) to native code. However, you can disable usage of pre-compiled code by starting the process with the environment variable `COMPlus_ReadyToRun` set to `0`. If you are targetting an older version of .NET Core (2.x) also set `COMPlus_ZapDisable` set to '1'. If you are launching under the debugger, this code be done by adding this to launch.json --

```json
    "env": {
        "COMPlus_ZapDisable": "1",
        "COMPlus_ReadyToRun": "0"
    }
```

## Symbol Options

The `symbolOptions` element allows customization of how the debugger searches for symbols. Example:

```json
    "symbolOptions": {
        "searchPaths": [
            "~/src/MyOtherProject/bin/debug",
            "https://my-companies-symbols-server"
        ],
        "searchMicrosoftSymbolServer": true,
        "searchNuGetOrgSymbolServer": true,
        "cachePath": "/symcache",
        "moduleFilter": {
            "mode": "loadAllButExcluded",
            "excludedModules": [ "DoNotLookForThisOne*.dll" ]
        }
    }
```

### Properties:

**searchPaths**: Array of symbol server URLs (example: https://msdl.microsoft.com/download/symbols) or directories (example: /build/symbols) to search for .pdb files. These directories will be searched in addition to the default locations -- next to the module and the path where the pdb was originally dropped to.

**searchMicrosoftSymbolServer**: If `true` the Microsoft Symbol server (https://msdl.microsoft.com/download/symbols) is added to the symbols search path. If unspecified, this option defaults to `false`.

**searchNuGetOrgSymbolServer**: If `true` the Nuget.org Symbol server (https://symbols.nuget.org/download/symbols) is added to the symbols search path. If unspecified, this option defaults to `false`.

**cachePath**": Directory where symbols downloaded from symbol servers should be cached. If unspecified, on Windows the debugger will default to %TEMP%\\SymbolCache, and on Linux and macOS the debugger will default to ~/.dotnet/symbolcache.

**moduleFilter.mode**: This value is either `"loadAllButExcluded"` or `"loadOnlyIncluded"`. In `"loadAllButExcluded"` mode, the debugger loads symbols for all modules unless the module is in the 'excludedModules' array. In `"loadOnlyIncluded"` mode, the debugger will not attempt to load symbols for ANY module unless it is in the 'includedModules' array, or it is included through the 'includeSymbolsNextToModules' setting.

#### Properties for `"loadAllButExcluded"` mode: 
**moduleFilter.excludedModules**: Array of modules that the debugger should NOT load symbols for. Wildcards (example: MyCompany.*.dll) are supported.

#### Properties for `"loadOnlyIncluded"` mode: 
**moduleFilter.includedModules**: Array of modules that the debugger should load symbols for. Wildcards (example: MyCompany.*.dll) are supported.

**moduleFilter.includeSymbolsNextToModules**: If true, for any module NOT in the 'includedModules' array, the debugger will still check next to the module itself and the launching executable, but it will not check paths on the symbol search list. This option defaults to 'true'.

## Source Link options

Source Link is a feature that makes it so that when you are debugging code that was built on another computer, such as code coming from a nuget package, the debugger can automatically bring up matching source code by downloading it from the web. To make this work, the .pdb files for the code you are debugging contains data that maps the source files in the DLL to a URL that the debugger can download from. More information about Source Link can be found at [https://aka.ms/SourceLinkSpec](https://aka.ms/SourceLinkSpec).

The `sourceLinkOptions` element in launch.json allows customization of Source Link behavior by URL. It is a map from URL to Source Link options for that URL. Wildcards are supported in the URL name. Currently the only customization is if Source Link is enabled for that URL, but more options may be added in the future.

Example:

```json
    "sourceLinkOptions": {
        "https://raw.githubusercontent.com/*": { "enabled": true },
        "*": { "enabled": false }
    }
```

This example will enable Source Link for GitHub URLs, and disable Source Link for all other URLs.

The default value of this option is to enable Source Link for all URLs. Similarly, Source Link will be enabled for any URL that doesn't have a rule in the `sourceLinkOptions` map.

To disable Source Link for all URLs, use `"sourceLinkOptions": { "*": { "enabled": false } }`.

If multiple entries cover the same URL, the more specific entry (the entry with the longer string length) will be used.

Currently Source Link only works for source files that can be accessed without authentication. So, for example, the debugger can download source files from open source projects on GitHub, but it cannot download from private GitHub repos, or from Visual Studio Team Services.

## Target Architecture options (macOS M1)

.NET on Apple M1 supports both x86_64 and ARM64. When debugging, the architecture of the process the debugger is attaching to and the debugger must match. If they do not match, it may result in `Unknown Error: 0x80131c3c`.

The extension will try to resolve `targetArchitecture` based on the output of `dotnet --info` in the PATH, else it will try to use the same architecture as VS Code.

You can override this behavior by setting `targetArchitecture` in your `launch.json`.

Example:

```json
    "targetArchitecture": "arm64"
```