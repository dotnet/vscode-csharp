## Introduction

This page contains more information about the error:

> The .NET Core SDK cannot be located. .NET Core debugging will not be enabled. Make sure the .NET Core SDK is installed and is on the path.

What this error means is that this extension ran the command `dotnet` and `dotnet` was **NOT** found on the `PATH` within the extension's process.

If you don't have the .NET Core SDK installed, fixing this error is usually simple enough: visit https://dot.net/core-sdk-vscode to download and install the .NET Core SDK.

If you do have the .NET Core SDK installed, then this means that the directory containing `dotnet` (Linux and macOS) or `dotnet.exe` (Windows) is not on your `PATH`, at least in this extension's process. The rest of this page will provide advice on understanding why.

## Known issues

Before we get to a list of troubleshooting steps, lets first enumerate a few known reasons why this error happens:

1. If you very recently installed the .NET SDK --
   * If you had Visual Studio Code open at the time you installed the .NET SDK, and you haven't restarted it, you should do so.
   * On Windows, on some machines, environment variable changes don't immediately take effect. Restart your computer to see if that resolves this problem.
2. If the .NET SDK was installed through Linux Snap - see [Linux Snap instructions](#linux-snap-instructions)

## General troubleshooting steps on Linux/Mac

The first step in troubleshooting this problem is to see if this problem also happens is a terminal/shell. After you have launched a terminal or shell, type in `which dotnet`.

If `which dotnet` produces a PATH, then the .NET SDK was able to successfully modify the PATH, but VS Code isn't picking it up. VS Code attempts to scrape the environment by launching the default shell under the covers. But this process can be fragile. You can attempt to work around this by starting VS Code from your Terminal. Alternatively, you can attempt to debug VS Code to understand what is going wrong -- at this time at least, the function to debug is [`getUnixShellEnvironment`](https://github.com/microsoft/vscode/blob/ab10e26096a5494b68bc709a405a0dddeb227e0b/src/vs/code/node/shellEnv.ts#L13). Lastly, you could manually add a symbolic link from within a directory which is on the PATH in all processes to wherever `dotnet` is installed (see below for instructions).

If `which dotnet` produces no output, then this means the .NET SDK wasn't able to modify the `PATH` or add a symbolic link, or the .NET SDK for your platform doesn't do so. You can fix this by either adding a symbolic link yourself (example: `sudo ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet` where `/usr/share/dotnet/dotnet` should be replaced with wherever the .NET SDK installer for your platform was installed to), or by modifying your `PATH` manually (example: modify ~/.bashrc add add something like `export PATH=$PATH:/new/directory/here`).

## General troubleshooting steps on Windows

First, as mentioned above, if you installed the .NET SDK since you last rebooted Windows, you might start by just rebooting to see if that fixes things.

Otherwise, you can start troubleshooting this problem is to see if this problem also happens is a command prompt:

* Start a command prompt:
    * Hit `WinKey+R` to bring up the Windows run dialog
    * Type in `cmd.exe`
* When the command prompt starts, type in `where.exe dotnet`.

If the result of running `where.exe` is that a path to dotnet.exe is printed (example: `C:\Program Files\dotnet\dotnet.exe`) then the .NET SDK has successfully added itself to the Windows Path. There are no known reasons why PATH wouldn't be propagated to the VS Code process. You could try starting VS Code from the command prompt to see if that helps.

If the result of running `where.exe` is a message like `INFO: Could not find files for the given pattern(s).` then the .NET SDK wasn't able to add itself to the PATH. You could try uninstalling and reinstalling the .NET SDK. You could also try examining the default path with the following steps:

* Bring up System Properties:
    * Windows 10 - On the Start Menu, search for 'This PC' and bring up properties
    * Before - On the Start Menu, search for 'My Computer' and bring up properties
* Go to the Advanced settings
* Click the button for 'Environment Variables'
* Find 'Path' in either the user or system list
* See if the dotnet.exe directory (example: `C:\Program Files\dotnet`) is in the list. If not you could add it.
* If it is in the list, you could see if maybe another directory has added it self incorrectly (example: added an opening quote without a trailing quote), or if the set of environment variables has grown very large -- there is a limit of 32,767 total characters.

### Note about 64-bit installs of the .NET SDK

In 64-bit environments the .NET SDK will fail to be discovered if the 32-bit dotnet path comes before the 64-bit dotnet path in the Environment PATH variable. Try removing the 32-bit path entirely from your PATH variable and relaunch VS Code to see if your issue is resolved.

## Special instructions

#### Linux Snap instructions

The Linux Snap packages for the .NET Core SDK, by default, will not create the `dotnet` link. To do so, run `sudo snap alias dotnet-sdk.dotnet dotnet`. More information about this can be found in [the .NET Core SDK release notes](https://github.com/dotnet/core/blob/master/release-notes/3.1/3.1.0/3.1.0-install-instructions.md#install-using-snap).

Note that, as of the time of this writing, there are also other incompatibilities between this extension and the .NET Core SDK Snap package beyond the `dotnet` PATH issue. This incompatibility may result in:

> Some projects have trouble loading. Please review the output for more details.
> It was not possible to find any installed .NET Core SDKs
> Did you mean to run .NET Core SDK commands? Install a .NET Core SDK from:
> 	https://aka.ms/dotnet-download

More information about this problem can be found in [dotnet/cli#12110](https://github.com/dotnet/cli/issues/12110).

Another possible workaround is to add the following to `~/.omnisharp/omnisharp.json`.

```json
{
    "MSBuild": {
        "UseLegacySdkResolver": true
    }
}
```

Instead, you also may create a symbolic link to your dotnet install like so:

`ln -s /snap/dotnet-sdk/current/dotnet /usr/local/bin/dotnet`
